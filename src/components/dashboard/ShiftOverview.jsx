import React, { useMemo } from "react";
import { Car, Zap, Wrench, TrendingDown } from "lucide-react";
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

  const shiftProduction = useMemo(() =>
    (prodData || []).reduce((sum, p) => sum + (p.carros_produzidos || 0), 0), [prodData]);

  const shiftMaintenance = useMemo(() =>
    (maintenanceData || []).filter(m => m.status === "aberto").length, [maintenanceData]);

  const shiftLosses = useMemo(() => {
    const brutas = (lossData || []).filter(l => l.motivo_perda !== "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(l.item_perda)).reduce((sum, l) => sum + (l.carros_perdidos || 0), 0);
    const ganhos = (lossData || []).filter(l => l.motivo_perda === "ganho" && (l.carros_perdidos || 0) > 0).reduce((sum, l) => sum + (l.carros_perdidos || 0), 0);
    return Math.max(0, brutas - ganhos);
  }, [lossData]);

  const liquida = Math.max(0, shiftProduction - shiftLosses);

  const metrics = [
    { label: "Produção", value: shiftProduction, icon: Car, color: "text-blue-400" },
    { label: "Prod. Líquida", value: liquida, icon: Zap, color: "text-green-500" },
    { label: "Manutenção", value: shiftMaintenance, icon: Wrench, color: shiftMaintenance > 0 ? "text-amber-500" : "text-muted-foreground" },
    { label: "Perdas Reais", value: shiftLosses, icon: TrendingDown, color: shiftLosses > 0 ? "text-red-500" : "text-muted-foreground" },
  ];

  return (
    <div className="page-section">
      <div className="page-section-header">
        <span className="page-section-title">
          {isHistorical ? "Último registro" : `Visão do ${currentShift.label}`}
        </span>
        <span className={`text-[11px] font-medium flex items-center gap-1.5 ${isHistorical ? "text-amber-500" : "text-green-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isHistorical ? "bg-amber-500" : "bg-green-500 animate-pulse"}`} />
          {isHistorical ? "Histórico" : "Ao vivo"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
        {metrics.map(m => (
          <div key={m.label} className="px-4 py-3">
            <p className="stat-label flex items-center gap-1.5 mb-1.5">
              <m.icon className="w-3.5 h-3.5" /> {m.label}
            </p>
            <p className={`text-2xl font-semibold tabular-nums tracking-tight ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}