import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Clock, TrendingUp, Zap, Plus, Info, CheckCircle2 } from "lucide-react";

// Classificação do equipamento com base na disponibilidade
function getDisponibilidadeInfo(disp) {
  if (disp >= 90) return { label: "Ótimo", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", emoji: "✅" };
  if (disp >= 75) return { label: "Atenção", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", emoji: "⚠️" };
  return { label: "Crítico", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", emoji: "🔴" };
}

// Cálculo automático dos indicadores a partir dos eventos registrados
function calcularIndicadores(eventos) {
  if (!eventos || eventos.length === 0) return null;

  const totalFalhas = eventos.length;
  const totalTempoParado = eventos.reduce((sum, e) => sum + (Number(e.tempo_parado) || 0), 0);
  const totalTempoReparo = eventos.reduce((sum, e) => sum + (Number(e.tempo_reparo) || 0), 0);

  // Tempo de operação estimado: 8h por turno, soma das entradas distintas de datas
  const datasUnicas = [...new Set(eventos.map(e => e.data))].length;
  const tempoOperacaoTotal = datasUnicas * 480; // 480 min = 8h por dia

  const mtbf = totalFalhas > 0 ? Math.round((tempoOperacaoTotal - totalTempoParado) / totalFalhas) : 0;
  const mttr = totalFalhas > 0 ? Math.round(totalTempoReparo / totalFalhas) : 0;
  const disponibilidade = tempoOperacaoTotal > 0
    ? Math.round(((tempoOperacaoTotal - totalTempoParado) / tempoOperacaoTotal) * 100)
    : 100;

  return { mtbf, mttr, disponibilidade, totalFalhas, totalTempoParado };
}

const emptyForm = { testor_nome: "", data: new Date().toISOString().slice(0, 10), tempo_parado: "", tempo_reparo: "", motivo: "" };

export default function MtbfPanel() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filtroTestor, setFiltroTestor] = useState("todos");
  const qc = useQueryClient();

  const { data: testores = [] } = useQuery({
    queryKey: ["testores"],
    queryFn: () => base44.entities.Testor.list("nome"),
  });

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["mtbf-eventos"],
    queryFn: () => base44.entities.MtbfEvent.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.MtbfEvent.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mtbf-eventos"] }); setOpen(false); setForm(emptyForm); },
  });

  // Agrupa eventos por testor
  const testoresNomes = [...new Set(eventos.map(e => e.testor_nome))].filter(Boolean);
  const eventosFiltrados = filtroTestor === "todos" ? eventos : eventos.filter(e => e.testor_nome === filtroTestor);

  // Calcular por testor para o ranking
  const rankingTestores = testoresNomes.map(nome => {
    const evs = eventos.filter(e => e.testor_nome === nome);
    const ind = calcularIndicadores(evs);
    return { nome, ...ind, falhas: evs.length };
  }).sort((a, b) => (a.disponibilidade || 100) - (b.disponibilidade || 100));

  const indicadoresFiltrado = calcularIndicadores(eventosFiltrados);

  return (
    <div className="space-y-5">

      {/* Header com botão de registrar */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> MTBF / MTTR — Análise de Falhas
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registre cada parada e o app calcula tudo automaticamente.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 shrink-0">
              <Plus className="w-4 h-4" /> Registrar Parada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>📋 Registrar Parada</DialogTitle>
              <p className="text-xs text-muted-foreground">Preencha apenas o essencial. Os cálculos são automáticos.</p>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate({ ...form, tempo_parado: Number(form.tempo_parado), tempo_reparo: Number(form.tempo_reparo) }); }} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Qual testor parou? *</Label>
                <Select value={form.testor_nome} onValueChange={v => setForm({ ...form, testor_nome: v })} required>
                  <SelectTrigger><SelectValue placeholder="Selecione o testor" /></SelectTrigger>
                  <SelectContent>
                    {testores.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Data da parada *</Label>
                <Input type="date" required value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">⏱ Ficou parado (min) *</Label>
                  <Input type="number" required min="0" placeholder="Ex: 45" value={form.tempo_parado} onChange={e => setForm({ ...form, tempo_parado: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground">Tempo total que ficou parado</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">🔧 Reparo durou (min) *</Label>
                  <Input type="number" required min="0" placeholder="Ex: 30" value={form.tempo_reparo} onChange={e => setForm({ ...form, tempo_reparo: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground">Tempo para consertar</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">O que aconteceu? (opcional)</Label>
                <Input placeholder="Ex: Sensor travou, cabo solto..." value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={createMut.isPending}>
                {createMut.isPending ? "Salvando..." : "✅ Salvar Parada"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sem dados ainda */}
      {!isLoading && eventos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="text-4xl">📊</div>
            <p className="font-semibold text-foreground">Nenhuma parada registrada ainda</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Clique em "Registrar Parada" sempre que um testor parar. O app calcula MTBF, MTTR e disponibilidade automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {eventos.length > 0 && (
        <>
          {/* Filtro por testor */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFiltroTestor("todos")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${filtroTestor === "todos" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>
              Todos
            </button>
            {testoresNomes.map(n => (
              <button key={n} onClick={() => setFiltroTestor(n)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${filtroTestor === n ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>
                {n}
              </button>
            ))}
          </div>

          {/* KPI Cards principais */}
          {indicadoresFiltrado && (
            <div className="grid grid-cols-3 gap-3">
              {/* MTBF */}
              <Card className="border-border">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="text-2xl">⏳</div>
                  <p className="text-2xl font-black text-primary">{indicadoresFiltrado.mtbf}</p>
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">min entre falhas</p>
                  <p className="text-[9px] text-muted-foreground">MTBF — quanto tempo funciona sem parar</p>
                  <div className="mt-1 pt-1 border-t border-border">
                    <p className="text-[10px] text-muted-foreground">
                      {indicadoresFiltrado.mtbf >= 120 ? "✅ Bom" : indicadoresFiltrado.mtbf >= 60 ? "⚠️ Atenção" : "🔴 Crítico"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* MTTR */}
              <Card className="border-border">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="text-2xl">🔧</div>
                  <p className="text-2xl font-black text-orange-400">{indicadoresFiltrado.mttr}</p>
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">min p/ consertar</p>
                  <p className="text-[9px] text-muted-foreground">MTTR — tempo médio de reparo</p>
                  <div className="mt-1 pt-1 border-t border-border">
                    <p className="text-[10px] text-muted-foreground">
                      {indicadoresFiltrado.mttr <= 30 ? "✅ Bom" : indicadoresFiltrado.mttr <= 60 ? "⚠️ Atenção" : "🔴 Lento"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Disponibilidade */}
              <Card className={`border ${getDisponibilidadeInfo(indicadoresFiltrado.disponibilidade).bg}`}>
                <CardContent className="p-4 text-center space-y-1">
                  <div className="text-2xl">{getDisponibilidadeInfo(indicadoresFiltrado.disponibilidade).emoji}</div>
                  <p className={`text-2xl font-black ${getDisponibilidadeInfo(indicadoresFiltrado.disponibilidade).color}`}>
                    {indicadoresFiltrado.disponibilidade}%
                  </p>
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">disponibilidade</p>
                  <p className="text-[9px] text-muted-foreground">Tempo que ficou produzindo</p>
                  <div className="mt-1 pt-1 border-t border-border">
                    <p className={`text-[10px] font-semibold ${getDisponibilidadeInfo(indicadoresFiltrado.disponibilidade).color}`}>
                      {getDisponibilidadeInfo(indicadoresFiltrado.disponibilidade).label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resumo rápido */}
          {indicadoresFiltrado && (
            <Card className="bg-muted/20 border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">O que isso significa?</p>
                    <p className="text-xs text-muted-foreground">
                      {filtroTestor === "todos" ? "Os testores registrados pararam" : `${filtroTestor} parou`}{" "}
                      <span className="text-foreground font-semibold">{indicadoresFiltrado.totalFalhas}x</span>,
                      ficando parado por <span className="text-foreground font-semibold">{indicadoresFiltrado.totalTempoParado} min</span> no total.
                      {indicadoresFiltrado.mttr > 60 && " ⚠️ O tempo de reparo está alto — vale investigar a causa raiz."}
                      {indicadoresFiltrado.disponibilidade < 75 && " 🔴 Disponibilidade crítica — prioridade de ação imediata."}
                      {indicadoresFiltrado.disponibilidade >= 90 && " ✅ Equipamento com boa disponibilidade."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ranking de testores — onde agir primeiro */}
          {filtroTestor === "todos" && rankingTestores.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> Onde agir primeiro
              </h3>
              <p className="text-xs text-muted-foreground -mt-1">Testores ordenados do mais crítico ao mais estável.</p>
              {rankingTestores.map((t, i) => {
                const info = getDisponibilidadeInfo(t.disponibilidade || 100);
                return (
                  <Card key={t.nome} className={`border ${info.bg}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-muted-foreground w-6">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm">{t.nome}</p>
                            <Badge className={`text-[10px] border ${info.bg} ${info.color}`}>{info.emoji} {info.label}</Badge>
                          </div>
                          <div className="flex gap-4 mt-1 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">⏳ MTBF: <span className="text-foreground font-semibold">{t.mtbf} min</span></span>
                            <span className="text-[11px] text-muted-foreground">🔧 MTTR: <span className="text-foreground font-semibold">{t.mttr} min</span></span>
                            <span className="text-[11px] text-muted-foreground">🔴 Falhas: <span className="text-foreground font-semibold">{t.totalFalhas}</span></span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xl font-black ${info.color}`}>{t.disponibilidade}%</p>
                          <p className="text-[9px] text-muted-foreground">disponível</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Histórico de eventos */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold">📋 Histórico de Paradas</h3>
            {eventosFiltrados.slice(0, 10).map(ev => (
              <Card key={ev.id} className="border-border">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{ev.testor_nome}</p>
                        <span className="text-[10px] text-muted-foreground">{ev.data}</span>
                      </div>
                      {ev.motivo && <p className="text-xs text-muted-foreground mt-0.5">{ev.motivo}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-xs"><span className="text-muted-foreground">Parado:</span> <span className="font-semibold">{ev.tempo_parado} min</span></p>
                      <p className="text-xs"><span className="text-muted-foreground">Reparo:</span> <span className="font-semibold text-orange-400">{ev.tempo_reparo} min</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}