import React, { useState, useEffect } from "react";
import { Minus, Plus, Check, X } from "lucide-react";

/**
 * StepperModal — overlay grande, otimizado para uso industrial com luvas.
 * Abre quando o usuário segura uma célula de produção por 400ms.
 */
export default function StepperModal({ testor, hora, initialValue, onConfirm, onClose }) {
  const [value, setValue] = useState(initialValue ?? 0);

  // Vibração tátil (onde suportado)
  function vibrate(pattern = [30]) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function increment() {
    setValue(v => v + 1);
    vibrate([20]);
  }

  function decrement() {
    setValue(v => Math.max(0, v - 1));
    vibrate([20]);
  }

  function confirm() {
    vibrate([30, 20, 30]);
    onConfirm(value);
  }

  // Fecha com Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:w-96 mx-0 sm:mx-4 pb-safe"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div>
            <p className="font-black text-base text-foreground">{testor}</p>
            <p className="text-sm text-muted-foreground">Hora: {hora}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contador central — grande para uso com luvas */}
        <div className="px-6 py-8 flex items-center justify-center gap-6">
          {/* Botão − */}
          <button
            onPointerDown={decrement}
            className="w-20 h-20 rounded-2xl bg-red-500/15 border-2 border-red-500/30 flex items-center justify-center text-red-400 active:scale-95 active:bg-red-500/30 transition-all touch-manipulation select-none"
          >
            <Minus className="w-10 h-10" strokeWidth={3} />
          </button>

          {/* Valor */}
          <div className="flex-1 text-center">
            <p className="text-7xl font-black text-foreground tabular-nums leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-2 uppercase tracking-widest">carros</p>
          </div>

          {/* Botão + */}
          <button
            onPointerDown={increment}
            className="w-20 h-20 rounded-2xl bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center text-blue-400 active:scale-95 active:bg-blue-500/30 transition-all touch-manipulation select-none"
          >
            <Plus className="w-10 h-10" strokeWidth={3} />
          </button>
        </div>

        {/* Botões de ação */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-14 rounded-xl border border-border text-muted-foreground font-bold text-base hover:bg-muted active:scale-95 transition-all touch-manipulation"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            className="flex-[2] h-14 rounded-xl bg-primary text-primary-foreground font-black text-base flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all touch-manipulation"
          >
            <Check className="w-5 h-5" strokeWidth={3} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}