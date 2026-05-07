import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TrendingDown, Download, Plus, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const DEFAULT_ITEMS = [
  "COMANDO VALVULA (PRÉ)",
  "CAMBIO AUT. (PRÉ)",
  "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)",
  "BOX ZP6",
  "SISTEMA FIS",
  "TORQUE LINHA",
  "TORQUE FAROL",
  "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)",
  "BZD",
  "AJUSTE",
  "FREIO",
  "GEOMETRIA",
  "COMANDO AC",
  "R2 LINHA",
  "FALHA IDT",
  "SIST FIS (PINT)",
];

const TURNOS = [
  { label: "2º Turno (15h–00h)", key: "segundo",   horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","00:00"] },
  { label: "3º Turno (01h–05h)", key: "terceiro",  horas: ["01:00","02:00","03:00","04:00","05:00"] },
  { label: "1º Turno (06h–14h)", key: "primeiro",  horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
];

export default function LossControl() {
  const qc = useQueryClient();
  const printRef = useRef(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const [selectedDate, setSelectedDate]   = useState(today);
  const [selectedTurno, setSelectedTurno] = useState("segundo");
  const [itens, setItens]                 = useState(DEFAULT_ITEMS);
  const [novoItem, setNovoItem]           = useState("");

  const turnoAtual = TURNOS.find(t => t.key === selectedTurno);
  const sheetKey   = `loss-sheet-${selectedDate}-${selectedTurno}`;
  const dateLabel  = format(parseISO(selectedDate), "dd/MM");

  const { data: records = [] } = useQuery({
    queryKey: [sheetKey],
    queryFn: () => base44.entities.LossControl.filter({ data: selectedDate, turno: selectedTurno }),
  });

  const createCell = useMutation({
    mutationFn: (data) => base44.entities.LossControl.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });
  const updateCell = useMutation({
    mutationFn: ({ id, carros_perdidos }) => base44.entities.LossControl.update(id, { carros_perdidos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });
  const deleteCell = useMutation({
    mutationFn: (id) => base44.entities.LossControl.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });

  // Build cell map: item_perda -> hora -> { id, count }
  const cellMap = {};
  records.forEach(r => {
    if (!r.item_perda || !r.hora) return;
    if (!cellMap[r.item_perda]) cellMap[r.item_perda] = {};
    cellMap[r.item_perda][r.hora] = { id: r.id, count: r.carros_perdidos ?? 1 };
  });

  const handleCellClick = (item, hora) => {
    const cell = cellMap[item]?.[hora];
    if (cell) {
      const next = cell.count + 1;
      if (next > 9) {
        deleteCell.mutate(cell.id);
      } else {
        updateCell.mutate({ id: cell.id, carros_perdidos: next });
      }
    } else {
      createCell.mutate({
        item_perda: item,
        hora,
        turno: selectedTurno,
        data: selectedDate,
        carros_perdidos: 1,
        carros_planejados: 0,
        carros_produzidos: 0,
        motivo_perda: "outro",
      });
    }
  };

  const handlePrint = () => {
    const style = `
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; background: white; color: black; margin: 0; }
        table { border-collapse: collapse; width: 100%; font-size: 9px; }
        th, td { border: 1px solid #333; padding: 3px 5px; text-align: center; }
        th { background: #e0e0e0; font-weight: bold; }
        .item-col { text-align: left; min-width: 140px; font-size: 8.5px; }
        .title-row th { font-size: 13px; font-weight: 900; letter-spacing: 2px; background: #f5f5f5; }
        .marked { background: #ffe5e5; font-weight: bold; color: #cc0000; }
      </style>
    `;

    const rows = itens.map(item => {
      const cells = turnoAtual.horas.map(hora => {
        const cell = cellMap[item]?.[hora];
        return `<td class="${cell ? "marked" : ""}">${cell ? (cell.count > 1 ? cell.count : "✓") : ""}</td>`;
      }).join("");
      return `<tr><td class="item-col">${item}</td>${cells}</tr>`;
    }).join("");

    const headerCols = turnoAtual.horas.map(h => `<th>${h}</th>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${style}</head><body>
      <table>
        <thead>
          <tr class="title-row">
            <th colspan="${turnoAtual.horas.length + 1}">
              CONTROLE DE PERDAS DO TESTOR &nbsp;&nbsp;&nbsp; ${dateLabel} &nbsp;&nbsp; ${turnoAtual.label}
            </th>
          </tr>
          <tr><th class="item-col">ITEM</th>${headerCols}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload = function() { window.print(); }<\/script>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const addItem = () => {
    const trimmed = novoItem.trim().toUpperCase();
    if (trimmed && !itens.includes(trimmed)) {
      setItens(prev => [...prev, trimmed]);
      setNovoItem("");
    }
  };

  const removeItem = (item) => setItens(prev => prev.filter(i => i !== item));

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            Controle de Perdas
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Toque na célula para registrar · de novo para incrementar · 10× para limpar
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
          <Printer className="w-4 h-4" /> PDF
        </Button>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg px-2 py-1 w-full sm:w-auto">
          <button
            onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1 hover:text-primary rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border-0 bg-transparent h-7 flex-1 sm:w-36 text-sm text-center p-0 focus-visible:ring-0"
          />
          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1 hover:text-primary rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <Select value={selectedTurno} onValueChange={setSelectedTurno}>
          <SelectTrigger className="h-9 w-full sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TURNOS.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 sm:ml-auto">
          <Input
            placeholder="Novo item..."
            value={novoItem}
            onChange={e => setNovoItem(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            className="h-9 flex-1 text-sm"
          />
          <Button size="sm" variant="outline" onClick={addItem} disabled={!novoItem.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Planilha */}
      <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + turnoAtual.horas.length * 60}px` }}>
          <thead>
            {/* Título */}
            <tr>
              <th
                colSpan={turnoAtual.horas.length + 1}
                className="border border-border bg-muted/80 px-4 py-2.5 text-center font-black text-sm tracking-widest uppercase"
              >
                CONTROLE DE PERDAS DO TESTOR
                <span className="ml-4 text-primary font-bold text-base">{dateLabel}</span>
                <span className="ml-3 text-muted-foreground font-normal text-xs">{turnoAtual.label}</span>
              </th>
            </tr>
            {/* Cabeçalho de horas */}
            <tr className="bg-muted/50">
              <th className="border border-border px-3 py-2 text-left font-bold text-xs" style={{ minWidth: 200 }}>
                ITEM
              </th>
              {turnoAtual.horas.map(h => (
                <th key={h} className="border border-border px-1 py-2 text-center font-bold text-xs" style={{ minWidth: 56 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => (
              <tr key={item} className={`group ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-primary/5 transition-colors`}>
                <td className="border border-border px-3 py-1.5 font-medium text-xs whitespace-nowrap flex items-center justify-between gap-1">
                  <span>{item}</span>
                  <button
                    onClick={() => removeItem(item)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-[10px] leading-none ml-1"
                    title="Remover item"
                  >✕</button>
                </td>
                {turnoAtual.horas.map(hora => {
                  const cell = cellMap[item]?.[hora];
                  return (
                    <td
                      key={hora}
                      onClick={() => handleCellClick(item, hora)}
                      title={cell ? `${cell.count} perda(s) — clique para incrementar` : "Clique para registrar perda"}
                      className={`border border-border text-center cursor-pointer select-none transition-all h-8 text-sm font-bold ${
                        cell
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/35"
                          : "hover:bg-primary/15 text-transparent"
                      }`}
                    >
                      {cell ? (cell.count > 1 ? cell.count : "✓") : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border border-border/40 rounded-lg px-4 py-2.5 bg-muted/20">
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 bg-red-500/20 border border-red-500/30 rounded flex items-center justify-center text-red-400 font-bold text-[10px]">✓</span> 1 perda</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 bg-red-500/20 border border-red-500/30 rounded flex items-center justify-center text-red-400 font-bold text-[10px]">3</span> múltiplas perdas</span>
        <span>· Célula vazia = sem perda</span>
        <span>Clique 10× na célula para apagar</span>
        <span>Passe o mouse sobre o item e clique ✕ para remover a linha</span>
      </div>
    </div>
  );
}