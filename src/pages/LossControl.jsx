import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, Plus, Minus, ChevronLeft, ChevronRight, Printer, X, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { format, addDays, subDays, parseISO } from "date-fns";

const DEFAULT_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

const TURNOS = [
  { label: "2º Turno (15h–23h45)", key: "segundo",  horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","23:45"] },
  { label: "3º Turno (01h–05h)", key: "terceiro", horas: ["01:00","02:00","03:00","04:00","05:00"] },
  { label: "1º Turno (06h–14h)", key: "primeiro", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
];

const DEFAULT_GANHOS = ["RETRABALHO APROVADO", "HORA EXTRA", "RECUPERAÇÃO"];

export default function LossControl() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTurno, setSelectedTurno] = useState("segundo");
  const [itens, setItens] = useState(DEFAULT_ITEMS);
  const [itensGanho, setItensGanho] = useState(DEFAULT_GANHOS);
  const [novoItem, setNovoItem] = useState("");
  const [novoGanho, setNovoGanho] = useState("");
  const longPressTimers = useRef({});

  const turnoAtual = TURNOS.find(t => t.key === selectedTurno);
  const sheetKey = `loss-sheet-${selectedDate}-${selectedTurno}`;
  const dateLabel = format(parseISO(selectedDate), "dd/MM");

  const { data: allRecords = [] } = useQuery({
    queryKey: [sheetKey],
    queryFn: () => base44.entities.LossControl.filter({ data: selectedDate, turno: selectedTurno }),
  });

  const records = allRecords.filter(r => r.motivo_perda !== "ganho");
  const recordsGanho = allRecords.filter(r => r.motivo_perda === "ganho");

  const optimisticUpdate = (updater) => {
    qc.setQueryData([sheetKey], (old = []) => updater(old));
  };

  // Subscrição em tempo real para ver dados de outros usuários
  useEffect(() => {
    const unsub = base44.entities.LossControl.subscribe(() => {
      qc.invalidateQueries({ queryKey: [sheetKey] });
    });
    return unsub;
  }, [sheetKey]);

  const createCell = useMutation({
    mutationFn: (data) => base44.entities.LossControl.create(data),
    onMutate: (data) => { optimisticUpdate(old => [...old, { ...data, id: `temp-${Date.now()}` }]); },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });
  const updateCell = useMutation({
    mutationFn: ({ id, carros_perdidos }) => base44.entities.LossControl.update(id, { carros_perdidos }),
    onMutate: ({ id, carros_perdidos }) => { optimisticUpdate(old => old.map(r => r.id === id ? { ...r, carros_perdidos } : r)); },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });
  const deleteCell = useMutation({
    mutationFn: (id) => base44.entities.LossControl.delete(id),
    onMutate: (id) => { optimisticUpdate(old => old.filter(r => r.id !== id)); },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });

  // cellMap para perdas (exclui motivo_perda === "ganho")
  const cellMap = {};
  records.filter(r => r.motivo_perda !== "ganho").forEach(r => {
    if (!r.item_perda || !r.hora) return;
    if (!cellMap[r.item_perda]) cellMap[r.item_perda] = {};
    cellMap[r.item_perda][r.hora] = { id: r.id, count: r.carros_perdidos ?? 1 };
  });

  // cellMapGanho para ganhos
  const cellMapGanho = {};
  recordsGanho.forEach(r => {
    if (!r.item_perda || !r.hora) return;
    if (!cellMapGanho[r.item_perda]) cellMapGanho[r.item_perda] = {};
    cellMapGanho[r.item_perda][r.hora] = { id: r.id, count: r.carros_perdidos ?? 1 };
  });

  const saveCell = (item, hora, newVal) => {
    const cell = cellMap[item]?.[hora];
    if (newVal <= 0) { if (cell) deleteCell.mutate(cell.id); return; }
    if (cell) updateCell.mutate({ id: cell.id, carros_perdidos: newVal });
    else createCell.mutate({ item_perda: item, hora, turno: selectedTurno, data: selectedDate, carros_perdidos: newVal, carros_planejados: 0, carros_produzidos: 0, motivo_perda: "outro" });
  };

  const saveCellGanho = (item, hora, newVal) => {
    const cell = cellMapGanho[item]?.[hora];
    if (newVal <= 0) {
      if (cell) deleteCell.mutate(cell.id);
      return;
    }
    if (cell) updateCell.mutate({ id: cell.id, carros_perdidos: newVal });
    else createCell.mutate({ item_perda: item, hora, turno: selectedTurno, data: selectedDate, carros_perdidos: newVal, carros_planejados: 0, carros_produzidos: 0, motivo_perda: "ganho" });
  };

  const handleIncrement = (item, hora) => saveCell(item, hora, (cellMap[item]?.[hora]?.count || 0) + 1);
  const handleDecrement = (item, hora) => saveCell(item, hora, (cellMap[item]?.[hora]?.count || 0) - 1);
  const handleReset = (item, hora) => { const cell = cellMap[item]?.[hora]; if (cell) deleteCell.mutate(cell.id); };

  const handleIncrementGanho = (item, hora) => saveCellGanho(item, hora, (cellMapGanho[item]?.[hora]?.count || 0) + 1);
  const handleDecrementGanho = (item, hora) => saveCellGanho(item, hora, (cellMapGanho[item]?.[hora]?.count || 0) - 1);
  const handleResetGanho = (item, hora) => { const cell = cellMapGanho[item]?.[hora]; if (cell) deleteCell.mutate(cell.id); };

  const startLongPress = (item, hora) => {
    const key = `${item}-${hora}`;
    longPressTimers.current[key] = setTimeout(() => handleReset(item, hora), 800);
  };
  const cancelLongPress = (item, hora) => {
    clearTimeout(longPressTimers.current[`${item}-${hora}`]);
  };
  const startLongPressGanho = (item, hora) => {
    const key = `g-${item}-${hora}`;
    longPressTimers.current[key] = setTimeout(() => handleResetGanho(item, hora), 800);
  };
  const cancelLongPressGanho = (item, hora) => {
    clearTimeout(longPressTimers.current[`g-${item}-${hora}`]);
  };

  // Cálculos perdas
  const totalPorHora = {};
  turnoAtual.horas.forEach(h => {
    totalPorHora[h] = itens.reduce((acc, item) => acc + (cellMap[item]?.[h]?.count || 0), 0);
  });
  const totalPorItem = (item) => turnoAtual.horas.reduce((acc, h) => acc + (cellMap[item]?.[h]?.count || 0), 0);
  const totalGeral = itens.reduce((acc, item) => acc + totalPorItem(item), 0);

  // Cálculos ganhos
  const totalGanhoPorHora = {};
  turnoAtual.horas.forEach(h => {
    totalGanhoPorHora[h] = itensGanho.reduce((acc, item) => acc + (cellMapGanho[item]?.[h]?.count || 0), 0);
  });
  const totalPorItemGanho = (item) => turnoAtual.horas.reduce((acc, h) => acc + (cellMapGanho[item]?.[h]?.count || 0), 0);
  const totalGeralGanho = itensGanho.reduce((acc, item) => acc + totalPorItemGanho(item), 0);

  // Perda real = perdas - ganhos por hora
  const perdaRealPorHora = {};
  turnoAtual.horas.forEach(h => { perdaRealPorHora[h] = Math.max(0, (totalPorHora[h] || 0) - (totalGanhoPorHora[h] || 0)); });
  const totalPerdaReal = Math.max(0, totalGeral - totalGeralGanho);

  const addItem = () => {
    const t = novoItem.trim().toUpperCase();
    if (t && !itens.includes(t)) { setItens(prev => [...prev, t]); setNovoItem(""); }
  };
  const addGanho = () => {
    const t = novoGanho.trim().toUpperCase();
    if (t && !itensGanho.includes(t)) { setItensGanho(prev => [...prev, t]); setNovoGanho(""); }
  };

  const handleExportCsv = () => {
    const headers = ["Item de Perda", ...turnoAtual.horas, "Total"];
    const rows = itens.map(item => [item, ...turnoAtual.horas.map(h => cellMap[item]?.[h]?.count || 0), totalPorItem(item)]);
    rows.push(["TOTAL/HORA", ...turnoAtual.horas.map(h => totalPorHora[h] || 0), totalGeral]);
    exportCsv(`perdas_${selectedDate}_${selectedTurno}`, headers, rows);
  };

  const handlePrint = () => {
    const headerCols = turnoAtual.horas.map(h => `<th>${h}</th>`).join("");
    const rows = itens.map(item => {
      const total = totalPorItem(item);
      const cells = turnoAtual.horas.map(hora => {
        const cell = cellMap[item]?.[hora];
        return `<td class="${cell ? "marked" : ""}">${cell ? (cell.count > 1 ? cell.count : "✓") : ""}</td>`;
      }).join("");
      return `<tr><td class="item-col">${item}</td>${cells}<td class="total-col">${total || ""}</td></tr>`;
    }).join("");
    const totalRowCells = turnoAtual.horas.map(h => `<td>${totalPorHora[h] || ""}</td>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page{size:A4 landscape;margin:10mm}body{font-family:Arial;font-size:8.5px;color:#111}
      h1{font-size:13px;margin:0 0 2px;letter-spacing:2px}p{font-size:9px;color:#666;margin:0 0 8px}
      table{border-collapse:collapse;width:100%}th{background:#e0e0e0;padding:4px 5px;border:1px solid #999;text-align:center;font-size:8px}
      td{padding:3px 4px;border:1px solid #ccc;text-align:center}
      .item-col{text-align:left;min-width:140px} .marked{background:#ffe5e5;color:#cc0000;font-weight:bold}
      .total-col{background:#fde8d8;font-weight:bold;color:#c05800} .total-row td{background:#fde8d8;font-weight:bold}
      .grand{background:#dc2626;color:white;font-weight:bold}
    </style></head><body>
    <h1>CONTROLE DE PERDAS DO TESTOR — ZP7</h1>
    <p>${dateLabel} &nbsp;|&nbsp; ${turnoAtual.label} &nbsp;|&nbsp; Total de perdas: ${totalGeral} carros</p>
    <table><thead><tr><th class="item-col">ITEM DE PERDA</th>${headerCols}<th>TOTAL</th></tr></thead>
    <tbody>${rows}
    <tr class="total-row"><td class="item-col"><strong>TOTAL/HORA</strong></td>${totalRowCells}<td class="grand">${totalGeral}</td></tr>
    </tbody></table>
    <script>window.onload=function(){window.print()}<\/script></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })); a.target = "_blank"; a.click();
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-400" /> Controle de Perdas</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Toque na célula para registrar · de novo para incrementar · 10× para limpar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}><FileSpreadsheet className="w-4 h-4" /> CSV</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}><Printer className="w-4 h-4" /> PDF</Button>
        </div>
      </div>

      {/* Controles */}
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
        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          <Input placeholder="+ Item de perda..." value={novoItem} onChange={e => setNovoItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} className="h-9 text-sm w-40" />
          <Button size="sm" variant="outline" onClick={addItem} disabled={!novoItem.trim()} className="border-red-500/40 text-red-400"><Plus className="w-3.5 h-3.5" /></Button>
          <Input placeholder="+ Item de ganho..." value={novoGanho} onChange={e => setNovoGanho(e.target.value)} onKeyDown={e => e.key === "Enter" && addGanho()} className="h-9 text-sm w-40" />
          <Button size="sm" variant="outline" onClick={addGanho} disabled={!novoGanho.trim()} className="border-green-500/40 text-green-400"><Plus className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* KPIs */}
      {(totalGeral > 0 || totalGeralGanho > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
          <Card className="border-red-500/20"><CardContent className="p-3 text-center">
            <p className="text-3xl font-black text-red-400">{totalGeral}</p>
            <p className="text-xs text-muted-foreground">Perdas Brutas</p>
          </CardContent></Card>
          <Card className="border-green-500/20"><CardContent className="p-3 text-center">
            <p className="text-3xl font-black text-green-400">{totalGeralGanho}</p>
            <p className="text-xs text-muted-foreground">Carros Ganhos</p>
          </CardContent></Card>
          <Card className="border-orange-500/20"><CardContent className="p-3 text-center">
            <p className="text-3xl font-black text-orange-400">{totalPerdaReal}</p>
            <p className="text-xs text-muted-foreground">Perda Real</p>
          </CardContent></Card>
        </div>
      )}

      {/* Planilha */}
      <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + turnoAtual.horas.length * 58}px` }}>
          <thead>
            <tr>
              <th colSpan={turnoAtual.horas.length + 2} className="border border-border bg-red-500/10 px-4 py-2.5 text-center font-black text-sm uppercase tracking-widest text-red-400">
                CONTROLE DE PERDAS — {dateLabel} — {turnoAtual.label}
              </th>
            </tr>
            <tr className="bg-muted/50">
              <th className="border border-border px-3 py-2 text-left font-bold" style={{ minWidth: 200 }}>ITEM DE PERDA</th>
              {turnoAtual.horas.map(h => <th key={h} className="border border-border px-1 py-2 text-center font-bold" style={{ minWidth: 54 }}>{h}</th>)}
              <th className="border border-border px-2 py-2 text-center font-bold bg-red-500/10 text-red-400" style={{ minWidth: 60 }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => {
              const total = totalPorItem(item);
              return (
                <tr key={item} className={`group ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-red-500/5 transition-colors`}>
                  <td className="border border-border px-3 py-1.5 font-medium whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1">
                      <span>{item}</span>
                      <button onClick={() => setItens(prev => prev.filter(i => i !== item))} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1"><X className="w-3 h-3" /></button>
                    </div>
                  </td>
                  {turnoAtual.horas.map(hora => {
                    const cell = cellMap[item]?.[hora];
                    const val = cell?.count || 0;
                    return (
                      <td key={hora} className="border border-border p-1">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onPointerDown={() => startLongPress(item, hora)}
                            onPointerUp={() => { cancelLongPress(item, hora); handleIncrement(item, hora); }}
                            onPointerLeave={() => cancelLongPress(item, hora)}
                            className={`w-full h-10 rounded-md font-black text-base transition-all select-none
                              ${val > 0
                                ? "bg-red-500/20 text-red-300 hover:bg-red-500/35 active:scale-95"
                                : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"
                              }`}
                          >
                            {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
                          </button>
                          {val > 0 && (
                            <button
                              onClick={() => handleDecrement(item, hora)}
                              className="text-muted-foreground/40 hover:text-red-400 transition-colors p-0.5"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="border border-border text-center font-black text-red-400 bg-red-500/5 py-1.5">
                    {total > 0 ? total : ""}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-red-500/10 font-bold">
              <td className="border border-border px-3 py-2 font-black text-red-400 uppercase">TOTAL/HORA</td>
              {turnoAtual.horas.map(h => (
                <td key={h} className="border border-border text-center font-bold text-red-400 py-2">{totalPorHora[h] > 0 ? totalPorHora[h] : "—"}</td>
              ))}
              <td className="border border-border text-center font-black text-white bg-red-600 py-2 text-sm">{totalGeral > 0 ? totalGeral : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tabela de Carros Ganhos */}
      <div className="overflow-x-auto rounded-xl border border-green-500/30 shadow-sm">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + turnoAtual.horas.length * 58}px` }}>
          <thead>
            <tr>
              <th colSpan={turnoAtual.horas.length + 2} className="border border-border bg-green-500/10 px-4 py-2.5 text-center font-black text-sm uppercase tracking-widest text-green-400">
                CARROS GANHOS — {dateLabel} — {turnoAtual.label}
              </th>
            </tr>
            <tr className="bg-muted/50">
              <th className="border border-border px-3 py-2 text-left font-bold" style={{ minWidth: 200 }}>MOTIVO DO GANHO</th>
              {turnoAtual.horas.map(h => <th key={h} className="border border-border px-1 py-2 text-center font-bold" style={{ minWidth: 54 }}>{h}</th>)}
              <th className="border border-border px-2 py-2 text-center font-bold bg-green-500/10 text-green-400" style={{ minWidth: 60 }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {itensGanho.map((item, idx) => {
              const total = totalPorItemGanho(item);
              return (
                <tr key={item} className={`group ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-green-500/5 transition-colors`}>
                  <td className="border border-border px-3 py-1.5 font-medium whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1">
                      <span>{item}</span>
                      <button onClick={() => setItensGanho(prev => prev.filter(i => i !== item))} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1"><X className="w-3 h-3" /></button>
                    </div>
                  </td>
                  {turnoAtual.horas.map(hora => {
                    const cell = cellMapGanho[item]?.[hora];
                    const val = cell?.count || 0;
                    return (
                      <td key={hora} className="border border-border p-1">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onPointerDown={() => startLongPressGanho(item, hora)}
                            onPointerUp={() => { cancelLongPressGanho(item, hora); handleIncrementGanho(item, hora); }}
                            onPointerLeave={() => cancelLongPressGanho(item, hora)}
                            className={`w-full h-10 rounded-md font-black text-base transition-all select-none
                              ${val > 0
                                ? "bg-green-500/20 text-green-300 hover:bg-green-500/35 active:scale-95"
                                : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"
                              }`}
                          >
                            {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
                          </button>
                          {val > 0 && (
                            <button onClick={() => handleDecrementGanho(item, hora)} className="text-muted-foreground/40 hover:text-green-400 transition-colors p-0.5">
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="border border-border text-center font-black text-green-400 bg-green-500/5 py-1.5">
                    {total > 0 ? total : ""}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-green-500/10 font-bold">
              <td className="border border-border px-3 py-2 font-black text-green-400 uppercase">TOTAL GANHOS/HORA</td>
              {turnoAtual.horas.map(h => (
                <td key={h} className="border border-border text-center font-bold text-green-400 py-2">{totalGanhoPorHora[h] > 0 ? totalGanhoPorHora[h] : "—"}</td>
              ))}
              <td className="border border-border text-center font-black text-white bg-green-600 py-2 text-sm">{totalGeralGanho > 0 ? totalGeralGanho : "—"}</td>
            </tr>
            <tr className="bg-orange-500/10 font-bold">
              <td className="border border-border px-3 py-2 font-black text-orange-400 uppercase">PERDA REAL/HORA</td>
              {turnoAtual.horas.map(h => (
                <td key={h} className="border border-border text-center font-bold text-orange-400 py-2">{perdaRealPorHora[h] > 0 ? perdaRealPorHora[h] : "—"}</td>
              ))}
              <td className="border border-border text-center font-black text-white bg-orange-600 py-2 text-sm">{totalPerdaReal > 0 ? totalPerdaReal : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">Toque para +1 · Segure (~1s) para zerar · Use − para diminuir · ✕ na linha para remover item</p>
    </div>
  );
}