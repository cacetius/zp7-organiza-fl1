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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="grid grid-cols-5 h-14">
        {mobileNav.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold transition-all ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-all ${active ? "bg-primary/15 scale-110" : ""}`}>
                <item.icon className={`w-[18px] h-[18px] ${active ? "text-primary" : ""}`} />
              </div>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}