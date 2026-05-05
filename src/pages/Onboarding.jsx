import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";

export default function Onboarding({ onComplete }) {
  const [form, setForm] = useState({
    nome: "",
    matricula: "",
    funcao: "",
    area: "",
    turno: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.UserProfile.create({
      ...form,
      user_email: user.email,
    });
    onComplete();
    setSaving(false);
  };

  const update = (key, val) => setForm({ ...form, [key]: val });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border">
        <CardHeader className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center">
            <span className="text-primary-foreground font-black text-xl">ZP7</span>
          </div>
          <CardTitle className="text-2xl font-bold">ZP7 Organização</CardTitle>
          <p className="text-muted-foreground text-sm">
            Volkswagen Taubaté — Registro inicial
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                required
                placeholder="Seu nome"
                value={form.nome}
                onChange={(e) => update("nome", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input
                required
                placeholder="Número da matrícula"
                value={form.matricula}
                onChange={(e) => update("matricula", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={form.funcao} onValueChange={(v) => update("funcao", v)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione sua função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="lider">Líder</SelectItem>
                  <SelectItem value="monitor">Monitor</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Input
                placeholder="Ex: ZP7 - Linha 1"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select value={form.turno} onValueChange={(v) => update("turno", v)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione seu turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primeiro">Primeiro Turno</SelectItem>
                  <SelectItem value="segundo">Segundo Turno</SelectItem>
                  <SelectItem value="terceiro">Terceiro Turno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={saving || !form.funcao || !form.turno}>
              <UserPlus className="w-4 h-4 mr-2" />
              {saving ? "Registrando..." : "Registrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}