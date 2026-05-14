import React, { useState, useEffect } from "react";
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
import { Plus, Wrench, Clock, AlertTriangle, CheckCircle2, Printer, Trash2, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";

const prioConfig = {
  baixa: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  media: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  alta: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critica: "bg-red-500/15 text-red-400 border-red-500/30",
};

const statusConfig = {
  aberto: "bg-red-500/15 text-red-400 border-red-500/30",
  em_andamento: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  concluido: "bg-green-500/15 text-green-400 border-green-500/30",
};

const tipoFalhaLabel = { mecanica: "Mecânica", eletrica: "Elétrica", software: "Software", calibracao: "Calibração", outro: "Outro" };
const emptyForm = { testor_nome: "", tipo_falha: "mecanica", descricao: "", prioridade: "media", tempo_estimado_reparo: "", impacto_carros: "", responsavel: "", pecas_necessarias: "" };

export default function Maintenance() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("todos");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const qc = useQueryClient();

  // Tempo real — atualiza para todos os usuários
  useEffect(() => {
    const unsub = base44.entities.MaintenanceRequest.subscribe((event) => {
      qc.setQueryData(["maintenance"], (prev = []) => {
        if (event.type === "create") return [event.data, ...prev];
        if (event.type === "update") return prev.map(r => r.id === event.id ? event.data : r);
        if (event.type === "delete") return prev.filter(r => r.id !== event.id);
        return prev;
      });
    });
    return unsub;
  }, [qc]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: () => base44.entities.MaintenanceRequest.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.MaintenanceRequest.create({
      ...d,
      tempo_estimado_reparo: Number(d.tempo_estimado_reparo) || 0,
      impacto_carros: Number(d.impacto_carros) || 0,
      status: "aberto",
      data_abertura: new Date().toISOString().slice(0, 10),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); setOpen(false); setForm(emptyForm); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.MaintenanceRequest.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.MaintenanceRequest.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); setDeleteTarget(null); },
  });

  const filtered = filter === "todos" ? requests : requests.filter(r => r.status === filter);

  const counts = {
    aberto: requests.filter(r => r.status === "aberto").length,
    em_andamento: requests.filter(r => r.status === "em_andamento").length,
    concluido: requests.filter(r => r.status === "concluido").length,
  };

  const handleExportCsv = () => {
    exportCsv("manutencao_zp7", ["Testor", "Tipo Falha", "Prioridade", "Status", "T.Reparo(min)", "Carros Impactados", "Responsável", "Peças", "Descrição"],
      requests.map(r => [r.testor_nome || "", tipoFalhaLabel[r.tipo_falha] || r.tipo_falha || "", r.prioridade, r.status, r.tempo_estimado_reparo || 0, r.impacto_carros || 0, r.responsavel || "", r.pecas_necessarias || "", r.descricao || ""])
    );
  };

  const handlePrint = () => {
    const rows = requests.map(r => `<tr>
      <td>${r.testor_nome || "—"}</td>
      <td>${tipoFalhaLabel[r.tipo_falha] || r.tipo_falha || "—"}</td>
      <td>${r.prioridade}</td>
      <td>${r.status?.replace(/_/g, " ")}</td>
      <td>${r.tempo_estimado_reparo ? r.tempo_estimado_reparo + " min" : "—"}</td>
      <td>${r.impacto_carros || 0}</td>
      <td>${r.responsavel || "—"}</td>
      <td>${r.descricao || "—"}</td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;font-size:9px;color:#111}
    h1{font-size:14px;margin:0 0 6px}table{border-collapse:collapse;width:100%}
    th{background:#e0e0e0;padding:4px 6px;border:1px solid #999;text-align:left;font-size:8px}
    td{padding:3px 6px;border:1px solid #ccc;font-size:8px}tr:nth-child(even){background:#f9f9f9}</style></head>
    <body><h1>Chamados de Manutenção ZP7 — ${new Date().toLocaleString("pt-BR")}</h1>
    <table><thead><tr><th>Testor</th><th>Tipo</th><th>Prioridade</th><th>Status</th><th>T.Reparo</th><th>Carros</th><th>Responsável</th><th>Descrição</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <script>window.onload=function(){window.print()}<\/script></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })); a.target = "_blank"; a.click();
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Wrench className="w-5 h-5 text-orange-400" /> Manutenção</h1>
          <p className="text-xs text-muted-foreground">{counts.aberto} abertos · {counts.em_andamento} em andamento · {counts.concluido} concluídos</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 text-muted-foreground"><FileSpreadsheet className="w-3.5 h-3.5" /><span className="hidden sm:inline">CSV</span></Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-muted-foreground"><Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">PDF</span></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /><span className="hidden sm:inline">Novo </span>Chamado</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Abrir Chamado de Manutenção</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Testor *</Label>
                    <Input required value={form.testor_nome} onChange={e => setForm({ ...form, testor_nome: e.target.value })} placeholder="Ex: Testor 1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de Falha</Label>
                    <Select value={form.tipo_falha} onValueChange={v => setForm({ ...form, tipo_falha: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(tipoFalhaLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prioridade</Label>
                    <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v })}>
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
                    <Label className="text-xs">Tempo reparo (min)</Label>
                    <Input type="number" value={form.tempo_estimado_reparo} onChange={e => setForm({ ...form, tempo_estimado_reparo: e.target.value })} placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Responsável</Label>
                    <Input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} placeholder="Nome do técnico" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Carros impactados</Label>
                    <Input type="number" value={form.impacto_carros} onChange={e => setForm({ ...form, impacto_carros: e.target.value })} placeholder="0" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Peças necessárias</Label>
                  <Input value={form.pecas_necessarias} onChange={e => setForm({ ...form, pecas_necessarias: e.target.value })} placeholder="Ex: Placa P/N 7Z1-915-321" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição *</Label>
                  <Textarea required value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} placeholder="Descreva a falha em detalhes" />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={createMut.isPending}>Abrir Chamado</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[["todos", "Todos"], ["aberto", "Abertos"], ["em_andamento", "Em Andamento"], ["concluido", "Concluídos"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum chamado {filter !== "todos" ? `"${filter}"` : "registrado"}.</p>
          </CardContent></Card>
        ) : filtered.map(r => (
          <Card key={r.id} className={`border ${r.prioridade === "critica" ? "border-red-500/30" : "border-border"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{r.testor_nome} — {tipoFalhaLabel[r.tipo_falha] || r.tipo_falha}</p>
                    <Badge className={`text-[10px] border ${prioConfig[r.prioridade]}`}>{r.prioridade}</Badge>
                    <Badge className={`text-[10px] border ${statusConfig[r.status] || statusConfig.aberto}`}>{r.status?.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.descricao}</p>
                  <div className="flex gap-3 text-xs flex-wrap">
                    {r.tempo_estimado_reparo > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {r.tempo_estimado_reparo} min</span>}
                    {r.impacto_carros > 0 && <span className="text-red-400">🚗 {r.impacto_carros} carros</span>}
                    {r.pecas_necessarias && <span className="text-muted-foreground">Peças: {r.pecas_necessarias}</span>}
                    {r.responsavel && <span className="text-muted-foreground">Resp: {r.responsavel}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {r.status !== "concluido" && (
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => updateMut.mutate({ id: r.id, status: r.status === "aberto" ? "em_andamento" : "concluido" })}>
                      {r.status === "aberto" ? "Iniciar" : "Concluir"}
                    </Button>
                  )}
                  <button onClick={() => setDeleteTarget(r)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
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
          <AlertDialogHeader><AlertDialogTitle>Excluir Chamado</AlertDialogTitle>
            <AlertDialogDescription>Excluir chamado de "{deleteTarget?.testor_nome}"?</AlertDialogDescription>
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