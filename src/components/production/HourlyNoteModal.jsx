import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Modal de justificativa geral para um horário específico.
 * Props:
 *   hora, data, turno, modulo ("producao"|"perdas")
 *   onClose()
 */
export default function HourlyNoteModal({ hora, data, turno, modulo, onClose }) {
  const qc = useQueryClient();
  const qKey = `hourly-note-${modulo}-${data}-${turno}-${hora}`;

  const { data: notes = [] } = useQuery({
    queryKey: [qKey],
    queryFn: () => base44.entities.HourlyNote.filter({ data, turno, hora, modulo }),
    staleTime: 0,
  });

  const existing = notes[0] || null;

  const [texto, setTexto] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (existing) {
      setTexto(existing.justificativa || "");
      setFotoUrl(existing.foto_url || "");
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { data, turno, hora, modulo, justificativa: texto, foto_url: fotoUrl };
      if (existing?.id) {
        return base44.entities.HourlyNote.update(existing.id, payload);
      }
      return base44.entities.HourlyNote.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [qKey] });
      qc.invalidateQueries({ queryKey: [`hourly-notes-${modulo}-${data}-${turno}`] });
      onClose();
    },
  });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFotoUrl(file_url);
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-5 shadow-2xl w-80 mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold mb-0.5 text-foreground">📝 Justificativa Geral</p>
        <p className="text-xs text-muted-foreground mb-3">Horário {hora} · {modulo === "producao" ? "Produção" : "Perdas"}</p>

        <textarea
          autoFocus rows={3}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") onClose(); }}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-3 resize-none"
          placeholder="Descreva o que aconteceu neste horário..."
        />

        {/* Upload foto */}
        <p className="text-xs text-muted-foreground mb-1.5">📷 Foto (opcional)</p>
        {fotoUrl ? (
          <div className="relative mb-3">
            <img src={fotoUrl} alt="Foto" className="w-full max-h-36 object-cover rounded-md border border-border" />
            <button
              onClick={() => setFotoUrl("")}
              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
            >×</button>
          </div>
        ) : (
          <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-md border border-dashed border-border text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors mb-3 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? "Enviando…" : "📁 Escolher imagem (câmera ou arquivo)"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}