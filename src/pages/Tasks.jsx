import React, { useState, useEffect } from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, ClipboardList, Trash2, Printer, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { exportTasksPdf } from "@/lib/exportPdf";

const prioConfig = {
  baixa: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  media: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  alta: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critica: "bg-red-500/15 text-red-400 border-red-500/30",
};

const statusConfig = {
  aberta: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  em_andamento: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  concluida: "bg-green-500/15 text-green-400 border-green-500/30",
  atrasada: "bg-red-500/15 text-red-400 border-red-500/30",
};

const emptyTask = { titulo: "", responsavel: "", prioridade: "media", status: "aberta", prazo: "", descricao: "" };

export default function Tasks() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyTask);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    const unsub = base44.entities.Task.subscribe((event) => {
      qc.setQueryData(["tasks"], (prev = []) => {
        if (event.type === "create") return [event.data, ...prev];
        if (event.type === "update") return prev.map(t => t.id === event.id ? event.data : t);
        if (event.type === "delete") return prev.filter(t => t.id !== event.id);
        return prev;
      });
    });
    return unsub;
  }, [qc]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Task.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setOpen(false); setForm(emptyTask); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setOpen(false); setForm(emptyTask); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setDeleteTarget(null); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editId) updateMut.mutate({ id: editId, data: form });
    else createMut.mutate(form);
  };

  const handleEdit = (task) => {
    setForm({ titulo: task.titulo, responsavel: task.responsavel || "", prioridade: task.prioridade, status: task.status, prazo: task.prazo || "", descricao: task.descricao || "" });
    setEditId(task.id);
    setOpen(true);
  };

  const filtered = filter === "todos" ? tasks : tasks.filter(t => t.status === filter);

  const handleExportCsv = () => {
    exportCsv("tarefas_zp7", ["Tarefa", "Responsável", "Prioridade", "Status", "Prazo", "Descrição"],
      tasks.map(t => [t.titulo, t.responsavel || "", t.prioridade, t.status, t.prazo || "", t.descricao || ""])
    );
  };

  const handlePrint = () => exportTasksPdf(tasks);

  const counts = { aberta: tasks.filter(t => t.status === "aberta").length, em_andamento: tasks.filter(t => t.status === "em_andamento").length, concluida: tasks.filter(t => t.status === "concluida").length };

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-yellow-400" /> Tarefas</h1>
          <p className="text-xs text-muted-foreground">{counts.aberta} abertas · {counts.em_andamento} em andamento · {counts.concluida} concluídas</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 text-muted-foreground"><FileSpreadsheet className="w-3.5 h-3.5" /><span className="hidden sm:inline">CSV</span></Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-muted-foreground"><Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">PDF</span></Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyTask); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editId ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tarefa *</Label>
                  <Input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="O que precisa ser feito?" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Responsável</Label>
                  <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Nome de quem vai fazer" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prioridade</Label>
                    <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">🔴 Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberta">Aberta</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                        <SelectItem value="atrasada">Atrasada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prazo</Label>
                  <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={createMut.isPending || updateMut.isPending}>
                  {editId ? "Salvar Alterações" : "Criar Tarefa"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[["todos", "Todas"], ["aberta", "Abertas"], ["em_andamento", "Em And."], ["concluida", "Concluídas"], ["atrasada", "Atrasadas"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma tarefa encontrada.</p>
          </CardContent></Card>
        ) : filtered.map((task) => (
          <Card key={task.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => handleEdit(task)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className={`font-bold text-sm ${task.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>{task.titulo}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {task.responsavel && <span>{task.responsavel}</span>}
                    {task.prazo && <span className="text-orange-400">Prazo: {task.prazo}</span>}
                    {task.descricao && <span className="truncate max-w-xs">{task.descricao}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`text-[10px] border ${prioConfig[task.prioridade]}`}>{task.prioridade}</Badge>
                  <Badge className={`text-[10px] border ${statusConfig[task.status]}`}>{task.status?.replace(/_/g, " ")}</Badge>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(task); }} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir Tarefa</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{deleteTarget?.titulo}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMut.mutate(deleteTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}