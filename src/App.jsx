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
import Tasks from "./pages/Tasks";
import Testores from "./pages/Testores";
import Occurrences from "./pages/Occurrences";
import Checklist from "./pages/Checklist";
import ShiftHandoff from "./pages/ShiftHandoff";
import Maintenance from "./pages/Maintenance";
import PredictiveAI from "./pages/PredictiveAI";
import Reports from "./pages/Reports";
import DailyPassword from "./pages/DailyPassword";
import LossControl from "./pages/LossControl";
import ProductionControl from "./pages/ProductionControl";

function AppShell() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    if (profiles.length > 0) setProfile(profiles[0]);
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

  return (
    <Routes>
      <Route element={<AppLayout profile={profile} onProfileSaved={loadProfile} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tarefas" element={<Tasks />} />
        <Route path="/testores" element={<Testores />} />
        <Route path="/ocorrencias" element={<Occurrences />} />
        <Route path="/checklist" element={<Checklist />} />
        <Route path="/passagem-turno" element={<ShiftHandoff />} />
        <Route path="/manutencao" element={<Maintenance />} />
        <Route path="/ia-preditiva" element={<PredictiveAI />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/senha-diaria" element={<DailyPassword />} />
        <Route path="/controle-perdas" element={<LossControl />} />
        <Route path="/controle-producao" element={<ProductionControl />} />
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