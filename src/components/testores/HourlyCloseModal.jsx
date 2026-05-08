import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Timer, Car, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function HourlyCloseModal({ testor, open, onClose, onSave }) {
  const [form, setForm] = useState({ real: "", falhas: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const real = Number(form.real) || 0;
  const falhas = Number(form.falhas) || 0;
  const liquido = Math.max(0, real - falhas);

  const handleSave = () => {
    if (!testor) return;
    onSave({
      testor,
      carros_real: real,
      falhas,
      liquido,
      hora,
    });
    setForm({ real: "", falhas: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            Fechamento de Hora — {testor?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">Horário atual: <span className="font-bold text-foreground">{hora}</span></p>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Car className="w-3 h-3" /> Carros realmente produzidos</Label>
            <Input
              type="number" min="0" placeholder="Ex: 20"
              value={form.real}
              onChange={e => set("real", e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-orange-400" /> Carros com falha / reprovados</Label>
            <Input
              type="number" min="0" placeholder="Ex: 3"
              value={form.falhas}
              onChange={e => set("falhas", e.target.value)}
            />
          </div>

          {/* Resultado */}
          {real > 0 && (
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resultado do Fechamento</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-400">{real}</p>
                  <p className="text-[10px] text-muted-foreground">Produção Real</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-orange-400">{falhas}</p>
                  <p className="text-[10px] text-muted-foreground">Falhas</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-400">{liquido}</p>
                  <p className="text-[10px] text-muted-foreground">Líquido</p>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Fórmula: {real} − {falhas} = <span className="font-bold text-green-400">{liquido} carros líquidos</span>
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={!form.real}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}