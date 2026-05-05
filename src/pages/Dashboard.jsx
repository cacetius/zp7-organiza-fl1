import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Car,
  Target,
  TrendingDown,
  Gauge,
  AlertTriangle,
  ClipboardList,
  Clock
} from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import QuickActions from "../components/dashboard/QuickActions";
import TestorStatusList from "../components/dashboard/TestorStatusList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: production = [] } = useQuery({
    queryKey: ["production"],
    queryFn: () => base44.entities.Production.list("-created_date", 1),
  });

  const { data: testores = [] } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-open"],
    queryFn: () => base44.entities.Task.filter({ status: "aberta" }),
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ["occurrences-open"],
    queryFn: () => base44.entities.Occurrence.filter({ status: "aberta" }),
  });

  const prod = production[0] || {};
  const planejado = prod.producao_planejada || 0;
  const realizado = prod.producao_realizada || 0;
  const diferenca = realizado - planejado;

  const testoresRodando = testores.filter((t) => t.status === "rodando").length;
  const testoresRisco = testores.filter((t) => t.risco_score > 60).length;
  const testoresParados = testores.filter((t) => t.status === "parado" || t.status === "manutencao").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Painel do Turno</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Central de comando ZP7 — visão em tempo real
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Produção Planejada"
          value={planejado}
          icon={Target}
          variant="info"
        />
        <StatsCard
          title="Produção Realizada"
          value={realizado}
          icon={Car}
          variant={realizado >= planejado ? "success" : "warning"}
          subtitle={`${diferenca >= 0 ? "+" : ""}${diferenca} carros`}
        />
        <StatsCard
          title="Pendências Abertas"
          value={tasks.length}
          icon={ClipboardList}
          variant={tasks.length > 5 ? "danger" : "default"}
        />
        <StatsCard
          title="Ocorrências Críticas"
          value={occurrences.length}
          icon={AlertTriangle}
          variant={occurrences.length > 0 ? "danger" : "success"}
        />
      </div>

      {/* Testores quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatsCard title="Testores Ativos" value={testoresRodando} icon={Gauge} variant="success" />
        <StatsCard title="Testores em Risco" value={testoresRisco} icon={AlertTriangle} variant="warning" />
        <StatsCard title="Testores Parados" value={testoresParados} icon={Clock} variant="danger" />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Ações Rápidas</h2>
        <QuickActions />
      </div>

      {/* Bottom grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        <TestorStatusList testores={testores} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Ocorrências Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {occurrences.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ocorrência aberta.</p>
            ) : (
              occurrences.slice(0, 5).map((occ) => (
                <div key={occ.id} className="p-3 rounded-lg bg-muted/50 border border-border flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{occ.tipo?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{occ.testor || "—"} • {occ.local || "ZP7"}</p>
                  </div>
                  <Badge
                    className={`text-[10px] border ${
                      occ.gravidade === "critica"
                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                        : occ.gravidade === "alta"
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                        : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                    }`}
                  >
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