import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShieldAlert, PenTool, Map, Wrench, Gauge,
  ClipboardCheck, AlertTriangle, Eye, ListChecks, Monitor, CheckSquare,
  Calendar, BarChart3, Bot, Bell, LogOut, ChevronLeft, ChevronRight,
  X, Menu, FileText, HardHat, User, Database, ArrowLeft,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/* ── Navigation structure — all under /chefinho/* ── */
const NAV = [
  {
    group: "Visão Geral",
    items: [
      { path: "/chefinho",               icon: LayoutDashboard, label: "Dashboard", end: true },
      { path: "/chefinho/centro-risco",   icon: ShieldAlert,     label: "Centro de Risco" },
      { path: "/chefinho/mapa",           icon: Map,             label: "Mapa Digital" },
      { path: "/chefinho/painel-fabrica", icon: Monitor,         label: "Painel Fábrica" },
    ],
  },
  {
    group: "Qualidade",
    items: [
      { path: "/chefinho/auditoria-rapida",  icon: PenTool,        label: "Auditoria Rápida" },
      { path: "/chefinho/auditorias",        icon: ClipboardCheck, label: "Auditorias" },
      { path: "/chefinho/nao-conformidades", icon: AlertTriangle,  label: "Não Conformidades" },
      { path: "/chefinho/planos-acoes",      icon: CheckSquare,    label: "Planos de Ação" },
      { path: "/chefinho/gestao-visual",     icon: Eye,            label: "Gestão Visual" },
      { path: "/chefinho/modelos",           icon: FileText,       label: "Modelos" },
    ],
  },
  {
    group: "Ativos & Manutenção",
    items: [
      { path: "/chefinho/equipamentos",   icon: Wrench,     label: "Equipamentos" },
      { path: "/chefinho/calibracao",     icon: Gauge,      label: "Calibração" },
      { path: "/chefinho/epis",           icon: HardHat,    label: "EPIs" },
      { path: "/chefinho/quadro-monitor", icon: ListChecks, label: "Monitor" },
    ],
  },
  {
    group: "Análise",
    items: [
      { path: "/chefinho/relatorios",  icon: BarChart3, label: "Relatórios" },
      { path: "/chefinho/calendario",  icon: Calendar,  label: "Calendário" },
      { path: "/chefinho/chefinho-ia", icon: Bot,       label: "Chefinho IA" },
    ],
  },
  {
    group: "Sistema",
    items: [
      { path: "/chefinho/admin-dados", icon: Database, label: "Dados" },
      { path: "/chefinho/perfil",      icon: User,     label: "Perfil" },
    ],
  },
];

const MOBILE_NAV = [
  { path: "/chefinho",                 icon: LayoutDashboard, label: "Início", end: true },
  { path: "/chefinho/centro-risco",    icon: ShieldAlert,     label: "Risco" },
  { path: "/chefinho/auditoria-rapida", icon: PenTool,         label: "Auditar" },
  { path: "/chefinho/mapa",            icon: Map,             label: "Mapa" },
  { path: "/chefinhos/equipamentos",   icon: Wrench,          label: "Equip." },
];

const ALL_ITEMS = NAV.flatMap(g => g.items);

function SideItem({ item, collapsed }) {
  const { pathname } = useLocation();
  const active = item.end ? pathname === item.path : pathname.startsWith(item.path);
  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={[
        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-[5px] text-[13px] transition-colors duration-100 select-none",
        collapsed ? "justify-center" : "",
        active
          ? "bg-[hsl(var(--primary))] text-white font-medium"
          : "text-[hsl(var(--muted-foreground))] hover:bg-muted hover:text-foreground",
      ].join(" ")}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2 : 1.75} />
      {!collapsed && <span className="truncate leading-none">{item.label}</span>}
    </Link>
  );
}

