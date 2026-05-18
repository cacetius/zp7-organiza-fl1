import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Wrench, TrendingDown } from "lucide-react";
import { detectCurrentShift } from "@/lib/shiftDetector";

// prodData: registros do ProductionControl já filtrados pelo turno/data
// maintenanceData: registros do MaintenanceRequest já filtrados
export default function ShiftOverview({ prodData, maintenanceData, isHistorical }) {
  const currentShift = useMemo(() => detectCurrentShift(), []);

  const { shiftProduction, shiftLosses } = useMemo(() => {
    const records = prodData || [];
    const producao = records.reduce((sum, p) => sum + (p.carros_produzidos || 0), 0);
    const objetivo = records.reduce((sum, p) => sum + (p.objetivo || 0), 0);
    // Perdas de produção = objetivo - produção (quando objetivo definido), + perdas por defeito
    const perdasProd = objetivo > 0 ? Math.max(0, objetivo - producao) : 0;
    const perdasDef = records.reduce((sum, p) => sum + (p.perdas_defeito || 0), 0);
    return { shiftProduction: producao, shiftLosses: perdasProd + perdasDef };
  }, [prodData]);

  const shiftMaintenance = useMemo(() => {
    return (maintenanceData || []).filter(m => m.status === "aberto").length;
  }, [maintenanceData]);

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
            <p className="text-[10px] text-muted-foreground">{isHistorical ? "no último dia" : "neste turno"}</p>
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