import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, AlertTriangle, Wrench, TrendingUp } from "lucide-react";

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

  // Calcula MTBF por testor: tempo médio entre falhas = total_tempo_parado / num_eventos
  // Score de risco = (falhas * 10) + (reprovacoes * 5) + (paradas_curtas * 2)
  const rankings = useMemo(() => {
    return testores.map(t => {
      const events = mtbfEvents.filter(e => e.testor_nome === t.nome);
      const totalParado = events.reduce((s, e) => s + (e.tempo_parado || 0), 0);
      const mtbf = events.length > 1
        ? Math.round(totalParado / events.length)
        : null;
      const score = (t.falhas_turno || 0) * 10 + (t.reprovacoes || 0) * 5 + (t.paradas_curtas || 0) * 2;
      return { ...t, mtbf, score, eventCount: events.length };
    });
  }, [testores, mtbfEvents]);

  const topPerformers = useMemo(() =>
    [...rankings]
      .filter(t => t.status === "rodando")
      .sort((a, b) => a.score - b.score)
      .slice(0, 3),
    [rankings]
  );

  const atencaoCritica = useMemo(() =>
    [...rankings]
      .filter(t => t.score > 0 || t.status === "parado" || t.status === "manutencao")
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
    [rankings]
  );

  if (testores.length === 0) return null;

  const statusDot = {
    rodando: "bg-green-400 animate-pulse",
    atencao: "bg-yellow-400",
    parado: "bg-red-400",
    manutencao: "bg-orange-400",
    bloqueado: "bg-gray-400",
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Top Performance */}
      <Card className="border-green-500/20">
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-border/50">
          <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Trophy className="w-3.5 h-3.5 text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Top Performance</h3>
            <p className="text-[10px] text-muted-foreground">Menor score de risco</p>
          </div>
        </div>
        <CardContent className="px-5 py-4 space-y-2.5">
          {topPerformers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados suficientes</p>
          ) : topPerformers.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/40">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                i === 0 ? "bg-yellow-500/20 text-yellow-400" :
                i === 1 ? "bg-slate-500/20 text-slate-400" :
                "bg-orange-800/20 text-orange-600"
              }`}>
                {i + 1}º
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[t.status] || "bg-gray-400"}`} />
                  <p className="font-semibold text-sm truncate">{t.nome}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Score {t.score} · {t.mtbf != null ? `MTBF ${t.mtbf}min` : "sem eventos"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-black text-green-400">{t.carros_testados_turno || 0}</p>
                <p className="text-[9px] text-muted-foreground">carros</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Atenção Crítica */}
      <Card className="border-red-500/20">
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-border/50">
          <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Atenção Crítica</h3>
            <p className="text-[10px] text-muted-foreground">Maior score de risco / parados</p>
          </div>
        </div>
        <CardContent className="px-5 py-4 space-y-2.5">
          {atencaoCritica.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <p className="text-sm text-green-400 font-medium">Todos os testores OK</p>
            </div>
          ) : atencaoCritica.map((t) => {
            const statusLabel = { rodando: "Rodando", atencao: "Atenção", parado: "Parado", manutencao: "Manutenção", bloqueado: "Bloqueado" };
            const statusColor = {
              rodando: "text-green-400",
              atencao: "text-yellow-400",
              parado: "text-red-400",
              manutencao: "text-orange-400",
              bloqueado: "text-gray-400",
            };
            return (
              <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/40">
                <div className="w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                  <Wrench className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[t.status] || "bg-gray-400"}`} />
                    <p className="font-semibold text-sm truncate">{t.nome}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {t.falhas_turno || 0} falhas · {t.reprovacoes || 0} reprov. · {t.paradas_curtas || 0} paradas
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-black ${statusColor[t.status] || "text-muted-foreground"}`}>
                    {statusLabel[t.status] || t.status}
                  </p>
                  <p className="text-[9px] text-muted-foreground">score {t.score}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}