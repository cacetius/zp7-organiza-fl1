import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Medal, Star, TrendingUp, MessageSquare } from "lucide-react";
import { format, subDays } from "date-fns";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function EfficiencyRankingCard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const last30 = format(subDays(new Date(), 30), "yyyy-MM-dd");

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

  // Ranking por responsável: quem mais registrou justificativas detalhadas e com fotos
  const ranking = useMemo(() => {
    // Agrupa justificativas por usuário (campo created_by_id ou responsavel)
    // Como não temos responsavel na HourlyNote, usamos os registros de produção com justificativa
    const scoreMap = {};

    // +3 pts por nota geral com texto, +5 com foto
    notes.forEach(n => {
      const key = n.created_by_id || "desconhecido";
      if (!scoreMap[key]) scoreMap[key] = { id: key, nome: "Operador", pontos: 0, notas: 0, fotos: 0 };
      if (n.justificativa) {
        scoreMap[key].pontos += n.foto_url ? 5 : 3;
        scoreMap[key].notas++;
        if (n.foto_url) scoreMap[key].fotos++;
      }
    });

    // +2 pts por justificativa de testor com texto, +4 com foto
    prodRecords.forEach(p => {
      const key = p.created_by_id || "desconhecido";
      if (!scoreMap[key]) scoreMap[key] = { id: key, nome: "Operador", pontos: 0, notas: 0, fotos: 0 };
      if (p.justificativa) {
        scoreMap[key].pontos += p.justificativa_foto_url ? 4 : 2;
        scoreMap[key].notas++;
        if (p.justificativa_foto_url) scoreMap[key].fotos++;
      }
    });

    return Object.values(scoreMap)
      .filter(r => r.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 5);
  }, [notes, prodRecords]);

  // Busca perfis para mapear nome
  const { data: profiles = [] } = useQuery({
    queryKey: ["user-profiles-ranking"],
    queryFn: () => base44.entities.UserProfile.list(),
    staleTime: 10 * 60_000,
    enabled: ranking.length > 0,
  });

  const rankingComNome = useMemo(() => {
    return ranking.map(r => {
      const profile = profiles.find(p => p.created_by_id === r.id);
      return { ...r, nome: profile?.nome || "Colaborador" };
    });
  }, [ranking, profiles]);

  // Estatísticas gerais
  const totalNotas = notes.filter(n => n.justificativa).length + prodRecords.filter(p => p.justificativa).length;
  const totalFotos = notes.filter(n => n.foto_url).length + prodRecords.filter(p => p.justificativa_foto_url).length;

  return (
    <Card className="border-yellow-500/20">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <Medal className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Ranking de Iniciativas</h3>
            <p className="text-[10px] text-muted-foreground">Proficiência em registros de turno</p>
          </div>
        </div>
        <div className="flex gap-3 text-right">
          <div>
            <p className="text-sm font-black text-primary">{totalNotas}</p>
            <p className="text-[9px] text-muted-foreground uppercase">registros</p>
          </div>
          <div>
            <p className="text-sm font-black text-blue-400">{totalFotos}</p>
            <p className="text-[9px] text-muted-foreground uppercase">fotos</p>
          </div>
        </div>
      </div>

      <CardContent className="px-5 py-4">
        {rankingComNome.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
            <MessageSquare className="w-8 h-8 opacity-30" />
            <p className="text-sm text-center">Nenhum registro de justificativa ainda.<br />Comece a registrar para aparecer no ranking!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rankingComNome.map((r, i) => {
              const pct = rankingComNome[0]?.pontos > 0 ? Math.round((r.pontos / rankingComNome[0].pontos) * 100) : 0;
              const isTop = i === 0;
              return (
                <div key={r.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                  isTop ? "bg-yellow-500/10 border-yellow-500/30" : "bg-muted/20 border-border/40"
                }`}>
                  <span className="text-xl shrink-0 w-8 text-center">{MEDALS[i] || `${i + 1}º`}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-bold text-sm truncate ${isTop ? "text-yellow-300" : "text-foreground"}`}>{r.nome}</p>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Star className={`w-3 h-3 ${isTop ? "text-yellow-400" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-black ${isTop ? "text-yellow-400" : "text-foreground"}`}>{r.pontos} pts</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isTop ? "bg-yellow-400" : "bg-primary/60"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      {r.notas} anotações · {r.fotos} com foto
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sistema de pontos */}
        <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><span className="text-primary font-bold">+2 pts</span> Justificativa de testor</div>
          <div className="flex items-center gap-1.5"><span className="text-blue-400 font-bold">+4 pts</span> Justificativa + foto</div>
          <div className="flex items-center gap-1.5"><span className="text-green-400 font-bold">+3 pts</span> Nota geral de hora</div>
          <div className="flex items-center gap-1.5"><span className="text-yellow-400 font-bold">+5 pts</span> Nota geral + foto</div>
        </div>
      </CardContent>
    </Card>
  );
}