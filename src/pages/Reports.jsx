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
} from "lucide-react";
import { format } from "date-fns";
import { getTodayShiftData } from "@/lib/shiftDetector";

const TURNOS = [
  {
    key: "primeiro",
    label: "1º Turno",
  },
  {
    key: "segundo",
    label: "2º Turno",
  },
  {
    key: "terceiro",
    label: "3º Turno",
  },
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

function getRecordTime(record) {
  return record.updated_date || record.created_date || record.id || "";
}

function isTempId(id) {
  return String(id || "").startsWith("temp-");
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

export default function Reports() {
  const todayShift = getTodayShiftData();
  const today = todayShift.data || todayShift.date || format(new Date(), "yyyy-MM-dd");

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTurno, setSelectedTurno] = useState(
    todayShift.key || todayShift.turno || "segundo"
  );

  const turnoLabel =
    TURNOS.find((turno) => turno.key === selectedTurno)?.label || "Turno";

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
      return (
        normalizeDate(record) === selectedDate &&
        normalizeTurno(record) === selectedTurno
      );
    });
  }, [rawProductionRecords, selectedDate, selectedTurno]);

  const lossRecords = useMemo(() => {
    return rawLossRecords.filter((record) => {
      return (
        normalizeDate(record) === selectedDate &&
        normalizeTurno(record) === selectedTurno
      );
    });
  }, [rawLossRecords, selectedDate, selectedTurno]);

  const productionCellMap = useMemo(() => {
    const map = {};

    productionRecords.forEach((record) => {
      if (!record.testor_id || !record.hora) return;

      const key = `${record.testor_id}-${record.hora}`;
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

      const tipo = record.motivo_perda === "ganho" ? "ganho" : "perda";
      const key = `${tipo}-${record.item_perda}-${record.hora}`;

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

    return Object.values(map).sort((a, b) => b.total - a.total);
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

  const handleExportFullCsv = () => {
    const headers = ["Indicador", "Valor"];

    const rows = [
      ["Data", selectedDate],
      ["Turno", turnoLabel],
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

  const handlePrint = () => {
    window.print();
  };

  const loading = loadingProduction || loadingLosses;

  const cards = [
    {
      title: "Objetivo",
      value: totalObjective || "—",
      subtitle: "Meta do turno",
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
            Relatórios filtrados por data e turno, sem import duplicado e sem somar registros antigos.
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
              <SelectTrigger className="border-0 bg-transparent h-6 w-32 p-0 text-xs focus:ring-0">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-400" />
              Resumo de Produção
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-bold">{selectedDate}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Turno</span>
              <span className="font-bold">{turnoLabel}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Objetivo</span>
              <span className="font-black text-cyan-400">{totalObjective || "—"}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Produção</span>
              <span className="font-black text-blue-400">{totalProduction}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Perdas Produção</span>
              <span className="font-black text-orange-400">{productionLoss}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Eficiência</span>
              <span className="font-black text-green-400">{efficiency}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Resumo de Perdas
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perdas por Falha</span>
              <span className="font-black text-red-400">{totalGrossLosses}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Ganhos</span>
              <span className="font-black text-green-400">{totalGains}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Perda Real</span>
              <span className="font-black text-orange-400">{realLoss}</span>
            </div>

            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Perda Operacional</span>
              <span className="font-black text-purple-400">{operationalLoss}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Real Líquido</span>
              <span className="font-black text-emerald-400">{liquidProduction}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-400" />
              Conferência
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registros Produção</span>
              <span className="font-black text-blue-400">{productionRecords.length}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Células Produção</span>
              <span className="font-black text-blue-400">{productionCells.length}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Registros Perdas</span>
              <span className="font-black text-red-400">{lossRecords.length}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Células Perdas</span>
              <span className="font-black text-red-400">{lossCells.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-400" />
              Produção por Testor
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productionByTestor.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma produção encontrada para o filtro selecionado.
              </p>
            ) : (
              <div className="space-y-2">
                {productionByTestor.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
                    <span className="text-xs font-semibold truncate">{item.nome}</span>
                    <span className="text-sm font-black text-blue-400">{item.total}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Perdas por Item
            </CardTitle>
          </CardHeader>

          <CardContent>
            {lossesByItem.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma perda encontrada para o filtro selecionado.
              </p>
            ) : (
              <div className="space-y-2">
                {lossesByItem.map((item) => (
                  <div key={item.item} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
                    <span className="text-xs font-semibold truncate">{item.item}</span>
                    <span className="text-sm font-black text-red-400">{item.total}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {gainsByItem.length > 0 && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Ganhos por Item
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-2">
              {gainsByItem.map((item) => (
                <div key={item.item} className="flex items-center justify-between p-2 rounded-lg border border-green-500/20 bg-green-500/5">
                  <span className="text-xs font-semibold truncate">{item.item}</span>
                  <span className="text-sm font-black text-green-400">{item.total}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4">
          <h2 className="text-sm font-black mb-2 text-blue-400">
            Arquivo Reports.jsx corrigido
          </h2>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Este arquivo mantém apenas um import do React, evitando o erro de
            <strong> useState duplicado</strong>. Os relatórios também separam
            perdas por falha, perdas de produção, ganhos, perda real e perda operacional.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}