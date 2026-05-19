import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus } from "lucide-react";

// Botão de célula otimizado para toque/long-press
export const CellButton = React.memo(({ val, onPointerDown, onPointerUp, onPointerLeave, onDecrement, colorClass, activeColor }) => (
  <div className="flex flex-col items-center gap-0.5">
    <button
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className={`w-full h-10 rounded-md font-black text-base transition-all select-none
        ${val > 0 ? activeColor : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40 active:scale-95"}`}
    >
      {val > 0 ? val : <Plus className="w-3 h-3 mx-auto opacity-40" />}
    </button>
    {val > 0 && (
      <button onClick={onDecrement} className={`${colorClass} transition-colors p-0.5`}>
        <Minus className="w-3 h-3" />
      </button>
    )}
  </div>
));

CellButton.displayName = "CellButton";

// Card de KPI otimizado
export const KpiCard = React.memo(({ label, value, color, border, icon: Icon }) => (
  <Card className={`border ${border}`}>
    <CardContent className="p-3 sm:p-4 flex items-center gap-2.5">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
        {Icon && <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color.text}`} />}
      </div>
      <div className="min-w-0">
        <p className={`text-xl sm:text-2xl font-black ${color.text}`}>{value}</p>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </CardContent>
  </Card>
));

KpiCard.displayName = "KpiCard";

// Skeleton loader
export const SkeletonLoader = ({ count = 4, height = "h-12" }) => (
  <div className="space-y-2">
    {[...Array(count)].map((_, i) => (
      <div key={i} className={`${height} rounded-lg bg-muted/30 animate-pulse`} />
    ))}
  </div>
);

SkeletonLoader.displayName = "SkeletonLoader";