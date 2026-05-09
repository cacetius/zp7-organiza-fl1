import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Factory, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const TURNOS = [
  { label: "2º Turno (15h–00h)", key: "segundo",  horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","00:00"] },
  { label: "3º Turno (01h–05h)", key: "terceiro", horas: ["01:00","02:00","03:00","04:00","05:00"] },
  { label: "1º Turno (06h–14h)", key: "primeiro", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
];

export default function ProductionControl() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [selectedDate, setSelectedDate]   = useState(today);
  const [selectedTurno, setSelectedTurno] = useState("segundo");

  const turnoAtual = TURNOS.find(t => t.key === selectedTurno);
  const dateLabel  = format(parseISO(selectedDate), "dd/MM/yyyy");
  const sheetKey   = `prod-ctrl-${selectedDate}-${selectedTurno}`;

  // Busca testores cadastrados
  const { data: testores = [], isLoading: loadingTestores } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
  });

  // Busca registros de produção para a data/turno
  const { data: records = [] } = useQuery({
    queryKey: [sheetKey],
    queryFn: () => base44.entities.ProductionControl.filter({ data: selectedDate, turno: selectedTurno }),
  });

  const createRec = useMutation({
    mutationFn: (data) => base44.entities.ProductionControl.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });

  const updateRec = useMutation({
    mutationFn: ({ id, carros_produzidos }) => base44.entities.ProductionControl.update(id, { carros_produzidos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });

  const deleteRec = useMutation({
    mutationFn: (id) => base44.entities.ProductionControl.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKey] }),
  });

  // Mapa: testor_id -> hora -> { id, carros_produzidos }
  const cellMap = {};
  records.forEach(r => {
    if (!r.testor_id || !r.hora) return;
    if (!cellMap[r.testor_id]) cellMap[r.testor_id] = {};
    cellMap[r.testor_id][r.hora] = { id: r.id, value: r.carros_produzidos ?? 0 };
  });

  const handleCellChange = (testor, hora, rawVal) => {
    const val = rawVal === "" ? "" : Number(rawVal);
    const cell = cellMap[testor.id]?.[hora];

    if (rawVal === "" || rawVal === "0" || val === 0) {
      if (cell) deleteRec.mutate(cell.id);
      return;
    }

    if (cell) {
      updateRec.mutate({ id: cell.id, carros_produzidos: val });
    } else {
      createRec.mutate({
        testor_id: testor.id,
        testor_nome: testor.nome,
        data: selectedDate,
        turno: selectedTurno,
        hora,
        carros_produzidos: val,
      });
    }
  };

  // Totais por hora (soma de todos os testores)
  const totalPorHora = {};
  turnoAtual.horas.forEach(h => {
    totalPorHora[h] = testores.reduce((acc, t) => acc + (cellMap[t.id]?.[h]?.value || 0), 0);
  });

  // Total geral por testor
  const totalPorTestor = (testor) =>
    turnoAtual.horas.reduce((acc, h) => acc + (cellMap[testor.id]?.[h]?.value || 0), 0);

  // Total geral
  const totalGeral = testores.reduce((acc, t) => acc + totalPorTestor(t), 0);

  // Exportar PDF/Planilha
  const handlePrint = () => {
    const style = `
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; background: white; color: black; margin: 0; font-size: 9px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 3px 6px; text-align: center; }
        th { background: #e0e0e0; font-weight: bold; }
        .testor-col { text-align: left; min-width: 130px; }
        .title-row th { font-size: 13px; font-weight: 900; letter-spacing: 2px; background: #f5f5f5; padding: 8px; }
        .total-row td { background: #dbeafe; font-weight: bold; }
        .total-col { background: #e0f2fe; font-weight: bold; }
        .grand-total { background: #2563eb; color: white; font-weight: bold; }
      </style>
    `;

    const headerCols = turnoAtual.horas.map(h => `<th>${h}</th>`).join("");

    const rows = testores.map(t => {
      const total = totalPorTestor(t);
      const cells = turnoAtual.horas.map(h => {
        const val = cellMap[t.id]?.[h]?.value || 0;
        return `<td>${val > 0 ? val : ""}</td>`;
      }).join("");
      return `<tr>
        <td class="testor-col">${t.nome}</td>
        ${cells}
        <td class="total-col">${total}</td>
      </tr>`;
    }).join("");

    const totalRow = turnoAtual.horas.map(h => `<td class="total-row">${totalPorHora[h] || ""}</td>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${style}</head><body>
      <table>
        <thead>
          <tr class="title-row">
            <th colspan="${turnoAtual.horas.length + 2}">
              CONTROLE DE PRODUÇÃO — ZP7 &nbsp;&nbsp;&nbsp; ${dateLabel} &nbsp;&nbsp; ${turnoAtual.label}
            </th>
          </tr>
          <tr>
            <th class="testor-col">TESTOR</th>
            ${headerCols}
            <th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td class="testor-col"><strong>TOTAL/HORA</strong></td>
            ${totalRow}
            <td class="grand-total">${totalGeral}</td>
          </tr>
        </tbody>
      </table>
      <script>window.onload = function() { window.print(); }<\/script>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Factory className="w-5 h-5 text-blue-400" />
            Controle de Produção
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Informe a quantidade produzida por hora em cada testor
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
          <Printer className="w-4 h-4" /> PDF / Imprimir
        </Button>
      </div>

      {/* Controles de data e turno */}
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
      </div>

      {/* Planilha */}
      {loadingTestores ? (
        <div className="grid grid-cols-1 gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />)}
        </div>
      ) : testores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Factory className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum testor cadastrado.</p>
          <p className="text-xs mt-1">Cadastre testores na aba "Testores" primeiro.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table
            className="w-full text-xs border-collapse"
            style={{ minWidth: `${200 + turnoAtual.horas.length * 72}px` }}
          >
            <thead>
              {/* Título */}
              <tr>
                <th
                  colSpan={turnoAtual.horas.length + 2}
                  className="border border-border bg-muted/80 px-4 py-2.5 text-center font-black text-sm tracking-widest uppercase"
                >
                  CONTROLE DE PRODUÇÃO
                  <span className="ml-4 text-blue-400 font-bold text-base">
                    {format(parseISO(selectedDate), "dd/MM")}
                  </span>
                  <span className="ml-3 text-muted-foreground font-normal text-xs">{turnoAtual.label}</span>
                </th>
              </tr>
              {/* Cabeçalho */}
              <tr className="bg-muted/50">
                <th className="border border-border px-3 py-2 text-left font-bold text-xs" style={{ minWidth: 160 }}>
                  TESTOR
                </th>
                {turnoAtual.horas.map(h => (
                  <th key={h} className="border border-border px-1 py-2 text-center font-bold text-xs" style={{ minWidth: 68 }}>
                    {h}
                  </th>
                ))}
                <th className="border border-border px-2 py-2 text-center font-bold text-xs bg-blue-500/10 text-blue-400" style={{ minWidth: 72 }}>
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {testores.map((testor, idx) => {
                const total = totalPorTestor(testor);
                return (
                  <tr
                    key={testor.id}
                    className={`group ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-primary/5 transition-colors`}
                  >
                    <td className="border border-border px-3 py-1.5 font-semibold text-xs whitespace-nowrap">
                      {testor.nome}
                    </td>
                    {turnoAtual.horas.map(hora => {
                      const cell = cellMap[testor.id]?.[hora];
                      return (
                        <td key={hora} className="border border-border p-0.5 text-center">
                          <input
                            type="number"
                            min="0"
                            defaultValue={cell?.value || ""}
                            key={`${testor.id}-${hora}-${cell?.id || "empty"}`}
                            onBlur={e => handleCellChange(testor, hora, e.target.value)}
                            onKeyDown={e => e.key === "Enter" && e.target.blur()}
                            className={`w-full h-7 text-center text-xs font-bold rounded bg-transparent outline-none border border-transparent
                              focus:border-primary/50 focus:bg-primary/5 transition-all
                              ${cell?.value ? "text-blue-400" : "text-muted-foreground/40"}
                              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                            placeholder="—"
                          />
                        </td>
                      );
                    })}
                    <td className="border border-border px-2 py-1.5 text-center font-bold text-xs text-blue-400 bg-blue-500/5">
                      {total > 0 ? total : "—"}
                    </td>
                  </tr>
                );
              })}

              {/* Linha de totais por hora */}
              <tr className="bg-blue-500/10 font-bold">
                <td className="border border-border px-3 py-2 text-xs font-black text-blue-400 uppercase">
                  TOTAL/HORA
                </td>
                {turnoAtual.horas.map(h => (
                  <td key={h} className="border border-border text-center text-xs font-bold text-blue-400 py-2">
                    {totalPorHora[h] > 0 ? totalPorHora[h] : "—"}
                  </td>
                ))}
                <td className="border border-border text-center text-sm font-black text-white bg-blue-600 py-2">
                  {totalGeral > 0 ? totalGeral : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border border-border/40 rounded-lg px-4 py-2.5 bg-muted/20">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 bg-blue-500/20 border border-blue-500/30 rounded" />
          Digite o nº de carros produzidos na célula e pressione Enter ou clique fora
        </span>
        <span>· Digite 0 ou apague para limpar a célula</span>
        <span>· A linha TOTAL/HORA soma todos os testores por horário</span>
      </div>
    </div>
  );
}