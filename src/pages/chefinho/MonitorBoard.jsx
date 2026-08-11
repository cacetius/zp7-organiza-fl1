import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ListChecks, Plus, Pencil, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel } from "@/components/chefinho/FormDialog";

const CAT = { diaria:"Diária", semanal:"Semanal", mensal:"Mensal" };
const ST = { pendente:"Pendente", em_andamento:"Em andamento", concluida:"Concluída" };
const ST_ICON = { pendente: Circle, em_andamento: Clock, concluida: CheckCircle2 };
const ST_CLR = { pendente:"text-muted-foreground", em_andamento:"text-amber-500", concluida:"text-emerald-500" };

export default function MonitorBoard() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { name: "", description: "", category: "diaria", shift: "1", area: "", team: "", responsible_name: "", deadline: "", status: "pendente", notes: "" };
  const [form, setForm] = useState(BLANK);

  const { data: tasks = [] } = useQuery({ queryKey: ["chef-tasks"], queryFn: () => base44.entities.ChefTask.list("-created_date") });
  const filtered = tasks.filter(t => filter === "all" || t.status === filter || t.category === filter);

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (t) => { setForm({ ...BLANK, ...t }); setEditing(t.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => { setSaving(true); try { if (editing) await base44.entities.ChefTask.update(editing, form); else await base44.entities.ChefTask.create(form); qc.invalidateQueries(["chef-tasks"]); close(); } finally { setSaving(false); } };
  const toggle = async (t) => { const status = t.status === "concluida" ? "pendente" : "concluida"; await base44.entities.ChefTask.update(t.id, { status }); qc.invalidateQueries(["chef-tasks"]); };
  const del = async (id) => { if (confirm("Excluir?")) { await base44.entities.ChefTask.delete(id); qc.invalidateQueries(["chef-tasks"]); } };

  const kpis = { total: tasks.length, pend: tasks.filter(t=>t.status==="pendente").length, prog: tasks.filter(t=>t.status==="em_andamento").length, done: tasks.filter(t=>t.status==="concluida").length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" />Quadro Monitor</h1>
          <p className="text-[13px] text-muted-foreground">Tarefas e checklists do turno</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nova</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total",v:kpis.total,c:"text-foreground"},{l:"Pendentes",v:kpis.pend,c:"text-amber-500"},{l:"Em andamento",v:kpis.prog,c:"text-blue-500"},{l:"Concluídas",v:kpis.done,c:"text-emerald-500"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {[["all","Todos"],["pendente","Pendentes"],["em_andamento","Em andamento"],["concluida","Concluídas"],["diaria","Diárias"],["semanal","Semanais"]].map(([k,l]) => (
          <button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded text-xs font-medium ${filter===k?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground hover:bg-accent"}`}>{l}</button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length===0 ? <div className="col-span-full panel p-10 text-center text-sm text-muted-foreground">Nenhuma tarefa.</div> : filtered.map(t => {
          const Icon = ST_ICON[t.status] || Circle;
          return (
            <div key={t.id} className="panel p-4">
              <div className="flex items-start gap-2">
                <button onClick={()=>toggle(t)} className="mt-0.5"><Icon className={`w-5 h-5 ${ST_CLR[t.status]||"text-muted"} ${t.status!=="concluida"?"hover:scale-110":""}`} /></button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${t.status==="concluida"?"line-through text-muted-foreground":"text-foreground"}`}>{t.name}</p>
                  {t.description && <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>openEdit(t)} className="p-1 text-muted-foreground hover:text-primary rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={()=>del(t.id)} className="p-1 text-muted-foreground hover:text-destructive rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
                <span className="badge-neutral">{CAT[t.category]||t.category}</span>
                <span>T{t.shift||"?"}{t.responsible_name ? ` · ${t.responsible_name}` : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
      <FormDialog title={editing?"Editar Tarefa":"Nova Tarefa"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Field label="Nome" required><input className={inputCls} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field></div>
          <div className="sm:col-span-2"><Field label="Descrição"><textarea className={inputCls} rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
          <Field label="Categoria"><select className={inputCls} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{Object.entries(CAT).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Turno"><select className={inputCls} value={form.shift} onChange={e=>setForm({...form,shift:e.target.value})}><option value="1">1 (06-15)</option><option value="2">2 (15-23:45)</option><option value="3">3 (21-06)</option></select></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Prazo"><input type="date" className={inputCls} value={form.deadline||""} onChange={e=>setForm({...form,deadline:e.target.value})} /></Field>
          <Field label="Área"><input className={inputCls} value={form.area} onChange={e=>setForm({...form,area:e.target.value})} /></Field>
          <Field label="Equipe"><input className={inputCls} value={form.team} onChange={e=>setForm({...form,team:e.target.value})} /></Field>
          <Field label="Responsável"><input className={inputCls} value={form.responsible_name} onChange={e=>setForm({...form,responsible_name:e.target.value})} /></Field>
        </div>
      </FormDialog>
    </div>
  );
}