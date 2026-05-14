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
import { Plus, AlertTriangle, CheckCircle2, Clock, Trash2, Printer, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { exportOccurrencesPdf } from "@/lib/exportPdf";

const gravConfig = {
  baixa: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  media: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  alta: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critica: "bg-red-500/15 text-red-400 border-red-500/30",
};

const statusConfig = {
  aberta: "bg-red-500/15 text-red-400 border-red-500/30",
  em_andamento: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  resolvida: "bg-green-500/15 text-green-400 border-green-500/30",
};

const tipoLabel = {
  falha_mecanica: "Falha Mecânica", falha_eletrica: "Falha Elétrica",
  qualidade: "Qualidade", seguranca: "Segurança", parada: "Parada", outro: "Outro"
};

const emptyForm = { tipo: "outro", testor: "", gravidade: "media", acao_tomada: "", tempo_parada: "", impacto_producao: "", status: "aberta", descricao: "" };

export default function Occurrences() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filter, setFilter] = useState("todas");
  const qc = useQueryClient();

  useEffect(() => {
    const unsub = base44.entities.Occurrence.subscribe((event) => {
      qc.setQueryData(["occurrences"], (prev = []) => {
        if (event.type === "create") return [event.data, ...prev];
        if (event.type === "update") return prev.map(o => o.id === event.id ? event.data : o);
        if (event.type === "delete") return prev.filter(o => o.id !== event.id);
        return prev;
      });
    });
    return unsub;
  }, [qc]);

  const { data: occurrences = [], isLoading } = useQuery({
    queryKey: ["occurrences"],
    queryFn: () => base44.entities.Occurrence.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Occurrence.create({ ...d, tempo_parada: Number(d.tempo_parada) || 0, impacto_producao: Number(d.impacto_producao) || 0, data: new Date().toISOString().slice(0, 10), hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["occurrences"] }); setOpen(false); setForm(emptyForm); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Occurrence.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrences"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Occurrence.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["occurrences"] }); setDeleteTarget(null); },
  });

  const filtered = filter === "todas" ? occurrences : occurrences.filter(o => o.status === filter);

  const handleExportCsv = () => {
    exportCsv("ocorrencias_zp7", ["Data", "Hora", "Tipo", "Testor", "Gravidade", "Status", "T.Parada(min)", "Carros Perdidos", "Descrição"],
      occurrences.map(o => [o.data || "", o.hora || "", tipoLabel[o.tipo] || o.tipo || "", o.testor || "", o.gravidade || "", o.status || "", o.tempo_parada || 0, o.impacto_producao || 0, o.descricao || ""])
    );
  };

  const handlePrint = () => exportOccurrencesPdf(occurrences);

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-400" /> Ocorrências</h1>
          <p className="text-xs text-muted-foreground">{occurrences.length} registradas · {occurrences.filter(o => o.status === "aberta").length} abertas</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 text-muted-foreground"><FileSpreadsheet className="w-3.5 h-3.5" /><span className="hidden sm:inline">CSV</span></Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-muted-foreground"><Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">PDF</span></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar Ocorrência</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo *</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(tipoLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Gravidade</Label>
                    <Select value={form.gravidade} onValueChange={(v) => setForm({ ...form, gravidade: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">🔴 Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Testor</Label>
                  <Input value={form.testor} onChange={(e) => setForm({ ...form, testor: e.target.value })} placeholder="Ex: Testor 1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Parada (min)</Label><Input type="number" value={form.tempo_parada} onChange={(e) => setForm({ ...form, tempo_parada: e.target.value })} placeholder="0" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Carros perdidos</Label><Input type="number" value={form.impacto_producao} onChange={(e) => setForm({ ...form, impacto_producao: e.target.value })} placeholder="0" /></div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Descrição / Ação tomada</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
                <Button type="submit" className="w-full" size="lg" disabled={createMut.isPending}>Registrar Ocorrência</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 flex-wrap">
        {[["todas", "Todas"], ["aberta", "Abertas"], ["em_andamento", "Em Andamento"], ["resolvida", "Resolvidas"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma ocorrência {filter !== "todas" ? `com status "${filter}"` : "registrada"}.</p>
          </CardContent></Card>
        ) : filtered.map((occ) => (
          <Card key={occ.id} className={`border ${occ.gravidade === "critica" ? "border-red-500/30" : "border-border"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{tipoLabel[occ.tipo] || occ.tipo || "Ocorrência"}</p>
                    <Badge className={`text-[10px] border ${gravConfig[occ.gravidade] || gravConfig.media}`}>{occ.gravidade}</Badge>
                    <Badge className={`text-[10px] border ${statusConfig[occ.status] || statusConfig.aberta}`}>{occ.status?.replace(/_/g, " ")}</Badge>
                  </div>
                  {occ.testor && <p className="text-xs text-muted-foreground">Testor: <span className="text-foreground font-medium">{occ.testor}</span></p>}
                  {occ.descricao && <p className="text-xs text-muted-foreground">{occ.descricao}</p>}
                  <div className="flex gap-3 text-xs flex-wrap">
                    {occ.tempo_parada > 0 && <span className="flex items-center gap-1 text-orange-400"><Clock className="w-3 h-3" /> {occ.tempo_parada} min parado</span>}
                    {occ.impacto_producao > 0 && <span className="text-red-400">🚗 {occ.impacto_producao} carros perdidos</span>}
                    {occ.data && <span className="text-muted-foreground">{occ.data} {occ.hora && `às ${occ.hora}`}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end shrink-0">
                  {occ.status !== "resolvida" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-green-400 border-green-500/30 hover:bg-green-500/10"
                      onClick={() => updateMut.mutate({ id: occ.id, status: occ.status === "aberta" ? "em_andamento" : "resolvida" })}
                    >
                      {occ.status === "aberta" ? "Iniciar" : "Resolver"}
                    </Button>
                  )}
                  <button onClick={() => setDeleteTarget(occ)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
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
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ocorrência</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
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