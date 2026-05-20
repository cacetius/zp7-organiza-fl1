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

const HORAS_EXTRAS_SABADO_1 = ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];
const HORAS_EXTRAS_SABADO_2 = ["19:00", "20:00", "21:00", "22:00", "23:00"];

const TURNOS = [
  {
    label: "1º Turno (06h–15h)",
    key: "primeiro",
    horas: ["07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"],
  },
  {
    label: "2º Turno (15h–23h45)",
    key: "segundo",
    horas: ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "23:45"],
  },
  {
    label: "3º Turno (23h45–06h)",
    key: "terceiro",
    horas: ["23:45", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00"],
  },
];

const TURNOS_SABADO = [
  {
    label: "1º Turno Sáb (06h–12h)",
    key: "primeiro",
    horas: ["07:00", "08:00", "09:00", "10:00", "11:00"],
    horasExtras: HORAS_EXTRAS_SABADO_1,
  },
  {
    label: "2º Turno Sáb (12h–18h)",
    key: "segundo",
    horas: ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
    horasExtras: HORAS_EXTRAS_SABADO_2,
  },
];

const CAMPO_LABELS = {
  producao: "Produção",
  perdas_producao: "Perdas de Produção",
  perdas_defeito: "Perdas por Defeito",
  objetivo: "Objetivo",
  justificativa: "Justificativa",
};

function isSabado(dateStr) {
  try {
    const d = parseISO(dateStr);
    return d.getDay() === 6;
  } catch {
    return false;
  }
}

function safeNumber(value) {
  return Number(value || 0);
}

function isTempId(id) {
  return String(id || "").startsWith("temp-");
}

function getRecordTime(record) {
  return record.updated_date || record.created_date || record.id || "";
}

function pickLatestRecord(existing, current) {
  if (!existing) return current;

  const existingIsTemp = isTempId(existing.id);
  const currentIsReal = current.id && !isTempId(current.id);

  if (existingIsTemp && currentIsReal) {
    return current;
  }

  const existingTime = String(getRecordTime(existing));
  const currentTime = String(getRecordTime(current));

  if (currentTime && existingTime && currentTime > existingTime) {
    return current;
  }

  return existing;
}

