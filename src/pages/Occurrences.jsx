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
import { Plus, AlertTriangle } from "lucide-react";

const gravConfig = {
  baixa: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  media: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  alta: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  critica: "bg-red-500/10 text-red-400 border-red-500/30",
};

const statusConfig = {
  aberta: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  em_andamento: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  resolvida: "bg-green-500/10 text-green-400 border-green-500/30",
};

const emptyForm = { tipo: "", testor: "", carro: "", local: "", responsavel: "", gravidade: "media", acao_tomada: "", tempo_parada: "", impacto_producao: "", status: "aberta", descricao: "" };

export default function Occurrences() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  // ── Real-time sync ──
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
    mutationFn: (d) => base44.entities.Occurrence.create({ ...d, tempo_parada: Number(d.tempo_parada) || 0, impacto_producao: Number(d.impacto_producao) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["occurrences"] }); setOpen(false); setForm(emptyForm); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ocorrências</h1>
          <p className="text-sm text-muted-foreground">Registre e acompanhe ocorrências do ZP7</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Ocorrência</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Ocorrência</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="falha_mecanica">Falha Mecânica</SelectItem>
                      <SelectItem value="falha_eletrica">Falha Elétrica</SelectItem>
                      <SelectItem value="qualidade">Qualidade</SelectItem>
                      <SelectItem value="seguranca">Segurança</SelectItem>
                      <SelectItem value="parada">Parada</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gravidade</Label>
                  <Select value={form.gravidade} onValueChange={(v) => setForm({ ...form, gravidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Testor</Label><Input value={form.testor} onChange={(e) => setForm({ ...form, testor: e.target.value })} placeholder="Ex: Testor 1" /></div>
                <div className="space-y-2"><Label>Carro</Label><Input value={form.carro} onChange={(e) => setForm({ ...form, carro: e.target.value })} placeholder="Nº carro" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Local</Label><Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
                <div className="space-y-2"><Label>Responsável</Label><Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Tempo parada (min)</Label><Input type="number" value={form.tempo_parada} onChange={(e) => setForm({ ...form, tempo_parada: e.target.value })} /></div>
                <div className="space-y-2"><Label>Carros perdidos</Label><Input type="number" value={form.impacto_producao} onChange={(e) => setForm({ ...form, impacto_producao: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Descrição / Ação</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Registrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : occurrences.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma ocorrência registrada.</p>
            </CardContent>
          </Card>
        ) : (
          occurrences.map((occ) => (
            <Card key={occ.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{occ.tipo?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {occ.testor && `Testor: ${occ.testor}`} {occ.carro && `• Carro: ${occ.carro}`} {occ.local && `• ${occ.local}`}
                    </p>
                    {occ.descricao && <p className="text-xs text-muted-foreground mt-1">{occ.descricao}</p>}
                    {(occ.tempo_parada > 0 || occ.impacto_producao > 0) && (
                      <p className="text-xs text-red-400">
                        {occ.tempo_parada > 0 && `Parada: ${occ.tempo_parada}min`}
                        {occ.impacto_producao > 0 && ` • ${occ.impacto_producao} carros perdidos`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Badge className={`text-[10px] border ${gravConfig[occ.gravidade]}`}>{occ.gravidade}</Badge>
                    <Badge className={`text-[10px] border ${statusConfig[occ.status]}`}>{occ.status?.replace(/_/g, " ")}</Badge>
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