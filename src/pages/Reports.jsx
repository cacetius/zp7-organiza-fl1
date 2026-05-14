import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area
} from "recharts";
import {
  BarChart3, Car, Clock, AlertTriangle, Gauge, CheckCircle2,
  TrendingUp, Activity, TrendingDown, Calendar, CalendarDays, FileDown, FileText,
  Filter, Printer
} from "lucide-react";
import {
  format, subDays, parseISO, eachDayOfInterval, isWithinInterval
} from "date-fns";
import { ptBR } from "date-fns/locale";
import html2canvas from "html2canvas";

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

const RESUMO_TURNOS = [
  { label: "2º Turno (15h–23h45)", key: "segundo",  horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","23:45"] },
  { label: "3º Turno (01h–05h)", key: "terceiro", horas: ["01:00","02:00","03:00","04:00","05:00"] },
  { label: "1º Turno (06h–14h)", key: "primeiro", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
];

// Capture all charts in a container as base64 images
async function captureChartsInContainer(container) {
  const charts = container.querySelectorAll(".recharts-responsive-container, .chart-capture");
  const images = [];
  for (const el of charts) {
    try {
      const canvas = await html2canvas(el, { backgroundColor: "#16202e", scale: 1.5, logging: false });
      images.push({ title: el.getAttribute("data-title") || "", src: canvas.toDataURL("image/png") });
    } catch (_) {}
  }
  return images;
}

export default function Reports() {
  const [turno, setTurno] = useState("todos");
  const [tab, setTab] = useState("resumo");
  const [periodoPerda, setPeriodoPerda] = useState("semana");
  const [resumoDate, setResumoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resumoTurno, setResumoTurno] = useState("segundo");

  // Date range filter for non-resumo tabs
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);
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

  const resumoSheetKey = `prod-ctrl-resumo-${resumoDate}-${resumoTurno}`;
  const resumoLossKey = `loss-resumo-${resumoDate}-${resumoTurno}`;
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

  // ── Date range helpers ──
  const fromDate = useMemo(() => { try { return parseISO(dateFrom); } catch { return subDays(today, 29); } }, [dateFrom]);
  const toDate = useMemo(() => { try { return parseISO(dateTo); } catch { return today; } }, [dateTo]);

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    try {
      const d = parseISO(dateStr);
      return d >= fromDate && d <= toDate;
    } catch { return false; }
  };

  // ── Filtered data by date range ──
  const filteredTestores    = useMemo(() => turno === "todos" ? testores    : testores.filter(t => t.turno === turno), [testores, turno]);
  const filteredOccurrences = useMemo(() => {
    let list = turno === "todos" ? occurrences : occurrences.filter(o => o.turno === turno);
    return list.filter(o => inRange(o.created_date?.slice(0,10)));
  }, [occurrences, turno, dateFrom, dateTo]);
  const filteredTasks = useMemo(() => turno === "todos" ? tasks : tasks.filter(t => t.turno === turno), [tasks, turno]);
  const filteredProduction = useMemo(() => {
    let list = turno === "todos" ? production : production.filter(p => p.turno === turno);
    return list.filter(p => inRange(p.data));
  }, [production, turno, dateFrom, dateTo]);
  const filteredLoss = useMemo(() => lossRecords.filter(r => inRange(r.data)), [lossRecords, dateFrom, dateTo]);

  // ── Resumo cálculos ──
  const resumoTotalProd = prodRecords.reduce((acc, r) => acc + (r.carros_produzidos || 0), 0);
  const lossDayBruto = lossDay.filter(r => r.motivo_perda !== "ganho").reduce((acc, r) => acc + (r.carros_perdidos || 0), 0);
  const lossDayGanho = lossDay.filter(r => r.motivo_perda === "ganho").reduce((acc, r) => acc + (r.carros_perdidos || 0), 0);
  const perdaReal = Math.max(0, lossDayBruto - lossDayGanho);
  const producaoLiquida = Math.max(0, resumoTotalProd - perdaReal);

  const prodPorHora = {};
  resumoTurnoObj.horas.forEach(h => {
    prodPorHora[h] = prodRecords.reduce((acc, r) => acc + (r.hora === h ? (r.carros_produzidos || 0) : 0), 0);
  });

  const lossByItemMap = {};
  lossDay.filter(r => r.motivo_perda !== "ganho").forEach(r => {
    if (!r.item_perda) return;
    lossByItemMap[r.item_perda] = (lossByItemMap[r.item_perda] || 0) + (r.carros_perdidos || 0);
  });
  const lossRanking = Object.entries(lossByItemMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const occFiltered = occDay.filter(o => {
    const d = o.created_date ? o.created_date.slice(0, 10) : "";
    return d === resumoDate && (resumoTurno === "todos" || o.turno === resumoTurno);
  });

  const prodByTestor = {};
  prodRecords.forEach(r => {
    if (!r.testor_nome) return;
    prodByTestor[r.testor_nome] = (prodByTestor[r.testor_nome] || 0) + (r.carros_produzidos || 0);
  });

  // ── KPIs (usando range de datas) ──
  const totalCarros  = filteredTestores.reduce((s, t) => s + (t.carros_testados_turno || 0), 0);
  const totalFalhas  = filteredTestores.reduce((s, t) => s + (t.falhas_turno || 0), 0);
  const totalParado  = filteredTestores.reduce((s, t) => s + (t.tempo_total_parado || 0), 0);
  const eficiencia   = totalCarros > 0 ? Math.round(((totalCarros - totalFalhas) / totalCarros) * 100) : 0;
  const tasksDone    = filteredTasks.filter(t => t.status === "concluida").length;
  const tasksOpen    = filteredTasks.filter(t => t.status === "aberta").length;
  const tasksLate    = filteredTasks.filter(t => t.status === "atrasada").length;

  // ── Produção charts (range) ──
  const prodLineData = useMemo(() => {
    return filteredProduction.slice(0, 30).reverse().map((p, i) => ({
      label: p.data ? p.data.slice(5) : `D${i + 1}`,
      Planejado: p.producao_planejada || 0,
      Realizado: p.producao_realizada || 0,
    }));
  }, [filteredProduction]);

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

  // ── PERDAS usando range de datas ──
  const lossByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: fromDate, end: toDate });
    return days.map(day => {
      const ds = format(day, "yyyy-MM-dd");
      const total = filteredLoss.filter(r => r.data === ds && r.motivo_perda !== "ganho")
        .reduce((s, r) => s + (r.carros_perdidos || 0), 0);
      return { label: format(day, "dd/MM", { locale: ptBR }), Perdas: total };
    });
  }, [filteredLoss, dateFrom, dateTo]);

  const lossItemRanking = useMemo(() => {
    const filtered = filteredLoss.filter(r => r.motivo_perda !== "ganho");
    const map = {};
    filtered.forEach(r => {
      if (!r.item_perda) return;
      map[r.item_perda] = (map[r.item_perda] || 0) + (r.carros_perdidos || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, Perdas]) => ({ name: name.length > 20 ? name.slice(0, 18) + "…" : name, Perdas }));
  }, [filteredLoss]);

  const lossByTurno = useMemo(() => {
    const map = { primeiro: 0, segundo: 0, terceiro: 0 };
    filteredLoss.forEach(r => {
      if (!r.turno || r.motivo_perda === "ganho") return;
      map[r.turno] = (map[r.turno] || 0) + (r.carros_perdidos || 0);
    });
    return [
      { name: "1º Turno", value: map.primeiro },
      { name: "2º Turno", value: map.segundo },
      { name: "3º Turno", value: map.terceiro },
    ].filter(d => d.value > 0);
  }, [filteredLoss]);

  const lossByHour = useMemo(() => {
    const map = {};
    filteredLoss.forEach(r => {
      if (!r.hora || r.motivo_perda === "ganho") return;
      map[r.hora] = (map[r.hora] || 0) + (r.carros_perdidos || 0);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hora, Perdas]) => ({ hora, Perdas }));
  }, [filteredLoss]);

  const totalPerdasPeriodo = lossItemRanking.reduce((s, r) => s + r.Perdas, 0);

  const dateRangeLabel = `${format(fromDate, "dd/MM/yyyy")} – ${format(toDate, "dd/MM/yyyy")}`;

  // ── Export PDF com gráficos ──
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const container = reportRef.current;
      const chartEls = container ? container.querySelectorAll("[data-chart]") : [];
      const chartImages = [];

      for (const el of chartEls) {
        try {
          const canvas = await html2canvas(el, {
            backgroundColor: "#16202e",
            scale: 1.8,
            logging: false,
            useCORS: true,
          });
          chartImages.push({ title: el.getAttribute("data-title") || "", src: canvas.toDataURL("image/png") });
        } catch (_) {}
      }

      const hora = new Date().toLocaleString("pt-BR");
      const turnoLabel = TURNO_LABELS[turno];

      const testoresRows = filteredTestores.map(t => `
        <tr>
          <td>${t.nome}</td>
          <td><span class="badge ${t.status === 'rodando' ? 'badge-green' : t.status === 'parado' ? 'badge-red' : 'badge-yellow'}">${t.status}</span></td>
          <td>${t.carros_testados_turno || 0}</td>
          <td>${t.falhas_turno || 0}</td>
          <td>${Math.max(0, (t.carros_testados_turno || 0) - (t.falhas_turno || 0))}</td>
          <td>${t.carros_testados_turno > 0 ? Math.min(100, Math.round(((t.carros_testados_turno - (t.falhas_turno||0)) / t.carros_testados_turno) * 100)) : 0}%</td>
          <td>${t.tempo_total_parado || 0} min</td>
          <td><span class="badge ${(t.risco_score||0) <= 30 ? 'badge-green' : (t.risco_score||0) <= 60 ? 'badge-yellow' : 'badge-red'}">${t.risco_score || 0}%</span></td>
        </tr>`).join("");

      const prodRows = filteredProduction.slice(0, 20).map(p => {
        const diff = (p.producao_realizada || 0) - (p.producao_planejada || 0);
        return `<tr>
          <td>${p.data || "—"}</td>
          <td>${p.turno || "—"}</td>
          <td>${p.producao_planejada || 0}</td>
          <td>${p.producao_realizada || 0}</td>
          <td class="${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? "+" : ""}${diff}</td>
        </tr>`;
      }).join("");

      const lossRows = lossItemRanking.map(r => `
        <tr><td>${r.name}</td><td>${r.Perdas}</td></tr>`).join("");

      const chartImagesHtml = chartImages.map(img => `
        <div class="chart-block">
          ${img.title ? `<p class="chart-label">${img.title}</p>` : ""}
          <img src="${img.src}" style="width:100%;border-radius:8px;"/>
        </div>
      `).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Relatório ZP7 — ${dateRangeLabel}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a2035; background: #fff; }
        .header { background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); color: white; padding: 16px 20px; border-radius: 10px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; }
        .header h1 { font-size: 18px; margin: 0; font-weight: 900; letter-spacing:1px; }
        .header .meta { font-size: 9px; opacity: 0.85; margin-top: 4px; }
        .header .logo { font-size: 32px; font-weight: 900; opacity: 0.3; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
        .kpi { border-radius: 8px; padding: 12px 14px; border: 1px solid #e2e8f0; text-align: center; }
        .kpi .val { font-size: 26px; font-weight: 900; }
        .kpi .lbl { font-size: 8px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi-blue { background: #eff6ff; } .kpi-blue .val { color: #1d4ed8; }
        .kpi-red { background: #fef2f2; } .kpi-red .val { color: #dc2626; }
        .kpi-green { background: #f0fdf4; } .kpi-green .val { color: #16a34a; }
        .kpi-orange { background: #fff7ed; } .kpi-orange .val { color: #ea580c; }
        .kpi-purple { background: #faf5ff; } .kpi-purple .val { color: #7c3aed; }
        h2 { font-size: 13px; margin: 18px 0 8px; color: #1e3a8a; border-bottom: 2px solid #dbeafe; padding-bottom: 4px; display: flex; align-items: center; gap: 6px; }
        h2::before { content: "▸"; color: #3b82f6; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 14px; border-radius: 6px; overflow: hidden; }
        th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
        tr:nth-child(even) td { background: #f8fafc; }
        tr:last-child td { border-bottom: none; }
        .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 8px; font-weight: 700; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-yellow { background: #fef3c7; color: #92400e; }
        .positive { color: #16a34a; font-weight: 700; }
        .negative { color: #dc2626; font-weight: 700; }
        .charts-section { margin: 18px 0; }
        .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .chart-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
        .chart-label { font-size: 10px; font-weight: 700; color: #1e40af; margin: 0 0 6px; }
        .footer { margin-top: 22px; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; }
        .page-break { page-break-before: always; }
        .section-divider { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
      </style></head><body>

      <div class="header">
        <div>
          <h1>Relatório ZP7</h1>
          <div class="meta">Período: ${dateRangeLabel} &nbsp;|&nbsp; Turno: ${turnoLabel} &nbsp;|&nbsp; Gerado em: ${hora}</div>
        </div>
        <div class="logo">ZP7</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi kpi-blue"><div class="val">${totalCarros}</div><div class="lbl">Carros Testados</div></div>
        <div class="kpi kpi-red"><div class="val">${totalFalhas}</div><div class="lbl">Falhas</div></div>
        <div class="kpi kpi-green"><div class="val">${Math.max(0, totalCarros - totalFalhas)}</div><div class="lbl">Produção Líquida</div></div>
        <div class="kpi kpi-purple"><div class="val">${eficiencia}%</div><div class="lbl">Eficiência Geral</div></div>
        <div class="kpi kpi-orange"><div class="val">${totalParado} min</div><div class="lbl">Tempo Parado</div></div>
        <div class="kpi kpi-red"><div class="val">${totalPerdasPeriodo}</div><div class="lbl">Perdas no Período</div></div>
      </div>

      ${testoresRows ? `<h2>Desempenho dos Testores</h2>
      <table><thead><tr>
        <th>Testor</th><th>Status</th><th>Carros</th><th>Falhas</th><th>Líquido</th><th>Efic.</th><th>T.Parado</th><th>Risco</th>
      </tr></thead><tbody>${testoresRows}</tbody></table>` : ""}

      ${prodRows ? `<h2>Histórico de Produção</h2>
      <table><thead><tr>
        <th>Data</th><th>Turno</th><th>Planejado</th><th>Realizado</th><th>Diferença</th>
      </tr></thead><tbody>${prodRows}</tbody></table>` : ""}

      ${lossRows ? `<h2>Top Perdas no Período</h2>
      <table><thead><tr><th>Item / Motivo</th><th>Carros Perdidos</th></tr></thead><tbody>${lossRows}</tbody></table>` : ""}

      ${chartImages.length > 0 ? `
      <div class="page-break"></div>
      <h2>Gráficos</h2>
      <div class="charts-grid">${chartImagesHtml}</div>` : ""}

      <div class="footer">
        <span>ZP7 — Relatório gerado automaticamente pelo sistema.</span>
        <span>${hora}</span>
      </div>

      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } finally {
      setExporting(false);
    }
  };

  const handleExportResumoPDF = async () => {
    setExporting(true);
    try {
      const container = reportRef.current;
      const chartEls = container ? container.querySelectorAll("[data-chart]") : [];
      const chartImages = [];
      for (const el of chartEls) {
        try {
          const canvas = await html2canvas(el, { backgroundColor: "#16202e", scale: 1.8, logging: false, useCORS: true });
          chartImages.push({ title: el.getAttribute("data-title") || "", src: canvas.toDataURL("image/png") });
        } catch (_) {}
      }

      const hora = new Date().toLocaleString("pt-BR");
      const dateLabel = format(parseISO(resumoDate), "dd/MM/yyyy");
      const turnoLabel = resumoTurnoObj.label;

      const prodHoraRows = resumoTurnoObj.horas.map(h =>
        `<tr><td>${h}</td><td>${prodPorHora[h] || 0}</td></tr>`
      ).join("");

      const testorRows = Object.entries(prodByTestor).map(([nome, total]) =>
        `<tr><td>${nome}</td><td>${total}</td></tr>`
      ).join("");

      const lossRows2 = lossRanking.map(([item, val]) =>
        `<tr><td>${item}</td><td>${val}</td></tr>`
      ).join("");

      const occRows = occFiltered.map(o =>
        `<tr><td>${o.tipo?.replace(/_/g," ") || "—"}</td><td>${o.testor || "—"}</td>
        <td><span class="badge ${o.gravidade === 'critica' ? 'badge-red' : o.gravidade === 'alta' ? 'badge-orange' : 'badge-yellow'}">${o.gravidade || "—"}</span></td>
        <td>${o.descricao || "—"}</td>
        <td><span class="badge ${o.status === 'resolvida' ? 'badge-green' : 'badge-blue'}">${o.status || "—"}</span></td></tr>`
      ).join("");

      const chartImagesHtml = chartImages.map(img => `
        <div class="chart-block">
          ${img.title ? `<p class="chart-label">${img.title}</p>` : ""}
          <img src="${img.src}" style="width:100%;border-radius:8px;"/>
        </div>
      `).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Resumo Diário ZP7 — ${dateLabel}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a2035; background: #fff; }
        .header { background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%); color: white; padding: 16px 20px; border-radius: 10px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; }
        .header h1 { font-size: 18px; margin: 0; font-weight: 900; }
        .header .meta { font-size: 9px; opacity: 0.8; margin-top: 4px; }
        .header .logo { font-size: 32px; font-weight: 900; opacity: 0.25; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
        .kpi { border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0; text-align: center; }
        .kpi .val { font-size: 26px; font-weight: 900; }
        .kpi .lbl { font-size: 8px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi-blue { background: #eff6ff; } .kpi-blue .val { color: #1d4ed8; }
        .kpi-red { background: #fef2f2; } .kpi-red .val { color: #dc2626; }
        .kpi-green { background: #f0fdf4; } .kpi-green .val { color: #16a34a; }
        .kpi-orange { background: #fff7ed; } .kpi-orange .val { color: #ea580c; }
        h2 { font-size: 13px; margin: 18px 0 8px; color: #1e3a8a; border-bottom: 2px solid #dbeafe; padding-bottom: 4px; }
        h2::before { content: "▸ "; color: #3b82f6; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 14px; overflow: hidden; }
        th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; }
        td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
        tr:nth-child(even) td { background: #f8fafc; }
        .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 8px; font-weight: 700; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-orange { background: #ffedd5; color: #9a3412; }
        .badge-yellow { background: #fef3c7; color: #92400e; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; }
        .chart-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
        .chart-label { font-size: 10px; font-weight: 700; color: #1e40af; margin: 0 0 6px; }
        .footer { margin-top: 22px; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; }
        .page-break { page-break-before: always; }
      </style></head><body>

      <div class="header">
        <div>
          <h1>Resumo Diário — ZP7</h1>
          <div class="meta">Data: ${dateLabel} &nbsp;|&nbsp; Turno: ${turnoLabel} &nbsp;|&nbsp; Gerado: ${hora}</div>
        </div>
        <div class="logo">ZP7</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi kpi-blue"><div class="val">${resumoTotalProd}</div><div class="lbl">Produção Bruta</div></div>
        <div class="kpi kpi-red"><div class="val">${lossDayBruto}</div><div class="lbl">Perdas Brutas</div></div>
        <div class="kpi kpi-green"><div class="val">${lossDayGanho}</div><div class="lbl">Carros Ganhos</div></div>
        <div class="kpi kpi-orange"><div class="val">${perdaReal}</div><div class="lbl">Perda Real</div></div>
        <div class="kpi kpi-green"><div class="val">${producaoLiquida}</div><div class="lbl">Produção Líquida</div></div>
        <div class="kpi kpi-red"><div class="val">${occFiltered.length}</div><div class="lbl">Ocorrências</div></div>
      </div>

      <h2>Produção por Hora</h2>
      <table><thead><tr><th>Hora</th><th>Carros Produzidos</th></tr></thead><tbody>${prodHoraRows}</tbody></table>

      ${testorRows ? `<h2>Produção por Testor</h2>
      <table><thead><tr><th>Testor</th><th>Total de Carros</th></tr></thead><tbody>${testorRows}</tbody></table>` : ""}

      ${lossRows2 ? `<h2>Ranking de Perdas</h2>
      <table><thead><tr><th>Item de Perda</th><th>Carros Perdidos</th></tr></thead><tbody>${lossRows2}</tbody></table>` : ""}

      ${occRows ? `<h2>Ocorrências do Dia</h2>
      <table><thead><tr><th>Tipo</th><th>Testor</th><th>Gravidade</th><th>Descrição</th><th>Status</th></tr></thead><tbody>${occRows}</tbody></table>` : ""}

      ${chartImages.length > 0 ? `
      <div class="page-break"></div>
      <h2>Gráficos do Turno</h2>
      <div class="charts-grid">${chartImagesHtml}</div>` : ""}

      <div class="footer">
        <span>ZP7 — Resumo Diário gerado automaticamente pelo sistema.</span>
        <span>${hora}</span>
      </div>
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`;

      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      a.target = "_blank"; a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 pb-20 lg:pb-0" ref={reportRef}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Relatórios & Gráficos
          </h1>
          <p className="text-sm text-muted-foreground">
            {tab === "resumo"
              ? `Resumo · ${format(parseISO(resumoDate), "dd/MM/yyyy")} · ${resumoTurnoObj.label.split(" ")[0]} ${resumoTurnoObj.label.split(" ")[1]}`
              : `Período: ${dateRangeLabel} · ${TURNO_LABELS[turno]}`
            }
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {Object.entries(TURNO_LABELS).map(([k, label]) => (
            <Button key={k} size="sm" variant={turno === k ? "default" : "outline"} onClick={() => setTurno(k)}
              className={turno !== k ? "text-muted-foreground" : ""}>{label}</Button>
          ))}
          {tab !== "resumo" && (
            <Button size="sm" variant="outline" onClick={() => setShowDateFilter(v => !v)}
              className={`gap-1.5 ${showDateFilter ? "text-primary border-primary/50" : "text-muted-foreground"}`}>
              <Filter className="w-3.5 h-3.5" /> Datas
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={tab === "resumo" ? handleExportResumoPDF : handleExportPDF}
            disabled={exporting}
            className="gap-1.5 text-muted-foreground hover:text-foreground ml-1">
            {exporting ? (
              <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Gerando...</>
            ) : (
              <><Printer className="w-3.5 h-3.5" /> Exportar PDF</>
            )}
          </Button>
        </div>
      </div>

      {/* Date range filter panel */}
      {showDateFilter && tab !== "resumo" && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-muted-foreground">De:</span>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 w-36 text-sm" />
          <span className="text-sm text-muted-foreground">Até:</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 w-36 text-sm" />
          <Badge variant="outline" className="ml-auto text-primary border-primary/30 text-xs">
            {dateRangeLabel}
          </Badge>
        </div>
      )}

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

      {/* KPI Cards (global) */}
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
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="date" value={resumoDate} onChange={e => setResumoDate(e.target.value)}
              className="h-9 w-36 text-sm" />
            <div className="flex gap-1 bg-muted/40 border border-border rounded-lg p-0.5">
              {RESUMO_TURNOS.map(t => (
                <button key={t.key} onClick={() => setResumoTurno(t.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${resumoTurno === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {t.label.split(" ")[0]} {t.label.split(" ")[1]}
                </button>
              ))}
            </div>
          </div>

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
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" /> Produção por Hora
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resumoTotalProd > 0 ? (
                  <div data-chart data-title="Produção por Hora">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={resumoTurnoObj.horas.map(h => ({ hora: h, Carros: prodPorHora[h] || 0 }))}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="hora" tick={{ ...axisStyle, fontSize: 9 }} />
                        <YAxis tick={axisStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="Carros" fill="hsl(217,91%,60%)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados de produção.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" /> Produção por Testor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(prodByTestor).length > 0 ? (
                  <div data-chart data-title="Produção por Testor">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={Object.entries(prodByTestor).map(([nome, total]) => ({ nome: nome.replace("Testor ","T"), total }))}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="nome" tick={axisStyle} />
                        <YAxis tick={axisStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="total" name="Carros" fill="hsl(142,71%,45%)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados de testor.</p>}
              </CardContent>
            </Card>
          </div>

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
                <div data-chart data-title="Produção: Planejado vs Realizado">
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
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados de produção no período.</p>
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
                  <div data-chart data-title="Ocorrências por Tipo">
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
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem ocorrências no período.</p>
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
                  <div data-chart data-title="Carros Testados por Testor">
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
                  </div>
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
                  <div data-chart data-title="Ranking de Falhas por Testor">
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
                  </div>
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
                  <div data-chart data-title="Performance Radar dos Testores">
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
                  </div>
                ) : (<p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Score de Risco por Testor</CardTitle></CardHeader>
              <CardContent>
                {filteredTestores.length > 0 ? (
                  <div data-chart data-title="Score de Risco por Testor">
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
                  </div>
                ) : (<p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ TAB: CONTROLE DE PERDAS ═══ */}
      {tab === "perdas" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="ml-auto text-red-400 border-red-500/40">
              {totalPerdasPeriodo} perdas no período
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                Evolução de Perdas — {dateRangeLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lossByDay.some(d => d.Perdas > 0) ? (
                <div data-chart data-title="Evolução Diária de Perdas">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={lossByDay}>
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
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma perda registrada no período.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" /> Top 10 Itens com Mais Perdas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lossItemRanking.length > 0 ? (
                  <div data-chart data-title="Top 10 Itens de Perda">
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
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Perdas por Turno
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lossByTurno.length > 0 ? (
                    <div data-chart data-title="Perdas por Turno">
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
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Perdas por Hora do Dia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lossByHour.length > 0 ? (
                    <div data-chart data-title="Perdas por Hora do Dia">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={lossByHour}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="hora" tick={{ ...axisStyle, fontSize: 9 }} />
                          <YAxis tick={axisStyle} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="Perdas" fill="hsl(280,65%,60%)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
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