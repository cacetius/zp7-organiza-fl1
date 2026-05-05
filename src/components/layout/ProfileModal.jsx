import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Save, LogOut } from "lucide-react";

const funcaoLabels = { administrador: "Administrador", lider: "Líder", monitor: "Monitor", manutencao: "Manutenção", funcionario: "Funcionário" };
const turnoLabels  = { primeiro: "1º Turno (05h–13h)", segundo: "2º Turno (13h–21h)", terceiro: "3º Turno (21h–05h)" };

export default function ProfileModal({ open, onClose, profile, onSaved }) {
  const [form, setForm] = useState(profile ? { ...profile } : {});
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.UserProfile.update(profile.id, {
      nome: form.nome,
      matricula: form.matricula,
      funcao: form.funcao,
      turno: form.turno,
      area: form.area,
    });
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Meu Perfil
          </DialogTitle>
        </DialogHeader>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center ring-4 ring-primary/30">
            <span className="text-2xl font-black text-primary">{(form.nome || "?")[0]?.toUpperCase()}</span>
          </div>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            {funcaoLabels[form.funcao] || form.funcao}
          </Badge>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input required value={form.nome || ""} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Matrícula</Label>
            <Input required value={form.matricula || ""} onChange={e => setForm(f => ({ ...f, matricula: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Área</Label>
            <Input value={form.area || ""} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Ex: ZP7 - Linha A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Função</Label>
              <Select value={form.funcao} onValueChange={v => setForm(f => ({ ...f, funcao: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(funcaoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Turno</Label>
              <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primeiro">1º Turno</SelectItem>
                  <SelectItem value="segundo">2º Turno</SelectItem>
                  <SelectItem value="terceiro">3º Turno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />{saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>

        <div className="border-t border-border pt-3">
          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm"
            onClick={() => base44.auth.logout()}
          >
            <LogOut className="w-4 h-4 mr-2" /> Sair da conta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}