import React, { useState } from "react";
import { Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import ProfileModal from "./ProfileModal";

const turnoLabels = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };

const funcaoBadge = {
  administrador: "bg-red-500/10 text-red-400 border-red-500/20",
  lider:         "bg-blue-500/10 text-blue-400 border-blue-500/20",
  monitor:       "bg-amber-500/10 text-amber-500 border-amber-500/20",
  manutencao:    "bg-orange-500/10 text-orange-400 border-orange-500/20",
  funcionario:   "bg-secondary text-secondary-foreground border-border",
};

export default function TopBar({ onMenuClick, profile, onProfileSaved }) {
  const { theme, toggle } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <>
      <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 lg:px-5 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground p-1 -ml-1 rounded"
            onClick={onMenuClick}
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="capitalize font-medium text-foreground">{dateStr}</span>
            <span className="text-border">·</span>
            <span className="tabular-nums">{timeStr}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-primary font-semibold text-[10px]">
                {(profile?.nome || "?")[0]?.toUpperCase()}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[13px] font-medium text-foreground leading-none">{profile?.nome || "Usuário"}</span>
              {profile?.funcao && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${funcaoBadge[profile.funcao] || funcaoBadge.funcionario}`}>
                  {profile.funcao.charAt(0).toUpperCase() + profile.funcao.slice(1)}
                </span>
              )}
              {profile?.turno && (
                <span className="text-[10px] text-muted-foreground">{turnoLabels[profile.turno]}</span>
              )}
            </div>
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