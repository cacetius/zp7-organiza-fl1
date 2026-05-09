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
import { Plus, ArrowRightLeft, Printer } from "lucide-react";

const turnoLabels = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };

const emptyForm = {
  turno_saindo: "", turno_entrando: "", responsavel: "",
  producao_realizada: "", producao_planejada: "",
  testores_com_problema: "", ocorrencias_criticas: "",
  acoes_em_andamento: "", alertas_proximo_turno: "",
};

export default function ShiftHandoff() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
      data: new Date().toISOString().slice(0, 10),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["handoffs"] }); setOpen(false); setForm(emptyForm); },
  });

  const u = (k, v) => setForm({ ...form, [k]: v });

  const handlePrint = (h) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>@page{size:A4;margin:15mm}body{font-family:Arial;font-size:10px;color:#111}
    h1{font-size:16px;margin:0 0 4px}h2{font-size:11px;margin:12px 0 4px;color:#333;border-bottom:1px solid #ddd;padding-bottom:2px}
    .row{display:flex;gap:20px;margin:8px 0}.kpi{flex:1;background:#f0f4ff;border:1px solid #c5d0f0;border-radius:4px;padding:8px 12px}
    .kpi .v{font-size:22px;font-weight:bold;color:#1d4ed8}.kpi .l{font-size:8px;color:#666}
    p{font-size:10px;margin:4px 0}.alert{color:#b45309;font-weight:bold}</style></head>
    <body>
    <h1>Passagem de Turno — ZP7</h1>
    <p><b>${turnoLabels[h.turno_saindo] || h.turno_saindo} → ${turnoLabels[h.turno_entrando] || h.turno_entrando}</b> &nbsp;|&nbsp; Data: ${h.data} &nbsp;|&nbsp; Responsável: ${h.responsavel || "—"}</p>
    <div class="row">
      <div class="kpi"><div class="v">${h.producao_planejada || 0}</div><div class="l">Planejado</div></div>
      <div class="kpi"><div class="v">${h.producao_realizada || 0}</div><div class="l">Realizado</div></div>
      <div class="kpi"><div class="v">${Math.max(0, (h.producao_realizada || 0) - (h.producao_planejada || 0)) >= 0 ? "+" : ""}${(h.producao_realizada || 0) - (h.producao_planejada || 0)}</div><div class="l">Diferença</div></div>
    </div>
    ${h.testores_com_problema ? `<h2>Testores com Problema</h2><p>${h.testores_com_problema}</p>` : ""}
    ${h.ocorrencias_criticas ? `<h2>Ocorrências Críticas</h2><p>${h.ocorrencias_criticas}</p>` : ""}
    ${h.acoes_em_andamento ? `<h2>Ações em Andamento</h2><p>${h.acoes_em_andamento}</p>` : ""}
    ${h.alertas_proximo_turno ? `<h2>⚠ Alertas para o Próximo Turno</h2><p class="alert">${h.alertas_proximo_turno}</p>` : ""}
    <script>window.onload=function(){window.print()}<\/script></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })); a.target = "_blank"; a.click();
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-primary" /> Passagem de Turno</h1>
          <p className="text-xs text-muted-foreground">{handoffs.length} passagens registradas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Nova Passagem</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Passagem de Turno</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Turno Saindo *</Label>
                  <Select value={form.turno_saindo} onValueChange={v => u("turno_saindo", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primeiro">1º Turno</SelectItem>
                      <SelectItem value="segundo">2º Turno</SelectItem>
                      <SelectItem value="terceiro">3º Turno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Turno Entrando *</Label>
                  <Select value={form.turno_entrando} onValueChange={v => u("turno_entrando", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primeiro">1º Turno</SelectItem>
                      <SelectItem value="segundo">2º Turno</SelectItem>
                      <SelectItem value="terceiro">3º Turno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Input value={form.responsavel} onChange={e => u("responsavel", e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Planejado</Label><Input type="number" value={form.producao_planejada} onChange={e => u("producao_planejada", e.target.value)} placeholder="0" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Realizado</Label><Input type="number" value={form.producao_realizada} onChange={e => u("producao_realizada", e.target.value)} placeholder="0" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Testores com problema</Label><Textarea value={form.testores_com_problema} onChange={e => u("testores_com_problema", e.target.value)} rows={2} placeholder="Ex: Testor 3 parado por calibração" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Ocorrências críticas</Label><Textarea value={form.ocorrencias_criticas} onChange={e => u("ocorrencias_criticas", e.target.value)} rows={2} placeholder="Descreva ocorrências importantes" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Ações em andamento</Label><Textarea value={form.acoes_em_andamento} onChange={e => u("acoes_em_andamento", e.target.value)} rows={2} placeholder="O que está sendo feito" /></div>
              <div className="space-y-1.5"><Label className="text-xs">⚠ Alertas para o próximo turno</Label><Textarea value={form.alertas_proximo_turno} onChange={e => u("alertas_proximo_turno", e.target.value)} rows={2} placeholder="O que o próximo turno precisa saber" /></div>
              <Button type="submit" size="lg" className="w-full" disabled={createMut.isPending}>Registrar Passagem</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}</div>
        ) : handoffs.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowRightLeft className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma passagem registrada ainda.</p>
          </CardContent></Card>
        ) : handoffs.map(h => {
          const diff = (h.producao_realizada || 0) - (h.producao_planejada || 0);
          return (
            <Card key={h.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold">
                    {turnoLabels[h.turno_saindo] || h.turno_saindo} → {turnoLabels[h.turno_entrando] || h.turno_entrando}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{h.data}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handlePrint(h)}><Printer className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                {h.responsavel && <p className="text-xs text-muted-foreground">Responsável: {h.responsavel}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-black text-foreground">{h.producao_planejada || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Planejado</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-black text-foreground">{h.producao_realizada || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Realizado</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${diff >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    <p className={`text-lg font-black ${diff >= 0 ? "text-green-400" : "text-red-400"}`}>{diff >= 0 ? "+" : ""}{diff}</p>
                    <p className="text-[10px] text-muted-foreground">Diferença</p>
                  </div>
                </div>
                {h.testores_com_problema && <div className="text-xs"><span className="text-muted-foreground font-medium">Testores: </span>{h.testores_com_problema}</div>}
                {h.ocorrencias_criticas && <div className="text-xs text-orange-400">⚠ {h.ocorrencias_criticas}</div>}
                {h.alertas_proximo_turno && <div className="text-xs font-medium text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2">🔔 {h.alertas_proximo_turno}</div>}
                {h.acoes_em_andamento && <div className="text-xs text-muted-foreground">{h.acoes_em_andamento}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}