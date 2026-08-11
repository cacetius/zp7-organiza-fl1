import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckSquare, Plus, Pencil, Trash2, Search, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

const PRIO = { low:"Baixa", medium:"Média", high:"Alta", critical:"Crítica" };
const ST = { pending:"Pendente", in_progress:"Em andamento", completed:"Concluído", overdue:"Atrasado", cancelled:"Cancelado" };

export default function ActionPlans() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { nc_id: "", title: "", description: "", priority: "medium", status: "pending", responsible_name: "", due_date: "", completion_percentage: 0, what: "", why: "", who: "", where: "", when: "", how: "", how_much: "" };
  const [form, setForm] = useState(BLANK);

  const { data: plans = [] } = useQuery({ queryKey: ["chef-plans"], queryFn: () => base44.entities.ChefActionPlan.list("-created_date") });
  const { data: ncs = [] } = useQuery({ queryKey: ["chef-ncs-plans"], queryFn: () => base44.entities.ChefNonConformity.list() });

  const filtered = useMemo(() => plans.filter(p => {
    if (filter !== "all" && p.status !== filter) return false;
    if (!q) return true;
    return `${p.title} ${p.responsible_name}`.toLowerCase().includes(q.toLowerCase());
  }), [plans, q, filter]);

  const ncTitle = (id) => ncs.find(n => n.id === id)?.title;

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (p) => { setForm({ ...BLANK, ...p }); setEditing(p.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => { setSaving(true); try { if (editing) await base44.entities.ChefActionPlan.update(editing, form); else await base44.entities.ChefActionPlan.create(form); qc.invalidateQueries(["chef-plans"]); close(); } finally { setSaving(false); } };
  const del = async (id) => { if (confirm("Excluir plano?")) { await base44.entities.ChefActionPlan.delete(id); qc.invalidateQueries(["chef-plans"]); } };
  const advance = async (p) => { const next = { pending:"in_progress", in_progress:"completed", completed:"pending" }; const pct = next[p.status]==="completed"?100:0; await base44.entities.ChefActionPlan.update(p.id, { status: next[p.status], completion_percentage: pct }); qc.invalidateQueries(["chef-plans"]); };

  const kpis = { total: plans.length, pending: plans.filter(p=>p.status==="pending").length, prog: plans.filter(p=>p.status==="in_progress").length, done: plans.filter(p=>p.status==="completed").length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><CheckSquare className="w-5 h-5 text-primary" />Planos de Ação</h1>
          <p className="text-[13px] text-muted-foreground">Ações corretivas vinculadas a não conformidades</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Novo</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total",v:kpis.total,c:"text-foreground"},{l:"Pendentes",v:kpis.pending,c:"text-amber-500"},{l:"Em andamento",v:kpis.prog,c:"text-blue-500"},{l:"Concluídos",v:kpis.done,c:"text-emerald-500"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input className={`${inputCls} pl-9`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar plano..." /></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="all">Todos</option>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="panel">
        {filtered.length===0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhum plano de ação.</div> : (
          <div className="divide-y divide-border">
            {filtered.map(p => {
              const prioCls = { critical:"badge-danger", high:"badge-danger", medium:"badge-warning", low:"badge-neutral" }[p.priority] || "badge-neutral";
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                    <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                      {ncTitle(p.nc_id) && <Link to="/chefinho/nao-conformidades" className="text-primary hover:underline flex items-center gap-1"><LinkIcon className="w-3 h-3" />{ncTitle(p.nc_id)}</Link>}
                      {p.responsible_name ? ` · ${p.responsible_name}` : ""}
                      {p.due_date ? ` · vence ${new Date(p.due_date).toLocaleDateString("pt-BR")}` : ""}
                      {p.completion_percentage>0 && ` · ${p.completion_percentage}%`}
                    </p>
                  </div>
                  <span className={`${prioCls} mr-3`}>{PRIO[p.priority]||p.priority}</span>
                  <button onClick={()=>advance(p)} className="mr-2 text-[11px] text-primary hover:underline shrink-0">Avançar</button>
                  <StatusBadge value={p.status} />
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={()=>openEdit(p)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={()=>del(p.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <FormDialog title={editing?"Editar Plano":"Novo Plano de Ação"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Field label="Título" required><input className={inputCls} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></Field></div>
          <div className="sm:col-span-2"><Field label="Descrição"><textarea className={inputCls} rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
          <Field label="NC vinculada"><select className={inputCls} value={form.nc_id||""} onChange={e=>setForm({...form,nc_id:e.target.value})}><option value="">—</option>{ncs.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></Field>
          <Field label="Prioridade"><select className={inputCls} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{Object.entries(PRIO).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Responsável"><input className={inputCls} value={form.responsible_name} onChange={e=>setForm({...form,responsible_name:e.target.value})} /></Field>
          <Field label="Prazo"><input type="date" className={inputCls} value={form.due_date||""} onChange={e=>setForm({...form,due_date:e.target.value})} /></Field>
          <Field label="Conclusão (%)"><input type="number" className={inputCls} value={form.completion_percentage} onChange={e=>setForm({...form,completion_percentage:+e.target.value})} /></Field>
          <Field label="O quê (what)"><input className={inputCls} value={form.what} onChange={e=>setForm({...form,what:e.target.value})} /></Field>
          <Field label="Por quê (why)"><input className={inputCls} value={form.why} onChange={e=>setForm({...form,why:e.target.value})} /></Field>
          <Field label="Quem (who)"><input className={inputCls} value={form.who} onChange={e=>setForm({...form,who:e.target.value})} /></Field>
          <Field label="Onde (where)"><input className={inputCls} value={form.where} onChange={e=>setForm({...form,where:e.target.value})} /></Field>
          <Field label="Quando (when)"><input type="date" className={inputCls} value={form.when||""} onChange={e=>setForm({...form,when:e.target.value})} /></Field>
          <Field label="Como (how)"><input className={inputCls} value={form.how} onChange={e=>setForm({...form,how:e.target.value})} /></Field>
          <Field label="Quanto custa"><input className={inputCls} value={form.how_much} onChange={e=>setForm({...form,how_much:e.target.value})} /></Field>
        </div>
      </FormDialog>
    </div>
  );
}