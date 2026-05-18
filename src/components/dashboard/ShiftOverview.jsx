import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Wrench, TrendingDown } from "lucide-react";
import { detectCurrentShift } from "@/lib/shiftDetector";

// prodData: registros do ProductionControl já filtrados pelo turno/data
// maintenanceData: registros do MaintenanceRequest já filtrados
export default function ShiftOverview({ prodData, maintenanceData, isHistorical }) {
  const currentShift = useMemo(() => detectCurrentShift(), []);

  const { shiftProduction, shiftLosses, shiftObjetivo, eficiencia, perdasProducao, perdasDefeito } = useMemo(() => {
    const records = prodData || [];
    
    // Agrupar por hora para evitar duplicação (múltiplos testores na mesma hora)
    const porHora = {};
    records.forEach(p => {
      if (!porHora[p.hora]) {
        porHora[p.hora] = { producao: 0, objetivo: 0, perdas_defeito: 0 };
      }
      porHora[p.hora].producao += (p.carros_produzidos || 0);
      porHora[p.hora].objetivo += (p.objetivo || 0);
      // IMPORTANTE: perdas_defeito JÁ É O TOTAL DA HORA (não acumula por testor)
      // Pega apenas o primeiro valor encontrado para esta hora
      if (porHora[p.hora].perdas_defeito === 0) {
        porHora[p.hora].perdas_defeito = (p.perdas_defeito || 0);
      }
    });
    
    // Calcular totais a partir do agrupamento por hora
    const producao = Object.values(porHora).reduce((s, h) => s + h.producao, 0);
    const objetivo = Object.values(porHora).reduce((s, h) => s + h.objetivo, 0);
    // Perdas de produção = objetivo - produção (calculado por hora, depois somado)
    const perdasProd = Object.values(porHora).reduce((s, h) => s + Math.max(0, h.objetivo - h.producao), 0);
    // Perdas por defeito = usa o valor já registrado (não acumula)
    const perdasDef = Object.values(porHora).reduce((s, h) => s + h.perdas_defeito, 0);
    // Total de perdas = perdas de produção + perdas por defeito
    const perdasTotais = perdasProd + perdasDef;
    const efic = objetivo > 0 ? Math.min(100, Math.round((producao / objetivo) * 100)) : null;
    return { shiftProduction: producao, shiftLosses: perdasTotais, shiftObjetivo: objetivo, eficiencia: efic, perdasProducao: perdasProd, perdasDefeito: perdasDef };
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
            <p className="text-[10px] text-muted-foreground">
              {perdasProducao > 0 && perdasDefeito > 0 ? `${perdasProducao} prod + ${perdasDefeito} def` : (isHistorical ? "no último dia" : "neste turno")}
            </p>
          </div>
        </div>

        {/* Eficiência do turno */}
        {eficiencia !== null && (
          <div className="mt-4 pt-4 border-t border-border space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Eficiência (Prod/Obj)</span>
              <span className={`font-black ${eficiencia >= 90 ? "text-green-400" : eficiencia >= 70 ? "text-yellow-400" : "text-red-400"}`}>{eficiencia}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${eficiencia}%`,
                  background: eficiencia >= 90 ? "hsl(142,71%,45%)" : eficiencia >= 70 ? "hsl(38,92%,50%)" : "hsl(0,72%,51%)"
                }}
              />
            </div>
          </div>
        )}
        {eficiencia === null && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 font-medium">{isHistorical ? "Encerrado" : "Em andamento"}</span>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}