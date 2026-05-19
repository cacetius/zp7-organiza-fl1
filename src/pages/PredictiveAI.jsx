import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, AlertTriangle, Clock, Car, TrendingUp, Shield } from "lucide-react";

function calculateRisk(testor) {
  let score = 0;
  const t = testor;

  // Factor: tempo médio acima do ideal
  if (t.tempo_medio_carro && t.tempo_minimo) {
    const ratio = t.tempo_medio_carro / (t.tempo_minimo || 1);
    if (ratio > 1.5) score += 25;
    else if (ratio > 1.2) score += 15;
    else if (ratio > 1.1) score += 5;
  }

  // Factor: falhas no turno
  if (t.falhas_turno >= 5) score += 25;
  else if (t.falhas_turno >= 3) score += 15;
  else if (t.falhas_turno >= 1) score += 8;

  // Factor: reprovações
  if (t.reprovacoes >= 5) score += 15;
  else if (t.reprovacoes >= 2) score += 8;

  // Factor: paradas curtas
  if (t.paradas_curtas >= 5) score += 15;
  else if (t.paradas_curtas >= 3) score += 10;

  // Factor: tempo desde última manutenção
  if (t.ultima_manutencao) {
    const days = Math.floor((Date.now() - new Date(t.ultima_manutencao).getTime()) / 86400000);
    if (days > 30) score += 20;
    else if (days > 14) score += 10;
    else if (days > 7) score += 5;
  } else {
    score += 10;
  }

  // Factor: tempo parado alto
  if (t.tempo_total_parado >= 60) score += 10;
  else if (t.tempo_total_parado >= 30) score += 5;

  return Math.min(100, score);
}

function getRiskLevel(score) {
  if (score <= 30) return { label: "Baixo", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" };
  if (score <= 60) return { label: "Médio", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" };
  if (score <= 80) return { label: "Alto", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" };
  return { label: "Crítico", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" };
}

function generateExplanation(testor, score) {
  const reasons = [];
  if (testor.tempo_medio_carro && testor.tempo_minimo && testor.tempo_medio_carro > testor.tempo_minimo * 1.2) {
    reasons.push(`Tempo médio (${testor.tempo_medio_carro}min) acima do mínimo (${testor.tempo_minimo}min)`);
  }
  if (testor.falhas_turno >= 2) reasons.push(`${testor.falhas_turno} falhas no turno`);
  if (testor.reprovacoes >= 2) reasons.push(`${testor.reprovacoes} reprovações`);
  if (testor.paradas_curtas >= 3) reasons.push(`${testor.paradas_curtas} paradas curtas`);
  if (testor.ultima_manutencao) {
    const days = Math.floor((Date.now() - new Date(testor.ultima_manutencao).getTime()) / 86400000);
    if (days > 7) reasons.push(`Última manutenção há ${days} dias`);
  } else {
    reasons.push("Sem registro de manutenção");
  }
  if (testor.tempo_total_parado >= 30) reasons.push(`${testor.tempo_total_parado}min parado no turno`);
  return reasons.length > 0 ? reasons.join(". ") + "." : "Nenhum fator de risco identificado.";
}

function estimateCarsLost(testor, minutes = 60) {
  const cph = testor.carros_por_hora || 0;
  return Math.round(cph * (minutes / 60));
}

export default function PredictiveAI() {
  const { data: testores = [], isLoading } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
  });

  const analyzed = testores.map((t) => {
    const risk = calculateRisk(t);
    return { ...t, calculatedRisk: risk };
  }).sort((a, b) => b.calculatedRisk - a.calculatedRisk);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" /> IA Preditiva</h1>
        <p className="text-sm text-muted-foreground mt-1">Análise de risco dos testores baseada em dados operacionais</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">0-30: Baixo</Badge>
        <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">31-60: Médio</Badge>
        <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/30">61-80: Alto</Badge>
        <Badge className="bg-red-500/10 text-red-400 border border-red-500/30">81-100: Crítico</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Analisando...</p>
      ) : analyzed.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Cadastre testores para análise preditiva.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {analyzed.map((t, idx) => {
            const risk = t.calculatedRisk;
            const level = getRiskLevel(risk);
            const explanation = generateExplanation(t, risk);
            const carsLost1h = estimateCarsLost(t, 60);

            return (
              <Card key={t.id} className={`border ${risk > 60 ? 'border-orange-500/30' : 'border-border'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-muted-foreground text-sm font-normal">#{idx + 1}</span>
                      {t.nome}
                    </CardTitle>
                    <Badge className={`border ${level.bg}`}>
                      {risk}% — {level.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={risk} className="h-3" />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-orange-400" />
                      <p className="text-sm font-bold">{t.falhas_turno || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Falhas</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Clock className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
                      <p className="text-sm font-bold">{t.tempo_total_parado || 0}min</p>
                      <p className="text-[10px] text-muted-foreground">Parado</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Car className="w-4 h-4 mx-auto mb-1 text-red-400" />
                      <p className="text-sm font-bold">{carsLost1h}</p>
                      <p className="text-[10px] text-muted-foreground">Carros perdidos/h</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Shield className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-sm font-bold">{t.paradas_curtas || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Paradas curtas</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Brain className="w-3 h-3" /> Análise
                    </p>
                    <p className="text-sm">{explanation}</p>
                  </div>

                  {risk > 60 && (
                    <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <p className="text-xs font-medium text-orange-400 mb-1">⚠ Ação preventiva recomendada</p>
                      <p className="text-xs text-muted-foreground">
                        {risk > 80
                          ? "Solicitar manutenção preventiva IMEDIATA. Alto risco de parada não programada."
                          : "Agendar verificação preventiva nas próximas horas. Monitorar de perto."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}