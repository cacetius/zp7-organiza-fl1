import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import { ThemeProvider } from "@/lib/ThemeContext";

export default function AppLayout({ profile, onProfileSaved }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background flex">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-64'}`}>
          <TopBar
            onMenuClick={() => setSidebarOpen(true)}
            profile={profile}
            onProfileSaved={onProfileSaved}
          />
          <main className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6 overflow-auto" style={{ overscrollBehavior: "contain" }}>
            <div className="max-w-screen-2xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </ThemeProvider>
  );
}