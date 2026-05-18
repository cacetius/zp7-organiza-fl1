import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area
} from "recharts";
import {
  BarChart3, Car, Clock, AlertTriangle, Gauge, CheckCircle2,
  TrendingUp, Activity, TrendingDown, Calendar, FileText,
  Filter, Printer, Send, GitCompare
} from "lucide-react";
import { format, subDays, parseISO, eachDayOfInterval } from "date-fns";
import ShiftProductionChart from "@/components/dashboard/ShiftProductionChart";
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
  { key: "resumo", label: "Resumo", icon: FileText },
  { key: "producao", label: "Produção", icon: TrendingUp },
  { key: "testores", label: "Testores", icon: Gauge },
  { key: "perdas", label: "Perdas", icon: TrendingDown },
];

const RESUMO_TURNOS = [
  { label: "2º Turno (15h–23h)", key: "segundo",  horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"] },
  { label: "3º Turno (01h–05h)", key: "terceiro", horas: ["01:00","02:00","03:00","04:00","05:00"] },
  { label: "1º Turno (06h–14h)", key: "primeiro", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
];

export default function Reports() {
  const [turno, setTurno] = useState("todos");
  const [tab, setTab] = useState("resumo");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const [resumoDate, setResumoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resumoTurno, setResumoTurno] = useState("segundo");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [compareDate1, setCompareDate1] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd"));
  const [compareDate2, setCompareDate2] = useState(format(new Date(), "yyyy-MM-dd"));
  const [exporting, setExporting] = useState(false);
  const [exportingTurno, setExportingTurno] = useState(false);
  const qc = useQueryClient();

  const today = new Date();

  const stale2m = 2 * 60_000;
  const stale5m = 5 * 60_000;

  // Queries sempre necessárias (leves)
  const { data: testores = [] } = useQuery({ queryKey: ["testores"], queryFn: () => base44.entities.Testor.list(), staleTime: stale5m });

  // Queries por tab — só carregam quando a tab está ativa
  const { data: occurrences = [] } = useQuery({
    queryKey: ["occurrences-all"], queryFn: () => base44.entities.Occurrence.list("-created_date", 200),
    staleTime: stale2m, enabled: tab === "producao" || tab === "resumo",
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-all"], queryFn: () => base44.entities.Task.list(),
    staleTime: stale5m, enabled: tab === "producao",
  });
  const { data: lossRecords = [] } = useQuery({
    queryKey: ["loss-all"],
    queryFn: () => base44.entities.LossControl.list("-created_date", 2000),
    staleTime: stale2m, enabled: tab === "perdas" || tab === "resumo",
  });

  const resumoTurnoObj = RESUMO_TURNOS.find(t => t.key === resumoTurno);

  const { data: prodRecords = [], isLoading: loadingProdRecords } = useQuery({
    queryKey: [`prod-ctrl-${resumoDate}-${resumoTurno}`],
    queryFn: () => base44.entities.ProductionControl.filter({ data: resumoDate, turno: resumoTurno }),
    staleTime: stale2m, enabled: tab === "resumo",
  });

  const { data: lossDay = [] } = useQuery({
    queryKey: [`loss-${resumoDate}-${resumoTurno}`],
    queryFn: () => base44.entities.LossControl.filter({ data: resumoDate, turno: resumoTurno }),
    staleTime: stale2m, enabled: tab === "resumo",
  });

  const { data: occDay = [] } = useQuery({
    queryKey: [`occ-${resumoDate}-${resumoTurno}`],
    queryFn: () => base44.entities.Occurrence.list("-created_date", 100),
    staleTime: stale2m, enabled: tab === "resumo",
  });

  useEffect(() => {
    // Subscriptions só para invalidar cache — não criam queries desnecessárias
    const subs = [
      base44.entities.Testor.subscribe(() => qc.invalidateQueries({ queryKey: ["testores"] })),
      base44.entities.LossControl.subscribe(() => {
        qc.invalidateQueries({ queryKey: ["loss-all"] });
        qc.invalidateQueries({ predicate: q => q.queryKey[0]?.toString().startsWith("loss-") });
      }),
      base44.entities.ProductionControl.subscribe(() => {
        qc.invalidateQueries({ queryKey: ["prod-ctrl-all"] });
        qc.invalidateQueries({ predicate: q => q.queryKey[0]?.toString().startsWith("prod-ctrl-") });
      }),
    ];
    return () => subs.forEach(u => u());
  }, [qc]);

  const fromDate = useMemo(() => { try { return parseISO(dateFrom); } catch { return subDays(today, 29); } }, [dateFrom]);
  const toDate = useMemo(() => { try { return parseISO(dateTo); } catch { return today; } }, [dateTo]);

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    try { const d = parseISO(dateStr); return d >= fromDate && d <= toDate; } catch { return false; }
  };

  const filteredTestores    = useMemo(() => turno === "todos" ? testores    : testores.filter(t => t.turno === turno), [testores, turno]);
  const filteredOccurrences = useMemo(() => {
    let list = turno === "todos" ? occurrences : occurrences.filter(o => o.turno === turno);
    return list.filter(o => inRange(o.created_date?.slice(0,10)));
  }, [occurrences, turno, dateFrom, dateTo]);
  const filteredTasks = useMemo(() => turno === "todos" ? tasks : tasks.filter(t => t.turno === turno), [tasks, turno]);

  const filteredLoss = useMemo(() => {
    let list = turno === "todos" ? lossRecords : lossRecords.filter(r => r.turno === turno);
    return list.filter(r => inRange(r.data));
  }, [lossRecords, turno, dateFrom, dateTo]);

  // Resumo calculations
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

  // Global KPIs — baseados em ProductionControl e LossControl (não em testores)
  const { data: prodCtrlAll = [], isLoading: loadingProdAll } = useQuery({
    queryKey: ["prod-ctrl-all"],
    queryFn: () => base44.entities.ProductionControl.list("-created_date", 2000),
    staleTime: stale2m, enabled: tab !== "resumo",
  });

  const filteredProdCtrl = useMemo(() => {
    let list = turno === "todos" ? prodCtrlAll : prodCtrlAll.filter(p => p.turno === turno);
    return list.filter(p => inRange(p.data));
  }, [prodCtrlAll, turno, dateFrom, dateTo]);

  const totalCarros  = filteredProdCtrl.reduce((s, r) => s + (r.carros_produzidos || 0), 0);
  const totalPerdasCtrl = filteredLoss.filter(r => r.motivo_perda !== "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
  const totalGanhosCtrl = filteredLoss.filter(r => r.motivo_perda === "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
  const totalPerdaRealCtrl = Math.max(0, totalPerdasCtrl - totalGanhosCtrl);
  const totalParado  = filteredTestores.reduce((s, t) => s + (t.tempo_total_parado || 0), 0);
  const eficiencia   = totalCarros > 0 ? Math.round(((totalCarros - totalPerdaRealCtrl) / totalCarros) * 100) : 0;
  const tasksDone    = filteredTasks.filter(t => t.status === "concluida").length;
  const tasksOpen    = filteredTasks.filter(t => t.status === "aberta").length;
  const tasksLate    = filteredTasks.filter(t => t.status === "atrasada").length;

  // Agrupa ProductionControl por data para o gráfico de evolução diária
  const prodLineData = useMemo(() => {
    const byDay = {};
    filteredProdCtrl.forEach(r => {
      if (!r.data) return;
      if (!byDay[r.data]) byDay[r.data] = 0;
      byDay[r.data] += (r.carros_produzidos || 0);
    });
    return Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, total]) => ({
        label: data.slice(5),
        Produção: total,
      }));
  }, [filteredProdCtrl]);

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

  // Ganhos por item (resumo)
  const ganhoItemRanking = useMemo(() => {
    const filtered = filteredLoss.filter(r => r.motivo_perda === "ganho");
    const map = {};
    filtered.forEach(r => {
      if (!r.item_perda) return;
      map[r.item_perda] = (map[r.item_perda] || 0) + (r.carros_perdidos || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, Ganhos]) => ({ name: name.length > 20 ? name.slice(0,18)+"…" : name, Ganhos }));
  }, [filteredLoss]);

  const totalPerdasPeriodo = filteredLoss.filter(r => r.motivo_perda !== "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
  const totalGanhosPeriodo = filteredLoss.filter(r => r.motivo_perda === "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
  const perdaRealPeriodo = Math.max(0, totalPerdasPeriodo - totalGanhosPeriodo);

  // Timeline comparação entre duas datas
  const compareTimeline = useMemo(() => {
    const hours = ["01:00","02:00","03:00","04:00","05:00","06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","23:45"];
    const d1Records = lossRecords.filter(r => r.data === compareDate1 && r.motivo_perda !== "ganho");
    const d2Records = lossRecords.filter(r => r.data === compareDate2 && r.motivo_perda !== "ganho");
    return hours.map(h => ({
      hora: h,
      [compareDate1]: d1Records.filter(r => r.hora === h).reduce((s, r) => s + (r.carros_perdidos || 0), 0),
      [compareDate2]: d2Records.filter(r => r.hora === h).reduce((s, r) => s + (r.carros_perdidos || 0), 0),
    })).filter(r => r[compareDate1] > 0 || r[compareDate2] > 0);
  }, [lossRecords, compareDate1, compareDate2]);

  const compareTotals = useMemo(() => {
    const d1 = lossRecords.filter(r => r.data === compareDate1 && r.motivo_perda !== "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
    const d2 = lossRecords.filter(r => r.data === compareDate2 && r.motivo_perda !== "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
    const g1 = lossRecords.filter(r => r.data === compareDate1 && r.motivo_perda === "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
    const g2 = lossRecords.filter(r => r.data === compareDate2 && r.motivo_perda === "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
    return { d1Perdas: d1, d2Perdas: d2, d1Ganhos: g1, d2Ganhos: g2, d1Real: Math.max(0, d1 - g1), d2Real: Math.max(0, d2 - g2) };
  }, [lossRecords, compareDate1, compareDate2]);

  // Resumo por hora do turno (tab resumo)
  const resumoByHora = useMemo(() => {
    return resumoTurnoObj.horas.map(h => ({
      hora: h,
      Produção: prodPorHora[h] || 0,
      Perdas: lossDay.filter(r => r.hora === h && r.motivo_perda !== "ganho").reduce((s, r) => s + (r.carros_perdidos||0), 0),
      Ganhos: lossDay.filter(r => r.hora === h && r.motivo_perda === "ganho").reduce((s, r) => s + (r.carros_perdidos||0), 0),
    })).map(r => ({ ...r, Líquida: Math.max(0, r.Produção - Math.max(0, r.Perdas - r.Ganhos)) }));
  }, [prodPorHora, lossDay, resumoTurnoObj]);

  const dateRangeLabel = `${format(fromDate, "dd/MM/yyyy")} – ${format(toDate, "dd/MM/yyyy")}`;

  // PDF Consolidado por Turno
  const handleExportResumoPDFConsolidado = async () => {
    setExportingTurno(true);
    try {
      const hora = new Date().toLocaleString("pt-BR");
      const dateLabel = format(parseISO(resumoDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      const turnoLabel = resumoTurnoObj.label;
      const chartImages = [];

      const efic = resumoTotalProd > 0
        ? Math.round(((resumoTotalProd - perdaReal) / resumoTotalProd) * 100)
        : 0;

      const prodHoraValues = resumoTurnoObj.horas.map(h => prodPorHora[h] || 0);
      const maxHoraVal = Math.max(...prodHoraValues, 1);
      const prodHoraRows = resumoTurnoObj.horas.map((h, idx) => {
        const val = prodHoraValues[idx];
        const pct = Math.round((val / maxHoraVal) * 100);
        return `<tr>
          <td><strong>${h}</strong></td>
          <td style="text-align:center">${val || "—"}</td>
          <td>
            <div style="background:#e2e8f0;border-radius:4px;height:8px;width:100%">
              <div style="background:#2563eb;height:8px;border-radius:4px;width:${val > 0 ? pct : 0}%"></div>
            </div>
          </td>
        </tr>`;
      }).join("");

      const testorRows = Object.entries(prodByTestor).map(([nome, total]) =>
        `<tr><td>${nome}</td><td style="text-align:center;font-weight:700">${total}</td></tr>`
      ).join("");

      const lossRows = lossRanking.map(([item, val], i) =>
        `<tr>
          <td><span style="background:${i===0?'#fee2e2':i<=2?'#fff7ed':'#eff6ff'};color:${i===0?'#991b1b':i<=2?'#9a3412':'#1e40af'};padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700">${i+1}°</span> ${item}</td>
          <td style="text-align:center;font-weight:700;color:${i===0?'#dc2626':i<=2?'#ea580c':'#3b82f6'}">${val}</td>
        </tr>`
      ).join("");

      const occRows = occFiltered.map(o =>
        `<tr>
          <td>${o.tipo?.replace(/_/g," ") || "—"}</td>
          <td>${o.testor || "—"}</td>
          <td><span style="background:${o.gravidade==='critica'?'#fee2e2':o.gravidade==='alta'?'#ffedd5':'#fef3c7'};color:${o.gravidade==='critica'?'#991b1b':o.gravidade==='alta'?'#9a3412':'#92400e'};padding:2px 7px;border-radius:999px;font-size:8px;font-weight:700">${o.gravidade?.toUpperCase() || "—"}</span></td>
          <td>${o.descricao || "—"}</td>
          <td><span style="background:${o.status==='resolvida'?'#d1fae5':'#dbeafe'};color:${o.status==='resolvida'?'#065f46':'#1e40af'};padding:2px 7px;border-radius:999px;font-size:8px;font-weight:700">${o.status?.replace(/_/g," ") || "aberta"}</span></td>
        </tr>`
      ).join("");

      const html = `<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="utf-8">
      <title>Resumo de Turno ZP7 — ${dateLabel}</title>
      <style>
        @page { size: A4; margin: 14mm 12mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; }

        .header {
          background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 60%, #1e1b4b 100%);
          color: white; padding: 20px 24px; border-radius: 12px;
          margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;
        }
        .header-left h1 { font-size: 20px; font-weight: 900; letter-spacing: 1px; margin-bottom: 4px; }
        .header-left .sub { font-size: 9px; opacity: 0.75; }
        .header-right { text-align: right; }
        .header-right .turno-badge {
          display: inline-block; background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
          padding: 6px 14px; font-size: 11px; font-weight: 700; margin-bottom: 4px;
        }
        .header-right .date { font-size: 9px; opacity: 0.7; }

        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
        .kpi {
          border-radius: 10px; padding: 14px 12px; text-align: center;
          border: 1px solid #e2e8f0; position: relative; overflow: hidden;
        }
        .kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .kpi-blue::before { background: #2563eb; }
        .kpi-red::before { background: #dc2626; }
        .kpi-green::before { background: #16a34a; }
        .kpi-orange::before { background: #ea580c; }
        .kpi-emerald::before { background: #059669; }
        .kpi-yellow::before { background: #d97706; }
        .kpi-blue { background: #eff6ff; }
        .kpi-red { background: #fef2f2; }
        .kpi-green { background: #f0fdf4; }
        .kpi-orange { background: #fff7ed; }
        .kpi-emerald { background: #ecfdf5; }
        .kpi-yellow { background: #fffbeb; }
        .kpi .val { font-size: 30px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
        .kpi-blue .val { color: #1d4ed8; }
        .kpi-red .val { color: #dc2626; }
        .kpi-green .val { color: #16a34a; }
        .kpi-orange .val { color: #ea580c; }
        .kpi-emerald .val { color: #059669; }
        .kpi-yellow .val { color: #d97706; }
        .kpi .lbl { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .kpi .sub-val { font-size: 9px; color: #94a3b8; margin-top: 2px; }

        .efic-bar-wrap { margin: 0 0 18px; }
        .efic-bar-wrap .efic-label { font-size: 10px; font-weight: 700; color: #1e40af; margin-bottom: 6px; display: flex; justify-content: space-between; }
        .efic-track { background: #e2e8f0; border-radius: 8px; height: 14px; overflow: hidden; }
        .efic-fill { height: 14px; border-radius: 8px; background: linear-gradient(90deg, #2563eb, #16a34a); display: flex; align-items: center; padding-left: 8px; }
        .efic-fill span { color: white; font-size: 9px; font-weight: 700; white-space: nowrap; }

        h2 {
          font-size: 12px; font-weight: 800; color: #1e3a8a;
          border-bottom: 2px solid #dbeafe; padding-bottom: 5px;
          margin: 18px 0 8px; display: flex; align-items: center; gap: 6px;
        }
        h2 .dot { width: 8px; height: 8px; border-radius: 50%; background: #2563eb; display: inline-block; }

        table { border-collapse: collapse; width: 100%; margin-bottom: 14px; border-radius: 8px; overflow: hidden; }
        th {
          background: linear-gradient(90deg, #1e40af, #1d4ed8);
          color: white; padding: 7px 10px; text-align: left;
          font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
        }
        td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 9px; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) td { background: #f8fafc; }
        tr:hover td { background: #f0f9ff; }

        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .section-box { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .section-box table { margin: 0; }

        .alert-row { display: flex; gap: 10px; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
        .alert-row:last-child { border-bottom: none; }
        .alert-badge { padding: 2px 8px; border-radius: 999px; font-size: 8px; font-weight: 700; white-space: nowrap; }
        .alert-content .title { font-size: 9px; font-weight: 600; }
        .alert-content .desc { font-size: 8.5px; color: #64748b; margin-top: 1px; }

        .no-data { text-align: center; color: #94a3b8; font-size: 9px; padding: 16px; }

        .footer {
          margin-top: 24px; font-size: 8px; color: #94a3b8;
          border-top: 1px solid #e2e8f0; padding-top: 10px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .footer .brand { font-weight: 700; color: #64748b; }
        .page-break { page-break-before: always; }
        .whatsapp-hint {
          background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
          padding: 8px 12px; margin-bottom: 16px;
          font-size: 9px; color: #166534; display: flex; gap: 8px; align-items: center;
        }
        .section-divider { border: none; border-top: 1px solid #f1f5f9; margin: 12px 0; }
        .charts-section { margin-top: 20px; }
        .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
        .chart-block { background: #0f172a; border-radius: 10px; padding: 10px; border: 1px solid #1e3a8a; }
        .chart-block img { width: 100%; border-radius: 6px; }
        .chart-block .chart-lbl { font-size: 9px; font-weight: 700; color: #93c5fd; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .hora-table td.prod { color: #1d4ed8; font-weight: 700; }
        .hora-table td.perda { color: #dc2626; font-weight: 700; }
        .hora-table td.ganho { color: #16a34a; font-weight: 700; }
        .hora-table td.liq { color: #059669; font-weight: 700; }
        .hora-table tr.total-row td { background: #eff6ff; font-weight: 900; border-top: 2px solid #bfdbfe; }
      </style></head><body>

      <!-- HEADER -->
      <div class="header">
        <div class="header-left">
          <h1>📋 Resumo de Turno — ZP7</h1>
          <div class="sub">Volkswagen Taubaté · Zona de Produção 7 · Gerado em ${hora}</div>
        </div>
        <div class="header-right">
          <div class="turno-badge">⏱ ${turnoLabel}</div>
          <div class="date">📅 ${dateLabel}</div>
        </div>
      </div>

      <!-- HINT envio -->
      <div class="whatsapp-hint">
        ✅ <span>Relatório pronto para envio via WhatsApp, e-mail ou impressão para o grupo do turno.</span>
      </div>

      <!-- KPIs PRINCIPAIS -->
      <div class="kpi-grid">
        <div class="kpi kpi-blue">
          <div class="val">${resumoTotalProd}</div>
          <div class="lbl">Produção Bruta</div>
          <div class="sub-val">carros no turno</div>
        </div>
        <div class="kpi kpi-red">
          <div class="val">${lossDayBruto}</div>
          <div class="lbl">Perdas Brutas</div>
          <div class="sub-val">carros perdidos</div>
        </div>
        <div class="kpi kpi-green">
          <div class="val">${lossDayGanho}</div>
          <div class="lbl">Carros Ganhos</div>
          <div class="sub-val">recuperados</div>
        </div>
        <div class="kpi kpi-orange">
          <div class="val">${perdaReal}</div>
          <div class="lbl">Perda Real</div>
          <div class="sub-val">bruto − ganhos</div>
        </div>
        <div class="kpi kpi-emerald">
          <div class="val">${producaoLiquida}</div>
          <div class="lbl">Produção Líquida</div>
          <div class="sub-val">bruto − perda real</div>
        </div>
        <div class="kpi kpi-yellow">
          <div class="val">${occFiltered.length}</div>
          <div class="lbl">Ocorrências</div>
          <div class="sub-val">registradas</div>
        </div>
      </div>

      <!-- BARRA DE EFICIÊNCIA -->
      <div class="efic-bar-wrap">
        <div class="efic-label">
          <span>📊 Eficiência do Turno</span>
          <span style="color:#059669;font-size:12px">${efic}%</span>
        </div>
        <div class="efic-track">
          <div class="efic-fill" style="width:${efic}%">
            <span>${efic}% de eficiência</span>
          </div>
        </div>
      </div>

      <!-- PRODUÇÃO POR HORA e TESTOR -->
      <div class="two-col">
        <div>
          <h2><span class="dot"></span> Produção por Hora</h2>
          <div class="section-box">
            <table>
              <thead><tr><th>Hora</th><th style="text-align:center">Carros</th><th>Barra</th></tr></thead>
              <tbody>${prodHoraRows || '<tr><td colspan="3" class="no-data">Sem dados</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div>
          <h2><span class="dot"></span> Produção por Testor</h2>
          <div class="section-box">
            ${testorRows
              ? `<table><thead><tr><th>Testor</th><th style="text-align:center">Total</th></tr></thead><tbody>${testorRows}</tbody></table>`
              : `<div class="no-data">Sem dados de testor</div>`
            }
          </div>
        </div>
      </div>

      <!-- RANKING DE PERDAS -->
      ${lossRows ? `
      <h2><span class="dot" style="background:#dc2626"></span> Ranking de Perdas do Turno</h2>
      <div class="section-box">
        <table>
          <thead><tr><th>#</th><th>Item de Perda</th><th style="text-align:center">Carros Perdidos</th></tr></thead>
          <tbody>
            ${lossRanking.map(([item, val], i) => `
              <tr>
                <td>${i+1}°</td>
                <td>${item}</td>
                <td style="text-align:center;font-weight:700;color:${i===0?'#dc2626':i<=2?'#ea580c':'#3b82f6'}">${val}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

      <!-- OCORRÊNCIAS -->
      ${occFiltered.length > 0 ? `
      <h2><span class="dot" style="background:#f59e0b"></span> Ocorrências do Turno</h2>
      <div class="section-box">
        <table>
          <thead>
            <tr><th>Tipo</th><th>Testor</th><th>Gravidade</th><th>Descrição</th><th>Status</th></tr>
          </thead>
          <tbody>${occRows}</tbody>
        </table>
      </div>` : `
      <h2><span class="dot" style="background:#16a34a"></span> Ocorrências do Turno</h2>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;color:#166534;font-size:9px;font-weight:700">
        ✅ Nenhuma ocorrência registrada neste turno!
      </div>`}

      <!-- PRODUÇÃO & PERDAS POR TURNO -->
      <h2><span class="dot" style="background:#0284c7"></span> Comparativo por Turno — ${dateLabel}</h2>
      <div class="section-box" style="margin-bottom:14px">
        <table>
          <thead><tr>
            <th>Turno</th>
            <th style="text-align:center;color:#93c5fd">Produção</th>
            <th style="text-align:center;color:#fca5a5">Perdas</th>
            <th style="text-align:center;color:#86efac">Ganhos</th>
            <th style="text-align:center;color:#fdba74">Perda Real</th>
            <th style="text-align:center;color:#6ee7b7">Líquida</th>
            <th style="text-align:center;color:#c4b5fd">Eficiência</th>
          </tr></thead>
          <tbody>
            ${["primeiro","segundo","terceiro"].map(tKey => {
              const tLabel = { primeiro:"1º Turno", segundo:"2º Turno", terceiro:"3º Turno" }[tKey];
              const tProd = prodCtrlAll.filter(r => r.turno === tKey && r.data === resumoDate).reduce((s,r) => s+(r.carros_produzidos||0),0);
              const tPerdBruto = lossRecords.filter(r => r.turno === tKey && r.data === resumoDate && r.motivo_perda !== "ganho").reduce((s,r) => s+(r.carros_perdidos||0),0);
              const tGanho = lossRecords.filter(r => r.turno === tKey && r.data === resumoDate && r.motivo_perda === "ganho").reduce((s,r) => s+(r.carros_perdidos||0),0);
              const tPerdReal = Math.max(0, tPerdBruto - tGanho);
              const tLiq = Math.max(0, tProd - tPerdReal);
              const tEfic = tProd > 0 ? Math.round((tLiq/tProd)*100) : null;
              const isActive = tKey === resumoTurno;
              return `<tr style="${isActive?"font-weight:900;background:#eff6ff":""}">
                <td><strong>${tLabel}</strong>${isActive?' <span style="background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:999px;font-size:8px;font-weight:700">ESTE TURNO</span>':''}</td>
                <td style="text-align:center;color:#1d4ed8;font-weight:700">${tProd || "—"}</td>
                <td style="text-align:center;color:#dc2626;font-weight:700">${tPerdBruto > 0 ? tPerdBruto : "—"}</td>
                <td style="text-align:center;color:#16a34a;font-weight:700">${tGanho > 0 ? tGanho : "—"}</td>
                <td style="text-align:center;color:#ea580c;font-weight:700">${tPerdReal > 0 ? tPerdReal : "—"}</td>
                <td style="text-align:center;color:#059669;font-weight:700">${tLiq > 0 ? tLiq : "—"}</td>
                <td style="text-align:center;font-weight:900;color:${tEfic === null ? '#94a3b8' : tEfic >= 80 ? '#16a34a' : tEfic >= 60 ? '#d97706' : '#dc2626'}">${tEfic !== null ? tEfic+'%' : "—"}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <!-- TABELA CONSOLIDADA POR HORA -->
      <h2><span class="dot" style="background:#7c3aed"></span> Consolidado por Hora</h2>
      <div class="section-box">
        <table class="hora-table">
          <thead><tr>
            <th>Hora</th>
            <th style="text-align:center;color:#93c5fd">Produção</th>
            <th style="text-align:center;color:#fca5a5">Perdas</th>
            <th style="text-align:center;color:#86efac">Ganhos</th>
            <th style="text-align:center;color:#fdba74">Perda Real</th>
            <th style="text-align:center;color:#6ee7b7">Líquida</th>
          </tr></thead>
          <tbody>
            ${resumoByHora.map(r => {
              const pr = Math.max(0, r.Perdas - r.Ganhos);
              return `<tr>
                <td><strong>${r.hora}</strong></td>
                <td class="prod" style="text-align:center">${r.Produção || "—"}</td>
                <td class="perda" style="text-align:center">${r.Perdas > 0 ? r.Perdas : "—"}</td>
                <td class="ganho" style="text-align:center">${r.Ganhos > 0 ? r.Ganhos : "—"}</td>
                <td style="text-align:center;color:#ea580c;font-weight:700">${pr > 0 ? pr : "—"}</td>
                <td class="liq" style="text-align:center">${r.Líquida > 0 ? r.Líquida : "—"}</td>
              </tr>`;
            }).join("")}
            <tr class="total-row">
              <td>TOTAL</td>
              <td class="prod" style="text-align:center">${resumoTotalProd}</td>
              <td class="perda" style="text-align:center">${lossDayBruto}</td>
              <td class="ganho" style="text-align:center">${lossDayGanho}</td>
              <td style="text-align:center;color:#ea580c;font-weight:900">${perdaReal}</td>
              <td class="liq" style="text-align:center">${producaoLiquida}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- GRÁFICOS CAPTURADOS -->
      ${chartImages.length > 0 ? `
      <div class="charts-section">
        <h2><span class="dot" style="background:#2563eb"></span> Gráficos do Turno</h2>
        <div class="charts-grid">
          ${chartImages.map(img => `
            <div class="chart-block">
              ${img.title ? `<div class="chart-lbl">${img.title}</div>` : ""}
              <img src="${img.src}" />
            </div>`).join("")}
        </div>
      </div>` : ""}

      <!-- FOOTER -->
      <div class="footer">
        <div>
          <span class="brand">ZP7 — Volkswagen Taubaté</span>
          <span style="margin-left:12px">Resumo de Turno gerado automaticamente pelo sistema.</span>
        </div>
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
      setExportingTurno(false);
    }
  };

  // Export PDF geral
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const chartImages = [];
      const hora = new Date().toLocaleString("pt-BR");
      const turnoLabel = TURNO_LABELS[turno];
      const testoresRows = filteredTestores.map(t => `
        <tr>
          <td>${t.nome}</td>
          <td><span class="badge ${t.status === 'rodando' ? 'badge-green' : t.status === 'parado' ? 'badge-red' : 'badge-yellow'}">${t.status}</span></td>
          <td>${t.carros_testados_turno || 0}</td>
          <td>${t.falhas_turno || 0}</td>
          <td>${t.tempo_total_parado || 0}min</td>
          <td><span class="badge ${(t.risco_score||0)<=30?'badge-green':(t.risco_score||0)<=60?'badge-yellow':'badge-red'}">${t.risco_score||0}%</span></td>
        </tr>`).join("");
      const prodRows = prodLineData.slice(-20).map(p => {
        return `<tr><td>${p.label||"—"}</td><td style="text-align:center;font-weight:700;color:#1d4ed8">${p.Produção||0}</td></tr>`;
      }).join("");
      const lossRows2 = lossItemRanking.map(r => `<tr><td>${r.name}</td><td>${r.Perdas}</td></tr>`).join("");
      const chartImagesHtml = chartImages.map(img => `<div class="chart-block">${img.title?`<p class="chart-label">${img.title}</p>`:""}<img src="${img.src}" style="width:100%;border-radius:8px;"/></div>`).join("");

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Analítico ZP7</title>
      <style>
        @page { size: A4; margin: 12mm 12mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5px; color: #1e293b; background: #fff; }

        .header {
          background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 60%, #312e81 100%);
          color: white; padding: 18px 22px; border-radius: 12px; margin-bottom: 16px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .header h1 { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 4px; }
        .header .meta { font-size: 8.5px; opacity: 0.75; }
        .header-badge { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 14px; text-align: center; }
        .header-badge .turno { font-size: 11px; font-weight: 800; }
        .header-badge .periodo { font-size: 8px; opacity: 0.7; margin-top: 2px; }

        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .kpi { border-radius: 10px; padding: 12px 14px; border: 1px solid #e2e8f0; text-align: center; position: relative; overflow: hidden; }
        .kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .kpi-blue { background: #eff6ff; } .kpi-blue::before { background: #2563eb; } .kpi-blue .val { color: #1d4ed8; }
        .kpi-red { background: #fef2f2; } .kpi-red::before { background: #dc2626; } .kpi-red .val { color: #dc2626; }
        .kpi-green { background: #f0fdf4; } .kpi-green::before { background: #16a34a; } .kpi-green .val { color: #16a34a; }
        .kpi-orange { background: #fff7ed; } .kpi-orange::before { background: #ea580c; } .kpi-orange .val { color: #ea580c; }
        .kpi-purple { background: #faf5ff; } .kpi-purple::before { background: #7c3aed; } .kpi-purple .val { color: #7c3aed; }
        .kpi-yellow { background: #fffbeb; } .kpi-yellow::before { background: #d97706; } .kpi-yellow .val { color: #d97706; }
        .kpi .val { font-size: 28px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
        .kpi .lbl { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }

        .efic-bar { margin: 0 0 16px; padding: 12px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; }
        .efic-label { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: #0369a1; margin-bottom: 6px; }
        .efic-track { background: #e0f2fe; border-radius: 8px; height: 12px; overflow: hidden; }
        .efic-fill { height: 12px; border-radius: 8px; background: linear-gradient(90deg, #2563eb, #16a34a); }

        h2 { font-size: 12px; font-weight: 800; color: #1e3a8a; border-bottom: 2px solid #dbeafe; padding-bottom: 5px; margin: 16px 0 8px; display: flex; align-items: center; gap: 5px; }
        h2 .dot { width: 7px; height: 7px; border-radius: 50%; background: #3b82f6; display: inline-block; flex-shrink: 0; }

        table { border-collapse: collapse; width: 100%; margin-bottom: 14px; border-radius: 8px; overflow: hidden; }
        thead th { background: linear-gradient(90deg, #1e40af, #2563eb); color: white; padding: 6px 8px; text-align: left; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 8.5px; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) td { background: #f8fafc; }

        .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 7.5px; font-weight: 700; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-yellow { background: #fef3c7; color: #92400e; }
        .positive { color: #16a34a; font-weight: 700; }
        .negative { color: #dc2626; font-weight: 700; }

        .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 10px; }
        .chart-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
        .chart-label { font-size: 9px; font-weight: 700; color: #1e40af; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }

        .footer { margin-top: 20px; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; }
        .footer-brand { font-weight: 700; color: #64748b; }
        .page-break { page-break-before: always; }
      </style></head><body>

      <div class="header">
        <div>
          <h1>📊 Relatório Analítico — ZP7</h1>
          <div class="meta">Volkswagen Taubaté · Período: ${dateRangeLabel} · Gerado em: ${hora}</div>
        </div>
        <div class="header-badge">
          <div class="turno">⚙️ ${turnoLabel}</div>
          <div class="periodo">${dateRangeLabel}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi kpi-blue"><div class="val">${totalCarros}</div><div class="lbl">Produção Bruta</div></div>
        <div class="kpi kpi-red"><div class="val">${totalPerdasCtrl}</div><div class="lbl">Perdas Brutas</div></div>
        <div class="kpi kpi-green"><div class="val">${totalGanhosCtrl}</div><div class="lbl">Carros Ganhos</div></div>
        <div class="kpi kpi-purple"><div class="val">${eficiencia}%</div><div class="lbl">Eficiência Geral</div></div>
        <div class="kpi kpi-orange"><div class="val">${totalPerdaRealCtrl}</div><div class="lbl">Perda Real</div></div>
        <div class="kpi kpi-yellow"><div class="val">${Math.max(0, totalCarros - totalPerdaRealCtrl)}</div><div class="lbl">Produção Líquida</div></div>
      </div>

      <div class="efic-bar">
        <div class="efic-label"><span>📈 Eficiência Geral da Linha</span><span>${eficiencia}%</span></div>
        <div class="efic-track"><div class="efic-fill" style="width:${eficiencia}%"></div></div>
      </div>

      ${testoresRows?`<h2><span class="dot"></span> Testores</h2><table><thead><tr><th>Testor</th><th>Status</th><th style="text-align:center">Carros</th><th style="text-align:center">Falhas</th><th style="text-align:center">T.Parado</th><th style="text-align:center">Risco</th></tr></thead><tbody>${testoresRows}</tbody></table>`:""}
      ${prodRows?`<h2><span class="dot" style="background:#16a34a"></span> Produção Diária</h2><table><thead><tr><th>Data</th><th style="text-align:center">Carros Produzidos</th></tr></thead><tbody>${prodRows}</tbody></table>`:""}
      ${lossRows2?`<h2><span class="dot" style="background:#dc2626"></span> Top 10 Perdas do Período</h2><table><thead><tr><th>Item de Perda</th><th style="text-align:center">Carros Perdidos</th></tr></thead><tbody>${lossRows2}</tbody></table>`:""}
      ${chartImages.length>0?`<div class="page-break"></div><h2><span class="dot" style="background:#7c3aed"></span> Gráficos Analíticos</h2><div class="charts-grid">${chartImagesHtml}</div>`:""}

      <div class="footer">
        <span class="footer-brand">ZP7 — Volkswagen Taubaté</span>
        <span>Relatório gerado automaticamente pelo sistema de controle.</span>
        <span>${hora}</span>
      </div>
      <script>window.onload=function(){window.print();}<\/script>
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

  return (
    <div className="space-y-4 pb-24 lg:pb-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary shrink-0" />
            Relatórios & Gráficos
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tab === "resumo"
              ? `${format(parseISO(resumoDate), "dd/MM/yyyy")} · ${resumoTurnoObj.label}`
              : `${dateRangeLabel} · ${TURNO_LABELS[turno]}`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {tab !== "resumo" && (
            <Button size="sm" variant="outline" onClick={() => setShowDateFilter(v => !v)}
              className={`gap-1.5 h-9 ${showDateFilter ? "text-primary border-primary/50" : "text-muted-foreground"}`}>
              <Filter className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Datas</span>
            </Button>
          )}
          {tab === "resumo" && (
            <Button size="sm" variant="outline"
              onClick={handleExportResumoPDFConsolidado}
              disabled={exportingTurno}
              className="gap-1.5 h-9 text-green-400 border-green-500/30 hover:text-green-300 hover:bg-green-500/10">
              {exportingTurno
                ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> <span className="hidden sm:inline">Gerando...</span></>
                : <><Send className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Resumo Turno</span></>
              }
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleExportPDF}
            disabled={exporting}
            className="gap-1.5 h-9 text-muted-foreground hover:text-foreground">
            {exporting
              ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> <span className="hidden sm:inline">Gerando...</span></>
              : <><Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">PDF</span></>
            }
          </Button>
        </div>
      </div>

      {/* Turno filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(TURNO_LABELS).map(([k, label]) => (
          <button key={k}
            onClick={() => setTurno(k)}
            className={`px-3 py-2 sm:py-1.5 rounded-full text-xs font-semibold transition-all border min-h-[34px] ${
              turno === k
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Date range filter */}
      {showDateFilter && tab !== "resumo" && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground">De:</span>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" />
          <span className="text-xs text-muted-foreground">Até:</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36 text-xs" />
          <div className="flex gap-1.5">
            <button
              onClick={() => { setDateFrom(yesterday); setDateTo(yesterday); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${dateFrom === yesterday && dateTo === yesterday ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>
              Ontem
            </button>
            <button
              onClick={() => { setDateFrom(format(new Date(), "yyyy-MM-dd")); setDateTo(format(new Date(), "yyyy-MM-dd")); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${dateFrom === format(new Date(), "yyyy-MM-dd") && dateTo === format(new Date(), "yyyy-MM-dd") ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>
              Hoje
            </button>
            <button
              onClick={() => { setDateFrom(format(subDays(new Date(), 6), "yyyy-MM-dd")); setDateTo(format(new Date(), "yyyy-MM-dd")); }}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all border bg-muted/40 text-muted-foreground border-border hover:text-foreground">
              7 dias
            </button>
            <button
              onClick={() => { setDateFrom(format(subDays(new Date(), 29), "yyyy-MM-dd")); setDateTo(format(new Date(), "yyyy-MM-dd")); }}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all border bg-muted/40 text-muted-foreground border-border hover:text-foreground">
              30 dias
            </button>
          </div>
          <Badge variant="outline" className="ml-auto text-primary border-primary/30 text-xs">{dateRangeLabel}</Badge>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 bg-muted/30 border border-border rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-1 justify-center min-h-[40px] ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Global KPI Cards — apenas visíveis nas abas que não são Resumo */}
      {tab !== "resumo" && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="col-span-2 lg:col-span-4">
          <p className="text-[10px] text-muted-foreground">📅 Período: {dateRangeLabel} · {TURNO_LABELS[turno]}</p>
        </div>
        {[
          { label: "Produção Bruta", value: totalCarros, icon: Car, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
          { label: "Perdas Brutas", value: totalPerdasCtrl, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
          { label: "Perda Real", value: totalPerdaRealCtrl, icon: TrendingDown, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
          { label: "Eficiência", value: `${eficiencia}%`, icon: TrendingUp,
            color: eficiencia >= 80 ? "text-green-400" : "text-red-400",
            bg: eficiencia >= 80 ? "bg-green-500/10" : "bg-red-500/10",
            border: eficiencia >= 80 ? "border-green-500/20" : "border-red-500/20" },
        ].map(kpi => (
          <Card key={kpi.label} className={`border ${kpi.border}`}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xl sm:text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {/* ═══ TAB: RESUMO DIÁRIO ═══ */}
      {tab === "resumo" && (
        <div className="space-y-4">
          {loadingProdRecords && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Carregando dados do turno…
            </div>
          )}
          {/* Date & Turno selector */}
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="date" value={resumoDate} onChange={e => setResumoDate(e.target.value)} className="h-9 w-36 text-sm" />
            <button
              onClick={() => setResumoDate(yesterday)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${resumoDate === yesterday ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>
              Ontem
            </button>
            <button
              onClick={() => setResumoDate(format(new Date(), "yyyy-MM-dd"))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${resumoDate === format(new Date(), "yyyy-MM-dd") ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>
              Hoje
            </button>
            <div className="flex gap-0.5 bg-muted/40 border border-border rounded-lg p-0.5 overflow-x-auto">
              {RESUMO_TURNOS.map(t => (
                <button key={t.key} onClick={() => setResumoTurno(t.key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                    resumoTurno === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {t.label.split(" ")[0]} {t.label.split(" ")[1]}
                </button>
              ))}
            </div>
          </div>

          {/* KPI mini cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Produção Bruta", value: resumoTotalProd, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { label: "Perdas Brutas",  value: lossDayBruto,   color: "text-red-400",  bg: "bg-red-500/10",  border: "border-red-500/20" },
              { label: "Carros Ganhos",  value: lossDayGanho,   color: "text-green-400",bg: "bg-green-500/10",border: "border-green-500/20" },
              { label: "Perda Real",     value: perdaReal,      color: "text-orange-400",bg: "bg-orange-500/10",border:"border-orange-500/20" },
              { label: "Prod. Líquida",  value: producaoLiquida,color: "text-emerald-400",bg:"bg-emerald-500/10",border:"border-emerald-500/20" },
              { label: "Ocorrências",    value: occFiltered.length, color: "text-yellow-400",bg:"bg-yellow-500/10",border:"border-yellow-500/20" },
            ].map(k => (
              <Card key={k.label} className={`border ${k.border}`}>
                <CardContent className="p-3 text-center">
                  <p className={`text-3xl sm:text-4xl font-black ${k.color}`}>{k.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{k.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Gráfico comparativo por turno */}
          <ShiftProductionChart prodData={prodCtrlAll.length > 0 ? prodCtrlAll : prodRecords} date={resumoDate} />

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" /> Produção por Hora
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resumoTotalProd > 0 ? (
                  <div data-chart data-title="Produção por Hora">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={resumoTurnoObj.horas.map(h => ({ hora: h, Carros: prodPorHora[h] || 0 }))}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="hora" tick={{ ...axisStyle, fontSize: 9 }} />
                        <YAxis tick={axisStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="Carros" fill="hsl(217,91%,60%)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-10">Sem dados de produção.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" /> Produção por Testor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(prodByTestor).length > 0 ? (
                  <div data-chart data-title="Produção por Testor">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={Object.entries(prodByTestor).map(([nome, total]) => ({ nome: nome.replace("Testor ","T"), total }))}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="nome" tick={axisStyle} />
                        <YAxis tick={axisStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="total" name="Carros" fill="hsl(142,71%,45%)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-10">Sem dados de testor.</p>}
              </CardContent>
            </Card>
          </div>

          {/* Tabela consolidada por hora */}
          {(resumoTotalProd > 0 || lossDayBruto > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Consolidado por Hora
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Hora</th>
                        <th className="text-center px-3 py-2 font-semibold text-blue-400">Produção</th>
                        <th className="text-center px-3 py-2 font-semibold text-red-400">Perdas</th>
                        <th className="text-center px-3 py-2 font-semibold text-green-400">Ganhos</th>
                        <th className="text-center px-3 py-2 font-semibold text-orange-400">Perda Real</th>
                        <th className="text-center px-3 py-2 font-semibold text-emerald-400">Líquida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumoByHora.map((r, i) => {
                        const perdaRealH = Math.max(0, r.Perdas - r.Ganhos);
                        return (
                          <tr key={r.hora} className={i % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                            <td className="px-3 py-2 font-semibold">{r.hora}</td>
                            <td className="px-3 py-2 text-center text-blue-400 font-bold">{r.Produção || "—"}</td>
                            <td className="px-3 py-2 text-center text-red-400 font-bold">{r.Perdas > 0 ? r.Perdas : "—"}</td>
                            <td className="px-3 py-2 text-center text-green-400 font-bold">{r.Ganhos > 0 ? r.Ganhos : "—"}</td>
                            <td className="px-3 py-2 text-center text-orange-400 font-bold">{perdaRealH > 0 ? perdaRealH : "—"}</td>
                            <td className="px-3 py-2 text-center text-emerald-400 font-bold">{r.Líquida > 0 ? r.Líquida : "—"}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-primary/10 border-t border-border font-black">
                        <td className="px-3 py-2 text-foreground font-black">TOTAL</td>
                        <td className="px-3 py-2 text-center text-blue-400">{resumoTotalProd}</td>
                        <td className="px-3 py-2 text-center text-red-400">{lossDayBruto}</td>
                        <td className="px-3 py-2 text-center text-green-400">{lossDayGanho}</td>
                        <td className="px-3 py-2 text-center text-orange-400">{perdaReal}</td>
                        <td className="px-3 py-2 text-center text-emerald-400">{producaoLiquida}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {lossRanking.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" /> Ranking de Perdas do Dia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lossRanking.map(([item, val], i) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className={`text-xs font-black w-5 text-center shrink-0 ${i === 0 ? "text-red-400" : i <= 2 ? "text-orange-400" : "text-muted-foreground"}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-medium truncate">{item}</span>
                          <span className="text-xs font-bold text-red-400 ml-2 shrink-0">{val}</span>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> Ocorrências do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {occFiltered.length > 0 ? (
                <div className="space-y-2">
                  {occFiltered.map(o => (
                    <div key={o.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        o.gravidade === "critica" ? "bg-red-500/20 text-red-400" :
                        o.gravidade === "alta" ? "bg-orange-500/20 text-orange-400" :
                        "bg-yellow-500/20 text-yellow-400"
                      }`}>{o.gravidade?.toUpperCase() || "—"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{o.tipo?.replace(/_/g," ")} {o.testor ? `· ${o.testor}` : ""}</p>
                        {o.descricao && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{o.descricao}</p>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        o.status === "resolvida" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                      }`}>{o.status?.replace(/_/g," ")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma ocorrência neste turno/dia.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ TAB: PRODUÇÃO ═══ */}
      {tab === "producao" && (
        <div className="space-y-4">
          {loadingProdAll && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Carregando dados de produção…
            </div>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Produção Diária
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prodLineData.length > 0 ? (
                <div data-chart data-title="Produção Diária">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={prodLineData}>
                      <defs>
                        <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="label" tick={axisStyle} />
                      <YAxis tick={axisStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="Produção" stroke="hsl(217,91%,60%)" fill="url(#gradReal)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-12">Sem dados no período.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Tarefas</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Abertas", value: tasksOpen, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                    { label: "Concluídas", value: tasksDone, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
                    { label: "Atrasadas", value: tasksLate, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                  ].map(i => (
                    <div key={i.label} className={`p-3 rounded-lg border ${i.bg}`}>
                      <p className={`text-2xl font-bold ${i.color}`}>{i.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{i.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Ocorrências por Tipo</CardTitle></CardHeader>
              <CardContent>
                {occPieData.length > 0 ? (
                  <div data-chart data-title="Ocorrências por Tipo">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={occPieData} cx="50%" cy="50%" outerRadius={70} innerRadius={30} dataKey="value"
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                          {occPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-8">Sem ocorrências.</p>}
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
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" /> Carros por Testor</CardTitle></CardHeader>
              <CardContent>
                {testorBarData.length > 0 ? (
                  <div data-chart data-title="Carros Testados por Testor">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={testorBarData} barGap={4}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="name" tick={axisStyle} />
                        <YAxis tick={axisStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Carros" fill="hsl(217,91%,60%)" radius={[4,4,0,0]} />
                        <Bar dataKey="Falhas" fill="hsl(0,72%,51%)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-12">Sem dados.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-400" /> Ranking de Falhas</CardTitle></CardHeader>
              <CardContent>
                {falhasRankData.length > 0 ? (
                  <div data-chart data-title="Ranking de Falhas por Testor">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={falhasRankData} layout="vertical" barGap={4}>
                        <CartesianGrid {...gridStyle} horizontal={false} />
                        <XAxis type="number" tick={axisStyle} />
                        <YAxis type="category" dataKey="name" tick={axisStyle} width={36} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Falhas" fill="hsl(38,92%,50%)" radius={[0,4,4,0]} />
                        <Bar dataKey="Paradas" fill="hsl(0,72%,51%)" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-12">Sem dados.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Performance Radar</CardTitle></CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <div data-chart data-title="Performance Radar dos Testores">
                    <ResponsiveContainer width="100%" height={240}>
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
                ) : <p className="text-xs text-muted-foreground text-center py-12">Sem dados.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Score de Risco</CardTitle></CardHeader>
              <CardContent>
                {filteredTestores.length > 0 ? (
                  <div data-chart data-title="Score de Risco por Testor">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={filteredTestores.map(t => ({ name: t.nome?.replace("Testor ","T"), Risco: t.risco_score || 0 }))}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="name" tick={axisStyle} />
                        <YAxis domain={[0, 100]} tick={axisStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="Risco" radius={[4,4,0,0]}>
                          {filteredTestores.map((t, i) => (
                            <Cell key={i} fill={
                              (t.risco_score||0) <= 30 ? "hsl(142,71%,45%)"
                              : (t.risco_score||0) <= 60 ? "hsl(38,92%,50%)"
                              : "hsl(0,72%,51%)"
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-8">Sem dados.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ TAB: CONTROLE DE PERDAS ═══ */}
      {tab === "perdas" && (
        <div className="space-y-4">

          {/* KPIs período */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="border-red-500/20">
              <CardContent className="p-3 text-center">
                <p className="text-xl sm:text-3xl font-black text-red-400">{totalPerdasPeriodo}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Perdas Brutas</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/20">
              <CardContent className="p-3 text-center">
                <p className="text-xl sm:text-3xl font-black text-green-400">{totalGanhosPeriodo}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Carros Ganhos</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20">
              <CardContent className="p-3 text-center">
                <p className="text-xl sm:text-3xl font-black text-orange-400">{perdaRealPeriodo}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Perda Real</p>
              </CardContent>
            </Card>
          </div>

          {/* Evolução diária */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" /> Evolução de Perdas — {dateRangeLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {lossByDay.some(d => d.Perdas > 0) ? (
                <div data-chart data-title="Evolução Diária de Perdas">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={lossByDay}>
                      <defs>
                        <linearGradient id="gradLoss" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0,72%,51%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={axisStyle} width={28} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="Perdas" stroke="hsl(0,72%,51%)" fill="url(#gradLoss)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(0,72%,51%)" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-xs text-muted-foreground text-center py-12">Nenhuma perda no período.</p>}
            </CardContent>
          </Card>

          {/* ── TIMELINE DE COMPARAÇÃO ── */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary" /> Comparar Datas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seletores */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Data A</p>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Input type="date" value={compareDate1} onChange={e => setCompareDate1(e.target.value)} className="h-9 flex-1 min-w-[130px] text-xs border-red-500/30 focus:border-red-500" />
                    <button onClick={() => setCompareDate1(yesterday)} className="px-2.5 py-1 text-[10px] rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-semibold hover:bg-red-500/20">Ontem</button>
                  </div>
                </div>
                <div className="hidden sm:flex items-end pb-1"><span className="text-muted-foreground text-sm font-bold">vs</span></div>
                <div className="flex-1 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Data B</p>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Input type="date" value={compareDate2} onChange={e => setCompareDate2(e.target.value)} className="h-9 flex-1 min-w-[130px] text-xs border-blue-500/30 focus:border-blue-500" />
                    <button onClick={() => setCompareDate2(format(new Date(), "yyyy-MM-dd"))} className="px-2.5 py-1 text-[10px] rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold hover:bg-blue-500/20">Hoje</button>
                  </div>
                </div>
              </div>

              {/* Cards de totais de cada data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
                    {format(parseISO(compareDate1), "dd/MM/yyyy")}
                  </p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div><p className="text-lg font-black text-red-400">{compareTotals.d1Perdas}</p><p className="text-[9px] text-muted-foreground">Perdas</p></div>
                    <div><p className="text-lg font-black text-green-400">{compareTotals.d1Ganhos}</p><p className="text-[9px] text-muted-foreground">Ganhos</p></div>
                    <div><p className="text-lg font-black text-orange-400">{compareTotals.d1Real}</p><p className="text-[9px] text-muted-foreground">Real</p></div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">
                    {format(parseISO(compareDate2), "dd/MM/yyyy")}
                  </p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div><p className="text-lg font-black text-red-400">{compareTotals.d2Perdas}</p><p className="text-[9px] text-muted-foreground">Perdas</p></div>
                    <div><p className="text-lg font-black text-green-400">{compareTotals.d2Ganhos}</p><p className="text-[9px] text-muted-foreground">Ganhos</p></div>
                    <div><p className="text-lg font-black text-orange-400">{compareTotals.d2Real}</p><p className="text-[9px] text-muted-foreground">Real</p></div>
                  </div>
                </div>
              </div>

              {/* Gráfico de linha do tempo comparativo */}
              {compareTimeline.length > 0 ? (
                <div data-chart data-title="Comparação de Perdas por Hora">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={compareTimeline} barGap={2}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="hora" tick={{ ...axisStyle, fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={40} />
                      <YAxis tick={axisStyle} width={28} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(val, name) => [val, name === compareDate1 ? `Data A (${format(parseISO(compareDate1),"dd/MM")})` : `Data B (${format(parseISO(compareDate2),"dd/MM")})`]}
                      />
                      <Legend
                        formatter={(val) => val === compareDate1 ? `Data A — ${format(parseISO(compareDate1),"dd/MM/yyyy")}` : `Data B — ${format(parseISO(compareDate2),"dd/MM/yyyy")}`}
                        wrapperStyle={{ fontSize: 10 }}
                      />
                      <Bar dataKey={compareDate1} fill="hsl(0,72%,51%)" radius={[3,3,0,0]} />
                      <Bar dataKey={compareDate2} fill="hsl(217,91%,60%)" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Sem perdas registradas nas datas selecionadas.</p>
              )}

              {/* Diferença por hora (tabela) */}
              {compareTimeline.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Hora</th>
                        <th className="text-center px-2 py-2 font-semibold text-red-400">Data A</th>
                        <th className="text-center px-2 py-2 font-semibold text-blue-400">Data B</th>
                        <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Δ Dif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareTimeline.map((r, i) => {
                        const diff = (r[compareDate2] || 0) - (r[compareDate1] || 0);
                        return (
                          <tr key={r.hora} className={i % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                            <td className="px-3 py-2 font-semibold">{r.hora}</td>
                            <td className="px-2 py-2 text-center text-red-400 font-bold">{r[compareDate1] || "—"}</td>
                            <td className="px-2 py-2 text-center text-blue-400 font-bold">{r[compareDate2] || "—"}</td>
                            <td className={`px-2 py-2 text-center font-bold ${diff < 0 ? "text-green-400" : diff > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                              {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 10 + Distribuições */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-400" /> Top 10 Perdas</CardTitle></CardHeader>
              <CardContent className="px-2 sm:px-6">
                {lossItemRanking.length > 0 ? (
                  <div data-chart data-title="Top 10 Itens de Perda">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={lossItemRanking} layout="vertical">
                        <CartesianGrid {...gridStyle} horizontal={false} />
                        <XAxis type="number" tick={axisStyle} />
                        <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 9 }} width={90} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="Perdas" radius={[0,4,4,0]}>
                          {lossItemRanking.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? "hsl(0,72%,51%)" : i <= 2 ? "hsl(38,92%,50%)" : "hsl(217,91%,60%)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-12">Sem dados.</p>}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Perdas por Turno</CardTitle></CardHeader>
                <CardContent>
                  {lossByTurno.length > 0 ? (
                    <div data-chart data-title="Perdas por Turno">
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={lossByTurno} cx="50%" cy="50%" outerRadius={55} innerRadius={22} dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}>
                            {lossByTurno.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-xs text-muted-foreground text-center py-8">Sem dados.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Perdas por Hora</CardTitle></CardHeader>
                <CardContent>
                  {lossByHour.length > 0 ? (
                    <div data-chart data-title="Perdas por Hora do Dia">
                      <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={lossByHour}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="hora" tick={{ ...axisStyle, fontSize: 9 }} />
                          <YAxis tick={axisStyle} width={28} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="Perdas" fill="hsl(280,65%,60%)" radius={[3,3,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-xs text-muted-foreground text-center py-8">Sem dados.</p>}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Ganhos por item */}
          {ganhoItemRanking.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" /> Carros Ganhos por Item — {dateRangeLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ganhoItemRanking.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-3">
                      <span className={`text-xs font-black w-5 text-center shrink-0 ${i === 0 ? "text-green-400" : "text-muted-foreground"}`}>{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-medium truncate">{r.name}</span>
                          <span className="text-xs font-bold text-green-400 ml-2 shrink-0">{r.Ganhos}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-green-500/70" style={{ width: `${Math.round((r.Ganhos / (ganhoItemRanking[0]?.Ganhos || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}