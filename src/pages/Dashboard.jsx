import React, { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  Car, Target, TrendingDown, Gauge, AlertTriangle,
  ClipboardList, ArrowRight, CheckCircle2, Factory,
  Wrench, ArrowRightLeft, BarChart3, CheckSquare
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ShiftOverview from "@/components/dashboard/ShiftOverview";
import ShiftProductionChart from "@/components/dashboard/ShiftProductionChart";
import { detectCurrentShift, getTodayShiftData } from "@/lib/shiftDetector";
// ProductionControl é a única fonte de verdade para produção, perdas operacionais e defeitos.

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
      base44.entities.ProductionControl.subscribe(() => qc.invalidateQueries({ queryKey: ["prod-today"] })),
      base44.entities.LossControl.subscribe(() => qc.invalidateQueries({ queryKey: ["ganhos-today"] })),
    ];
    return () => subs.forEach(u => u());
  }, []);

  const { data: testores = [] } = useQuery({ 
    queryKey: ["testores"], 
    queryFn: () => base44.entities.Testor.list(), 
    staleTime: 5 * 60_000, 
    retry: false,
    placeholderData: (prev) => prev || []
  });
  const { data: tasks = [] } = useQuery({ 
    queryKey: ["tasks-open"], 
    queryFn: () => base44.entities.Task.filter({ status: "aberta" }), 
    staleTime: 2 * 60_000, 
    retry: false,
    placeholderData: (prev) => prev || []
  });
  const { data: occurrences = [] } = useQuery({ 
    queryKey: ["occurrences-open"], 
    queryFn: () => base44.entities.Occurrence.filter({ status: "aberta" }), 
    staleTime: 2 * 60_000, 
    retry: false,
    placeholderData: (prev) => prev || []
  });
  const { data: allProd = [] } = useQuery({ 
    queryKey: ["prod-today"], 
    queryFn: () => base44.entities.ProductionControl.filter({ data: today }), 
    staleTime: 10_000, 
    retry: false,
    placeholderData: (prev) => prev || []
  });
  const { data: allGanhos = [] } = useQuery({ 
    queryKey: ["ganhos-today"], 
    queryFn: () => base44.entities.LossControl.filter({ data: today, motivo_perda: "ganho" }), 
    staleTime: 10_000, 
    retry: false,
    placeholderData: (prev) => prev || []
  });
  const { data: maintenanceData = [] } = useQuery({ 
    queryKey: ["maintenance-today"], 
    queryFn: () => base44.entities.MaintenanceRequest.filter({ status: "aberto" }), 
    staleTime: 2 * 60_000, 
    retry: false,
    placeholderData: (prev) => prev || []
  });

  const currentShift = detectCurrentShift();
  const shiftProdData = getTodayShiftData(allProd, currentShift.key);
  const shiftMaintenanceData = getTodayShiftData(maintenanceData, currentShift.key);

  // Contagem correta dos status dos testores
  const testoresRodando = testores.filter(t => t.status === "rodando").length;
  const testoresAtencao = testores.filter(t => t.status === "atencao").length;
  const testoresParados = testores.filter(t => t.status === "parado" || t.status === "manutencao" || t.status === "bloqueado").length;

  // KPIs do turno atual (memoizados)
  // IMPORTANTE: allProd contém registros POR TESTOR, então precisamos agrupar por hora primeiro
  const { totalProduzidoTurno, totalPerdasProdTurno, totalPerdasDefTurno, producaoLiquidaTurno, totalGanhosTurno } = useMemo(() => {
    const prodTurno = allProd.filter(p => p.turno === currentShift.key);

    // Agrupar por hora para calcular totais corretamente (evita duplicação)
    const porHora = {};
    prodTurno.forEach(p => {
      if (!porHora[p.hora]) {
        porHora[p.hora] = { producao: 0, objetivo: 0, perdas_defeito: 0 };
      }
      porHora[p.hora].producao += (p.carros_produzidos || 0);
      porHora[p.hora].objetivo += (p.objetivo || 0);
      // IMPORTANTE: perdas_defeito JÁ É O TOTAL DA HORA (não acumula por testor)
      // Pega apenas o primeiro valor encontrado para esta hora
      if (porHora[p.hora].perdas_defeito === 0) {
        porHora[p.hora].perdas_defeito = (p.perdas_defeito || 0);
      }
    });

    // Calcular totais a partir do agrupamento por hora
    const totalProd = Object.values(porHora).reduce((s, h) => s + h.producao, 0);
    const totalObj = Object.values(porHora).reduce((s, h) => s + h.objetivo, 0);
    // Perdas de produção = objetivo - produção (calculado por hora, depois somado)
    const perdasProd = Object.values(porHora).reduce((s, h) => s + Math.max(0, h.objetivo - h.producao), 0);
    // Perdas por defeito = usa o valor já registrado (não acumula)
    const perdasDef = Object.values(porHora).reduce((s, h) => s + h.perdas_defeito, 0);
    // Produção Líquida = Produção - Perdas Produção - Perdas Defeito
    const liquida = Math.max(0, totalProd - perdasProd - perdasDef);

    // Carros Ganhos = soma dos ganhos do LossControl por hora (não acumula por testor)
    const ganhosTurno = allGanhos.filter(g => g.turno === currentShift.key);
    const ganhosPorHora = {};
    ganhosTurno.forEach(g => {
      if (!ganhosPorHora[g.hora]) ganhosPorHora[g.hora] = 0;
      if (ganhosPorHora[g.hora] === 0) {
        ganhosPorHora[g.hora] = (g.carros_perdidos || 0);
      }
    });
    const totalGanhos = Object.values(ganhosPorHora).reduce((s, h) => s + h, 0);

    return { 
      totalProduzidoTurno: totalProd, 
      totalPerdasProdTurno: perdasProd,
      totalPerdasDefTurno: perdasDef,
      producaoLiquidaTurno: liquida,
      totalGanhosTurno: totalGanhos
    };
  }, [allProd, allGanhos, currentShift.key]);

  const shiftLabel = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" }[currentShift.key] || "Turno";
  // Objetivo também precisa agrupar por hora para evitar duplicação
  const totalObjetivoTurno = useMemo(() => {
    const prodTurno = allProd.filter(p => p.turno === currentShift.key);
    const porHora = {};
    prodTurno.forEach(p => {
      if (!porHora[p.hora]) porHora[p.hora] = 0;
      porHora[p.hora] += (p.objetivo || 0);
    });
    return Object.values(porHora).reduce((s, h) => s + h, 0);
  }, [allProd, currentShift.key]);
  // Eficiência = Produção / Objetivo (mostra eficiência bruta)
  const eficienciaTurno = totalObjetivoTurno > 0 ? Math.min(100, Math.round((totalProduzidoTurno / totalObjetivoTurno) * 100)) : null;

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
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

      {/* Visão do turno atual */}
      <ShiftOverview prodData={shiftProdData} maintenanceData={shiftMaintenanceData} isHistorical={false} />

      {/* Status detalhado dos testores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Rodando", value: testoresRodando, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
          { label: "Atenção", value: testoresAtencao, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
          { label: "Parados", value: testores.filter(t => t.status === "parado").length, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
          { label: "Manutenção", value: testores.filter(t => t.status === "manutencao").length, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
        ].map(s => (
          <Card key={s.label} className={`border ${s.border}`}>
            <CardContent className="p-2.5 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

       {/* KPIs principais */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Produção Líquida ${shiftLabel}`, value: producaoLiquidaTurno, icon: Target, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
          { label: `Perda Bruta ${shiftLabel}`, value: totalPerdasDefTurno, icon: TrendingDown, color: totalPerdasDefTurno > 0 ? "text-red-400" : "text-muted-foreground", bg: totalPerdasDefTurno > 0 ? "bg-red-500/10" : "bg-muted/30", border: totalPerdasDefTurno > 0 ? "border-red-500/20" : "border-border" },
          { label: `Carros Ganhos ${shiftLabel}`, value: totalGanhosTurno, icon: CheckCircle2, color: totalGanhosTurno > 0 ? "text-emerald-400" : "text-muted-foreground", bg: totalGanhosTurno > 0 ? "bg-emerald-500/10" : "bg-muted/30", border: totalGanhosTurno > 0 ? "border-emerald-500/20" : "border-border" },
          { label: "Testores Ativos", value: `${testoresRodando}/${testores.length}`, icon: Gauge, color: testoresParados > 0 ? "text-orange-400" : "text-green-400", bg: testoresParados > 0 ? "bg-orange-500/10" : "bg-green-500/10", border: testoresParados > 0 ? "border-orange-500/20" : "border-green-500/20" },
        ].map(kpi => (
          <Card key={kpi.label} className={`border ${kpi.border}`}>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2.5">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${kpi.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xl sm:text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Barra de eficiência do turno */}
      {eficienciaTurno !== null && (
        <div className="px-4 py-3 rounded-xl bg-muted/30 border border-border space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-muted-foreground">Eficiência — {shiftLabel}</span>
            <span className={`font-black text-sm ${eficienciaTurno >= 90 ? "text-green-400" : eficienciaTurno >= 70 ? "text-yellow-400" : "text-red-400"}`}>{eficienciaTurno}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${eficienciaTurno}%`,
                background: eficienciaTurno >= 90 ? "hsl(142,71%,45%)" : eficienciaTurno >= 70 ? "hsl(38,92%,50%)" : "hsl(0,72%,51%)"
              }}
            />
          </div>
        </div>
      )}

      {/* Indicador tempo real */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
        Dados em tempo real — atualizações automáticas para todos os usuários
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

      {/* Gráfico produção & perdas por turno */}
      <ShiftProductionChart prodData={allProd} date={today} />

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

              // Última justificativa registrada hoje para este testor
              const ultimaJust = allProd
                .filter(p => (p.testor_id === t.id || p.testor_nome === t.nome) && p.justificativa)
                .sort((a, b) => (b.hora || "").localeCompare(a.hora || ""))
                [0]?.justificativa;

              return (
                <div key={t.id} className="p-2.5 rounded-lg bg-muted/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{t.nome}</span>
                    <Badge className={`text-[10px] border ${statusColors[t.status] || statusColors.parado}`}>
                      {statusLabel[t.status] || t.status}
                    </Badge>
                  </div>
                  {ultimaJust && (
                    <p className="text-[11px] text-muted-foreground leading-tight truncate" title={ultimaJust}>
                      📝 {ultimaJust}
                    </p>
                  )}
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