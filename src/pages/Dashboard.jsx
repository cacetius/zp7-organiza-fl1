import React, { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  Car, Target, TrendingDown, Gauge, AlertTriangle,
  ClipboardList, Clock, ArrowRight, CheckCircle2, Factory,
  Wrench, ArrowRightLeft, BarChart3, CheckSquare, Activity,
  Shield, Zap, TrendingUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ShiftOverview from "@/components/dashboard/ShiftOverview";
import ShiftGoalChart from "@/components/dashboard/ShiftGoalChart";
import { detectCurrentShift, getTodayShiftData } from "@/lib/shiftDetector";

const gravBadge = {
  critica: "bg-red-500/15 text-red-400 border-red-500/40",
  alta: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  media: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  baixa: "bg-blue-500/15 text-blue-400 border-blue-500/40",
};

const quickActions = [
  { label: "Ocorrência", icon: AlertTriangle, path: "/ocorrencias", bg: "bg-red-500/10 hover:bg-red-500/20 border-red-500/20", text: "text-red-400", iconBg: "bg-red-500/20" },
  { label: "Perdas", icon: TrendingDown, path: "/controle-perdas", bg: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20", text: "text-rose-400", iconBg: "bg-rose-500/20" },
  { label: "Produção", icon: Factory, path: "/controle-producao", bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20", text: "text-blue-400", iconBg: "bg-blue-500/20" },
  { label: "Manutenção", icon: Wrench, path: "/manutencao", bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20", text: "text-orange-400", iconBg: "bg-orange-500/20" },
  { label: "Testores", icon: Gauge, path: "/testores", bg: "bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20", text: "text-cyan-400", iconBg: "bg-cyan-500/20" },
  { label: "Passagem", icon: ArrowRightLeft, path: "/passagem-turno", bg: "bg-primary/10 hover:bg-primary/20 border-primary/20", text: "text-primary", iconBg: "bg-primary/20" },
  { label: "Checklist", icon: CheckSquare, path: "/checklist", bg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20", text: "text-emerald-400", iconBg: "bg-emerald-500/20" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20", text: "text-purple-400", iconBg: "bg-purple-500/20" },
];

const DEFAULT_LOSS_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

export default function Dashboard() {
  const qc = useQueryClient();
  const today = format(new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })), "yyyy-MM-dd");
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
  }, []);

  const { data: testores = [] } = useQuery({ queryKey: ["testores"], queryFn: () => base44.entities.Testor.list(), staleTime: 5 * 60_000, gcTime: 10 * 60_000 });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-open"], queryFn: () => base44.entities.Task.filter({ status: "aberta" }), staleTime: 2 * 60_000, gcTime: 5 * 60_000 });
  const { data: occurrences = [] } = useQuery({ queryKey: ["occurrences-open"], queryFn: () => base44.entities.Occurrence.filter({ status: "aberta" }), staleTime: 2 * 60_000, gcTime: 5 * 60_000 });
  const { data: allLosses = [] } = useQuery({ queryKey: ["losses-today"], queryFn: () => base44.entities.LossControl.filter({ data: today }), staleTime: 60_000, gcTime: 5 * 60_000 });
  const { data: allProd = [] } = useQuery({ queryKey: ["prod-today"], queryFn: () => base44.entities.ProductionControl.filter({ data: today }), staleTime: 60_000, gcTime: 5 * 60_000 });
  const { data: maintenanceData = [] } = useQuery({ queryKey: ["maintenance-today"], queryFn: () => base44.entities.MaintenanceRequest.filter({ status: "aberto" }), staleTime: 60_000, gcTime: 5 * 60_000 });

  const activeDate = today;
  const currentShift = detectCurrentShift();

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const shiftDates = currentShift.key === "terceiro" ? [today, yesterdayStr] : [today];

  const prodTurno = allProd.filter(p => p.turno === currentShift.key && shiftDates.includes(p.data));
  const lossesTurno = allLosses.filter(l => l.turno === currentShift.key && shiftDates.includes(l.data));
  const maintenanceTurno = maintenanceData.filter(m => m.turno === currentShift.key || !m.turno);

  const testoresRodando = testores.filter(t => t.status === "rodando").length;
  const testoresParados = testores.filter(t => ["parado", "manutencao"].includes(t.status)).length;

  const totalProduzidoTurno = prodTurno.reduce((s, p) => s + (p.carros_produzidos || 0), 0);

  const perdasBrutasTurno = lossesTurno.filter(l =>
    l.motivo_perda !== "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(l.item_perda)
  ).reduce((s, l) => s + (l.carros_perdidos || 0), 0);

  const ganhosTurno = lossesTurno.filter(l =>
    l.motivo_perda === "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0
  ).reduce((s, l) => s + (l.carros_perdidos || 0), 0);

  const perdaRealTurno = Math.max(0, perdasBrutasTurno - ganhosTurno);
  const producaoLiquidaTurno = useMemo(() =>
    Math.max(0, totalProduzidoTurno - perdaRealTurno),
    [totalProduzidoTurno, perdaRealTurno]
  );

  const shiftLabel = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" }[currentShift.key] || "Turno";
  const shiftHours = { primeiro: "06h–15h", segundo: "15h–23h", terceiro: "21h–06h" }[currentShift.key] || "";

  const eficiencia = totalProduzidoTurno > 0
    ? Math.round((producaoLiquidaTurno / totalProduzidoTurno) * 100)
    : 0;

  const statusColor = testoresParados > 0 ? "text-yellow-400" : "text-green-400";
  const statusBg = testoresParados > 0 ? "from-yellow-500/10 to-yellow-500/5" : "from-green-500/10 to-green-500/5";

  return (
    <div className="space-y-5 pb-24 lg:pb-6">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 p-5 sm:p-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Volkswagen Taubaté</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Painel ZP7</h1>
            <p className="text-sm text-muted-foreground capitalize mt-1">{now}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full font-semibold">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Ao vivo
            </span>
            <span className="text-xs text-primary font-semibold bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
              {shiftLabel} · {shiftHours}
            </span>
          </div>
        </div>

        {/* Mini progresso de eficiência inline */}
        {totalProduzidoTurno > 0 && (
          <div className="relative mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> Eficiência do turno
              </span>
              <span className={`text-xs font-black ${eficiencia >= 80 ? "text-green-400" : eficiencia >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                {eficiencia}%
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${eficiencia >= 80 ? "bg-green-400" : eficiencia >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
                style={{ width: `${Math.min(eficiencia, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── KPIs principais (4 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Produção Bruta",
            value: totalProduzidoTurno,
            sub: shiftLabel,
            icon: Car,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            glow: "shadow-blue-500/10",
          },
          {
            label: "Prod. Líquida",
            value: producaoLiquidaTurno,
            sub: shiftLabel,
            icon: Target,
            color: "text-green-400",
            bg: "bg-green-500/10",
            border: "border-green-500/20",
            glow: "shadow-green-500/10",
          },
          {
            label: "Perda Real",
            value: perdaRealTurno,
            sub: shiftLabel,
            icon: TrendingDown,
            color: perdaRealTurno > 0 ? "text-red-400" : "text-muted-foreground",
            bg: perdaRealTurno > 0 ? "bg-red-500/10" : "bg-muted/30",
            border: perdaRealTurno > 0 ? "border-red-500/20" : "border-border",
            glow: perdaRealTurno > 0 ? "shadow-red-500/10" : "",
          },
          {
            label: "Testores",
            value: `${testoresRodando}/${testores.length}`,
            sub: testoresParados > 0 ? `${testoresParados} parado(s)` : "Todos ativos",
            icon: Gauge,
            color: testoresParados > 0 ? "text-yellow-400" : "text-green-400",
            bg: testoresParados > 0 ? "bg-yellow-500/10" : "bg-green-500/10",
            border: testoresParados > 0 ? "border-yellow-500/20" : "border-green-500/20",
            glow: testoresParados > 0 ? "shadow-yellow-500/10" : "shadow-green-500/10",
          },
        ].map(kpi => (
          <Card key={kpi.label} className={`border ${kpi.border} shadow-lg ${kpi.glow}`}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <p className={`text-2xl sm:text-3xl font-black ${kpi.color} leading-none`}>{kpi.value}</p>
              <p className="text-[11px] text-foreground font-semibold mt-1.5 leading-tight">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Visão do turno atual ── */}
      <ShiftOverview prodData={prodTurno} maintenanceData={maintenanceTurno} lossData={lossesTurno} isHistorical={false} />

      {/* ── Pendências + Status ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/tarefas" className="block">
          <Card className={`border transition-all hover:scale-[1.02] ${tasks.length > 0 ? "border-yellow-500/30 shadow-yellow-500/10 shadow-md" : "border-border"}`}>
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${tasks.length > 0 ? "bg-yellow-500/15" : "bg-muted/30"}`}>
                <ClipboardList className={`w-5 h-5 ${tasks.length > 0 ? "text-yellow-400" : "text-muted-foreground"}`} />
              </div>
              <p className={`text-2xl font-black ${tasks.length > 0 ? "text-yellow-400" : "text-foreground"}`}>{tasks.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Tarefas abertas</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/ocorrencias" className="block">
          <Card className={`border transition-all hover:scale-[1.02] ${occurrences.length > 0 ? "border-orange-500/30 shadow-orange-500/10 shadow-md" : "border-border"}`}>
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${occurrences.length > 0 ? "bg-orange-500/15" : "bg-muted/30"}`}>
                <AlertTriangle className={`w-5 h-5 ${occurrences.length > 0 ? "text-orange-400" : "text-muted-foreground"}`} />
              </div>
              <p className={`text-2xl font-black ${occurrences.length > 0 ? "text-orange-400" : "text-foreground"}`}>{occurrences.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Ocorrências</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/manutencao" className="block">
          <Card className={`border transition-all hover:scale-[1.02] ${maintenanceData.length > 0 ? "border-red-500/30 shadow-red-500/10 shadow-md" : "border-border"}`}>
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${maintenanceData.length > 0 ? "bg-red-500/15" : "bg-muted/30"}`}>
                <Wrench className={`w-5 h-5 ${maintenanceData.length > 0 ? "text-red-400" : "text-muted-foreground"}`} />
              </div>
              <p className={`text-2xl font-black ${maintenanceData.length > 0 ? "text-red-400" : "text-foreground"}`}>{maintenanceData.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Manutenções</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/testores" className="block">
          <Card className={`border transition-all hover:scale-[1.02] ${testoresParados > 0 ? "border-yellow-500/30" : "border-green-500/20"}`}>
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${testoresParados > 0 ? "bg-yellow-500/15" : "bg-green-500/15"}`}>
                <Activity className={`w-5 h-5 ${testoresParados > 0 ? "text-yellow-400" : "text-green-400"}`} />
              </div>
              <p className={`text-2xl font-black ${testoresParados > 0 ? "text-yellow-400" : "text-green-400"}`}>{testoresParados}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Parados agora</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Ações Rápidas ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Acesso Rápido</h2>
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
          {quickActions.map(action => (
            <Link
              key={action.label}
              to={action.path}
              className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all hover:scale-[1.05] active:scale-95 ${action.bg}`}
            >
              <div className={`w-9 h-9 rounded-xl ${action.iconBg} flex items-center justify-center`}>
                <action.icon className={`w-4 h-4 ${action.text}`} />
              </div>
              <span className={`text-[9px] sm:text-[10px] font-semibold text-center leading-tight ${action.text}`}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Gráfico Planejado vs Realizado ── */}
      <ShiftGoalChart prodData={allProd} lossData={allLosses} date={activeDate} />

      {/* ── Status Testores + Ocorrências ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              Status dos Testores
            </h3>
            <Link to="/testores">
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <CardContent className="px-5 pb-5 space-y-2">
            {testores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum testor cadastrado.</p>
            ) : testores.slice(0, 6).map(t => {
              const statusColors = {
                rodando: "bg-green-500/10 text-green-400 border-green-500/30",
                atencao: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
                parado: "bg-red-500/10 text-red-400 border-red-500/30",
                manutencao: "bg-orange-500/10 text-orange-400 border-orange-500/30",
                bloqueado: "bg-gray-500/10 text-gray-400 border-gray-500/30",
              };
              const statusLabel = { rodando: "Rodando", atencao: "Atenção", parado: "Parado", manutencao: "Manutenção", bloqueado: "Bloqueado" };
              const dotColor = { rodando: "bg-green-400", atencao: "bg-yellow-400", parado: "bg-red-400", manutencao: "bg-orange-400", bloqueado: "bg-gray-400" };
              const ultimaJust = allProd
                .filter(p => p.testor_nome === t.nome && p.justificativa)
                .sort((a, b) => (b.hora || "").localeCompare(a.hora || ""))[0]?.justificativa;

              return (
                <div key={t.id} className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${dotColor[t.status] || "bg-gray-400"} ${t.status === "rodando" ? "animate-pulse" : ""}`} />
                      <span className="font-semibold text-sm">{t.nome}</span>
                    </div>
                    <Badge className={`text-[10px] border ${statusColors[t.status] || statusColors.parado}`}>
                      {statusLabel[t.status] || t.status}
                    </Badge>
                  </div>
                  {ultimaJust && (
                    <p className="text-[11px] text-muted-foreground leading-tight truncate pl-4" title={ultimaJust}>
                      💬 {ultimaJust}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              </div>
              Ocorrências Recentes
            </h3>
            <Link to="/ocorrencias">
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <CardContent className="px-5 pb-5 space-y-2">
            {occurrences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm font-medium text-green-400">Nenhuma ocorrência aberta</p>
              </div>
            ) : occurrences.slice(0, 5).map(occ => (
              <div key={occ.id} className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3 h-3 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate capitalize">{occ.tipo?.replace(/_/g, " ") || "Ocorrência"}</p>
                    <p className="text-xs text-muted-foreground truncate">{occ.testor || "—"}</p>
                  </div>
                </div>
                <Badge className={`text-[10px] border shrink-0 ${gravBadge[occ.gravidade] || gravBadge.media}`}>
                  {occ.gravidade}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Rodapé live ── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        Dados sincronizados em tempo real · {format(new Date(), "HH:mm", { locale: ptBR })}
      </div>
    </div>
  );
}