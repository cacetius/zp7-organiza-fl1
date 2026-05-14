import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Gauge, CheckCircle2, AlertTriangle, Wrench, ZapOff, ShieldAlert } from "lucide-react";
import TestorCard from "@/components/testores/TestorCard";
import HourlyCloseModal from "@/components/testores/HourlyCloseModal";
import TestorProductionPanel from "@/components/testores/TestorProductionPanel";
import TestorWeeklyHistory from "@/components/testores/TestorWeeklyHistory";

const statusConfig = {
  rodando:    { label: "Rodando",    color: "bg-green-500/15 text-green-400 border-green-500/40",   dot: "bg-green-400",  icon: CheckCircle2 },
  atencao:    { label: "Atenção",    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40", dot: "bg-yellow-400", icon: AlertTriangle },
  parado:     { label: "Parado",     color: "bg-red-500/15 text-red-400 border-red-500/40",          dot: "bg-red-400",    icon: ZapOff },
  manutencao: { label: "Manutenção", color: "bg-orange-500/15 text-orange-400 border-orange-500/40", dot: "bg-orange-400", icon: Wrench },
  bloqueado:  { label: "Bloqueado",  color: "bg-gray-500/15 text-gray-400 border-gray-500/40",       dot: "bg-gray-400",   icon: ShieldAlert },
};

const emptyForm = {
  nome: "", status: "rodando",
  tempo_medio_carro: "", carros_testados_turno: "", carros_por_hora: "",
  falhas_turno: "", reprovacoes: "", paradas_curtas: "", tempo_total_parado: "",
  ultima_manutencao: "", proxima_manutencao: "", risco_score: "",
};

async function notifyTeam(testor, oldStatus, newStatus) {
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const from = statusConfig[oldStatus]?.label || oldStatus;
  const to = statusConfig[newStatus]?.label || newStatus;
  const isAlert = ["parado", "manutencao"].includes(newStatus);

  const profiles = await base44.entities.UserProfile.filter({});
  const recipients = profiles.filter(p => ["lider", "monitor", "manutencao"].includes(p.funcao) && p.user_email);

  const subject = isAlert
    ? `🚨 [ZP7] ALERTA — ${testor} ${statusConfig[newStatus]?.label}`
    : `[ZP7] Alteração de status — ${testor}`;

  for (const r of recipients) {
    const body = isAlert
      ? `⚠️ ALERTA DE PARADA DE MÁQUINA\n\nTestor: ${testor}\nStatus: ${to}\nHorário: ${hora}\n\nAção necessária: verifique o equipamento imediatamente.\n\n— ZP7 Organização`
      : `Olá ${r.nome || ""},\n\nO testor ${testor} teve seu status alterado:\n\n${from} → ${to}\n\nAcesse o sistema ZP7.\n\n— ZP7 Organização`;
    base44.integrations.Core.SendEmail({ to: r.user_email, subject, body }).catch(() => {});
  }

  if (isAlert) {
    const apiUrl = import.meta.env.VITE_WHATSAPP_API_URL;
    const token = import.meta.env.VITE_WHATSAPP_TOKEN;
    const numbers = import.meta.env.VITE_WHATSAPP_NUMBERS;
    if (apiUrl && token && numbers) {
      const msg = `🚨 *ALERTA ZP7*\n\n*Testor:* ${testor}\n*Status:* ${to}\n*Horário:* ${hora}\n\nVerifique o equipamento imediatamente.`;
      for (const num of numbers.split(",")) {
        fetch(`${apiUrl}/message/sendText`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": token },
          body: JSON.stringify({ number: num.trim(), text: msg }),
        }).catch(() => {});
      }
    }
  }
}

function calcCarrosPorHora(t) {
  if (t.tempo_medio_carro > 0) return Math.round(60 / t.tempo_medio_carro);
  return t.carros_por_hora || 0;
}

