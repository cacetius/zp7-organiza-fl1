import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Gauge, TrendingDown, Factory, AlertTriangle } from "lucide-react";

const mobileNav = [
  { path: "/", icon: LayoutDashboard, label: "Painel" },
  { path: "/testores", icon: Gauge, label: "Testores" },
  { path: "/controle-producao", icon: Factory, label: "Produção" },
  { path: "/controle-perdas", icon: TrendingDown, label: "Perdas" },
  { path: "/ocorrencias", icon: AlertTriangle, label: "Ocorrências" },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border safe-bottom">
      <div className="grid grid-cols-5 h-16">
        {mobileNav.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors ${active ? "bg-primary/15" : ""}`}>
                <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}