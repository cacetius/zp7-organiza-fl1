import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, Cell, ReferenceLine
} from "recharts";
import { Target, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

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

const tooltipStyle = {
  background: "hsl(217,25%,11%)",
  border: "1px solid hsl(217,19%,22%)",
  borderRadius: "10px",
  color: "hsl(210,40%,96%)",
  fontSize: "12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};
const axisStyle = { fontSize: 11, fill: "hsl(215,16%,50%)" };
const gridStyle = { strokeDasharray: "3 3", stroke: "hsl(217,19%,16%)" };

// Cores dinâmicas por desvio
function getDesvioConfig(pct) {
  if (pct === null) return { bar: "hsl(217,91%,60%)", label: "hsl(217,91%,78%)", badge: "bg-muted/40 text-muted-foreground border-border", icon: null };
  if (pct >= 95)    return { bar: "hsl(142,71%,45%)", label: "hsl(142,71%,65%)", badge: "bg-green-500/15 text-green-400 border-green-500/30", icon: "ok" };
  if (pct >= 75)    return { bar: "hsl(38,92%,50%)",  label: "hsl(38,92%,65%)",  badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: "warn" };
  return               { bar: "hsl(0,72%,51%)",    label: "hsl(0,72%,70%)",    badge: "bg-red-500/15 text-red-400 border-red-500/30", icon: "crit" };
}

// Tooltip customizado
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const planejado = payload.find(p => p.dataKey === "Planejado")?.value ?? 0;
  const realizado = payload.find(p => p.dataKey === "Realizado")?.value ?? 0;
  const liquido   = payload.find(p => p.dataKey === "Líquido")?.value ?? 0;
  const desvio    = planejado > 0 ? realizado - planejado : null;
  const pct       = planejado > 0 ? Math.round((liquido / planejado) * 100) : null;
  const cfg       = getDesvioConfig(pct);

  return (
    <div style={tooltipStyle} className="p-3 min-w-[160px]">
      <p className="font-bold text-sm mb-2 text-foreground">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4 text-xs mb-1">
          <span style={{ color: p.fill }} className="font-medium">{p.dataKey}</span>
          <span className="font-bold text-foreground">{p.value ?? "—"}</span>
        </div>
      ))}
      {desvio !== null && (
        <div className="mt-2 pt-2 border-t border-white/10 flex justify-between text-xs">
          <span className="text-muted-foreground">Desvio</span>
          <span className={desvio >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
            {desvio >= 0 ? "+" : ""}{desvio}
          </span>
        </div>
      )}
      {pct !== null && (
        <div className="flex justify-between text-xs mt-1">
          <span className="text-muted-foreground">Meta atingida</span>
          <span style={{ color: cfg.label }} className="font-black">{pct}%</span>
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

      const perdasBrutas = filteredLoss
        .filter(r => r.motivo_perda !== "ganho" && r.item_perda && r.hora && (r.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(r.item_perda))
        .reduce((s, r) => s + (r.carros_perdidos || 0), 0);

      const ganhos = filteredLoss
        .filter(r => r.motivo_perda === "ganho" && r.item_perda && r.hora && (r.carros_perdidos || 0) > 0)
        .reduce((s, r) => s + (r.carros_perdidos || 0), 0);

      const liquida  = Math.max(0, producao - Math.max(0, perdasBrutas - ganhos));
      const atingido = meta > 0 ? Math.round((liquida / meta) * 100) : null;
      const abaixoDaMeta = meta > 0 && producao < meta;

      return {
        turno: label,
        Planejado: meta || null,
        Realizado: producao || null,
        Líquido: liquida || null,
        atingido,
        abaixoDaMeta,
        desvio: meta > 0 ? producao - meta : null,
      };
    });
  }, [prodData, lossData, date]);

  const hasData = chartData.some(d => (d.Planejado || 0) > 0 || (d.Realizado || 0) > 0);
  const alertCount = chartData.filter(d => d.abaixoDaMeta).length;

  return (
    <Card className="border-border overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            Planejado vs Realizado
            {date && (
              <span className="text-xs text-muted-foreground font-normal">
                — {date.slice(8)}/{date.slice(5, 7)}
              </span>
            )}
          </CardTitle>
          {alertCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {alertCount} turno{alertCount > 1 ? "s" : ""} abaixo da meta
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
              <Target className="w-6 h-6 opacity-40" />
            </div>
            <p className="text-sm">Sem dados de produção para hoje.</p>
            <p className="text-xs text-muted-foreground/60">Registre objetivos e produção no Controle de Produção</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={4} barCategoryGap="30%">
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="turno" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />

                {/* Barra Planejado — referência fixa */}
                <Bar dataKey="Planejado" fill="hsl(199,89%,48%)" radius={[5,5,0,0]} opacity={0.7}>
                  <LabelList dataKey="Planejado" position="top" style={{ fontSize: 10, fill: "hsl(199,89%,70%)", fontWeight: 700 }} formatter={v => v ?? ""} />
                </Bar>

                {/* Barra Realizado — muda de cor se abaixo da meta */}
                <Bar dataKey="Realizado" radius={[5,5,0,0]}>
                  {chartData.map((entry, i) => {
                    const color = entry.abaixoDaMeta ? "hsl(0,72%,51%)" : "hsl(217,91%,60%)";
                    return <Cell key={i} fill={color} />;
                  })}
                  <LabelList dataKey="Realizado" position="top" style={{ fontSize: 10, fontWeight: 700 }}
                    content={(props) => {
                      const { x, y, width, value, index } = props;
                      if (!value) return null;
                      const entry = chartData[index];
                      const fill = entry?.abaixoDaMeta ? "hsl(0,72%,70%)" : "hsl(217,91%,78%)";
                      return <text x={x + width / 2} y={y - 4} fill={fill} textAnchor="middle" fontSize={10} fontWeight={700}>{value}</text>;
                    }}
                  />
                </Bar>

                {/* Barra Líquido — verde ou laranja */}
                <Bar dataKey="Líquido" radius={[5,5,0,0]}>
                  {chartData.map((entry, i) => {
                    const pct = entry.atingido;
                    const color = pct === null ? "hsl(142,71%,45%)"
                      : pct >= 95 ? "hsl(142,71%,45%)"
                      : pct >= 75 ? "hsl(38,92%,50%)"
                      : "hsl(0,60%,45%)";
                    return <Cell key={i} fill={color} />;
                  })}
                  <LabelList dataKey="Líquido" position="top" style={{ fontSize: 10, fontWeight: 700 }} formatter={v => v ?? ""} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Cards de atingimento por turno */}
            <div className="grid grid-cols-3 gap-3 mt-2">
              {chartData.map(d => {
                const pct = d.atingido;
                const cfg = getDesvioConfig(pct);
                const hasDesvio = d.abaixoDaMeta && d.desvio !== null;

                return (
                  <div key={d.turno} className={`rounded-xl p-3 border transition-all ${cfg.badge}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-80">{d.turno}</p>

                    {/* Barra de progresso */}
                    <div className="h-2 rounded-full bg-black/20 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(pct ?? 0, 100)}%`, background: cfg.bar }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-lg font-black leading-none" style={{ color: cfg.bar }}>
                        {pct !== null ? `${pct}%` : "—"}
                      </p>
                      {cfg.icon === "ok"   && <TrendingUp className="w-4 h-4 text-green-400" />}
                      {cfg.icon === "warn" && <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />}
                      {cfg.icon === "crit" && <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
                    </div>

                    {hasDesvio && (
                      <p className="text-[9px] mt-1 font-semibold" style={{ color: cfg.label }}>
                        {d.desvio > 0 ? "+" : ""}{d.desvio} carros vs meta
                      </p>
                    )}
                    {pct !== null && !hasDesvio && d.desvio !== null && d.desvio >= 0 && (
                      <p className="text-[9px] mt-1 text-green-400/70 font-semibold">+{d.desvio} acima da meta</p>
                    )}
                    {pct === null && <p className="text-[9px] mt-1 opacity-60">sem dados</p>}
                  </div>
                );
              })}
            </div>

            {/* Legenda de cores */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 flex-wrap">
              <p className="text-[10px] text-muted-foreground font-medium mr-1">Realizado:</p>
              <span className="flex items-center gap-1.5 text-[10px]"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Abaixo da meta</span>
              <span className="flex items-center gap-1.5 text-[10px]"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />Acima / na meta</span>
              <span className="flex items-center gap-1.5 text-[10px] ml-auto"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Líquido ≥95%</span>
              <span className="flex items-center gap-1.5 text-[10px]"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />Líquido 75–94%</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}