import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  Car, Target, TrendingDown, Gauge, AlertTriangle,
  ClipboardList, Clock, ArrowRight, CheckCircle2, Factory,
  Wrench, ArrowRightLeft, BarChart3, CheckSquare
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const gravBadge = {
  critica: "bg-red-500/15 text-red-400 border-red-500/40",
  alta: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  media: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  baixa: "bg-blue-500/15 text-blue-400 border-blue-500/40",
};

const quickActions = [
  { label: "Ocorrência", icon: AlertTriangle, path: "/ocorrencias", bg: "bg-red-500/10 hover:bg-red-500/20 border-red-500/20", text: "text-red-400" },
  { label: "Controle Perdas", icon: TrendingDown, path: "/controle-perdas", bg: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20", text: "text-rose-400" },
  { label: "Produção", icon: Factory, path: "/controle-producao", bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20", text: "text-blue-400" },
  { label: "Manutenção", icon: Wrench, path: "/manutencao", bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20", text: "text-orange-400" },
  { label: "Testores", icon: Gauge, path: "/testores", bg: "bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20", text: "text-cyan-400" },
  { label: "Passagem Turno", icon: ArrowRightLeft, path: "/passagem-turno", bg: "bg-primary/10 hover:bg-primary/20 border-primary/20", text: "text-primary" },
  { label: "Checklist", icon: CheckSquare, path: "/checklist", bg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20", text: "text-emerald-400" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20", text: "text-purple-400" },
];

export default function Dashboard() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  useEffect(() => {
    const subs = [
      base44.entities.Testor.subscribe(() => qc.invalidateQueries({ queryKey: ["testores"] })),
      base44.entities.Task.subscribe(() => qc.invalidateQueries({ queryKey: ["tasks-open"] })),
      base44.entities.Occurrence.subscribe(() => qc.invalidateQueries({ queryKey: ["occurrences-open"] })),
      base44.entities.LossControl.subscribe(() => qc.invalidateQueries({ queryKey: ["losses-today"] })),
      base44.entities.ProductionControl.subscribe(() => qc.invalidateQueries({ queryKey: ["prod-today"] })),
    ];
    return () => subs.forEach(u => u());
  }, [qc]);

  const { data: testores = [] } = useQuery({ queryKey: ["testores"], queryFn: () => base44.entities.Testor.list() });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-open"], queryFn: () => base44.entities.Task.filter({ status: "aberta" }) });
  const { data: occurrences = [] } = useQuery({ queryKey: ["occurrences-open"], queryFn: () => base44.entities.Occurrence.filter({ status: "aberta" }) });
  const { data: lossesToday = [] } = useQuery({ queryKey: ["losses-today"], queryFn: () => base44.entities.LossControl.filter({ data: today }) });
  const { data: prodToday = [] } = useQuery({ queryKey: ["prod-today"], queryFn: () => base44.entities.ProductionControl.filter({ data: today }) });

  const testoresRodando = testores.filter(t => t.status === "rodando").length;
  const testoresParados = testores.filter(t => ["parado", "manutencao"].includes(t.status)).length;
  const perdasBrutasHoje = lossesToday.filter(l => l.motivo_perda !== "ganho").reduce((s, l) => s + (l.carros_perdidos || 0), 0);
  const ganhosHoje = lossesToday.filter(l => l.motivo_perda === "ganho").reduce((s, l) => s + (l.carros_perdidos || 0), 0);
  const totalPerdidoHoje = Math.max(0, perdasBrutasHoje - ganhosHoje);
  const totalProduzidoHoje = prodToday.reduce((s, p) => s + (p.carros_produzidos || 0), 0);
  const producaoLiquida = Math.max(0, totalProduzidoHoje - totalPerdidoHoje);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Painel ZP7</h1>
          <p className="text-muted-foreground text-sm capitalize mt-0.5">{now}</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full font-medium">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Ao vivo
        </span>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Produzido Hoje", value: totalProduzidoHoje, icon: Car, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
          { label: "Produção Líquida", value: producaoLiquida, icon: Target, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
          { label: "Perdas Hoje", value: totalPerdidoHoje, icon: TrendingDown, color: totalPerdidoHoje > 0 ? "text-red-400" : "text-muted-foreground", bg: totalPerdidoHoje > 0 ? "bg-red-500/10" : "bg-muted/30", border: totalPerdidoHoje > 0 ? "border-red-500/20" : "border-border" },
          { label: "Testores Ativos", value: `${testoresRodando}/${testores.length}`, icon: Gauge, color: testoresParados > 0 ? "text-yellow-400" : "text-green-400", bg: testoresParados > 0 ? "bg-yellow-500/10" : "bg-green-500/10", border: testoresParados > 0 ? "border-yellow-500/20" : "border-green-500/20" },
        ].map(kpi => (
          <Card key={kpi.label} className={`border ${kpi.border}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pendências rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <Card className={tasks.length > 0 ? "border-yellow-500/20" : "border-border"}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tasks.length > 0 ? "bg-yellow-500/10" : "bg-muted/30"}`}>
                <ClipboardList className={`w-5 h-5 ${tasks.length > 0 ? "text-yellow-400" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className={`text-2xl font-black ${tasks.length > 0 ? "text-yellow-400" : "text-foreground"}`}>{tasks.length}</p>
                <p className="text-[11px] text-muted-foreground">Tarefas abertas</p>
              </div>
            </div>
            <Link to="/tarefas"><ArrowRight className="w-4 h-4 text-muted-foreground" /></Link>
          </CardContent>
        </Card>
        <Card className={occurrences.length > 0 ? "border-orange-500/20" : "border-border"}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${occurrences.length > 0 ? "bg-orange-500/10" : "bg-muted/30"}`}>
                <AlertTriangle className={`w-5 h-5 ${occurrences.length > 0 ? "text-orange-400" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className={`text-2xl font-black ${occurrences.length > 0 ? "text-orange-400" : "text-foreground"}`}>{occurrences.length}</p>
                <p className="text-[11px] text-muted-foreground">Ocorrências abertas</p>
              </div>
            </div>
            <Link to="/ocorrencias"><ArrowRight className="w-4 h-4 text-muted-foreground" /></Link>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Acesso Rápido</h2>
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {quickActions.map(action => (
            <Link
              key={action.label}
              to={action.path}
              className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${action.bg}`}
            >
              <action.icon className={`w-6 h-6 ${action.text}`} />
              <span className={`text-[10px] font-semibold text-center leading-tight ${action.text}`}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Status Testores + Ocorrências */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-cyan-400" /> Status dos Testores</h3>
            <Link to="/testores"><Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground">Ver todos <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
          </div>
          <CardContent className="px-4 pb-4 space-y-2">
            {testores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum testor cadastrado.</p>
            ) : testores.slice(0, 6).map(t => {
              const statusColors = {
                rodando: "bg-green-500/10 text-green-400 border-green-500/30",
                atencao: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
                parado: "bg-red-500/10 text-red-400 border-red-500/30",
                manutencao: "bg-orange-500/10 text-orange-400 border-orange-500/30",
                bloqueado: "bg-gray-500/10 text-gray-400 border-gray-500/30",
              };
              const statusLabel = { rodando: "Rodando", atencao: "Atenção", parado: "Parado", manutencao: "Manutenção", bloqueado: "Bloqueado" };
              return (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                  <span className="font-medium text-sm">{t.nome}</span>
                  <Badge className={`text-[10px] border ${statusColors[t.status] || statusColors.parado}`}>
                    {statusLabel[t.status] || t.status}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-400" /> Ocorrências Recentes</h3>
            <Link to="/ocorrencias"><Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground">Ver todas <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
          </div>
          <CardContent className="px-4 pb-4 space-y-2">
            {occurrences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
                <p className="text-sm">Nenhuma ocorrência aberta.</p>
              </div>
            ) : occurrences.slice(0, 5).map(occ => (
              <div key={occ.id} className="p-2.5 rounded-lg bg-muted/30 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate capitalize">{occ.tipo?.replace(/_/g, " ") || "Ocorrência"}</p>
                  <p className="text-xs text-muted-foreground truncate">{occ.testor || "—"}</p>
                </div>
                <Badge className={`text-[10px] border shrink-0 ${gravBadge[occ.gravidade] || gravBadge.media}`}>
                  {occ.gravidade}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}