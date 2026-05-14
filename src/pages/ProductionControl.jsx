import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, Printer, ChevronLeft, ChevronRight, Plus, Minus, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { format, addDays, subDays, parseISO } from "date-fns";

const TURNOS = [
  { label: "2º Turno (15h–23h45)", key: "segundo",  horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","23:45"] },
  { label: "3º Turno (01h–05h)",   key: "terceiro", horas: ["01:00","02:00","03:00","04:00","05:00"] },
  { label: "1º Turno (06h–14h)",   key: "primeiro", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
];

export default function ProductionControl() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTurno, setSelectedTurno] = useState("segundo");
  const [editingCell, setEditingCell] = useState(null);
  const longPressTimers = useRef({});
  const clickCounters = useRef({});
  const clickTimers = useRef({});
  const longPressTriggered = useRef({});

  const turnoAtual = TURNOS.find(t => t.key === selectedTurno);
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
  const { data: losses = [] } = useQuery({
    queryKey: [`loss-${selectedDate}-${selectedTurno}`],
    queryFn: () => base44.entities.LossControl.filter({ data: selectedDate, turno: selectedTurno }),
  });

  useEffect(() => {
    const unsub = base44.entities.ProductionControl.subscribe(() => qc.invalidateQueries({ queryKey: [sheetKey] }));
    return unsub;
  }, [sheetKey]);

  const optimisticUpdate = (updater) => qc.setQueryData([sheetKey], (old = []) => updater(old));

  const createRec = useMutation({
    mutationFn: (data) => base44.entities.ProductionControl.create(data),
    onMutate: (data) => optimisticUpdate(old => [...old, { ...data, id: `temp-${Date.now()}` }]),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });
  const updateRec = useMutation({
    mutationFn: ({ id, carros_produzidos }) => base44.entities.ProductionControl.update(id, { carros_produzidos }),
    onMutate: ({ id, carros_produzidos }) => optimisticUpdate(old => old.map(r => r.id === id ? { ...r, carros_produzidos } : r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });
  const deleteRec = useMutation({
    mutationFn: (id) => base44.entities.ProductionControl.delete(id),
    onMutate: (id) => optimisticUpdate(old => old.filter(r => r.id !== id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });

  const cellMap = {};
  records.forEach(r => {
    if (!r.testor_id || !r.hora) return;
    if (!cellMap[r.testor_id]) cellMap[r.testor_id] = {};
    cellMap[r.testor_id][r.hora] = { id: r.id, value: r.carros_produzidos ?? 0 };
  });

  const saveCell = (testor, hora, newVal) => {
    const cell = cellMap[testor.id]?.[hora];
    if (newVal <= 0) { if (cell) deleteRec.mutate(cell.id); return; }
    if (cell) updateRec.mutate({ id: cell.id, carros_produzidos: newVal });
    else createRec.mutate({ testor_id: testor.id, testor_nome: testor.nome, data: selectedDate, turno: selectedTurno, hora, carros_produzidos: newVal });
  };

  const startLongPress = (testor, hora) => {
    const key = `${testor.id}-${hora}`;
    longPressTriggered.current[key] = false;
    longPressTimers.current[key] = setTimeout(() => {
      longPressTriggered.current[key] = true;
      const cell = cellMap[testor.id]?.[hora];
      setEditingCell({ testorId: testor.id, testor, hora, value: String(cell?.value || "") });
    }, 600);
  };
  const cancelLongPress = (testor, hora) => clearTimeout(longPressTimers.current[`${testor.id}-${hora}`]);

  const handleIncrementWithReset = (testor, hora) => {
    const key = `${testor.id}-${hora}`;
    if (longPressTriggered.current[key]) return;
    clickCounters.current[key] = (clickCounters.current[key] || 0) + 1;
    clearTimeout(clickTimers.current[key]);
    if (clickCounters.current[key] >= 4) {
      clickCounters.current[key] = 0;
      const cell = cellMap[testor.id]?.[hora];
      if (cell) deleteRec.mutate(cell.id);
      return;
    }
    clickTimers.current[key] = setTimeout(() => { clickCounters.current[key] = 0; }, 600);
    const cell = cellMap[testor.id]?.[hora];
    saveCell(testor, hora, (cell?.value || 0) + 1);
  };

  const confirmEditCell = () => {
    if (!editingCell) return;
    const num = parseInt(editingCell.value, 10);
    if (!isNaN(num)) saveCell(editingCell.testor, editingCell.hora, num);
    setEditingCell(null);
  };

  const totalPorHora = {};
  turnoAtual.horas.forEach(h => {
    totalPorHora[h] = testores.reduce((acc, t) => acc + (cellMap[t.id]?.[h]?.value || 0), 0);
  });
  const perdasPorHora = {};
  turnoAtual.horas.forEach(h => {
    const brutas = losses.filter(l => l.hora === h && l.motivo_perda !== "ganho").reduce((acc, l) => acc + (l.carros_perdidos || 0), 0);
    const ganhos = losses.filter(l => l.hora === h && l.motivo_perda === "ganho").reduce((acc, l) => acc + (l.carros_perdidos || 0), 0);
    perdasPorHora[h] = Math.max(0, brutas - ganhos);
  });
  const totalPorTestor = (t) => turnoAtual.horas.reduce((acc, h) => acc + (cellMap[t.id]?.[h]?.value || 0), 0);
  const totalGeral = testores.reduce((acc, t) => acc + totalPorTestor(t), 0);
  const totalPerdasBrutas = losses.filter(l => l.motivo_perda !== "ganho").reduce((acc, l) => acc + (l.carros_perdidos || 0), 0);
  const totalGanhos = losses.filter(l => l.motivo_perda === "ganho").reduce((acc, l) => acc + (l.carros_perdidos || 0), 0);
  const totalPerdas = Math.max(0, totalPerdasBrutas - totalGanhos);
  const producaoLiquida = Math.max(0, totalGeral - totalPerdas);

  const handleExportCsv = () => {
    const headers = ["Testor", ...turnoAtual.horas, "Total"];
    const rows = testores.map(t => [t.nome, ...turnoAtual.horas.map(h => cellMap[t.id]?.[h]?.value || 0), totalPorTestor(t)]);
    rows.push(["TOTAL/HORA", ...turnoAtual.horas.map(h => totalPorHora[h] || 0), totalGeral]);
    exportCsv(`producao_${selectedDate}_${selectedTurno}`, headers, rows);
  };

  const handlePrint = () => {
    const now = new Date().toLocaleString("pt-BR");
    const efic = totalGeral > 0 ? Math.round(((totalGeral - totalPerdas) / totalGeral) * 100) : 0;
    const headerCols = turnoAtual.horas.map(h => `<th>${h}</th>`).join("");
    const rows = testores.map(t => {
      const total = totalPorTestor(t);
      const cells = turnoAtual.horas.map(h => {
        const v = cellMap[t.id]?.[h]?.value || 0;
        return `<td style="${v > 0 ? "color:#1d4ed8;font-weight:700" : "color:#cbd5e1"}">${v > 0 ? v : "—"}</td>`;
      }).join("");
      return `<tr><td class="name">${t.nome}</td>${cells}<td class="total-col">${total > 0 ? total : "—"}</td></tr>`;
    }).join("");
    const totalRowCells = turnoAtual.horas.map(h => `<td>${totalPorHora[h] > 0 ? totalPorHora[h] : "—"}</td>`).join("");
    const perdasRowCells = turnoAtual.horas.map(h => `<td>${perdasPorHora[h] > 0 ? perdasPorHora[h] : "—"}</td>`).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Controle de Produção ZP7 — ${dateLabel}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm 12mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; color: #1e293b; background: #fff; }
      .header {
        background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 70%, #1e1b4b 100%);
        color: white; padding: 14px 20px; border-radius: 10px; margin-bottom: 12px;
        display: flex; justify-content: space-between; align-items: center;
      }
      .header-title { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
      .header-sub { font-size: 8px; opacity: 0.7; margin-top: 3px; }
      .header-badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 6px 14px; font-size: 10px; font-weight: 700; text-align: center; }
      .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
      .kpi { border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; }
      .kpi-val { font-size: 22px; font-weight: 900; line-height: 1; margin-bottom: 3px; }
      .kpi-lbl { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
      .efic-bar { margin: 0 0 14px; padding: 10px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; }
      .efic-label { display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: #0369a1; margin-bottom: 5px; }
      .efic-track { background: #e0f2fe; border-radius: 6px; height: 10px; overflow: hidden; }
      .efic-fill { height: 10px; border-radius: 6px; background: linear-gradient(90deg, #2563eb, #16a34a); }
      table { border-collapse: collapse; width: 100%; }
      .section-hdr { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg,#1d4ed8,#2563eb); color: white; padding: 7px 12px; border-radius: 6px 6px 0 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
      th { background: #1e40af; color: white; padding: 5px 6px; text-align: center; font-size: 8px; font-weight: 700; border: 1px solid rgba(255,255,255,0.1); }
      th.name { text-align: left; }
      td { padding: 4px 5px; border: 1px solid #e2e8f0; font-size: 8.5px; text-align: center; }
      td.name { text-align: left; font-weight: 600; min-width: 120px; }
      td.total-col { background: #eff6ff; color: #1d4ed8; font-weight: 900; border-left: 2px solid #bfdbfe; }
      tr:nth-child(even) td { background: #f8fafc; }
      .total-row td { background: #dbeafe; font-weight: 900; color: #1e40af; border-top: 2px solid #93c5fd; }
      .perdas-row td { background: #fee2e2; font-weight: 900; color: #991b1b; }
      .grand-blue { background: #1d4ed8 !important; color: white !important; }
      .grand-red { background: #dc2626 !important; color: white !important; }
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
      <div class="kpi"><div class="kpi-val" style="color:#1d4ed8">${totalGeral}</div><div class="kpi-lbl">Produção Bruta</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#dc2626">${totalPerdas}</div><div class="kpi-lbl">Perdas Reais</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#16a34a">${producaoLiquida}</div><div class="kpi-lbl">Produção Líquida</div></div>
      <div class="kpi"><div class="kpi-val" style="color:${efic>=80?'#16a34a':'#dc2626'}">${efic}%</div><div class="kpi-lbl">Eficiência</div></div>
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
        <tr class="total-row"><td class="name"><strong>TOTAL/HORA</strong></td>${totalRowCells}<td class="grand-blue">${totalGeral > 0 ? totalGeral : "—"}</td></tr>
        <tr class="perdas-row"><td class="name"><strong>PERDAS/HORA</strong></td>${perdasRowCells}<td class="grand-red">${totalPerdas > 0 ? totalPerdas : "—"}</td></tr>
      </tbody>
    </table>
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
      {/* Modal edição */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingCell(null)}>
          <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-72 mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">{editingCell.testor?.nome} · {editingCell.hora}</p>
            <p className="text-xs text-muted-foreground mb-3">Digite a quantidade de carros</p>
            <input
              autoFocus type="number" min="0"
              value={editingCell.value}
              onChange={e => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") confirmEditCell(); if (e.key === "Escape") setEditingCell(null); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-3xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingCell(null)} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
              <button onClick={confirmEditCell} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Factory className="w-5 h-5 text-blue-400" /> Controle de Produção</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Toque para +1 · 4× rápido zera · Segure para digitar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv}><FileSpreadsheet className="w-4 h-4" /><span className="hidden sm:inline">CSV</span></Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}><Printer className="w-4 h-4" /><span className="hidden sm:inline">PDF</span></Button>
        </div>
      </div>

      {/* Controles data/turno */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg px-2 py-1">
          <button onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))} className="p-1 hover:text-primary rounded"><ChevronLeft className="w-4 h-4" /></button>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border-0 bg-transparent h-7 w-32 text-sm text-center p-0 focus-visible:ring-0" />
          <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))} className="p-1 hover:text-primary rounded"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <Select value={selectedTurno} onValueChange={setSelectedTurno}>
          <SelectTrigger className="h-9 w-full sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>{TURNOS.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      {totalGeral > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Produção Bruta", value: totalGeral, color: "text-blue-400", border: "border-blue-500/20" },
            { label: "Perdas no Turno", value: totalPerdas, color: "text-red-400", border: "border-red-500/20" },
            { label: "Produção Líquida", value: producaoLiquida, color: "text-green-400", border: "border-green-500/20" },
          ].map(k => (
            <Card key={k.label} className={`border ${k.border}`}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl sm:text-3xl font-black ${k.color}`}>{k.value}</p>
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
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${180 + turnoAtual.horas.length * 80}px` }}>
            <thead>
              <tr>
                <th colSpan={turnoAtual.horas.length + 2} className="border border-border bg-blue-600/20 px-4 py-2.5 text-center font-black text-sm uppercase tracking-widest text-blue-400">
                  CONTROLE DE PRODUÇÃO — {dateLabel} — {turnoAtual.label}
                </th>
              </tr>
              <tr className="bg-muted/50">
                <th className="border border-border px-3 py-2 text-left font-bold" style={{ minWidth: 140 }}>TESTOR</th>
                {turnoAtual.horas.map(h => <th key={h} className="border border-border px-1 py-2 text-center font-bold" style={{ minWidth: 76 }}>{h}</th>)}
                <th className="border border-border px-2 py-2 text-center font-bold bg-blue-500/10 text-blue-400" style={{ minWidth: 70 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {testores.map((testor, idx) => {
                const total = totalPorTestor(testor);
                return (
                  <tr key={testor.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                    <td className="border border-border px-3 py-1.5 font-semibold whitespace-nowrap text-sm">{testor.nome}</td>
                    {turnoAtual.horas.map(hora => {
                      const cell = cellMap[testor.id]?.[hora];
                      const val = cell?.value || 0;
                      return (
                        <td key={hora} className="border border-border p-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onPointerDown={() => startLongPress(testor, hora)}
                              onPointerUp={() => { cancelLongPress(testor, hora); handleIncrementWithReset(testor, hora); }}
                              onPointerLeave={() => cancelLongPress(testor, hora)}
                              className={`w-full h-10 rounded-md font-black text-base transition-all select-none
                                ${val > 0 ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/35 active:scale-95" : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"}`}
                            >
                              {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
                            </button>
                            {val > 0 && (
                              <button onClick={() => saveCell(testor, hora, val - 1)} className="text-muted-foreground/40 hover:text-red-400 transition-colors p-0.5">
                                <Minus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="border border-border px-2 py-2 text-center font-black text-blue-400 bg-blue-500/5 text-sm">{total > 0 ? total : "—"}</td>
                  </tr>
                );
              })}
              <tr className="bg-blue-500/10 font-bold">
                <td className="border border-border px-3 py-2 font-black text-blue-400 uppercase text-xs">TOTAL/HORA</td>
                {turnoAtual.horas.map(h => <td key={h} className="border border-border text-center font-bold text-blue-400 py-2 text-sm">{totalPorHora[h] > 0 ? totalPorHora[h] : "—"}</td>)}
                <td className="border border-border text-center font-black text-white bg-blue-600 py-2 text-sm">{totalGeral > 0 ? totalGeral : "—"}</td>
              </tr>
              <tr className="bg-red-500/10 font-bold">
                <td className="border border-border px-3 py-2 font-black text-red-400 uppercase text-xs">PERDAS/HORA</td>
                {turnoAtual.horas.map(h => <td key={h} className="border border-border text-center font-bold text-red-400 py-2 text-sm">{perdasPorHora[h] > 0 ? perdasPorHora[h] : "—"}</td>)}
                <td className="border border-border text-center font-black text-white bg-red-600 py-2 text-sm">{totalPerdas > 0 ? totalPerdas : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Toque para +1 · 4× rápido para zerar · Segure para digitar número · − para diminuir</p>
    </div>
  );
}