import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart2 } from "lucide-react";

function safeNumber(v) { return Number(v || 0); }

function pickLatest(a, b) {
  if (!a) return b;
  const aId = String(a.id || "");
  const bId = String(b.id || "");
  if (aId.startsWith("temp-") && !bId.startsWith("temp-")) return b;
  const aTime = String(a.updated_date || a.created_date || a.id || "");
  const bTime = String(b.updated_date || b.created_date || b.id || "");
  return bTime > aTime ? b : a;
}

export default function ProductionVsObjectiveChart({ productionRecords, horas, turnoLabel }) {
  const chartData = useMemo(() => {
    // Monta cellMap por hora
    const cellMap = {};
    productionRecords.forEach((r) => {
      if (!r.testor_id || !r.hora) return;
      const key = `${r.testor_id}-${r.hora}`;
      cellMap[key] = pickLatest(cellMap[key], r);
    });

    // Agrega por hora
    const byHora = {};
    horas.forEach((hora) => { byHora[hora] = { producao: 0, objetivo: 0 }; });
    Object.values(cellMap).forEach((r) => {
      if (byHora[r.hora] === undefined) return;
      byHora[r.hora].producao += safeNumber(r.carros_produzidos);
      byHora[r.hora].objetivo += safeNumber(r.objetivo);
    });

    return horas.map((hora) => ({
      hora,
      Realizado: byHora[hora].producao,
      Planejado: byHora[hora].objetivo,
    }));
  }, [productionRecords, horas]);

  const hasData = chartData.some((d) => d.Realizado > 0 || d.Planejado > 0);

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            Planejado vs Realizado por Hora
          </h2>
          <p className="text-xs text-muted-foreground">{turnoLabel} — hora a hora</p>
        </div>

        {!hasData ? (
          <div className="flex items-center justify-center h-36 text-muted-foreground text-xs">
            Nenhum dado lançado neste turno ainda.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Planejado" fill="hsl(var(--chart-1))" opacity={0.5} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Realizado" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}