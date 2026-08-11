import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

import AppLayout from "./components/layout/AppLayout";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import CentralApplications from "./pages/CentralApplications";
import ManageApplications from "./pages/ManageApplications";

// Chefinho — aplicação interna reconstruída sob /chefinho/*
import ChefLayout from "./components/chefinho/ChefLayout";
import ChefDashboard from "./pages/chefinho/Dashboard";
import ChefEmBreve from "./pages/chefinho/EmBreve";

// Lazy load de todas as páginas secundárias — carregam só quando o usuário navegar
const Tasks = React.lazy(() => import("./pages/Tasks"));
const Testores = React.lazy(() => import("./pages/Testores"));
const Occurrences = React.lazy(() => import("./pages/Occurrences"));
const Checklist = React.lazy(() => import("./pages/Checklist"));
const ShiftHandoff = React.lazy(() => import("./pages/ShiftHandoff"));
const Maintenance = React.lazy(() => import("./pages/Maintenance"));
const Reports = React.lazy(() => import("./pages/Reports"));
const LossControl = React.lazy(() => import("./pages/LossControl"));
const ProductionControl = React.lazy(() => import("./pages/ProductionControl"));

function AppShell() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      if (profiles.length > 0) setProfile(profiles[0]);
    } catch (err) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary mx-auto flex items-center justify-center">
            <span className="text-primary-foreground font-black text-lg">ZP7</span>
          </div>
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Onboarding onComplete={loadProfile} />;
  }

  const PageLoader = () => (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <Routes>
      {/* Central de Aplicações — portal externo ao núcleo do ZP7 */}
      <Route path="/central/gerenciar" element={<ManageApplications profile={profile} />} />
      <Route path="/" element={<CentralApplications profile={profile} />} />

      {/* Núcleo do ZP7 — aplicação independente, abragida pelo portal */}
      <Route element={<AppLayout profile={profile} onProfileSaved={loadProfile} />}>
        <Route path="/zp7" element={<Dashboard />} />
        <Route path="/tarefas" element={<React.Suspense fallback={<PageLoader />}><Tasks /></React.Suspense>} />
        <Route path="/testores" element={<React.Suspense fallback={<PageLoader />}><Testores /></React.Suspense>} />
        <Route path="/ocorrencias" element={<React.Suspense fallback={<PageLoader />}><Occurrences /></React.Suspense>} />
        <Route path="/checklist" element={<React.Suspense fallback={<PageLoader />}><Checklist /></React.Suspense>} />
        <Route path="/passagem-turno" element={<React.Suspense fallback={<PageLoader />}><ShiftHandoff /></React.Suspense>} />
        <Route path="/manutencao" element={<React.Suspense fallback={<PageLoader />}><Maintenance /></React.Suspense>} />
        <Route path="/relatorios" element={<React.Suspense fallback={<PageLoader />}><Reports /></React.Suspense>} />
        <Route path="/controle-perdas" element={<React.Suspense fallback={<PageLoader />}><LossControl /></React.Suspense>} />
        <Route path="/controle-producao" element={<React.Suspense fallback={<PageLoader />}><ProductionControl /></React.Suspense>} />
      </Route>
      {/* Chefinho GLSI — reconstruído internamente sob /chefinho/* */}
      <Route element={<ChefLayout />}>
        <Route path="/chefinho" element={<ChefDashboard />} />
        <Route path="/chefinho/centro-risco" element={<ChefEmBreve nome="Centro de Risco" />} />
        <Route path="/chefinho/auditoria-rapida" element={<ChefEmBreve nome="Auditoria Rápida" />} />
        <Route path="/chefinho/auditorias" element={<ChefEmBreve nome="Auditorias" />} />
        <Route path="/chefinho/nao-conformidades" element={<ChefEmBreve nome="Não Conformidades" />} />
        <Route path="/chefinho/gestao-visual" element={<ChefEmBreve nome="Gestão Visual" />} />
        <Route path="/chefinho/modelos" element={<ChefEmBreve nome="Modelos" />} />
        <Route path="/chefinho/mapa" element={<ChefEmBreve nome="Mapa Digital" />} />
        <Route path="/chefinho/painel-fabrica" element={<ChefEmBreve nome="Painel Fábrica" />} />
        <Route path="/chefinho/equipamentos" element={<ChefEmBreve nome="Equipamentos" />} />
        <Route path="/chefinho/calibracao" element={<ChefEmBreve nome="Calibração" />} />
        <Route path="/chefinho/epis" element={<ChefEmBreve nome="EPIs" />} />
        <Route path="/chefinho/quadro-monitor" element={<ChefEmBreve nome="Quadro Monitor" />} />
        <Route path="/chefinho/calendario" element={<ChefEmBreve nome="Calendário" />} />
        <Route path="/chefinho/relatorios" element={<ChefEmBreve nome="Relatórios" />} />
        <Route path="/chefinho/chefinho-ia" element={<ChefEmBreve nome="Chefinho IA" />} />
        <Route path="/chefinho/notificacoes" element={<ChefEmBreve nome="Notificações" />} />
        <Route path="/chefinho/admin-dados" element={<ChefEmBreve nome="Administração de Dados" />} />
        <Route path="/chefinho/perfil" element={<ChefEmBreve nome="Perfil" />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === "user_not_registered") return <UserNotRegisteredError />;
    if (authError.type === "auth_required") {
      navigateToLogin();
      return null;
    }
  }

  return <AppShell />;
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;