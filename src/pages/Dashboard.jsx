import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Factory,
  TrendingDown,
  TrendingUp,
  Target,
  Activity,
  AlertTriangle,
  Wrench,
  ClipboardList,
  ArrowRight,
  Gauge,
  CalendarDays,
  Clock,
} from "lucide-react";
import { getTodayShiftData } from "@/lib/shiftDetector";
import DailySummaryCard from "@/components/dashboard/DailySummaryCard";
import ProductionVsObjectiveChart from "@/components/dashboard/ProductionVsObjectiveChart";

const TURNOS = [
  { key: "primeiro", label: "1º Turno" },
  { key: "segundo", label: "2º Turno" },
  { key: "terceiro", label: "3º Turno" },
];

const TURNOS_HORAS = {
  primeiro: ["07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"],
  segundo: ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "23:45"],
  terceiro: ["23:45", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00"],
};

function safeNumber(value) {
  return Number(value || 0);
}

function goTo(path) {
  window.location.href = path;
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

function pickLatestRecord(existing, current) {
  if (!existing) return current;

  const existingId = String(existing.id || "");
  const currentId = String(current.id || "");

  const existingIsTemp = existingId.startsWith("temp-");
  const currentIsReal = currentId && !currentId.startsWith("temp-");

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

export default function Dashboard() {
  const todayShift = getTodayShiftData();

  const defaultDate = todayShift.data || todayShift.date;
  const defaultTurno = todayShift.key || todayShift.turno || "segundo";

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedTurno, setSelectedTurno] = useState(defaultTurno);

  const turnoLabel =
    TURNOS.find((turno) => turno.key === selectedTurno)?.label || "Turno";

  const { data: rawProductionRecords = [], isLoading: loadingProduction } =
    useQuery({
      queryKey: ["dashboard-production-raw"],
      queryFn: async () => {
        try {
          return await base44.entities.ProductionControl.list();
        } catch (error) {
          console.error("Erro ao carregar ProductionControl no Dashboard:", error);
          return [];
        }
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    });

  const { data: rawLossRecords = [], isLoading: loadingLosses } = useQuery({
    queryKey: ["dashboard-losses-raw"],
    queryFn: async () => {
      try {
        return await base44.entities.LossControl.list();
      } catch (error) {
        console.error("Erro ao carregar LossControl no Dashboard:", error);
        return [];
      }
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: testores = [] } = useQuery({
    queryKey: ["dashboard-testores"],
    queryFn: async () => {
      try {
        return await base44.entities.Testor.list();
      } catch (error) {
        console.error("Erro ao carregar Testor no Dashboard:", error);
        return [];
      }
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ["dashboard-occurrences"],
    queryFn: async () => {
      try {
        return await base44.entities.Occurrence.list();
      } catch (error) {
        console.error("Erro ao carregar Occurrence no Dashboard:", error);
        return [];
      }
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: maintenance = [] } = useQuery({
    queryKey: ["dashboard-maintenance"],
    queryFn: async () => {
      try {
        const records = await base44.entities.MaintenanceRequest.list();
        return records.slice(0, 100);
      } catch (error) {
        console.error("Erro ao carregar MaintenanceRequest no Dashboard:", error);
        return [];
      }
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard-tasks"],
    queryFn: async () => {
      try {
        const records = await base44.entities.Task.list();
        return records.slice(0, 100);
      } catch (error) {
        console.error("Erro ao carregar Task no Dashboard:", error);
        return [];
      }
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
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

  /*
    Produção:
    Cada célula deve ser única por testor + hora.
    Isso evita somar registros duplicados ou temporários.
  */
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

  /*
    Perdas:
    Cada célula deve ser única por:
    perda/ganho + item + hora.
    Isso faz o Dashboard bater com o Controle de Perdas.
  */
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

  /*
    Este número deve bater com o Controle de Perdas.
    Exemplo: se no Controle de Perdas consta 7, aqui deve mostrar 7.
  */
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

  /*
    Este número deve bater com a linha de perdas de produção
    do Controle de Produção.
    Exemplo: se lá consta 9, aqui deve mostrar 9.
  */
  const productionLoss = useMemo(() => {
    return Math.max(0, totalObjective - totalProduction);
  }, [totalObjective, totalProduction]);

  /*
    Esse é separado para não confundir:
    perdas do Controle de Perdas + perdas de produção.
    Exemplo: 7 + 9 = 16.
  */
  const totalOperationalLoss = useMemo(() => {
    return realLoss + productionLoss;
  }, [realLoss, productionLoss]);

  const liquidProduction = useMemo(() => {
    return Math.max(0, totalProduction - realLoss);
  }, [totalProduction, realLoss]);

  const efficiency = useMemo(() => {
    if (totalObjective <= 0) return 0;
    return Math.round((totalProduction / totalObjective) * 100);
  }, [totalProduction, totalObjective]);

  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((record) => {
      const sameDate = normalizeDate(record) === selectedDate;
      const recordTurno = normalizeTurno(record);
      const sameTurno = !recordTurno || recordTurno === selectedTurno;

      return sameDate && sameTurno;
    });
  }, [occurrences, selectedDate, selectedTurno]);

  const activeTestores = useMemo(() => {
    return testores.filter((testor) => {
      return testor.status === "rodando" || testor.status === "atencao";
    }).length;
  }, [testores]);

  const stoppedTestores = useMemo(() => {
    return testores.filter((testor) => {
      return (
        testor.status === "parado" ||
        testor.status === "manutencao" ||
        testor.status === "bloqueado"
      );
    }).length;
  }, [testores]);

  const criticalOccurrences = useMemo(() => {
    return filteredOccurrences.filter((item) => {
      return item.gravidade === "alta" || item.gravidade === "critica";
    });
  }, [filteredOccurrences]);

  const openMaintenance = useMemo(() => {
    return maintenance.filter((item) => {
      return item.status !== "concluido";
    });
  }, [maintenance]);

  const openTasks = useMemo(() => {
    return tasks.filter((item) => {
      return item.status !== "concluida";
    });
  }, [tasks]);

  const loading = loadingProduction || loadingLosses;

  const mainCards = [
    {
      title: "Produção",
      value: totalProduction,
      subtitle: `${productionCells.length} células lançadas`,
      icon: Factory,
      color: "text-blue-400",
      border: "border-blue-500/20",
      bg: "bg-blue-500/5",
    },
    {
      title: "Objetivo",
      value: totalObjective || "—",
      subtitle: totalObjective > 0 ? `${efficiency}% de eficiência` : "Sem objetivo",
      icon: Target,
      color: "text-cyan-400",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/5",
    },
    {
      title: "Perdas por Falha",
      value: totalGrossLosses,
      subtitle: "Bate com Controle de Perdas",
      icon: TrendingDown,
      color: "text-red-400",
      border: "border-red-500/20",
      bg: "bg-red-500/5",
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
      value: totalOperationalLoss,
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
            <Activity className="w-6 h-6 text-blue-400" />
            Dashboard ZP7
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Produção, perdas e ganhos filtrados por data e turno. Perdas por falha e perdas de produção ficam separadas.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-400" />

            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
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

      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {mainCards.map((card) => {
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

      <DailySummaryCard
        today={selectedDate}
        rawProductionRecords={rawProductionRecords}
        rawLossRecords={rawLossRecords}
      />

      <ProductionVsObjectiveChart
        productionRecords={productionRecords}
        horas={TURNOS_HORAS[selectedTurno] || TURNOS_HORAS.segundo}
        turnoLabel={turnoLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Factory className="w-4 h-4 text-blue-400" />
                  Controle de Produção
                </h2>

                <p className="text-xs text-muted-foreground">
                  {selectedDate} · {turnoLabel}
                </p>
              </div>

              <Button size="sm" variant="outline" onClick={() => goTo("/controle-producao")}>
                Abrir
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Produção</span>
                <span className="font-black text-blue-400">{totalProduction}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Objetivo</span>
                <span className="font-black text-cyan-400">{totalObjective || "—"}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Perdas produção</span>
                <span className="font-black text-orange-400">{productionLoss}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Eficiência</span>
                <span className="font-black text-green-400">{efficiency}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  Controle de Perdas
                </h2>

                <p className="text-xs text-muted-foreground">
                  {selectedDate} · {turnoLabel}
                </p>
              </div>

              <Button size="sm" variant="outline" onClick={() => goTo("/controle-perdas")}>
                Abrir
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Perdas por falha</span>
                <span className="font-black text-red-400">{totalGrossLosses}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Ganhos</span>
                <span className="font-black text-green-400">{totalGains}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Perda real</span>
                <span className="font-black text-orange-400">{realLoss}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Células únicas</span>
                <span className="font-black text-muted-foreground">{lossCells.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  Resumo de Perdas
                </h2>

                <p className="text-xs text-muted-foreground">
                  Separado para não misturar números
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Perdas por falha</span>
                <span className="font-black text-red-400">{totalGrossLosses}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Perdas produção</span>
                <span className="font-black text-orange-400">{productionLoss}</span>
              </div>

              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Perda operacional</span>
                <span className="font-black text-purple-400">{totalOperationalLoss}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Real líquido</span>
                <span className="font-black text-emerald-400">{liquidProduction}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  Status da Área
                </h2>

                <p className="text-xs text-muted-foreground">
                  Resumo operacional
                </p>
              </div>

              <Button size="sm" variant="outline" onClick={() => goTo("/testores")}>
                Testores
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Testores ativos</span>
                <span className="font-black text-green-400">{activeTestores}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Testores parados</span>
                <span className="font-black text-red-400">{stoppedTestores}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Ocorrências críticas</span>
                <span className="font-black text-orange-400">{criticalOccurrences.length}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Manutenções abertas</span>
                <span className="font-black text-yellow-400">{openMaintenance.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Ocorrências
                </h2>

                <p className="text-xs text-muted-foreground">
                  {selectedDate} · {turnoLabel}
                </p>
              </div>

              <Button size="sm" variant="outline" onClick={() => goTo("/ocorrencias")}>
                Ver
              </Button>
            </div>

            {filteredOccurrences.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Nenhuma ocorrência encontrada para este filtro.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredOccurrences.slice(0, 5).map((item) => (
                  <div key={item.id} className="p-2 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold truncate">
                        {item.tipo || "Ocorrência"}
                      </p>

                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
                        {item.gravidade || "normal"}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {item.descricao || item.acao_tomada || "Sem descrição"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-400" />
                Pendências
              </h2>

              <p className="text-xs text-muted-foreground">
                Tarefas e manutenção abertas
              </p>
            </div>

            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => goTo("/tasks")}>
                Tarefas
              </Button>

              <Button size="sm" variant="outline" onClick={() => goTo("/manutencao")}>
                <Wrench className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {openTasks.length === 0 && openMaintenance.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Nenhuma pendência aberta.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {openTasks.slice(0, 3).map((item) => (
                <div key={item.id} className="p-2 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold truncate">
                      {item.titulo || "Tarefa"}
                    </p>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                      {item.status || "aberta"}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {item.descricao || "Sem descrição"}
                  </p>
                </div>
              ))}

              {openMaintenance.slice(0, 3).map((item) => (
                <div key={item.id} className="p-2 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold truncate">
                      {item.testor_nome || "Manutenção"}
                    </p>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                      {item.prioridade || item.status || "aberta"}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {item.descricao || item.tipo_falha || "Sem descrição"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4">
          <h2 className="text-sm font-black mb-2 text-blue-400">
            Conferência dos cálculos
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Registros produção</p>
              <p className="font-black text-blue-400">{productionRecords.length}</p>
            </div>

            <div>
              <p className="text-muted-foreground">Células produção únicas</p>
              <p className="font-black text-blue-400">{productionCells.length}</p>
            </div>

            <div>
              <p className="text-muted-foreground">Registros perdas</p>
              <p className="font-black text-red-400">{lossRecords.length}</p>
            </div>

            <div>
              <p className="text-muted-foreground">Células perdas únicas</p>
              <p className="font-black text-red-400">{lossCells.length}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mt-3">
            Se no Controle de Perdas consta 7, o card “Perdas por Falha” deve mostrar 7.
            Se no Controle de Produção consta 9 em perdas produção, o card “Perdas Produção” deve mostrar 9.
            A “Perda Operacional” é a soma separada dos dois indicadores.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}