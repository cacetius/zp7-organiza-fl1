import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, Printer, ChevronLeft, ChevronRight, Plus, Minus, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { format, addDays, subDays, parseISO } from "date-fns";
import { detectCurrentShift } from "@/lib/shiftDetector";

// Horas extras disponíveis para sábado
const HORAS_EXTRAS_SABADO_1 = ["13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"];
const HORAS_EXTRAS_SABADO_2 = ["19:00","20:00","21:00","22:00","23:00"];

// 06:00 e 12:00 removidos conforme solicitado
const TURNOS = [
  { label: "1º Turno (06h–15h)", key: "primeiro", horas: ["07:00","08:00","09:00","10:00","11:00","13:00","14:00","15:00"] },
  { label: "2º Turno (15h–23h)", key: "segundo",  horas: ["16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"] },
  { label: "3º Turno (21h–06h)", key: "terceiro", horas: ["22:00","23:00","00:00","01:00","02:00","03:00","04:00","05:00"] },
];

const TURNOS_SABADO = [
  { label: "1º Turno Sáb (06h–12h)", key: "primeiro", horas: ["07:00","08:00","09:00","10:00","11:00"], horasExtras: HORAS_EXTRAS_SABADO_1 },
  { label: "2º Turno Sáb (12h–18h)", key: "segundo",  horas: ["13:00","14:00","15:00","16:00","17:00","18:00"], horasExtras: HORAS_EXTRAS_SABADO_2 },
];

function isSabado(dateStr) {
  const d = parseISO(dateStr);
  return d.getDay() === 6;
}

// Modo de edição de célula
// field: "producao" | "perdas_producao" | "perdas_defeito" | "objetivo" | "justificativa"
const CAMPO_LABELS = {
  producao: "Produção",
  perdas_producao: "Perdas de Produção",
  perdas_defeito: "Perdas por Defeito",
  objetivo: "Objetivo",
  justificativa: "Justificativa",
};

