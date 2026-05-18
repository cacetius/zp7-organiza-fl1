import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { BarChart3 } from "lucide-react";

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

// prodData: registros do ProductionControl — única fonte de verdade para produção e perdas
export default function ShiftProductionChart({ prodData, date }) {
  const chartData = useMemo(() => {
    return TURNOS.map(({ key, label }) => {
      const records = prodData.filter(r => r.turno === key && (!date || r.data === date));
      const prod = records.reduce((s, r) => s + (r.carros_produzidos || 0), 0);
      // Perdas = perdas_producao (operacional) + perdas_defeito (qualidade)
      const perdas = records.reduce((s, r) => s + (r.perdas_producao || 0) + (r.perdas_defeito || 0), 0);
      const liquida = Math.max(0, prod - perdas);
      const efic = prod > 0 ? Math.round((liquida / prod) * 100) : 0;

      return { turno: label, Produção: prod, Perdas: perdas, Líquida: liquida, efic };
    });
  }, [prodData, date]);

  const hasData = chartData.some(d => d.Produção > 0 || d.Perdas > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Produção & Perdas por Turno
          {date && <span className="text-xs text-muted-foreground font-normal ml-1">— {date.slice(8)}/{date.slice(5,7)}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-xs text-muted-foreground text-center py-10">Sem dados de produção para hoje.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4} barCategoryGap="30%">
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="turno" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val, name) => [val, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Produção" fill="hsl(217,91%,60%)" radius={[4,4,0,0]} />
                <Bar dataKey="Perdas"   fill="hsl(0,72%,51%)"   radius={[4,4,0,0]} />
                <Bar dataKey="Líquida"  fill="hsl(142,71%,45%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Eficiência por turno */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {chartData.map(d => (
                <div key={d.turno} className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1 truncate">{d.turno}</p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.efic}%`,
                        background: d.efic >= 80 ? "hsl(142,71%,45%)" : d.efic >= 60 ? "hsl(38,92%,50%)" : "hsl(0,72%,51%)"
                      }}
                    />
                  </div>
                  <p className={`text-xs font-black ${d.efic >= 80 ? "text-green-400" : d.efic >= 60 ? "text-yellow-400" : d.efic > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {d.Produção > 0 ? `${d.efic}%` : "—"}
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