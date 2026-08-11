import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { HardHat, Plus, Search, Pencil, Trash2 } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

const TYPE = { capacete:"Capacete", luva:"Luva", oculos:"Óculos", protetor_auricular:"Protetor auricular", mascara:"Máscara", bota:"Bota", cinto_seguranca:"Cinto de segurança", uniforme:"Uniforme", jaleco:"Jaleco", respirador:"Respirador", outro:"Outro" };
const ST = { suficiente:"Suficiente", insuficiente:"Insuficiente", pendente:"Pendente", solicitado:"Solicitado" };

export default function EPI() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { name: "", type: "luva", team: "", cell: "", area: "", quantity_required: 1, quantity_available: 0, status: "pendente", requested_by_name: "", responsible_name: "", notes: "" };
  const [form, setForm] = useState(BLANK);

  const { data: items = [] } = useQuery({ queryKey: ["chef-epis"], queryFn: () => base44.entities.ChefEPI.list() });
  const filtered = useMemo(() => items.filter(e => {
    if (filter !== "all" && e.status !== filter) return false;
    if (!q) return true;
    return `${e.name} ${e.team} ${e.cell}`.toLowerCase().includes(q.toLowerCase());
  }), [items, q, filter]);

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (e) => { setForm({ ...BLANK, ...e }); setEditing(e.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => { setSaving(true); try { if (editing) await base44.entities.ChefEPI.update(editing, form); else await base44.entities.ChefEPI.create(form); qc.invalidateQueries(["chef-epis"]); close(); } finally { setSaving(false); } };
  const del = async (id) => { if (confirm("Excluir EPI?")) { await base44.entities.ChefEPI.delete(id); qc.invalidateQueries(["chef-epis"]); } };

  const kpis = { total: items.length, insuf: items.filter(e=>e.status==="insuficiente").length, pend: items.filter(e=>e.status==="pendente").length, solic: items.filter(e=>e.status==="solicitado").length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><HardHat className="w-5 h-5 text-primary" />EPIs</h1>
          <p className="text-[13px] text-muted-foreground">Equipamentos de proteção individual por equipe</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Novo</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total",v:kpis.total,c:"text-foreground"},{l:"Insuficientes",v:kpis.insuf,c:"text-red-500"},{l:"Pendentes",v:kpis.pend,c:"text-amber-500"},{l:"Solicitados",v:kpis.solic,c:"text-blue-500"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input className={`${inputCls} pl-9`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar..." /></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="all">Todos</option>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="panel">
        {filtered.length===0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhum EPI.</div> : (
          <div className="divide-y divide-border">
            {filtered.map(e => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{TYPE[e.type]||e.type}: {e.name}</p>
                  <p className="text-[12px] text-muted-foreground">{e.team || "—"}{e.cell ? ` · ${e.cell}` : ""} · {e.quantity_available}/{e.quantity_required} un.</p>
                </div>
                <StatusBadge value={e.status} />
                <div className="flex items-center gap-1 ml-3">
                  <button onClick={()=>openEdit(e)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={()=>del(e.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <FormDialog title={editing?"Editar EPI":"Novo EPI"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome" required><input className={inputCls} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
          <Field label="Tipo" required><select className={inputCls} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(TYPE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Equipe" required><input className={inputCls} value={form.team} onChange={e=>setForm({...form,team:e.target.value})} /></Field>
          <Field label="Célula"><input className={inputCls} value={form.cell} onChange={e=>setForm({...form,cell:e.target.value})} /></Field>
          <Field label="Área"><input className={inputCls} value={form.area} onChange={e=>setForm({...form,area:e.target.value})} /></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Qtd. necessária"><input type="number" className={inputCls} value={form.quantity_required} onChange={e=>setForm({...form,quantity_required:+e.target.value})} /></Field>
          <Field label="Qtd. disponível"><input type="number" className={inputCls} value={form.quantity_available} onChange={e=>setForm({...form,quantity_available:+e.target.value})} /></Field>
          <Field label="Solicitante"><input className={inputCls} value={form.requested_by_name} onChange={e=>setForm({...form,requested_by_name:e.target.value})} /></Field>
          <Field label="Responsável"><input className={inputCls} value={form.responsible_name} onChange={e=>setForm({...form,responsible_name:e.target.value})} /></Field>
          <div className="sm:col-span-2"><Field label="Observações"><textarea className={inputCls} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></Field></div>
        </div>
      </FormDialog>
    </div>
  );
}