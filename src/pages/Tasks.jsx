import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ClipboardList } from "lucide-react";

const prioridadeConfig = {
  baixa: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  media: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  alta: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  critica: "bg-red-500/10 text-red-400 border-red-500/30",
};

const statusConfig = {
  aberta: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  em_andamento: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  concluida: "bg-green-500/10 text-green-400 border-green-500/30",
  atrasada: "bg-red-500/10 text-red-400 border-red-500/30",
};

const emptyTask = { titulo: "", descricao: "", responsavel: "", prioridade: "media", status: "aberta", prazo: "", observacoes: "" };

export default function Tasks() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyTask);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("todos");
  const qc = useQueryClient();

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editId) updateMut.mutate({ id: editId, data: form });
    else createMut.mutate(form);
  };

  const handleEdit = (task) => {
    setForm({ titulo: task.titulo, descricao: task.descricao, responsavel: task.responsavel, prioridade: task.prioridade, status: task.status, prazo: task.prazo || "", observacoes: task.observacoes || "" });
    setEditId(task.id);
    setOpen(true);
  };

  const filtered = filter === "todos" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Gerencie tarefas do turno</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyTask); setEditId(null); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Tarefa</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input required value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
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
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending || updateMut.isPending}>
                {editId ? "Atualizar" : "Criar Tarefa"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["todos", "aberta", "em_andamento", "concluida", "atrasada"].map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "todos" ? "Todos" : s.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((task) => (
            <Card
              key={task.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => handleEdit(task)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{task.titulo}</p>
                    <p className="text-xs text-muted-foreground">{task.responsavel} {task.prazo ? `• Prazo: ${task.prazo}` : ""}</p>
                    {task.descricao && <p className="text-xs text-muted-foreground mt-1">{task.descricao}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Badge className={`text-[10px] border ${prioridadeConfig[task.prioridade]}`}>
                      {task.prioridade}
                    </Badge>
                    <Badge className={`text-[10px] border ${statusConfig[task.status]}`}>
                      {task.status?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}