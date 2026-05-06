import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { BarChart3, Car, Clock, AlertTriangle, Gauge, CheckCircle2, TrendingUp, Activity } from "lucide-react";

const COLORS = [
  "hsl(217,91%,60%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)",
  "hsl(0,72%,51%)", "hsl(280,65%,60%)", "hsl(199,89%,48%)"
];

const TURNO_LABELS = { todos: "Todos os Turnos", primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };

const tooltipStyle = {
  background: "hsl(217,25%,11%)",
  border: "1px solid hsl(217,19%,18%)",
  borderRadius: "8px",
  color: "hsl(210,40%,96%)",
  fontSize: "12px",
};

const axisStyle = { fontSize: 11, fill: "hsl(215,16%,55%)" };
const gridStyle = { strokeDasharray: "3 3", stroke: "hsl(217,19%,18%)" };

export default function Reports() {
  const [turno, setTurno] = useState("todos");
  const qc = useQueryClient();

  const { data: testores = [] } = useQuery({ queryKey: ["testores"], queryFn: () => base44.entities.Testor.list() });
  const { data: occurrences = [] } = useQuery({ queryKey: ["occurrences-all"], queryFn: () => base44.entities.Occurrence.list() });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-all"], queryFn: () => base44.entities.Task.list() });
  const { data: carTests = [] } = useQuery({ queryKey: ["car-tests"], queryFn: () => base44.entities.CarTest.list() });
  const { data: production = [] } = useQuery({ queryKey: ["production-all"], queryFn: () => base44.entities.Production.list("-created_date", 30) });

  // ── Real-time ──
  useEffect(() => {
    const subs = [
      base44.entities.Testor.subscribe(() => qc.invalidateQueries({ queryKey: ["testores"] })),
      base44.entities.Occurrence.subscribe(() => qc.invalidateQueries({ queryKey: ["occurrences-all"] })),
      base44.entities.Task.subscribe(() => qc.invalidateQueries({ queryKey: ["tasks-all"] })),
      base44.entities.Production.subscribe(() => qc.invalidateQueries({ queryKey: ["production-all"] })),
    ];
    return () => subs.forEach(u => u());
  }, [qc]);

  // ── Filtered data ──
  const filteredTestores    = useMemo(() => turno === "todos" ? testores    : testores.filter(t => t.turno === turno),    [testores, turno]);
  const filteredOccurrences = useMemo(() => turno === "todos" ? occurrences : occurrences.filter(o => o.turno === turno), [occurrences, turno]);
  const filteredTasks       = useMemo(() => turno === "todos" ? tasks       : tasks.filter(t => t.turno === turno),       [tasks, turno]);
  const filteredProduction  = useMemo(() => turno === "todos" ? production  : production.filter(p => p.turno === turno),  [production, turno]);

  // ── Chart data ──
  const testorBarData = filteredTestores.map(t => ({
    name: t.nome?.replace("Testor ", "T"),
    Carros: t.carros_testados_turno || 0,
    Falhas: t.falhas_turno || 0,
    Risco: t.risco_score || 0,
  }));

  const falhasRankData = [...filteredTestores]
    .sort((a, b) => (b.falhas_turno || 0) - (a.falhas_turno || 0))
    .slice(0, 6)
    .map(t => ({ name: t.nome?.replace("Testor ", "T"), Falhas: t.falhas_turno || 0, Paradas: t.paradas_curtas || 0 }));

  const occByType = {};
  filteredOccurrences.forEach(o => { const k = o.tipo || "outro"; occByType[k] = (occByType[k] || 0) + 1; });
  const occPieData = Object.entries(occByType).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  const prodLineData = filteredProduction.slice(0, 14).reverse().map((p, i) => ({
    label: p.data ? p.data.slice(5) : `D${i + 1}`,
    Planejado: p.producao_planejada || 0,
    Realizado: p.producao_realizada || 0,
  }));

  const radarData = filteredTestores.slice(0, 5).map(t => ({
    name: t.nome?.replace("Testor ", "T"),
    Carros: Math.min(t.carros_testados_turno || 0, 100),
    Eficiência: Math.max(100 - (t.risco_score || 0), 0),
    Disponib: t.status === "rodando" ? 100 : t.status === "atencao" ? 60 : 20,
  }));

  // ── Summary stats ──
  const totalCarros  = filteredTestores.reduce((s, t) => s + (t.carros_testados_turno || 0), 0);
  const totalFalhas  = filteredTestores.reduce((s, t) => s + (t.falhas_turno || 0), 0);
  const totalParado  = filteredTestores.reduce((s, t) => s + (t.tempo_total_parado || 0), 0);
  const tasksDone    = filteredTasks.filter(t => t.status === "concluida").length;
  const tasksOpen    = filteredTasks.filter(t => t.status === "aberta").length;
  const tasksLate    = filteredTasks.filter(t => t.status === "atrasada").length;
  const eficiencia   = totalCarros > 0 ? Math.round(((totalCarros - totalFalhas) / totalCarros) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header + Turno filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-primary" /> Relatórios & Gráficos</h1>
          <p className="text-sm text-muted-foreground">Análise interativa de produção e falhas — {TURNO_LABELS[turno]}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(TURNO_LABELS).map(([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={turno === k ? "default" : "outline"}
              onClick={() => setTurno(k)}
              className={turno === k ? "" : "text-muted-foreground"}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Carros Testados", value: totalCarros, icon: Car, color: "text-primary", bg: "bg-primary/10" },
          { label: "Falhas Registradas", value: totalFalhas, icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Tempo Parado (min)", value: `${totalParado}`, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          { label: "Eficiência Geral", value: `${eficiencia}%`, icon: TrendingUp, color: eficiencia >= 80 ? "text-green-400" : "text-red-400", bg: eficiencia >= 80 ? "bg-green-500/10" : "bg-red-500/10" },
        ].map((kpi) => (
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

      {/* Histórico de Produção */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Histórico de Produção (Planejado vs Realizado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prodLineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={prodLineData}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="label" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Planejado" stroke="hsl(215,16%,55%)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Realizado" stroke="hsl(217,91%,60%)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Sem dados de produção registrados.</p>
          )}
        </CardContent>
      </Card>

      {/* Carros + Falhas por Testor */}
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
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>
            )}
          </CardContent>
        </Card>

        {/* Ranking de Falhas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" /> Ranking de Falhas Frequentes
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
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ocorrências + Radar */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Ocorrências por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {occPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={occPieData} cx="50%" cy="50%" outerRadius={95} innerRadius={40}
                    dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "hsl(215,16%,55%)" }}
                  >
                    {occPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem ocorrências.</p>
            )}
          </CardContent>
        </Card>

        {/* Radar de performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Performance dos Testores (Radar)
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
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tarefas summary */}
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
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Score Médio de Risco</CardTitle></CardHeader>
          <CardContent>
            {filteredTestores.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={filteredTestores.map(t => ({ name: t.nome?.replace("Testor ", "T"), Risco: t.risco_score || 0 }))}>
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
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}