export default function ProductionControl() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTurno, setSelectedTurno] = useState(() => detectCurrentShift().key);
  const [editingCell, setEditingCell] = useState(null); // { testor, hora, field, value }
  const [mostrarExtras, setMostrarExtras] = useState(false);
  const [lossModal, setLossModal] = useState(null); // { hora, field: "perdas_producao"|"perdas_defeito" }

  // Para justificativas por hora (globais, não por testor)
  const [editingJustificativa, setEditingJustificativa] = useState(null); // { hora, value }

  const longPressTimers = useRef({});
  const clickCounters = useRef({});
  const clickTimers = useRef({});
  const longPressTriggered = useRef({});

  const sabado = isSabado(selectedDate);
  const listaTurnos = sabado ? TURNOS_SABADO : TURNOS;

  const turnoAtualBase = listaTurnos.find(t => t.key === selectedTurno) || listaTurnos[0];
  const horasBase = turnoAtualBase.horas;
  const horasExtras = turnoAtualBase.horasExtras || [];
  const horasVisiveis = sabado && mostrarExtras ? [...horasBase, ...horasExtras] : horasBase;
  const turnoAtual = { ...turnoAtualBase, horas: horasVisiveis };
  const sheetKey = `prod-ctrl-${selectedDate}-${selectedTurno}`;
  const dateLabel = format(parseISO(selectedDate), "dd/MM");

  const { data: testores = [], isLoading: loadingTestores } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
  });
  const { data: records = [] } = useQuery({
    queryKey: [sheetKey],
    queryFn: () => base44.entities.ProductionControl.filter({ data: selectedDate, turno: selectedTurno }),
  });

  const lossSheetKey = `loss-sheet-${selectedDate}-${selectedTurno}`;
  const { data: lossRecords = [] } = useQuery({
    queryKey: [lossSheetKey],
    queryFn: () => base44.entities.LossControl.filter({ data: selectedDate, turno: selectedTurno }),
  });

  const sheetKeyRef = useRef(sheetKey);
  useEffect(() => { sheetKeyRef.current = sheetKey; }, [sheetKey]);

  useEffect(() => {
    const unsub = base44.entities.ProductionControl.subscribe(() => {
      qc.invalidateQueries({ queryKey: [sheetKeyRef.current] });
    });
    return unsub;
  }, []);

  const optimisticUpdate = (updater) => qc.setQueryData([sheetKeyRef.current], (old = []) => updater(old));

  const createRec = useMutation({
    mutationFn: (data) => base44.entities.ProductionControl.create(data),
    onMutate: (data) => optimisticUpdate(old => [...old, { ...data, id: `temp-${Date.now()}` }]),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });
  const updateRec = useMutation({
    mutationFn: ({ id, ...fields }) => base44.entities.ProductionControl.update(id, fields),
    onMutate: ({ id, ...fields }) => optimisticUpdate(old => old.map(r => r.id === id ? { ...r, ...fields } : r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });
  const deleteRec = useMutation({
    mutationFn: (id) => base44.entities.ProductionControl.delete(id),
    onMutate: (id) => optimisticUpdate(old => old.filter(r => r.id !== id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });

  // cellMap: testor_id -> hora -> { id, producao, perdas_producao, perdas_defeito, objetivo, justificativa }
  const cellMapRef = useRef({});
  const cellMap = useMemo(() => {
    const map = {};
    records.forEach(r => {
      if (!r.testor_id || !r.hora) return;
      if (!map[r.testor_id]) map[r.testor_id] = {};
      const existing = map[r.testor_id][r.hora];
      if (!existing || (existing.id?.startsWith?.("temp-") && !r.id?.startsWith?.("temp-"))) {
        map[r.testor_id][r.hora] = {
          id: r.id,
          producao: r.carros_produzidos ?? 0,
          perdas_producao: r.perdas_producao ?? 0,
          perdas_defeito: r.perdas_defeito ?? 0,
          objetivo: r.objetivo ?? 0,
          justificativa: r.justificativa ?? "",
        };
      }
    });
    return map;
  }, [records]);
  useEffect(() => { cellMapRef.current = cellMap; }, [cellMap]);

  // Justificativas globais por hora (agrupadas de todos os testores)
  const justificativasPorHora = useMemo(() => {
    const map = {};
    records.forEach(r => {
      if (r.hora && r.justificativa) {
        if (!map[r.hora]) map[r.hora] = r.justificativa;
      }
    });
    return map;
  }, [records]);

  // Loss items grouped by tipo_perda and hora
  const lossMapByTipoHora = useMemo(() => {
    // { "perda_producao": { "07:00": [{item, count},...], ... }, "perda_defeito": {...} }
    const map = { perda_producao: {}, perda_defeito: {} };
    lossRecords.forEach(r => {
      if (!r.item_perda || !r.hora || r.motivo_perda === "ganho") return;
      const tipo = r.tipo_perda || "perda_producao";
      if (!map[tipo]) return;
      if (!map[tipo][r.hora]) map[tipo][r.hora] = [];
      const existing = map[tipo][r.hora].find(x => x.item === r.item_perda);
      if (existing) { existing.count += r.carros_perdidos ?? 1; }
      else { map[tipo][r.hora].push({ item: r.item_perda, count: r.carros_perdidos ?? 1 }); }
    });
    return map;
  }, [lossRecords]);

  const getLossSumForHora = (hora, tipo) => {
    const items = lossMapByTipoHora[tipo]?.[hora] || [];
    return items.reduce((acc, x) => acc + x.count, 0);
  };

  const getCell = (testorId, hora) => cellMapRef.current[testorId]?.[hora] || { producao: 0, perdas_producao: 0, perdas_defeito: 0, objetivo: 0, justificativa: "" };

  const saveField = (testor, hora, field, newVal) => {
    const cell = cellMapRef.current[testor.id]?.[hora];
    const update = { [field === "producao" ? "carros_produzidos" : field]: newVal };

    if (!cell) {
      // Criar novo registro
      createRec.mutate({
        testor_id: testor.id, testor_nome: testor.nome,
        data: selectedDate, turno: selectedTurno, hora,
        carros_produzidos: field === "producao" ? newVal : 0,
        perdas_producao: field === "perdas_producao" ? newVal : 0,
        perdas_defeito: field === "perdas_defeito" ? newVal : 0,
        objetivo: field === "objetivo" ? newVal : 0,
        justificativa: field === "justificativa" ? newVal : "",
      });
    } else if (!cell.id?.startsWith?.("temp-")) {
      updateRec.mutate({ id: cell.id, ...update });
    }
  };

  // Salvar justificativa para todos os testores nessa hora
  const saveJustificativaHora = (hora, texto) => {
    const testoresComRegistro = testores.filter(t => cellMapRef.current[t.id]?.[hora]);
    if (testoresComRegistro.length > 0) {
      testoresComRegistro.forEach(t => {
        const cell = cellMapRef.current[t.id]?.[hora];
        if (cell && !cell.id?.startsWith?.("temp-")) {
          updateRec.mutate({ id: cell.id, justificativa: texto });
        }
      });
    } else if (testores.length > 0) {
      // Salva no primeiro testor
      saveField(testores[0], hora, "justificativa", texto);
    }
  };

  // Long press para abrir edição
  const startLongPress = (testor, hora, field = "producao") => {
    const key = `${testor.id}-${hora}-${field}`;
    longPressTriggered.current[key] = false;
    longPressTimers.current[key] = setTimeout(() => {
      longPressTriggered.current[key] = true;
      const cell = getCell(testor.id, hora);
      setEditingCell({ testor, hora, field, value: String(field === "justificativa" ? (cell.justificativa || "") : (cell[field] || "")) });
    }, 600);
  };
  const cancelLongPress = (testor, hora, field = "producao") => clearTimeout(longPressTimers.current[`${testor.id}-${hora}-${field}`]);

  // Toque rápido: incrementa produção
  const handleIncrementProducao = (testor, hora) => {
    const key = `${testor.id}-${hora}-producao`;
    if (longPressTriggered.current[key]) return;
    clickCounters.current[key] = (clickCounters.current[key] || 0) + 1;
    clearTimeout(clickTimers.current[key]);
    if (clickCounters.current[key] >= 4) {
      clickCounters.current[key] = 0;
      const cell = cellMapRef.current[testor.id]?.[hora];
      if (cell && !cell.id?.startsWith?.("temp-")) deleteRec.mutate(cell.id);
      return;
    }
    clickTimers.current[key] = setTimeout(() => { clickCounters.current[key] = 0; }, 600);
    const cell = getCell(testor.id, hora);
    saveField(testor, hora, "producao", (cell.producao || 0) + 1);
  };

  const confirmEditCell = () => {
    if (!editingCell) return;
    const { testor, hora, field, value } = editingCell;
    if (field === "justificativa") {
      saveJustificativaHora(hora, value);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) saveField(testor, hora, field, num);
    }
    setEditingCell(null);
  };

  // Totais por hora
  const totalPorHora = {};
  const perdasProdPorHora = {};
  const perdasDefPorHora = {};
  const objetivoPorHora = {};

  turnoAtual.horas.forEach(h => {
    totalPorHora[h] = testores.reduce((acc, t) => acc + (getCell(t.id, h).producao || 0), 0);
    perdasProdPorHora[h] = testores.reduce((acc, t) => acc + (getCell(t.id, h).perdas_producao || 0), 0);
    perdasDefPorHora[h] = testores.reduce((acc, t) => acc + (getCell(t.id, h).perdas_defeito || 0), 0);
    objetivoPorHora[h] = testores.reduce((acc, t) => acc + (getCell(t.id, h).objetivo || 0), 0);
  });

  const totalPorTestor = (t) => turnoAtual.horas.reduce((acc, h) => acc + (getCell(t.id, h).producao || 0), 0);
  const totalGeral = testores.reduce((acc, t) => acc + totalPorTestor(t), 0);
  const totalObjetivo = Object.values(objetivoPorHora).reduce((a, v) => a + v, 0);
  const totalPerdasProd = Object.values(perdasProdPorHora).reduce((a, v) => a + v, 0);
  const totalPerdasDef = Object.values(perdasDefPorHora).reduce((a, v) => a + v, 0);
  const producaoLiquida = Math.max(0, totalGeral - totalPerdasProd - totalPerdasDef);
  const efic = totalGeral > 0 ? Math.round((producaoLiquida / totalGeral) * 100) : 0;

  const handleExportCsv = () => {
    const headers = ["Testor", ...turnoAtual.horas, "Total"];
    const rows = testores.map(t => [t.nome, ...turnoAtual.horas.map(h => getCell(t.id, h).producao || 0), totalPorTestor(t)]);
    rows.push(["OBJETIVO", ...turnoAtual.horas.map(h => objetivoPorHora[h] || 0), totalObjetivo]);
    rows.push(["PRODUÇÃO", ...turnoAtual.horas.map(h => totalPorHora[h] || 0), totalGeral]);
    rows.push(["PERDAS PRODUÇÃO", ...turnoAtual.horas.map(h => perdasProdPorHora[h] || 0), totalPerdasProd]);
    rows.push(["PERDAS DEFEITO", ...turnoAtual.horas.map(h => perdasDefPorHora[h] || 0), totalPerdasDef]);
    rows.push(["REAL LÍQUIDO", ...turnoAtual.horas.map(h => Math.max(0, (totalPorHora[h]||0)-(perdasProdPorHora[h]||0)-(perdasDefPorHora[h]||0))), producaoLiquida]);
    exportCsv(`producao_${selectedDate}_${selectedTurno}`, headers, rows);
  };

  const handlePrint = () => {
    const now = new Date().toLocaleString("pt-BR");
    const headerCols = turnoAtual.horas.map(h => `<th>${h}</th>`).join("");
    const rows = testores.map(t => {
      const total = totalPorTestor(t);
      const cells = turnoAtual.horas.map(h => {
        const v = getCell(t.id, h).producao || 0;
        return `<td style="${v > 0 ? "color:#1d4ed8;font-weight:700" : "color:#cbd5e1"}">${v > 0 ? v : "—"}</td>`;
      }).join("");
      return `<tr><td class="name">${t.nome}</td>${cells}<td class="total-col">${total > 0 ? total : "—"}</td></tr>`;
    }).join("");

    const objetivoRowCells = turnoAtual.horas.map(h => `<td>${objetivoPorHora[h] > 0 ? objetivoPorHora[h] : "—"}</td>`).join("");
    const totalRowCells = turnoAtual.horas.map(h => `<td>${totalPorHora[h] > 0 ? totalPorHora[h] : "—"}</td>`).join("");
    const perdasProdRowCells = turnoAtual.horas.map(h => `<td>${perdasProdPorHora[h] > 0 ? perdasProdPorHora[h] : "—"}</td>`).join("");
    const perdasDefRowCells = turnoAtual.horas.map(h => `<td>${perdasDefPorHora[h] > 0 ? perdasDefPorHora[h] : "—"}</td>`).join("");
    const liquidoRowCells = turnoAtual.horas.map(h => {
      const liq = Math.max(0, (totalPorHora[h]||0) - (perdasProdPorHora[h]||0) - (perdasDefPorHora[h]||0));
      return `<td style="color:#16a34a;font-weight:900">${liq > 0 ? liq : "—"}</td>`;
    }).join("");

    // Justificativas por hora
    const justRows = turnoAtual.horas.map(h => {
      const just = justificativasPorHora[h];
      return just ? `<tr><td class="just-hora">${h}</td><td class="just-texto" colspan="${turnoAtual.horas.length + 1}">${just}</td></tr>` : "";
    }).filter(Boolean).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Controle de Produção ZP7 — ${dateLabel}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm 12mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; color: #1e293b; background: #fff; }
      .header { background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 70%, #1e1b4b 100%); color: white; padding: 14px 20px; border-radius: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
      .header-title { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
      .header-sub { font-size: 8px; opacity: 0.7; margin-top: 3px; }
      .header-badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 6px 14px; font-size: 10px; font-weight: 700; text-align: center; }
      .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
      .kpi { border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; }
      .kpi-val { font-size: 20px; font-weight: 900; line-height: 1; margin-bottom: 3px; }
      .kpi-lbl { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
      .efic-bar { margin: 0 0 14px; padding: 10px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; }
      .efic-label { display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: #0369a1; margin-bottom: 5px; }
      .efic-track { background: #e0f2fe; border-radius: 6px; height: 10px; overflow: hidden; }
      .efic-fill { height: 10px; border-radius: 6px; background: linear-gradient(90deg, #2563eb, #16a34a); }
      table { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
      .section-hdr { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg,#1d4ed8,#2563eb); color: white; padding: 7px 12px; border-radius: 6px 6px 0 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
      th { background: #1e40af; color: white; padding: 5px 6px; text-align: center; font-size: 8px; font-weight: 700; border: 1px solid rgba(255,255,255,0.1); }
      th.name { text-align: left; }
      td { padding: 4px 5px; border: 1px solid #e2e8f0; font-size: 8.5px; text-align: center; }
      td.name { text-align: left; font-weight: 600; min-width: 100px; }
      td.total-col { background: #eff6ff; color: #1d4ed8; font-weight: 900; border-left: 2px solid #bfdbfe; }
      tr:nth-child(even) td { background: #f8fafc; }
      .objetivo-row td { background: #e0f2fe; font-weight: 900; color: #0369a1; border-top: 2px solid #7dd3fc; }
      .total-row td { background: #dbeafe; font-weight: 900; color: #1e40af; }
      .perdas-prod-row td { background: #fff7ed; font-weight: 900; color: #c2410c; }
      .perdas-def-row td { background: #fee2e2; font-weight: 900; color: #991b1b; }
      .liquido-row td { background: #dcfce7; font-weight: 900; color: #166534; border-top: 2px solid #86efac; }
      .grand-cyan { background: #0369a1 !important; color: white !important; }
      .grand-blue { background: #1d4ed8 !important; color: white !important; }
      .grand-orange { background: #ea580c !important; color: white !important; }
      .grand-red { background: #dc2626 !important; color: white !important; }
      .grand-green { background: #16a34a !important; color: white !important; }
      .just-section { margin-top: 10px; }
      .just-hora { font-weight: 800; color: #1d4ed8; min-width: 50px; text-align: left; }
      .just-texto { color: #334155; font-style: italic; text-align: left; }
      .footer { margin-top: 12px; display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      .footer-brand { font-weight: 700; color: #64748b; }
    </style></head><body>
    <div class="header">
      <div>
        <div class="header-title">🏭 Controle de Produção — ZP7</div>
        <div class="header-sub">Volkswagen Taubaté · Zona de Produção 7 · Gerado em ${now}</div>
      </div>
      <div class="header-badge">⏱ ${turnoAtual.label}<br/><span style="font-size:8px;opacity:0.8">📅 ${dateLabel}</span></div>
    </div>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-val" style="color:#0369a1">${totalObjetivo || "—"}</div><div class="kpi-lbl">Objetivo</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#1d4ed8">${totalGeral}</div><div class="kpi-lbl">Produção</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#ea580c">${totalPerdasProd}</div><div class="kpi-lbl">Perdas Produção</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#dc2626">${totalPerdasDef}</div><div class="kpi-lbl">Perdas Defeito</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#16a34a">${producaoLiquida}</div><div class="kpi-lbl">Real Líquido</div></div>
    </div>
    <div class="efic-bar">
      <div class="efic-label"><span>📈 Eficiência do Turno</span><span>${efic}%</span></div>
      <div class="efic-track"><div class="efic-fill" style="width:${efic}%"></div></div>
    </div>
    <div class="section-hdr"><span>📋 Produção por Testor / Hora</span><span style="font-weight:400;font-size:9px">${dateLabel} · Total: ${totalGeral} carros</span></div>
    <table>
      <thead><tr><th class="name">TESTOR</th>${headerCols}<th>TOTAL</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="objetivo-row"><td class="name"><strong>OBJETIVO</strong></td>${objetivoRowCells}<td class="grand-cyan">${totalObjetivo > 0 ? totalObjetivo : "—"}</td></tr>
        <tr class="total-row"><td class="name"><strong>PRODUÇÃO</strong></td>${totalRowCells}<td class="grand-blue">${totalGeral > 0 ? totalGeral : "—"}</td></tr>
        <tr class="perdas-prod-row"><td class="name"><strong>PERDAS DE PRODUÇÃO</strong></td>${perdasProdRowCells}<td class="grand-orange">${totalPerdasProd > 0 ? totalPerdasProd : "—"}</td></tr>
        <tr class="perdas-def-row"><td class="name"><strong>PERDAS POR DEFEITO</strong></td>${perdasDefRowCells}<td class="grand-red">${totalPerdasDef > 0 ? totalPerdasDef : "—"}</td></tr>
        <tr class="liquido-row"><td class="name"><strong>REAL LÍQUIDO</strong></td>${liquidoRowCells}<td class="grand-green">${producaoLiquida > 0 ? producaoLiquida : "—"}</td></tr>
      </tbody>
    </table>
    ${justRows ? `
    <div class="section-hdr" style="margin-top:8px">💬 Justificativas por Hora</div>
    <table class="just-section">
      <thead><tr><th style="text-align:left;min-width:50px">HORA</th><th style="text-align:left">JUSTIFICATIVA</th></tr></thead>
      <tbody>${justRows}</tbody>
    </table>` : ""}
    <div class="footer">
      <span class="footer-brand">ZP7 — Volkswagen Taubaté</span>
      <span>Sistema de Controle de Produção</span>
      <span>${now}</span>
    </div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.target = "_blank"; a.click();
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      {/* Modal edição numérica */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingCell(null)}>
          <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-80 mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">{editingCell.testor?.nome} · {editingCell.hora}</p>
            <p className="text-xs text-muted-foreground mb-3">{CAMPO_LABELS[editingCell.field] || editingCell.field}</p>
            {editingCell.field === "justificativa" ? (
              <textarea
                autoFocus rows={3}
                value={editingCell.value}
                onChange={e => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
                onKeyDown={e => { if (e.key === "Escape") setEditingCell(null); }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-4 resize-none"
                placeholder="Descreva o motivo das perdas nesse horário..."
              />
            ) : (
              <input
                autoFocus type="number" min="0"
                value={editingCell.value}
                onChange={e => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") confirmEditCell(); if (e.key === "Escape") setEditingCell(null); }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-3xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              />
            )}
            <div className="flex gap-2">
              <button onClick={() => setEditingCell(null)} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
              <button onClick={confirmEditCell} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Itens do Controle de Perdas */}
      {lossModal && (() => {
        const tipo = lossModal.field; // "perdas_producao" | "perdas_defeito"
        const tipoKey = tipo === "perdas_producao" ? "perda_producao" : "perda_defeito";
        const tipoLabel = tipo === "perdas_producao" ? "Perdas de Produção" : "Perdas por Defeito";
        const color = tipo === "perdas_producao" ? "orange" : "red";
        const items = lossMapByTipoHora[tipoKey]?.[lossModal.hora] || [];
        const total = items.reduce((a, x) => a + x.count, 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setLossModal(null)}>
            <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-80 mx-4" onClick={e => e.stopPropagation()}>
              <p className={`text-sm font-bold mb-0.5 ${color === "orange" ? "text-orange-400" : "text-red-400"}`}>
                {tipoLabel} · {lossModal.hora}
              </p>
              <p className="text-xs text-muted-foreground mb-3">Itens registrados no Controle de Perdas</p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum item registrado nessa hora no Controle de Perdas.</p>
              ) : (
                <div className="space-y-1.5 mb-3 max-h-52 overflow-y-auto">
                  {items.map(x => (
                    <div key={x.item} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/30">
                      <span className="text-xs font-medium truncate flex-1">{x.item}</span>
                      <span className={`text-sm font-black ml-3 ${color === "orange" ? "text-orange-400" : "text-red-400"}`}>{x.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <div className={`flex items-center justify-between px-3 py-2 rounded-md mb-3 ${color === "orange" ? "bg-orange-500/15" : "bg-red-500/15"}`}>
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total</span>
                  <span className={`text-lg font-black ${color === "orange" ? "text-orange-400" : "text-red-400"}`}>{total}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setLossModal(null)} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted">Fechar</button>
                {total > 0 && (
                  <button onClick={() => {
                    const val = total;
                    saveField(testores[0], lossModal.hora, tipo === "perdas_producao" ? "perdas_producao" : "perdas_defeito", val);
                    setLossModal(null);
                  }} className={`flex-1 py-2.5 rounded-md text-sm font-bold text-white ${color === "orange" ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700"}`}>
                    Usar Total ({total})
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal justificativa por hora */}
      {editingJustificativa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingJustificativa(null)}>
          <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-80 mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">Justificativa · {editingJustificativa.hora}</p>
            <p className="text-xs text-muted-foreground mb-3">Descreva o motivo das perdas nesse horário</p>
            <textarea
              autoFocus rows={3}
              value={editingJustificativa.value}
              onChange={e => setEditingJustificativa(prev => ({ ...prev, value: e.target.value }))}
              onKeyDown={e => { if (e.key === "Escape") setEditingJustificativa(null); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-4 resize-none"
              placeholder="Ex: Testor 03 parado por ajuste de sensor..."
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingJustificativa(null)} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => { saveJustificativaHora(editingJustificativa.hora, editingJustificativa.value); setEditingJustificativa(null); }} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2"><Factory className="w-5 h-5 text-blue-400 shrink-0" /> Controle de Produção</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">
            Toque para +1 · 4× zera · Segure para digitar · Botão − diminui
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="gap-1 px-2 sm:px-3" onClick={handleExportCsv}><FileSpreadsheet className="w-4 h-4" /><span className="hidden sm:inline text-xs">CSV</span></Button>
          <Button variant="outline" size="sm" className="gap-1 px-2 sm:px-3" onClick={handlePrint}><Printer className="w-4 h-4" /><span className="hidden sm:inline text-xs">PDF</span></Button>
        </div>
      </div>

      {/* Controles data/turno */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg px-2 py-1">
          <button onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))} className="p-1 hover:text-primary rounded"><ChevronLeft className="w-4 h-4" /></button>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border-0 bg-transparent h-7 w-32 text-sm text-center p-0 focus-visible:ring-0" />
          <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))} className="p-1 hover:text-primary rounded"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <Select value={selectedTurno} onValueChange={v => { setSelectedTurno(v); setMostrarExtras(false); }}>
          <SelectTrigger className="h-9 w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{listaTurnos.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        {sabado && horasExtras.length > 0 && (
          <Button variant={mostrarExtras ? "default" : "outline"} size="sm" onClick={() => setMostrarExtras(v => !v)} className="gap-1 text-xs">
            ⏱ {mostrarExtras ? "Ocultar Extras" : "Horas Extras"}
          </Button>
        )}
      </div>
      {sabado && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium">
          ⭐ Sábado — turnos reduzidos · {mostrarExtras ? "Horas extras visíveis" : "Horas extras ocultas"}
        </div>
      )}

      {/* KPIs */}
      {(totalGeral > 0 || totalPerdasProd > 0 || totalPerdasDef > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "Objetivo", value: totalObjetivo || "—", color: "text-cyan-400", border: "border-cyan-500/20" },
            { label: "Produção", value: totalGeral, color: "text-blue-400", border: "border-blue-500/20" },
            { label: "Perdas Produção", value: totalPerdasProd, color: "text-orange-400", border: "border-orange-500/20" },
            { label: "Perdas Defeito", value: totalPerdasDef, color: "text-red-400", border: "border-red-500/20" },
            { label: "Real Líquido", value: producaoLiquida, color: "text-green-400", border: "border-green-500/20" },
          ].map(k => (
            <Card key={k.label} className={`border ${k.border}`}>
              <CardContent className="p-2.5 sm:p-3 text-center">
                <p className={`text-xl sm:text-2xl font-black ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loadingTestores ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />)}</div>
      ) : testores.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Factory className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">Nenhum testor cadastrado.</p>
        </CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm -mx-1 sm:mx-0">
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${140 + turnoAtual.horas.length * 64}px` }}>
            <thead>
              <tr>
                <th colSpan={turnoAtual.horas.length + 2} className="border border-border bg-blue-600/20 px-3 py-2 text-center font-black text-xs sm:text-sm uppercase tracking-widest text-blue-400">
                  PRODUÇÃO — {dateLabel} — {turnoAtual.label}
                </th>
              </tr>
              <tr className="bg-muted/50">
                <th className="border border-border px-2 py-2 text-left font-bold text-[10px] sm:text-xs" style={{ minWidth: 90 }}>TESTOR</th>
                {turnoAtual.horas.map(h => <th key={h} className="border border-border px-0.5 py-2 text-center font-bold text-[10px] sm:text-xs" style={{ minWidth: 56 }}>{h}</th>)}
                <th className="border border-border px-1 py-2 text-center font-bold bg-blue-500/10 text-blue-400 text-[10px] sm:text-xs" style={{ minWidth: 48 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {/* Linhas de testores — produção + justificativa logo abaixo */}
              {testores.map((testor, idx) => {
                const total = totalPorTestor(testor);
                return (
                  <React.Fragment key={testor.id}>
                    {/* Linha de produção */}
                    <tr className={idx % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                      <td className="border border-border px-2 py-1 font-semibold whitespace-nowrap text-[11px] sm:text-sm">{testor.nome}</td>
                      {turnoAtual.horas.map(hora => {
                        const cell = getCell(testor.id, hora);
                        const val = cell.producao || 0;
                        return (
                          <td key={hora} className="border border-border p-0.5 sm:p-1">
                            <div className="flex flex-col items-center gap-0">
                              <button
                                onPointerDown={() => startLongPress(testor, hora, "producao")}
                                onPointerUp={() => { cancelLongPress(testor, hora, "producao"); handleIncrementProducao(testor, hora); }}
                                onPointerLeave={() => cancelLongPress(testor, hora, "producao")}
                                className={`w-full min-w-[44px] h-10 sm:h-11 rounded-md font-black text-sm sm:text-base transition-all select-none touch-manipulation
                                  ${val > 0 ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/35 active:scale-95" : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"}`}
                              >
                                {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
                              </button>
                              {val > 0 && (
                                <button onClick={() => saveField(testor, hora, "producao", val - 1)} className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1 touch-manipulation">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="border border-border px-1 py-2 text-center font-black text-blue-400 bg-blue-500/5 text-sm">{total > 0 ? total : "—"}</td>
                    </tr>
                    {/* Linha de justificativa — abaixo do testor */}
                    <tr className={idx % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                      <td className="border border-border px-2 py-1 text-yellow-400/70 text-[9px] font-semibold whitespace-nowrap">💬 justif.</td>
                      {turnoAtual.horas.map(hora => {
                        const just = justificativasPorHora[hora] || "";
                        return (
                          <td key={hora} className="border border-border p-0.5">
                            <button
                              onClick={() => setEditingJustificativa({ hora, value: just })}
                              className={`w-full min-h-[28px] rounded text-[9px] leading-tight px-1 py-1 text-left transition-all touch-manipulation break-words
                                ${just ? "text-yellow-200 bg-yellow-500/10 hover:bg-yellow-500/20" : "text-muted-foreground/20 hover:bg-muted/20 text-center"}`}
                              title={just || "Clique para adicionar justificativa"}
                            >
                              {just ? (just.length > 12 ? just.slice(0, 10) + "…" : just) : <span className="block text-center opacity-40">✎</span>}
                            </button>
                          </td>
                        );
                      })}
                      <td className="border border-border" />
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* OBJETIVO */}
              <tr className="bg-cyan-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-cyan-400 uppercase text-[10px] sm:text-xs">OBJETIVO</td>
                {turnoAtual.horas.map(h => {
                  const val = objetivoPorHora[h] || 0;
                  return (
                    <td key={h} className="border border-border p-0.5">
                      <button
                        onClick={() => setEditingCell({ testor: testores[0], hora: h, field: "objetivo", value: String(val) })}
                        className={`w-full h-8 rounded font-bold text-xs transition-all touch-manipulation ${val > 0 ? "text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25" : "text-muted-foreground/30 hover:bg-muted/30"}`}
                      >
                        {val > 0 ? val : <span className="text-[9px] opacity-40">+</span>}
                      </button>
                    </td>
                  );
                })}
                <td className="border border-border text-center font-black text-white bg-cyan-600 py-1.5 text-xs sm:text-sm">{totalObjetivo > 0 ? totalObjetivo : "—"}</td>
              </tr>

              {/* PRODUÇÃO TOTAL */}
              <tr className="bg-blue-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-blue-400 uppercase text-[10px] sm:text-xs">PRODUÇÃO</td>
                {turnoAtual.horas.map(h => <td key={h} className="border border-border text-center font-bold text-blue-400 py-1.5 text-xs sm:text-sm">{totalPorHora[h] > 0 ? totalPorHora[h] : "—"}</td>)}
                <td className="border border-border text-center font-black text-white bg-blue-600 py-1.5 text-xs sm:text-sm">{totalGeral > 0 ? totalGeral : "—"}</td>
              </tr>

              {/* PERDAS DE PRODUÇÃO — clique abre itens do controle de perdas */}
              <tr className="bg-orange-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-orange-400 uppercase text-[10px] sm:text-xs leading-tight">PERDAS<br/>PRODUÇÃO</td>
                {turnoAtual.horas.map(h => {
                  const val = perdasProdPorHora[h] || 0;
                  const lossSum = getLossSumForHora(h, "perda_producao");
                  return (
                    <td key={h} className="border border-border p-0.5">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => setLossModal({ hora: h, field: "perdas_producao" })}
                          className={`w-full h-7 rounded font-bold text-xs transition-all touch-manipulation relative ${val > 0 ? "text-orange-300 bg-orange-500/15 hover:bg-orange-500/25" : "text-muted-foreground/30 hover:bg-muted/30"}`}
                          title="Clique para ver itens do Controle de Perdas"
                        >
                          {val > 0 ? val : <span className="text-[9px] opacity-40">—</span>}
                          {lossSum > 0 && lossSum !== val && (
                            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">{lossSum}</span>
                          )}
                        </button>
                        <button onClick={() => setEditingCell({ testor: testores[0], hora: h, field: "perdas_producao", value: String(val) })} className="text-[8px] text-muted-foreground/30 hover:text-orange-400 transition-colors leading-none">✎</button>
                      </div>
                    </td>
                  );
                })}
                <td className="border border-border text-center font-black text-white bg-orange-600 py-1.5 text-xs sm:text-sm">{totalPerdasProd > 0 ? totalPerdasProd : "—"}</td>
              </tr>

              {/* PERDAS POR DEFEITO — clique abre itens do controle de perdas */}
              <tr className="bg-red-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-red-400 uppercase text-[10px] sm:text-xs leading-tight">PERDAS<br/>DEFEITO</td>
                {turnoAtual.horas.map(h => {
                  const val = perdasDefPorHora[h] || 0;
                  const lossSum = getLossSumForHora(h, "perda_defeito");
                  return (
                    <td key={h} className="border border-border p-0.5">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => setLossModal({ hora: h, field: "perdas_defeito" })}
                          className={`w-full h-7 rounded font-bold text-xs transition-all touch-manipulation relative ${val > 0 ? "text-red-300 bg-red-500/15 hover:bg-red-500/25" : "text-muted-foreground/30 hover:bg-muted/30"}`}
                          title="Clique para ver itens do Controle de Perdas"
                        >
                          {val > 0 ? val : <span className="text-[9px] opacity-40">—</span>}
                          {lossSum > 0 && lossSum !== val && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">{lossSum}</span>
                          )}
                        </button>
                        <button onClick={() => setEditingCell({ testor: testores[0], hora: h, field: "perdas_defeito", value: String(val) })} className="text-[8px] text-muted-foreground/30 hover:text-red-400 transition-colors leading-none">✎</button>
                      </div>
                    </td>
                  );
                })}
                <td className="border border-border text-center font-black text-white bg-red-600 py-1.5 text-xs sm:text-sm">{totalPerdasDef > 0 ? totalPerdasDef : "—"}</td>
              </tr>

              {/* REAL LÍQUIDO */}
              <tr className="bg-green-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-green-400 uppercase text-[10px] sm:text-xs leading-tight">REAL<br/>LÍQUIDO</td>
                {turnoAtual.horas.map(h => {
                  const liq = Math.max(0, (totalPorHora[h] || 0) - (perdasProdPorHora[h] || 0) - (perdasDefPorHora[h] || 0));
                  return <td key={h} className="border border-border text-center font-bold text-green-400 py-1.5 text-xs sm:text-sm">{liq > 0 ? liq : "—"}</td>;
                })}
                <td className="border border-border text-center font-black text-white bg-green-600 py-1.5 text-xs sm:text-sm">{producaoLiquida > 0 ? producaoLiquida : "—"}</td>
              </tr>


            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
        Toque +1 · 4× rápido zera · Segure digitar · Clique nas linhas de perdas/objetivo para editar · 💬 para justificativa
      </p>
    </div>
  );
}