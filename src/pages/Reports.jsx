import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area
} from "recharts";
import {
  BarChart3, Car, Clock, AlertTriangle, Gauge, CheckCircle2,
  TrendingUp, Activity, TrendingDown, Calendar, CalendarDays
} from "lucide-react";
import {
  format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval,
  parseISO, isWithinInterval
} from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = [
  "hsl(217,91%,60%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)",
  "hsl(0,72%,51%)", "hsl(280,65%,60%)", "hsl(199,89%,48%)"
];

const TURNO_LABELS = { todos: "Todos", primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };

const tooltipStyle = {
  background: "hsl(217,25%,11%)",
  border: "1px solid hsl(217,19%,18%)",
  borderRadius: "8px",
  color: "hsl(210,40%,96%)",
  fontSize: "12px",
};

const axisStyle = { fontSize: 11, fill: "hsl(215,16%,55%)" };
const gridStyle = { strokeDasharray: "3 3", stroke: "hsl(217,19%,18%)" };

const TABS = [
  { key: "producao", label: "Produção", icon: TrendingUp },
  { key: "testores", label: "Testores", icon: Gauge },
  { key: "perdas", label: "Controle de Perdas", icon: TrendingDown },
];

export default function Reports() {
  const [turno, setTurno] = useState("todos");
  const [tab, setTab] = useState("producao");
  const [periodoPerda, setPeriodoPerda] = useState("semana"); // "semana" | "mes"
  const qc = useQueryClient();

  const today = new Date();

  const { data: testores = [] } = useQuery({ queryKey: ["testores"], queryFn: () => base44.entities.Testor.list() });
  const { data: occurrences = [] } = useQuery({ queryKey: ["occurrences-all"], queryFn: () => base44.entities.Occurrence.list() });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-all"], queryFn: () => base44.entities.Task.list() });
  const { data: production = [] } = useQuery({ queryKey: ["production-all"], queryFn: () => base44.entities.Production.list("-created_date", 60) });
  const { data: lossRecords = [] } = useQuery({
    queryKey: ["loss-all"],
    queryFn: () => base44.entities.LossControl.list("-created_date", 500),
  });

  useEffect(() => {
    const subs = [
      base44.entities.Testor.subscribe(() => qc.invalidateQueries({ queryKey: ["testores"] })),
      base44.entities.Occurrence.subscribe(() => qc.invalidateQueries({ queryKey: ["occurrences-all"] })),
      base44.entities.Task.subscribe(() => qc.invalidateQueries({ queryKey: ["tasks-all"] })),
      base44.entities.Production.subscribe(() => qc.invalidateQueries({ queryKey: ["production-all"] })),
      base44.entities.LossControl.subscribe(() => qc.invalidateQueries({ queryKey: ["loss-all"] })),
    ];
    return () => subs.forEach(u => u());
  }, [qc]);

  const filteredTestores    = useMemo(() => turno === "todos" ? testores    : testores.filter(t => t.turno === turno),    [testores, turno]);
  const filteredOccurrences = useMemo(() => turno === "todos" ? occurrences : occurrences.filter(o => o.turno === turno), [occurrences, turno]);
  const filteredTasks       = useMemo(() => turno === "todos" ? tasks       : tasks.filter(t => t.turno === turno),       [tasks, turno]);
  const filteredProduction  = useMemo(() => turno === "todos" ? production  : production.filter(p => p.turno === turno),  [production, turno]);

  // ── KPIs ──
  const totalCarros  = filteredTestores.reduce((s, t) => s + (t.carros_testados_turno || 0), 0);
  const totalFalhas  = filteredTestores.reduce((s, t) => s + (t.falhas_turno || 0), 0);
  const totalParado  = filteredTestores.reduce((s, t) => s + (t.tempo_total_parado || 0), 0);
  const eficiencia   = totalCarros > 0 ? Math.round(((totalCarros - totalFalhas) / totalCarros) * 100) : 0;
  const tasksDone    = filteredTasks.filter(t => t.status === "concluida").length;
  const tasksOpen    = filteredTasks.filter(t => t.status === "aberta").length;
  const tasksLate    = filteredTasks.filter(t => t.status === "atrasada").length;

  // ── Produção charts ──
  const prodLineData = filteredProduction.slice(0, 14).reverse().map((p, i) => ({
    label: p.data ? p.data.slice(5) : `D${i + 1}`,
    Planejado: p.producao_planejada || 0,
    Realizado: p.producao_realizada || 0,
  }));

  // ── Testores charts ──
  const testorBarData = filteredTestores.map(t => ({
    name: t.nome?.replace("Testor ", "T"),
    Carros: t.carros_testados_turno || 0,
    Falhas: t.falhas_turno || 0,
  }));

  const falhasRankData = [...filteredTestores]
    .sort((a, b) => (b.falhas_turno || 0) - (a.falhas_turno || 0))
    .slice(0, 6)
    .map(t => ({ name: t.nome?.replace("Testor ", "T"), Falhas: t.falhas_turno || 0, Paradas: t.paradas_curtas || 0 }));

  const occByType = {};
  filteredOccurrences.forEach(o => { const k = o.tipo || "outro"; occByType[k] = (occByType[k] || 0) + 1; });
  const occPieData = Object.entries(occByType).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  const radarData = filteredTestores.slice(0, 5).map(t => ({
    name: t.nome?.replace("Testor ", "T"),
    Carros: Math.min(t.carros_testados_turno || 0, 100),
    Eficiência: Math.max(100 - (t.risco_score || 0), 0),
    Disponib: t.status === "rodando" ? 100 : t.status === "atencao" ? 60 : 20,
  }));

  // ── PERDAS: dados semanais ──
  const lossWeeklyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(today, 6), end: today });
    return days.map(day => {
      const ds = format(day, "yyyy-MM-dd");
      const dayLoss = lossRecords.filter(r => r.data === ds);
      const total = dayLoss.reduce((s, r) => s + (r.carros_perdidos || 0), 0);
      return { label: format(day, "dd/MM", { locale: ptBR }), Perdas: total };
    });
  }, [lossRecords]);

  // ── PERDAS: dados mensais (por semana) ──
  const lossMonthlyData = useMemo(() => {
    const start = subDays(today, 29);
    // Group by week
    const weeks = [];
    let cur = new Date(start);
    while (cur <= today) {
      const weekStart = new Date(cur);
      const weekEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, today.getTime()));
      const label = `${format(weekStart, "dd/MM")}–${format(weekEnd, "dd/MM")}`;
      const total = lossRecords.filter(r => {
        if (!r.data) return false;
        const d = parseISO(r.data);
        return d >= weekStart && d <= weekEnd;
      }).reduce((s, r) => s + (r.carros_perdidos || 0), 0);
      weeks.push({ label, Perdas: total });
      cur = new Date(cur.getTime() + 7 * 86400000);
    }
    return weeks;
  }, [lossRecords]);

  // ── PERDAS: ranking de itens ──
  const lossItemRanking = useMemo(() => {
    const cutoff = periodoPerda === "semana" ? subDays(today, 6) : subDays(today, 29);
    const filtered = lossRecords.filter(r => {
      if (!r.data) return false;
      return parseISO(r.data) >= cutoff;
    });
    const map = {};
    filtered.forEach(r => {
      if (!r.item_perda) return;
      map[r.item_perda] = (map[r.item_perda] || 0) + (r.carros_perdidos || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, Perdas]) => ({ name: name.length > 20 ? name.slice(0, 18) + "…" : name, Perdas }));
  }, [lossRecords, periodoPerda]);

  // ── PERDAS: por turno ──
  const lossByTurno = useMemo(() => {
    const cutoff = periodoPerda === "semana" ? subDays(today, 6) : subDays(today, 29);
    const map = { primeiro: 0, segundo: 0, terceiro: 0 };
    lossRecords.forEach(r => {
      if (!r.data || !r.turno) return;
      if (parseISO(r.data) >= cutoff) map[r.turno] = (map[r.turno] || 0) + (r.carros_perdidos || 0);
    });
    return [
      { name: "1º Turno", value: map.primeiro },
      { name: "2º Turno", value: map.segundo },
      { name: "3º Turno", value: map.terceiro },
    ].filter(d => d.value > 0);
  }, [lossRecords, periodoPerda]);

  // ── PERDAS: por hora (heatmap) ──
  const lossByHour = useMemo(() => {
    const cutoff = periodoPerda === "semana" ? subDays(today, 6) : subDays(today, 29);
    const map = {};
    lossRecords.forEach(r => {
      if (!r.data || !r.hora) return;
      if (parseISO(r.data) >= cutoff) map[r.hora] = (map[r.hora] || 0) + (r.carros_perdidos || 0);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hora, Perdas]) => ({ hora, Perdas }));
  }, [lossRecords, periodoPerda]);

  const totalPerdasPeriodo = lossItemRanking.reduce((s, r) => s + r.Perdas, 0);
  const lossChartData = periodoPerda === "semana" ? lossWeeklyData : lossMonthlyData;

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Relatórios & Gráficos
          </h1>
          <p className="text-sm text-muted-foreground">Análise interativa — {TURNO_LABELS[turno]}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(TURNO_LABELS).map(([k, label]) => (
            <Button key={k} size="sm" variant={turno === k ? "default" : "outline"} onClick={() => setTurno(k)}
              className={turno !== k ? "text-muted-foreground" : ""}>{label}</Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 border border-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Carros Testados", value: totalCarros, icon: Car, color: "text-primary", bg: "bg-primary/10" },
          { label: "Falhas Registradas", value: totalFalhas, icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Tempo Parado (min)", value: totalParado, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          { label: "Eficiência Geral", value: `${eficiencia}%`, icon: TrendingUp, color: eficiencia >= 80 ? "text-green-400" : "text-red-400", bg: eficiencia >= 80 ? "bg-green-500/10" : "bg-red-500/10" },
        ].map(kpi => (
          <Card key={kpi.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{kpi.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ═══ TAB: PRODUÇÃO ═══ */}
      {tab === "producao" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Histórico de Produção (Planejado vs Realizado)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prodLineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={prodLineData}>
                    <defs>
                      <linearGradient id="gradPlan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(215,16%,55%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(215,16%,55%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="label" tick={axisStyle} />
                    <YAxis tick={axisStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="Planejado" stroke="hsl(215,16%,55%)" strokeDasharray="5 5" fill="url(#gradPlan)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Realizado" stroke="hsl(217,91%,60%)" fill="url(#gradReal)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados de produção registrados.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Tarefas</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-2xl font-bold text-blue-400">{tasksOpen}</p>
                    <p className="text-xs text-muted-foreground mt-1">Abertas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-2xl font-bold text-green-400">{tasksDone}</p>
                    <p className="text-xs text-muted-foreground mt-1">Concluídas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-2xl font-bold text-red-400">{tasksLate}</p>
                    <p className="text-xs text-muted-foreground mt-1">Atrasadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Ocorrências por Tipo</CardTitle></CardHeader>
              <CardContent>
                {occPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={occPieData} cx="50%" cy="50%" outerRadius={70} innerRadius={30} dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                        {occPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem ocorrências.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ TAB: TESTORES ═══ */}
      {tab === "testores" && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" /> Carros Testados por Testor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {testorBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={testorBarData} barGap={4}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="name" tick={axisStyle} />
                      <YAxis tick={axisStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Carros" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Falhas" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" /> Ranking de Falhas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {falhasRankData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={falhasRankData} layout="vertical" barGap={4}>
                      <CartesianGrid {...gridStyle} horizontal={false} />
                      <XAxis type="number" tick={axisStyle} />
                      <YAxis type="category" dataKey="name" tick={axisStyle} width={40} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Falhas" fill="hsl(38,92%,50%)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="Paradas" fill="hsl(0,72%,51%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>)}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Performance Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(217,19%,18%)" />
                      <PolarAngleAxis dataKey="name" tick={axisStyle} />
                      <PolarRadiusAxis tick={{ fontSize: 9, fill: "hsl(215,16%,40%)" }} />
                      <Radar name="Carros" dataKey="Carros" stroke="hsl(217,91%,60%)" fill="hsl(217,91%,60%)" fillOpacity={0.2} />
                      <Radar name="Eficiência" dataKey="Eficiência" stroke="hsl(142,71%,45%)" fill="hsl(142,71%,45%)" fillOpacity={0.2} />
                      <Radar name="Disponib." dataKey="Disponib" stroke="hsl(38,92%,50%)" fill="hsl(38,92%,50%)" fillOpacity={0.15} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Score de Risco por Testor</CardTitle></CardHeader>
              <CardContent>
                {filteredTestores.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={filteredTestores.map(t => ({ name: t.nome?.replace("Testor ", "T"), Risco: t.risco_score || 0 }))}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="name" tick={axisStyle} />
                      <YAxis domain={[0, 100]} tick={axisStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="Risco" radius={[4, 4, 0, 0]}>
                        {filteredTestores.map((t, i) => (
                          <Cell key={i} fill={
                            (t.risco_score || 0) <= 30 ? "hsl(142,71%,45%)"
                            : (t.risco_score || 0) <= 60 ? "hsl(38,92%,50%)"
                            : "hsl(0,72%,51%)"
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (<p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ TAB: CONTROLE DE PERDAS ═══ */}
      {tab === "perdas" && (
        <div className="space-y-4">
          {/* Período toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            <div className="flex gap-1 bg-muted/40 border border-border rounded-lg p-0.5">
              <button
                onClick={() => setPeriodoPerda("semana")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodoPerda === "semana" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Últimos 7 dias
              </button>
              <button
                onClick={() => setPeriodoPerda("mes")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodoPerda === "mes" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" /> Últimos 30 dias
              </button>
            </div>
            <Badge variant="outline" className="ml-auto text-red-400 border-red-500/40">
              {totalPerdasPeriodo} perdas no período
            </Badge>
          </div>

          {/* Linha de evolução */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                Evolução de Perdas — {periodoPerda === "semana" ? "Últimos 7 dias" : "Últimos 30 dias (por semana)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lossChartData.some(d => d.Perdas > 0) ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={lossChartData}>
                    <defs>
                      <linearGradient id="gradLoss" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0,72%,51%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="label" tick={axisStyle} />
                    <YAxis tick={axisStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="Perdas" stroke="hsl(0,72%,51%)" fill="url(#gradLoss)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(0,72%,51%)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma perda registrada no período.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Ranking de itens */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" /> Top 10 Itens com Mais Perdas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lossItemRanking.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={lossItemRanking} layout="vertical">
                      <CartesianGrid {...gridStyle} horizontal={false} />
                      <XAxis type="number" tick={axisStyle} />
                      <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={110} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="Perdas" radius={[0, 4, 4, 0]}>
                        {lossItemRanking.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "hsl(0,72%,51%)" : i <= 2 ? "hsl(38,92%,50%)" : "hsl(217,91%,60%)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Por turno */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Perdas por Turno
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lossByTurno.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={lossByTurno} cx="50%" cy="50%" outerRadius={60} innerRadius={25} dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}>
                          {lossByTurno.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
                  )}
                </CardContent>
              </Card>

              {/* Por hora */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Perdas por Hora do Dia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lossByHour.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={lossByHour}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="hora" tick={{ ...axisStyle, fontSize: 9 }} />
                        <YAxis tick={axisStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="Perdas" fill="hsl(280,65%,60%)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}