function TestorForm({ initial, onSave, isPending, onCancel }) {
  const [form, setForm] = useState(initial || emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calcula carros/hora quando tempo médio muda
  const handleTempoMedio = (v) => {
    set("tempo_medio_carro", v);
    const num = Number(v);
    if (num > 0) set("carros_por_hora", Math.round(60 / num));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Nome / Identificação *</Label>
          <Input required value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Testor 01" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Risco (0–100)</Label>
          <Input type="number" min="0" max="100" value={form.risco_score} onChange={e => set("risco_score", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tempo médio/carro (min) *</Label>
          <Input type="number" value={form.tempo_medio_carro} onChange={e => handleTempoMedio(e.target.value)} placeholder="Ex: 4" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Carros/hora (auto)</Label>
          <Input type="number" value={form.carros_por_hora} onChange={e => set("carros_por_hora", e.target.value)}
            className="bg-primary/5 border-primary/30" placeholder="Calculado automaticamente" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Produção real no turno</Label>
          <Input type="number" value={form.carros_testados_turno} onChange={e => set("carros_testados_turno", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Falhas no turno</Label>
          <Input type="number" value={form.falhas_turno} onChange={e => set("falhas_turno", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Reprovações</Label>
          <Input type="number" value={form.reprovacoes} onChange={e => set("reprovacoes", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Paradas curtas</Label>
          <Input type="number" value={form.paradas_curtas} onChange={e => set("paradas_curtas", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tempo total parado (min)</Label>
          <Input type="number" value={form.tempo_total_parado} onChange={e => set("tempo_total_parado", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Última manutenção</Label>
          <Input type="date" value={form.ultima_manutencao} onChange={e => set("ultima_manutencao", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Próxima manutenção</Label>
          <Input type="date" value={form.proxima_manutencao} onChange={e => set("proxima_manutencao", e.target.value)} />
        </div>
      </div>
      {form.tempo_medio_carro > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary">
          IA: 60 ÷ {form.tempo_medio_carro}min = <strong>{Math.round(60 / form.tempo_medio_carro)} carros/hora previstos</strong>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        {onCancel && <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
}

export default function Testores() {
   const [createOpen, setCreateOpen] = useState(false);
   const [editTarget, setEditTarget] = useState(null);
   const [deleteTarget, setDeleteTarget] = useState(null);
   const [hourlyTarget, setHourlyTarget] = useState(null);
   const [historyTarget, setHistoryTarget] = useState(null);
   const qc = useQueryClient();

  useEffect(() => {
    const unsub = base44.entities.Testor.subscribe((event) => {
      qc.setQueryData(["testores"], (prev = []) => {
        if (event.type === "create") return [...prev, event.data];
        if (event.type === "update") return prev.map(t => t.id === event.id ? event.data : t);
        if (event.type === "delete") return prev.filter(t => t.id !== event.id);
        return prev;
      });
    });
    return unsub;
  }, [qc]);

  const { data: testores = [], isLoading } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
  });

  const numFields = f => {
    const nums = ["tempo_medio_carro","tempo_minimo","tempo_maximo","carros_testados_turno","carros_por_hora",
      "falhas_turno","reprovacoes","paradas_curtas","tempo_total_parado","risco_score"];
    const out = { ...f };
    nums.forEach(k => { if (out[k] !== "" && out[k] !== undefined) out[k] = Number(out[k]) || 0; });
    return out;
  };

  const createMut = useMutation({
    mutationFn: d => base44.entities.Testor.create(numFields(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["testores"] }); setCreateOpen(false); },
  });

  const editMut = useMutation({
    mutationFn: async (d) => {
      const prev = testores.find(t => t.id === editTarget.id);
      await base44.entities.Testor.update(editTarget.id, numFields(d));
      if (prev && prev.status !== d.status) notifyTeam(d.nome || prev.nome, prev.status, d.status);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["testores"] }); setEditTarget(null); },
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.Testor.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["testores"] }); setDeleteTarget(null); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const prev = testores.find(t => t.id === id);
      await base44.entities.Testor.update(id, { status });
      if (prev && prev.status !== status) notifyTeam(prev.nome, prev.status, status);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["testores"] }),
  });

  // Fechamento de hora: acumula na produção real + falhas do testor
  const handleHourlyClose = ({ testor, carros_real, falhas }) => {
    const novo_real = (testor.carros_testados_turno || 0) + carros_real;
    const novo_falhas = (testor.falhas_turno || 0) + falhas;
    base44.entities.Testor.update(testor.id, {
      carros_testados_turno: novo_real,
      falhas_turno: novo_falhas,
    }).then(() => qc.invalidateQueries({ queryKey: ["testores"] }));
  };

  // Exportar PDF
  const handleExportPDF = () => {
    const hora = new Date().toLocaleString("pt-BR");
    const rows = testores.map(t => {
      const cph = calcCarrosPorHora(t);
      const real = t.carros_testados_turno || 0;
      const falhas = t.falhas_turno || 0;
      const liquido = Math.max(0, real - falhas);
      const ef = real > 0 ? Math.min(100, Math.round((liquido / real) * 100)) : 0;
      return `<tr>
        <td>${t.nome}</td><td>${t.status}</td><td>${cph}</td><td>${real}</td>
        <td>${falhas}</td><td>${liquido}</td><td>${ef}%</td>
        <td>${t.tempo_total_parado || 0}min</td><td>${t.risco_score || 0}%</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page{size:A4 landscape;margin:10mm}
      body{font-family:Arial;font-size:10px;color:#000}
      h1{font-size:14px;margin-bottom:4px}
      p{font-size:9px;color:#666;margin:0 0 10px}
      table{border-collapse:collapse;width:100%}
      th{background:#e0e0e0;padding:5px;text-align:left;border:1px solid #999;font-size:9px}
      td{padding:4px 5px;border:1px solid #ccc;font-size:9px}
      tr:nth-child(even){background:#f9f9f9}
    </style></head><body>
    <h1>Relatório de Testores — ZP7</h1>
    <p>Gerado em: ${hora}</p>
    <table>
      <thead><tr>
        <th>Testor</th><th>Status</th><th>Previsto/h</th><th>Real</th>
        <th>Falhas</th><th>Líquido</th><th>Efic.</th><th>T.Perdido</th><th>Risco</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Exportar Excel (CSV)
  const handleExportExcel = () => {
    const headers = ["Testor","Status","Previsto/h","Produção Real","Falhas","Produção Líquida","Eficiência","Tempo Perdido (min)","Risco (%)"];
    const rows = testores.map(t => {
      const cph = calcCarrosPorHora(t);
      const real = t.carros_testados_turno || 0;
      const falhas = t.falhas_turno || 0;
      const liquido = Math.max(0, real - falhas);
      const ef = real > 0 ? Math.min(100, Math.round((liquido / real) * 100)) : 0;
      return [t.nome, t.status, cph, real, falhas, liquido, `${ef}%`, t.tempo_total_parado || 0, t.risco_score || 0].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `testores-zp7-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const counts = { rodando: 0, atencao: 0, parado: 0, manutencao: 0, bloqueado: 0 };
  testores.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Testores</h1>
          <p className="text-xs text-muted-foreground">{testores.length} cadastrados · painel inteligente de produção</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Ao vivo
          </span>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar Testor</DialogTitle></DialogHeader>
              <TestorForm onSave={d => createMut.mutate(d)} isPending={createMut.isPending} onCancel={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusConfig).map(([k, cfg]) => (
          <div key={k} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {counts[k]} {cfg.label}
          </div>
        ))}
      </div>

      {/* Painel de produção */}
      {testores.length > 0 && (
        <TestorProductionPanel
          testores={testores}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
        />
      )}

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-64 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : testores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gauge className="w-14 h-14 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum testor cadastrado.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro testor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {testores.map(t => (
            <TestorCard
              key={t.id}
              t={t}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
              onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
              onHourlyClose={setHourlyTarget}
              onHistory={setHistoryTarget}
            />
          ))}
        </div>
      )}

      {/* Fechamento de hora */}
      <HourlyCloseModal
        testor={hourlyTarget}
        open={!!hourlyTarget}
        onClose={() => setHourlyTarget(null)}
        onSave={handleHourlyClose}
      />

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar — {editTarget?.nome}</DialogTitle></DialogHeader>
          {editTarget && (
            <TestorForm initial={editTarget} onSave={d => editMut.mutate(d)} isPending={editMut.isPending} onCancel={() => setEditTarget(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Testor</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir <b>{deleteTarget?.nome}</b>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMut.mutate(deleteTarget.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Histórico semanal */}
      {historyTarget && (
        <TestorWeeklyHistory testor={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
      </div>
      );
      }