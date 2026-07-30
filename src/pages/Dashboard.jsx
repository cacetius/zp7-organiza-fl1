import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  Car, Target, TrendingDown, Gauge, AlertTriangle, ClipboardList,
  ArrowRight, CheckCircle2, Factory, Wrench, ArrowRightLeft,
  BarChart3, CheckSquare, Activity, Zap, Clock, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ShiftGoalChart from "@/components/dashboard/ShiftGoalChart";
import ShiftDeviationForecast from "@/components/dashboard/ShiftDeviationForecast";
import EfficiencyRankingCard from "@/components/dashboard/EfficiencyRankingCard";
import TestorRankingCard from "@/components/dashboard/TestorRankingCard";
import { detectCurrentShift } from "@/lib/shiftDetector";

const DEFAULT_LOSS_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

const gravConfig = {
  critica: { cls: "badge-danger", label: "Crítica" },
  alta:    { cls: "badge-warning", label: "Alta" },
  media:   { cls: "badge-neutral", label: "Média" },
  baixa:   { cls: "badge-info", label: "Baixa" },
};

const statusDot = {
  rodando:    "bg-green-500",
  atencao:    "bg-amber-500",
  parado:     "bg-red-500",
  manutencao: "bg-orange-500",
  bloqueado:  "bg-slate-400",
};

const statusLabel = {
  rodando: "Operando", atencao: "Atenção", parado: "Parado",
  manutencao: "Manutenção", bloqueado: "Bloqueado",
};

