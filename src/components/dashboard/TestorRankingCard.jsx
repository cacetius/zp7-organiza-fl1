import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Wrench, TrendingUp, Trophy } from "lucide-react";

export default function TestorRankingCard() {
  const { data: testores = [] } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
    staleTime: 5 * 60_000,
  });

  const { data: mtbfEvents = [] } = useQuery({
    queryKey: ["mtbf-events-ranking"],
    queryFn: () => base44.entities.MtbfEvent.list("-created_date", 200),
    staleTime: 2 * 60_000,
  });

  const rankings = useMemo(() =>
    testores.map(t => {
      const events = mtbfEvents.filter(e => e.testor_nome === t.nome);
      const totalParado = events.reduce((s, e) => s + (e.tempo_parado || 0), 0);
      const mtbf = events.length > 1 ? Math.round(totalParado / events.length) : null;
      const score = (t.falhas_turno || 0) * 10 + (t.reprovacoes || 0) * 5 + (t.paradas_curtas || 0) * 2;
      return { ...t, mtbf, score, eventCount: events.length };
    }), [testores, mtbfEvents]);

  const topPerformers = useMemo(() =>
    [...rankings].filter(t => t.status === "rodando").sort((a, b) => a.score - b.score).slice(0, 4),
    [rankings]);

  const atencaoCritica = useMemo(() =>
    [...rankings].filter(t => t.score > 0 || t.status === "parado" || t.status === "manutencao").sort((a, b) => b.score - a.score).slice(0, 4),
    [rankings]);

  if (testores.length === 0) return null;

  const statusDot = { rodando: "bg-green-500 animate-pulse", atencao: "bg-amber-500", parado: "bg-red-500", manutencao: "bg-orange-500", bloqueado: "bg-slate-400" };
  const statusLabel = { rodando: "Operando", atencao: "Atenção", parado: "Parado", manutencao: "Manutenção", bloqueado: "Bloqueado" };
  const statusColor = { rodando: "text-green-500", atencao: "text-amber-500", parado: "text-red-500", manutencao: "text-orange-500", bloqueado: "text-slate-400" };

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Top Performance */}
      <div className="page-section">
        <div className="page-section-header">
          <span className="page-section-title flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-muted-foreground" /> Top Performance
          </span>
          <span className="text-[11px] text-muted-foreground">menor score de risco</span>
        </div>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Testor</th>
              <th>MTBF</th>
              <th className="text-right">Carros</th>
            </tr>
          </thead>
          <tbody>
            {topPerformers.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-6 text-[13px]">Sem dados suficientes</td></tr>
            ) : topPerformers.map((t, i) => (
              <tr key={t.id}>
                <td className="text-muted-foreground font-medium">{i + 1}º</td>
                <td>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[t.status] || "bg-slate-400"}`} />
                    <span className="font-medium text-foreground">{t.nome}</span>
                  </span>
                </td>
                <td className="tabular-nums text-[13px]">{t.mtbf != null ? `${t.mtbf}min` : "—"}</td>
                <td className="text-right font-medium tabular-nums">{t.carros_testados_turno || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Atenção Crítica */}
      <div className="page-section">
        <div className="page-section-header">
          <span className="page-section-title flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" /> Atenção Crítica
          </span>
          <span className="text-[11px] text-muted-foreground">maior score de risco</span>
        </div>
        {atencaoCritica.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
            <TrendingUp className="w-7 h-7 text-green-500/60" />
            <p className="text-[13px] text-green-600 font-medium">Todos os testores OK</p>
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Testor</th>
                <th>Status</th>
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {atencaoCritica.map(t => (
                <tr key={t.id}>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[t.status] || "bg-slate-400"}`} />
                      <span className="font-medium text-foreground">{t.nome}</span>
                    </span>
                    <p className="text-[11px] text-muted-foreground pl-3">{t.falhas_turno || 0} falhas · {t.reprovacoes || 0} reprov.</p>
                  </td>
                  <td>
                    <span className={`text-[12px] font-medium ${statusColor[t.status] || "text-muted-foreground"}`}>
                      {statusLabel[t.status] || t.status}
                    </span>
                  </td>
                  <td className="text-right font-semibold tabular-nums text-red-500">{t.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}