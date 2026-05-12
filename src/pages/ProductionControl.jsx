import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, Printer, ChevronLeft, ChevronRight, Plus, Minus, RotateCcw, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { format, addDays, subDays, parseISO } from "date-fns";

const TURNOS = [
  { label: "2º Turno (15h–00h)", key: "segundo",  horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","00:00"] },
  { label: "3º Turno (01h–05h)", key: "terceiro", horas: ["01:00","02:00","03:00","04:00","05:00"] },
  { label: "1º Turno (06h–14h)", key: "primeiro", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
];

export default function ProductionControl() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTurno, setSelectedTurno] = useState("segundo");
  const longPressTimers = useRef({});
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUserEmail(u.email));
  }, []);

  const turnoAtual = TURNOS.find(t => t.key === selectedTurno);
  const sheetKey = `prod-ctrl-${selectedDate}-${selectedTurno}-${userEmail}`;

  const { data: testores = [], isLoading: loadingTestores } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
  });

  const { data: records = [] } = useQuery({
    queryKey: [sheetKey],
    queryFn: () => base44.entities.ProductionControl.filter({ data: selectedDate, turno: selectedTurno, created_by: userEmail }),
    enabled: !!userEmail,
  });

  const { data: losses = [] } = useQuery({
    queryKey: [`loss-${selectedDate}-${selectedTurno}-${userEmail}`],
    queryFn: () => base44.entities.LossControl.filter({ data: selectedDate, turno: selectedTurno, created_by: userEmail }),
    enabled: !!userEmail,
  });

  const optimisticUpdate = (updater) => {
    qc.setQueryData([sheetKey], (old = []) => updater(old));
  };

  const createRec = useMutation({
    mutationFn: (data) => base44.entities.ProductionControl.create(data),
    onMutate: (data) => {
      optimisticUpdate(old => [...old, { ...data, id: `temp-${Date.now()}` }]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });
  const updateRec = useMutation({
    mutationFn: ({ id, carros_produzidos }) => base44.entities.ProductionControl.update(id, { carros_produzidos }),
    onMutate: ({ id, carros_produzidos }) => {
      optimisticUpdate(old => old.map(r => r.id === id ? { ...r, carros_produzidos } : r));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });
  const deleteRec = useMutation({
    mutationFn: (id) => base44.entities.ProductionControl.delete(id),
    onMutate: (id) => {
      optimisticUpdate(old => old.filter(r => r.id !== id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });

  // cellMap: testor_id -> hora -> { id, value }
  const cellMap = {};
  records.forEach(r => {
    if (!r.testor_id || !r.hora) return;
    if (!cellMap[r.testor_id]) cellMap[r.testor_id] = {};
    cellMap[r.testor_id][r.hora] = { id: r.id, value: r.carros_produzidos ?? 0 };
  });

  const saveCell = (testor, hora, newVal) => {
    const cell = cellMap[testor.id]?.[hora];
    if (newVal <= 0) {
      if (cell) deleteRec.mutate(cell.id);
      return;
    }
    if (cell) updateRec.mutate({ id: cell.id, carros_produzidos: newVal });
    else createRec.mutate({ testor_id: testor.id, testor_nome: testor.nome, data: selectedDate, turno: selectedTurno, hora, carros_produzidos: newVal });
  };

  const handleIncrement = (testor, hora) => {
    const cell = cellMap[testor.id]?.[hora];
    const current = cell?.value || 0;
    saveCell(testor, hora, current + 1);
  };

  const handleDecrement = (testor, hora) => {
    const cell = cellMap[testor.id]?.[hora];
    const current = cell?.value || 0;
    saveCell(testor, hora, current - 1);
  };

  const handleReset = (testor, hora) => {
    const cell = cellMap[testor.id]?.[hora];
    if (cell) deleteRec.mutate(cell.id);
  };

  // Long press to reset
  const startLongPress = (testor, hora) => {
    const key = `${testor.id}-${hora}`;
    longPressTimers.current[key] = setTimeout(() => handleReset(testor, hora), 800);
  };
  const cancelLongPress = (testor, hora) => {
    const key = `${testor.id}-${hora}`;
    clearTimeout(longPressTimers.current[key]);
  };

  // Cálculos
  const totalPorHora = {};
  turnoAtual.horas.forEach(h => {
    totalPorHora[h] = testores.reduce((acc, t) => acc + (cellMap[t.id]?.[h]?.value || 0), 0);
  });

  const totalPorTestor = (t) => turnoAtual.horas.reduce((acc, h) => acc + (cellMap[t.id]?.[h]?.value || 0), 0);
  const totalGeral = testores.reduce((acc, t) => acc + totalPorTestor(t), 0);
  const totalPerdas = losses.reduce((acc, l) => acc + (l.carros_perdidos || 0), 0);
  const producaoLiquida = Math.max(0, totalGeral - totalPerdas);

  const handleExportCsv = () => {
    const headers = ["Testor", ...turnoAtual.horas, "Total"];
    const rows = testores.map(t => [t.nome, ...turnoAtual.horas.map(h => cellMap[t.id]?.[h]?.value || 0), totalPorTestor(t)]);
    rows.push(["TOTAL/HORA", ...turnoAtual.horas.map(h => totalPorHora[h] || 0), totalGeral]);
    exportCsv(`producao_${selectedDate}_${selectedTurno}`, headers, rows);
  };

  const handlePrint = () => {
    const dateLabel = format(parseISO(selectedDate), "dd/MM/yyyy");
    const headerCols = turnoAtual.horas.map(h => `<th>${h}</th>`).join("");
    const rows = testores.map(t => {
      const total = totalPorTestor(t);
      const cells = turnoAtual.horas.map(h => { const v = cellMap[t.id]?.[h]?.value || 0; return `<td>${v > 0 ? v : ""}</td>`; }).join("");
      return `<tr><td class="name">${t.nome}</td>${cells}<td class="total-col">${total || ""}</td></tr>`;
    }).join("");
    const totalRowCells = turnoAtual.horas.map(h => `<td>${totalPorHora[h] || ""}</td>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;font-size:9px;color:#111}
    h1{font-size:13px;margin:0 0 2px;letter-spacing:2px}p{font-size:9px;color:#666;margin:0 0 8px}
    table{border-collapse:collapse;width:100%} th{background:#e0e0e0;padding:4px 6px;border:1px solid #999;text-align:center;font-size:8px}
    td{padding:3px 5px;border:1px solid #ccc;text-align:center;font-size:9px}
    .name{text-align:left;min-width:120px} .total-col{background:#dbeafe;font-weight:bold;color:#1d4ed8}
    .total-row td{background:#bfdbfe;font-weight:bold} .grand{background:#1d4ed8;color:white;font-weight:bold}
    </style></head><body>
    <h1>CONTROLE DE PRODUÇÃO — ZP7</h1>
    <p>${dateLabel} &nbsp;|&nbsp; ${turnoAtual.label} &nbsp;|&nbsp; Total: ${totalGeral} carros &nbsp;|&nbsp; Perdas: ${totalPerdas} &nbsp;|&nbsp; Líquido: ${producaoLiquida}</p>
    <table><thead><tr><th>TESTOR</th>${headerCols}<th>TOTAL</th></tr></thead>
    <tbody>${rows}
    <tr class="total-row"><td class="name"><strong>TOTAL/HORA</strong></td>${totalRowCells}<td class="grand">${totalGeral}</td></tr>
    </tbody></table>
    <script>window.onload=function(){window.print()}<\/script></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })); a.target = "_blank"; a.click();
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Factory className="w-5 h-5 text-blue-400" /> Controle de Produção</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Toque na célula para incrementar · Segure para zerar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}><FileSpreadsheet className="w-4 h-4" /> CSV</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}><Printer className="w-4 h-4" /> PDF</Button>
        </div>
      </div>

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

      {totalGeral > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Produção Bruta", value: totalGeral, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
            { label: "Perdas no Turno", value: totalPerdas, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            { label: "Produção Líquida", value: producaoLiquida, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          ].map(k => (
            <Card key={k.label} className={`border ${k.bg}`}>
              <CardContent className="p-3 text-center">
                <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loadingTestores ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />)}</div>
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
                  CONTROLE DE PRODUÇÃO — {format(parseISO(selectedDate), "dd/MM")} — {turnoAtual.label}
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
                  <tr key={testor.id} className={`${idx % 2 === 0 ? "bg-card" : "bg-muted/10"}`}>
                    <td className="border border-border px-3 py-1.5 font-semibold whitespace-nowrap text-sm">{testor.nome}</td>
                    {turnoAtual.horas.map(hora => {
                      const cell = cellMap[testor.id]?.[hora];
                      const val = cell?.value || 0;
                      return (
                        <td key={hora} className="border border-border p-1">
                          <div className="flex flex-col items-center gap-0.5">
                            {/* Valor — clique para +1, segure para zerar */}
                            <button
                              onPointerDown={() => startLongPress(testor, hora)}
                              onPointerUp={() => { cancelLongPress(testor, hora); handleIncrement(testor, hora); }}
                              onPointerLeave={() => cancelLongPress(testor, hora)}
                              className={`w-full h-10 rounded-md font-black text-base transition-all select-none
                                ${val > 0
                                  ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/35 active:scale-95"
                                  : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"
                                }`}
                            >
                              {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
                            </button>
                            {/* Subtração rápida */}
                            {val > 0 && (
                              <button
                                onClick={() => handleDecrement(testor, hora)}
                                className="text-muted-foreground/40 hover:text-red-400 transition-colors p-0.5"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="border border-border px-2 py-2 text-center font-black text-blue-400 bg-blue-500/5 text-sm">
                      {total > 0 ? total : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-blue-500/10 font-bold">
                <td className="border border-border px-3 py-2 font-black text-blue-400 uppercase text-xs">TOTAL/HORA</td>
                {turnoAtual.horas.map(h => (
                  <td key={h} className="border border-border text-center font-bold text-blue-400 py-2 text-sm">{totalPorHora[h] > 0 ? totalPorHora[h] : "—"}</td>
                ))}
                <td className="border border-border text-center font-black text-white bg-blue-600 py-2 text-sm">{totalGeral > 0 ? totalGeral : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Toque para +1 · Segure (~1s) para zerar · Use − para diminuir</p>
    </div>
  );
}