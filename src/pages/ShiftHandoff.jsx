import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, ArrowRightLeft, Printer, RefreshCw, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { format } from "date-fns";

const turnoLabels = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };
const TURNOS_CONFIG = {
  primeiro: { horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"], proximo: "segundo" },
  segundo:  { horas: ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","00:00"], proximo: "terceiro" },
  terceiro: { horas: ["01:00","02:00","03:00","04:00","05:00"], proximo: "primeiro" },
};

const emptyForm = {
  turno_saindo: "", turno_entrando: "", responsavel: "",
  producao_realizada: "", producao_planejada: "120",
  testores_com_problema: "", ocorrencias_criticas: "",
  acoes_em_andamento: "", alertas_proximo_turno: "",
};

export default function ShiftHandoff() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loadingAutoFill, setLoadingAutoFill] = useState(false);
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: handoffs = [], isLoading } = useQuery({
    queryKey: ["handoffs"],
    queryFn: () => base44.entities.ShiftHandoff.list("-created_date", 20),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ShiftHandoff.create({
      ...d,
      producao_realizada: Number(d.producao_realizada) || 0,
      producao_planejada: Number(d.producao_planejada) || 0,
      data: today,
    }),
    onSuccess: (saved, vars) => {
      qc.invalidateQueries({ queryKey: ["handoffs"] });
      setOpen(false);
      setForm(emptyForm);
      // Abre o PDF automaticamente ao encerrar o turno
      handlePrint({ ...vars, producao_realizada: Number(vars.producao_realizada) || 0, producao_planejada: Number(vars.producao_planejada) || 0, data: today });
    },
  });

  const u = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Auto-preenche dados de produção e ocorrências ao selecionar o turno saindo
  const autoFillFromTurno = async (turnoSaindo) => {
    if (!turnoSaindo) return;
    setLoadingAutoFill(true);
    try {
      const [prodRecords, occRecords, testorRecords] = await Promise.all([
        base44.entities.ProductionControl.filter({ data: today, turno: turnoSaindo }),
        base44.entities.Occurrence.filter({ turno: turnoSaindo }),
        base44.entities.Testor.list(),
      ]);

      // Produção realizada = soma de todos os registros do turno
      const producaoRealizada = prodRecords.reduce((acc, r) => acc + (r.carros_produzidos || 0), 0);

      // Ocorrências do dia (abertas + em andamento)
      const occHoje = occRecords.filter(o => {
        const dataOc = o.created_date ? o.created_date.slice(0, 10) : "";
        return dataOc === today || !dataOc;
      });
      const criticas = occHoje.filter(o => o.gravidade === "critica" || o.gravidade === "alta");
      const ocorrenciasTexto = criticas.length > 0
        ? criticas.map(o => `${o.tipo?.replace(/_/g, " ")} — ${o.testor || "Geral"}: ${o.descricao || ""}`).join("\n")
        : "";

      // Testores com problema
      const testoresProblema = testorRecords.filter(t => t.status === "parado" || t.status === "manutencao" || t.status === "atencao");
      const testoresTexto = testoresProblema.length > 0
        ? testoresProblema.map(t => `${t.nome} (${t.status})`).join(", ")
        : "";

      const proximo = TURNOS_CONFIG[turnoSaindo]?.proximo || "";

      setForm(prev => ({
        ...prev,
        turno_saindo: turnoSaindo,
        turno_entrando: proximo,
        producao_realizada: String(producaoRealizada),
        ocorrencias_criticas: ocorrenciasTexto,
        testores_com_problema: testoresTexto,
      }));
    } finally {
      setLoadingAutoFill(false);
    }
  };

  const handleExportCsv = () => {
    exportCsv("passagens_turno_zp7",
      ["Data", "Turno Saindo", "Turno Entrando", "Responsável", "Planejado", "Realizado", "Diferença", "Testores Problema", "Ocorrências", "Ações", "Alertas"],
      handoffs.map(h => [h.data || "", turnoLabels[h.turno_saindo] || h.turno_saindo, turnoLabels[h.turno_entrando] || h.turno_entrando, h.responsavel || "", h.producao_planejada || 0, h.producao_realizada || 0, (h.producao_realizada || 0) - (h.producao_planejada || 0), h.testores_com_problema || "", h.ocorrencias_criticas || "", h.acoes_em_andamento || "", h.alertas_proximo_turno || ""])
    );
  };

  const handlePrint = (h) => {
    const diff = (h.producao_realizada || 0) - (h.producao_planejada || 0);
    const pct = h.producao_planejada > 0 ? Math.round((h.producao_realizada / h.producao_planejada) * 100) : 0;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>@page{size:A4;margin:15mm}body{font-family:Arial;font-size:10px;color:#111}
    h1{font-size:18px;margin:0 0 2px;color:#1a3a6e;letter-spacing:1px}
    .sub{font-size:9px;color:#666;margin:0 0 12px;border-bottom:2px solid #1a3a6e;padding-bottom:6px}
    h2{font-size:11px;margin:12px 0 4px;color:#333;border-bottom:1px solid #ddd;padding-bottom:2px;text-transform:uppercase;letter-spacing:0.5px}
    .row{display:flex;gap:16px;margin:8px 0}
    .kpi{flex:1;background:#f0f4ff;border:1px solid #c5d0f0;border-radius:6px;padding:10px 14px;text-align:center}
    .kpi .v{font-size:26px;font-weight:900;color:#1d4ed8;line-height:1}
    .kpi .l{font-size:8px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px}
    .kpi.pos .v{color:#16a34a}.kpi.neg .v{color:#dc2626}
    p{font-size:10px;margin:4px 0;line-height:1.5}
    .alert-box{background:#fffbeb;border:1px solid #f59e0b;border-radius:4px;padding:8px 12px;margin:4px 0}
    .footer{margin-top:24px;border-top:1px solid #ddd;padding-top:8px;font-size:8px;color:#999;display:flex;justify-content:space-between}
    </style></head>
    <body>
    <h1>PASSAGEM DE TURNO — ZP7</h1>
    <p class="sub"><b>${turnoLabels[h.turno_saindo] || h.turno_saindo} → ${turnoLabels[h.turno_entrando] || h.turno_entrando}</b> &nbsp;|&nbsp; Data: ${h.data || today} &nbsp;|&nbsp; Responsável: ${h.responsavel || "—"} &nbsp;|&nbsp; Gerado: ${new Date().toLocaleString("pt-BR")}</p>

    <h2>Produção do Turno</h2>
    <div class="row">
      <div class="kpi"><div class="v">${h.producao_planejada || 0}</div><div class="l">Planejado</div></div>
      <div class="kpi"><div class="v">${h.producao_realizada || 0}</div><div class="l">Realizado</div></div>
      <div class="kpi ${diff >= 0 ? "pos" : "neg"}"><div class="v">${diff >= 0 ? "+" : ""}${diff}</div><div class="l">Diferença</div></div>
      <div class="kpi"><div class="v">${pct}%</div><div class="l">Eficiência</div></div>
    </div>

    ${h.testores_com_problema ? `<h2>Testores com Problema</h2><p>${h.testores_com_problema.replace(/\n/g, "<br>")}</p>` : ""}
    ${h.ocorrencias_criticas ? `<h2>Ocorrências Críticas</h2><p>${h.ocorrencias_criticas.replace(/\n/g, "<br>")}</p>` : ""}
    ${h.acoes_em_andamento ? `<h2>Ações em Andamento</h2><p>${h.acoes_em_andamento.replace(/\n/g, "<br>")}</p>` : ""}
    ${h.alertas_proximo_turno ? `<h2>⚠ Alertas para o Próximo Turno</h2><div class="alert-box"><p style="font-weight:bold;color:#b45309">${h.alertas_proximo_turno.replace(/\n/g, "<br>")}</p></div>` : ""}

    <div class="footer">
      <span>ZP7 — Volkswagen Taubaté</span>
      <span>Assinatura: ___________________________</span>
    </div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })); a.target = "_blank"; a.click();
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-primary" /> Passagem de Turno</h1>
          <p className="text-xs text-muted-foreground">{handoffs.length} passagens registradas · PDF gerado automaticamente ao encerrar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5"><FileSpreadsheet className="w-4 h-4" /> CSV</Button>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Nova Passagem</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Encerrar Turno e Registrar Passagem</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">

              {/* Seleção de turno — dispara auto-preenchimento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Turno Saindo *</Label>
                  <Select value={form.turno_saindo} onValueChange={v => autoFillFromTurno(v)} required>
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
                  <Select value={form.turno_entrando} onValueChange={v => u("turno_entrando", v)} required>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primeiro">1º Turno</SelectItem>
                      <SelectItem value="segundo">2º Turno</SelectItem>
                      <SelectItem value="terceiro">3º Turno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loadingAutoFill && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Buscando dados de produção e ocorrências...
                </div>
              )}

              {form.turno_saindo && !loadingAutoFill && (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Dados preenchidos automaticamente — revise antes de salvar
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Input value={form.responsavel} onChange={e => u("responsavel", e.target.value)} placeholder="Seu nome" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Planejado</Label>
                  <Input type="number" value={form.producao_planejada} onChange={e => u("producao_planejada", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">Realizado <span className="text-primary">(auto)</span></Label>
                  <Input type="number" value={form.producao_realizada} onChange={e => u("producao_realizada", e.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">Testores com problema <span className="text-primary">(auto)</span></Label>
                <Textarea value={form.testores_com_problema} onChange={e => u("testores_com_problema", e.target.value)} rows={2} placeholder="Ex: Testor 3 parado por calibração" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">Ocorrências críticas <span className="text-primary">(auto)</span></Label>
                <Textarea value={form.ocorrencias_criticas} onChange={e => u("ocorrencias_criticas", e.target.value)} rows={3} placeholder="Descreva ocorrências importantes" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ações em andamento</Label>
                <Textarea value={form.acoes_em_andamento} onChange={e => u("acoes_em_andamento", e.target.value)} rows={2} placeholder="O que está sendo feito" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">⚠ Alertas para o próximo turno</Label>
                <Textarea value={form.alertas_proximo_turno} onChange={e => u("alertas_proximo_turno", e.target.value)} rows={2} placeholder="O que o próximo turno precisa saber" />
              </div>

              <Button type="submit" size="lg" className="w-full bg-primary" disabled={createMut.isPending}>
                <Printer className="w-4 h-4 mr-2" />
                {createMut.isPending ? "Salvando..." : "Encerrar Turno e Gerar Relatório PDF"}
              </Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
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