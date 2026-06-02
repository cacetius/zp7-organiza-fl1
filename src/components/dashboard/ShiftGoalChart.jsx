import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from "recharts";
import { Target } from "lucide-react";

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
  border: "1px solid hsl(217,19%,18%)",
  borderRadius: "8px",
  color: "hsl(210,40%,96%)",
  fontSize: "12px",
};
const axisStyle = { fontSize: 11, fill: "hsl(215,16%,55%)" };
const gridStyle = { strokeDasharray: "3 3", stroke: "hsl(217,19%,18%)" };

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

      return { turno: label, Planejado: meta || null, Realizado: producao || null, Líquido: liquida || null, atingido };
    });
  }, [prodData, lossData, date]);

  const hasData = chartData.some(d => (d.Planejado || 0) > 0 || (d.Realizado || 0) > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-400" />
          Planejado vs Realizado por Turno
          {date && (
            <span className="text-xs text-muted-foreground font-normal ml-1">
              — {date.slice(8)}/{date.slice(5, 7)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-xs text-muted-foreground text-center py-10">
            Sem dados de produção para hoje.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barGap={3} barCategoryGap="28%">
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="turno" tick={axisStyle} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val, name) => [val ?? "—", name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Planejado" fill="hsl(199,89%,48%)" radius={[4,4,0,0]} opacity={0.85}>
                  <LabelList dataKey="Planejado" position="top" style={{ fontSize: 10, fill: "hsl(199,89%,65%)", fontWeight: 700 }} formatter={v => v ?? ""} />
                </Bar>
                <Bar dataKey="Realizado" fill="hsl(217,91%,60%)" radius={[4,4,0,0]}>
                  <LabelList dataKey="Realizado" position="top" style={{ fontSize: 10, fill: "hsl(217,91%,75%)", fontWeight: 700 }} formatter={v => v ?? ""} />
                </Bar>
                <Bar dataKey="Líquido"   fill="hsl(142,71%,45%)" radius={[4,4,0,0]}>
                  <LabelList dataKey="Líquido" position="top" style={{ fontSize: 10, fill: "hsl(142,71%,60%)", fontWeight: 700 }} formatter={v => v ?? ""} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* % atingido por turno */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {chartData.map(d => {
                const pct = d.atingido;
                const color = pct === null ? "text-muted-foreground"
                  : pct >= 95 ? "text-green-400"
                  : pct >= 75 ? "text-yellow-400"
                  : "text-red-400";
                const barColor = pct === null ? "hsl(217,19%,18%)"
                  : pct >= 95 ? "hsl(142,71%,45%)"
                  : pct >= 75 ? "hsl(38,92%,50%)"
                  : "hsl(0,72%,51%)";
                return (
                  <div key={d.turno} className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">{d.turno}</p>
                    <div className="h-2 rounded-full bg-muted overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(pct ?? 0, 100)}%`, background: barColor }}
                      />
                    </div>
                    <p className={`text-sm font-black ${color}`}>
                      {pct !== null ? `${pct}%` : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">da meta</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}