import React, { useState } from "react";
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
import { Plus, Wrench } from "lucide-react";

const prioConfig = {
  baixa: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  media: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  alta: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  critica: "bg-red-500/10 text-red-400 border-red-500/30",
};

const statusConfig = {
  aberto: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  em_andamento: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  concluido: "bg-green-500/10 text-green-400 border-green-500/30",
};

const emptyForm = { testor_nome: "", tipo_falha: "", descricao: "", prioridade: "media", tempo_estimado_reparo: "", pecas_necessarias: "", impacto_carros: "", responsavel: "", observacao: "" };

export default function Maintenance() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: () => base44.entities.MaintenanceRequest.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.MaintenanceRequest.create({
      ...d,
      tempo_estimado_reparo: Number(d.tempo_estimado_reparo) || 0,
      impacto_carros: Number(d.impacto_carros) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); setOpen(false); setForm(emptyForm); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.MaintenanceRequest.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manutenção</h1>
          <p className="text-sm text-muted-foreground">Chamados e controle de manutenção</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Chamado</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Solicitar Manutenção</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Testor</Label><Input required value={form.testor_nome} onChange={(e) => setForm({ ...form, testor_nome: e.target.value })} placeholder="Ex: Testor 1" /></div>
                <div className="space-y-2">
                  <Label>Tipo de falha</Label>
                  <Select value={form.tipo_falha} onValueChange={(v) => setForm({ ...form, tipo_falha: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mecanica">Mecânica</SelectItem>
                      <SelectItem value="eletrica">Elétrica</SelectItem>
                      <SelectItem value="software">Software</SelectItem>
                      <SelectItem value="calibracao">Calibração</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                <div className="space-y-2"><Label>Tempo reparo (min)</Label><Input type="number" value={form.tempo_estimado_reparo} onChange={(e) => setForm({ ...form, tempo_estimado_reparo: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Responsável</Label><Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></div>
              <div className="space-y-2"><Label>Peças necessárias</Label><Input value={form.pecas_necessarias} onChange={(e) => setForm({ ...form, pecas_necessarias: e.target.value })} /></div>
              <div className="space-y-2"><Label>Carros impactados</Label><Input type="number" value={form.impacto_carros} onChange={(e) => setForm({ ...form, impacto_carros: e.target.value })} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Abrir Chamado</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wrench className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum chamado de manutenção.</p>
            </CardContent>
          </Card>
        ) : (
          requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-sm">{r.testor_nome} — {r.tipo_falha?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{r.descricao}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      {r.tempo_estimado_reparo > 0 && <span>Tempo: {r.tempo_estimado_reparo}min</span>}
                      {r.impacto_carros > 0 && <span className="text-red-400">{r.impacto_carros} carros impactados</span>}
                      {r.pecas_necessarias && <span>Peças: {r.pecas_necessarias}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-[10px] border ${prioConfig[r.prioridade]}`}>{r.prioridade}</Badge>
                    <Select value={r.status} onValueChange={(v) => updateMut.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="w-28 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
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