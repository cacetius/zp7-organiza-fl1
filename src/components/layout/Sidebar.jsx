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
  TrendingDown,
  Factory,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    label: "Principal",
    items: [
      { path: "/", icon: LayoutDashboard, label: "Painel" },
    ],
  },
  {
    label: "Produção",
    items: [
      { path: "/controle-producao", icon: Factory, label: "Produção" },
      { path: "/controle-perdas", icon: TrendingDown, label: "Perdas" },
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
    items: [
      { path: "/relatorios", icon: BarChart3, label: "Relatórios" },
    ],
  },
];

// Lista plana para modo collapsed
const allNavItems = navGroups.flatMap(g => g.items);

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

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

        {/* Logo Header */}
        <div className={`border-b border-sidebar-border flex items-center justify-between shrink-0 ${collapsed ? "p-3" : "p-4"}`}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <span className="text-primary-foreground font-black text-sm tracking-tight">ZP7</span>
              </div>
              <div>
                <h1 className="font-black text-sm text-sidebar-foreground leading-tight">ZP7 Organização</h1>
                <p className="text-[10px] text-muted-foreground">Volkswagen Taubaté</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/30">
              <span className="text-primary-foreground font-black text-xs">Z7</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="lg:hidden text-sidebar-foreground shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {collapsed ? (
            // Modo collapsed: só ícones
            <div className="space-y-1">
              {allNavItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    title={item.label}
                    className={`
                      flex items-center justify-center w-full h-10 rounded-lg transition-all
                      ${active
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                  </Link>
                );
              })}
            </div>
          ) : (
            // Modo expandido: grupos com labels
            <div className="space-y-4">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-1.5">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={onClose}
                          className={`
                            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                            ${active
                              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                            }
                          `}
                        >
                          <item.icon className={`w-4 h-4 shrink-0 ${active ? "" : "opacity-70"}`} />
                          <span className="truncate">{item.label}</span>
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground/60" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex p-3 border-t border-sidebar-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-sidebar-foreground text-xs gap-2"
            onClick={onToggleCollapse}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <><ChevronLeft className="w-4 h-4" /><span>Recolher</span></>
            }
          </Button>
        </div>
      </aside>
    </>
  );
}