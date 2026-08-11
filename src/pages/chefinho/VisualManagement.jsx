import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Eye, Plus, Search, Pencil, Trash2 } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

const TYPE = { label: "Etiqueta", sign: "Placa", stripe: "Faixa", marking: "Marcação", signaling: "Sinalização", kanban: "Kanban", andon: "Andon", other: "Outro" };
const COND = { good: "Bom", degraded: "Degradado", damaged: "Danificado", missing: "Ausente" };

export default function VisualManagement() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { type: "label", name: "", code: "", description: "", location: "", condition: "good", responsible: "", status: "active", area_id: "", observations: "" };
  const [form, setForm] = useState(BLANK);

  const { data: items = [] } = useQuery({ queryKey: ["chef-visual"], queryFn: () => base44.entities.ChefVisualManagement.list() });
  const filtered = useMemo(() => items.filter(v => {
    if (filter !== "all" && v.condition !== filter) return false;
    if (!q) return true;
    return `${v.name} ${v.code} ${v.location}`.toLowerCase().includes(q.toLowerCase());
  }), [items, q, filter]);

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (v) => { setForm({ ...BLANK, ...v }); setEditing(v.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => { setSaving(true); try { if (editing) await base44.entities.ChefVisualManagement.update(editing, form); else await base44.entities.ChefVisualManagement.create(form); qc.invalidateQueries(["chef-visual"]); close(); } finally { setSaving(false); } };
  const del = async (id) => { if (confirm("Excluir?")) { await base44.entities.ChefVisualManagement.delete(id); qc.invalidateQueries(["chef-visual"]); } };

  const kpis = { total: items.length, good: items.filter(v=>v.condition==="good").length, damaged: items.filter(v=>["damaged","missing"].includes(v.condition)).length, pending: items.filter(v=>v.status==="pending_replacement").length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />Gestão Visual</h1>
          <p className="text-[13px] text-muted-foreground">Etiquetas, placas e sinalizações</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Novo</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total",v:kpis.total,c:"text-foreground"},{l:"Em bom estado",v:kpis.good,c:"text-emerald-500"},{l:"Danificados",v:kpis.damaged,c:"text-red-500"},{l:"A substituir",v:kpis.pending,c:"text-amber-500"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input className={`${inputCls} pl-9`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar..." /></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="all">Todas as condições</option>{Object.entries(COND).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="panel">
        {filtered.length===0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhum item.</div> : (
          <div className="divide-y divide-border">
            {filtered.map(v => {
              const condCls = { good:"badge-success", degraded:"badge-warning", damaged:"badge-danger", missing:"badge-danger" }[v.condition] || "badge-neutral";
              return (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{TYPE[v.type]||v.type}: {v.name}</p>
                    <p className="text-[12px] text-muted-foreground">{v.location || "—"}{v.responsible ? ` · ${v.responsible}` : ""}</p>
                  </div>
                  <span className={`${condCls} mr-3`}>{COND[v.condition]||v.condition}</span>
                  <StatusBadge value={v.status} />
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={()=>openEdit(v)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={()=>del(v.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <FormDialog title={editing?"Editar Item":"Novo Item Visual"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Tipo"><select className={inputCls} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(TYPE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Condição"><select className={inputCls} value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})}>{Object.entries(COND).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Nome" required><input className={inputCls} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
          <Field label="Código"><input className={inputCls} value={form.code} onChange={e=>setForm({...form,code:e.target.value})} /></Field>
          <Field label="Localização"><input className={inputCls} value={form.location} onChange={e=>setForm({...form,location:e.target.value})} /></Field>
          <Field label="Responsável"><input className={inputCls} value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})} /></Field>
          <Field label="Área"><input className={inputCls} value={form.area_id} onChange={e=>setForm({...form,area_id:e.target.value})} /></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="pending_replacement">A substituir</option></select></Field>
          <div className="sm:col-span-2"><Field label="Descrição"><textarea className={inputCls} rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
        </div>
      </FormDialog>
    </div>
  );
}