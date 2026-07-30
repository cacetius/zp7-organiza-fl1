import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { MessageSquare } from "lucide-react";
import { format, subDays } from "date-fns";

export default function EfficiencyRankingCard() {
  const { data: notes = [] } = useQuery({
    queryKey: ["hourly-notes-ranking"],
    queryFn: () => base44.entities.HourlyNote.filter({ modulo: "producao" }),
    staleTime: 5 * 60_000,
  });

  const { data: prodRecords = [] } = useQuery({
    queryKey: ["prod-ranking-all"],
    queryFn: () => base44.entities.ProductionControl.list("-created_date", 500),
    staleTime: 5 * 60_000,
  });

  const ranking = useMemo(() => {
    const scoreMap = {};
    notes.forEach(n => {
      const key = n.created_by_id || "desconhecido";
      if (!scoreMap[key]) scoreMap[key] = { id: key, pontos: 0, notas: 0, fotos: 0 };
      if (n.justificativa) { scoreMap[key].pontos += n.foto_url ? 5 : 3; scoreMap[key].notas++; if (n.foto_url) scoreMap[key].fotos++; }
    });
    prodRecords.forEach(p => {
      const key = p.created_by_id || "desconhecido";
      if (!scoreMap[key]) scoreMap[key] = { id: key, pontos: 0, notas: 0, fotos: 0 };
      if (p.justificativa) { scoreMap[key].pontos += p.justificativa_foto_url ? 4 : 2; scoreMap[key].notas++; if (p.justificativa_foto_url) scoreMap[key].fotos++; }
    });
    return Object.values(scoreMap).filter(r => r.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 5);
  }, [notes, prodRecords]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["user-profiles-ranking"],
    queryFn: () => base44.entities.UserProfile.list(),
    staleTime: 10 * 60_000,
    enabled: ranking.length > 0,
  });

  const rankingComNome = useMemo(() =>
    ranking.map(r => ({ ...r, nome: profiles.find(p => p.created_by_id === r.id)?.nome || "Colaborador" })),
    [ranking, profiles]
  );

  const totalNotas = notes.filter(n => n.justificativa).length + prodRecords.filter(p => p.justificativa).length;

  if (rankingComNome.length === 0) return null;

  const maxPts = rankingComNome[0]?.pontos || 1;
  const medals = ["1º", "2º", "3º", "4º", "5º"];

  return (
    <div className="page-section">
      <div className="page-section-header">
        <span className="page-section-title">Ranking de Registros — Turno</span>
        <span className="text-[12px] text-muted-foreground">{totalNotas} anotações no total</span>
      </div>
      <table className="data-table w-full">
        <thead>
          <tr>
            <th className="w-10">#</th>
            <th>Colaborador</th>
            <th>Progresso</th>
            <th className="text-right">Pontos</th>
            <th className="text-right">Registros</th>
          </tr>
        </thead>
        <tbody>
          {rankingComNome.map((r, i) => {
            const pct = Math.round((r.pontos / maxPts) * 100);
            return (
              <tr key={r.id}>
                <td className="text-muted-foreground font-medium">{medals[i]}</td>
                <td className="font-medium text-foreground">{r.nome}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden max-w-[120px]">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{pct}%</span>
                  </div>
                </td>
                <td className="text-right font-semibold tabular-nums text-foreground">{r.pontos}</td>
                <td className="text-right text-muted-foreground tabular-nums">{r.notas}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}