function SideGroup({ group, collapsed }) {
  return (
    <div>
      {!collapsed && (
        <p className="px-2.5 py-1 mt-4 mb-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          {group.group}
        </p>
      )}
      {collapsed && <div className="h-3" />}
      <div className="space-y-px">{group.items.map(i => <SideItem key={i.path} item={i} collapsed={collapsed} />)}</div>
    </div>
  );
}

export default function ChefLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: user } = useQuery({ queryKey: ["chef-me"], queryFn: () => base44.auth.me() });
  const { data: notifications = [] } = useQuery({
    queryKey: ["chef-notifications-unread"],
    queryFn: () => base44.entities.ChefNotification.filter({ read: false }),
    refetchInterval: 30000,
  });
  const unread = notifications.length;
  const pageLabel = ALL_ITEMS.find(i => (i.end ? pathname === i.path : pathname.startsWith(i.path) && i.path !== "/chefinho"))?.label ?? "Dashboard";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 relative transition-[width] duration-200 ease-in-out ${collapsed ? "w-[52px]" : "w-52"} bg-sidebar`}>
        <div className={`flex items-center h-12 px-3 flex-shrink-0 border-b border-sidebar-border ${collapsed ? "justify-center" : "gap-2.5"}`}>
          <div className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center bg-[hsl(214_100%_30%)]">
            <span className="text-white font-bold text-[10px] tracking-tight">VW</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sidebar-foreground font-semibold text-[13px] leading-none truncate">Chefinho</p>
              <p className="text-[10px] leading-none mt-0.5 text-sidebar-foreground/60">GLSI · Industrial</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 pb-2 space-y-0">
          {NAV.map(g => <SideGroup key={g.group} group={g} collapsed={collapsed} />)}
        </nav>

        <div className="flex-shrink-0 border-t border-sidebar-border px-1.5 py-2 space-y-px">
          <Link to="/" className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[5px] text-[13px] transition-colors duration-100 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground ${collapsed ? "justify-center" : ""}`}>
            <ArrowLeft className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
            {!collapsed && <span>Portal ZP7</span>}
          </Link>
          <Link to="/chefinho/notificacoes" className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[5px] text-[13px] transition-colors duration-100 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground ${collapsed ? "justify-center" : ""}`}>
            <div className="relative flex-shrink-0">
              <Bell className="w-4 h-4" strokeWidth={1.75} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-semibold leading-none">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            {!collapsed && <span>Notificações</span>}
          </Link>
          <button
            onClick={() => base44.auth.logout("/")}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[5px] text-[13px] w-full transition-colors duration-100 text-sidebar-foreground/50 hover:bg-red-500/10 hover:text-red-400 ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-2.5 top-14 w-5 h-5 rounded-full flex items-center justify-center border border-sidebar-border z-10 bg-sidebar text-sidebar-foreground/70"
        >
          {collapsed ? <ChevronRight className="w-2.5 h-2.5" /> : <ChevronLeft className="w-2.5 h-2.5" />}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden bg-black/45" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col lg:hidden bg-sidebar transform transition-transform duration-200 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between h-12 px-3 border-b border-sidebar-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[hsl(214_100%_30%)] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">VW</span>
            </div>
            <p className="text-sidebar-foreground font-semibold text-[13px]">Chefinho GLSI</p>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/70 hover:text-sidebar-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0" onClick={() => setMobileOpen(false)}>
          {NAV.map(g => <SideGroup key={g.group} group={g} collapsed={false} />)}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between h-12 px-3 sm:px-4 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground">
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-medium text-foreground truncate">{pageLabel}</span>
            <span className="hidden sm:inline text-[11px] text-muted-foreground capitalize">· {today}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/chefinho/notificacoes" className="relative p-1.5 text-muted-foreground hover:text-foreground rounded">
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500 text-white text-[7px] rounded-full flex items-center justify-center font-semibold">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link to="/chefinho/perfil" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold uppercase">
                {(user?.full_name || user?.email || "U").slice(0, 1)}
              </div>
              <span className="hidden sm:inline text-[12px] text-foreground font-medium max-w-[120px] truncate">{user?.full_name || user?.email}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}