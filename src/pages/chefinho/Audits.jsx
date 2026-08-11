import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ClipboardCheck, Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

const STATUS = { planned: "Planejada", in_progress: "Em andamento", completed: "Concluída", cancelled: "Cancelada" };
const RESULT = { approved: "Aprovada", approved_with_restrictions: "Aprovada c/ restrições", rejected: "Reprovada", pending: "Pendente" };

export default function Audits() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { template_name: "", area_id: "", cell_id: "", team_id: "", status: "planned", result: "pending", scheduled_date: "", auditor_name: "", general_observations: "", score: 0, max_score: 100 };
  const [form, setForm] = useState(BLANK);

  const { data: templates = [] } = useQuery({ queryKey: ["chef-templates"], queryFn: () => base44.entities.ChefAuditTemplate.list() });
  const { data: audits = [] } = useQuery({ queryKey: ["chef-audits"], queryFn: () => base44.entities.ChefAudit.list("-scheduled_date") });

  const filtered = useMemo(() => audits.filter(a => {
    if (filter !== "all" && a.status !== filter) return false;
    if (!q) return true;
    return `${a.template_name} ${a.area_id} ${a.auditor_name}`.toLowerCase().includes(q.toLowerCase());
  }), [audits, q, filter]);

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (a) => { setForm({ ...BLANK, ...a }); setEditing(a.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };

  const save = async () => {
    setSaving(true);
    try {
      const tpl = templates.find(t => t.id === form.template_id);
      const payload = { ...form, template_name: tpl?.name || form.template_name, percentage: form.max_score > 0 ? Math.round((form.score / form.max_score) * 100) : 0 };
      if (editing) await base44.entities.ChefAudit.update(editing, payload);
      else await base44.entities.ChefAudit.create(payload);
      qc.invalidateQueries(["chef-audits"]); close();
    } finally { setSaving(false); }
  };
  const del = async (id) => { if (confirm("Excluir auditoria?")) { await base44.entities.ChefAudit.delete(id); qc.invalidateQueries(["chef-audits"]); } };

  const kpis = {
    total: audits.length,
    done: audits.filter(a => a.status === "completed").length,
    approved: audits.filter(a => a.result === "approved").length,
    open: audits.filter(a => ["planned","in_progress"].includes(a.status)).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-primary" />Auditorias</h1>
          <p className="text-[13px] text-muted-foreground">Planejamento e resultado de auditorias</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nova</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total",v:kpis.total,c:"text-foreground"},{l:"Concluídas",v:kpis.done,c:"text-emerald-500"},{l:"Aprovadas",v:kpis.approved,c:"text-emerald-500"},{l:"Em aberto",v:kpis.open,c:"text-amber-500"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input className={`${inputCls} pl-9`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar..." /></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="all">Todos</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="panel">
        {filtered.length===0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma auditoria.</div> : (
          <div className="divide-y divide-border">
            {filtered.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{a.template_name || "Sem template"}</p>
                  <p className="text-[12px] text-muted-foreground">{a.scheduled_date ? new Date(a.scheduled_date).toLocaleDateString("pt-BR") : "—"} · {a.auditor_name || "Sem auditor"}</p>
                </div>
                {a.percentage != null && <span className="hidden sm:block text-sm font-semibold text-foreground mr-3">{a.percentage}%</span>}
                <StatusBadge value={a.status} />
                <div className="flex items-center gap-1 ml-3">
                  <button onClick={()=>openEdit(a)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={()=>del(a.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <FormDialog title={editing?"Editar Auditoria":"Nova Auditoria"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Template"><select className={inputCls} value={form.template_id||""} onChange={e=>setForm({...form, template_id:e.target.value, template_name:templates.find(t=>t.id===e.target.value)?.name||""})}>
            <option value="">Selecione</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Área"><input className={inputCls} value={form.area_id} onChange={e=>setForm({...form,area_id:e.target.value})} /></Field>
          <Field label="Célula"><input className={inputCls} value={form.cell_id} onChange={e=>setForm({...form,cell_id:e.target.value})} /></Field>
          <Field label="Equipe"><input className={inputCls} value={form.team_id} onChange={e=>setForm({...form,team_id:e.target.value})} /></Field>
          <Field label="Auditor"><input className={inputCls} value={form.auditor_name} onChange={e=>setForm({...form,auditor_name:e.target.value})} /></Field>
          <Field label="Data agendada"><input type="date" className={inputCls} value={form.scheduled_date||""} onChange={e=>setForm({...form,scheduled_date:e.target.value})} /></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Resultado"><select className={inputCls} value={form.result} onChange={e=>setForm({...form,result:e.target.value})}>{Object.entries(RESULT).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Score"><input type="number" className={inputCls} value={form.score} onChange={e=>setForm({...form,score:+e.target.value})} /></Field>
          <Field label="Máx. score"><input type="number" className={inputCls} value={form.max_score} onChange={e=>setForm({...form,max_score:+e.target.value})} /></Field>
          <div className="sm:col-span-2"><Field label="Observações"><textarea className={inputCls} rows={2} value={form.general_observations} onChange={e=>setForm({...form,general_observations:e.target.value})} /></Field></div>
        </div>
      </FormDialog>
    </div>
  );
}