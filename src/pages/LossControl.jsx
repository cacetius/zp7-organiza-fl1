import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, Plus, Minus, ChevronLeft, ChevronRight, Printer, X, FileSpreadsheet } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { detectCurrentShift } from "@/lib/shiftDetector";

const DEFAULT_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

const TURNOS = [
  {
    label: "1º Turno (06h–15h)",
    key: "primeiro",
    horas: ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"],
  },
  {
    label: "2º Turno (15h–23h45)",
    key: "segundo",
    horas: ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "23:45"],
  },
  {
    label: "3º Turno (23h45–06h)",
    key: "terceiro",
    horas: ["23:45", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"],
  },
];

const STORAGE_KEY_ITENS = "zp7_loss_itens_extras";
const STORAGE_KEY_GANHOS = "zp7_loss_ganhos_extras";

export default function LossControl() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [selectedDate, setSelectedDate] = useState(today);

  const [selectedTurno, setSelectedTurno] = useState(() => {
    const detected = detectCurrentShift();

    if (typeof detected === "string") {
      return detected;
    }

    return detected?.key || "segundo";
  });

  const [itensExtras, setItensExtras] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_ITENS) || "[]");
    } catch {
      return [];
    }
  });

  const [itens, setItens] = useState(() => {
    try {
      const extras = JSON.parse(localStorage.getItem(STORAGE_KEY_ITENS) || "[]");
      const combined = [...DEFAULT_ITEMS];

      extras.forEach((item) => {
        if (!combined.includes(item)) combined.push(item);
      });

      return combined;
    } catch {
      return DEFAULT_ITEMS;
    }
  });

  const [itensGanhoLocal, setItensGanhoLocal] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_GANHOS) || "[]");
    } catch {
      return [];
    }
  });

  const [novoItem, setNovoItem] = useState("");
  const [ganhoSelecionado, setGanhoSelecionado] = useState("");
  const [editingCell, setEditingCell] = useState(null);

  const longPressTimers = useRef({});
  const longPressTriggered = useRef({});
  const pendingOps = useRef({});

  const turnoAtual = TURNOS.find((t) => t.key === selectedTurno) || TURNOS[1];
  const sheetKey = `loss-sheet-${selectedDate}-${selectedTurno}`;
  const dateLabel = format(parseISO(selectedDate), "dd/MM");

  const horaAtual = useMemo(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    return `${hh}:00`;
  }, []);

  const { data: allRecords = [] } = useQuery({
    queryKey: [sheetKey],
    queryFn: () => base44.entities.LossControl.filter({ data: selectedDate, turno: selectedTurno }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const records = useMemo(() => {
    return allRecords.filter((r) => r.motivo_perda !== "ganho");
  }, [allRecords]);

  const recordsGanho = useMemo(() => {
    return allRecords.filter((r) => r.motivo_perda === "ganho");
  }, [allRecords]);

  const itensGanhoFromDB = useMemo(() => {
    const items = allRecords
      .filter((r) => r.motivo_perda === "ganho" && r.item_perda)
      .map((r) => r.item_perda);

    return [...new Set(items)];
  }, [allRecords]);

  const itensGanho = useMemo(() => {
    const combined = [...itensGanhoFromDB];

    itensGanhoLocal.forEach((item) => {
      if (!combined.includes(item)) combined.push(item);
    });

    return combined;
  }, [itensGanhoFromDB, itensGanhoLocal]);

  const sheetKeyRef = useRef(sheetKey);

  useEffect(() => {
    sheetKeyRef.current = sheetKey;
  }, [sheetKey]);

  const optimisticUpdate = (updater) => {
    qc.setQueryData([sheetKeyRef.current], (old = []) => updater(old));
  };

  useEffect(() => {
    let unsub;

    const timeout = setTimeout(() => {
      unsub = base44.entities.LossControl.subscribe(() => {
        qc.invalidateQueries({ queryKey: [sheetKeyRef.current] });
      });
    }, 0);

    return () => {
      clearTimeout(timeout);
      if (unsub) unsub();
    };
  }, [qc]);

  const createCell = useMutation({
    mutationFn: (data) => base44.entities.LossControl.create(data),
    onMutate: (data) => {
      optimisticUpdate((old) => [...old, { ...data, id: `temp-${Date.now()}` }]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });

  const updateCell = useMutation({
    mutationFn: ({ id, carros_perdidos }) => base44.entities.LossControl.update(id, { carros_perdidos }),
    onMutate: ({ id, carros_perdidos }) => {
      optimisticUpdate((old) => old.map((r) => (r.id === id ? { ...r, carros_perdidos } : r)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });

  const deleteCell = useMutation({
    mutationFn: (id) => base44.entities.LossControl.delete(id),
    onMutate: (id) => {
      optimisticUpdate((old) => old.filter((r) => r.id !== id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });

  const cellMap = useMemo(() => {
    const map = {};

    records.forEach((r) => {
      if (!r.item_perda || !r.hora) return;

      if (!map[r.item_perda]) map[r.item_perda] = {};

      const existing = map[r.item_perda][r.hora];

      if (!existing || (existing.id?.startsWith?.("temp-") && !r.id?.startsWith?.("temp-"))) {
        map[r.item_perda][r.hora] = {
          id: r.id,
          count: Number(r.carros_perdidos || 0),
        };
      }
    });

    return map;
  }, [records]);

  const cellMapGanho = useMemo(() => {
    const map = {};

    recordsGanho.forEach((r) => {
      if (!r.item_perda || !r.hora) return;

      if (!map[r.item_perda]) map[r.item_perda] = {};

      const existing = map[r.item_perda][r.hora];

      if (!existing || (existing.id?.startsWith?.("temp-") && !r.id?.startsWith?.("temp-"))) {
        map[r.item_perda][r.hora] = {
          id: r.id,
          count: Number(r.carros_perdidos || 0),
        };
      }
    });

    return map;
  }, [recordsGanho]);

  const cellMapRef = useRef(cellMap);
  const cellMapGanhoRef = useRef(cellMapGanho);

  useEffect(() => {
    cellMapRef.current = cellMap;
  }, [cellMap]);

  useEffect(() => {
    cellMapGanhoRef.current = cellMapGanho;
  }, [cellMapGanho]);

  const saveCell = (item, hora, newVal) => {
    const opKey = `perda-${item}-${hora}`;

    if (pendingOps.current[opKey]) return;

    const cell = cellMapRef.current[item]?.[hora];

    if (newVal <= 0) {
      if (cell && !cell.id?.startsWith?.("temp-")) {
        pendingOps.current[opKey] = true;
        deleteCell.mutate(cell.id, {
          onSettled: () => {
            delete pendingOps.current[opKey];
          },
        });
      }

      return;
    }

    if (cell && !cell.id?.startsWith?.("temp-")) {
      pendingOps.current[opKey] = true;

      updateCell.mutate(
        { id: cell.id, carros_perdidos: newVal },
        {
          onSettled: () => {
            delete pendingOps.current[opKey];
          },
        }
      );
    } else if (!cell) {
      pendingOps.current[opKey] = true;

      createCell.mutate(
        {
          item_perda: item,
          hora,
          turno: selectedTurno,
          data: selectedDate,
          carros_perdidos: newVal,
          carros_planejados: 0,
          carros_produzidos: 0,
          motivo_perda: "outro",
        },
        {
          onSettled: () => {
            delete pendingOps.current[opKey];
          },
        }
      );
    }
  };

  const saveCellGanho = (item, hora, newVal) => {
    const opKey = `ganho-${item}-${hora}`;

    if (pendingOps.current[opKey]) return;

    const cell = cellMapGanhoRef.current[item]?.[hora];

    if (newVal <= 0) {
      if (cell && !cell.id?.startsWith?.("temp-")) {
        pendingOps.current[opKey] = true;
        deleteCell.mutate(cell.id, {
          onSettled: () => {
            delete pendingOps.current[opKey];
          },
        });
      }

      return;
    }

    if (cell && !cell.id?.startsWith?.("temp-")) {
      pendingOps.current[opKey] = true;

      updateCell.mutate(
        { id: cell.id, carros_perdidos: newVal },
        {
          onSettled: () => {
            delete pendingOps.current[opKey];
          },
        }
      );
    } else if (!cell) {
      pendingOps.current[opKey] = true;

      createCell.mutate(
        {
          item_perda: item,
          hora,
          turno: selectedTurno,
          data: selectedDate,
          carros_perdidos: newVal,
          carros_planejados: 0,
          carros_produzidos: 0,
          motivo_perda: "ganho",
        },
        {
          onSettled: () => {
            delete pendingOps.current[opKey];
          },
        }
      );
    }
  };

  const handleIncrement = (item, hora) => {
    if (longPressTriggered.current[`${item}-${hora}`]) return;

    saveCell(item, hora, (cellMapRef.current[item]?.[hora]?.count || 0) + 1);
  };

  const handleDecrement = (item, hora) => {
    saveCell(item, hora, (cellMapRef.current[item]?.[hora]?.count || 0) - 1);
  };

  const handleIncrementGanho = (item, hora) => {
    if (longPressTriggered.current[`g-${item}-${hora}`]) return;

    saveCellGanho(item, hora, (cellMapGanhoRef.current[item]?.[hora]?.count || 0) + 1);
  };

  const handleDecrementGanho = (item, hora) => {
    saveCellGanho(item, hora, (cellMapGanhoRef.current[item]?.[hora]?.count || 0) - 1);
  };

  const startLongPress = (item, hora) => {
    const key = `${item}-${hora}`;
    longPressTriggered.current[key] = false;

    longPressTimers.current[key] = setTimeout(() => {
      longPressTriggered.current[key] = true;

      const currentVal = cellMapRef.current[item]?.[hora]?.count || 0;

      setEditingCell({
        item,
        hora,
        isGanho: false,
        value: String(currentVal),
      });
    }, 600);
  };

  const cancelLongPress = (item, hora) => {
    clearTimeout(longPressTimers.current[`${item}-${hora}`]);
  };

  const startLongPressGanho = (item, hora) => {
    const key = `g-${item}-${hora}`;
    longPressTriggered.current[key] = false;

    longPressTimers.current[key] = setTimeout(() => {
      longPressTriggered.current[key] = true;

      const currentVal = cellMapGanhoRef.current[item]?.[hora]?.count || 0;

      setEditingCell({
        item,
        hora,
        isGanho: true,
        value: String(currentVal),
      });
    }, 600);
  };

  const cancelLongPressGanho = (item, hora) => {
    clearTimeout(longPressTimers.current[`g-${item}-${hora}`]);
  };

  const confirmEditCell = () => {
    if (!editingCell) return;

    const num = parseInt(editingCell.value, 10);

    if (!Number.isNaN(num) && num >= 0) {
      if (editingCell.isGanho) {
        saveCellGanho(editingCell.item, editingCell.hora, num);
      } else {
        saveCell(editingCell.item, editingCell.hora, num);
      }
    }

    setEditingCell(null);
  };

  const totalPorHora = useMemo(() => {
    const totals = {};

    turnoAtual.horas.forEach((hora) => {
      totals[hora] = itens.reduce((acc, item) => {
        return acc + Number(cellMap[item]?.[hora]?.count || 0);
      }, 0);
    });

    return totals;
  }, [cellMap, itens, turnoAtual]);

  const totalPorItemMap = useMemo(() => {
    const map = {};

    itens.forEach((item) => {
      map[item] = turnoAtual.horas.reduce((acc, hora) => {
        return acc + Number(cellMap[item]?.[hora]?.count || 0);
      }, 0);
    });

    return map;
  }, [cellMap, itens, turnoAtual]);

  const totalPorItem = (item) => totalPorItemMap[item] || 0;

  const totalGeral = useMemo(() => {
    return itens.reduce((acc, item) => acc + (totalPorItemMap[item] || 0), 0);
  }, [itens, totalPorItemMap]);

  const totalGanhoPorHora = useMemo(() => {
    const totals = {};

    turnoAtual.horas.forEach((hora) => {
      totals[hora] = itensGanho.reduce((acc, item) => {
        return acc + Number(cellMapGanho[item]?.[hora]?.count || 0);
      }, 0);
    });

    return totals;
  }, [cellMapGanho, itensGanho, turnoAtual]);

  const totalPorItemGanhoMap = useMemo(() => {
    const map = {};

    itensGanho.forEach((item) => {
      map[item] = turnoAtual.horas.reduce((acc, hora) => {
        return acc + Number(cellMapGanho[item]?.[hora]?.count || 0);
      }, 0);
    });

    return map;
  }, [cellMapGanho, itensGanho, turnoAtual]);

  const totalPorItemGanho = (item) => totalPorItemGanhoMap[item] || 0;

  const totalGeralGanho = useMemo(() => {
    return itensGanho.reduce((acc, item) => acc + (totalPorItemGanhoMap[item] || 0), 0);
  }, [itensGanho, totalPorItemGanhoMap]);

  const perdaRealPorHora = useMemo(() => {
    const totals = {};

    turnoAtual.horas.forEach((hora) => {
      totals[hora] = Math.max(0, (totalPorHora[hora] || 0) - (totalGanhoPorHora[hora] || 0));
    });

    return totals;
  }, [totalPorHora, totalGanhoPorHora, turnoAtual]);

  const totalPerdaReal = useMemo(() => {
    return Math.max(0, totalGeral - totalGeralGanho);
  }, [totalGeral, totalGeralGanho]);

  const itemMaisPerdas = useMemo(() => {
    let topItem = null;
    let topVal = 0;

    itens.forEach((item) => {
      const val = totalPorItemMap[item] || 0;

      if (val > topVal) {
        topVal = val;
        topItem = item;
      }
    });

    return topVal > 0 ? { nome: topItem, total: topVal } : null;
  }, [itens, totalPorItemMap]);

  const addItem = () => {
    const item = novoItem.trim().toUpperCase();

    if (item && !itens.includes(item)) {
      const newItens = [...itens, item];
      const newExtras = [...itensExtras, item];

      setItens(newItens);
      setItensExtras(newExtras);
      localStorage.setItem(STORAGE_KEY_ITENS, JSON.stringify(newExtras));
      setNovoItem("");
    }
  };

  const addGanhoItem = () => {
    if (ganhoSelecionado && ganhoSelecionado !== "_none" && !itensGanho.includes(ganhoSelecionado)) {
      const newGanhos = [...itensGanhoLocal, ganhoSelecionado];

      setItensGanhoLocal(newGanhos);
      localStorage.setItem(STORAGE_KEY_GANHOS, JSON.stringify(newGanhos));
      setGanhoSelecionado("");
    }
  };

  const itensDisponiveisGanho = useMemo(() => {
    return itens.filter((item) => !itensGanho.includes(item));
  }, [itens, itensGanho]);

  const buildPerdasRows = () => {
    const header = ["Item de Perda", ...turnoAtual.horas, "Total"];

    const rows = itens.map((item) => [
      item,
      ...turnoAtual.horas.map((hora) => cellMap[item]?.[hora]?.count || 0),
      totalPorItem(item),
    ]);

    rows.push(["TOTAL/HORA", ...turnoAtual.horas.map((hora) => totalPorHora[hora] || 0), totalGeral]);

    return { header, rows };
  };

  const buildGanhosRows = () => {
    const header = ["Motivo do Ganho", ...turnoAtual.horas, "Total"];

    const rows = itensGanho.map((item) => [
      item,
      ...turnoAtual.horas.map((hora) => cellMapGanho[item]?.[hora]?.count || 0),
      totalPorItemGanho(item),
    ]);

    rows.push(["TOTAL GANHOS/HORA", ...turnoAtual.horas.map((hora) => totalGanhoPorHora[hora] || 0), totalGeralGanho]);
    rows.push(["PERDA REAL/HORA", ...turnoAtual.horas.map((hora) => perdaRealPorHora[hora] || 0), totalPerdaReal]);

    return { header, rows };
  };

  const handleExportExcel = () => {
    const { header: perdasHeader, rows: perdasRows } = buildPerdasRows();
    const { header: ganhosHeader, rows: ganhosRows } = buildGanhosRows();

    const toCsv = (header, rows) => {
      return [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
        .join("\n");
    };

    const combined = `PERDAS\n${toCsv(perdasHeader, perdasRows)}\n\nGANHOS\n${toCsv(ganhosHeader, ganhosRows)}`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + combined], { type: "text/csv;charset=utf-8" }));
    a.download = `controle_perdas_${selectedDate}_${selectedTurno}.csv`;
    a.click();
  };

  const handlePrint = () => {
    const { header: ph, rows: pr } = buildPerdasRows();
    const { header: gh, rows: gr } = buildGanhosRows();
    const now = new Date().toLocaleString("pt-BR");

    const buildTable = (title, accentColor, headerBg, header, rows, totalRows = 1) => {
      const ths = header
        .map((h, i) => `<th style="text-align:${i === 0 ? "left" : "center"}">${h}</th>`)
        .join("");

      const trs = rows
        .map((row, ri) => {
          const isTotal = ri >= rows.length - totalRows;

          const tds = row
            .map((cell, ci) => {
              const val = cell === 0 ? "—" : cell;

              return `<td class="${ci === 0 ? "item-col" : ""}" style="${
                isTotal ? "font-weight:900;" : ""
              }${ci > 0 && ci < row.length && Number(cell) > 0 ? "color:#1e293b;font-weight:700;" : ""}">${val ?? ""}</td>`;
            })
            .join("");

          return `<tr class="${isTotal ? "total-row" : ""}">${tds}</tr>`;
        })
        .join("");

      return `
        <div class="section-header" style="background:${accentColor}">
          <span>${title}</span>
          <span style="font-weight:400;opacity:0.8;font-size:9px">${dateLabel} · ${turnoAtual.label}</span>
        </div>
        <table>
          <thead><tr style="background:${headerBg}">${ths}</tr></thead>
          <tbody>${trs}</tbody>
        </table>`;
    };

    const kpiBox = (label, value, color) =>
      `<div class="kpi" style="border-top:3px solid ${color}">
        <div class="kpi-val" style="color:${color}">${value}</div>
        <div class="kpi-lbl">${label}</div>
      </div>`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Controle de Perdas ZP7 — ${dateLabel}</title>
<style>
@page { size: A4 landscape; margin: 10mm 12mm; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; color: #1e293b; background: #fff; }
.header { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 70%, #1e1b4b 100%); color: white; padding: 14px 20px; border-radius: 10px; margin-bottom: 12px; }
.header-title { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
.header-sub { font-size: 8px; opacity: 0.7; margin-top: 3px; }
.header-badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 5px 12px; font-size: 10px; font-weight: 700; text-align: center; }
.header-date { font-size: 8px; opacity: 0.65; margin-top: 3px; text-align: right; }
.kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.kpi { border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; }
.kpi-val { font-size: 26px; font-weight: 900; line-height: 1; margin-bottom: 3px; }
.kpi-lbl { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.section-header { display: flex; justify-content: space-between; align-items: center; color: white; padding: 7px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-radius: 6px 6px 0 0; margin-top: 12px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 0; }
thead tr { color: white; }
thead th { padding: 5px 6px; font-size: 8px; font-weight: 700; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.15); }
td { padding: 4px 5px; border: 1px solid #e2e8f0; font-size: 8.5px; text-align: center; }
td.item-col { text-align: left; min-width: 140px; font-weight: 600; }
tr:nth-child(even) td { background: #f8fafc; }
tr.total-row td { background: #eff6ff; border-top: 2px solid #bfdbfe; }
.footer { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
.footer-brand { font-weight: 700; color: #64748b; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="header-title">📋 Controle de Perdas — ZP7</div>
    <div class="header-sub">Volkswagen Taubaté · Zona de Produção 7 · Gerado em ${now}</div>
  </div>
  <div>
    <div class="header-badge">⏱ ${turnoAtual.label}</div>
    <div class="header-date">📅 ${dateLabel}</div>
  </div>
</div>
<div class="kpi-row">
  ${kpiBox("Perdas Brutas", totalGeral, "#dc2626")}
  ${kpiBox("Carros Ganhos", totalGeralGanho, "#16a34a")}
  ${kpiBox("Perda Real", totalPerdaReal, "#ea580c")}
</div>
${buildTable("🔴 Controle de Perdas", "#dc2626", "#991b1b", ph, pr, 1)}
${buildTable("🟢 Carros Ganhos", "#16a34a", "#166534", gh, gr, 2)}
<div class="footer">
  <span class="footer-brand">ZP7 — Volkswagen Taubaté</span>
  <span>Sistema de Controle de Produção</span>
  <span>${now}</span>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");

    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      a.target = "_blank";
      a.click();
    }
  };

  const CellButton = ({ val, onPointerDown, onPointerUp, onPointerLeave, onDecrement, colorClass, activeColor }) => (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        className={`w-full h-10 rounded-md font-black text-base transition-all select-none ${
          val > 0 ? activeColor : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"
        }`}
      >
        {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
      </button>

      {val > 0 && (
        <button type="button" onClick={onDecrement} className={`${colorClass} transition-colors p-0.5`}>
          <Minus className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-3 pb-24 lg:pb-4">
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingCell(null)}>
          <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-72 mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">
              {editingCell.isGanho ? "🟢 Ganho" : "🔴 Perda"} · {editingCell.item}
            </p>

            <p className="text-xs text-muted-foreground mb-3">Hora {editingCell.hora} — Digite a quantidade</p>

            <input
              autoFocus
              type="number"
              min="0"
              value={editingCell.value}
              onChange={(e) => setEditingCell((prev) => ({ ...prev, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmEditCell();
                if (e.key === "Escape") setEditingCell(null);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-3xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingCell(null)} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted">
                Cancelar
              </button>

              <button type="button" onClick={confirmEditCell} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            Controle de Perdas
          </h1>

          <p className="text-[11px] text-muted-foreground">Toque +1 · Segure para digitar · − diminui</p>
        </div>

        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 text-green-400 border-green-500/30 px-2.5" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5 px-2.5" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg px-2 py-1">
            <button
              type="button"
              onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
              className="p-1 hover:text-primary rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-0 bg-transparent h-7 w-32 text-sm text-center p-0 focus-visible:ring-0"
            />

            <button
              type="button"
              onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
              className="p-1 hover:text-primary rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Select value={selectedTurno} onValueChange={(value) => setSelectedTurno(value)}>
            <SelectTrigger className="h-9 flex-1 min-w-[160px]">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {TURNOS.map((turno) => (
                <SelectItem key={turno.key} value={turno.key}>
                  {turno.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="+ Item de perda..."
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="h-9 text-sm flex-1"
          />

          <Button size="sm" variant="outline" onClick={addItem} disabled={!novoItem.trim()} className="border-red-500/40 text-red-400 px-3">
            <Plus className="w-3.5 h-3.5" />
          </Button>

          <Select value={ganhoSelecionado} onValueChange={setGanhoSelecionado}>
            <SelectTrigger className="h-9 flex-1 min-w-[130px] text-sm border-green-500/40 text-green-400">
              <SelectValue placeholder="+ Ganho..." />
            </SelectTrigger>

            <SelectContent>
              {itensDisponiveisGanho.length === 0 ? (
                <SelectItem value="_none" disabled>
                  Todos já adicionados
                </SelectItem>
              ) : (
                itensDisponiveisGanho.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" onClick={addGanhoItem} disabled={!ganhoSelecionado || ganhoSelecionado === "_none"} className="border-green-500/40 text-green-400 px-3">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {(totalGeral > 0 || totalGeralGanho > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-red-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-3xl font-black text-red-400">{totalGeral}</p>
              <p className="text-xs text-muted-foreground">Perdas Brutas</p>
            </CardContent>
          </Card>

          <Card className="border-green-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-3xl font-black text-green-400">{totalGeralGanho}</p>
              <p className="text-xs text-muted-foreground">Carros Ganhos</p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-3xl font-black text-orange-400">{totalPerdaReal}</p>
              <p className="text-xs text-muted-foreground">Perda Real</p>
            </CardContent>
          </Card>

          {itemMaisPerdas && (
            <Card className="border-red-600/40 bg-red-500/5 col-span-2 sm:col-span-1">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">⚠ Maior Perda</p>
                <p className="text-2xl font-black text-red-400">{itemMaisPerdas.total}</p>
                <p className="text-[11px] font-semibold text-red-300 mt-0.5 truncate" title={itemMaisPerdas.nome}>
                  {itemMaisPerdas.nome}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + turnoAtual.horas.length * 58}px` }}>
          <thead>
            <tr>
              <th colSpan={turnoAtual.horas.length + 2} className="border border-border bg-red-500/10 px-4 py-2.5 text-center font-black text-sm uppercase tracking-widest text-red-400">
                CONTROLE DE PERDAS — {dateLabel} — {turnoAtual.label}
              </th>
            </tr>

            <tr className="bg-muted/50">
              <th className="border border-border px-3 py-2 text-left font-bold" style={{ minWidth: 200 }}>
                ITEM DE PERDA
              </th>

              {turnoAtual.horas.map((hora) => (
                <th
                  key={hora}
                  className={`border border-border px-1 py-2 text-center font-bold transition-colors ${
                    hora === horaAtual ? "bg-yellow-400/20 text-yellow-300 ring-2 ring-inset ring-yellow-400/60" : ""
                  }`}
                  style={{ minWidth: 54 }}
                >
                  {hora}
                </th>
              ))}

              <th className="border border-border px-2 py-2 text-center font-bold bg-red-500/10 text-red-400" style={{ minWidth: 60 }}>
                TOTAL
              </th>
            </tr>
          </thead>

          <tbody>
            {itens.map((item, idx) => {
              const total = totalPorItem(item);
              const isTop = itemMaisPerdas && item === itemMaisPerdas.nome;

              return (
                <tr
                  key={item}
                  className={`group transition-colors ${
                    isTop ? "bg-red-500/10 hover:bg-red-500/15" : idx % 2 === 0 ? "bg-card hover:bg-red-500/5" : "bg-muted/10 hover:bg-red-500/5"
                  }`}
                >
                  <td className="border border-border px-3 py-1.5 font-medium whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1">
                      <span className={isTop ? "text-red-300 font-bold" : ""}>
                        {isTop && "⚠ "}
                        {item}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const newItens = itens.filter((i) => i !== item);
                          const newExtras = itensExtras.filter((i) => i !== item);

                          setItens(newItens);
                          setItensExtras(newExtras);
                          localStorage.setItem(STORAGE_KEY_ITENS, JSON.stringify(newExtras));
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </td>

                  {turnoAtual.horas.map((hora) => {
                    const val = cellMap[item]?.[hora]?.count || 0;

                    return (
                      <td key={hora} className={`border border-border p-1 ${hora === horaAtual ? "bg-yellow-400/10 ring-1 ring-inset ring-yellow-400/40" : ""}`}>
                        <CellButton
                          val={val}
                          onPointerDown={() => startLongPress(item, hora)}
                          onPointerUp={() => {
                            cancelLongPress(item, hora);
                            handleIncrement(item, hora);
                          }}
                          onPointerLeave={() => cancelLongPress(item, hora)}
                          onDecrement={() => handleDecrement(item, hora)}
                          colorClass="text-muted-foreground/40 hover:text-red-400"
                          activeColor="bg-red-500/20 text-red-300 hover:bg-red-500/35 active:scale-95"
                        />
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

              {turnoAtual.horas.map((hora) => (
                <td key={hora} className={`border border-border text-center font-bold text-red-400 py-2 ${hora === horaAtual ? "bg-yellow-400/15 ring-1 ring-inset ring-yellow-400/40" : ""}`}>
                  {totalPorHora[hora] > 0 ? totalPorHora[hora] : "—"}
                </td>
              ))}

              <td className="border border-border text-center font-black text-white bg-red-600 py-2 text-sm">
                {totalGeral > 0 ? totalGeral : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-green-500/30 shadow-sm">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + turnoAtual.horas.length * 58}px` }}>
          <thead>
            <tr>
              <th colSpan={turnoAtual.horas.length + 2} className="border border-border bg-green-500/10 px-4 py-2.5 text-center font-black text-sm uppercase tracking-widest text-green-400">
                CARROS GANHOS — {dateLabel} — {turnoAtual.label}
              </th>
            </tr>

            <tr className="bg-muted/50">
              <th className="border border-border px-3 py-2 text-left font-bold" style={{ minWidth: 200 }}>
                MOTIVO DO GANHO
              </th>

              {turnoAtual.horas.map((hora) => (
                <th
                  key={hora}
                  className={`border border-border px-1 py-2 text-center font-bold transition-colors ${
                    hora === horaAtual ? "bg-yellow-400/20 text-yellow-300 ring-2 ring-inset ring-yellow-400/60" : ""
                  }`}
                  style={{ minWidth: 54 }}
                >
                  {hora}
                </th>
              ))}

              <th className="border border-border px-2 py-2 text-center font-bold bg-green-500/10 text-green-400" style={{ minWidth: 60 }}>
                TOTAL
              </th>
            </tr>
          </thead>

          <tbody>
            {itensGanho.length === 0 && (
              <tr>
                <td colSpan={turnoAtual.horas.length + 2} className="text-center py-6 text-muted-foreground text-xs">
                  Selecione um item da lista de perdas para registrar ganhos
                </td>
              </tr>
            )}

            {itensGanho.map((item, idx) => {
              const total = totalPorItemGanho(item);

              return (
                <tr key={item} className={`group ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-green-500/5 transition-colors`}>
                  <td className="border border-border px-3 py-1.5 font-medium whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1">
                      <span>{item}</span>

                      <button
                        type="button"
                        onClick={() => {
                          const newGanhos = itensGanhoLocal.filter((i) => i !== item);

                          setItensGanhoLocal(newGanhos);
                          localStorage.setItem(STORAGE_KEY_GANHOS, JSON.stringify(newGanhos));
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </td>

                  {turnoAtual.horas.map((hora) => {
                    const val = cellMapGanho[item]?.[hora]?.count || 0;

                    return (
                      <td key={hora} className={`border border-border p-1 ${hora === horaAtual ? "bg-yellow-400/10 ring-1 ring-inset ring-yellow-400/40" : ""}`}>
                        <CellButton
                          val={val}
                          onPointerDown={() => startLongPressGanho(item, hora)}
                          onPointerUp={() => {
                            cancelLongPressGanho(item, hora);
                            handleIncrementGanho(item, hora);
                          }}
                          onPointerLeave={() => cancelLongPressGanho(item, hora)}
                          onDecrement={() => handleDecrementGanho(item, hora)}
                          colorClass="text-muted-foreground/40 hover:text-green-400"
                          activeColor="bg-green-500/20 text-green-300 hover:bg-green-500/35 active:scale-95"
                        />
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

              {turnoAtual.horas.map((hora) => (
                <td key={hora} className={`border border-border text-center font-bold text-green-400 py-2 ${hora === horaAtual ? "bg-yellow-400/15 ring-1 ring-inset ring-yellow-400/40" : ""}`}>
                  {totalGanhoPorHora[hora] > 0 ? totalGanhoPorHora[hora] : "—"}
                </td>
              ))}

              <td className="border border-border text-center font-black text-white bg-green-600 py-2 text-sm">
                {totalGeralGanho > 0 ? totalGeralGanho : "—"}
              </td>
            </tr>

            <tr className="bg-orange-500/10 font-bold">
              <td className="border border-border px-3 py-2 font-black text-orange-400 uppercase">PERDA REAL/HORA</td>

              {turnoAtual.horas.map((hora) => (
                <td key={hora} className={`border border-border text-center font-bold text-orange-400 py-2 ${hora === horaAtual ? "bg-yellow-400/15 ring-1 ring-inset ring-yellow-400/40" : ""}`}>
                  {perdaRealPorHora[hora] > 0 ? perdaRealPorHora[hora] : "—"}
                </td>
              ))}

              <td className="border border-border text-center font-black text-white bg-orange-600 py-2 text-sm">
                {totalPerdaReal > 0 ? totalPerdaReal : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Toque: +1 · Segure: digitar número · −: diminuir · ✕: remover item
      </p>
    </div>
  );
}