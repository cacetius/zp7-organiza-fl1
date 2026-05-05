import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KeyRound, Check, X, ShieldCheck, MapPin, Clock, Users, Lock, Unlock } from "lucide-react";

const statusConfig = {
  pendente: { label: "Aguardando Aprovação", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  aprovada: { label: "Acesso Liberado", cls: "bg-green-500/10 text-green-400 border-green-500/30" },
  rejeitada: { label: "Acesso Negado", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const turnoLabel = {
  primeiro: "1º Turno (05h–13h)",
  segundo: "2º Turno (13h–21h)",
  terceiro: "3º Turno (21h–05h)",
};

// Generates a deterministic daily password based on date + turno
function gerarSenhaDiaria(date, turno) {
  const base = `ZP7-${date}-${turno}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  const num = Math.abs(hash) % 900000 + 100000;
  return String(num);
}

function getTurnoAtual() {
  const h = new Date().getHours();
  if (h >= 5 && h < 13) return "primeiro";
  if (h >= 13 && h < 21) return "segundo";
  return "terceiro";
}

export default function DailyPassword() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ solicitante: "", motivo: "", turno: getTurnoAtual() });
  const [currentUser, setCurrentUser] = useState(null);
  const [showSenha, setShowSenha] = useState(false);
  const qc = useQueryClient();

  const hoje = new Date().toISOString().split("T")[0];
  const turnoAtual = getTurnoAtual();
  const senhaDoDia = gerarSenhaDiaria(hoje, turnoAtual);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: passwords = [], isLoading } = useQuery({
    queryKey: ["passwords"],
    queryFn: () => base44.entities.DailyPassword.list("-created_date", 50),
  });

  // Requests for today only
  const hoje_requests = passwords.filter((p) => p.data === hoje);
  const pendentes = hoje_requests.filter((p) => p.status === "pendente");
  const aprovadas = hoje_requests.filter((p) => p.status === "aprovada");

  const createMut = useMutation({
    mutationFn: async (d) => {
      const user = await base44.auth.me();
      return base44.entities.DailyPassword.create({
        ...d,
        solicitante_email: user.email,
        data: hoje,
        status: "pendente",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passwords"] });
      setOpen(false);
      setForm({ solicitante: "", motivo: "", turno: getTurnoAtual() });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, status }) => {
      const user = await base44.auth.me();
      const req = passwords.find(p => p.id === id);
      await base44.entities.DailyPassword.update(id, {
        status,
        aprovador: user.full_name || user.email,
      });
      // Email automático ao solicitante
      if (req?.solicitante_email) {
        const label = status === "aprovada" ? "✅ APROVADA" : "❌ REJEITADA";
        base44.integrations.Core.SendEmail({
          to: req.solicitante_email,
          subject: `[ZP7] Sua solicitação de acesso foi ${status === "aprovada" ? "aprovada" : "rejeitada"}`,
          body: `Olá ${req.solicitante},\n\nSua solicitação de acesso ao turno no ZP7 foi <b>${label}</b>.\n\n📋 Motivo informado: ${req.motivo}\n🕐 Turno: ${req.turno}\n👤 Aprovador: ${user.full_name || user.email}\n\n${status === "aprovada" ? "Você está autorizado a acessar a área ZP7 no turno solicitado. Apresente-se ao ponto de controle com sua identificação." : "Caso tenha dúvidas, entre em contato com seu líder de turno."}\n\n— ZP7 Organização | Volkswagen Taubaté`,
        }).catch(() => {});
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["passwords"] }),
  });

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-primary" />
          Senha Diária — Geofence ZP7
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle de acesso ao turno e liberação de passagem pelo geofence da área ZP7
        </p>
      </div>

      {/* Info de contexto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Turno Atual</p>
              <p className="text-sm font-semibold">{turnoLabel[turnoAtual]}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-yellow-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Aguardando Aprovação</p>
              <p className="text-2xl font-bold text-yellow-400">{pendentes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-green-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Acessos Liberados Hoje</p>
              <p className="text-2xl font-bold text-green-400">{aprovadas.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Senha do Dia — para líderes/supervisores */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Senha do Dia — Geofence ZP7
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Esta senha libera a passagem pelo ponto de controle do geofence. Válida apenas para {hoje} — {turnoLabel[turnoAtual]}.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className={`flex-1 rounded-xl border-2 border-primary/40 bg-background text-center py-4 cursor-pointer transition-all select-none ${showSenha ? "" : "blur-sm"}`}
              onClick={() => setShowSenha(!showSenha)}
            >
              <p className="text-4xl font-black tracking-[0.3em] text-primary">{senhaDoDia}</p>
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => setShowSenha(!showSenha)}
            >
              {showSenha ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
              {showSenha ? "Ocultar" : "Revelar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Clique para {showSenha ? "ocultar" : "revelar"} · Compartilhe apenas com funcionários autorizados
          </p>
        </CardContent>
      </Card>

      {/* Solicitações do dia */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Solicitações de Acesso — Hoje</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <KeyRound className="w-4 h-4 mr-2" />
              Solicitar Acesso ao Turno
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Acesso ao Turno</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Preencha os dados para solicitar a liberação de acesso ao turno via geofence ZP7.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }}
              className="space-y-4 mt-2"
            >
              <div className="space-y-2">
                <Label>Nome do Funcionário</Label>
                <Input
                  required
                  placeholder="Nome completo"
                  value={form.solicitante}
                  onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Turno Solicitado</Label>
                <Select value={form.turno} onValueChange={(v) => setForm({ ...form, turno: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeiro">1º Turno (05h–13h)</SelectItem>
                    <SelectItem value="segundo">2º Turno (13h–21h)</SelectItem>
                    <SelectItem value="terceiro">3º Turno (21h–05h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motivo / Justificativa</Label>
                <Textarea
                  required
                  placeholder="Ex.: Cobertura de ausência, horas extras autorizadas, acesso especial..."
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>
                {createMut.isPending ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de solicitações */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : hoje_requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <KeyRound className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma solicitação para hoje.</p>
            </CardContent>
          </Card>
        ) : (
          hoje_requests.map((p) => (
            <Card key={p.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{p.solicitante}</p>
                      <Badge variant="outline" className="text-[10px]">{turnoLabel[p.turno]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.motivo}</p>
                    {p.aprovador && (
                      <p className="text-xs text-muted-foreground">
                        {p.status === "aprovada" ? "✅" : "❌"} {p.aprovador}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-[10px] border ${statusConfig[p.status]?.cls}`}>
                      {statusConfig[p.status]?.label}
                    </Badge>
                    {p.status === "pendente" && (
                      <div className="flex gap-1">
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-green-400 hover:bg-green-500/10"
                          onClick={() => updateMut.mutate({ id: p.id, status: "aprovada" })}
                          title="Aprovar acesso"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                          onClick={() => updateMut.mutate({ id: p.id, status: "rejeitada" })}
                          title="Negar acesso"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
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