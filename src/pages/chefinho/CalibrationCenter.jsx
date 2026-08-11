import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Gauge, Plus, Search, Pencil, Trash2 } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

const ST = { valid: "Válida", expired: "Vencida", expiring_soon: "Vence em breve" };
const RES = { approved: "Aprovada", rejected: "Reprovada", conditional: "Condicional" };

export default function CalibrationCenter() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const BLANK = { asset_id: "", tool_id: "", certificate_number: "", calibration_date: "", next_calibration_date: "", responsible_lab: "", technician: "", result: "approved", measurement_found: "", tolerance: "", status: "valid", cost: 0, observations: "" };
  const [form, setForm] = useState(BLANK);

  const { data: tools = [] } = useQuery({ queryKey: ["chef-tools-calib"], queryFn: () => base44.entities.ChefTool.list() });
  const { data: calibs = [] } = useQuery({ queryKey: ["chef-calibs"], queryFn: () => base44.entities.ChefCalibration.list("-calibration_date") });

  const filtered = useMemo(() => calibs.filter(c => {
    if (filter !== "all" && c.status !== filter) return false;
    if (!q) return true;
    return `${c.certificate_number} ${c.responsible_lab} ${c.technician}`.toLowerCase().includes(q.toLowerCase());
  }), [calibs, q, filter]);

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (c) => { setForm({ ...BLANK, ...c }); setEditing(c.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => {
    setSaving(true);
    try {
      if (editing) await base44.entities.ChefCalibration.update(editing, form);
      else await base44.entities.ChefCalibration.create(form);
      qc.invalidateQueries(["chef-calibs"]); close();
    } finally { setSaving(false); }
  };
  const del = async (id) => { if (confirm("Excluir calibração?")) { await base44.entities.ChefCalibration.delete(id); qc.invalidateQueries(["chef-calibs"]); } };

  const kpis = { total: calibs.length, valid: calibs.filter(c=>c.status==="valid").length, expired: calibs.filter(c=>c.status==="expired").length, soon: calibs.filter(c=>c.status==="expiring_soon").length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><Gauge className="w-5 h-5 text-primary" />Calibração</h1>
          <p className="text-[13px] text-muted-foreground">Controle de certificados e vencimentos</p></div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nova</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total",v:kpis.total,c:"text-foreground"},{l:"Válidas",v:kpis.valid,c:"text-emerald-500"},{l:"Venc.",v:kpis.expired,c:"text-red-500"},{l:"Vence em breve",v:kpis.soon,c:"text-amber-500"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input className={`${inputCls} pl-9`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar certificado..." /></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="all">Todos</option>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="panel">
        {filtered.length===0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma calibração.</div> : (
          <div className="divide-y divide-border">
            {filtered.map(c => {
              const tool = tools.find(t => t.id === c.tool_id);
              return (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{c.certificate_number || "Sem certificado"}</p>
                    <p className="text-[12px] text-muted-foreground">{tool?.name || c.asset_id || "—"} · {c.responsible_lab || "—"}{c.calibration_date ? ` · ${new Date(c.calibration_date).toLocaleDateString("pt-BR")}` : ""}</p>
                  </div>
                  <span className="text-[12px] text-muted-foreground mr-3 hidden sm:block">{c.next_calibration_date ? `vence ${new Date(c.next_calibration_date).toLocaleDateString("pt-BR")}` : ""}</span>
                  <StatusBadge value={c.status} />
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={()=>openEdit(c)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={()=>del(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <FormDialog title={editing?"Editar Calibração":"Nova Calibração"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Ferramenta"><select className={inputCls} value={form.tool_id||""} onChange={e=>setForm({...form,tool_id:e.target.value})}><option value="">Selecione</option>{tools.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Ativo (ID)"><input className={inputCls} value={form.asset_id} onChange={e=>setForm({...form,asset_id:e.target.value})} /></Field>
          <Field label="Nº certificado"><input className={inputCls} value={form.certificate_number} onChange={e=>setForm({...form,certificate_number:e.target.value})} /></Field>
          <Field label="Laboratório"><input className={inputCls} value={form.responsible_lab} onChange={e=>setForm({...form,responsible_lab:e.target.value})} /></Field>
          <Field label="Data calibração" required><input type="date" className={inputCls} value={form.calibration_date||""} onChange={e=>setForm({...form,calibration_date:e.target.value})} /></Field>
          <Field label="Próxima calibração" required><input type="date" className={inputCls} value={form.next_calibration_date||""} onChange={e=>setForm({...form,next_calibration_date:e.target.value})} /></Field>
          <Field label="Resultado"><select className={inputCls} value={form.result} onChange={e=>setForm({...form,result:e.target.value})}>{Object.entries(RES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Medição encontrada"><input className={inputCls} value={form.measurement_found} onChange={e=>setForm({...form,measurement_found:e.target.value})} /></Field>
          <Field label="Tolerância"><input className={inputCls} value={form.tolerance} onChange={e=>setForm({...form,tolerance:e.target.value})} /></Field>
          <Field label="Custo (R$)"><input type="number" className={inputCls} value={form.cost} onChange={e=>setForm({...form,cost:+e.target.value})} /></Field>
          <Field label="Técnico"><input className={inputCls} value={form.technician} onChange={e=>setForm({...form,technician:e.target.value})} /></Field>
          <div className="sm:col-span-2"><Field label="Observações"><textarea className={inputCls} rows={2} value={form.observations} onChange={e=>setForm({...form,observations:e.target.value})} /></Field></div>
        </div>
      </FormDialog>
    </div>
  );
}