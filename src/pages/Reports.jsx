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
  TrendingUp, Activity, TrendingDown, Calendar, CalendarDays, FileDown, FileText
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
  { key: "resumo", label: "Resumo Diário", icon: FileText },
  { key: "producao", label: "Produção", icon: TrendingUp },
  { key: "testores", label: "Testores", icon: Gauge },
  { key: "perdas", label: "Controle de Perdas", icon: TrendingDown },
];

export default function Reports() {
  const [turno, setTurno] = useState("todos");
  const [tab, setTab] = useState("resumo");
  const [periodoPerda, setPeriodoPerda] = useState("semana");
  const [resumoDate, setResumoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resumoTurno, setResumoTurno] = useState("segundo");
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

  // Dados do resumo diário
  const resumoSheetKey = `prod-ctrl-resumo-${resumoDate}-${resumoTurno}`;
  const resumoLossKey = `loss-resumo-${resumoDate}-${resumoTurno}`;

  const RESUMO_TURNOS = [
    { label: "2º Turno (15h–23h45)", key: "segundo",  horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","23:45"] },
    { label: "3º Turno (01h–05h)", key: "terceiro", horas: ["01:00","02:00","03:00","04:00","05:00"] },
    { label: "1º Turno (06h–14h)", key: "primeiro", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
  ];
  const resumoTurnoObj = RESUMO_TURNOS.find(t => t.key === resumoTurno);

  const { data: prodRecords = [] } = useQuery({
    queryKey: [resumoSheetKey],
    queryFn: () => base44.entities.ProductionControl.filter({ data: resumoDate, turno: resumoTurno }),
  });

  const { data: lossDay = [] } = useQuery({
    queryKey: [resumoLossKey],
    queryFn: () => base44.entities.LossControl.filter({ data: resumoDate, turno: resumoTurno }),
  });

  const { data: occDay = [] } = useQuery({
    queryKey: [`occ-resumo-${resumoDate}-${resumoTurno}`],
    queryFn: () => base44.entities.Occurrence.list("-created_date", 100),
    enabled: tab === "resumo",
  });

  // Cálculos resumo
  const resumoTotalProd = prodRecords.reduce((acc, r) => acc + (r.carros_produzidos || 0), 0);
  const lossDayBruto = lossDay.filter(r => r.motivo_perda !== "ganho").reduce((acc, r) => acc + (r.carros_perdidos || 0), 0);
  const lossDayGanho = lossDay.filter(r => r.motivo_perda === "ganho").reduce((acc, r) => acc + (r.carros_perdidos || 0), 0);
  const perdaReal = Math.max(0, lossDayBruto - lossDayGanho);
  const producaoLiquida = Math.max(0, resumoTotalProd - perdaReal);

  // Produção por hora
  const prodPorHora = {};
  resumoTurnoObj.horas.forEach(h => {
    prodPorHora[h] = prodRecords.reduce((acc, r) => acc + (r.hora === h ? (r.carros_produzidos || 0) : 0), 0);
  });

  // Perdas por item (ranking)
  const lossByItemMap = {};
  lossDay.filter(r => r.motivo_perda !== "ganho").forEach(r => {
    if (!r.item_perda) return;
    lossByItemMap[r.item_perda] = (lossByItemMap[r.item_perda] || 0) + (r.carros_perdidos || 0);
  });
  const lossRanking = Object.entries(lossByItemMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Ocorrências do dia filtradas por turno
  const occFiltered = occDay.filter(o => {
    const d = o.created_date ? o.created_date.slice(0, 10) : "";
    return d === resumoDate && (resumoTurno === "todos" || o.turno === resumoTurno);
  });

  // Produção por testor
  const prodByTestor = {};
  prodRecords.forEach(r => {
    if (!r.testor_nome) return;
    prodByTestor[r.testor_nome] = (prodByTestor[r.testor_nome] || 0) + (r.carros_produzidos || 0);
  });

  const handleExportResumoPDF = () => {
    const hora = new Date().toLocaleString("pt-BR");
    const turnoLabel = resumoTurnoObj.label;
    const dateLabel = format(parseISO(resumoDate), "dd/MM/yyyy");

    const prodHoraRows = resumoTurnoObj.horas.map(h =>
      `<tr><td>${h}</td><td>${prodPorHora[h] || 0}</td></tr>`
    ).join("");

    const testorRows = Object.entries(prodByTestor).map(([nome, total]) =>
      `<tr><td>${nome}</td><td>${total}</td></tr>`
    ).join("");

    const lossRows = lossRanking.map(([item, val]) =>
      `<tr><td>${item}</td><td>${val}</td></tr>`
    ).join("");

    const occRows = occFiltered.map(o =>
      `<tr><td>${o.tipo?.replace(/_/g," ") || "—"}</td><td>${o.testor || "—"}</td><td>${o.gravidade || "—"}</td><td>${o.descricao || "—"}</td><td>${o.status || "—"}</td></tr>`
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { size: A4; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #111; }
      h1 { font-size: 16px; margin: 0 0 2px; color: #1a1a2e; }
      .subtitle { font-size: 10px; color: #666; margin-bottom: 14px; }
      h2 { font-size: 12px; margin: 16px 0 6px; color: #333; border-bottom: 2px solid #1d4ed8; padding-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
      th { background: #dbeafe; padding: 5px 6px; text-align: left; border: 1px solid #93c5fd; font-size: 9px; color: #1e3a8a; }
      td { padding: 4px 6px; border: 1px solid #ddd; font-size: 9px; }
      tr:nth-child(even) { background: #f7f8fb; }
      .kpi-grid { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
      .kpi { background: #f0f2f9; border: 1px solid #d0d4e8; border-radius: 6px; padding: 8px 12px; min-width: 110px; text-align: center; }
      .kpi .val { font-size: 22px; font-weight: bold; }
      .kpi .lbl { font-size: 8px; color: #666; margin-top: 1px; }
      .blue .val { color: #1d4ed8; }
      .red .val { color: #dc2626; }
      .green .val { color: #16a34a; }
      .orange .val { color: #ea580c; }
      .footer { margin-top: 20px; font-size: 8px; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
    </style></head><body>
    <h1>RESUMO DIÁRIO — ZP7</h1>
    <div class="subtitle">Data: ${dateLabel} &nbsp;|&nbsp; Turno: ${turnoLabel} &nbsp;|&nbsp; Gerado em: ${hora}</div>

    <div class="kpi-grid">
      <div class="kpi blue"><div class="val">${resumoTotalProd}</div><div class="lbl">Produção Bruta</div></div>
      <div class="kpi red"><div class="val">${lossDayBruto}</div><div class="lbl">Perdas Brutas</div></div>
      <div class="kpi green"><div class="val">${lossDayGanho}</div><div class="lbl">Carros Ganhos</div></div>
      <div class="kpi orange"><div class="val">${perdaReal}</div><div class="lbl">Perda Real</div></div>
      <div class="kpi green"><div class="val">${producaoLiquida}</div><div class="lbl">Produção Líquida</div></div>
      <div class="kpi red"><div class="val">${occFiltered.length}</div><div class="lbl">Ocorrências</div></div>
    </div>

    <h2>Produção por Hora</h2>
    <table><thead><tr><th>Hora</th><th>Carros Produzidos</th></tr></thead><tbody>${prodHoraRows}</tbody></table>

    ${testorRows ? `<h2>Produção por Testor</h2>
    <table><thead><tr><th>Testor</th><th>Total de Carros</th></tr></thead><tbody>${testorRows}</tbody></table>` : ""}

    ${lossRows ? `<h2>Ranking de Perdas</h2>
    <table><thead><tr><th>Item de Perda</th><th>Carros Perdidos</th></tr></thead><tbody>${lossRows}</tbody></table>` : ""}

    ${occRows ? `<h2>Ocorrências do Dia</h2>
    <table><thead><tr><th>Tipo</th><th>Testor</th><th>Gravidade</th><th>Descrição</th><th>Status</th></tr></thead><tbody>${occRows}</tbody></table>` : ""}

    <div class="footer">ZP7 — Resumo Diário gerado automaticamente pelo sistema.</div>
    <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.target = "_blank"; a.click();
  };

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
      const dayLoss = lossRecords.filter(r => r.data === ds && r.motivo_perda !== "ganho");
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
        if (!r.data || r.motivo_perda === "ganho") return false;
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
      if (!r.data || r.motivo_perda === "ganho") return false;
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
      if (!r.data || !r.turno || r.motivo_perda === "ganho") return;
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
      if (!r.data || !r.hora || r.motivo_perda === "ganho") return;
      if (parseISO(r.data) >= cutoff) map[r.hora] = (map[r.hora] || 0) + (r.carros_perdidos || 0);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hora, Perdas]) => ({ hora, Perdas }));
  }, [lossRecords, periodoPerda]);

  const totalPerdasPeriodo = lossItemRanking.reduce((s, r) => s + r.Perdas, 0);
  const lossChartData = periodoPerda === "semana" ? lossWeeklyData : lossMonthlyData;

  const handleExportPDF = () => {
    const hora = new Date().toLocaleString("pt-BR");
    const turnoLabel = TURNO_LABELS[turno];

    const testoresRows = filteredTestores.map(t => `
      <tr>
        <td>${t.nome}</td>
        <td>${t.status}</td>
        <td>${t.tempo_medio_carro > 0 ? Math.round(60 / t.tempo_medio_carro) : (t.carros_por_hora || 0)}</td>
        <td>${t.carros_testados_turno || 0}</td>
        <td>${t.falhas_turno || 0}</td>
        <td>${Math.max(0, (t.carros_testados_turno || 0) - (t.falhas_turno || 0))}</td>
        <td>${t.carros_testados_turno > 0 ? Math.min(100, Math.round(((t.carros_testados_turno - (t.falhas_turno||0)) / t.carros_testados_turno) * 100)) : 0}%</td>
        <td>${t.tempo_total_parado || 0} min</td>
        <td>${t.risco_score || 0}%</td>
      </tr>`).join("");

    const prodRows = filteredProduction.slice(0, 14).map(p => `
      <tr>
        <td>${p.data || "—"}</td>
        <td>${p.turno || "—"}</td>
        <td>${p.producao_planejada || 0}</td>
        <td>${p.producao_realizada || 0}</td>
        <td>${((p.producao_realizada || 0) - (p.producao_planejada || 0)) >= 0 ? "+" : ""}${(p.producao_realizada || 0) - (p.producao_planejada || 0)}</td>
      </tr>`).join("");

    const lossRows = lossItemRanking.map(r => `
      <tr><td>${r.name}</td><td>${r.Perdas}</td></tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { size: A4; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #111; }
      h1 { font-size: 16px; margin: 0 0 2px; color: #1a1a2e; }
      .subtitle { font-size: 10px; color: #666; margin-bottom: 14px; }
      h2 { font-size: 12px; margin: 16px 0 6px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
      th { background: #e8eaf0; padding: 5px 6px; text-align: left; border: 1px solid #bbb; font-size: 9px; }
      td { padding: 4px 6px; border: 1px solid #ddd; font-size: 9px; }
      tr:nth-child(even) { background: #f7f8fb; }
      .kpi-grid { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
      .kpi { background: #f0f2f9; border: 1px solid #d0d4e8; border-radius: 6px; padding: 8px 12px; min-width: 100px; }
      .kpi .val { font-size: 18px; font-weight: bold; color: #2244bb; }
      .kpi .lbl { font-size: 8px; color: #666; margin-top: 1px; }
      .footer { margin-top: 20px; font-size: 8px; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
    </style></head><body>
    <h1>Relatório ZP7 — ${turnoLabel}</h1>
    <div class="subtitle">Gerado em: ${hora} &nbsp;|&nbsp; Turno: ${turnoLabel}</div>

    <div class="kpi-grid">
      <div class="kpi"><div class="val">${totalCarros}</div><div class="lbl">Carros Testados</div></div>
      <div class="kpi"><div class="val">${totalFalhas}</div><div class="lbl">Falhas</div></div>
      <div class="kpi"><div class="val">${Math.max(0, totalCarros - totalFalhas)}</div><div class="lbl">Produção Líquida</div></div>
      <div class="kpi"><div class="val">${eficiencia}%</div><div class="lbl">Eficiência Geral</div></div>
      <div class="kpi"><div class="val">${totalParado} min</div><div class="lbl">Tempo Parado</div></div>
      <div class="kpi"><div class="val">${totalPerdasPeriodo}</div><div class="lbl">Perdas no Período</div></div>
    </div>

    ${testoresRows ? `<h2>Desempenho dos Testores</h2>
    <table><thead><tr>
      <th>Testor</th><th>Status</th><th>Previsto/h</th><th>Real</th>
      <th>Falhas</th><th>Líquido</th><th>Efic.</th><th>T.Perdido</th><th>Risco</th>
    </tr></thead><tbody>${testoresRows}</tbody></table>` : ""}

    ${prodRows ? `<h2>Histórico de Produção (últimos 14 registros)</h2>
    <table><thead><tr>
      <th>Data</th><th>Turno</th><th>Planejado</th><th>Realizado</th><th>Diferença</th>
    </tr></thead><tbody>${prodRows}</tbody></table>` : ""}

    ${lossRows ? `<h2>Top Perdas no Período</h2>
    <table><thead><tr><th>Item / Motivo</th><th>Carros Perdidos</th></tr></thead><tbody>${lossRows}</tbody></table>` : ""}

    <div class="footer">ZP7 Organização — Relatório gerado automaticamente pelo sistema.</div>
    <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

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
        <div className="flex gap-1.5 flex-wrap items-center">
          {Object.entries(TURNO_LABELS).map(([k, label]) => (
            <Button key={k} size="sm" variant={turno === k ? "default" : "outline"} onClick={() => setTurno(k)}
              className={turno !== k ? "text-muted-foreground" : ""}>{label}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={handleExportPDF} className="gap-1.5 text-muted-foreground hover:text-foreground ml-1">
            <FileDown className="w-3.5 h-3.5" /> Exportar PDF
          </Button>
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

      {/* ═══ TAB: RESUMO DIÁRIO ═══ */}
      {tab === "resumo" && (
        <div className="space-y-4">
          {/* Controles de data e turno */}
          <div className="flex flex-wrap gap-2 items-center">
            <input type="date" value={resumoDate} onChange={e => setResumoDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <div className="flex gap-1 bg-muted/40 border border-border rounded-lg p-0.5">
              {RESUMO_TURNOS.map(t => (
                <button key={t.key} onClick={() => setResumoTurno(t.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${resumoTurno === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {t.label.split(" ")[0]} {t.label.split(" ")[1]}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={handleExportResumoPDF} className="gap-1.5 ml-auto">
              <FileDown className="w-3.5 h-3.5" /> Exportar PDF
            </Button>
          </div>

          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Produção Bruta", value: resumoTotalProd, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { label: "Perdas Brutas", value: lossDayBruto, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              { label: "Carros Ganhos", value: lossDayGanho, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { label: "Perda Real", value: perdaReal, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
              { label: "Produção Líquida", value: producaoLiquida, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Ocorrências", value: occFiltered.length, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
            ].map(k => (
              <Card key={k.label} className={`border ${k.bg}`}>
                <CardContent className="p-4 text-center">
                  <p className={`text-4xl font-black ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Produção por hora */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" /> Produção por Hora
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resumoTotalProd > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={resumoTurnoObj.horas.map(h => ({ hora: h, Carros: prodPorHora[h] || 0 }))}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="hora" tick={{ ...axisStyle, fontSize: 9 }} />
                      <YAxis tick={axisStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="Carros" fill="hsl(217,91%,60%)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados de produção.</p>}
              </CardContent>
            </Card>

            {/* Produção por testor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" /> Produção por Testor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(prodByTestor).length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={Object.entries(prodByTestor).map(([nome, total]) => ({ nome: nome.replace("Testor ","T"), total }))}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="nome" tick={axisStyle} />
                      <YAxis tick={axisStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="total" name="Carros" fill="hsl(142,71%,45%)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados de testor.</p>}
              </CardContent>
            </Card>
          </div>

          {/* Ranking de perdas */}
          {lossRanking.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" /> Ranking de Perdas do Dia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lossRanking.map(([item, val], i) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className={`text-xs font-black w-5 text-center ${i === 0 ? "text-red-400" : i <= 2 ? "text-orange-400" : "text-muted-foreground"}`}>{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-medium truncate">{item}</span>
                          <span className="text-xs font-bold text-red-400 ml-2">{val}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-red-500/70" style={{ width: `${Math.round((val / (lossRanking[0]?.[1] || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ocorrências do dia */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> Ocorrências do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {occFiltered.length > 0 ? (
                <div className="space-y-2">
                  {occFiltered.map(o => (
                    <div key={o.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        o.gravidade === "critica" ? "bg-red-500/20 text-red-400" :
                        o.gravidade === "alta" ? "bg-orange-500/20 text-orange-400" :
                        o.gravidade === "media" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-muted text-muted-foreground"
                      }`}>{o.gravidade?.toUpperCase() || "—"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{o.tipo?.replace(/_/g," ") || "Sem tipo"} {o.testor ? `· ${o.testor}` : ""}</p>
                        {o.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{o.descricao}</p>}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        o.status === "resolvida" ? "bg-green-500/20 text-green-400" :
                        o.status === "em_andamento" ? "bg-blue-500/20 text-blue-400" :
                        "bg-muted text-muted-foreground"
                      }`}>{o.status?.replace(/_/g," ") || "aberta"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ocorrência registrada para este turno/dia.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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