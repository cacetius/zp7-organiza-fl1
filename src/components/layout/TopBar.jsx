import React, { useState } from "react";
import { Menu, Sun, Moon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/ThemeContext";
import ProfileModal from "./ProfileModal";

const turnoLabels = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };
const funcaoColors = {
  administrador: "border-red-500/40 text-red-400",
  lider:         "border-blue-500/40 text-blue-400",
  monitor:       "border-yellow-500/40 text-yellow-400",
  manutencao:    "border-orange-500/40 text-orange-400",
  funcionario:   "border-primary/30 text-primary",
};

export default function TopBar({ onMenuClick, profile, onProfileSaved }) {
  const { theme, toggle } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-foreground capitalize leading-tight">{dateStr}</p>
            <p className="text-xs text-muted-foreground">{timeStr}</p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="text-muted-foreground hover:text-foreground"
            title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* Turno badge */}
          {profile?.turno && (
            <Badge variant="outline" className="text-xs border-primary/30 text-primary hidden sm:inline-flex">
              {turnoLabels[profile.turno]}
            </Badge>
          )}

          {/* Profile button */}
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
              <span className="text-primary font-bold text-xs">
                {(profile?.nome || "?")[0]?.toUpperCase()}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-foreground leading-tight">{profile?.nome || "Usuário"}</p>
              {profile?.funcao && (
                <p className={`text-[10px] font-medium ${funcaoColors[profile.funcao] || "text-muted-foreground"}`}>
                  {profile.funcao.charAt(0).toUpperCase() + profile.funcao.slice(1)}
                </p>
              )}
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground hidden md:block" />
          </button>
        </div>
      </header>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        onSaved={onProfileSaved}
      />
    </>
  );
}