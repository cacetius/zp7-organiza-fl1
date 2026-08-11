import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { FileText, Plus, Search, Pencil, Trash2 } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

const METH = { "5S":"5S", LPA:"LPA", VDA:"VDA", ISO:"ISO", custom:"Personalizado" };
const FREQ = { daily:"Diária", weekly:"Semanal", monthly:"Mensal", quarterly:"Trimestral", semiannual:"Semestral", annual:"Anual", on_demand:"Sob demanda" };

export default function Templates() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { name: "", code: "", methodology: "5S", description: "", scope: "", frequency: "weekly", approval_threshold: 80, target_entity: "area", status: "draft", version: 1 };
  const [form, setForm] = useState(BLANK);

  const { data: items = [] } = useQuery({ queryKey: ["chef-templates"], queryFn: () => base44.entities.ChefAuditTemplate.list() });
  const filtered = useMemo(() => items.filter(t => !q || `${t.name} ${t.code} ${t.methodology}`.toLowerCase().includes(q.toLowerCase())), [items, q]);

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (t) => { setForm({ ...BLANK, ...t }); setEditing(t.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => { setSaving(true); try { if (editing) await base44.entities.ChefAuditTemplate.update(editing, form); else await base44.entities.ChefAuditTemplate.create(form); qc.invalidateQueries(["chef-templates"]); close(); } finally { setSaving(false); } };
  const del = async (id) => { if (confirm("Excluir modelo?")) { await base44.entities.ChefAuditTemplate.delete(id); qc.invalidateQueries(["chef-templates"]); } };

  const kpis = { total: items.length, active: items.filter(t=>t.status==="active").length, draft: items.filter(t=>t.status==="draft").length, archived: items.filter(t=>t.status==="archived").length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />Modelos de Auditoria</h1>
          <p className="text-[13px] text-muted-foreground">Templates por metodologia (5S, LPA, VDA...)</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Novo</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total",v:kpis.total,c:"text-foreground"},{l:"Ativos",v:kpis.active,c:"text-emerald-500"},{l:"Rascunho",v:kpis.draft,c:"text-amber-500"},{l:"Arquivados",v:kpis.archived,c:"text-muted-foreground"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input className={`${inputCls} pl-9`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar modelo..." /></div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? <div className="col-span-full panel p-10 text-center text-sm text-muted-foreground">Nenhum modelo.</div> : filtered.map(t => (
          <div key={t.id} className="panel p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                <p className="text-[12px] text-muted-foreground">{METH[t.methodology]||t.methodology}{t.code ? ` · ${t.code}` : ""}</p>
              </div>
              <StatusBadge value={t.status} />
            </div>
            {t.description && <p className="text-[12px] text-muted-foreground mt-2 line-clamp-2">{t.description}</p>}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">{FREQ[t.frequency]||"—"} · {t.approval_threshold||0}% aprovação</span>
              <div className="flex gap-1">
                <button onClick={()=>openEdit(t)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={()=>del(t.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <FormDialog title={editing?"Editar Modelo":"Novo Modelo"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome" required><input className={inputCls} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
          <Field label="Código"><input className={inputCls} value={form.code} onChange={e=>setForm({...form,code:e.target.value})} /></Field>
          <Field label="Metodologia"><select className={inputCls} value={form.methodology} onChange={e=>setForm({...form,methodology:e.target.value})}>{Object.entries(METH).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Frequência"><select className={inputCls} value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value})}>{Object.entries(FREQ).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Alvo"><select className={inputCls} value={form.target_entity} onChange={e=>setForm({...form,target_entity:e.target.value})}>{["area","cell","team","tacto","asset","tool"].map(o=><option key={o} value={o}>{o}</option>)}</select></Field>
          <Field label="Limiar de aprovação (%)"><input type="number" className={inputCls} value={form.approval_threshold} onChange={e=>setForm({...form,approval_threshold:+e.target.value})} /></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="archived">Arquivado</option></select></Field>
          <Field label="Versão"><input type="number" className={inputCls} value={form.version} onChange={e=>setForm({...form,version:+e.target.value})} /></Field>
          <div className="sm:col-span-2"><Field label="Escopo"><input className={inputCls} value={form.scope} onChange={e=>setForm({...form,scope:e.target.value})} /></Field></div>
          <div className="sm:col-span-2"><Field label="Descrição"><textarea className={inputCls} rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
        </div>
      </FormDialog>
    </div>
  );
}