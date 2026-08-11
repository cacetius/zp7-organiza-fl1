import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { PenTool, ArrowRight, Check, X, Camera, Save, ChevronRight } from "lucide-react";
import { inputCls, BtnCancel, BtnSave } from "@/components/chefinho/FormDialog";

export default function QuickAudit() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0); // 0 = escolher, 1 = executar, 2 = resumo
  const [selectedTpl, setSelectedTpl] = useState(null);
  const [areaId, setAreaId] = useState("");
  const [answers, setAnswers] = useState({}); // questionId -> {yes, comment, photo}
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery({ queryKey: ["chef-templates-qa"], queryFn: () => base44.entities.ChefAuditTemplate.filter({ status: "active" }) });
  const { data: areas = [] } = useQuery({ queryKey: ["chef-areas-qa"], queryFn: () => base44.entities.ChefArea.list() });

  const tpl = templates.find(t => t.id === selectedTpl);
  const questions = useMemo(() => {
    if (!tpl?.categories) return [];
    return tpl.categories.flatMap(c => (c.questions||[]).map(q => ({ ...q, categoryName: c.name })));
  }, [tpl]);

  const startAudit = () => { setAnswers({}); setStep(1); };

  const score = useMemo(() => {
    const answered = Object.values(answers).filter(a => a.yes !== null && a.yes !== undefined);
    if (!answered.length) return { ok: 0, total: questions.length, pct: 0 };
    const ok = answered.filter(a => a.yes).length;
    return { ok, total: questions.length, pct: Math.round((ok / questions.length) * 100) };
  }, [answers, questions]);

  const finish = async () => {
    setSaving(true);
    try {
      const answered = questions.map(q => ({ question_id: q.id, category_id: q.categoryId, answer: answers[q.id]?.yes ? "sim" : "não", score: answers[q.id]?.yes ? 1 : 0, comment: answers[q.id]?.comment || "", non_conformity: !answers[q.id]?.yes }));
      const payload = {
        template_id: tpl.id, template_name: tpl.name, area_id: areaId, status: "completed",
        result: score.pct >= (tpl.approval_threshold || 80) ? "approved" : "rejected",
        score: score.ok, max_score: questions.length, percentage: score.pct,
        answers: answered, scheduled_date: new Date().toISOString().slice(0,10), general_observations: "",
      };
      await base44.entities.ChefAudit.create(payload);
      // auto-create NCs for "não"
      const ncs = answered.filter(a => a.non_conformity);
      for (const a of ncs) {
        await base44.entities.ChefNonConformity.create({ audit_id: undefined, area_id: areaId, title: `NC (auditoria rápida) — ${questions.find(q=>q.id===a.question_id)?.text||""}`, description: a.comment || "Não conformidade de auditoria", severity: "medium", status: "open", source: "audit" });
      }
      qc.invalidateQueries([["chef-audits"],["chef-ncs"]].flat());
      setStep(2);
    } finally { setSaving(false); }
  };

  const reset = () => { setStep(0); setSelectedTpl(null); setAreaId(""); setAnswers({}); };

  return (
    <div className="space-y-4 max-w-2xl">
      <div><h1 className="text-lg font-semibold flex items-center gap-2"><PenTool className="w-5 h-5 text-primary" />Auditoria Rápida</h1>
        <p className="text-[13px] text-muted-foreground">Execute uma auditoria pelo checklist do template</p></div>

      {step === 0 && (
        <div className="panel p-5 space-y-4">
          <div>
            <p className="label-section mb-2">Selecione o template</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {templates.length===0 ? <p className="text-sm text-muted-foreground">Nenhum template ativo. Cadastre em Modelos.</p> :
              templates.map(t => (
                <button key={t.id} onClick={()=>setSelectedTpl(t.id)} className={`text-left p-3 rounded-lg border ${selectedTpl===t.id?"border-primary bg-primary/10":"border-border hover:bg-muted"}`}>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.methodology}{t.frequency?` · ${t.frequency}`:""} · {(t.categories||[]).reduce((s,c)=>s+(c.questions?.length||0),0)} questões</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label-section mb-2">Área auditada</p>
            <select value={areaId} onChange={e=>setAreaId(e.target.value)} className={inputCls}>
              <option value="">Selecione...</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button onClick={startAudit} disabled={!selectedTpl || !areaId} className="w-full py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">Iniciar <ArrowRight className="w-4 h-4" /></button>
        </div>
      )}

      {step === 1 && tpl && (
        <div className="panel">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div><p className="text-sm font-semibold text-foreground">{tpl.name}</p><p className="text-[11px] text-muted-foreground">{score.ok}/{questions.length} conformes · {score.pct}%</p></div>
            <div className="h-1.5 w-32 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${score.pct}%` }} /></div>
          </div>
          <div className="divide-y divide-border">
            {questions.map(q => {
              const a = answers[q.id] || { yes: null, comment: "" };
              return (
                <div key={q.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-foreground">{q.text}</p>
                  <p className="text-[11px] text-muted-foreground mb-2">{q.categoryName}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>setAnswers({...answers,[q.id]:{...a,yes:true}})} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium ${a.yes===true?"bg-emerald-500/15 text-emerald-600 border border-emerald-500/40":"border border-border text-muted-foreground hover:bg-muted"}`}><Check className="w-3.5 h-3.5"/> Sim</button>
                    <button onClick={()=>setAnswers({...answers,[q.id]:{...a,yes:false}})} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium ${a.yes===false?"bg-red-500/15 text-red-600 border border-red-500/40":"border border-border text-muted-foreground hover:bg-muted"}`}><X className="w-3.5 h-3.5"/> Não</button>
                  </div>
                  {a.yes === false && (
                    <input value={a.comment} onChange={e=>setAnswers({...answers,[q.id]:{...a,comment:e.target.value}})} placeholder="Comentário / evidência (abrirá NC)" className={`${inputCls} mt-2 text-[12px]`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 px-5 py-3 border-t border-border">
            <BtnCancel onClick={()=>setStep(0)} />
            <button onClick={finish} disabled={saving} className="flex-1 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"><Save className="w-4 h-4"/> {saving?"Salvando...":"Concluir auditoria"}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="panel p-8 text-center space-y-4">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${score.pct >= (tpl?.approval_threshold||80) ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}>
            {score.pct >= (tpl?.approval_threshold||80) ? <Check className="w-8 h-8" /> : <X className="w-8 h-8" />}
          </div>
          <div>
            <p className="text-lg font-semibold">{score.pct >= (tpl?.approval_threshold||80) ? "Auditoria aprovada" : "Auditoria reprovada"}</p>
            <p className="text-[13px] text-muted-foreground">{score.ok} de {questions.length} conformes · {score.pct}% · {Object.values(answers).filter(a=>a.yes===false).length} NCs geradas</p>
          </div>
          <button onClick={reset} className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 flex items-center gap-1.5 mx-auto">Nova auditoria <ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}