import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ShieldAlert, AlertTriangle, Gauge, Wrench, Cpu, TrendingDown } from "lucide-react";

export default function RiskCenter() {
  const { data: ncs = [] } = useQuery({ queryKey: ["chef-ncs-risk"], queryFn: () => base44.entities.ChefNonConformity.list() });
  const { data: assets = [] } = useQuery({ queryKey: ["chef-assets-risk"], queryFn: () => base44.entities.ChefAsset.list() });
  const { data: maint = [] } = useQuery({ queryKey: ["chef-maint-risk"], queryFn: () => base44.entities.ChefMaintenanceOrder.list() });
  const { data: calib = [] } = useQuery({ queryKey: ["chef-calib-risk"], queryFn: () => base44.entities.ChefCalibration.list() });

  const critNCs = ncs.filter(n => ["open","in_progress"].includes(n.status) && n.severity === "critical");
  const critAssets = assets.filter(a => a.status !== "active" || a.criticality === "critical");
  const openMaint = maint.filter(m => ["planned","in_progress"].includes(m.status));
  const expCalib = calib.filter(c => c.status === "expired");

  const cards = [
    { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "NCs críticas em aberto", value: critNCs.length, items: critNCs.slice(0,5).map(n=>({ title: n.title, sub: n.responsible_name||"—", danger: true })) },
    { icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10", label: "Ativos críticos/parados", value: critAssets.length, items: critAssets.slice(0,5).map(a=>({ title: a.name, sub: a.responsible||"—", danger: a.status!=="active" })) },
    { icon: Cpu, color: "text-orange-500", bg: "bg-orange-500/10", label: "Ordens de serviço abertas", value: openMaint.length, items: openMaint.slice(0,5).map(m=>({ title: m.title, sub: m.responsible||"—", danger: m.priority==="critical" })) },
    { icon: Gauge, color: "text-red-500", bg: "bg-red-500/10", label: "Calibrações vencidas", value: expCalib.length, items: expCalib.slice(0,5).map(c=>({ title: c.certificate_number||"—", sub: c.responsible_lab||"—", danger: true })) },
  ];

  const total = critNCs.length + critAssets.length + openMaint.length + expCalib.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-destructive" />Centro de Risco</h1>
          <p className="text-[13px] text-muted-foreground">Consolidação de itens críticos e vencidos</p></div>
        <div className={`panel px-4 py-2 flex items-center gap-2 ${total>0?"border-destructive/40":""}`}>
          <TrendingDown className={`w-4 h-4 ${total>0?"text-destructive":"text-emerald-500"}`} />
          <span className={`text-lg font-semibold tabular-nums ${total>0?"text-destructive":"text-emerald-500"}`}>{total} alertas</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="panel p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`w-4.5 h-4.5 ${c.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-2xl font-semibold tabular-nums ${c.color}`}>{c.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{c.label}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {c.items.length === 0 ? <p className="text-[12px] text-muted-foreground py-2">Nenhum alerta.</p> : c.items.map((it, j) => (
                <div key={j} className="flex items-center justify-between text-[12px] py-1 border-t border-border/60 first:border-0">
                  <span className={`truncate ${it.danger?"text-foreground font-medium":"text-muted-foreground"}`}>{it.title}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{it.sub}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}