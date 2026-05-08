import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Car, Brain, TrendingUp, TrendingDown, AlertTriangle,
  Clock, Zap, CheckCircle2, Activity, FileDown
} from "lucide-react";

function calcCarrosPorHora(t) {
  if (t.tempo_medio_carro > 0) return Math.round(60 / t.tempo_medio_carro);
  return t.carros_por_hora || 0;
}

export default function TestorProductionPanel({ testores, onExportPDF, onExportExcel }) {
  const ativos = testores.filter(t => t.status !== "bloqueado");

  const totalPrevisto = ativos.reduce((s, t) => s + calcCarrosPorHora(t), 0);
  const totalReal = ativos.reduce((s, t) => s + (t.carros_testados_turno || 0), 0);
  const totalFalhas = ativos.reduce((s, t) => s + (t.falhas_turno || 0), 0);
  const totalLiquido = Math.max(0, totalReal - totalFalhas);
  const totalTempoPerdido = ativos.reduce((s, t) => s + (t.tempo_total_parado || 0), 0);
  const eficienciaGeral = totalReal > 0 ? Math.min(100, Math.round((totalLiquido / totalReal) * 100)) : 0;
  const emRisco = testores.filter(t => (t.risco_score || 0) > 60).length;

  const kpis = [
    { label: "Previsto/hora (IA)", value: totalPrevisto, icon: Brain, color: "text-primary", bg: "bg-primary/10" },
    { label: "Produção Real", value: totalReal, icon: Car, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Produção Líquida", value: totalLiquido, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Total de Falhas", value: totalFalhas, icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Eficiência Geral", value: `${eficienciaGeral}%`, icon: TrendingUp, color: eficienciaGeral >= 80 ? "text-green-400" : "text-red-400", bg: eficienciaGeral >= 80 ? "bg-green-500/10" : "bg-red-500/10" },
    { label: "Tempo Perdido", value: `${totalTempoPerdido}min`, icon: Clock, color: totalTempoPerdido > 30 ? "text-yellow-400" : "text-muted-foreground", bg: "bg-muted/50" },
    { label: "Em Risco", value: emRisco, icon: Activity, color: emRisco > 0 ? "text-red-400" : "text-green-400", bg: emRisco > 0 ? "bg-red-500/10" : "bg-green-500/10" },
    { label: "Carros/hora Total", value: totalPrevisto, icon: Zap, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Painel de Produção Inteligente
            <Badge className="bg-green-500/15 text-green-400 border-green-500/40 text-[10px]">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1 animate-pulse inline-block" />
              Ao vivo
            </Badge>
          </CardTitle>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={onExportPDF} className="text-xs h-7 gap-1">
              <FileDown className="w-3 h-3" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={onExportExcel} className="text-xs h-7 gap-1">
              <FileDown className="w-3 h-3" /> Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(kpi => (
            <div key={kpi.label} className={`rounded-xl p-3 ${kpi.bg} flex items-center gap-2.5`}>
              <div className={`w-8 h-8 rounded-lg bg-background/40 flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xl font-black leading-tight ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabela resumo */}
        {testores.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  {["Testor", "Status", "Previsto/h", "Real", "Falhas", "Líquido", "Efic.", "Tempo Perdido"].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 font-semibold text-muted-foreground border border-border/60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testores.map(t => {
                  const cph = calcCarrosPorHora(t);
                  const real = t.carros_testados_turno || 0;
                  const falhas = t.falhas_turno || 0;
                  const liquido = Math.max(0, real - falhas);
                  const ef = real > 0 ? Math.min(100, Math.round((liquido / real) * 100)) : 0;
                  return (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-2 py-1.5 font-medium border border-border/40">{t.nome}</td>
                      <td className="px-2 py-1.5 border border-border/40">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          t.status === "rodando" ? "bg-green-500/15 text-green-400" :
                          t.status === "atencao" ? "bg-yellow-500/15 text-yellow-400" :
                          t.status === "parado" ? "bg-red-500/15 text-red-400" :
                          t.status === "manutencao" ? "bg-orange-500/15 text-orange-400" :
                          "bg-gray-500/15 text-gray-400"
                        }`}>{t.status}</span>
                      </td>
                      <td className="px-2 py-1.5 text-primary font-bold border border-border/40">{cph}</td>
                      <td className="px-2 py-1.5 text-blue-400 font-semibold border border-border/40">{real}</td>
                      <td className="px-2 py-1.5 border border-border/40">
                        <span className={falhas > 0 ? "text-orange-400 font-semibold" : "text-muted-foreground"}>{falhas}</span>
                      </td>
                      <td className="px-2 py-1.5 text-green-400 font-bold border border-border/40">{liquido}</td>
                      <td className="px-2 py-1.5 border border-border/40">
                        <span className={ef >= 80 ? "text-green-400 font-bold" : ef >= 50 ? "text-yellow-400 font-bold" : "text-red-400 font-bold"}>{ef}%</span>
                      </td>
                      <td className="px-2 py-1.5 border border-border/40">
                        <span className={(t.tempo_total_parado || 0) > 0 ? "text-yellow-400 font-semibold" : "text-muted-foreground"}>
                          {t.tempo_total_parado || 0}min
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}