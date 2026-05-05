import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { ThemeProvider } from "@/lib/ThemeContext";

export default function AppLayout({ profile, onProfileSaved }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
        <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-64'}`}>
          <TopBar
            onMenuClick={() => setSidebarOpen(true)}
            profile={profile}
            onProfileSaved={onProfileSaved}
          />
          <main className="p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}