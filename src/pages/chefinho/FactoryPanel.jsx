import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Monitor, Plus, Pencil, Trash2 } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

export default function FactoryPanel() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { name: "", code: "", address: "", city: "", state: "", responsible: "", phone: "", email: "", status: "active", description: "" };
  const [form, setForm] = useState(BLANK);

  const { data: factories = [] } = useQuery({ queryKey: ["chef-factories"], queryFn: () => base44.entities.ChefFactory.list() });
  const { data: areas = [] } = useQuery({ queryKey: ["chef-areas-panel"], queryFn: () => base44.entities.ChefArea.list() });
  const { data: cells = [] } = useQuery({ queryKey: ["chef-cells-panel"], queryFn: () => base44.entities.ChefCell.list() });

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (f) => { setForm({ ...BLANK, ...f }); setEditing(f.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => { setSaving(true); try { if (editing) await base44.entities.ChefFactory.update(editing, form); else await base44.entities.ChefFactory.create(form); qc.invalidateQueries(["chef-factories"]); close(); } finally { setSaving(false); } };
  const del = async (id) => { if (confirm("Excluir fábrica?")) { await base44.entities.ChefFactory.delete(id); qc.invalidateQueries(["chef-factories"]); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><Monitor className="w-5 h-5 text-primary" />Painel Fábrica</h1>
          <p className="text-[13px] text-muted-foreground">Unidades, áreas e células de produção</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nova</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-3"><p className="text-2xl font-semibold tabular-nums">{factories.length}</p><p className="text-[11px] text-muted-foreground">Fábricas</p></div>
        <div className="panel p-3"><p className="text-2xl font-semibold tabular-nums">{areas.length}</p><p className="text-[11px] text-muted-foreground">Áreas</p></div>
        <div className="panel p-3"><p className="text-2xl font-semibold tabular-nums">{cells.length}</p><p className="text-[11px] text-muted-foreground">Células</p></div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {factories.length===0 ? <div className="col-span-full panel p-10 text-center text-sm text-muted-foreground">Nenhuma fábrica cadastrada.</div> : factories.map(f => {
          const fAreas = areas.filter(a => a.factory_id === f.id);
          const fCells = cells.filter(c => fAreas.some(a => a.id === c.area_id));
          return (
            <div key={f.id} className="panel p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{f.name}</p>
                  <p className="text-[12px] text-muted-foreground">{f.code}{f.city ? ` · ${f.city}` : ""}{f.state ? `/${f.state}` : ""}</p>
                </div>
                <StatusBadge value={f.status} />
              </div>
              {f.responsible && <p className="text-[12px] text-muted-foreground mt-2">Resp.: {f.responsible}{f.phone ? ` · ${f.phone}` : ""}</p>}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground">{fAreas.length} áreas · {fCells.length} células</span>
                <div className="flex gap-1">
                  <button onClick={()=>openEdit(f)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={()=>del(f.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <FormDialog title={editing?"Editar Fábrica":"Nova Fábrica"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome" required><input className={inputCls} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
          <Field label="Código" required><input className={inputCls} value={form.code} onChange={e=>setForm({...form,code:e.target.value})} /></Field>
          <div className="sm:col-span-2"><Field label="Endereço"><input className={inputCls} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></Field></div>
          <Field label="Cidade"><input className={inputCls} value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></Field>
          <Field label="UF"><input className={inputCls} value={form.state} onChange={e=>setForm({...form,state:e.target.value})} /></Field>
          <Field label="Responsável"><input className={inputCls} value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})} /></Field>
          <Field label="Telefone"><input className={inputCls} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></Field>
          <Field label="E-mail"><input className={inputCls} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></Field>
          <div className="sm:col-span-2"><Field label="Descrição"><textarea className={inputCls} rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
        </div>
      </FormDialog>
    </div>
  );
}