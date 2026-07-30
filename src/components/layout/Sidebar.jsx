import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Gauge, AlertTriangle, CheckSquare,
  ArrowRightLeft, Wrench, BarChart3, TrendingDown, Factory, X, PanelLeftClose, PanelLeftOpen
} from "lucide-react";

const navGroups = [
  {
    label: "Principal",
    items: [{ path: "/", icon: LayoutDashboard, label: "Painel" }],
  },
  {
    label: "Produção",
    items: [
      { path: "/controle-producao", icon: Factory, label: "Controle de Produção" },
      { path: "/controle-perdas", icon: TrendingDown, label: "Controle de Perdas" },
      { path: "/testores", icon: Gauge, label: "Testores" },
    ],
  },
  {
    label: "Operação",
    items: [
      { path: "/ocorrencias", icon: AlertTriangle, label: "Ocorrências" },
      { path: "/manutencao", icon: Wrench, label: "Manutenção" },
      { path: "/tarefas", icon: ClipboardList, label: "Tarefas" },
      { path: "/checklist", icon: CheckSquare, label: "Checklist" },
      { path: "/passagem-turno", icon: ArrowRightLeft, label: "Passagem de Turno" },
    ],
  },
  {
    label: "Análise",
    items: [{ path: "/relatorios", icon: BarChart3, label: "Relatórios" }],
  },
];

const allNavItems = navGroups.flatMap(g => g.items);

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/70 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-50 flex flex-col
        bg-sidebar border-r border-sidebar-border
        transition-all duration-200 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
        ${collapsed ? "lg:w-[52px]" : "lg:w-56"}
        w-56
      `}>

        {/* Logo */}
        <div className={`h-12 flex items-center shrink-0 border-b border-sidebar-border ${collapsed ? "justify-center px-0" : "px-4 gap-3"}`}>
          {!collapsed && (
            <>
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-[11px] tracking-tight">ZP7</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-sidebar-foreground leading-none">ZP7 Organização</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Volkswagen Taubaté</p>
              </div>
            </>
          )}
          {collapsed && (
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">Z7</span>
            </div>
          )}
          <button className="lg:hidden text-muted-foreground hover:text-sidebar-foreground ml-auto" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {collapsed ? (
            <div className="px-1.5 space-y-0.5">
              {allNavItems.map(item => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    title={item.label}
                    className={`flex items-center justify-center w-full h-8 rounded transition-colors ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-2 space-y-4">
              {navGroups.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-2 mb-1">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] font-medium transition-colors ${
                            active
                              ? "bg-primary/12 text-primary border-l-2 border-primary pl-[6px]"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent border-l-2 border-transparent pl-[6px]"
                          }`}
                        >
                          <item.icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-primary" : "opacity-60"}`} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Footer collapse */}
        <div className="hidden lg:block p-2 border-t border-sidebar-border shrink-0">
          <button
            onClick={onToggleCollapse}
            className={`flex items-center gap-2 text-muted-foreground hover:text-sidebar-foreground text-[12px] transition-colors rounded px-2 py-1.5 w-full hover:bg-sidebar-accent ${collapsed ? "justify-center" : ""}`}
          >
            {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <><PanelLeftClose className="w-3.5 h-3.5" /><span>Recolher</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}