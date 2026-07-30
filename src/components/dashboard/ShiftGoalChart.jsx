import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

const DEFAULT_LOSS_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

const TURNOS = [
  { key: "primeiro", label: "1º Turno" },
  { key: "segundo",  label: "2º Turno" },
  { key: "terceiro", label: "3º Turno" },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const planejado = payload.find(p => p.dataKey === "Planejado")?.value ?? 0;
  const realizado = payload.find(p => p.dataKey === "Realizado")?.value ?? 0;
  const liquido   = payload.find(p => p.dataKey === "Líquido")?.value ?? 0;
  const desvio    = planejado > 0 ? realizado - planejado : null;
  const pct       = planejado > 0 ? Math.round((liquido / planejado) * 100) : null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-[12px] min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-6 mb-1">
          <span className="text-muted-foreground">{p.dataKey}</span>
          <span className="font-semibold text-foreground tabular-nums">{p.value ?? "—"}</span>
        </div>
      ))}
      {desvio !== null && (
        <div className="border-t border-border mt-2 pt-2 flex justify-between">
          <span className="text-muted-foreground">Desvio</span>
          <span className={`font-semibold tabular-nums ${desvio >= 0 ? "text-green-500" : "text-red-500"}`}>
            {desvio >= 0 ? "+" : ""}{desvio}
          </span>
        </div>
      )}
      {pct !== null && (
        <div className="flex justify-between mt-1">
          <span className="text-muted-foreground">Meta</span>
          <span className={`font-semibold tabular-nums ${pct >= 95 ? "text-green-500" : pct >= 75 ? "text-amber-500" : "text-red-500"}`}>
            {pct}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function ShiftGoalChart({ prodData, lossData, date }) {
  const chartData = useMemo(() => {
    return TURNOS.map(({ key, label }) => {
      const filteredProd = prodData.filter(r => r.turno === key && (!date || r.data === date));
      const filteredLoss = lossData.filter(r => r.turno === key && (!date || r.data === date));

      const meta     = filteredProd.reduce((s, r) => s + (r.objetivo || 0), 0);
      const producao = filteredProd.reduce((s, r) => s + (r.carros_produzidos || 0), 0);
      const perdasBrutas = filteredLoss.filter(r => r.motivo_perda !== "ganho" && r.item_perda && r.hora && (r.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(r.item_perda)).reduce((s, r) => s + (r.carros_perdidos || 0), 0);
      const ganhos = filteredLoss.filter(r => r.motivo_perda === "ganho" && r.item_perda && r.hora && (r.carros_perdidos || 0) > 0).reduce((s, r) => s + (r.carros_perdidos || 0), 0);
      const liquida  = Math.max(0, producao - Math.max(0, perdasBrutas - ganhos));
      const atingido = meta > 0 ? Math.round((liquida / meta) * 100) : null;

      return {
        turno: label,
        Planejado: meta || null,
        Realizado: producao || null,
        Líquido: liquida || null,
        atingido,
        desvio: meta > 0 ? producao - meta : null,
        abaixoDaMeta: meta > 0 && producao < meta,
      };
    });
  }, [prodData, lossData, date]);

  const hasData = chartData.some(d => (d.Planejado || 0) > 0 || (d.Realizado || 0) > 0);
  const alertCount = chartData.filter(d => d.abaixoDaMeta).length;

  const axisStyle = { fontSize: 11, fill: "hsl(215,12%,46%)" };
  const gridStyle = { strokeDasharray: "3 3", stroke: "hsl(220,14%,17%)", strokeOpacity: 0.6 };

  return (
    <div className="page-section">
      <div className="page-section-header">
        <span className="page-section-title">Planejado × Realizado — Hoje</span>
        {alertCount > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-red-500 font-medium">
            <AlertTriangle className="w-3 h-3" />
            {alertCount} turno{alertCount > 1 ? "s" : ""} abaixo da meta
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <p className="text-[13px]">Sem dados de produção para hoje.</p>
          <p className="text-[11px] opacity-60">Registre objetivos no Controle de Produção</p>
        </div>
      ) : (
        <div className="p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={3} barCategoryGap="32%">
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="turno" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />

              <Bar dataKey="Planejado" fill="hsl(215,12%,30%)" radius={[3,3,0,0]} maxBarSize={28} />
              <Bar dataKey="Realizado" radius={[3,3,0,0]} maxBarSize={28}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.abaixoDaMeta ? "hsl(0,68%,50%)" : "hsl(213,94%,52%)"} />
                ))}
              </Bar>
              <Bar dataKey="Líquido" radius={[3,3,0,0]} maxBarSize={28}>
                {chartData.map((entry, i) => {
                  const pct = entry.atingido;
                  const color = pct === null ? "hsl(142,60%,40%)" : pct >= 95 ? "hsl(142,60%,40%)" : pct >= 75 ? "hsl(38,88%,50%)" : "hsl(0,60%,42%)";
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legenda manual compacta */}
          <div className="flex items-center gap-4 mt-2 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-2 rounded-sm bg-muted inline-block" /> Planejado
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" /> Realizado
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> Líquido
            </div>
            <div className="ml-auto flex items-center gap-3">
              {chartData.map(d => {
                const pct = d.atingido;
                const icon = pct === null ? null : pct >= 95 ? TrendingUp : pct >= 75 ? Minus : TrendingDown;
                const color = pct === null ? "text-muted-foreground" : pct >= 95 ? "text-green-500" : pct >= 75 ? "text-amber-500" : "text-red-500";
                return (
                  <div key={d.turno} className="flex items-center gap-1 text-[11px]">
                    <span className="text-muted-foreground">{d.turno}:</span>
                    <span className={`font-semibold tabular-nums ${color}`}>
                      {pct !== null ? `${pct}%` : "—"}
                    </span>
                    {icon && React.createElement(icon, { className: `w-3 h-3 ${color}` })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}