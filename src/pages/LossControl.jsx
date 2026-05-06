import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from "recharts";
import {
  TrendingDown, Plus, BarChart3, AlertTriangle, Car, Clock,
  Calendar, RefreshCw, FileText, ChevronDown
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const TURNO_LABELS = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };
const MOTIVO_LABELS = {
  falha_mecanica: "Falha Mecânica", falha_eletrica: "Falha Elétrica",
  manutencao: "Manutenção", setup: "Setup", qualidade: "Qualidade",
  operacional: "Operacional", outro: "Outro"
};
const COLORS = ["hsl(0,72%,51%)", "hsl(38,92%,50%)", "hsl(217,91%,60%)", "hsl(142,71%,45%)", "hsl(280,65%,60%)", "hsl(199,89%,48%)", "hsl(215,16%,55%)"];

const tooltipStyle = { background: "hsl(217,25%,11%)", border: "1px solid hsl(217,19%,18%)", borderRadius: "8px", color: "hsl(210,40%,96%)", fontSize: "12px" };
const axisStyle = { fontSize: 11, fill: "hsl(215,16%,55%)" };
const gridStyle = { strokeDasharray: "3 3", stroke: "hsl(217,19%,18%)" };

const today = format(new Date(), "yyyy-MM-dd");

const EMPTY_FORM = {
  testor_nome: "", turno: "primeiro", data: today,
  carros_planejados: "", carros_produzidos: "", motivo_perda: "falha_mecanica",
  tempo_parado_min: "", observacoes: "", responsavel: ""
};

