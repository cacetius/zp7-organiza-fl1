import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, ArrowRightLeft, FileText } from "lucide-react";

const turnoLabels = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };

export default function ShiftHandoff() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    turno_saindo: "", turno_entrando: "", producao_realizada: "", producao_planejada: "",
    testores_com_problema: "", pendencias_abertas: "", ocorrencias_criticas: "",
    acoes_em_andamento: "", alertas_proximo_turno: "", observacao: "", responsavel: "",
  });
  const qc = useQueryClient();

  const { data: handoffs = [], isLoading } = useQuery({
    queryKey: ["handoffs"],
    queryFn: () => base44.entities.ShiftHandoff.list("-created_date", 20),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ShiftHandoff.create({
      ...d,
      producao_realizada: Number(d.producao_realizada) || 0,
      producao_planejada: Number(d.producao_planejada) || 0,
      pendencias_abertas: Number(d.pendencias_abertas) || 0,
      data: new Date().toISOString().split("T")[0],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["handoffs"] }); setOpen(false); },
  });

  const u = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Passagem de Turno</h1>
          <p className="text-sm text-muted-foreground">Registre passagens de turno inteligentes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Passagem</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Passagem de Turno</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Turno Saindo</Label>
                  <Select value={form.turno_saindo} onValueChange={(v) => u("turno_saindo", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primeiro">1º Turno</SelectItem>
                      <SelectItem value="segundo">2º Turno</SelectItem>
                      <SelectItem value="terceiro">3º Turno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Turno Entrando</Label>
                  <Select value={form.turno_entrando} onValueChange={(v) => u("turno_entrando", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primeiro">1º Turno</SelectItem>
                      <SelectItem value="segundo">2º Turno</SelectItem>
                      <SelectItem value="terceiro">3º Turno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Produção Planejada</Label><Input type="number" value={form.producao_planejada} onChange={(e) => u("producao_planejada", e.target.value)} /></div>
                <div className="space-y-2"><Label>Produção Realizada</Label><Input type="number" value={form.producao_realizada} onChange={(e) => u("producao_realizada", e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Responsável</Label><Input value={form.responsavel} onChange={(e) => u("responsavel", e.target.value)} /></div>
              <div className="space-y-2"><Label>Testores com problema</Label><Textarea value={form.testores_com_problema} onChange={(e) => u("testores_com_problema", e.target.value)} rows={2} /></div>
              <div className="space-y-2"><Label>Ocorrências críticas</Label><Textarea value={form.ocorrencias_criticas} onChange={(e) => u("ocorrencias_criticas", e.target.value)} rows={2} /></div>
              <div className="space-y-2"><Label>Ações em andamento</Label><Textarea value={form.acoes_em_andamento} onChange={(e) => u("acoes_em_andamento", e.target.value)} rows={2} /></div>
              <div className="space-y-2"><Label>Alertas próximo turno</Label><Textarea value={form.alertas_proximo_turno} onChange={(e) => u("alertas_proximo_turno", e.target.value)} rows={2} /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacao} onChange={(e) => u("observacao", e.target.value)} rows={2} /></div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Registrar Passagem</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : handoffs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ArrowRightLeft className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma passagem registrada.</p>
            </CardContent>
          </Card>
        ) : (
          handoffs.map((h) => (
            <Card key={h.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {turnoLabels[h.turno_saindo] || h.turno_saindo} → {turnoLabels[h.turno_entrando] || h.turno_entrando}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{h.data}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground text-xs">Planejado:</span> <span className="font-semibold">{h.producao_planejada || 0}</span></div>
                  <div><span className="text-muted-foreground text-xs">Realizado:</span> <span className="font-semibold">{h.producao_realizada || 0}</span></div>
                </div>
                {h.testores_com_problema && <div className="text-xs"><span className="text-muted-foreground">Testores:</span> <span>{h.testores_com_problema}</span></div>}
                {h.ocorrencias_criticas && <div className="text-xs"><span className="text-muted-foreground">Ocorrências:</span> <span>{h.ocorrencias_criticas}</span></div>}
                {h.alertas_proximo_turno && <div className="text-xs text-yellow-400">⚠ {h.alertas_proximo_turno}</div>}
                {h.observacao && <div className="text-xs text-muted-foreground">{h.observacao}</div>}
                {h.responsavel && <div className="text-xs text-muted-foreground">Responsável: {h.responsavel}</div>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}