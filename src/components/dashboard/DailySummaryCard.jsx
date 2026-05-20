import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, TrendingDown, TrendingUp, Gauge } from "lucide-react";

function safeNumber(v) { return Number(v || 0); }

function pickLatest(a, b) {
  if (!a) return b;
  const aTime = String(a.updated_date || a.created_date || a.id || "");
  const bTime = String(b.updated_date || b.created_date || b.id || "");
  return bTime > aTime ? b : a;
}

export default function DailySummaryCard({ today, rawProductionRecords, rawLossRecords }) {
  const todayProduction = useMemo(() => {
    const cellMap = {};
    rawProductionRecords
      .filter((r) => r.data === today)
      .forEach((r) => {
        if (!r.testor_id || !r.hora || !r.turno) return;
        const key = `${r.testor_id}-${r.hora}-${r.turno}`;
        cellMap[key] = pickLatest(cellMap[key], r);
      });
    return Object.values(cellMap).reduce((sum, r) => sum + safeNumber(r.carros_produzidos), 0);
  }, [rawProductionRecords, today]);

  const todayObjective = useMemo(() => {
    const cellMap = {};
    rawProductionRecords
      .filter((r) => r.data === today)
      .forEach((r) => {
        if (!r.testor_id || !r.hora || !r.turno) return;
        const key = `${r.testor_id}-${r.hora}-${r.turno}`;
        cellMap[key] = pickLatest(cellMap[key], r);
      });
    return Object.values(cellMap).reduce((sum, r) => sum + safeNumber(r.objetivo), 0);
  }, [rawProductionRecords, today]);

  const todayLosses = useMemo(() => {
    const cellMap = {};
    rawLossRecords
      .filter((r) => r.data === today && r.motivo_perda !== "ganho")
      .forEach((r) => {
        if (!r.item_perda || !r.hora || !r.turno) return;
        const key = `${r.item_perda}-${r.hora}-${r.turno}`;
        cellMap[key] = pickLatest(cellMap[key], r);
      });
    return Object.values(cellMap).reduce((sum, r) => sum + safeNumber(r.carros_perdidos), 0);
  }, [rawLossRecords, today]);

  const todayGains = useMemo(() => {
    const cellMap = {};
    rawLossRecords
      .filter((r) => r.data === today && r.motivo_perda === "ganho")
      .forEach((r) => {
        if (!r.item_perda || !r.hora || !r.turno) return;
        const key = `${r.item_perda}-${r.hora}-${r.turno}`;
        cellMap[key] = pickLatest(cellMap[key], r);
      });
    return Object.values(cellMap).reduce((sum, r) => sum + safeNumber(r.carros_perdidos), 0);
  }, [rawLossRecords, today]);

  const efficiency = todayObjective > 0 ? Math.round((todayProduction / todayObjective) * 100) : null;
  const netLoss = Math.max(0, todayLosses - todayGains);
  const liquid = Math.max(0, todayProduction - netLoss);

  const effColor = efficiency === null ? "text-muted-foreground" : efficiency >= 90 ? "text-green-400" : efficiency >= 70 ? "text-yellow-400" : "text-red-400";

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Gauge className="w-4 h-4 text-blue-400" />
              Resumo do Dia
            </h2>
            <p className="text-xs text-muted-foreground">Todos os turnos · {today}</p>
          </div>
          {efficiency !== null && (
            <span className={`text-2xl font-black ${effColor}`}>{efficiency}%</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-center">
            <Factory className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-xl font-black text-blue-400">{todayProduction}</p>
            <p className="text-[10px] text-muted-foreground">Produção total</p>
          </div>
          <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2.5 text-center">
            <Gauge className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <p className="text-xl font-black text-cyan-400">{todayObjective || "—"}</p>
            <p className="text-[10px] text-muted-foreground">Objetivo total</p>
          </div>
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-center">
            <TrendingDown className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className="text-xl font-black text-red-400">{netLoss}</p>
            <p className="text-[10px] text-muted-foreground">Perdas acumuladas</p>
          </div>
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2.5 text-center">
            <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-black text-green-400">{liquid}</p>
            <p className="text-[10px] text-muted-foreground">Real líquido</p>
          </div>
        </div>

        {efficiency !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Eficiência do dia</span>
              <span>{efficiency}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${efficiency >= 90 ? "bg-green-500" : efficiency >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, efficiency)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}