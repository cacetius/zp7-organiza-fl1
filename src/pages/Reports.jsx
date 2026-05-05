import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Car, Clock, AlertTriangle, Gauge, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)", "hsl(217,91%,60%)", "hsl(280,65%,60%)"];

export default function Reports() {
  const { data: testores = [] } = useQuery({ queryKey: ["testores"], queryFn: () => base44.entities.Testor.list() });
  const { data: occurrences = [] } = useQuery({ queryKey: ["occurrences-all"], queryFn: () => base44.entities.Occurrence.list() });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-all"], queryFn: () => base44.entities.Task.list() });
  const { data: carTests = [] } = useQuery({ queryKey: ["car-tests"], queryFn: () => base44.entities.CarTest.list() });

  // Testor efficiency data
  const testorData = testores.map((t) => ({
    name: t.nome,
    carros: t.carros_testados_turno || 0,
    risco: t.risco_score || 0,
    falhas: t.falhas_turno || 0,
  }));

  // Occurrence by type
  const occByType = {};
  occurrences.forEach((o) => {
    const key = o.tipo || "outro";
    occByType[key] = (occByType[key] || 0) + 1;
  });
  const occPieData = Object.entries(occByType).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  // Task stats
  const tasksDone = tasks.filter((t) => t.status === "concluida").length;
  const tasksOpen = tasks.filter((t) => t.status === "aberta").length;
  const tasksLate = tasks.filter((t) => t.status === "atrasada").length;

  // Car test results
  const approved = carTests.filter((c) => c.resultado === "aprovado").length;
  const reproved = carTests.filter((c) => c.resultado === "reprovado").length;

  const totalCarros = testores.reduce((s, t) => s + (t.carros_testados_turno || 0), 0);
  const totalFalhas = testores.reduce((s, t) => s + (t.falhas_turno || 0), 0);
  const totalParado = testores.reduce((s, t) => s + (t.tempo_total_parado || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada de produção e operação</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Car className="w-8 h-8 text-primary" />
            <div><p className="text-2xl font-bold">{totalCarros}</p><p className="text-xs text-muted-foreground">Carros testados</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-400" />
            <div><p className="text-2xl font-bold">{totalFalhas}</p><p className="text-xs text-muted-foreground">Falhas totais</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-400" />
            <div><p className="text-2xl font-bold">{totalParado}min</p><p className="text-xs text-muted-foreground">Tempo parado</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
            <div><p className="text-2xl font-bold">{tasksDone}</p><p className="text-xs text-muted-foreground">Tarefas concluídas</p></div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Carros por testor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Gauge className="w-4 h-4" /> Carros por Testor</CardTitle>
          </CardHeader>
          <CardContent>
            {testorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={testorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,18%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215,16%,55%)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215,16%,55%)" }} />
                  <Tooltip contentStyle={{ background: "hsl(217,25%,11%)", border: "1px solid hsl(217,19%,18%)", borderRadius: "8px", color: "hsl(210,40%,96%)" }} />
                  <Bar dataKey="carros" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Ocorrências por tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Ocorrências por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {occPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={occPieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {occPieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(217,25%,11%)", border: "1px solid hsl(217,19%,18%)", borderRadius: "8px", color: "hsl(210,40%,96%)" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem ocorrências</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task and Car Test summary */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Tarefas</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-blue-500/10"><p className="text-xl font-bold text-blue-400">{tasksOpen}</p><p className="text-xs text-muted-foreground">Abertas</p></div>
              <div className="p-3 rounded-lg bg-green-500/10"><p className="text-xl font-bold text-green-400">{tasksDone}</p><p className="text-xs text-muted-foreground">Concluídas</p></div>
              <div className="p-3 rounded-lg bg-red-500/10"><p className="text-xl font-bold text-red-400">{tasksLate}</p><p className="text-xs text-muted-foreground">Atrasadas</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Resultado dos Testes</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 rounded-lg bg-green-500/10"><p className="text-xl font-bold text-green-400">{approved}</p><p className="text-xs text-muted-foreground">Aprovados</p></div>
              <div className="p-3 rounded-lg bg-red-500/10"><p className="text-xl font-bold text-red-400">{reproved}</p><p className="text-xs text-muted-foreground">Reprovados</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}