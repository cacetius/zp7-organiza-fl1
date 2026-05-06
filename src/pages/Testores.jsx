import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Gauge, Clock, Car, Activity, Pencil, Trash2, Download, CheckSquare, X } from "lucide-react";

const statusConfig = {
  rodando:    { label: "Rodando",    color: "bg-green-500/10 text-green-400 border-green-500/30",  dot: "bg-green-400" },
  atencao:    { label: "Atenção",    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400" },
  parado:     { label: "Parado",     color: "bg-red-500/10 text-red-400 border-red-500/30",         dot: "bg-red-400" },
  manutencao: { label: "Manutenção", color: "bg-orange-500/10 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
  bloqueado:  { label: "Bloqueado",  color: "bg-gray-500/10 text-gray-400 border-gray-500/30",      dot: "bg-gray-400" },
};

const emptyForm = {
  nome: "", status: "rodando",
  tempo_medio_carro: "", tempo_minimo: "", tempo_maximo: "",
  carros_testados_turno: "", carros_por_hora: "",
  falhas_turno: "", reprovacoes: "", paradas_curtas: "", tempo_total_parado: "",
  ultima_manutencao: "", proxima_manutencao: "", risco_score: "",
};

function getRiskColor(s) {
  if (s <= 30) return "text-green-400";
  if (s <= 60) return "text-yellow-400";
  if (s <= 80) return "text-orange-400";
  return "text-red-400";
}
function getRiskLabel(s) {
  if (s <= 30) return "Baixo";
  if (s <= 60) return "Médio";
  if (s <= 80) return "Alto";
  return "Crítico";
}

async function notifyTeam(testor, oldStatus, newStatus) {
  // Find leaders and monitors to notify
  const profiles = await base44.entities.UserProfile.filter({});
  const recipients = profiles.filter(p =>
    ["lider", "monitor", "manutencao"].includes(p.funcao) && p.user_email
  );
  const from = statusConfig[oldStatus]?.label || oldStatus;
  const to   = statusConfig[newStatus]?.label || newStatus;
  for (const r of recipients) {
    base44.integrations.Core.SendEmail({
      to: r.user_email,
      subject: `[ZP7] Alteração de status — ${testor}`,
      body: `Olá ${r.nome},\n\nO testor <b>${testor}</b> teve seu status alterado:\n\n<b>${from}</b> → <b>${to}</b>\n\nAcesse o sistema ZP7 para mais detalhes.\n\n— ZP7 Organização | Volkswagen Taubaté`,
    }).catch(() => {});
  }
}

function TestorForm({ initial, onSave, isPending, onCancel }) {
  const [form, setForm] = useState(initial || emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-2">
          <Label>Nome / Identificação *</Label>
          <Input required value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Testor 1" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Risco (0–100)</Label>
          <Input type="number" min="0" max="100" value={form.risco_score} onChange={e => set("risco_score", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tempo médio/carro (min)</Label>
          <Input type="number" value={form.tempo_medio_carro} onChange={e => set("tempo_medio_carro", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Carros/hora</Label>
          <Input type="number" value={form.carros_por_hora} onChange={e => set("carros_por_hora", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Carros testados no turno</Label>
          <Input type="number" value={form.carros_testados_turno} onChange={e => set("carros_testados_turno", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Falhas no turno</Label>
          <Input type="number" value={form.falhas_turno} onChange={e => set("falhas_turno", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Reprovações</Label>
          <Input type="number" value={form.reprovacoes} onChange={e => set("reprovacoes", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Paradas curtas</Label>
          <Input type="number" value={form.paradas_curtas} onChange={e => set("paradas_curtas", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tempo total parado (min)</Label>
          <Input type="number" value={form.tempo_total_parado} onChange={e => set("tempo_total_parado", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Última manutenção</Label>
          <Input type="date" value={form.ultima_manutencao} onChange={e => set("ultima_manutencao", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Próxima manutenção</Label>
          <Input type="date" value={form.proxima_manutencao} onChange={e => set("proxima_manutencao", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        {onCancel && <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

export default function Testores() {
  const [createOpen, setCreateOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected]       = useState([]);
  const [bulkStatus, setBulkStatus]   = useState("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const qc = useQueryClient();

  // ── Real-time subscription: any change by any user updates the list instantly ──
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
      if (prev && prev.status !== d.status) {
        notifyTeam(d.nome || prev.nome, prev.status, d.status);
      }
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
      if (prev && prev.status !== status) {
        notifyTeam(prev.nome, prev.status, status);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["testores"] }),
  });

  // Bulk actions
  const toggleSelect = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll    = () => setSelected(s => s.length === testores.length ? [] : testores.map(t => t.id));
  const clearSelect  = () => setSelected([]);

  const bulkUpdateMut = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        const prev = testores.find(t => t.id === id);
        await base44.entities.Testor.update(id, { status: bulkStatus });
        if (prev && prev.status !== bulkStatus) notifyTeam(prev.nome, prev.status, bulkStatus);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["testores"] }); clearSelect(); setBulkStatus(""); },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async () => { for (const id of selected) await base44.entities.Testor.delete(id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["testores"] }); clearSelect(); setBulkDeleteOpen(false); },
  });

  const exportCSV = () => {
    const rows = testores.filter(t => selected.length === 0 || selected.includes(t.id));
    const headers = ["nome","status","carros_testados_turno","carros_por_hora","tempo_medio_carro","falhas_turno","reprovacoes","risco_score","ultima_manutencao"];
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => r[h] ?? "").join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `testores_zp7_${new Date().toISOString().split("T")[0]}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Controle dos Testores</h1>
          <p className="text-sm text-muted-foreground">Monitoramento em tempo real · {testores.length} testores</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar {selected.length > 0 ? `(${selected.length})` : "Todos"}
          </Button>
          <Button size="sm" onClick={toggleAll} variant="outline">
            <CheckSquare className="w-4 h-4 mr-2" />
            {selected.length === testores.length && testores.length > 0 ? "Desmarcar" : "Selec. Todos"}
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" />Novo Testor</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar Testor</DialogTitle></DialogHeader>
              <TestorForm onSave={d => createMut.mutate(d)} isPending={createMut.isPending} onCancel={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <span className="text-sm font-medium text-primary">{selected.length} selecionado(s)</span>
          <div className="flex gap-2 flex-wrap flex-1">
            <div className="flex gap-2 items-center">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Alterar status" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!bulkStatus || bulkUpdateMut.isPending} onClick={() => bulkUpdateMut.mutate()}>
                Aplicar
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="w-3 h-3 mr-1" /> Exportar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="w-3 h-3 mr-1" /> Excluir
            </Button>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 ml-auto" onClick={clearSelect}><X className="w-4 h-4" /></Button>
        </div>
      )}

      {/* Testor cards */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : testores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gauge className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum testor cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {testores.map((t) => {
            const cfg  = statusConfig[t.status] || statusConfig.rodando;
            const risk = t.risco_score || 0;
            const sel  = selected.includes(t.id);
            return (
              <Card key={t.id} className={`overflow-hidden transition-all ${sel ? "ring-2 ring-primary" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={sel}
                        onCheckedChange={() => toggleSelect(t.id)}
                        className="shrink-0"
                      />
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} animate-pulse shrink-0`} />
                      <CardTitle className="text-base truncate">{t.nome}</CardTitle>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditTarget(t)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Select value={t.status} onValueChange={v => updateStatus.mutate({ id: t.id, status: v })}>
                    <SelectTrigger className="w-full h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Car className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">{t.carros_testados_turno || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Carros/turno</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Activity className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">{t.carros_por_hora || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Carros/hora</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">{t.tempo_medio_carro || 0}m</p>
                      <p className="text-[10px] text-muted-foreground">Tempo médio</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Risco</span>
                      <span className={`font-semibold ${getRiskColor(risk)}`}>{risk}% — {getRiskLabel(risk)}</span>
                    </div>
                    <Progress value={risk} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Falhas</span><span className="font-medium">{t.falhas_turno || 0}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Reprovações</span><span className="font-medium">{t.reprovacoes || 0}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Paradas</span><span className="font-medium">{t.paradas_curtas || 0}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tempo parado</span><span className="font-medium">{t.tempo_total_parado || 0}min</span></div>
                  </div>
                  {t.ultima_manutencao && (
                    <p className="text-[10px] text-muted-foreground">Última manutenção: {t.ultima_manutencao}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Testor — {editTarget?.nome}</DialogTitle></DialogHeader>
          {editTarget && (
            <TestorForm
              initial={editTarget}
              onSave={d => editMut.mutate(d)}
              isPending={editMut.isPending}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete single confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Testor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <b>{deleteTarget?.nome}</b>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMut.mutate(deleteTarget.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.length} testores?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados dos testores selecionados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMut.mutate()}>
              Excluir Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}