import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Plus, Search, Pencil, Trash2 } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

const SEV = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
const ST = { open: "Aberta", in_progress: "Em andamento", resolved: "Resolvida", closed: "Fechada", cancelled: "Cancelada" };

export default function NonConformities() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { title: "", description: "", category: "", severity: "medium", status: "open", area_id: "", responsible_name: "", due_date: "", root_cause: "", immediate_action: "", corrective_action: "" };
  const [form, setForm] = useState(BLANK);

  const { data: ncs = [] } = useQuery({ queryKey: ["chef-ncs"], queryFn: () => base44.entities.ChefNonConformity.list("-created_date") });
  const { data: plans = [] } = useQuery({ queryKey: ["chef-plans"], queryFn: () => base44.entities.ChefActionPlan.list() });

  const filtered = useMemo(() => ncs.filter(n => {
    if (filter !== "all" && n.status !== filter) return false;
    if (!q) return true;
    return `${n.title} ${n.description} ${n.responsible_name}`.toLowerCase().includes(q.toLowerCase());
  }), [ncs, q, filter]);

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (n) => { setForm({ ...BLANK, ...n }); setEditing(n.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => {
    setSaving(true);
    try {
      if (editing) await base44.entities.ChefNonConformity.update(editing, form);
      else await base44.entities.ChefNonConformity.create({ ...form, nc_number: `NC-${Math.floor(Math.random()*9000+1000)}` });
      qc.invalidateQueries(["chef-ncs"]); close();
    } finally { setSaving(false); }
  };
  const del = async (id) => { if (confirm("Excluir NC?")) { await base44.entities.ChefNonConformity.delete(id); qc.invalidateQueries(["chef-ncs"]); } };

  const kpis = {
    total: ncs.length,
    open: ncs.filter(n => ["open","in_progress"].includes(n.status)).length,
    critical: ncs.filter(n => n.severity === "critical").length,
    resolved: ncs.filter(n => ["resolved","closed"].includes(n.status)).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-primary" />Não Conformidades</h1>
          <p className="text-[13px] text-muted-foreground">Registros e planos de ação associados</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nova NC</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total",v:kpis.total,c:"text-foreground"},{l:"Abertas",v:kpis.open,c:"text-amber-500"},{l:"Críticas",v:kpis.critical,c:"text-red-500"},{l:"Resolvidas",v:kpis.resolved,c:"text-emerald-500"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input className={`${inputCls} pl-9`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar NC..." /></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="all">Todos</option>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="panel">
        {filtered.length===0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma não conformidade.</div> : (
          <div className="divide-y divide-border">
            {filtered.map(n => {
              const planCount = plans.filter(p => p.nc_id === n.id).length;
              const sevCls = { critical:"badge-danger", high:"badge-danger", medium:"badge-warning", low:"badge-neutral" }[n.severity] || "badge-neutral";
              return (
                <div key={n.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{n.nc_number ? `${n.nc_number} · ` : ""}{n.title}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{n.responsible_name || "—"}{n.due_date ? ` · vence ${new Date(n.due_date).toLocaleDateString("pt-BR")}` : ""}{planCount>0?` · ${planCount} plano(s)`:""}</p>
                  </div>
                  <span className={`${sevCls} mr-3`}>{SEV[n.severity]||n.severity}</span>
                  <StatusBadge value={n.status} />
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={()=>openEdit(n)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={()=>del(n.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <FormDialog title={editing?"Editar NC":"Nova Não Conformidade"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Field label="Título" required><input className={inputCls} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></Field></div>
          <div className="sm:col-span-2"><Field label="Descrição"><textarea className={inputCls} rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
          <Field label="Severidade"><select className={inputCls} value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})}>{Object.entries(SEV).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Área"><input className={inputCls} value={form.area_id} onChange={e=>setForm({...form,area_id:e.target.value})} /></Field>
          <Field label="Responsável"><input className={inputCls} value={form.responsible_name} onChange={e=>setForm({...form,responsible_name:e.target.value})} /></Field>
          <Field label="Prazo"><input type="date" className={inputCls} value={form.due_date||""} onChange={e=>setForm({...form,due_date:e.target.value})} /></Field>
          <Field label="Categoria"><input className={inputCls} value={form.category} onChange={e=>setForm({...form,category:e.target.value})} /></Field>
          <div className="sm:col-span-2"><Field label="Causa raiz"><input className={inputCls} value={form.root_cause} onChange={e=>setForm({...form,root_cause:e.target.value})} /></Field></div>
          <div className="sm:col-span-2"><Field label="Ação imediata"><input className={inputCls} value={form.immediate_action} onChange={e=>setForm({...form,immediate_action:e.target.value})} /></Field></div>
          <div className="sm:col-span-2"><Field label="Ação corretiva"><input className={inputCls} value={form.corrective_action} onChange={e=>setForm({...form,corrective_action:e.target.value})} /></Field></div>
        </div>
      </FormDialog>
    </div>
  );
}