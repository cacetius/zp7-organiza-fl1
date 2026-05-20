import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function safeNumber(value) {
  return Number(value || 0);
}

function goTo(path) {
  window.location.href = path;
}

export default function Dashboard() {
  const todayShift = getTodayShiftData();

  const today = todayShift.data || todayShift.date;
  const currentTurno = todayShift.key || todayShift.turno;
  const turnoLabel = todayShift.label || "Turno Atual";

  const { data: productionRecords = [], isLoading: loadingProduction } = useQuery({
    queryKey: ["dashboard-production", today, currentTurno],
    queryFn: async () => {
      try {
        const allRecords = await base44.entities.ProductionControl.list();

        return allRecords.filter((record) => {
          return record.data === today && record.turno === currentTurno;
        });
      } catch (error) {
        console.error("Erro ao carregar ProductionControl no Dashboard:", error);
        return [];
      }
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: lossRecords = [], isLoading: loadingLosses } = useQuery({
    queryKey: ["dashboard-losses", today, currentTurno],
    queryFn: async () => {
      try {
        const allRecords = await base44.entities.LossControl.list();

        return allRecords.filter((record) => {
          return record.data === today && record.turno === currentTurno;
        });
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
    queryKey: ["dashboard-occurrences", today, currentTurno],
    queryFn: async () => {
      try {
        const allRecords = await base44.entities.Occurrence.list();

        return allRecords.filter((record) => {
          const sameDate = record.data === today || record.created_date?.startsWith?.(today);
          const sameTurno = !record.turno || record.turno === currentTurno;

          return sameDate && sameTurno;
        });
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
        const allRecords = await base44.entities.MaintenanceRequest.list();
        return allRecords.slice(0, 50);
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
        const allRecords = await base44.entities.Task.list();
        return allRecords.slice(0, 50);
      } catch (error) {
        console.error("Erro ao carregar Task no Dashboard:", error);
        return [];
      }
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const totalProduction = useMemo(() => {
    return productionRecords.reduce((sum, record) => {
      return sum + safeNumber(record.carros_produzidos);
    }, 0);
  }, [productionRecords]);

  const totalObjective = useMemo(() => {
    return productionRecords.reduce((sum, record) => {
      return sum + safeNumber(record.objetivo);
    }, 0);
  }, [productionRecords]);

  const totalGrossLosses = useMemo(() => {
    return lossRecords
      .filter((record) => record.motivo_perda !== "ganho")
      .reduce((sum, record) => {
        return sum + safeNumber(record.carros_perdidos);
      }, 0);
  }, [lossRecords]);

  const totalGains = useMemo(() => {
    return lossRecords
      .filter((record) => record.motivo_perda === "ganho")
      .reduce((sum, record) => {
        return sum + safeNumber(record.carros_perdidos);
      }, 0);
  }, [lossRecords]);

  const realLoss = useMemo(() => {
    return Math.max(0, totalGrossLosses - totalGains);
  }, [totalGrossLosses, totalGains]);

  const liquidProduction = useMemo(() => {
    return Math.max(0, totalProduction - realLoss);
  }, [totalProduction, realLoss]);

  const productionLoss = useMemo(() => {
    return Math.max(0, totalObjective - totalProduction);
  }, [totalObjective, totalProduction]);

  const efficiency = useMemo(() => {
    if (totalObjective <= 0) return 0;
    return Math.round((totalProduction / totalObjective) * 100);
  }, [totalProduction, totalObjective]);

  const activeTestores = useMemo(() => {
    return testores.filter((testor) => {
      return testor.status === "rodando" || testor.status === "atencao";
    }).length;
  }, [testores]);

  const stoppedTestores = useMemo(() => {
    return testores.filter((testor) => {
      return testor.status === "parado" || testor.status === "manutencao" || testor.status === "bloqueado";
    }).length;
  }, [testores]);

  const criticalOccurrences = useMemo(() => {
    return occurrences.filter((item) => {
      return item.gravidade === "alta" || item.gravidade === "critica";
    });
  }, [occurrences]);

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
      title: "Produção do Turno",
      value: totalProduction,
      subtitle: "Somente hoje e turno atual",
      icon: Factory,
      color: "text-blue-400",
      border: "border-blue-500/20",
      bg: "bg-blue-500/5",
    },
    {
      title: "Objetivo",
      value: totalObjective || "—",
      subtitle: totalObjective > 0 ? `${efficiency}% de eficiência` : "Sem objetivo lançado",
      icon: Target,
      color: "text-cyan-400",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/5",
    },
    {
      title: "Perdas Brutas",
      value: totalGrossLosses,
      subtitle: "Sem contar ganhos",
      icon: TrendingDown,
      color: "text-red-400",
      border: "border-red-500/20",
      bg: "bg-red-500/5",
    },
    {
      title: "Carros Ganhos",
      value: totalGains,
      subtitle: "Recuperados no turno",
      icon: TrendingUp,
      color: "text-green-400",
      border: "border-green-500/20",
      bg: "bg-green-500/5",
    },
    {
      title: "Perda Real",
      value: realLoss,
      subtitle: "Perdas - ganhos",
      icon: AlertTriangle,
      color: "text-orange-400",
      border: "border-orange-500/20",
      bg: "bg-orange-500/5",
    },
    {
      title: "Real Líquido",
      value: liquidProduction,
      subtitle: "Produção - perda real",
      icon: Gauge,
      color: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
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
            Página inicial filtrada por data e turno atual. Não soma registros antigos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-400" />
            {today}
          </div>

          <div className="px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-400" />
            {turnoLabel}
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
                  Lançamentos do turno atual
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
                <span className="text-muted-foreground">Perda de produção</span>
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
                  Perdas filtradas por turno
                </p>
              </div>

              <Button size="sm" variant="outline" onClick={() => goTo("/controle-perdas")}>
                Abrir
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Perdas brutas</span>
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
                <span className="text-muted-foreground">Real líquido</span>
                <span className="font-black text-emerald-400">{liquidProduction}</span>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Ocorrências do Turno
                </h2>

                <p className="text-xs text-muted-foreground">
                  Somente hoje e turno atual
                </p>
              </div>

              <Button size="sm" variant="outline" onClick={() => goTo("/ocorrencias")}>
                Ver
              </Button>
            </div>

            {occurrences.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Nenhuma ocorrência encontrada para o turno atual.
              </p>
            ) : (
              <div className="space-y-2">
                {occurrences.slice(0, 5).map((item) => (
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
              <div className="space-y-2">
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
      </div>

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4">
          <h2 className="text-sm font-black mb-2 text-blue-400">
            Correção aplicada no Dashboard
          </h2>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Os números da página inicial agora são calculados apenas com registros de <strong>hoje</strong> e do <strong>turno atual</strong>.
            A produção não soma mais registros antigos. As perdas ignoram os registros marcados como <strong>ganho</strong>, e a perda real é calculada como perdas brutas menos ganhos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}