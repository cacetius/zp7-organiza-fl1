import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Gauge, AlertTriangle, Clock, Car, Activity } from "lucide-react";

const statusConfig = {
  rodando: { label: "Rodando", color: "bg-green-500/10 text-green-400 border-green-500/30", dot: "bg-green-400" },
  atencao: { label: "Atenção", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400" },
  parado: { label: "Parado", color: "bg-red-500/10 text-red-400 border-red-500/30", dot: "bg-red-400" },
  manutencao: { label: "Manutenção", color: "bg-orange-500/10 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
  bloqueado: { label: "Bloqueado", color: "bg-gray-500/10 text-gray-400 border-gray-500/30", dot: "bg-gray-400" },
};

function getRiskColor(score) {
  if (score <= 30) return "text-green-400";
  if (score <= 60) return "text-yellow-400";
  if (score <= 80) return "text-orange-400";
  return "text-red-400";
}

function getRiskLabel(score) {
  if (score <= 30) return "Baixo";
  if (score <= 60) return "Médio";
  if (score <= 80) return "Alto";
  return "Crítico";
}

export default function Testores() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", status: "rodando", tempo_medio_carro: "", carros_por_hora: "" });
  const qc = useQueryClient();

  const { data: testores = [], isLoading } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list(),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Testor.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["testores"] }); setOpen(false); setForm({ nome: "", status: "rodando", tempo_medio_carro: "", carros_por_hora: "" }); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Testor.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["testores"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controle dos Testores</h1>
          <p className="text-sm text-muted-foreground">Monitoramento em tempo real</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Testor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Testor</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate({ ...form, tempo_medio_carro: Number(form.tempo_medio_carro) || 0, carros_por_hora: Number(form.carros_por_hora) || 0 }); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome / Identificação</Label>
                <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Testor 1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tempo médio/carro (min)</Label>
                  <Input type="number" value={form.tempo_medio_carro} onChange={(e) => setForm({ ...form, tempo_medio_carro: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Carros/hora</Label>
                  <Input type="number" value={form.carros_por_hora} onChange={(e) => setForm({ ...form, carros_por_hora: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
            const cfg = statusConfig[t.status] || statusConfig.rodando;
            const risk = t.risco_score || 0;
            return (
              <Card key={t.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} animate-pulse`} />
                      {t.nome}
                    </CardTitle>
                    <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Falhas</span>
                      <span className="font-medium">{t.falhas_turno || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reprovações</span>
                      <span className="font-medium">{t.reprovacoes || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paradas</span>
                      <span className="font-medium">{t.paradas_curtas || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tempo parado</span>
                      <span className="font-medium">{t.tempo_total_parado || 0}min</span>
                    </div>
                  </div>

                  {t.ultima_manutencao && (
                    <p className="text-[10px] text-muted-foreground">
                      Última manutenção: {t.ultima_manutencao}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}