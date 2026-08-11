import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  ClipboardCheck, AlertTriangle, Gauge, TrendingUp, TrendingDown,
  CheckCircle, ChevronRight, ArrowRight, PenTool, Cpu, Wrench,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const TREND_DATA = [
  { m: "Jan", v: 82 }, { m: "Fev", v: 78 }, { m: "Mar", v: 85 },
  { m: "Abr", v: 88 }, { m: "Mai", v: 91 }, { m: "Jun", v: 87 }, { m: "Jul", v: 93 },
];
const NC_AREAS = [
  { area: "Mont.", a: 12, r: 45 }, { area: "Pintura", a: 5, r: 28 },
  { area: "Qual.", a: 8, r: 36 }, { area: "Log.", a: 3, r: 19 }, { area: "Solda", a: 7, r: 31 },
];
const ACTIVITIES = [
  { type: "audit", text: "Auditoria 5S concluída — Área de Montagem", rel: "2h" },
  { type: "nc",    text: "Nova NC aberta — Parafusadeira T-03 fora de prazo", rel: "4h" },
  { type: "plan",  text: "Plano de ação #PA-089 marcado como concluído", rel: "6h" },
  { type: "maint", text: "OS preventiva aberta — Esteira L7", rel: "1d" },
  { type: "audit", text: "Auditoria LPA aprovada — Tacto 14 · 94%", rel: "1d" },
  { type: "calib", text: "Calibração vencendo — Torquímetro AT-22", rel: "2d" },
];
const ACTIVITY_META = {
  audit: { icon: ClipboardCheck, cls: "text-blue-600 dark:text-blue-400", dot: "bg-blue-600" },
  nc:    { icon: AlertTriangle,  cls: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  plan:  { icon: CheckCircle,    cls: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  maint: { icon: Cpu,            cls: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  calib: { icon: Gauge,          cls: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
};

const Tooltip_ = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded px-2.5 py-1.5 text-xs shadow-lg">
      {label && <p className="text-muted-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-medium">{p.name || p.dataKey}: {p.value}</p>
      ))}
    </div>
  );
};

