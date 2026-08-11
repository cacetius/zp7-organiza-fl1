import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Shield, Phone, Users, Clock, User, Check } from "lucide-react";
import { inputCls } from "@/components/chefinho/FormDialog";

const FUNC = { lider:"Líder", monitor:"Monitor", supervisor:"Supervisor" };
const TURNO = { turno1:"1º Turno", turno2:"2º Turno", turno3:"3º Turno" };

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ funcao:"lider", telefone:"", equipe:"", celula:"", turno:"turno1", user_email:"", full_name:"", perfil_completo:false });

  const finish = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const payload = { ...form, user_email: user.email, full_name: user.full_name, perfil_completo: true };
      await base44.entities.ChefProfile.create(payload);
      navigate("/chefinho");
    } catch (e) { alert("Erro ao salvar perfil."); } finally { setSaving(false); }
  };

  const steps = ["Função", "Contato", "Equipe", "Confirmação"];
  const valid = [form.funcao, form.telefone.length >= 8, form.equipe && form.celula, true];
  const canNext = valid[step];

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="text-center pt-4">
        <h1 className="text-lg font-semibold">Complete seu perfil</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Precisamos de alguns dados para o Chefinho</p>
      </div>

      <div className="flex items-center justify-between px-2">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ${i<=step?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground"}`}>{i<step?<Check className="w-3.5 h-3.5"/>:i+1}</div>
            {i<steps.length-1 && <div className={`flex-1 h-0.5 mx-1 ${i<step?"bg-primary":"bg-muted"}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="panel p-5">
        {step === 0 && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground"><Shield className="w-4 h-4 text-primary"/>Qual sua função?</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(FUNC).map(([k,v]) => (
                <button key={k} onClick={()=>setForm({...form,funcao:k})} className={`p-3 rounded-lg border text-sm font-medium ${form.funcao===k?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:bg-muted"}`}>{v}</button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground"><Phone className="w-4 h-4 text-primary"/>Telefone (WhatsApp)</label>
            <input className={inputCls} value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value.replace(/\D/g,"")})} placeholder="5511999999999" />
            <p className="text-[11px] text-muted-foreground">Usado para receber notificações críticas.</p>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground"><Users className="w-4 h-4 text-primary inline mr-1.5"/>Equipe</label>
            <input className={inputCls} value={form.equipe} onChange={e=>setForm({...form,equipe:e.target.value})} />
            <label className="block text-sm font-medium text-foreground"><User className="w-4 h-4 text-primary inline mr-1.5"/>Célula</label>
            <input className={inputCls} value={form.celula} onChange={e=>setForm({...form,celula:e.target.value})} />
            <label className="block text-sm font-medium text-foreground"><Clock className="w-4 h-4 text-primary inline mr-1.5"/>Turno</label>
            <select className={inputCls} value={form.turno} onChange={e=>setForm({...form,turno:e.target.value})}>{Object.entries(TURNO).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-2 text-sm">
            <p className="text-foreground font-medium">Confirme seus dados:</p>
            <Row label="Função" value={FUNC[form.funcao]} />
            <Row label="Telefone" value={form.telefone || "—"} />
            <Row label="Equipe" value={form.equipe || "—"} />
            <Row label="Célula" value={form.celula || "—"} />
            <Row label="Turno" value={TURNO[form.turno]} />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {step > 0 && <button onClick={()=>setStep(step-1)} className="flex-1 py-2.5 rounded border border-border text-sm text-muted-foreground hover:bg-muted">Voltar</button>}
        {step < 3 ? (
          <button onClick={()=>canNext && setStep(step+1)} disabled={!canNext} className="flex-1 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">Continuar</button>
        ) : (
          <button onClick={finish} disabled={saving} className="flex-1 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving?"Salvando...":"Concluir"}</button>
        )}
      </div>
    </div>
  );
}

function Row({label, value}) {
  return <div className="flex justify-between py-1.5 border-b border-border/60"><span className="text-muted-foreground">{label}</span><span className="text-foreground font-medium text-right">{value}</span></div>;
}