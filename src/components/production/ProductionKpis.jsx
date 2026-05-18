import React from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Componente de KPIs do Controle de Produção
 * Mostra: Objetivo, Produção, Perdas Produção, Perdas Defeito, Real Líquido
 */
export function ProductionKpis({ totalObjetivo, totalGeral, totalPerdasProd, totalPerdasDef, producaoLiquida, efic }) {
  if (totalGeral === 0 && totalPerdasProd === 0 && totalPerdasDef === 0) return null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Objetivo", value: totalObjetivo || "—", color: "text-cyan-400", border: "border-cyan-500/20" },
          { label: "Produção", value: totalGeral, color: "text-blue-400", border: "border-blue-500/20" },
          { label: "Perdas Produção", value: totalPerdasProd, color: "text-orange-400", border: "border-orange-500/20" },
          { label: "Perdas Defeito", value: totalPerdasDef, color: "text-red-400", border: "border-red-500/20" },
          { label: "Real Líquido", value: producaoLiquida, color: "text-green-400", border: "border-green-500/20" },
        ].map(k => (
          <Card key={k.label} className={`border ${k.border}`}>
            <CardContent className="p-2.5 sm:p-3 text-center">
              <p className={`text-xl sm:text-2xl font-black ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Barra de eficiência */}
      {totalObjetivo > 0 && (
        <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border space-y-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-muted-foreground font-medium">Eficiência do turno (Produção / Objetivo)</span>
            <span className={`font-black ${efic >= 90 ? "text-green-400" : efic >= 70 ? "text-yellow-400" : "text-red-400"}`}>{efic}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(efic, 100)}%`, background: efic >= 90 ? "hsl(142,71%,45%)" : efic >= 70 ? "hsl(38,92%,50%)" : "hsl(0,72%,51%)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}