import React from "react";
import { Card } from "@/components/ui/card";

export default function StatsCard({ title, value, subtitle, icon: Icon, variant = "default" }) {
  const variants = {
    default: "border-border",
    success: "border-green-500/30",
    warning: "border-yellow-500/30",
    danger: "border-red-500/30",
    info: "border-primary/30",
  };

  const iconBg = {
    default: "bg-muted text-muted-foreground",
    success: "bg-green-500/10 text-green-400",
    warning: "bg-yellow-500/10 text-yellow-400",
    danger: "bg-red-500/10 text-red-400",
    info: "bg-primary/10 text-primary",
  };

  return (
    <Card className={`p-4 ${variants[variant]} border`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${iconBg[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}