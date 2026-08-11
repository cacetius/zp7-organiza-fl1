import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Database, Factory, Layers, Grid3x3, Users, Plus, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import FormDialog, { Field, inputCls, BtnSave, BtnCancel, StatusBadge } from "@/components/chefinho/FormDialog";

/* Página de administração da hierarquia: Fábrica > Área > Célula > Equipe */
export default function DataAdmin() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState({});
  const [modal, setModal] = useState(null); // { kind, parent, editing, form }
  const [saving, setSaving] = useState(false);

  const { data: factories = [] } = useQuery({ queryKey: ["chef-factories-adm"], queryFn: () => base44.entities.ChefFactory.list() });
  const { data: areas = [] } = useQuery({ queryKey: ["chef-areas-adm"], queryFn: () => base44.entities.ChefArea.list() });
  const { data: cells = [] } = useQuery({ queryKey: ["chef-cells-adm"], queryFn: () => base44.entities.ChefCell.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["chef-teams-adm"], queryFn: () => base44.entities.ChefTeam.list() });

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const openNew = (kind, parentId = {}) => {
    const base = { name: "", code: "", status: "active", description: "", responsible: "", ...parentId };
    setModal({ kind, editing: null, form: base });
  };
  const openEdit = (kind, item, parentId = {}) => { setModal({ kind, editing: item.id, form: { ...item, ...parentId } }); };
  const close = () => setModal(null);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const { kind, editing, form } = modal;
      const entMap = { factory: base44.entities.ChefFactory, area: base44.entities.ChefArea, cell: base44.entities.ChefCell, team: base44.entities.ChefTeam };
      if (editing) await entMap[kind].update(editing, form);
      else await entMap[kind].create(form);
      qc.invalidateQueries([["chef-factories-adm"],["chef-areas-adm"],["chef-cells-adm"],["chef-teams-adm"]].flat());
      close();
    } finally { setSaving(false); }
  };
  const del = async (kind, id) => {
    if (!confirm("Excluir? Itens filhos podem ficar órfãos.")) return;
    const entMap = { factory: base44.entities.ChefFactory, area: base44.entities.ChefArea, cell: base44.entities.ChefCell, team: base44.entities.ChefTeam };
    await entMap[kind].delete(id);
    qc.invalidateQueries([["chef-factories-adm"],["chef-areas-adm"],["chef-cells-adm"],["chef-teams-adm"]].flat());
  };

  const FACTORIES_KEY = "f";
  const areasOf = (fid) => areas.filter(a => a.factory_id === fid);
  const cellsOf = (aid) => cells.filter(c => c.area_id === aid);
  const teamsOf = (cid) => teams.filter(t => t.cell_id === cid);

  const Row = ({ icon: Icon, level, name, code, status, onExpand, expandedState, onEdit, onDelete, onAdd, addLabel, children }) => (
    <div>
      <div className={`flex items-center gap-2 px-3 py-2 hover:bg-muted/40 ${level===0?"border-b border-border":""}`} style={{ paddingLeft: 12 + level*20 }}>
        {onExpand ? (
          <button onClick={onExpand} className="p-0.5 text-muted-foreground hover:text-foreground">{expandedState ? <ChevronDown className="w-3.5 h-3.5"/> : <ChevronRight className="w-3.5 h-3.5"/>}</button>
        ) : <div className="w-3" />}
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground truncate">{name || "—"}</p>{code && <p className="text-[11px] text-muted-foreground">{code}</p>}</div>
        <StatusBadge value={status} />
        {onAdd && <button onClick={onAdd} className="px-2 py-1 rounded text-[11px] text-primary hover:bg-primary/10">+ {addLabel}</button>}
        <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-primary rounded"><Pencil className="w-3.5 h-3.5"/></button>
        <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive rounded"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>
      {expandedState && children}
    </div>
  );

  const fieldsFor = (kind) => {
    if (kind === "factory") return [
      <>
        <Field label="Nome" required><input className={inputCls} value={modal.form.name} onChange={e=>setModal({...modal,form:{...modal.form,name:e.target.value}})} /></Field>
        <Field label="Código" required><input className={inputCls} value={modal.form.code} onChange={e=>setModal({...modal,form:{...modal.form,code:e.target.value}})} /></Field>
        <Field label="Responsável"><input className={inputCls} value={modal.form.responsible||""} onChange={e=>setModal({...modal,form:{...modal.form,responsible:e.target.value}})} /></Field>
        <Field label="Status"><select className={inputCls} value={modal.form.status} onChange={e=>setModal({...modal,form:{...modal.form,status:e.target.value}})}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></Field>
      </>,
    ];
    if (kind === "area") return [
      <>
        <Field label="Nome" required><input className={inputCls} value={modal.form.name} onChange={e=>setModal({...modal,form:{...modal.form,name:e.target.value}})} /></Field>
        <Field label="Código" required><input className={inputCls} value={modal.form.code} onChange={e=>setModal({...modal,form:{...modal.form,code:e.target.value}})} /></Field>
        <Field label="Responsável"><input className={inputCls} value={modal.form.responsible||""} onChange={e=>setModal({...modal,form:{...modal.form,responsible:e.target.value}})} /></Field>
        <Field label="Cor"><input type="color" className={`${inputCls} h-10 p-1`} value={modal.form.color||"#3b82f6"} onChange={e=>setModal({...modal,form:{...modal.form,color:e.target.value}})} /></Field>
      </>,
    ];
    if (kind === "cell") return [
      <>
        <Field label="Nome" required><input className={inputCls} value={modal.form.name} onChange={e=>setModal({...modal,form:{...modal.form,name:e.target.value}})} /></Field>
        <Field label="Código" required><input className={inputCls} value={modal.form.code} onChange={e=>setModal({...modal,form:{...modal.form,code:e.target.value}})} /></Field>
        <Field label="Responsável"><input className={inputCls} value={modal.form.responsible||""} onChange={e=>setModal({...modal,form:{...modal.form,responsible:e.target.value}})} /></Field>
      </>,
    ];
    if (kind === "team") return [
      <>
        <Field label="Nome" required><input className={inputCls} value={modal.form.name} onChange={e=>setModal({...modal,form:{...modal.form,name:e.target.value}})} /></Field>
        <Field label="Código" required><input className={inputCls} value={modal.form.code} onChange={e=>setModal({...modal,form:{...modal.form,code:e.target.value}})} /></Field>
        <Field label="Turno"><select className={inputCls} value={modal.form.shift||""} onChange={e=>setModal({...modal,form:{...modal.form,shift:e.target.value}})}><option value="">—</option>{["A","B","C","D"].map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Líder"><input className={inputCls} value={modal.form.leader||""} onChange={e=>setModal({...modal,form:{...modal.form,leader:e.target.value}})} /></Field>
      </>,
    ];
    return [];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><Database className="w-5 h-5 text-primary" />Administração de Dados</h1>
          <p className="text-[13px] text-muted-foreground">Hierarquia: Fábrica › Área › Célula › Equipe</p></div>
        <button onClick={()=>openNew("factory")} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4"/> Fábrica</button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{icon:Factory,l:"Fábricas",v:factories.length},{icon:Layers,l:"Áreas",v:areas.length},{icon:Grid3x3,l:"Células",v:cells.length},{icon:Users,l:"Equipes",v:teams.length}].map(k=>(
          <div key={k.l} className="panel p-3 flex items-center gap-2.5"><k.icon className="w-5 h-5 text-muted-foreground"/><div><p className="text-xl font-semibold tabular-nums leading-none">{k.v}</p><p className="text-[11px] text-muted-foreground mt-1">{k.l}</p></div></div>
        ))}
      </div>

      <div className="panel">
        {factories.length===0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma fábrica. Clique em "Fábrica" para começar.</div> : (
          <div>
            {factories.map(f => {
              const fKey = `${FACTORIES_KEY}-${f.id}`;
              const fExp = expanded[fKey];
              const fAreas = areasOf(f.id);
              return (
                <Row key={f.id} level={0} icon={Factory} name={f.name} code={f.code} status={f.status}
                  onExpand={()=>toggle(fKey)} expandedState={fExp}
                  onEdit={()=>openEdit("factory",f)} onDelete={()=>del("factory",f.id)}
                  onAdd={()=>openNew("area",{factory_id:f.id})} addLabel="Área">
                  <div>
                    {fAreas.length===0 ? <p className="text-[12px] text-muted-foreground py-2" style={{paddingLeft:60}}>Nenhuma área.</p> :
                    fAreas.map(a => {
                      const aKey = `a-${a.id}`; const aExp = expanded[aKey]; const aCells = cellsOf(a.id);
                      return (
                        <Row key={a.id} level={1} icon={Layers} name={a.name} code={a.code} status={a.status}
                          onExpand={()=>toggle(aKey)} expandedState={aExp}
                          onEdit={()=>openEdit("area",a,{factory_id:f.id})} onDelete={()=>del("area",a.id)}
                          onAdd={()=>openNew("cell",{area_id:a.id,factory_id:f.id})} addLabel="Célula">
                          <div>
                            {aCells.length===0 ? <p className="text-[12px] text-muted-foreground py-2" style={{paddingLeft:80}}>Nenhuma célula.</p> :
                            aCells.map(c => {
                              const cKey = `c-${c.id}`; const cExp = expanded[cKey]; const cTeams = teamsOf(c.id);
                              return (
                                <Row key={c.id} level={2} icon={Grid3x3} name={c.name} code={c.code} status={c.status}
                                  onExpand={()=>toggle(cKey)} expandedState={cExp}
                                  onEdit={()=>openEdit("cell",c,{area_id:a.id,factory_id:f.id})} onDelete={()=>del("cell",c.id)}
                                  onAdd={()=>openNew("team",{cell_id:c.id,area_id:a.id,factory_id:f.id})} addLabel="Equipe">
                                  <div>
                                    {cTeams.length===0 ? <p className="text-[12px] text-muted-foreground py-2" style={{paddingLeft:100}}>Nenhuma equipe.</p> :
                                    cTeams.map(t => (
                                      <Row key={t.id} level={3} icon={Users} name={t.name} code={t.code} status={t.status}
                                        onEdit={()=>openEdit("team",t,{cell_id:c.id,area_id:a.id,factory_id:f.id})} onDelete={()=>del("team",t.id)} />
                                    ))}
                                  </div>
                                </Row>
                              );
                            })}
                          </div>
                        </Row>
                      );
                    })}
                  </div>
                </Row>
              );
            })}
          </div>
        )}
      </div>

      <FormDialog
        title={modal?.editing ? "Editar" : "Novo"}
        open={!!modal}
        onClose={close}
        footer={<><BtnCancel onClick={close}/><BtnSave loading={saving} onClick={save}/></>}>
        {modal && (
          <div className="grid sm:grid-cols-2 gap-3">
            {fieldsFor(modal.kind)}
            <div className="sm:col-span-2"><Field label="Descrição"><textarea className={inputCls} rows={2} value={modal.form.description||""} onChange={e=>setModal({...modal,form:{...modal.form,description:e.target.value}})} /></Field></div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}