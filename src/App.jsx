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
const PredictiveAI = React.lazy(() => import("./pages/PredictiveAI"));
const DailyPassword = React.lazy(() => import("./pages/DailyPassword"));

// Prefetch das páginas mais usadas após o app estar idle
function prefetchPages() {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => {
      import("./pages/ProductionControl");
      import("./pages/LossControl");
      import("./pages/Occurrences");
    }, { timeout: 3000 });
  }
}

// Spinner reutilizável — fora do componente para evitar recriação a cada render
const PageLoader = () => (
  <div className="flex items-center justify-center h-40">
    <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

function AppShell() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    if (profiles.length > 0) setProfile(profiles[0]);
    setLoading(false);
    // Pré-carrega páginas mais usadas enquanto o usuário vê o Dashboard
    prefetchPages();
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

  return (
    <Routes>
      <Route element={<AppLayout profile={profile} onProfileSaved={loadProfile} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tarefas" element={<React.Suspense fallback={<PageLoader />}><Tasks /></React.Suspense>} />
        <Route path="/testores" element={<React.Suspense fallback={<PageLoader />}><Testores /></React.Suspense>} />
        <Route path="/ocorrencias" element={<React.Suspense fallback={<PageLoader />}><Occurrences /></React.Suspense>} />
        <Route path="/checklist" element={<React.Suspense fallback={<PageLoader />}><Checklist /></React.Suspense>} />
        <Route path="/passagem-turno" element={<React.Suspense fallback={<PageLoader />}><ShiftHandoff /></React.Suspense>} />
        <Route path="/manutencao" element={<React.Suspense fallback={<PageLoader />}><Maintenance /></React.Suspense>} />
        <Route path="/relatorios" element={<React.Suspense fallback={<PageLoader />}><Reports /></React.Suspense>} />
        <Route path="/controle-perdas" element={<React.Suspense fallback={<PageLoader />}><LossControl /></React.Suspense>} />
        <Route path="/controle-producao" element={<React.Suspense fallback={<PageLoader />}><ProductionControl /></React.Suspense>} />
        <Route path="/ia-preditiva" element={<React.Suspense fallback={<PageLoader />}><PredictiveAI /></React.Suspense>} />
        <Route path="/senha-diaria" element={<React.Suspense fallback={<PageLoader />}><DailyPassword /></React.Suspense>} />
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