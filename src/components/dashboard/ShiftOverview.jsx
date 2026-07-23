import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Wrench, TrendingDown, Car, Zap } from "lucide-react";
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
    (prodData || []).reduce((sum, p) => sum + (p.carros_produzidos || 0), 0),
    [prodData]
  );

  const shiftMaintenance = useMemo(() =>
    (maintenanceData || []).filter(m => m.status === "aberto").length,
    [maintenanceData]
  );

  const shiftLosses = useMemo(() => {
    const brutas = (lossData || [])
      .filter(l => l.motivo_perda !== "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(l.item_perda))
      .reduce((sum, l) => sum + (l.carros_perdidos || 0), 0);
    const ganhos = (lossData || [])
      .filter(l => l.motivo_perda === "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0)
      .reduce((sum, l) => sum + (l.carros_perdidos || 0), 0);
    return Math.max(0, brutas - ganhos);
  }, [lossData]);

  const liquida = Math.max(0, shiftProduction - shiftLosses);

  const metrics = [
    {
      label: "Produção",
      value: shiftProduction,
      sub: isHistorical ? "último dia" : "neste turno",
      icon: Car,
      color: "text-blue-400",
      iconBg: "bg-blue-500/15",
    },
    {
      label: "Prod. Líquida",
      value: liquida,
      sub: "após perdas",
      icon: Zap,
      color: "text-green-400",
      iconBg: "bg-green-500/15",
    },
    {
      label: "Manutenção",
      value: shiftMaintenance,
      sub: "abertas",
      icon: Wrench,
      color: shiftMaintenance > 0 ? "text-orange-400" : "text-muted-foreground",
      iconBg: shiftMaintenance > 0 ? "bg-orange-500/15" : "bg-muted/30",
    },
    {
      label: "Perdas Reais",
      value: shiftLosses,
      sub: isHistorical ? "último dia" : "neste turno",
      icon: TrendingDown,
      color: shiftLosses > 0 ? "text-red-400" : "text-muted-foreground",
      iconBg: shiftLosses > 0 ? "bg-red-500/15" : "bg-muted/30",
    },
  ];

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Faixa topo */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-blue-400 to-cyan-400" />
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-primary" />
          </div>
          {isHistorical ? "Último registro" : `Visão do ${currentShift.label}`}
        </h3>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
          isHistorical
            ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
            : "text-green-400 border-green-500/30 bg-green-500/10"
        } flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isHistorical ? "bg-yellow-400" : "bg-green-400 animate-pulse"}`} />
          {isHistorical ? "Histórico" : "Ao vivo"}
        </span>
      </div>

      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="bg-muted/20 rounded-xl p-3 border border-border/40 space-y-2">
              <div className={`w-8 h-8 rounded-lg ${m.iconBg} flex items-center justify-center`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-black leading-none ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground font-semibold mt-1 uppercase tracking-wide">{m.label}</p>
                <p className="text-[9px] text-muted-foreground/70">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}