export default function Dashboard() {
  const qc = useQueryClient();
  const today = format(new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })), "yyyy-MM-dd");
  const now = new Date();
  const dateLabel = format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const timeLabel = format(now, "HH:mm", { locale: ptBR });

  useEffect(() => {
    const subs = [
      base44.entities.Testor.subscribe(() => qc.invalidateQueries({ queryKey: ["testores"] })),
      base44.entities.Task.subscribe(() => qc.invalidateQueries({ queryKey: ["tasks-open"] })),
      base44.entities.Occurrence.subscribe(() => qc.invalidateQueries({ queryKey: ["occurrences-open"] })),
      base44.entities.LossControl.subscribe(() => qc.invalidateQueries({ queryKey: ["losses-today"] })),
      base44.entities.ProductionControl.subscribe(() => qc.invalidateQueries({ queryKey: ["prod-today"] })),
    ];
    return () => subs.forEach(u => u());
  }, []);

  const { data: testores = [] } = useQuery({ queryKey: ["testores"], queryFn: () => base44.entities.Testor.list(), staleTime: 5 * 60_000 });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-open"], queryFn: () => base44.entities.Task.filter({ status: "aberta" }), staleTime: 2 * 60_000 });
  const { data: occurrences = [] } = useQuery({ queryKey: ["occurrences-open"], queryFn: () => base44.entities.Occurrence.filter({ status: "aberta" }), staleTime: 2 * 60_000 });
  const { data: allLosses = [] } = useQuery({ queryKey: ["losses-today"], queryFn: () => base44.entities.LossControl.filter({ data: today }), staleTime: 60_000 });
  const { data: allProd = [] } = useQuery({ queryKey: ["prod-today"], queryFn: () => base44.entities.ProductionControl.filter({ data: today }), staleTime: 60_000 });
  const { data: maintenanceData = [] } = useQuery({ queryKey: ["maintenance-today"], queryFn: () => base44.entities.MaintenanceRequest.filter({ status: "aberto" }), staleTime: 60_000 });

  const currentShift = detectCurrentShift();
  const yesterday = format(new Date(now.getTime() - 86400000), "yyyy-MM-dd");
  const shiftDates = currentShift.key === "terceiro" ? [today, yesterday] : [today];

  const prodTurno = allProd.filter(p => p.turno === currentShift.key && shiftDates.includes(p.data));
  const lossesTurno = allLosses.filter(l => l.turno === currentShift.key && shiftDates.includes(l.data));
  const maintenanceTurno = maintenanceData.filter(m => m.turno === currentShift.key || !m.turno);

  const totalProdTurno = prodTurno.reduce((s, p) => s + (p.carros_produzidos || 0), 0);
  const perdasBrutas = lossesTurno.filter(l => l.motivo_perda !== "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(l.item_perda)).reduce((s, l) => s + (l.carros_perdidos || 0), 0);
  const ganhos = lossesTurno.filter(l => l.motivo_perda === "ganho" && (l.carros_perdidos || 0) > 0).reduce((s, l) => s + (l.carros_perdidos || 0), 0);
  const perdaReal = Math.max(0, perdasBrutas - ganhos);
  const prodLiquida = Math.max(0, totalProdTurno - perdaReal);

  const testoresRodando = testores.filter(t => t.status === "rodando").length;
  const testoresParados = testores.filter(t => ["parado", "manutencao"].includes(t.status)).length;

  const eficiencia = totalProdTurno > 0 ? Math.round((prodLiquida / totalProdTurno) * 100) : null;
  const shiftLabel = { primeiro: "1º Turno · 06h–15h", segundo: "2º Turno · 15h–23h", terceiro: "3º Turno · 21h–06h" }[currentShift.key];

  const criticalOccs = occurrences.filter(o => o.gravidade === "critica" || o.gravidade === "alta");

  return (
    <div className="space-y-5 pb-20 lg:pb-4">

      {/* ── Cabeçalho da página ── */}
      <div className="flex items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Painel Operacional</h1>
          <p className="text-[13px] text-muted-foreground capitalize mt-0.5">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-[12px] text-green-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Ao vivo · {timeLabel}
          </span>
          <span className="hidden sm:inline badge-info">{shiftLabel}</span>
        </div>
      </div>

      {/* ── KPIs principais — layout assimétrico ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI grande — produção bruta */}
        <div className="page-section p-4 col-span-1">
          <p className="stat-label mb-2 flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-blue-400" /> Produção Bruta
          </p>
          <p className="stat-value text-blue-400">{totalProdTurno}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{shiftLabel}</p>
        </div>

        <div className="page-section p-4 col-span-1">
          <p className="stat-label mb-2 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-green-500" /> Prod. Líquida
          </p>
          <p className="stat-value text-green-500">{prodLiquida}</p>
          {eficiencia !== null && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">Eficiência</span>
                <span className={`font-semibold ${eficiencia >= 80 ? "text-green-500" : eficiencia >= 60 ? "text-amber-500" : "text-red-500"}`}>{eficiencia}%</span>
              </div>
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${eficiencia >= 80 ? "bg-green-500" : eficiencia >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(eficiencia, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="page-section p-4 col-span-1">
          <p className="stat-label mb-2 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Perda Real
          </p>
          <p className={`stat-value ${perdaReal > 0 ? "text-red-500" : "text-muted-foreground"}`}>{perdaReal}</p>
          <p className="text-[11px] text-muted-foreground mt-1">carros perdidos</p>
        </div>

        <div className="page-section p-4 col-span-1">
          <p className="stat-label mb-2 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Testores
          </p>
          <p className={`stat-value ${testoresParados > 0 ? "text-amber-500" : "text-green-500"}`}>
            {testoresRodando}<span className="text-muted-foreground text-base font-normal">/{testores.length}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {testoresParados > 0 ? `${testoresParados} parado(s)` : "todos operando"}
          </p>
        </div>
      </div>

      {/* ── Alertas críticos (visível apenas se houver) ── */}
      {criticalOccs.length > 0 && (
        <div className="page-section border-l-4 border-l-red-500">
          <div className="page-section-header">
            <span className="page-section-title flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-4 h-4" />
              {criticalOccs.length} ocorrência{criticalOccs.length > 1 ? "s" : ""} crítica{criticalOccs.length > 1 ? "s" : ""} em aberto
            </span>
            <Link to="/ocorrencias" className="text-[12px] text-muted-foreground hover:text-primary flex items-center gap-1">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {criticalOccs.slice(0, 3).map(occ => (
              <div key={occ.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium capitalize text-foreground truncate">{occ.tipo?.replace(/_/g, " ") || "Ocorrência"}</p>
                    <p className="text-[11px] text-muted-foreground">{occ.testor || "—"} {occ.local ? `· ${occ.local}` : ""}</p>
                  </div>
                </div>
                <span className={gravConfig[occ.gravidade]?.cls || "badge-neutral"}>
                  {gravConfig[occ.gravidade]?.label || occ.gravidade}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Grid principal: Gráfico + Status lateral ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ShiftGoalChart prodData={allProd} lossData={allLosses} date={today} />
        </div>

        {/* Painel lateral: Pendências + Acesso rápido */}
        <div className="space-y-3">
          {/* Pendências numéricas */}
          <div className="page-section">
            <div className="page-section-header">
              <span className="page-section-title">Pendências</span>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Tarefas abertas", value: tasks.length, path: "/tarefas", icon: ClipboardList, warn: tasks.length > 0 },
                { label: "Ocorrências", value: occurrences.length, path: "/ocorrencias", icon: AlertTriangle, warn: occurrences.length > 0 },
                { label: "Manutenções", value: maintenanceData.length, path: "/manutencao", icon: Wrench, warn: maintenanceData.length > 0 },
                { label: "Testores parados", value: testoresParados, path: "/testores", icon: Activity, warn: testoresParados > 0 },
              ].map(item => (
                <Link key={item.label} to={item.path} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/40 transition-colors group">
                  <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                    <item.icon className="w-3.5 h-3.5 shrink-0" />
                    {item.label}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-semibold tabular-nums ${item.warn && item.value > 0 ? "text-amber-500" : "text-foreground"}`}>
                      {item.value}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Acesso rápido */}
          <div className="page-section">
            <div className="page-section-header">
              <span className="page-section-title">Acesso Rápido</span>
            </div>
            <div className="p-3 grid grid-cols-3 gap-1.5">
              {[
                { label: "Produção", path: "/controle-producao", icon: Factory },
                { label: "Perdas", path: "/controle-perdas", icon: TrendingDown },
                { label: "Testores", path: "/testores", icon: Gauge },
                { label: "Checklist", path: "/checklist", icon: CheckSquare },
                { label: "Passagem", path: "/passagem-turno", icon: ArrowRightLeft },
                { label: "Relatórios", path: "/relatorios", icon: BarChart3 },
              ].map(a => (
                <Link
                  key={a.path}
                  to={a.path}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded hover:bg-accent/60 transition-colors text-center"
                >
                  <a.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Previsão de desvio ── */}
      <ShiftDeviationForecast prodData={prodTurno} lossData={lossesTurno} currentShiftKey={currentShift.key} />

      {/* ── Grid inferior: Testores + Ocorrências ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Testores */}
        <div className="page-section">
          <div className="page-section-header">
            <span className="page-section-title flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-muted-foreground" /> Status dos Testores
            </span>
            <Link to="/testores" className="text-[12px] text-muted-foreground hover:text-primary flex items-center gap-1">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {testores.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-8">Nenhum testor cadastrado.</p>
            ) : (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Testor</th>
                    <th>Status</th>
                    <th className="text-right">Carros/h</th>
                  </tr>
                </thead>
                <tbody>
                  {testores.slice(0, 7).map(t => (
                    <tr key={t.id}>
                      <td className="font-medium text-foreground">{t.nome}</td>
                      <td>
                        <span className="flex items-center gap-1.5 text-[12px]">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[t.status] || "bg-slate-400"} ${t.status === "rodando" ? "animate-pulse" : ""}`} />
                          {statusLabel[t.status] || t.status}
                        </span>
                      </td>
                      <td className="text-right tabular-nums text-[13px] font-medium">
                        {t.carros_por_hora > 0 ? t.carros_por_hora : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Ocorrências */}
        <div className="page-section">
          <div className="page-section-header">
            <span className="page-section-title flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" /> Ocorrências em Aberto
            </span>
            <Link to="/ocorrencias" className="text-[12px] text-muted-foreground hover:text-primary flex items-center gap-1">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {occurrences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-green-500/50" />
                <p className="text-[13px] text-green-600 font-medium">Sem ocorrências em aberto</p>
              </div>
            ) : (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Testor</th>
                    <th>Gravidade</th>
                  </tr>
                </thead>
                <tbody>
                  {occurrences.slice(0, 7).map(occ => (
                    <tr key={occ.id}>
                      <td className="font-medium text-foreground capitalize">{occ.tipo?.replace(/_/g, " ") || "—"}</td>
                      <td className="text-muted-foreground">{occ.testor || "—"}</td>
                      <td>
                        <span className={gravConfig[occ.gravidade]?.cls || "badge-neutral"}>
                          {gravConfig[occ.gravidade]?.label || occ.gravidade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Ranking de testores + eficiência ── */}
      <TestorRankingCard />
      <EfficiencyRankingCard />

    </div>
  );
}