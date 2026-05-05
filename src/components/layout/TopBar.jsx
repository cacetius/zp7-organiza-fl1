import React from "react";
import { Menu, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const turnoLabels = {
  primeiro: "1º Turno",
  segundo: "2º Turno",
  terceiro: "3º Turno",
};

export default function TopBar({ onMenuClick, profile }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>
        <div>
          <p className="text-sm font-semibold text-foreground capitalize">{dateStr}</p>
          <p className="text-xs text-muted-foreground">{timeStr}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {profile?.turno && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            {turnoLabels[profile.turno] || profile.turno}
          </Badge>
        )}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <span className="hidden md:inline text-foreground font-medium text-xs">
            {profile?.nome || "Usuário"}
          </span>
        </div>
      </div>
    </header>
  );
}