export default function LossControl() {
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState("diario");
  const [turnoFiltro, setTurnoFiltro] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: losses = [], isLoading } = useQuery({
    queryKey: ["losses"],
    queryFn: () => base44.entities.LossControl.list("-data", 200),
  });
  const { data: testores = [] } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
  });

  useEffect(() => {
    const unsub = base44.entities.LossControl.subscribe((event) => {
      qc.setQueryData(["losses"], (prev = []) => {
        if (event.type === "create") return [event.data, ...prev];
        if (event.type === "update") return prev.map(l => l.id === event.id ? event.data : l);
        if (event.type === "delete") return prev.filter(l => l.id !== event.id);
        return prev;
      });
    });
    return unsub;
  }, [qc]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LossControl.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["losses"] }); setDialogOpen(false); setForm(EMPTY_FORM); },
  });

  // ── Date range filter ──
  const filteredByPeriod = useMemo(() => {
    const now = new Date();
    let from, to;
    if (periodo === "diario") { from = today; to = today; }
    else if (periodo === "semanal") { from = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"); to = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"); }
    else { from = format(startOfMonth(now), "yyyy-MM-dd"); to = format(endOfMonth(now), "yyyy-MM-dd"); }

    return losses.filter(l => {
      const inRange = l.data >= from && l.data <= to;
      const inTurno = turnoFiltro === "todos" || l.turno === turnoFiltro;
      return inRange && inTurno;
    });
  }, [losses, periodo, turnoFiltro]);

  // ── KPIs ──
  const totalPlanejado  = filteredByPeriod.reduce((s, l) => s + (l.carros_planejados || 0), 0);
  const totalProduzido  = filteredByPeriod.reduce((s, l) => s + (l.carros_produzidos || 0), 0);
  const totalPerdido    = filteredByPeriod.reduce((s, l) => s + (l.carros_perdidos || 0), 0);
  const totalParado     = filteredByPeriod.reduce((s, l) => s + (l.tempo_parado_min || 0), 0);
  const eficiencia      = totalPlanejado > 0 ? Math.round((totalProduzido / totalPlanejado) * 100) : 0;

  // ── Chart: Perdas por Testor ──
  const perdasPorTestor = useMemo(() => {
    const map = {};
    filteredByPeriod.forEach(l => {
      if (!map[l.testor_nome]) map[l.testor_nome] = { name: l.testor_nome, Perdidos: 0, Produzidos: 0 };
      map[l.testor_nome].Perdidos   += l.carros_perdidos || 0;
      map[l.testor_nome].Produzidos += l.carros_produzidos || 0;
    });
    return Object.values(map).sort((a, b) => b.Perdidos - a.Perdidos);
  }, [filteredByPeriod]);

  // ── Chart: Linha de produção diária ──
  const linhaDiaria = useMemo(() => {
    const map = {};
    filteredByPeriod.forEach(l => {
      if (!map[l.data]) map[l.data] = { label: l.data?.slice(5), Planejado: 0, Produzido: 0, Perdido: 0 };
      map[l.data].Planejado += l.carros_planejados || 0;
      map[l.data].Produzido += l.carros_produzidos || 0;
      map[l.data].Perdido   += l.carros_perdidos || 0;
    });
    return Object.values(map).sort((a, b) => a.label > b.label ? 1 : -1);
  }, [filteredByPeriod]);

  // ── Chart: Motivos ──
  const motivoData = useMemo(() => {
    const map = {};
    filteredByPeriod.forEach(l => {
      const k = l.motivo_perda || "outro";
      map[k] = (map[k] || 0) + (l.carros_perdidos || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name: MOTIVO_LABELS[name] || name, value })).filter(d => d.value > 0);
  }, [filteredByPeriod]);

  // ── Chart: Perdas por turno ──
  const perdasPorTurno = useMemo(() => {
    const map = { primeiro: 0, segundo: 0, terceiro: 0 };
    filteredByPeriod.forEach(l => { map[l.turno] = (map[l.turno] || 0) + (l.carros_perdidos || 0); });
    return Object.entries(map).map(([t, v]) => ({ name: TURNO_LABELS[t], Perdidos: v }));
  }, [filteredByPeriod]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const perdidos = Math.max(0, (Number(form.carros_planejados) || 0) - (Number(form.carros_produzidos) || 0));
    createMutation.mutate({ ...form, carros_planejados: Number(form.carros_planejados), carros_produzidos: Number(form.carros_produzidos), carros_perdidos: perdidos, tempo_parado_min: Number(form.tempo_parado_min) || 0 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-red-400" /> Controle de Perdas
          </h1>
          <p className="text-sm text-muted-foreground">Registro e análise de perdas de produção por testor e turno</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Registrar Perda
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
          {[
            { k: "diario", label: "Diário", Ic: Calendar },
            { k: "semanal", label: "Semanal", Ic: BarChart3 },
            { k: "mensal", label: "Mensal", Ic: FileText },
          ].map(({ k, label, Ic }) => (
            <button
              key={k}
              onClick={() => setPeriodo(k)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${periodo === k ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Ic className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        <Select value={turnoFiltro} onValueChange={setTurnoFiltro}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Turnos</SelectItem>
            <SelectItem value="primeiro">1º Turno</SelectItem>
            <SelectItem value="segundo">2º Turno</SelectItem>
            <SelectItem value="terceiro">3º Turno</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs px-3 py-1.5 border-primary/30 text-primary">
          {filteredByPeriod.length} registros
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Planejado", value: totalPlanejado, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Car },
          { label: "Produzido", value: totalProduzido, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", icon: Car },
          { label: "Perdido", value: totalPerdido, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: TrendingDown },
          { label: "Tempo Parado", value: `${totalParado}min`, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: Clock },
          { label: "Eficiência", value: `${eficiencia}%`, color: eficiencia >= 85 ? "text-green-400" : eficiencia >= 70 ? "text-yellow-400" : "text-red-400", bg: eficiencia >= 85 ? "bg-green-500/10" : "bg-red-500/10", border: eficiencia >= 85 ? "border-green-500/20" : "border-red-500/20", icon: BarChart3 },
        ].map(kpi => (
          <Card key={kpi.label} className={`p-4 border ${kpi.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Linha de Produção */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {periodo === "diario" ? "Produção do Dia por Turno" : periodo === "semanal" ? "Produção Diária da Semana" : "Produção Diária do Mês"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {linhaDiaria.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={linhaDiaria}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="label" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Planejado" stroke="hsl(215,16%,55%)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Produzido" stroke="hsl(217,91%,60%)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Perdido" stroke="hsl(0,72%,51%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado para o período selecionado.</p>
          )}
        </CardContent>
      </Card>

      {/* Perdas por Testor + Motivos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" /> Perdas por Testor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {perdasPorTestor.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={perdasPorTestor} layout="vertical" barGap={4}>
                  <CartesianGrid {...gridStyle} horizontal={false} />
                  <XAxis type="number" tick={axisStyle} />
                  <YAxis type="category" dataKey="name" tick={axisStyle} width={60} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Produzidos" fill="hsl(217,91%,60%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Perdidos" fill="hsl(0,72%,51%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" /> Perdas por Motivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {motivoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={motivoData} cx="50%" cy="50%" outerRadius={85} innerRadius={35} dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {motivoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Perdas por Turno */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" /> Distribuição de Perdas por Turno
          </CardTitle>
        </CardHeader>
        <CardContent>
          {perdasPorTurno.some(d => d.Perdidos > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={perdasPorTurno}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="name" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Perdidos" radius={[6, 6, 0, 0]}>
                  {perdasPorTurno.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem perdas registradas.</p>
          )}
        </CardContent>
      </Card>

      {/* Tabela de registros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Registros Detalhados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredByPeriod.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4">Data</th>
                    <th className="text-left py-2 pr-4">Testor</th>
                    <th className="text-left py-2 pr-4">Turno</th>
                    <th className="text-right py-2 pr-4">Planejado</th>
                    <th className="text-right py-2 pr-4">Produzido</th>
                    <th className="text-right py-2 pr-4">Perdido</th>
                    <th className="text-left py-2 pr-4">Motivo</th>
                    <th className="text-right py-2">Parado(min)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredByPeriod.map(l => (
                    <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4 text-muted-foreground">{l.data?.slice(5)}</td>
                      <td className="py-2 pr-4 font-medium">{l.testor_nome}</td>
                      <td className="py-2 pr-4"><Badge variant="outline" className="text-[10px]">{TURNO_LABELS[l.turno]}</Badge></td>
                      <td className="py-2 pr-4 text-right text-blue-400">{l.carros_planejados}</td>
                      <td className="py-2 pr-4 text-right text-green-400">{l.carros_produzidos}</td>
                      <td className="py-2 pr-4 text-right font-bold text-red-400">{l.carros_perdidos}</td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">{MOTIVO_LABELS[l.motivo_perda] || l.motivo_perda}</td>
                      <td className="py-2 text-right text-yellow-400">{l.tempo_parado_min || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de registro */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" /> Registrar Perda de Produção
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Testor *</Label>
                <Select value={form.testor_nome} onValueChange={v => setForm(f => ({ ...f, testor_nome: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {testores.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Turno *</Label>
                <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeiro">1º Turno</SelectItem>
                    <SelectItem value="segundo">2º Turno</SelectItem>
                    <SelectItem value="terceiro">3º Turno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo da Perda</Label>
                <Select value={form.motivo_perda} onValueChange={v => setForm(f => ({ ...f, motivo_perda: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MOTIVO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Carros Planejados *</Label>
                <Input type="number" min="0" value={form.carros_planejados} onChange={e => setForm(f => ({ ...f, carros_planejados: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carros Produzidos *</Label>
                <Input type="number" min="0" value={form.carros_produzidos} onChange={e => setForm(f => ({ ...f, carros_produzidos: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tempo Parado (min)</Label>
                <Input type="number" min="0" value={form.tempo_parado_min} onChange={e => setForm(f => ({ ...f, tempo_parado_min: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {form.carros_planejados && form.carros_produzidos && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                <span className="text-red-400 font-bold text-lg">{Math.max(0, Number(form.carros_planejados) - Number(form.carros_produzidos))}</span>
                <span className="text-muted-foreground text-sm ml-2">carros perdidos calculados</span>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Responsável</Label>
              <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Detalhes adicionais..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || !form.testor_nome || !form.carros_planejados}>
                {createMutation.isPending ? "Salvando..." : "Registrar Perda"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}