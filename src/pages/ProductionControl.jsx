import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, Printer, ChevronLeft, ChevronRight, Plus, Minus, FileSpreadsheet, ClipboardList, MessageSquarePlus } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { format, addDays, subDays, parseISO } from "date-fns";
import { detectCurrentShift } from "@/lib/shiftDetector";
import HourlyNoteModal from "@/components/production/HourlyNoteModal";

const HORAS_EXTRAS_SABADO_1 = ["13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"];
const HORAS_EXTRAS_SABADO_2 = ["19:00","20:00","21:00","22:00","23:00"];

// Mesmos itens padrão do LossControl — só conta perdas desses itens
const DEFAULT_LOSS_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

const TURNOS = [
  { label: "1º Turno (06h–15h)", key: "primeiro", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00"] },
  { label: "2º Turno (15h–23h)", key: "segundo",  horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","23:45"] },
  { label: "3º Turno (21h–06h)", key: "terceiro", horas: ["22:00","23:00","00:00","01:00","02:00","03:00","04:00","05:00","06:00"] },
];

const TURNOS_SABADO = [
  { label: "1º Turno Sáb (06h–12h)", key: "primeiro", horas: ["07:00","08:00","09:00","10:00","11:00"], horasExtras: HORAS_EXTRAS_SABADO_1 },
  { label: "2º Turno Sáb (12h–18h)", key: "segundo",  horas: ["13:00","14:00","15:00","16:00","17:00","18:00"], horasExtras: HORAS_EXTRAS_SABADO_2 },
];

// Testor virtual para o OBJETIVO (não vinculado a nenhum testor real)
const OBJETIVO_TESTOR_ID = "__objetivo__";

function isSabado(dateStr) {
  return parseISO(dateStr).getDay() === 6;
}

const CAMPO_LABELS = {
  producao: "Produção",
  objetivo: "Objetivo",
  justificativa: "Justificativa",
};

export default function ProductionControl() {
  const qc = useQueryClient();

  const today = format(new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTurno, setSelectedTurno] = useState(() => detectCurrentShift().key);
  const [editingCell, setEditingCell] = useState(null); // { testorId, testorNome, hora, field, value }
  const [editingJustificativa, setEditingJustificativa] = useState(null); // { testor, hora, value, fotoUrl, uploading }
  const [hourlyNoteHora, setHourlyNoteHora] = useState(null); // hora da nota geral aberta

  const [mostrarExtras, setMostrarExtras] = useState(false);

  // Refs para evitar stale closures nos callbacks assíncronos
  const selectedDateRef = useRef(selectedDate);
  const selectedTurnoRef = useRef(selectedTurno);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  useEffect(() => { selectedTurnoRef.current = selectedTurno; }, [selectedTurno]);

  const longPressTimers = useRef({});
  const longPressTriggered = useRef({});
  const clickCounters = useRef({});
  const clickTimers = useRef({});

  const sabado = isSabado(selectedDate);
  const listaTurnos = sabado ? TURNOS_SABADO : TURNOS;
  const turnoBase = listaTurnos.find(t => t.key === selectedTurno) || listaTurnos[0];
  const horasExtras = turnoBase.horasExtras || [];
  const horasVisiveis = sabado && mostrarExtras ? [...turnoBase.horas, ...horasExtras] : turnoBase.horas;
  const turnoAtual = { ...turnoBase, horas: horasVisiveis };

  const sheetKey = `prod-ctrl-${selectedDate}-${selectedTurno}`;
  const lossKey  = `loss-sheet-${selectedDate}-${selectedTurno}`;
  const dateLabel = format(parseISO(selectedDate), "dd/MM");

  const sheetKeyRef = useRef(sheetKey);
  const lossKeyRef  = useRef(lossKey);
  useEffect(() => { sheetKeyRef.current = sheetKey; }, [sheetKey]);
  useEffect(() => { lossKeyRef.current  = lossKey;  }, [lossKey]);

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: testores = [], isLoading: loadingTestores } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const { data: records = [] } = useQuery({
    queryKey: [sheetKey],
    queryFn: () => base44.entities.ProductionControl.filter({ data: selectedDate, turno: selectedTurno }),
    staleTime: 0,
    gcTime: 0,
  });

  const hourlyNotesKey = `hourly-notes-producao-${selectedDate}-${selectedTurno}`;
  const { data: hourlyNotes = [] } = useQuery({
    queryKey: [hourlyNotesKey],
    queryFn: () => base44.entities.HourlyNote.filter({ data: selectedDate, turno: selectedTurno, modulo: "producao" }),
    staleTime: 0,
  });
  const hourlyNotesMap = useMemo(() => {
    const map = {};
    hourlyNotes.forEach(n => { map[n.hora] = n; });
    return map;
  }, [hourlyNotes]);

  const { data: lossRecords = [] } = useQuery({
    queryKey: [lossKey],
    queryFn: () => base44.entities.LossControl.filter({ data: selectedDate, turno: selectedTurno }),
    staleTime: 0,
    gcTime: 30_000,
    select: (data) => data.filter(r => r.data === selectedDate && r.turno === selectedTurno),
  });

  // Subscrições em tempo real
  useEffect(() => {
    const unsubProd = base44.entities.ProductionControl.subscribe(() => {
      qc.invalidateQueries({ queryKey: [sheetKeyRef.current] });
    });
    const unsubLoss = base44.entities.LossControl.subscribe(() => {
      qc.invalidateQueries({ queryKey: [lossKeyRef.current] });
    });
    return () => { unsubProd(); unsubLoss(); };
  }, [qc]);

  // ─── Mutations ────────────────────────────────────────────────────────────
  const invalidateSheet = () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] });

  const createRec = useMutation({
    mutationFn: (data) => base44.entities.ProductionControl.create(data),
    onSuccess: invalidateSheet,
    onError: invalidateSheet,
  });

  const updateRec = useMutation({
    mutationFn: ({ id, ...fields }) => base44.entities.ProductionControl.update(id, fields),
    onMutate: ({ id, ...fields }) => {
      qc.setQueryData([sheetKeyRef.current], (old = []) =>
        old.map(r => r.id === id ? { ...r, ...fields } : r)
      );
    },
    onError: invalidateSheet,
  });

  const deleteRec = useMutation({
    mutationFn: (id) => base44.entities.ProductionControl.delete(id),
    onMutate: (id) => {
      qc.setQueryData([sheetKeyRef.current], (old = []) => old.filter(r => r.id !== id));
    },
    onError: invalidateSheet,
  });

  // ─── cellMap: testorId -> hora -> record ──────────────────────────────────
  // Inclui OBJETIVO_TESTOR_ID para os registros de objetivo
  const cellMap = useMemo(() => {
    const map = {};
    for (const r of records) {
      const tid = r.testor_id;
      const hora = r.hora;
      if (!tid || !hora) continue;
      if (!map[tid]) map[tid] = {};
      const existing = map[tid][hora];
      // Prioriza registros reais sobre temporários
      const isReal = r.id && !String(r.id).startsWith("temp-");
      const existingIsTemp = existing && String(existing.id).startsWith("temp-");
      if (!existing || (existingIsTemp && isReal)) {
        map[tid][hora] = r;
      }
    }
    return map;
  }, [records]);

  const cellMapRef = useRef(cellMap);
  useEffect(() => { cellMapRef.current = cellMap; }, [cellMap]);

  // Helpers: retorna o record (ou null)
  const getRecord = useCallback((testorId, hora) => cellMap[testorId]?.[hora] || null, [cellMap]);
  const getRecordRef = useCallback((testorId, hora) => cellMapRef.current[testorId]?.[hora] || null, []);

  // Helper: valor do campo com fallback 0/""
  const getVal = useCallback((testorId, hora, field) => {
    const rec = getRecord(testorId, hora);
    if (!rec) return field === "justificativa" ? "" : 0;
    if (field === "producao") return rec.carros_produzidos ?? 0;
    if (field === "justificativa") return rec.justificativa ?? "";
    return rec[field] ?? 0;
  }, [getRecord]);

  // ─── Salvar campo ─────────────────────────────────────────────────────────
  const saveField = useCallback((testorId, testorNome, hora, field, newVal) => {
    const rec = getRecordRef(testorId, hora);
    const dbField = field === "producao" ? "carros_produzidos" : field;

    if (rec?.id && !String(rec.id).startsWith("temp-")) {
      updateRec.mutate({ id: rec.id, [dbField]: newVal });
    } else {
      createRec.mutate({
        testor_id: testorId,
        testor_nome: testorNome,
        data: selectedDateRef.current,
        turno: selectedTurnoRef.current,
        hora,
        carros_produzidos: field === "producao" ? newVal : 0,
        perdas_producao: 0,
        perdas_defeito: 0,
        objetivo: field === "objetivo" ? newVal : 0,
        justificativa: field === "justificativa" ? newVal : "",
      });
    }
  }, [getRecordRef, createRec, updateRec]);

  // ─── Interações produção ──────────────────────────────────────────────────
  const startLongPress = useCallback((testorId, testorNome, hora, field = "producao") => {
    const key = `${testorId}-${hora}-${field}`;
    longPressTriggered.current[key] = false;
    longPressTimers.current[key] = setTimeout(() => {
      longPressTriggered.current[key] = true;
      const currentVal = cellMapRef.current[testorId]?.[hora];
      let value = "0";
      if (field === "producao") value = String(currentVal?.carros_produzidos ?? 0);
      else if (field === "justificativa") value = currentVal?.justificativa ?? "";
      else value = String(currentVal?.[field] ?? 0);
      setEditingCell({ testorId, testorNome, hora, field, value });
    }, 600);
  }, []);

  const cancelLongPress = useCallback((testorId, hora, field = "producao") => {
    clearTimeout(longPressTimers.current[`${testorId}-${hora}-${field}`]);
  }, []);

  const handleIncrementProducao = useCallback((testorId, testorNome, hora) => {
    const key = `${testorId}-${hora}-producao`;
    if (longPressTriggered.current[key]) return;

    clickCounters.current[key] = (clickCounters.current[key] || 0) + 1;
    clearTimeout(clickTimers.current[key]);

    if (clickCounters.current[key] >= 4) {
      clickCounters.current[key] = 0;
      const rec = getRecordRef(testorId, hora);
      if (rec?.id && !String(rec.id).startsWith("temp-")) deleteRec.mutate(rec.id);
      return;
    }

    clickTimers.current[key] = setTimeout(() => { clickCounters.current[key] = 0; }, 600);
    const currentVal = getRecordRef(testorId, hora)?.carros_produzidos ?? 0;
    saveField(testorId, testorNome, hora, "producao", currentVal + 1);
  }, [getRecordRef, saveField, deleteRec]);

  const confirmEditCell = useCallback(() => {
    if (!editingCell) return;
    const { testorId, testorNome, hora, field, value } = editingCell;
    if (field === "justificativa") {
      saveField(testorId, testorNome, hora, "justificativa", value);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) saveField(testorId, testorNome, hora, field, num);
    }
    setEditingCell(null);
  }, [editingCell, saveField]);

  // ─── Totais ───────────────────────────────────────────────────────────────
  const { totalPorHora, objetivoPorHora, perdasProdPorHora } = useMemo(() => {
    const prod = {}, obj = {}, perdProd = {};
    for (const h of turnoAtual.horas) {
      // Soma apenas testores reais (exclui OBJETIVO_TESTOR_ID)
      prod[h] = testores.filter(t => t.id !== OBJETIVO_TESTOR_ID).reduce((acc, t) => acc + (getVal(t.id, h, "producao") || 0), 0);
      // Objetivo: somado dos registros com testor_id = OBJETIVO_TESTOR_ID para essa hora
      const objRec = cellMap[OBJETIVO_TESTOR_ID]?.[h];
      obj[h] = objRec?.objetivo ?? 0;
      perdProd[h] = obj[h] > 0 ? Math.max(0, obj[h] - prod[h]) : 0;
    }
    return { totalPorHora: prod, objetivoPorHora: obj, perdasProdPorHora: perdProd };
  }, [cellMap, testores, turnoAtual.horas, getVal]);

  // cellMap do LossControl: agrupa por item_perda+hora, 1 registro por célula (igual ao LossControl)
  const lossCellMap = useMemo(() => {
    const map = {}; // { motivo_perda -> { item_perda -> { hora -> carros_perdidos } } }
    // Perdas: filtradas por DEFAULT_LOSS_ITEMS. Ganhos: sem filtro de lista (qualquer item_perda vale)
    lossRecords.filter(r => {
      if (!r.item_perda || !r.hora || (r.carros_perdidos || 0) <= 0) return false;
      if (r.motivo_perda === "ganho") return true; // ganhos sempre contam
      return DEFAULT_LOSS_ITEMS.includes(r.item_perda); // perdas só dos itens padrão
    }).forEach(r => {
      const tipo = r.motivo_perda === "ganho" ? "ganho" : "perda";
      if (!map[tipo]) map[tipo] = {};
      if (!map[tipo][r.item_perda]) map[tipo][r.item_perda] = {};
      // Mantém apenas 1 registro por célula (item+hora), priorizando não-temporários
      const existing = map[tipo][r.item_perda][r.hora];
      const isReal = r.id && !String(r.id).startsWith("temp-");
      const existingIsTemp = existing && String(existing.id || "").startsWith("temp-");
      if (!existing || (existingIsTemp && isReal)) {
        map[tipo][r.item_perda][r.hora] = r;
      }
    });
    return map;
  }, [lossRecords]);

  const perdasBrutasPorHora = useMemo(() => {
    const map = {};
    for (const h of turnoAtual.horas) map[h] = 0;
    const perdaMap = lossCellMap["perda"] || {};
    Object.values(perdaMap).forEach(horaMap => {
      Object.entries(horaMap).forEach(([hora, r]) => {
        if (map[hora] !== undefined) map[hora] += (r.carros_perdidos || 0);
      });
    });
    return map;
  }, [lossCellMap, turnoAtual.horas]);

  const ganhosCompPorHora = useMemo(() => {
    const map = {};
    for (const h of turnoAtual.horas) map[h] = 0;
    const ganhoMap = lossCellMap["ganho"] || {};
    Object.values(ganhoMap).forEach(horaMap => {
      Object.entries(horaMap).forEach(([hora, r]) => {
        if (map[hora] !== undefined) map[hora] += (r.carros_perdidos || 0);
      });
    });
    return map;
  }, [lossCellMap, turnoAtual.horas]);

  const perdasFalhaPorHora = useMemo(() => {
    const map = {};
    for (const h of turnoAtual.horas) {
      map[h] = Math.max(0, (perdasBrutasPorHora[h] || 0) - (ganhosCompPorHora[h] || 0));
    }
    return map;
  }, [perdasBrutasPorHora, ganhosCompPorHora, turnoAtual.horas]);

  const detalhePerdasPorHora = useMemo(() => {
    const map = {};
    for (const h of turnoAtual.horas) map[h] = [];
    const perdaMap = lossCellMap["perda"] || {};
    Object.entries(perdaMap).forEach(([item, horaMap]) => {
      Object.entries(horaMap).forEach(([hora, r]) => {
        if (map[hora] !== undefined) map[hora].push({ item, val: r.carros_perdidos || 0 });
      });
    });
    return map;
  }, [lossCellMap, turnoAtual.horas]);

  // Real Líquido = Produção − Perdas por Defeito (LossControl)
  // Perdas de Produção = gap do objetivo, não deve subtrair do real líquido novamente
  const realLiquidoPorHora = useMemo(() => {
    const map = {};
    for (const h of turnoAtual.horas) {
      map[h] = Math.max(0, (totalPorHora[h] || 0) - (perdasFalhaPorHora[h] || 0));
    }
    return map;
  }, [totalPorHora, perdasFalhaPorHora, turnoAtual.horas]);

  const totalPorTestor = useCallback((t) =>
    turnoAtual.horas.reduce((acc, h) => acc + (getVal(t.id, h, "producao") || 0), 0),
  [turnoAtual.horas, getVal]);

  const totalGeral       = useMemo(() => Object.values(totalPorHora).reduce((a, v) => a + v, 0), [totalPorHora]);
  const totalObjetivo    = useMemo(() => Object.values(objetivoPorHora).reduce((a, v) => a + v, 0), [objetivoPorHora]);
  const totalPerdasProd  = useMemo(() => Object.values(perdasProdPorHora).reduce((a, v) => a + v, 0), [perdasProdPorHora]);
  const totalPerdasFalha = useMemo(() => Object.values(perdasFalhaPorHora).reduce((a, v) => a + v, 0), [perdasFalhaPorHora]);
  const producaoLiquida  = useMemo(() => Object.values(realLiquidoPorHora).reduce((a, v) => a + v, 0), [realLiquidoPorHora]);
  // Eficiência baseada no Real Líquido / Objetivo
  const efic = totalObjetivo > 0 ? Math.round((producaoLiquida / totalObjetivo) * 100) : 0;

  // Justificativas por testor/hora para impressão
  const justificativasMap = useMemo(() => {
    const map = {};
    for (const r of records) {
      if (r.testor_id && r.hora && r.justificativa) {
        const key = `${r.testor_id}-${r.hora}`;
        if (!map[key]) map[key] = { texto: r.justificativa, fotoUrl: r.justificativa_foto_url || "" };
      }
    }
    return map;
  }, [records]);

  // ─── Export CSV ───────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const headers = ["Testor", ...turnoAtual.horas, "Total"];
    const rows = testores.map(t => [t.nome, ...turnoAtual.horas.map(h => getVal(t.id, h, "producao") || 0), totalPorTestor(t)]);
    rows.push(["OBJETIVO",         ...turnoAtual.horas.map(h => objetivoPorHora[h] || 0),    totalObjetivo]);
    rows.push(["PRODUÇÃO",         ...turnoAtual.horas.map(h => totalPorHora[h] || 0),       totalGeral]);
    rows.push(["PERDAS DE PRODUÇÃO",  ...turnoAtual.horas.map(h => perdasProdPorHora[h] || 0),  totalPerdasProd]);
    rows.push(["PERDAS POR DEFEITO",  ...turnoAtual.horas.map(h => perdasFalhaPorHora[h] || 0), totalPerdasFalha]);
    rows.push(["REAL LÍQUIDO",        ...turnoAtual.horas.map(h => realLiquidoPorHora[h] || 0), producaoLiquida]);
    exportCsv(`producao_${selectedDate}_${selectedTurno}`, headers, rows);
  };

  // ─── Print ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const now = new Date().toLocaleString("pt-BR");
    const headerCols = turnoAtual.horas.map(h => `<th>${h}</th>`).join("");
    const rowsHtml = testores.map(t => {
      const total = totalPorTestor(t);
      const cells = turnoAtual.horas.map(h => {
        const v = getVal(t.id, h, "producao") || 0;
        return `<td style="${v > 0 ? "color:#1d4ed8;font-weight:700" : "color:#cbd5e1"}">${v > 0 ? v : "—"}</td>`;
      }).join("");
      return `<tr><td class="name">${t.nome}</td>${cells}<td class="total-col">${total > 0 ? total : "—"}</td></tr>`;
    }).join("");
    const objetivoRowCells   = turnoAtual.horas.map(h => `<td>${objetivoPorHora[h] > 0 ? objetivoPorHora[h] : "—"}</td>`).join("");
    const totalRowCells      = turnoAtual.horas.map(h => `<td>${totalPorHora[h] > 0 ? totalPorHora[h] : "—"}</td>`).join("");
    const perdasProdRowCells = turnoAtual.horas.map(h => `<td>${perdasProdPorHora[h] > 0 ? perdasProdPorHora[h] : "—"}</td>`).join("");
    const perdasFalhaRowCells= turnoAtual.horas.map(h => `<td>${perdasFalhaPorHora[h] > 0 ? perdasFalhaPorHora[h] : "—"}</td>`).join("");
    const liquidoRowCells    = turnoAtual.horas.map(h => {
      const liq = realLiquidoPorHora[h] || 0;
      return `<td style="color:#16a34a;font-weight:900">${liq > 0 ? liq : "—"}</td>`;
    }).join("");
    const justRows = testores.flatMap(t =>
      turnoAtual.horas.map(h => {
        const j = justificativasMap[`${t.id}-${h}`];
        if (!j) return "";
        const imgHtml = j.fotoUrl ? `<br/><img src="${j.fotoUrl}" style="max-height:80px;max-width:160px;border-radius:4px;margin-top:4px;object-fit:cover" />` : "";
        return `<tr><td class="just-hora">${t.nome} · ${h}</td><td class="just-texto" colspan="${turnoAtual.horas.length + 1}">${j.texto}${imgHtml}</td></tr>`;
      }).filter(Boolean)
    ).join("");

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
      <div class="kpi"><div class="kpi-val" style="color:#ea580c">${totalPerdasProd}</div><div class="kpi-lbl">Perdas de Produção</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#dc2626">${totalPerdasFalha}</div><div class="kpi-lbl">Perdas por Defeito</div></div>
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
        ${rowsHtml}
        <tr class="objetivo-row"><td class="name"><strong>OBJETIVO</strong></td>${objetivoRowCells}<td class="grand-cyan">${totalObjetivo > 0 ? totalObjetivo : "—"}</td></tr>
        <tr class="total-row"><td class="name"><strong>PRODUÇÃO</strong></td>${totalRowCells}<td class="grand-blue">${totalGeral > 0 ? totalGeral : "—"}</td></tr>
        <tr class="perdas-prod-row"><td class="name"><strong>PERDAS DE PRODUÇÃO</strong></td>${perdasProdRowCells}<td class="grand-orange">${totalPerdasProd > 0 ? totalPerdasProd : "—"}</td></tr>
        <tr class="perdas-def-row"><td class="name"><strong>PERDAS POR DEFEITO</strong></td>${perdasFalhaRowCells}<td class="grand-red">${totalPerdasFalha > 0 ? totalPerdasFalha : "—"}</td></tr>
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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      {/* Modal edição numérica / justificativa */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingCell(null)}>
          <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-80 mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">{editingCell.testorNome} · {editingCell.hora}</p>
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

      {/* Modal justificativa por testor */}
      {editingJustificativa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingJustificativa(null)}>
          <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-80 mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">{editingJustificativa.testor?.nome} · {editingJustificativa.hora}</p>
            <p className="text-xs text-muted-foreground mb-3">Descreva o motivo das perdas</p>
            <textarea
              autoFocus rows={3}
              value={editingJustificativa.value}
              onChange={e => setEditingJustificativa(prev => ({ ...prev, value: e.target.value }))}
              onKeyDown={e => { if (e.key === "Escape") setEditingJustificativa(null); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-3 resize-none"
              placeholder="Ex: Sensor descalibrado, ajuste necessário..."
            />

            {/* Upload de foto */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1.5">📷 Deseja anexar uma foto?</p>
              {editingJustificativa.fotoUrl ? (
                <div className="relative">
                  <img src={editingJustificativa.fotoUrl} alt="Foto justificativa" className="w-full max-h-32 object-cover rounded-md border border-border" />
                  <button
                    onClick={() => setEditingJustificativa(prev => ({ ...prev, fotoUrl: "" }))}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                  >×</button>
                </div>
              ) : (
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-md border border-dashed border-border text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors ${editingJustificativa.uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  {editingJustificativa.uploading ? "Enviando…" : "📁 Toque para escolher uma imagem"}
                  <input
                  type="file" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEditingJustificativa(prev => ({ ...prev, uploading: true }));
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      setEditingJustificativa(prev => ({ ...prev, fotoUrl: file_url, uploading: false }));
                    }}
                  />
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditingJustificativa(null)} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
              <button
                onClick={async () => {
                  const { testor, hora, value, fotoUrl } = editingJustificativa;
                  const rec = getRecordRef(testor.id, hora);
                  const dbData = { justificativa: value, justificativa_foto_url: fotoUrl || "" };
                  if (rec?.id && !String(rec.id).startsWith("temp-")) {
                    updateRec.mutate({ id: rec.id, ...dbData });
                  } else {
                    createRec.mutate({
                      testor_id: testor.id,
                      testor_nome: testor.nome,
                      data: selectedDateRef.current,
                      turno: selectedTurnoRef.current,
                      hora,
                      carros_produzidos: 0,
                      perdas_producao: 0,
                      perdas_defeito: 0,
                      objetivo: 0,
                      ...dbData,
                    });
                  }
                  setEditingJustificativa(null);
                }}
                className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90"
              >Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nota geral do horário */}
      {hourlyNoteHora && (
        <HourlyNoteModal
          hora={hourlyNoteHora}
          data={selectedDate}
          turno={selectedTurno}
          modulo="producao"
          onClose={() => { setHourlyNoteHora(null); qc.invalidateQueries({ queryKey: [hourlyNotesKey] }); }}
        />
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
          <Button
            variant="outline" size="sm"
            className="gap-1 px-2 sm:px-3 text-green-400 border-green-500/30 hover:bg-green-500/10"
            onClick={async () => {
              const res = await base44.functions.invoke("gerarRelatorioTurno", { turno: selectedTurno, data: selectedDate });
              const html = res.data;
              const blob = new Blob([html], { type: "text/html;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
              setTimeout(() => URL.revokeObjectURL(url), 15000);
            }}
          >
            <ClipboardList className="w-4 h-4" /><span className="hidden sm:inline text-xs">Fechamento</span>
          </Button>
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
      {(totalGeral > 0 || totalPerdasProd > 0 || totalPerdasFalha > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "Objetivo",        value: totalObjetivo || "—", color: "text-cyan-400",   border: "border-cyan-500/20" },
            { label: "Produção",        value: totalGeral,           color: "text-blue-400",   border: "border-blue-500/20" },
            { label: "Perdas Produção", value: totalPerdasProd,      color: "text-orange-400", border: "border-orange-500/20" },
            { label: "Perdas por Defeito", value: totalPerdasFalha,    color: "text-red-400",    border: "border-red-500/20" },
            { label: "Real Líquido",    value: producaoLiquida,      color: "text-green-400",  border: "border-green-500/20" },
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

      {/* Tabela */}
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
                {turnoAtual.horas.map((h, i) => {
                  const next = turnoAtual.horas[i + 1];
                  const label = next ? `${h.slice(0,5)}-${next.slice(0,5)}` : h;
                  return <th key={h} className="border border-border px-0.5 py-2 text-center font-bold text-[10px] sm:text-xs" style={{ minWidth: 64 }}>{label}</th>;
                })}
                <th className="border border-border px-1 py-2 text-center font-bold bg-blue-500/10 text-blue-400 text-[10px] sm:text-xs" style={{ minWidth: 48 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {testores.map((testor, idx) => {
                const total = totalPorTestor(testor);
                return (
                  <React.Fragment key={testor.id}>
                    {/* Linha produção */}
                    <tr className={idx % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                      <td className="border border-border px-2 py-1 font-semibold whitespace-nowrap text-[11px] sm:text-sm">{testor.nome}</td>
                      {turnoAtual.horas.map(hora => {
                        const val = getVal(testor.id, hora, "producao");
                        return (
                          <td key={hora} className="border border-border p-0.5 sm:p-1">
                            <div className="flex flex-col items-center gap-0">
                              <button
                                onPointerDown={() => startLongPress(testor.id, testor.nome, hora, "producao")}
                                onPointerUp={() => { cancelLongPress(testor.id, hora, "producao"); handleIncrementProducao(testor.id, testor.nome, hora); }}
                                onPointerLeave={() => cancelLongPress(testor.id, hora, "producao")}
                                className={`w-full min-w-[44px] h-10 sm:h-11 rounded-md font-black text-sm sm:text-base transition-all select-none touch-manipulation
                                  ${val > 0 ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/35 active:scale-95" : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"}`}
                              >
                                {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
                              </button>
                              {val > 0 && (
                                <button
                                  onClick={() => saveField(testor.id, testor.nome, hora, "producao", val - 1)}
                                  className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1 touch-manipulation"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="border border-border px-1 py-2 text-center font-black text-blue-400 bg-blue-500/5 text-sm">{total > 0 ? total : "—"}</td>
                    </tr>
                    {/* Linha justificativa */}
                    <tr className={idx % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                      <td className="border border-border px-2 py-1 text-yellow-400/70 text-[9px] font-semibold whitespace-nowrap">💬 justif.</td>
                      {turnoAtual.horas.map(hora => {
                        const j = justificativasMap[`${testor.id}-${hora}`];
                        const just = j?.texto || "";
                        const fotoUrl = j?.fotoUrl || "";
                        return (
                          <td key={hora} className="border border-border p-0.5">
                            <button
                              onClick={() => setEditingJustificativa({ testor, hora, value: just, fotoUrl })}
                              className={`w-full min-h-[28px] rounded text-[9px] leading-tight px-1 py-1 text-left transition-all touch-manipulation break-words
                                ${just ? "text-yellow-200 bg-yellow-500/10 hover:bg-yellow-500/20" : "text-muted-foreground/20 hover:bg-muted/20 text-center"}`}
                              title={just || "Clique para adicionar justificativa"}
                            >
                              {just ? (
                                <span className="flex items-center gap-1">
                                  {just.length > 12 ? just.slice(0, 10) + "…" : just}
                                  {fotoUrl && <span className="text-[8px]">📷</span>}
                                </span>
                              ) : <span className="block text-center opacity-40">✎</span>}
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
                        onClick={() => setEditingCell({ testorId: OBJETIVO_TESTOR_ID, testorNome: "Objetivo", hora: h, field: "objetivo", value: String(val) })}
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

              {/* PERDAS DE PRODUÇÃO */}
              <tr className="bg-orange-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-orange-400 uppercase text-[10px] sm:text-xs leading-tight">PERDAS<br/>PRODUÇÃO</td>
                {turnoAtual.horas.map(h => (
                  <td key={h} className="border border-border text-center font-bold text-orange-400 py-1.5 text-xs sm:text-sm">
                    {perdasProdPorHora[h] > 0 ? perdasProdPorHora[h] : "—"}
                  </td>
                ))}
                <td className="border border-border text-center font-black text-white bg-orange-600 py-1.5 text-xs sm:text-sm">{totalPerdasProd > 0 ? totalPerdasProd : "—"}</td>
              </tr>

              {/* PERDAS POR DEFEITO */}
              <tr className="bg-red-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-red-400 uppercase text-[10px] sm:text-xs leading-tight">PERDAS<br/>DEFEITO</td>
                {turnoAtual.horas.map(h => {
                  const val = perdasFalhaPorHora[h] || 0;
                  const detalhes = detalhePerdasPorHora[h] || [];
                  return (
                    <td key={h} className="border border-border text-center font-bold text-red-400 py-1.5 text-xs sm:text-sm relative group/cell">
                      {val > 0 ? val : "—"}
                      {detalhes.length > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 hidden group-hover/cell:block pointer-events-none">
                          <div className="bg-popover border border-border rounded-lg shadow-xl p-2 text-left min-w-[140px] max-w-[200px]">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Perdas {h}</p>
                            {detalhes.map((d, i) => (
                              <div key={i} className="flex justify-between gap-2 text-[10px]">
                                <span className="text-foreground truncate">{d.item}</span>
                                <span className="font-black text-red-400 shrink-0">{d.val}</span>
                              </div>
                            ))}
                            {ganhosCompPorHora[h] > 0 && (
                              <div className="flex justify-between gap-2 text-[10px] mt-1 border-t border-border pt-1">
                                <span className="text-green-400">Ganhos</span>
                                <span className="font-black text-green-400 shrink-0">-{ganhosCompPorHora[h]}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="border border-border text-center font-black text-white bg-red-600 py-1.5 text-xs sm:text-sm">{totalPerdasFalha > 0 ? totalPerdasFalha : "—"}</td>
              </tr>

              {/* REAL LÍQUIDO */}
              <tr className="bg-green-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-green-400 uppercase text-[10px] sm:text-xs leading-tight">REAL<br/>LÍQUIDO</td>
                {turnoAtual.horas.map(h => {
                  const liq = realLiquidoPorHora[h] || 0;
                  return <td key={h} className="border border-border text-center font-bold text-green-400 py-1.5 text-xs sm:text-sm">{liq > 0 ? liq : "—"}</td>;
                })}
                <td className="border border-border text-center font-black text-white bg-green-600 py-1.5 text-xs sm:text-sm">{producaoLiquida > 0 ? producaoLiquida : "—"}</td>
              </tr>

              {/* NOTA GERAL DO HORÁRIO */}
              <tr className="bg-yellow-500/5">
                <td className="border border-border px-2 py-1 font-black text-yellow-400 uppercase text-[10px] sm:text-xs leading-tight whitespace-nowrap">📝 NOTA<br/>GERAL</td>
                {turnoAtual.horas.map(h => {
                  const nota = hourlyNotesMap[h];
                  return (
                    <td key={h} className="border border-border p-0.5">
                      <button
                        onClick={() => setHourlyNoteHora(h)}
                        className={`w-full min-h-[32px] rounded text-[9px] leading-tight px-1 py-1 text-left transition-all touch-manipulation
                          ${nota?.justificativa ? "text-yellow-200 bg-yellow-500/10 hover:bg-yellow-500/20" : "text-muted-foreground/20 hover:bg-muted/20 text-center"}`}
                      >
                        {nota?.justificativa ? (
                          <span className="flex items-center gap-1">
                            {nota.justificativa.length > 12 ? nota.justificativa.slice(0, 10) + "…" : nota.justificativa}
                            {nota.foto_url && <span className="text-[8px]">📷</span>}
                          </span>
                        ) : <span className="block text-center opacity-40"><MessageSquarePlus className="w-3 h-3 mx-auto" /></span>}
                      </button>
                    </td>
                  );
                })}
                <td className="border border-border" />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
        Toque +1 · 4× rápido zera · Segure digitar · Clique no Objetivo para editar · 💬 para justificativa · Perdas calculadas automaticamente
      </p>
    </div>
  );
}