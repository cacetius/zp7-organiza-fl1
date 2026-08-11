import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Map, Plus, Pencil, Trash2, MousePointer2, Square, Minus } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";
import Mapa3D from "@/components/chefinho/Mapa3D";
import { Boxes } from "lucide-react";

const ET = { bancada:"Bancada", faixa:"Faixa", area:"Área", corredor:"Corredor", seta:"Seta", separador:"Separador", limite:"Limite" };
const AT = { producao:"Produção", estoque:"Estoque", qualidade:"Qualidade", retrabalho:"Retrabalho", livre:"Livre" };

export default function DigitalMap() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState("select");
  const [selected, setSelected] = useState(null);
  const BLANK = { name: "", element_type: "bancada", color: "#3b82f6", width: 80, height: 40, pos_x: 50, pos_y: 50, orientation: "horizontal", area_type: "producao", scale: 1, cell: "", area: "", status: "ativo", notes: "" };
  const [form, setForm] = useState(BLANK);
  const canvasRef = useRef(null);

  const { data: items = [] } = useQuery({ queryKey: ["chef-map"], queryFn: () => base44.entities.ChefMapLayout.list() });
  const { data: layouts = [] } = useQuery({ queryKey: ["chef-vm-map"], queryFn: () => base44.entities.ChefVisualManagement.list() });
  const { data: assets = [] } = useQuery({ queryKey: ["chef-assets-map"], queryFn: () => base44.entities.ChefAsset.list() });
  const { data: areas = [] } = useQuery({ queryKey: ["chef-areas-map"], queryFn: () => base44.entities.ChefArea.list() });
  const [view3D, setView3D] = useState(false);

  const openNew = () => { setForm({ ...BLANK, pos_x: 50 + Math.random()*400, pos_y: 50 + Math.random()*200 }); setEditing(null); setModalOpen(true); };
  const openEdit = (m) => { setForm({ ...BLANK, ...m }); setEditing(m.id); setModalOpen(true); };
  const close = () => { setEditing(null); setForm(BLANK); setModalOpen(false); };
  const save = async () => { setSaving(true); try { if (editing) await base44.entities.ChefMapLayout.update(editing, form); else await base44.entities.ChefMapLayout.create(form); qc.invalidateQueries(["chef-map"]); close(); } finally { setSaving(false); } };
  const del = async (id) => { if (confirm("Excluir elemento?")) { await base44.entities.ChefMapLayout.delete(id); qc.invalidateQueries(["chef-map"]); } };

  const byCell = {};
  items.forEach(m => { const k = m.cell || "—"; (byCell[k] = byCell[k] || []).push(m); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><Map className="w-5 h-5 text-primary" />Mapa Digital</h1>
          <p className="text-[13px] text-muted-foreground">Layout visual das células de produção</p></div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setView3D(v=>!v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${view3D?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground hover:bg-accent"}`}><Boxes className="w-4 h-4" /> {view3D?"Ver 2D":"Ver 3D"}</button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Novo elemento</button>
        </div>
      </div>

      <div className="flex gap-2">
        {[["select","Selecionar", MousePointer2],["add","Adicionar", Plus]].map(([k,l,Icon]) => (
          <button key={k} onClick={()=>k==="add"?openNew():setTool(k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${tool===k|| (k==="add"&&modalOpen) ?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground hover:bg-accent"}`}><Icon className="w-3.5 h-3.5" />{l}</button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1"><Square className="w-3 h-3 text-blue-500" /> Bancadas ({items.filter(m=>m.element_type==="bancada").length})</span>
          <span className="flex items-center gap-1"><Minus className="w-3 h-3 text-amber-500" /> Faixas ({items.filter(m=>["faixa","corredor","seta"].includes(m.element_type)).length})</span>
          <span>Itens visuais: {layouts.length}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 panel p-0 overflow-hidden">
          {view3D ? (
            <Mapa3D items={items} assets={assets} areas={areas} equipment={[]} />
          ) : (
          <div ref={canvasRef} className="relative w-full" style={{ minHeight: 420, backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
            {items.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Nenhum elemento no mapa. Adicione bancadas, faixas e corredores.</div>
            ) : items.map(m => {
              const isLine = ["faixa","corredor","seta","separador","limite"].includes(m.element_type);
              return (
                <div key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`absolute cursor-pointer rounded transition-shadow ${selected===m.id?"ring-2 ring-primary":"hover:ring-1 hover:ring-primary/50"} ${isLine?"":"border border-foreground/20"}`}
                  style={{
                    left: m.pos_x, top: m.pos_y,
                    width: isLine ? (m.length || 100) : m.width,
                    height: isLine ? (m.thickness || 6) : m.height,
                    background: isLine ? m.color : `${m.color}22`,
                    borderColor: m.color,
                    transform: m.orientation === "vertical" ? "rotate(90deg)" : "none",
                    transformOrigin: "top left",
                  }}
                  title={m.name}
                />
              );
            })}
          </div>
          )}
        </div>
        <div className="panel p-4 lg:col-span-1">
          <p className="label-section mb-3">Elementos ({items.length})</p>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {items.length===0 ? <p className="text-[12px] text-muted-foreground">Vazio.</p> : items.map(m => (
              <div key={m.id} className={`flex items-center justify-between px-2 py-1.5 rounded ${selected===m.id?"bg-muted":"hover:bg-muted/50"}`}>
                <button onClick={()=>setSelected(m.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  <span className="w-3 h-3 rounded shrink-0" style={{ background: m.color }} />
                  <span className="text-[12px] truncate">{m.name}</span>
                </button>
                <div className="flex gap-0.5">
                  <button onClick={()=>openEdit(m)} className="p-1 text-muted-foreground hover:text-primary"><Pencil className="w-3 h-3" /></button>
                  <button onClick={()=>del(m.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
          {selected && (() => { const m = items.find(x=>x.id===selected); return m ? (
            <div className="mt-3 pt-3 border-t border-border text-[12px] text-muted-foreground space-y-1">
              <p><b className="text-foreground">{ET[m.element_type]||m.element_type}:</b> {m.name}</p>
              <p>{AT[m.area_type]||"—"}{m.cell ? ` · ${m.cell}` : ""}</p>
              <p>{m.width||0}×{m.height||0}{m.length?` L=${m.length}`:""} · ({m.pos_x},{m.pos_y})</p>
              <StatusBadge value={m.status} />
            </div>
          ) : null; })()}
        </div>
      </div>

      <FormDialog title={editing?"Editar Elemento":"Novo Elemento"} open={modalOpen} onClose={close} wide
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome" required><input className={inputCls} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
          <Field label="Tipo"><select className={inputCls} value={form.element_type} onChange={e=>setForm({...form,element_type:e.target.value})}>{Object.entries(ET).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Cor"><input type="color" className={`${inputCls} h-10 p-1`} value={form.color} onChange={e=>setForm({...form,color:e.target.value})} /></Field>
          <Field label="Tipo de área"><select className={inputCls} value={form.area_type} onChange={e=>setForm({...form,area_type:e.target.value})}>{Object.entries(AT).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Largura (px)"><input type="number" className={inputCls} value={form.width} onChange={e=>setForm({...form,width:+e.target.value})} /></Field>
          <Field label="Altura (px)"><input type="number" className={inputCls} value={form.height} onChange={e=>setForm({...form,height:+e.target.value})} /></Field>
          <Field label="Comprimento (faixas)"><input type="number" className={inputCls} value={form.length||""} onChange={e=>setForm({...form,length:+e.target.value})} /></Field>
          <Field label="Espessura (faixas)"><input type="number" className={inputCls} value={form.thickness||""} onChange={e=>setForm({...form,thickness:+e.target.value})} /></Field>
          <Field label="Posição X"><input type="number" className={inputCls} value={form.pos_x} onChange={e=>setForm({...form,pos_x:+e.target.value})} /></Field>
          <Field label="Posição Y"><input type="number" className={inputCls} value={form.pos_y} onChange={e=>setForm({...form,pos_y:+e.target.value})} /></Field>
          <Field label="Orientação"><select className={inputCls} value={form.orientation} onChange={e=>setForm({...form,orientation:e.target.value})}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></Field>
          <Field label="Célula"><input className={inputCls} value={form.cell} onChange={e=>setForm({...form,cell:e.target.value})} /></Field>
          <div className="sm:col-span-2"><Field label="Observações"><textarea className={inputCls} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></Field></div>
        </div>
      </FormDialog>
    </div>
  );
}