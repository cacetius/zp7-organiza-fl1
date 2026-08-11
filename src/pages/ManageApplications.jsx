import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Plus, Trash2, Pencil, X, Save, Power } from "lucide-react";
import { APP_ICON_OPTIONS, APP_COLOR_OPTIONS, getIcon, getColor } from "@/lib/appIcons";

const EMPTY = {
  nome: "", descricao: "", sistema_key: "", icon: "factory",
  cor: "blue", tipo: "route", target: "", status: "ativo", ordem: 0,
};

export default function ManageApplications({ profile }) {
  const navigate = useNavigate();
  const isAdmin = profile?.funcao === "administrador";

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["available-apps-admin"],
    queryFn: () => base44.entities.AvailableApp.list("ordem"),
    staleTime: 30 * 1000,
  });

  const [editing, setEditing] = useState(null); // objeto em edição ou null
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/");
  }, [isLoading, isAdmin, navigate]);

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.AvailableApp.create(data),
    onSuccess: () => { setEditing(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, fields }) => base44.entities.AvailableApp.update(id, fields),
    onSuccess: () => { setEditing(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.AvailableApp.delete(id),
  });

  const sorted = useMemo(() => [...apps].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)), [apps]);

  const openNew = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit = (app) => { setForm({ ...EMPTY, ...app }); setEditing(app.id); };
  const save = () => {
    if (!form.nome || !form.sistema_key || !form.target) return;
    const { id, created_date, updated_date, created_by_id, ...fields } = form;
    if (editing === "new") createMut.mutate(fields);
    else updateMut.mutate({ id: editing, fields });
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[15px] font-bold leading-none">Gerenciar Aplicações</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Painel administrativo</p>
            </div>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova aplicação
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-white border border-slate-200 animate-pulse" />)}</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Aplicação</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Tipo</th>
                  <th className="px-4 py-3 hidden md:table-cell">Destino</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-10">Nenhuma aplicação cadastrada.</td></tr>
                ) : sorted.map(app => {
                  const Icon = getIcon(app.icon);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg ${getColor(app.cor).tile} flex items-center justify-center shrink-0`}>
                            <Icon className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{app.nome}</p>
                            <p className="text-[11px] text-slate-400 truncate">ordem {app.ordem ?? 0}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${app.tipo === "route" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                          {app.tipo === "route" ? "Interna" : "Externa"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-[12px] max-w-[220px] truncate">{app.target}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${app.status === "ativo" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {app.status === "ativo" ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => base44.entities.AvailableApp.update(app.id, { status: app.status === "ativo" ? "inativo" : "ativo" })}
                            title={app.status === "ativo" ? "Desativar" : "Ativar"}
                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(app)}
                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-center transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Remover "${app.nome}"?`)) deleteMut.mutate(app.id); }}
                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">{editing === "new" ? "Nova aplicação" : "Editar aplicação"}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Nome">
                <input className="input-base" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: ZP7 Organização" />
              </Field>
              <Field label="Descrição">
                <textarea rows={2} className="input-base resize-none" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição curta exibida no portal" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Identificador (sistema_key)">
                  <input className="input-base" value={form.sistema_key} onChange={e => setForm({ ...form, sistema_key: e.target.value })} placeholder="zp7, chefinho..." disabled={editing !== "new"} />
                </Field>
                <Field label="Ordem">
                  <input type="number" className="input-base" value={form.ordem} onChange={e => setForm({ ...form, ordem: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ícone">
                  <select className="input-base" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}>
                    {APP_ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </select>
                </Field>
                <Field label="Cor">
                  <select className="input-base" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}>
                    {APP_COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <select className="input-base" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="route">Interna (rota)</option>
                    <option value="url">Externa (URL)</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select className="input-base" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </Field>
              </div>
              <Field label={form.tipo === "route" ? "Rota interna" : "URL externa"}>
                <input className="input-base" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} placeholder={form.tipo === "route" ? "/zp7" : "https://chefinho.exemplo.com"} />
              </Field>

              {/* Preview */}
              <div className="pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Pré-visualização</p>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-lg ${getColor(form.cor).tile} flex items-center justify-center`}>
                    {(() => { const I = getIcon(form.icon); return <I className="w-5 h-5" />; })()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{form.nome || "Nome da aplicação"}</p>
                    <p className="text-xs text-slate-500 truncate">{form.descricao || "Descrição exibida no portal"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white">Cancelar</button>
              <button
                onClick={save}
                disabled={!form.nome || !form.sistema_key || !form.target}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input-base {
          width: 100%; border: 1px solid #cbd5e1; background: #fff; color: #0f172a;
          border-radius: 0.5rem; padding: 0.5rem 0.7rem; font-size: 0.875rem; outline: none;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .input-base:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.12); }
        .input-base:disabled { background: #f1f5f9; color: #94a3b8; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}