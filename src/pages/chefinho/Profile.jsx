import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { User, Mail, Phone, Users, Clock, Shield, Pencil, Save } from "lucide-react";
import { inputCls, BtnCancel } from "@/components/chefinho/FormDialog";

const FUNC = { lider:"Líder", monitor:"Monitor", supervisor:"Supervisor" };
const TURNO = { turno1:"1º Turno", turno2:"2º Turno", turno3:"3º Turno" };

export default function Profile() {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const { data: user } = useQuery({ queryKey: ["chef-me-profile"], queryFn: () => base44.auth.me() });
  const { data: profiles = [], refetch } = useQuery({
    queryKey: ["chef-profile", user?.email],
    queryFn: () => user ? base44.entities.ChefProfile.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });
  const profile = profiles[0];

  useEffect(() => { if (profile) setForm({ ...profile }); }, [profile]);

  const save = async () => {
    setSaving(true);
    try {
      if (profile) await base44.entities.ChefProfile.update(profile.id, form);
      else await base44.entities.ChefProfile.create({ ...form, user_email: user.email, full_name: user.full_name });
      refetch();
      setEditing(false);
    } finally { setSaving(false); }
  };

  if (!user) return <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><User className="w-5 h-5 text-primary" />Perfil</h1>
          <p className="text-[13px] text-muted-foreground">Seus dados no Chefinho GLSI</p></div>
        {profile && !editing && <button onClick={()=>setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm text-muted-foreground hover:bg-muted"><Pencil className="w-3.5 h-3.5" /> Editar</button>}
      </div>

      <div className="panel p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold uppercase">{(user.full_name || user.email || "U").slice(0,1)}</div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground truncate">{user.full_name || "—"}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{user.email}</p>
          </div>
        </div>

        {!profile ? (
          <div className="text-center py-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">Perfil ainda não preenchido.</p>
            <button onClick={()=>{ setForm({ funcao:"lider", telefone:"", equipe:"", celula:"", turno:"turno1", perfil_completo:false, user_email:user.email, full_name:user.full_name }); setEditing(true); }}
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Completar perfil</button>
          </div>
        ) : !editing ? (
          <div className="grid sm:grid-cols-2 gap-4 border-t border-border pt-5">
            <Info icon={Shield} label="Função" value={FUNC[profile.funcao]||profile.funcao} />
            <Info icon={Clock} label="Turno" value={TURNO[profile.turno]||profile.turno} />
            <Info icon={Users} label="Equipe" value={profile.equipe} />
            <Info icon={User} label="Célula" value={profile.celula} />
            <Info icon={Phone} label="Telefone" value={profile.telefone} />
            <Info icon={User} label="Perfil completo" value={profile.perfil_completo ? "Sim" : "Não"} />
          </div>
        ) : form && (
          <div className="border-t border-border pt-5 space-y-3">
            <label className="block"><span className="block text-[11px] font-medium text-muted-foreground mb-1">Função *</span>
              <select className={inputCls} value={form.funcao} onChange={e=>setForm({...form,funcao:e.target.value})}>{Object.entries(FUNC).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
            <label className="block"><span className="block text-[11px] font-medium text-muted-foreground mb-1">Telefone *</span>
              <input className={inputCls} value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})} placeholder="5511999999999" /></label>
            <label className="block"><span className="block text-[11px] font-medium text-muted-foreground mb-1">Equipe *</span>
              <input className={inputCls} value={form.equipe} onChange={e=>setForm({...form,equipe:e.target.value})} /></label>
            <label className="block"><span className="block text-[11px] font-medium text-muted-foreground mb-1">Célula *</span>
              <input className={inputCls} value={form.celula} onChange={e=>setForm({...form,celula:e.target.value})} /></label>
            <label className="block"><span className="block text-[11px] font-medium text-muted-foreground mb-1">Turno *</span>
              <select className={inputCls} value={form.turno} onChange={e=>setForm({...form,turno:e.target.value})}>{Object.entries(TURNO).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
            <div className="flex gap-2 pt-2">
              <BtnCancel onClick={()=>{ setEditing(false); setForm(profile); }} />
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"><Save className="w-4 h-4" />{saving?"Salvando...":"Salvar"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-sm text-foreground font-medium">{value || "—"}</p></div>
    </div>
  );
}