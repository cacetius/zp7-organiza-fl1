import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Gauge, TrendingDown, Factory, BarChart3 } from "lucide-react";

const mobileNav = [
  { path: "/", icon: LayoutDashboard, label: "Painel" },
  { path: "/testores", icon: Gauge, label: "Testores" },
  { path: "/controle-producao", icon: Factory, label: "Produção" },
  { path: "/controle-perdas", icon: TrendingDown, label: "Perdas" },
  { path: "/relatorios", icon: BarChart3, label: "Relatórios" },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid grid-cols-5 h-13">
        {mobileNav.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">{item.label}</span>
              {active && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}