function StatCell({ label, value, delta, deltaDir, to, accent }) {
  const valueColor = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-red-600 dark:text-red-400",
    warn: "text-amber-600 dark:text-amber-400",
  }[accent || "default"];
  const inner = (
    <div className="group">
      <p className="text-3xl font-semibold tabular-nums leading-none tracking-tight">
        <span className={valueColor}>{value}</span>
      </p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-none">{label}</p>
      {delta !== undefined && (
        <p className={`text-[10px] mt-1.5 font-medium flex items-center gap-0.5 ${deltaDir === "up" ? "text-emerald-600" : "text-red-500"}`}>
          {deltaDir === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{delta}
        </p>
      )}
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-80 transition-opacity">{inner}</Link> : inner;
}

function AlertItem({ icon: Icon, label, count, accent, to }) {
  const styles = {
    danger: "text-red-600 dark:text-red-400",
    warn: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400",
  };
  return (
    <Link to={to || "#"} className="flex items-center gap-3 py-2 group hover:bg-muted/40 -mx-1 px-1 rounded transition-colors">
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${styles[accent]}`} strokeWidth={2} />
      <span className="flex-1 text-[13px] text-foreground truncate group-hover:text-primary transition-colors">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${styles[accent]}`}>{count}</span>
      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function SectionLabel({ children, action, to }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</p>
      {action && to && (
        <Link to={to} className="text-[11px] text-primary hover:underline flex items-center gap-0.5">{action} <ArrowRight className="w-3 h-3" /></Link>
      )}
    </div>
  );
}

function ScoreGauge({ value }) {
  const r = 44, cx = 56, cy = 56;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const fill = arc * (value / 100);
  const color = value >= 90 ? "#16a34a" : value >= 75 ? "#d97706" : "#dc2626";
  return (
    <svg width={112} height={80} viewBox="0 0 112 80" className="overflow-visible">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8"
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={`${circ * 0.125}`} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${fill} ${circ}`} strokeDashoffset={`${circ * 0.125}`} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="600" style={{ fill: "hsl(var(--foreground))" }}>{value}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fontWeight="500" style={{ fill: "hsl(var(--muted-foreground))", letterSpacing: "0.04em" }}>CONFORM.</text>
    </svg>
  );
}

export default function Dashboard() {
  const [raw, setRaw] = useState({ audits: [], ncs: [], plans: [], assets: [], maint: [], calib: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ChefAudit.list("-created_date", 100),
      base44.entities.ChefNonConformity.list("-created_date", 100),
      base44.entities.ChefActionPlan.list("-created_date", 100),
      base44.entities.ChefAsset.list("-created_date", 200),
      base44.entities.ChefMaintenanceOrder.list("-created_date", 100),
      base44.entities.ChefCalibration.list("-created_date", 100),
    ]).then(([audits, ncs, plans, assets, maint, calib]) => {
      setRaw({ audits, ncs, plans, assets, maint, calib });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const kpi = useMemo(() => {
    const { audits, ncs, plans, assets, maint, calib } = raw;
    const done = audits.filter(a => a.status === "completed").length;
    const appro = audits.filter(a => a.result === "approved").length;
    return {
      totalAudits: audits.length,
      completedAudit: done,
      approvedAudit: appro,
      conformity: done > 0 ? Math.round((appro / done) * 100) : 0,
      openNCs: ncs.filter(n => ["open", "in_progress"].includes(n.status)).length,
      critNCs: ncs.filter(n => n.severity === "critical").length,
      pendingPlans: plans.filter(p => ["pending", "in_progress"].includes(p.status)).length,
      critAssets: assets.filter(a => a.criticality === "critical").length,
      pendingMaint: maint.filter(m => ["planned", "in_progress"].includes(m.status)).length,
      expiredCalib: calib.filter(c => c.status === "expired").length,
      plannedAudits: audits.filter(a => a.status === "planned").length,
    };
  }, [raw]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-[13px] text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Visão executiva · {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Link to="/chefinho/auditoria-rapida"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity">
          <PenTool className="w-3.5 h-3.5" /><span className="hidden sm:inline">Nova Auditoria</span>
        </Link>
      </div>

      {/* Score + stats strip */}
      <div className="panel overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="flex items-center gap-4 px-5 py-4 sm:border-r border-border sm:pr-6 flex-shrink-0">
            <ScoreGauge value={kpi.conformity} />
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Índice de Conformidade</p>
              <p className="text-[13px] text-foreground mt-1">
                {kpi.completedAudit > 0 ? `${kpi.approvedAudit} de ${kpi.completedAudit} auditorias aprovadas` : "Sem auditorias concluídas"}
              </p>
              <Link to="/chefinho/auditorias" className="text-[11px] text-primary hover:underline flex items-center gap-0.5 mt-2">
                Ver auditorias <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 flex-1">
            <div className="p-4 border-t sm:border-t-0 border-border"><StatCell label="Auditorias" value={kpi.totalAudits} to="/chefinho/auditorias" /></div>
            <div className="p-4 border-t sm:border-t-0 sm:border-l border-border"><StatCell label="Planejadas" value={kpi.plannedAudits} to="/chefinho/auditorias" /></div>
            <div className="p-4 border-t sm:border-t-0 sm:border-l border-border"><StatCell label="NCs abertas" value={kpi.openNCs} accent={kpi.openNCs > 0 ? "danger" : "default"} to="/chefinho/nao-conformidades" /></div>
            <div className="p-4 border-t sm:border-t-0 sm:border-l border-border"><StatCell label="Planos pend." value={kpi.pendingPlans} accent={kpi.pendingPlans > 0 ? "warn" : "default"} to="/chefinho/nao-conformidades" /></div>
            <div className="p-4 border-t sm:border-t-0 sm:border-l border-border"><StatCell label="OS manutenção" value={kpi.pendingMaint} accent={kpi.pendingMaint > 0 ? "warn" : "default"} to="/chefinho/equipamentos" /></div>
            <div className="p-4 border-t sm:border-t-0 sm:border-l border-border"><StatCell label="Calib. vencidas" value={kpi.expiredCalib} accent={kpi.expiredCalib > 0 ? "danger" : "default"} to="/chefinho/calibracao" /></div>
          </div>
        </div>
      </div>

      {/* Charts + activity */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <div className="lg:col-span-2 panel p-4">
          <SectionLabel action="Ver relatórios" to="/chefinho/relatorios">Tendência de Conformidade</SectionLabel>
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={TREND_DATA} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gConf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[60, 100]} />
                <Tooltip content={<Tooltip_ />} />
                <Area type="monotone" dataKey="v" name="Conformidade" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#gConf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <SectionLabel action="Ver tudo" to="/chefinho/nao-conformidades">Atividades recentes</SectionLabel>
          <div className="space-y-3">
            {ACTIVITIES.map((a, i) => {
              const meta = ACTIVITY_META[a.type];
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${meta.cls} bg-muted/60`}>
                    <meta.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-foreground leading-snug">{a.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{a.rel} atrás</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* NC by area bar + alerts */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <div className="lg:col-span-2 panel p-4">
          <SectionLabel>Não Conformidades por Área</SectionLabel>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={NC_AREAS} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="area" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tooltip_ />} />
                <Bar dataKey="a" name="Abertas" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="r" name="Resolvidas" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <SectionLabel>Alertas</SectionLabel>
          <div>
            <AlertItem icon={AlertTriangle} label="NCs críticas" count={kpi.critNCs} accent="danger" to="/chefinho/nao-conformidades" />
            <AlertItem icon={Gauge} label="Calibrações vencidas" count={kpi.expiredCalib} accent="danger" to="/chefinho/calibracao" />
            <AlertItem icon={Wrench} label="Ativos críticos" count={kpi.critAssets} accent="warn" to="/chefinho/equipamentos" />
            <AlertItem icon={Cpu} label="OS em aberto" count={kpi.pendingMaint} accent="warn" to="/chefinho/equipamentos" />
          </div>
        </div>
      </div>
    </div>
  );
}