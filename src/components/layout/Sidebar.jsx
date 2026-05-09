import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Gauge,
  AlertTriangle,
  CheckSquare,
  ArrowRightLeft,
  Wrench,
  BarChart3,
  KeyRound,
  Brain,
  TrendingDown,
  Factory,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Painel" },
  { path: "/testores", icon: Gauge, label: "Testores" },
  { path: "/controle-producao", icon: Factory, label: "Produção" },
  { path: "/controle-perdas", icon: TrendingDown, label: "Perdas" },
  { path: "/ocorrencias", icon: AlertTriangle, label: "Ocorrências" },
  { path: "/manutencao", icon: Wrench, label: "Manutenção" },
  { path: "/tarefas", icon: ClipboardList, label: "Tarefas" },
  { path: "/checklist", icon: CheckSquare, label: "Checklist" },
  { path: "/passagem-turno", icon: ArrowRightLeft, label: "Passagem de Turno" },
  { path: "/relatorios", icon: BarChart3, label: "Relatórios" },
  { path: "/ia-preditiva", icon: Brain, label: "IA Preditiva" },
  { path: "/senha-diaria", icon: KeyRound, label: "Senha Diária" },
];

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-50 bg-sidebar border-r border-sidebar-border
        transition-all duration-300 ease-in-out flex flex-col
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}
        w-64
      `}>
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">ZP7</span>
              </div>
              <div>
                <h1 className="font-bold text-sm text-sidebar-foreground">ZP7 Organização</h1>
                <p className="text-[10px] text-muted-foreground">Volkswagen Taubaté</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <span className="text-primary-foreground font-bold text-sm">Z7</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="lg:hidden text-sidebar-foreground" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-sidebar-foreground"
            onClick={onToggleCollapse}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : (
              <span className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Recolher</span>
              </span>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}