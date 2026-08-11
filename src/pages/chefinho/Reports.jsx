import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart3, ClipboardCheck, AlertTriangle, Gauge, Cpu } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export default function Reports() {
  const { data: audits = [] } = useQuery({ queryKey: ["chef-audits-r"], queryFn: () => base44.entities.ChefAudit.list() });
  const { data: ncs = [] } = useQuery({ queryKey: ["chef-ncs-r"], queryFn: () => base44.entities.ChefNonConformity.list() });
  const { data: calib = [] } = useQuery({ queryKey: ["chef-calib-r"], queryFn: () => base44.entities.ChefCalibration.list() });
  const { data: maint = [] } = useQuery({ queryKey: ["chef-maint-r"], queryFn: () => base44.entities.ChefMaintenanceOrder.list() });

  const statusAudit = useMemo(() => {
    const m = { planned: 0, in_progress: 0, completed: 0, cancelled: 0 };
    audits.forEach(a => { if (m[a.status] != null) m[a.status]++; });
    return [
      { name: "Planejadas", value: m.planned, fill: "hsl(var(--chart-1))" },
      { name: "Em andamento", value: m.in_progress, fill: "hsl(var(--chart-3))" },
      { name: "Concluídas", value: m.completed, fill: "hsl(var(--chart-2))" },
      { name: "Canceladas", value: m.cancelled, fill: "hsl(var(--chart-5))" },
    ];
  }, [audits]);

  const ncBySev = useMemo(() => {
    const m = { low: 0, medium: 0, high: 0, critical: 0 };
    ncs.forEach(n => { if (m[n.severity] != null) m[n.severity]++; });
    return [
      { name: "Baixa", value: m.low, fill: "hsl(var(--chart-5))" },
      { name: "Média", value: m.medium, fill: "hsl(var(--chart-3))" },
      { name: "Alta", value: m.high, fill: "hsl(var(--chart-4))" },
      { name: "Crítica", value: m.critical, fill: "#dc2626" },
    ].filter(d => d.value > 0);
  }, [ncs]);

  const calibPie = useMemo(() => {
    const m = { valid: 0, expired: 0, expiring_soon: 0 };
    calib.forEach(c => { if (m[c.status] != null) m[c.status]++; });
    return [
      { name: "Válidas", value: m.valid, color: "hsl(142 60% 40%)" },
      { name: "Vencidas", value: m.expired, color: "hsl(0 68% 50%)" },
      { name: "Vence em breve", value: m.expiring_soon, color: "hsl(38 88% 50%)" },
    ].filter(d => d.value > 0);
  }, [calib]);

  const maintType = useMemo(() => {
    const m = { preventive: 0, corrective: 0, predictive: 0, improvement: 0 };
    maint.forEach(x => { if (m[x.type] != null) m[x.type]++; });
    return [
      { name: "Preventiva", value: m.preventive },
      { name: "Corretiva", value: m.corrective },
      { name: "Preditiva", value: m.predictive },
      { name: "Melhoria", value: m.improvement },
    ];
  }, [maint]);

  const Tooltip_ = ({ active, payload, label }) => active && payload?.length ? (
    <div className="bg-card border border-border rounded px-2.5 py-1.5 text-xs shadow-lg">
      {label && <p className="text-muted-foreground mb-0.5">{label}</p>}
      <p className="font-medium">{payload[0].value}</p>
    </div>
  ) : null;

  const kpis = [
    { icon: ClipboardCheck, color: "text-blue-500", label: "Auditorias", value: audits.length },
    { icon: AlertTriangle, color: "text-red-500", label: "NCs", value: ncs.length },
    { icon: Gauge, color: "text-orange-500", label: "Calibrações", value: calib.length },
    { icon: Cpu, color: "text-amber-500", label: "OS Manutenção", value: maint.length },
  ];

  return (
    <div className="space-y-4">
      <div><h1 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Relatórios</h1>
        <p className="text-[13px] text-muted-foreground">Indicadores consolidados de qualidade e manutenção</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="panel p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><k.icon className={`w-5 h-5 ${k.color}`} /></div>
            <div><p className="text-2xl font-semibold tabular-nums">{k.value}</p><p className="text-[11px] text-muted-foreground">{k.label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="panel p-4">
          <p className="label-section mb-3">Auditorias por Status</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={statusAudit} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tooltip_ />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <p className="label-section mb-3">NCs por Severidade</p>
          <div className="h-64">
            {ncBySev.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados.</div> :
            <ResponsiveContainer>
              <BarChart data={ncBySev} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tooltip_ />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>}
          </div>
        </div>

        <div className="panel p-4">
          <p className="label-section mb-3">Status de Calibrações</p>
          <div className="h-64">
            {calibPie.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados.</div> :
            <ResponsiveContainer>
              <PieChart>
                <Pie data={calibPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {calibPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<Tooltip_ />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>}
          </div>
        </div>

        <div className="panel p-4">
          <p className="label-section mb-3">Ordens de Serviço por Tipo</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={maintType} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tooltip_ />} />
                <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}