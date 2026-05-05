import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, KeyRound, Check, X } from "lucide-react";

const statusConfig = {
  pendente: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  aprovada: "bg-green-500/10 text-green-400 border-green-500/30",
  rejeitada: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function DailyPassword() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ solicitante: "", motivo: "" });
  const qc = useQueryClient();

  const { data: passwords = [], isLoading } = useQuery({
    queryKey: ["passwords"],
    queryFn: () => base44.entities.DailyPassword.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: async (d) => {
      const user = await base44.auth.me();
      return base44.entities.DailyPassword.create({
        ...d,
        solicitante_email: user.email,
        data: new Date().toISOString().split("T")[0],
        status: "pendente",
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["passwords"] }); setOpen(false); setForm({ solicitante: "", motivo: "" }); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, status }) => {
      const user = await base44.auth.me();
      return base44.entities.DailyPassword.update(id, { status, aprovador: user.full_name || user.email });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["passwords"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Senha Diária</h1>
          <p className="text-sm text-muted-foreground">Solicite ou aprove senhas diárias de acesso</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Solicitar Senha</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Solicitar Senha Diária</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input required value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></div>
              <div className="space-y-2"><Label>Motivo</Label><Textarea required value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Descreva o motivo da solicitação" /></div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Solicitar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : passwords.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <KeyRound className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma solicitação.</p>
            </CardContent>
          </Card>
        ) : (
          passwords.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{p.solicitante}</p>
                    <p className="text-xs text-muted-foreground">{p.motivo}</p>
                    <p className="text-xs text-muted-foreground">Data: {p.data}</p>
                    {p.aprovador && <p className="text-xs text-muted-foreground">Aprovador: {p.aprovador}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-[10px] border ${statusConfig[p.status]}`}>{p.status}</Badge>
                    {p.status === "pendente" && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-400 hover:bg-green-500/10" onClick={() => updateMut.mutate({ id: p.id, status: "aprovada" })}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10" onClick={() => updateMut.mutate({ id: p.id, status: "rejeitada" })}>
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