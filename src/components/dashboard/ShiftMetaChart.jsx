import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { Target } from "lucide-react";

const tooltipStyle = {
  background: "hsl(217,25%,11%)",
  border: "1px solid hsl(217,19%,18%)",
  borderRadius: "8px",
  color: "hsl(210,40%,96%)",
  fontSize: "12px",
};
const axisStyle = { fontSize: 11, fill: "hsl(215,16%,55%)" };
const gridStyle = { strokeDasharray: "3 3", stroke: "hsl(217,19%,18%)" };

const TURNOS = [
  { key: "primeiro", label: "1º Turno" },
  { key: "segundo",  label: "2º Turno" },
  { key: "terceiro", label: "3º Turno" },
];

/**
 * Gráfico comparativo: Meta Planejada vs Produção Líquida Real por turno
 * Meta = soma de objetivos do ProductionControl
 * Líquida = produção - perdas (LossControl, excluindo ganhos)
 */
export default function ShiftMetaChart({ prodData, lossData, date }) {
  const chartData = useMemo(() => {
    return TURNOS.map(({ key, label }) => {
      const filteredProd = prodData.filter(r => r.turno === key && (!date || r.data === date));
      const filteredLoss = lossData.filter(r => r.turno === key && (!date || r.data === date));

      const meta     = filteredProd.reduce((s, r) => s + (r.objetivo || 0), 0);
      const producao = filteredProd.reduce((s, r) => s + (r.carros_produzidos || 0), 0);
      const perdas   = filteredLoss
        .filter(r => r.motivo_perda !== "ganho")
        .reduce((s, r) => s + (r.carros_perdidos || 0), 0);
      const ganhos   = filteredLoss
        .filter(r => r.motivo_perda === "ganho")
        .reduce((s, r) => s + (r.carros_perdidos || 0), 0);
      const liquida  = Math.max(0, producao - perdas + ganhos);
      const atingido = meta > 0 ? Math.round((liquida / meta) * 100) : null;

      return { turno: label, Meta: meta, Líquida: liquida, atingido };
    });
  }, [prodData, lossData, date]);

  const hasData = chartData.some(d => d.Meta > 0 || d.Líquida > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-400" />
          Meta vs Produção Líquida por Turno
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
            Sem dados de meta/produção para este dia.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={6} barCategoryGap="35%">
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="turno" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val, name) => [val === 0 ? "—" : val, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Meta"    fill="hsl(199,89%,48%)" radius={[4,4,0,0]} opacity={0.8} />
                <Bar dataKey="Líquida" fill="hsl(142,71%,45%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* % atingido por turno */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {chartData.map(d => (
                <div key={d.turno} className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1 truncate">{d.turno}</p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(d.atingido ?? 0, 100)}%`,
                        background:
                          (d.atingido ?? 0) >= 95 ? "hsl(142,71%,45%)"
                          : (d.atingido ?? 0) >= 75 ? "hsl(38,92%,50%)"
                          : "hsl(0,72%,51%)"
                      }}
                    />
                  </div>
                  <p className={`text-xs font-black ${
                    d.atingido === null
                      ? "text-muted-foreground"
                      : d.atingido >= 95 ? "text-green-400"
                      : d.atingido >= 75 ? "text-yellow-400"
                      : "text-red-400"
                  }`}>
                    {d.atingido !== null ? `${d.atingido}%` : "—"}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}