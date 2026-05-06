import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  Car, Target, TrendingDown, Gauge, AlertTriangle,
  ClipboardList, Clock, ArrowRight, CheckCircle2, Activity
} from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import QuickActions from "../components/dashboard/QuickActions";
import TestorStatusList from "../components/dashboard/TestorStatusList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const gravBadge = {
  critica: "bg-red-500/10 text-red-400 border-red-500/30",
  alta: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  media: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  baixa: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

export default function Dashboard() {
  const qc = useQueryClient();

  useEffect(() => {
    const subs = [
      base44.entities.Testor.subscribe(() => qc.invalidateQueries({ queryKey: ["testores"] })),
      base44.entities.Task.subscribe(() => qc.invalidateQueries({ queryKey: ["tasks-open"] })),
      base44.entities.Occurrence.subscribe(() => qc.invalidateQueries({ queryKey: ["occurrences-open"] })),
      base44.entities.Production.subscribe(() => qc.invalidateQueries({ queryKey: ["production"] })),
      base44.entities.LossControl.subscribe(() => qc.invalidateQueries({ queryKey: ["losses-today"] })),
    ];
    return () => subs.forEach(u => u());
  }, [qc]);

  const today = new Date().toISOString().slice(0, 10);

  const { data: production = [] } = useQuery({ queryKey: ["production"], queryFn: () => base44.entities.Production.list("-created_date", 1) });
  const { data: testores = [] } = useQuery({ queryKey: ["testores"], queryFn: () => base44.entities.Testor.list() });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-open"], queryFn: () => base44.entities.Task.filter({ status: "aberta" }) });
  const { data: occurrences = [] } = useQuery({ queryKey: ["occurrences-open"], queryFn: () => base44.entities.Occurrence.filter({ status: "aberta" }) });
  const { data: lossesToday = [] } = useQuery({ queryKey: ["losses-today"], queryFn: () => base44.entities.LossControl.filter({ data: today }) });

  const prod = production[0] || {};
  const planejado = prod.producao_planejada || 0;
  const realizado = prod.producao_realizada || 0;
  const diferenca = realizado - planejado;

  const testoresRodando = testores.filter(t => t.status === "rodando").length;
  const testoresRisco   = testores.filter(t => t.risco_score > 60).length;
  const testoresParados = testores.filter(t => ["parado", "manutencao"].includes(t.status)).length;

  const totalPerdidoHoje = lossesToday.reduce((s, l) => s + (l.carros_perdidos || 0), 0);
  const eficienciaHoje   = lossesToday.reduce((s, l) => s + (l.carros_planejados || 0), 0);
  const eficiencia       = eficienciaHoje > 0 ? Math.round(((eficienciaHoje - totalPerdidoHoje) / eficienciaHoje) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel do Turno</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Central de comando ZP7 — atualização em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Ao vivo
          </span>
        </div>
      </div>

      {/* Produção row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Prod. Planejada" value={planejado} icon={Target} variant="info" />
        <StatsCard title="Prod. Realizada" value={realizado} icon={Car} variant={realizado >= planejado ? "success" : "warning"} subtitle={`${diferenca >= 0 ? "+" : ""}${diferenca} carros`} />
        <StatsCard title="Pendências" value={tasks.length} icon={ClipboardList} variant={tasks.length > 5 ? "danger" : "default"} />
        <StatsCard title="Ocorrências Abertas" value={occurrences.length} icon={AlertTriangle} variant={occurrences.length > 0 ? "danger" : "success"} />
      </div>

      {/* Testor + Perdas row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Testores Ativos" value={testoresRodando} icon={Gauge} variant="success" />
        <StatsCard title="Em Risco" value={testoresRisco} icon={Activity} variant="warning" />
        <StatsCard title="Parados" value={testoresParados} icon={Clock} variant="danger" />
        <Card className={`p-4 border ${totalPerdidoHoje > 0 ? "border-rose-500/30" : "border-border"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${totalPerdidoHoje > 0 ? "bg-rose-500/10" : "bg-muted"}`}>
              <TrendingDown className={`w-4 h-4 ${totalPerdidoHoje > 0 ? "text-rose-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${totalPerdidoHoje > 0 ? "text-rose-400" : "text-foreground"}`}>{totalPerdidoHoje}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Perdas hoje{eficiencia !== null ? ` • ${eficiencia}%` : ""}</p>
            </div>
          </div>
          <Link to="/controle-perdas" className="block mt-2">
            <Button variant="ghost" size="sm" className="w-full text-xs h-7 text-muted-foreground hover:text-foreground">
              Ver detalhes <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold mb-3 text-foreground/80">Ações Rápidas</h2>
        <QuickActions />
      </div>

      {/* Bottom grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        <TestorStatusList testores={testores} />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" /> Ocorrências Recentes
              </CardTitle>
              <Link to="/ocorrencias">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
                  Ver todas <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {occurrences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
                <p className="text-sm">Nenhuma ocorrência aberta.</p>
              </div>
            ) : (
              occurrences.slice(0, 5).map(occ => (
                <div key={occ.id} className="p-3 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate capitalize">{occ.tipo?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground truncate">{occ.testor || "—"} • {occ.local || "ZP7"}</p>
                  </div>
                  <Badge className={`text-[10px] border shrink-0 ${gravBadge[occ.gravidade] || gravBadge.media}`}>
                    {occ.gravidade}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}