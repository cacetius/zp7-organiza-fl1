import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  FileSpreadsheet,
  Printer,
  CalendarDays,
  Clock,
  Factory,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Target,
  Gauge,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { getTodayShiftData } from "@/lib/shiftDetector";

const TURNOS = [
  { key: "todos", label: "Resumo Diário" },
  { key: "primeiro", label: "1º Turno" },
  { key: "segundo", label: "2º Turno" },
  { key: "terceiro", label: "3º Turno" },
];

const HORAS_PADRAO = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
  "23:45", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
];

function safeNumber(value) {
  return Number(value || 0);
}

function normalizeDate(record) {
  if (record.data) return record.data;
  if (record.date) return record.date;
  if (record.created_date) return String(record.created_date).slice(0, 10);
  return "";
}

function normalizeTurno(record) {
  return record.turno || record.shift || record.turno_key || "";
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

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `${filename}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function BarLine({ label, value, max, colorClass = "bg-blue-500" }) {
  const percent = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="font-black">{value}</span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MiniColumnChart({ data, valueKey, labelKey, colorClass = "bg-blue-500" }) {
  const max = Math.max(...data.map((item) => safeNumber(item[valueKey])), 0);

  if (!data.length || max <= 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
        Sem dados para exibir gráfico.
      </div>
    );
  }

  return (
    <div className="h-44 flex items-end gap-1 overflow-x-auto pt-4">
      {data.map((item) => {
        const value = safeNumber(item[valueKey]);
        const height = max > 0 ? Math.max(8, Math.round((value / max) * 130)) : 0;

        return (
          <div
            key={item[labelKey]}
            className="flex flex-col items-center justify-end gap-1 min-w-[34px]"
            title={`${item[labelKey]}: ${value}`}
          >
            <span className="text-[10px] font-bold text-muted-foreground">
              {value > 0 ? value : ""}
            </span>

            <div
              className={`w-5 rounded-t ${colorClass}`}
              style={{ height }}
            />

            <span className="text-[9px] text-muted-foreground rotate-[-35deg] origin-top-left whitespace-nowrap">
              {item[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Reports() {
  const todayShift = getTodayShiftData();
  const today =
    todayShift.data || todayShift.date || format(new Date(), "yyyy-MM-dd");

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTurno, setSelectedTurno] = useState("todos");

  const turnoLabel =
    TURNOS.find((turno) => turno.key === selectedTurno)?.label || "Resumo";

  const { data: rawProductionRecords = [], isLoading: loadingProduction } =
    useQuery({
      queryKey: ["reports-production"],
      queryFn: async () => {
        try {
          return await base44.entities.ProductionControl.list();
        } catch (error) {
          console.error("Erro ao carregar ProductionControl:", error);
          return [];
        }
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    });

  const { data: rawLossRecords = [], isLoading: loadingLosses } = useQuery({
    queryKey: ["reports-losses"],
    queryFn: async () => {
      try {
        return await base44.entities.LossControl.list();
      } catch (error) {
        console.error("Erro ao carregar LossControl:", error);
        return [];
      }
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: testores = [] } = useQuery({
    queryKey: ["reports-testores"],
    queryFn: async () => {
      try {
        return await base44.entities.Testor.list();
      } catch (error) {
        console.error("Erro ao carregar Testor:", error);
        return [];
      }
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const productionRecords = useMemo(() => {
    return rawProductionRecords.filter((record) => {
      const sameDate = normalizeDate(record) === selectedDate;
      const sameTurno =
        selectedTurno === "todos" || normalizeTurno(record) === selectedTurno;

      return sameDate && sameTurno;
    });
  }, [rawProductionRecords, selectedDate, selectedTurno]);

  const lossRecords = useMemo(() => {
    return rawLossRecords.filter((record) => {
      const sameDate = normalizeDate(record) === selectedDate;
      const sameTurno =
        selectedTurno === "todos" || normalizeTurno(record) === selectedTurno;

      return sameDate && sameTurno;
    });
  }, [rawLossRecords, selectedDate, selectedTurno]);

  const productionCellMap = useMemo(() => {
    const map = {};

    productionRecords.forEach((record) => {
      if (!record.testor_id || !record.hora) return;

      const turno = normalizeTurno(record) || "sem_turno";
      const key = `${turno}-${record.testor_id}-${record.hora}`;

      map[key] = pickLatestRecord(map[key], record);
    });

    return map;
  }, [productionRecords]);

  const productionCells = useMemo(() => {
    return Object.values(productionCellMap);
  }, [productionCellMap]);

  const lossCellMap = useMemo(() => {
    const map = {};

    lossRecords.forEach((record) => {
      if (!record.item_perda || !record.hora) return;

      const turno = normalizeTurno(record) || "sem_turno";
      const tipo = record.motivo_perda === "ganho" ? "ganho" : "perda";
      const key = `${turno}-${tipo}-${record.item_perda}-${record.hora}`;

      map[key] = pickLatestRecord(map[key], record);
    });

    return map;
  }, [lossRecords]);

  const lossCells = useMemo(() => {
    return Object.values(lossCellMap);
  }, [lossCellMap]);

  const totalProduction = useMemo(() => {
    return productionCells.reduce((sum, record) => {
      return sum + safeNumber(record.carros_produzidos);
    }, 0);
  }, [productionCells]);

  const totalObjective = useMemo(() => {
    return productionCells.reduce((sum, record) => {
      return sum + safeNumber(record.objetivo);
    }, 0);
  }, [productionCells]);

  const productionLoss = useMemo(() => {
    return Math.max(0, totalObjective - totalProduction);
  }, [totalObjective, totalProduction]);

  const totalGrossLosses = useMemo(() => {
    return lossCells
      .filter((record) => record.motivo_perda !== "ganho")
      .reduce((sum, record) => {
        return sum + safeNumber(record.carros_perdidos);
      }, 0);
  }, [lossCells]);

  const totalGains = useMemo(() => {
    return lossCells
      .filter((record) => record.motivo_perda === "ganho")
      .reduce((sum, record) => {
        return sum + safeNumber(record.carros_perdidos);
      }, 0);
  }, [lossCells]);

  const realLoss = useMemo(() => {
    return Math.max(0, totalGrossLosses - totalGains);
  }, [totalGrossLosses, totalGains]);

  const operationalLoss = useMemo(() => {
    return productionLoss + realLoss;
  }, [productionLoss, realLoss]);

  const liquidProduction = useMemo(() => {
    return Math.max(0, totalProduction - realLoss);
  }, [totalProduction, realLoss]);

  const efficiency = useMemo(() => {
    if (totalObjective <= 0) return 0;
    return Math.round((totalProduction / totalObjective) * 100);
  }, [totalProduction, totalObjective]);

  const productionByHour = useMemo(() => {
    const map = {};

    HORAS_PADRAO.forEach((hora) => {
      map[hora] = {
        hora,
        producao: 0,
        objetivo: 0,
        perdaProducao: 0,
      };
    });

    productionCells.forEach((record) => {
      const hora = record.hora;

      if (!map[hora]) {
        map[hora] = {
          hora,
          producao: 0,
          objetivo: 0,
          perdaProducao: 0,
        };
      }

      map[hora].producao += safeNumber(record.carros_produzidos);
      map[hora].objetivo += safeNumber(record.objetivo);
    });

    Object.values(map).forEach((item) => {
      item.perdaProducao = Math.max(0, item.objetivo - item.producao);
    });

    return Object.values(map).filter((item) => {
      return item.producao > 0 || item.objetivo > 0 || item.perdaProducao > 0;
    });
  }, [productionCells]);

  const lossesByHour = useMemo(() => {
    const map = {};

    HORAS_PADRAO.forEach((hora) => {
      map[hora] = {
        hora,
        perdas: 0,
        ganhos: 0,
        perdaReal: 0,
      };
    });

    lossCells.forEach((record) => {
      const hora = record.hora;

      if (!map[hora]) {
        map[hora] = {
          hora,
          perdas: 0,
          ganhos: 0,
          perdaReal: 0,
        };
      }

      if (record.motivo_perda === "ganho") {
        map[hora].ganhos += safeNumber(record.carros_perdidos);
      } else {
        map[hora].perdas += safeNumber(record.carros_perdidos);
      }
    });

    Object.values(map).forEach((item) => {
      item.perdaReal = Math.max(0, item.perdas - item.ganhos);
    });

    return Object.values(map).filter((item) => {
      return item.perdas > 0 || item.ganhos > 0 || item.perdaReal > 0;
    });
  }, [lossCells]);

  const productionByTestor = useMemo(() => {
    const map = {};

    testores.forEach((testor) => {
      map[testor.id] = {
        id: testor.id,
        nome: testor.nome || "Sem nome",
        total: 0,
      };
    });

    productionCells.forEach((record) => {
      const id = record.testor_id;

      if (!map[id]) {
        map[id] = {
          id,
          nome: record.testor_nome || "Testor",
          total: 0,
        };
      }

      map[id].total += safeNumber(record.carros_produzidos);
    });

    return Object.values(map)
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [productionCells, testores]);

  const lossesByItem = useMemo(() => {
    const map = {};

    lossCells
      .filter((record) => record.motivo_perda !== "ganho")
      .forEach((record) => {
        const item = record.item_perda || "Sem item";

        if (!map[item]) {
          map[item] = {
            item,
            total: 0,
          };
        }

        map[item].total += safeNumber(record.carros_perdidos);
      });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [lossCells]);

  const gainsByItem = useMemo(() => {
    const map = {};

    lossCells
      .filter((record) => record.motivo_perda === "ganho")
      .forEach((record) => {
        const item = record.item_perda || "Sem item";

        if (!map[item]) {
          map[item] = {
            item,
            total: 0,
          };
        }

        map[item].total += safeNumber(record.carros_perdidos);
      });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [lossCells]);

  const biggestLoss = lossesByItem[0] || null;
  const bestTestor = productionByTestor[0] || null;

  const handleExportFullCsv = () => {
    const headers = ["Indicador", "Valor"];

    const rows = [
      ["Data", selectedDate],
      ["Filtro", turnoLabel],
      ["Objetivo", totalObjective],
      ["Produção", totalProduction],
      ["Perdas Produção", productionLoss],
      ["Perdas por Falha", totalGrossLosses],
      ["Ganhos", totalGains],
      ["Perda Real", realLoss],
      ["Perda Operacional", operationalLoss],
      ["Real Líquido", liquidProduction],
      ["Eficiência", `${efficiency}%`],
      ["Células Produção", productionCells.length],
      ["Células Perdas", lossCells.length],
    ];

    downloadCsv(`relatorio_geral_${selectedDate}_${selectedTurno}`, headers, rows);
  };

  const handleExportProductionCsv = () => {
    const headers = ["Testor", "Total Produzido"];
    const rows = productionByTestor.map((item) => [item.nome, item.total]);

    rows.push([]);
    rows.push(["Objetivo", totalObjective]);
    rows.push(["Produção Total", totalProduction]);
    rows.push(["Perdas Produção", productionLoss]);
    rows.push(["Eficiência", `${efficiency}%`]);

    downloadCsv(
      `relatorio_producao_${selectedDate}_${selectedTurno}`,
      headers,
      rows
    );
  };

  const handleExportLossCsv = () => {
    const headers = ["Item", "Total"];
    const rows = lossesByItem.map((item) => [item.item, item.total]);

    rows.push([]);
    rows.push(["Perdas Brutas", totalGrossLosses]);
    rows.push(["Ganhos", totalGains]);
    rows.push(["Perda Real", realLoss]);
    rows.push(["Perda Operacional", operationalLoss]);

    downloadCsv(`relatorio_perdas_${selectedDate}_${selectedTurno}`, headers, rows);
  };

  const handlePrint = () => {
    window.print();
  };

  const loading = loadingProduction || loadingLosses;

  const cards = [
    {
      title: "Objetivo",
      value: totalObjective || "—",
      subtitle: "Meta do período",
      icon: Target,
      color: "text-cyan-400",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/5",
    },
    {
      title: "Produção",
      value: totalProduction,
      subtitle: `${productionCells.length} células`,
      icon: Factory,
      color: "text-blue-400",
      border: "border-blue-500/20",
      bg: "bg-blue-500/5",
    },
    {
      title: "Perdas Produção",
      value: productionLoss,
      subtitle: "Objetivo - produção",
      icon: AlertTriangle,
      color: "text-orange-400",
      border: "border-orange-500/20",
      bg: "bg-orange-500/5",
    },
    {
      title: "Perdas por Falha",
      value: totalGrossLosses,
      subtitle: "Controle de perdas",
      icon: TrendingDown,
      color: "text-red-400",
      border: "border-red-500/20",
      bg: "bg-red-500/5",
    },
    {
      title: "Ganhos",
      value: totalGains,
      subtitle: "Carros recuperados",
      icon: TrendingUp,
      color: "text-green-400",
      border: "border-green-500/20",
      bg: "bg-green-500/5",
    },
    {
      title: "Perda Operacional",
      value: operationalLoss,
      subtitle: "Falha + produção",
      icon: Gauge,
      color: "text-purple-400",
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
    },
  ];

  return (
    <div className="space-y-5 pb-20 lg:pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" />
            Relatórios ZP7
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Resumo diário, gráficos de produção, perdas, ganhos e relatório operacional.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-400" />

            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="border-0 bg-transparent h-6 w-32 text-xs p-0 focus-visible:ring-0"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 text-xs font-semibold flex items-center gap-2 px-3 py-2">
            <Clock className="w-4 h-4 text-green-400" />

            <Select value={selectedTurno} onValueChange={setSelectedTurno}>
              <SelectTrigger className="border-0 bg-transparent h-6 w-36 p-0 text-xs focus:ring-0">
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
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExportFullCsv}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          CSV Geral
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportProductionCsv}>
          <Factory className="w-4 h-4 mr-2" />
          CSV Produção
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportLossCsv}>
          <TrendingDown className="w-4 h-4 mr-2" />
          CSV Perdas
        </Button>

        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir/PDF
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.title} className={`border ${card.border} ${card.bg}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold leading-tight">
                        {card.title}
                      </p>

                      <p className={`text-2xl sm:text-3xl font-black mt-1 ${card.color}`}>
                        {card.value}
                      </p>

                      <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                        {card.subtitle}
                      </p>
                    </div>

                    <Icon className={`w-5 h-5 ${card.color} shrink-0`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Resumo Diário
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Data</p>
              <p className="font-black">{selectedDate}</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Filtro</p>
              <p className="font-black">{turnoLabel}</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Melhor testor</p>
              <p className="font-black text-blue-400">
                {bestTestor ? `${bestTestor.nome} (${bestTestor.total})` : "—"}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Maior perda</p>
              <p className="font-black text-red-400">
                {biggestLoss ? `${biggestLoss.item} (${biggestLoss.total})` : "—"}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Produção líquida</p>
              <p className="font-black text-green-400">{liquidProduction}</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Eficiência</p>
              <p className="font-black text-cyan-400">{efficiency}%</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Células produção</p>
              <p className="font-black text-blue-400">{productionCells.length}</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Células perdas</p>
              <p className="font-black text-red-400">{lossCells.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Gráfico — Produção por Hora
            </CardTitle>
          </CardHeader>

          <CardContent>
            <MiniColumnChart
              data={productionByHour}
              valueKey="producao"
              labelKey="hora"
              colorClass="bg-blue-500"
            />
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Gráfico — Perdas por Hora
            </CardTitle>
          </CardHeader>

          <CardContent>
            <MiniColumnChart
              data={lossesByHour}
              valueKey="perdaReal"
              labelKey="hora"
              colorClass="bg-red-500"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-400" />
              Produção por Testor
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {productionByTestor.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma produção encontrada.
              </p>
            ) : (
              productionByTestor.map((item) => (
                <BarLine
                  key={item.id}
                  label={item.nome}
                  value={item.total}
                  max={productionByTestor[0]?.total || 0}
                  colorClass="bg-blue-500"
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-red-400" />
              Perdas por Item
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {lossesByItem.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma perda encontrada.
              </p>
            ) : (
              lossesByItem.map((item) => (
                <BarLine
                  key={item.item}
                  label={item.item}
                  value={item.total}
                  max={lossesByItem[0]?.total || 0}
                  colorClass="bg-red-500"
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Ganhos por Item
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {gainsByItem.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum ganho encontrado.
              </p>
            ) : (
              gainsByItem.map((item) => (
                <BarLine
                  key={item.item}
                  label={item.item}
                  value={item.total}
                  max={gainsByItem[0]?.total || 0}
                  colorClass="bg-green-500"
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}