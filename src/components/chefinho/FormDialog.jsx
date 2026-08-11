import React, { useState } from "react";
import { X } from "lucide-react";

/** Modal reutilizável do Chefinho (estilo skeuomórfico). */
export default function FormDialog({ title, subtitle, open, onClose, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`panel w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/30">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-muted-foreground mb-1">{label}{required && <span className="text-destructive"> *</span>}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function BtnSave({ onClick, loading, label = "Salvar" }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
      {loading ? "Salvando..." : label}
    </button>
  );
}

export function BtnCancel({ onClick }) {
  return (
    <button onClick={onClick} className="px-4 py-2 rounded border border-border text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
  );
}

const BADGE = {
  good: "badge-success", active: "badge-success",
  approved: "badge-success", conforme: "badge-success", valid: "badge-success", resolved: "badge-success", completed: "badge-success", concluida: "badge-success",
  pending: "badge-warning", expiring_soon: "badge-warning", atencao: "badge-warning", degraded: "badge-warning", in_progress: "badge-warning", em_andamento: "badge-warning", planned:"badge-info", pendente: "badge-warning", critical: "badge-danger", high: "badge-danger", critica: "badge-danger", expired: "badge-danger", vencido: "badge-danger", damaged: "badge-danger", rejected: "badge-danger", missing: "badge-danger", open: "badge-danger", cancelled: "badge-neutral", inactive: "badge-neutral", missing2: "badge-danger",
  low: "badge-neutral", medium: "badge-neutral", baixa: "badge-neutral", media: "badge-neutral",
  default: "badge-neutral",
};

export function StatusBadge({ value }) {
  const cls = BADGE[value] || BADGE.default;
  const label = (value || "").replace(/_/g, " ");
  return <span className={`${cls} capitalize`}>{label || "—"}</span>;
}