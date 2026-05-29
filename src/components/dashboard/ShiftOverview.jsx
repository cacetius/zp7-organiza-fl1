import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, Wrench, TrendingDown } from "lucide-react";
import { detectCurrentShift } from "@/lib/shiftDetector";

const DEFAULT_LOSS_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

export default function ShiftOverview({ prodData, maintenanceData, lossData, isHistorical }) {
  const currentShift = useMemo(() => detectCurrentShift(), []);

  const shiftProduction = useMemo(() => {
    return (prodData || []).reduce((sum, p) => sum + (p.carros_produzidos || 0), 0);
  }, [prodData]);

  const shiftMaintenance = useMemo(() => {
    return (maintenanceData || []).filter(m => m.status === "aberto").length;
  }, [maintenanceData]);

  const shiftLosses = useMemo(() => {
    const brutas = (lossData || [])
      .filter(l => l.motivo_perda !== "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(l.item_perda))
      .reduce((sum, l) => sum + (l.carros_perdidos || 0), 0);
    const ganhos = (lossData || [])
      .filter(l => l.motivo_perda === "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0)
      .reduce((sum, l) => sum + (l.carros_perdidos || 0), 0);
    return Math.max(0, brutas - ganhos);
  }, [lossData]);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary animate-pulse" />
            {isHistorical ? "Último registro" : `Visão do ${currentShift.label}`}
          </h3>
          <Badge variant="outline" className={isHistorical ? "text-yellow-400 border-yellow-500/30" : "text-primary border-primary/30"}>
            {isHistorical ? "Histórico" : "Agora"}
          </Badge>
        </div>
      </div>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {/* Produção do turno */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Produção</p>
            <p className="text-2xl font-black text-blue-400">{shiftProduction}</p>
            <p className="text-[10px] text-muted-foreground">{isHistorical ? "carros no último dia" : "carros neste turno"}</p>
          </div>

          {/* Manutenção pendente */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Manutenção
            </p>
            <p className={`text-2xl font-black ${shiftMaintenance > 0 ? "text-orange-400" : "text-muted-foreground"}`}>
              {shiftMaintenance}
            </p>
            <p className="text-[10px] text-muted-foreground">abertos</p>
          </div>

          {/* Perdas do turno */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Perdas
            </p>
            <p className={`text-2xl font-black ${shiftLosses > 0 ? "text-red-400" : "text-muted-foreground"}`}>
              {shiftLosses}
            </p>
            <p className="text-[10px] text-muted-foreground">{isHistorical ? "reais no último dia" : "reais neste turno"}</p>
          </div>
        </div>

        {/* Status do turno */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 font-medium">Em andamento</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}