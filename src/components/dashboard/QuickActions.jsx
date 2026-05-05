import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  PauseCircle,
  Wrench,
  ArrowRightLeft,
  Gauge,
  Brain,
  KeyRound,
  BarChart3
} from "lucide-react";

const actions = [
  { label: "Abrir Ocorrência", icon: AlertTriangle, path: "/ocorrencias", color: "bg-red-500/10 text-red-400 hover:bg-red-500/20" },
  { label: "Registrar Parada", icon: PauseCircle, path: "/testores", color: "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" },
  { label: "Solicitar Manutenção", icon: Wrench, path: "/manutencao", color: "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" },
  { label: "Passagem de Turno", icon: ArrowRightLeft, path: "/passagem-turno", color: "bg-primary/10 text-primary hover:bg-primary/20" },
  { label: "Ver Testores", icon: Gauge, path: "/testores", color: "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20" },
  { label: "IA Preditiva", icon: Brain, path: "/ia-preditiva", color: "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20" },
  { label: "Senha Diária", icon: KeyRound, path: "/senha-diaria", color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", color: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((action) => (
        <Link
          key={action.label}
          to={action.path}
          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all ${action.color} border border-transparent hover:border-border`}
        >
          <action.icon className="w-6 h-6" />
          <span className="text-xs font-medium text-center">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}