export default function ProductionControl() {
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

  const [editingCell, setEditingCell] = useState(null);
  const [mostrarExtras, setMostrarExtras] = useState(false);
  const [editingJustificativa, setEditingJustificativa] = useState(null);

  const longPressTimers = useRef({});
  const longPressTriggered = useRef({});

  const sabado = isSabado(selectedDate);
  const listaTurnos = sabado ? TURNOS_SABADO : TURNOS;

  const turnoAtualBase = listaTurnos.find((t) => t.key === selectedTurno) || listaTurnos[0] || TURNOS[1];
  const horasBase = turnoAtualBase.horas || [];
  const horasExtras = turnoAtualBase.horasExtras || [];
  const horasVisiveis = sabado && mostrarExtras ? [...horasBase, ...horasExtras] : horasBase;
  const turnoAtual = { ...turnoAtualBase, horas: horasVisiveis };

  const sheetKey = `prod-ctrl-${selectedDate}-${selectedTurno}`;
  const lossKey = `loss-sheet-${selectedDate}-${selectedTurno}`;
  const dateLabel = format(parseISO(selectedDate), "dd/MM");

  const { data: testores = [], isLoading: loadingTestores } = useQuery({
    queryKey: ["testores"],
    queryFn: async () => {
      try {
        return await base44.entities.Testor.list();
      } catch (error) {
        console.error("Erro ao carregar testores:", error);
        return [];
      }
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: records = [] } = useQuery({
    queryKey: [sheetKey],
    queryFn: async () => {
      try {
        const allRecords = await base44.entities.ProductionControl.list();

        return allRecords.filter((record) => {
          return record.data === selectedDate && record.turno === selectedTurno;
        });
      } catch (error) {
        console.error("Erro ao carregar produção:", error);
        return [];
      }
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: lossRecords = [] } = useQuery({
    queryKey: [lossKey],
    queryFn: async () => {
      try {
        const allRecords = await base44.entities.LossControl.list();

        return allRecords.filter((record) => {
          return record.data === selectedDate && record.turno === selectedTurno;
        });
      } catch (error) {
        console.error("Erro ao carregar perdas:", error);
        return [];
      }
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const sheetKeyRef = useRef(sheetKey);
  const lossKeyRef = useRef(lossKey);

  useEffect(() => {
    sheetKeyRef.current = sheetKey;
    lossKeyRef.current = lossKey;
  }, [sheetKey, lossKey]);

  useEffect(() => {
    let unsubProduction;
    let unsubLoss;

    const timeout = setTimeout(() => {
      if (base44.entities.ProductionControl.subscribe) {
        unsubProduction = base44.entities.ProductionControl.subscribe(() => {
          qc.invalidateQueries({ queryKey: [sheetKeyRef.current] });
          qc.invalidateQueries({ queryKey: ["testores"] });
        });
      }

      if (base44.entities.LossControl.subscribe) {
        unsubLoss = base44.entities.LossControl.subscribe(() => {
          qc.invalidateQueries({ queryKey: [lossKeyRef.current] });
        });
      }
    }, 0);

    return () => {
      clearTimeout(timeout);
      if (unsubProduction) unsubProduction();
      if (unsubLoss) unsubLoss();
    };
  }, [qc]);

  const optimisticUpdate = (updater) => {
    qc.setQueryData([sheetKeyRef.current], (old = []) => updater(old));
  };

  const createRec = useMutation({
    mutationFn: (data) => base44.entities.ProductionControl.create(data),
    onMutate: (data) => {
      optimisticUpdate((old) => [
        ...old,
        {
          ...data,
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });

  const updateRec = useMutation({
    mutationFn: ({ id, ...fields }) => base44.entities.ProductionControl.update(id, fields),
    onMutate: ({ id, ...fields }) => {
      optimisticUpdate((old) => old.map((record) => (record.id === id ? { ...record, ...fields } : record)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });

  const deleteRec = useMutation({
    mutationFn: (id) => base44.entities.ProductionControl.delete(id),
    onMutate: (id) => {
      optimisticUpdate((old) => old.filter((record) => record.id !== id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
    onError: () => qc.invalidateQueries({ queryKey: [sheetKeyRef.current] }),
  });

  const cellMap = useMemo(() => {
    const map = {};

    records.forEach((record) => {
      if (!record.testor_id || !record.hora) return;

      if (!map[record.testor_id]) map[record.testor_id] = {};

      const current = {
        id: record.id,
        producao: safeNumber(record.carros_produzidos),
        perdas_producao: safeNumber(record.perdas_producao),
        perdas_defeito: safeNumber(record.perdas_defeito),
        objetivo: safeNumber(record.objetivo),
        justificativa: record.justificativa || "",
        raw: record,
      };

      const existing = map[record.testor_id][record.hora];

      if (!existing) {
        map[record.testor_id][record.hora] = current;
      } else {
        const latest = pickLatestRecord(existing.raw, record);

        if (latest === record) {
          map[record.testor_id][record.hora] = current;
        }
      }
    });

    return map;
  }, [records]);

  const cellMapRef = useRef(cellMap);

  useEffect(() => {
    cellMapRef.current = cellMap;
  }, [cellMap]);

  const getCell = (testorId, hora) => {
    return (
      cellMapRef.current[testorId]?.[hora] || {
        producao: 0,
        perdas_producao: 0,
        perdas_defeito: 0,
        objetivo: 0,
        justificativa: "",
      }
    );
  };

  const saveField = (testor, hora, field, newVal) => {
    if (!testor?.id || !hora || !field) return;

    const cell = cellMapRef.current[testor.id]?.[hora];

    const fieldName = field === "producao" ? "carros_produzidos" : field;

    const update = {
      [fieldName]: newVal,
    };

    const payload = {
      testor_id: testor.id,
      testor_nome: testor.nome || "",
      data: selectedDate,
      turno: selectedTurno,
      hora,
      carros_produzidos: field === "producao" ? newVal : safeNumber(cell?.producao),
      perdas_producao: field === "perdas_producao" ? newVal : safeNumber(cell?.perdas_producao),
      perdas_defeito: field === "perdas_defeito" ? newVal : safeNumber(cell?.perdas_defeito),
      objetivo: field === "objetivo" ? newVal : safeNumber(cell?.objetivo),
      justificativa: field === "justificativa" ? newVal : cell?.justificativa || "",
    };

    if (!cell || !cell.id || isTempId(cell.id)) {
      // Sem registro real ainda: cria novo
      createRec.mutate(payload);
      return;
    }

    updateRec.mutate({
      id: cell.id,
      ...update,
    });
  };

  const saveJustificativaTestor = (testor, hora, texto) => {
    if (!testor?.id || !hora) return;

    const cell = cellMapRef.current[testor.id]?.[hora];

    if (cell && cell.id && !isTempId(cell.id)) {
      updateRec.mutate({
        id: cell.id,
        justificativa: texto,
      });

      return;
    }

    createRec.mutate({
      testor_id: testor.id,
      testor_nome: testor.nome || "",
      data: selectedDate,
      turno: selectedTurno,
      hora,
      carros_produzidos: safeNumber(cell?.producao),
      perdas_producao: safeNumber(cell?.perdas_producao),
      perdas_defeito: safeNumber(cell?.perdas_defeito),
      objetivo: safeNumber(cell?.objetivo),
      justificativa: texto,
    });
  };

  const startLongPress = (testor, hora, field = "producao") => {
    const key = `${testor.id}-${hora}-${field}`;

    longPressTriggered.current[key] = false;

    longPressTimers.current[key] = setTimeout(() => {
      longPressTriggered.current[key] = true;

      const cell = cellMap[testor.id]?.[hora] || {};

      setEditingCell({
        testor,
        hora,
        field,
        value: String(field === "justificativa" ? cell.justificativa || "" : cell[field] || ""),
      });
    }, 600);
  };

  const cancelLongPress = (testor, hora, field = "producao") => {
    clearTimeout(longPressTimers.current[`${testor.id}-${hora}-${field}`]);
  };

  const handleIncrementProducao = (testor, hora) => {
    const key = `${testor.id}-${hora}-producao`;

    if (longPressTriggered.current[key]) {
      // Reset para permitir próximos cliques
      longPressTriggered.current[key] = false;
      return;
    }

    // Usa cellMap direto (estado atual) para garantir valor correto
    const cell = cellMap[testor.id]?.[hora];
    const currentVal = safeNumber(cell?.producao);
    saveField(testor, hora, "producao", currentVal + 1);
  };

  const confirmEditCell = () => {
    if (!editingCell) return;

    const { testor, hora, field, value } = editingCell;

    if (field === "justificativa") {
      saveJustificativaTestor(testor, hora, value);
      setEditingCell(null);
      return;
    }

    const num = parseInt(value, 10);

    if (!Number.isNaN(num) && num >= 0) {
      saveField(testor, hora, field, num);
    }

    setEditingCell(null);
  };

  const justificativasMap = useMemo(() => {
    const map = {};

    records.forEach((record) => {
      if (record.testor_id && record.hora && record.justificativa) {
        const key = `${record.testor_id}-${record.hora}`;
        if (!map[key]) map[key] = record.justificativa;
      }
    });

    return map;
  }, [records]);

  const { totalPorHora, objetivoPorHora, perdasProdPorHora } = useMemo(() => {
    const prod = {};
    const obj = {};
    const perdProd = {};

    turnoAtual.horas.forEach((hora) => {
      prod[hora] = testores.reduce((acc, testor) => {
        return acc + safeNumber(cellMap[testor.id]?.[hora]?.producao);
      }, 0);

      obj[hora] = testores.reduce((acc, testor) => {
        return acc + safeNumber(cellMap[testor.id]?.[hora]?.objetivo);
      }, 0);

      perdProd[hora] = Math.max(0, safeNumber(obj[hora]) - safeNumber(prod[hora]));
    });

    return {
      totalPorHora: prod,
      objetivoPorHora: obj,
      perdasProdPorHora: perdProd,
    };
  }, [cellMap, testores, turnoAtual.horas]);

  const perdasFalhaPorHora = useMemo(() => {
    const map = {};

    turnoAtual.horas.forEach((hora) => {
      map[hora] = 0;
    });

    const uniqueMap = {};

    lossRecords
      .filter((record) => record.motivo_perda !== "ganho" && record.hora && record.item_perda)
      .forEach((record) => {
        const key = `${record.item_perda}-${record.hora}`;
        uniqueMap[key] = pickLatestRecord(uniqueMap[key], record);
      });

    Object.values(uniqueMap).forEach((record) => {
      if (map[record.hora] !== undefined) {
        map[record.hora] += safeNumber(record.carros_perdidos);
      }
    });

    return map;
  }, [lossRecords, turnoAtual.horas]);

  const totalPorTestorMap = useMemo(() => {
    const map = {};

    testores.forEach((testor) => {
      map[testor.id] = turnoAtual.horas.reduce((acc, hora) => {
        return acc + safeNumber(cellMap[testor.id]?.[hora]?.producao);
      }, 0);
    });

    return map;
  }, [cellMap, testores, turnoAtual.horas]);

  const totalPorTestor = (testor) => totalPorTestorMap[testor.id] || 0;

  const totalGeral = useMemo(() => {
    return Object.values(totalPorTestorMap).reduce((acc, value) => acc + safeNumber(value), 0);
  }, [totalPorTestorMap]);

  const totalObjetivo = useMemo(() => {
    return Object.values(objetivoPorHora).reduce((acc, value) => acc + safeNumber(value), 0);
  }, [objetivoPorHora]);

  const totalPerdasProd = useMemo(() => {
    return Object.values(perdasProdPorHora).reduce((acc, value) => acc + safeNumber(value), 0);
  }, [perdasProdPorHora]);

  const totalPerdasFalha = useMemo(() => {
    return Object.values(perdasFalhaPorHora).reduce((acc, value) => acc + safeNumber(value), 0);
  }, [perdasFalhaPorHora]);

  const producaoLiquida = useMemo(() => {
    return Math.max(0, totalGeral - totalPerdasFalha);
  }, [totalGeral, totalPerdasFalha]);

  const efic = useMemo(() => {
    return totalObjetivo > 0 ? Math.round((totalGeral / totalObjetivo) * 100) : 0;
  }, [totalGeral, totalObjetivo]);

  const handleExportCsv = () => {
    const headers = ["Testor", ...turnoAtual.horas, "Total"];

    const rows = testores.map((testor) => [
      testor.nome,
      ...turnoAtual.horas.map((hora) => safeNumber(cellMap[testor.id]?.[hora]?.producao)),
      totalPorTestor(testor),
    ]);

    rows.push(["OBJETIVO", ...turnoAtual.horas.map((hora) => objetivoPorHora[hora] || 0), totalObjetivo]);
    rows.push(["PRODUÇÃO", ...turnoAtual.horas.map((hora) => totalPorHora[hora] || 0), totalGeral]);
    rows.push(["PERDAS PRODUÇÃO", ...turnoAtual.horas.map((hora) => perdasProdPorHora[hora] || 0), totalPerdasProd]);
    rows.push(["PERDAS FALHA", ...turnoAtual.horas.map((hora) => perdasFalhaPorHora[hora] || 0), totalPerdasFalha]);
    rows.push([
      "REAL LÍQUIDO",
      ...turnoAtual.horas.map((hora) => Math.max(0, safeNumber(totalPorHora[hora]) - safeNumber(perdasFalhaPorHora[hora]))),
      producaoLiquida,
    ]);

    exportCsv(`producao_${selectedDate}_${selectedTurno}`, headers, rows);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingCell(null)}>
          <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-80 mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">
              {editingCell.testor?.nome} · {editingCell.hora}
            </p>

            <p className="text-xs text-muted-foreground mb-3">
              {CAMPO_LABELS[editingCell.field] || editingCell.field}
            </p>

            {editingCell.field === "justificativa" ? (
              <textarea
                autoFocus
                rows={3}
                value={editingCell.value}
                onChange={(e) => setEditingCell((prev) => ({ ...prev, value: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingCell(null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-4 resize-none"
                placeholder="Descreva o motivo das perdas nesse horário..."
              />
            ) : (
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
            )}

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

      {editingJustificativa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingJustificativa(null)}>
          <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-80 mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">
              {editingJustificativa.testor?.nome} · {editingJustificativa.hora}
            </p>

            <p className="text-xs text-muted-foreground mb-3">Descreva o motivo das perdas</p>

            <textarea
              autoFocus
              rows={3}
              value={editingJustificativa.value}
              onChange={(e) => setEditingJustificativa((prev) => ({ ...prev, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingJustificativa(null);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-4 resize-none"
              placeholder="Ex: Sensor descalibrado, ajuste necessário..."
            />

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingJustificativa(null)} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted">
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  saveJustificativaTestor(editingJustificativa.testor, editingJustificativa.hora, editingJustificativa.value);
                  setEditingJustificativa(null);
                }}
                className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Factory className="w-5 h-5 text-blue-400 shrink-0" />
            Controle de Produção
          </h1>

          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">
            Toque para +1 · Segure para digitar · Botão − diminui · Para zerar, segure e digite 0
          </p>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="gap-1 px-2 sm:px-3" onClick={handleExportCsv}>
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">CSV</span>
          </Button>

          <Button variant="outline" size="sm" className="gap-1 px-2 sm:px-3" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">PDF</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
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

        <Select
          value={selectedTurno}
          onValueChange={(value) => {
            setSelectedTurno(value);
            setMostrarExtras(false);
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {listaTurnos.map((turno) => (
              <SelectItem key={turno.key} value={turno.key}>
                {turno.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sabado && horasExtras.length > 0 && (
          <Button variant={mostrarExtras ? "default" : "outline"} size="sm" onClick={() => setMostrarExtras((value) => !value)} className="gap-1 text-xs">
            ⏱ {mostrarExtras ? "Ocultar Extras" : "Horas Extras"}
          </Button>
        )}
      </div>

      {sabado && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium">
          ⭐ Sábado — turnos reduzidos · {mostrarExtras ? "Horas extras visíveis" : "Horas extras ocultas"}
        </div>
      )}

      {(totalGeral > 0 || totalPerdasProd > 0 || totalPerdasFalha > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "Objetivo", value: totalObjetivo || "—", color: "text-cyan-400", border: "border-cyan-500/20" },
            { label: "Produção", value: totalGeral, color: "text-blue-400", border: "border-blue-500/20" },
            { label: "Perdas Produção", value: totalPerdasProd, color: "text-orange-400", border: "border-orange-500/20" },
            { label: "Perdas Falha", value: totalPerdasFalha, color: "text-red-400", border: "border-red-500/20" },
            { label: "Real Líquido", value: producaoLiquida, color: "text-green-400", border: "border-green-500/20" },
          ].map((kpi) => (
            <Card key={kpi.label} className={`border ${kpi.border}`}>
              <CardContent className="p-2.5 sm:p-3 text-center">
                <p className={`text-xl sm:text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loadingTestores ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : testores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Factory className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum testor cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div key={`table-${sheetKey}-${records.length}`} className="overflow-x-auto rounded-xl border border-border shadow-sm -mx-1 sm:mx-0">
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${140 + turnoAtual.horas.length * 64}px` }}>
            <thead>
              <tr>
                <th colSpan={turnoAtual.horas.length + 2} className="border border-border bg-blue-600/20 px-3 py-2 text-center font-black text-xs sm:text-sm uppercase tracking-widest text-blue-400">
                  PRODUÇÃO — {dateLabel} — {turnoAtual.label}
                </th>
              </tr>

              <tr className="bg-muted/50">
                <th className="border border-border px-2 py-2 text-left font-bold text-[10px] sm:text-xs" style={{ minWidth: 90 }}>
                  TESTOR
                </th>

                {turnoAtual.horas.map((hora) => (
                  <th key={hora} className="border border-border px-0.5 py-2 text-center font-bold text-[10px] sm:text-xs" style={{ minWidth: 56 }}>
                    {hora}
                  </th>
                ))}

                <th className="border border-border px-1 py-2 text-center font-bold bg-blue-500/10 text-blue-400 text-[10px] sm:text-xs" style={{ minWidth: 48 }}>
                  TOTAL
                </th>
              </tr>
            </thead>

            <tbody>
              {testores.map((testor, idx) => {
                const total = totalPorTestor(testor);

                return (
                  <React.Fragment key={testor.id}>
                    <tr className={idx % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                      <td className="border border-border px-2 py-1 font-semibold whitespace-nowrap text-[11px] sm:text-sm">
                        {testor.nome}
                      </td>

                      {turnoAtual.horas.map((hora) => {
                        const cell = cellMap[testor.id]?.[hora] || {};
                        const val = safeNumber(cell.producao);

                        return (
                          <td key={hora} className="border border-border p-0.5 sm:p-1">
                            <div className="flex flex-col items-center gap-0">
                              <button
                                type="button"
                                onPointerDown={() => startLongPress(testor, hora, "producao")}
                                onPointerUp={() => {
                                  cancelLongPress(testor, hora, "producao");
                                  handleIncrementProducao(testor, hora);
                                }}
                                onPointerLeave={() => cancelLongPress(testor, hora, "producao")}
                                className={`w-full min-w-[44px] h-10 sm:h-11 rounded-md font-black text-sm sm:text-base transition-all select-none touch-manipulation ${
                                  val > 0 ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/35 active:scale-95" : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"
                                }`}
                              >
                                {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
                              </button>

                              {val > 0 && (
                                <button
                                  type="button"
                                  onClick={() => saveField(testor, hora, "producao", val - 1)}
                                  className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1 touch-manipulation"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td className="border border-border px-1 py-2 text-center font-black text-blue-400 bg-blue-500/5 text-sm">
                        {total > 0 ? total : "—"}
                      </td>
                    </tr>

                    <tr className={idx % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                      <td className="border border-border px-2 py-1 text-yellow-400/70 text-[9px] font-semibold whitespace-nowrap">
                        💬 justif.
                      </td>

                      {turnoAtual.horas.map((hora) => {
                        const key = `${testor.id}-${hora}`;
                        const just = justificativasMap[key] || "";

                        return (
                          <td key={hora} className="border border-border p-0.5">
                            <button
                              type="button"
                              onClick={() => setEditingJustificativa({ testor, hora, value: just })}
                              className={`w-full min-h-[28px] rounded text-[9px] leading-tight px-1 py-1 text-left transition-all touch-manipulation break-words ${
                                just ? "text-yellow-200 bg-yellow-500/10 hover:bg-yellow-500/20" : "text-muted-foreground/20 hover:bg-muted/20 text-center"
                              }`}
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

              <tr className="bg-cyan-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-cyan-400 uppercase text-[10px] sm:text-xs">
                  OBJETIVO
                </td>

                {turnoAtual.horas.map((hora) => {
                  const val = safeNumber(objetivoPorHora[hora]);

                  return (
                    <td key={hora} className="border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const testorBase = testores[0];

                          if (!testorBase) {
                            alert("Cadastre pelo menos um testor antes de lançar objetivo.");
                            return;
                          }

                          setEditingCell({
                            testor: testorBase,
                            hora,
                            field: "objetivo",
                            value: String(val),
                          });
                        }}
                        className={`w-full h-8 rounded font-bold text-xs transition-all touch-manipulation ${
                          val > 0 ? "text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25" : "text-muted-foreground/30 hover:bg-muted/30"
                        }`}
                      >
                        {val > 0 ? val : <span className="text-[9px] opacity-40">+</span>}
                      </button>
                    </td>
                  );
                })}

                <td className="border border-border text-center font-black text-white bg-cyan-600 py-1.5 text-xs sm:text-sm">
                  {totalObjetivo > 0 ? totalObjetivo : "—"}
                </td>
              </tr>

              <tr className="bg-blue-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-blue-400 uppercase text-[10px] sm:text-xs">
                  PRODUÇÃO
                </td>

                {turnoAtual.horas.map((hora) => (
                  <td key={hora} className="border border-border text-center font-bold text-blue-400 py-1.5 text-xs sm:text-sm">
                    {totalPorHora[hora] > 0 ? totalPorHora[hora] : "—"}
                  </td>
                ))}

                <td className="border border-border text-center font-black text-white bg-blue-600 py-1.5 text-xs sm:text-sm">
                  {totalGeral > 0 ? totalGeral : "—"}
                </td>
              </tr>

              <tr className="bg-orange-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-orange-400 uppercase text-[10px] sm:text-xs leading-tight">
                  PERDAS<br />PRODUÇÃO
                </td>

                {turnoAtual.horas.map((hora) => {
                  const val = perdasProdPorHora[hora] || 0;

                  return (
                    <td key={hora} className="border border-border text-center font-bold text-orange-400 py-1.5 text-xs sm:text-sm">
                      {val > 0 ? val : "—"}
                    </td>
                  );
                })}

                <td className="border border-border text-center font-black text-white bg-orange-600 py-1.5 text-xs sm:text-sm">
                  {totalPerdasProd > 0 ? totalPerdasProd : "—"}
                </td>
              </tr>

              <tr className="bg-red-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-red-400 uppercase text-[10px] sm:text-xs leading-tight">
                  PERDAS<br />FALHA
                </td>

                {turnoAtual.horas.map((hora) => {
                  const val = perdasFalhaPorHora[hora] || 0;

                  return (
                    <td key={hora} className="border border-border text-center font-bold text-red-400 py-1.5 text-xs sm:text-sm">
                      {val > 0 ? val : "—"}
                    </td>
                  );
                })}

                <td className="border border-border text-center font-black text-white bg-red-600 py-1.5 text-xs sm:text-sm">
                  {totalPerdasFalha > 0 ? totalPerdasFalha : "—"}
                </td>
              </tr>

              <tr className="bg-green-500/10">
                <td className="border border-border px-2 py-1.5 font-black text-green-400 uppercase text-[10px] sm:text-xs leading-tight">
                  REAL<br />LÍQUIDO
                </td>

                {turnoAtual.horas.map((hora) => {
                  const liq = Math.max(0, safeNumber(totalPorHora[hora]) - safeNumber(perdasFalhaPorHora[hora]));

                  return (
                    <td key={hora} className="border border-border text-center font-bold text-green-400 py-1.5 text-xs sm:text-sm">
                      {liq > 0 ? liq : "—"}
                    </td>
                  );
                })}

                <td className="border border-border text-center font-black text-white bg-green-600 py-1.5 text-xs sm:text-sm">
                  {producaoLiquida > 0 ? producaoLiquida : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
        Toque +1 · Segure digitar · Clique no Objetivo para editar · 💬 para justificativa · Para zerar, segure e digite 0
      </p>
    </div>
  );
}