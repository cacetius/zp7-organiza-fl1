import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Wrench, Plus, Search, Pencil, Trash2 } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel } from "@/components/chefinho/FormDialog";

const BLANK = { name: "", code: "", serial_number: "", model: "", manufacturer: "", category: "maquina", area: "", team: "", tact: "", side: "na", criticality: "baixa", status: "conforme", has_certificate: false, calibration_date: "", next_calibration: "", expiry_date: "", notes: "" };

const CAT_LABEL = { ferramenta: "Ferramenta", maquina: "Máquina", torque: "Torque", dispositivo: "Dispositivo", medicao: "Medição" };
const CRIT = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };

export default function Equipment() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["chef-equip"], queryFn: () => base44.entities.ChefEquipment.list("-created_date") });

  const filtered = useMemo(() => {
    return items.filter(e => {
      if (filter !== "all" && e.status !== filter) return false;
      if (!q) return true;
      const t = `${e.name} ${e.code} ${e.serial_number} ${e.manufacturer}`.toLowerCase();
      return t.includes(q.toLowerCase());
    });
  }, [items, q, filter]);

  const save = async () => {
    setSaving(true);
    try {
      if (editing) await base44.entities.ChefEquipment.update(editing, form);
      else await base44.entities.ChefEquipment.create(form);
      qc.invalidateQueries(["chef-equip"]);
      setEditing(null); setForm(BLANK); setModalOpen(false);
    } finally { setSaving(false); }
  };

  const del = async (id) => { if (confirm("Excluir equipamento?")) { await base44.entities.ChefEquipment.delete(id); qc.invalidateQueries(["chef-equip"]); } };

  const openNew = () => { setForm(BLANK); setEditing(null); setModalOpen(true); };
  const openEdit = (e) => { setForm({ ...BLANK, ...e }); setEditing(e.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };

  const kpis = {
    total: items.length,
    vencido: items.filter(e => e.status === "vencido").length,
    atencao: items.filter(e => e.status === "atencao").length,
    critico: items.filter(e => e.criticality === "critica").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" />Equipamentos</h1>
          <p className="text-[13px] text-muted-foreground">Gestão de equipamentos e ferramentas calibráveis</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Total", v: kpis.total, c: "text-foreground" },
          { l: "Vencidos", v: kpis.vencido, c: "text-red-500" },
          { l: "Atenção", v: kpis.atencao, c: "text-amber-500" },
          { l: "Críticos", v: kpis.critico, c: "text-red-500" },
        ].map(k => (
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, código, série..."
            className={`${inputCls} pl-9`} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="all">Todos os status</option>
          <option value="conforme">Conforme</option><option value="atencao">Atenção</option><option value="vencido">Vencido</option><option value="inativo">Inativo</option>
        </select>
      </div>

      <div className="panel">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhum equipamento encontrado.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(e => {
              const st = { conforme: "badge-success", atencao: "badge-warning", vencido: "badge-danger", inativo: "badge-neutral" }[e.status] || "badge-neutral";
              return (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                    <p className="text-[12px] text-muted-foreground">{[e.code, e.serial_number, CAT_LABEL[e.category]].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="hidden sm:block text-[12px] text-muted-foreground text-right mr-3">{e.area || "—"}{e.tact ? ` · ${e.tact}` : ""}</div>
                  <span className={`${st} capitalize mr-3`}>{e.status}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(e)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(e.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FormDialog
        title={editing ? "Editar Equipamento" : "Novo Equipamento"}
        open={modalOpen}
        onClose={close}
        wide
        footer={<><BtnCancel onClick={close} /><BtnSave loading={saving} onClick={save} /></>}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome" required><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Código"><input className={inputCls} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Nº de série"><input className={inputCls} value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></Field>
          <Field label="Modelo"><input className={inputCls} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></Field>
          <Field label="Categoria"><select className={inputCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(CAT_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Criticidade"><select className={inputCls} value={form.criticality} onChange={e => setForm({ ...form, criticality: e.target.value })}>{Object.entries(CRIT).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Área"><input className={inputCls} value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></Field>
          <Field label="Equipe"><input className={inputCls} value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} /></Field>
          <Field label="Lado"><select className={inputCls} value={form.side} onChange={e => setForm({ ...form, side: e.target.value })}><option value="na">N/A</option><option value="esquerdo">Esquerdo</option><option value="direito">Direito</option><option value="centro">Centro</option></select></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="conforme">Conforme</option><option value="atencao">Atenção</option><option value="vencido">Vencido</option><option value="inativo">Inativo</option></select></Field>
          <Field label="Calibração"><input type="date" className={inputCls} value={form.calibration_date || ""} onChange={e => setForm({ ...form, calibration_date: e.target.value })} /></Field>
          <Field label="Próx. calibração"><input type="date" className={inputCls} value={form.next_calibration || ""} onChange={e => setForm({ ...form, next_calibration: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Observações"><textarea className={inputCls} rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!form.has_certificate} onChange={e => setForm({ ...form, has_certificate: e.target.checked })} /> Possui certificado</label>
        </div>
      </FormDialog>
    </div>
  );
}