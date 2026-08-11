import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowRight, LogOut, Settings, Grid3x3 } from "lucide-react";
import { getIcon, getColor } from "@/lib/appIcons";

/**
 * Central de Aplicações — portal/launcher corporativo.
 *
 * Arquitetura:
 * - As aplicações são registros da entidade AvailableApp (admin-managed), ordenados por `ordem`.
 * - tipo "route"  -> navegação interna (SPA). Ex: ZP7 em /zp7.
 * - tipo "url"    -> abre aplicação externa em nova aba. Ex: Chefinho.
 *
 * Single sign-on: o portal e o ZP7 compartilham a mesma sessão Base44 (mesmo app).
 * Para aplicações externas, a função `launchApp` está preparada para, no futuro,
 * anexar um token de sessão compartilhado — por enquanto apenas redireciona.
 */
export default function CentralApplications({ profile }) {
  const navigate = useNavigate();

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["available-apps"],
    queryFn: () => base44.entities.AvailableApp.list("ordem"),
    staleTime: 60 * 1000,
  });

  const isAdmin = profile?.funcao === "administrador";

  const activeApps = useMemo(() => apps.filter(a => a.status === "ativo"), [apps]);

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/";
  };

  const launchApp = (app) => {
    if (app.status !== "ativo") return;
    if (app.tipo === "route") {
      navigate(app.target);
    } else if (app.tipo === "url") {
      if (!app.target) {
        alert("Endereço da aplicação ainda não configurado. Contate o administrador.");
        return;
      }
      // Futuro: anexar token de sessão compartilhada para SSO entre apps.
      const sep = app.target.includes("?") ? "&" : "?";
      const url = app.target; // + `${sep}zp7_sso=${token}`
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header corporativo */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center shrink-0">
              <Grid3x3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold leading-none tracking-tight">Volkswagen Taubaté</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Central de Aplicações</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold">
                {(profile?.nome || profile?.user_email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="leading-none text-left">
                <p className="text-xs font-semibold text-slate-800">{profile?.nome || profile?.user_email}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 capitalize">{profile?.funcao}</p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate("/central/gerenciar")}
                title="Gerenciar aplicações"
                className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-blue-700 flex items-center justify-center transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleLogout}
              title="Sair"
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Selecione uma aplicação</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Escolha o sistema que deseja utilizar para iniciar sua jornada operacional.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[1, 2].map(i => (
              <div key={i} className="h-48 rounded-2xl border border-slate-200 bg-white animate-pulse" />
            ))}
          </div>
        ) : activeApps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Settings className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Nenhuma aplicação disponível.</p>
            <p className="text-sm text-slate-400 mt-1">
              {isAdmin
                ? "Use o ícone de configurações no topo para cadastrar aplicações."
                : "Contate o administrador do sistema."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {activeApps.map(app => {
              const Icon = getIcon(app.icon);
              const color = getColor(app.cor);
              const enabled = app.status === "ativo";
              return (
                <div
                  key={app.id}
                  className={`group bg-white rounded-2xl border border-slate-200 shadow-sm transition-all duration-200 overflow-hidden ${
                    enabled ? "hover:shadow-xl hover:-translate-y-1 hover:border-blue-300" : "opacity-60"
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div className={`w-14 h-14 rounded-xl ${color.tile} flex items-center justify-center ring-1 ${color.ring} transition-transform group-hover:scale-105`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                        enabled
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {enabled ? "● Disponível" : "○ Indisponível"}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">{app.nome}</h3>
                    {app.descricao && (
                      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{app.descricao}</p>
                    )}

                    <button
                      onClick={() => launchApp(app)}
                      disabled={!enabled}
                      className={`mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                        enabled
                          ? `${color.btn} text-white`
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      Acessar <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-semibold text-slate-500">ZP7 · Volkswagen Taubaté</span>
          <span>Portal de Aplicações Corporativo</span>
        </div>
      </footer>
    </div>
  );
}