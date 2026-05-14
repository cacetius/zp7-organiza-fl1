import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Car, Clock, Activity, Pencil, Trash2, AlertTriangle,
  CheckCircle2, Wrench, ZapOff, ShieldAlert, Brain,
  TrendingUp, TrendingDown, Zap, Timer, BarChart3
} from "lucide-react";

const statusConfig = {
  rodando:    { label: "Rodando",    color: "bg-green-500/15 text-green-400 border-green-500/40",   dot: "bg-green-400",  border: "border-l-green-500",  icon: CheckCircle2 },
  atencao:    { label: "Atenção",    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40", dot: "bg-yellow-400", border: "border-l-yellow-500", icon: AlertTriangle },
  parado:     { label: "Parado",     color: "bg-red-500/15 text-red-400 border-red-500/40",          dot: "bg-red-400",    border: "border-l-red-500",    icon: ZapOff },
  manutencao: { label: "Manutenção", color: "bg-orange-500/15 text-orange-400 border-orange-500/40", dot: "bg-orange-400", border: "border-l-orange-500", icon: Wrench },
  bloqueado:  { label: "Bloqueado",  color: "bg-gray-500/15 text-gray-400 border-gray-500/40",       dot: "bg-gray-400",   border: "border-l-gray-500",   icon: ShieldAlert },
};

function getRiskColor(s) {
  if (s <= 30) return { text: "text-green-400", bar: "bg-green-500" };
  if (s <= 60) return { text: "text-yellow-400", bar: "bg-yellow-500" };
  if (s <= 80) return { text: "text-orange-400", bar: "bg-orange-500" };
  return { text: "text-red-400", bar: "bg-red-500" };
}

// Calcula carros/hora com base no tempo médio
function calcCarrosPorHora(tempoMedio) {
  if (!tempoMedio || tempoMedio <= 0) return 0;
  return Math.round(60 / tempoMedio);
}

// Calcula produção prevista: (horas restantes * carros por hora)
function calcPrevisao(t, horasRestantes = null) {
  const cph = calcCarrosPorHora(t.tempo_medio_carro);
  if (!cph) return t.carros_por_hora || 0;
  if (horasRestantes !== null) return Math.round(cph * horasRestantes);
  return cph;
}

export default function TestorCard({ t, onEdit, onDelete, onStatusChange, onHourlyClose, onHistory }) {
  const cfg = statusConfig[t.status] || statusConfig.rodando;
  const StatusIcon = cfg.icon;
  const risk = t.risco_score || 0;
  const riskStyle = getRiskColor(risk);

  const carrosPorHora = t.tempo_medio_carro > 0
    ? calcCarrosPorHora(t.tempo_medio_carro)
    : (t.carros_por_hora || 0);

  const producaoReal = t.carros_testados_turno || 0;
  const falhas = t.falhas_turno || 0;
  const producaoLiquida = Math.max(0, producaoReal - falhas);
  const tempoPerdido = t.tempo_total_parado || 0;

  // Eficiência: produção líquida / produção prevista (estimada como carros_por_hora * horas do turno ~8h)
  const previsaoTurno = carrosPorHora > 0 ? carrosPorHora * 8 : (t.carros_por_hora || 0) * 8;
  const eficiencia = previsaoTurno > 0 ? Math.min(100, Math.round((producaoLiquida / previsaoTurno) * 100)) : 0;

  // IA: alertas
  const aiAlerts = [];
  if (risk > 70) aiAlerts.push({ type: "danger", msg: "Alto risco de quebra — verificar manutenção" });
  if (falhas / Math.max(producaoReal, 1) > 0.15) aiAlerts.push({ type: "warning", msg: "Taxa de falhas elevada (>15%)" });
  if (tempoPerdido > 30) aiAlerts.push({ type: "warning", msg: `Tempo perdido: ${tempoPerdido}min — queda de produtividade` });
  if (t.proxima_manutencao) {
    const dias = Math.ceil((new Date(t.proxima_manutencao) - new Date()) / 86400000);
    if (dias >= 0 && dias <= 3) aiAlerts.push({ type: "info", msg: `Manutenção prevista em ${dias}d` });
  }

  return (
    <Card className={`overflow-hidden border-l-4 transition-all hover:shadow-lg ${cfg.border}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
              <StatusIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{t.nome}</p>
              <Badge variant="outline" className={`text-[10px] border mt-0.5 ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${cfg.dot}`} />
                {cfg.label}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onHistory?.(t)} title="Histórico semanal"
              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-400 transition-colors">
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onHourlyClose(t)} title="Fechar hora"
              className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
              <Timer className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onEdit(t)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(t)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status change */}
        <Select value={t.status} onValueChange={v => onStatusChange(t.id, v)}>
          <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* IA Previsão */}
        {carrosPorHora > 0 && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
            <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs text-primary font-medium">
              IA: Previsão {carrosPorHora} carros/hora
              {t.tempo_medio_carro > 0 && <span className="text-primary/70"> (60÷{t.tempo_medio_carro}min)</span>}
            </span>
          </div>
        )}

        {/* Métricas principais: 2x3 grid */}
        <div className="grid grid-cols-3 gap-1.5">
          <MetricBox icon={TrendingUp} label="Previsto/h" value={carrosPorHora} color="text-primary" />
          <MetricBox icon={Car} label="Real/turno" value={producaoReal} color="text-blue-400" />
          <MetricBox icon={CheckCircle2} label="Líquido" value={producaoLiquida} color="text-green-400" />
          <MetricBox icon={AlertTriangle} label="Falhas" value={falhas} color={falhas > 0 ? "text-orange-400" : "text-muted-foreground"} />
          <MetricBox icon={Clock} label="T.Perdido" value={`${tempoPerdido}m`} color={tempoPerdido > 0 ? "text-yellow-400" : "text-muted-foreground"} />
          <MetricBox icon={Zap} label="C/hora" value={t.carros_por_hora || carrosPorHora} color="text-purple-400" />
        </div>

        {/* Eficiência */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Eficiência do turno</span>
            <span className={`font-bold ${eficiencia >= 80 ? "text-green-400" : eficiencia >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {eficiencia}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${eficiencia >= 80 ? "bg-green-500" : eficiencia >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${eficiencia}%` }}
            />
          </div>
        </div>

        {/* Risco */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Risco</span>
            <span className={`font-bold ${riskStyle.text}`}>{risk}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${riskStyle.bar}`} style={{ width: `${risk}%` }} />
          </div>
        </div>

        {/* IA Alertas */}
        {aiAlerts.length > 0 && (
          <div className="space-y-1">
            {aiAlerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-1.5 text-[10px] px-2 py-1.5 rounded-md ${
                a.type === "danger" ? "bg-red-500/10 text-red-400" :
                a.type === "warning" ? "bg-orange-500/10 text-orange-400" :
                "bg-blue-500/10 text-blue-400"
              }`}>
                <Brain className="w-3 h-3 mt-0.5 shrink-0" />
                {a.msg}
              </div>
            ))}
          </div>
        )}

        {/* Manutenção */}
        {(t.ultima_manutencao || t.proxima_manutencao) && (
          <div className="text-[10px] text-muted-foreground border-t border-border pt-2 flex justify-between">
            {t.ultima_manutencao && <span>Última: {t.ultima_manutencao}</span>}
            {t.proxima_manutencao && <span className="text-yellow-400">Próxima: {t.proxima_manutencao}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBox({ icon: IconComp, label, value, color }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/40">
      <IconComp className={`w-3 h-3 mx-auto mb-1 ${color}`} />
      <p className={`text-sm font-bold leading-tight ${color}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </div>
  );
}