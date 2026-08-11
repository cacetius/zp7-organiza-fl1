import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, Check, Trash2, BellOff } from "lucide-react";

const TYPE_ICON = { audit: "📋", maintenance: "🔧", calibration: "⚖️", nc: "⚠️", action_plan: "✅", alert: "🚨", info: "ℹ️" };
const PRIO = { critical: "badge-danger", high: "badge-danger", medium: "badge-warning", low: "badge-neutral" };

export default function Notifications() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("unread");

  const { data: all = [] } = useQuery({ queryKey: ["chef-notifs"], queryFn: () => base44.entities.ChefNotification.list("-created_date"), refetchInterval: 30000 });

  const filtered = tab === "unread" ? all.filter(n => !n.read) : all;

  const markRead = async (n) => { await base44.entities.ChefNotification.update(n.id, { read: true }); qc.invalidateQueries(["chef-notifs"]); };
  const markAllRead = async () => { await Promise.all(all.filter(n=>!n.read).map(n => base44.entities.ChefNotification.update(n.id, { read: true }))); qc.invalidateQueries(["chef-notifs"]); };
  const del = async (id) => { await base44.entities.ChefNotification.delete(id); qc.invalidateQueries(["chef-notifs"]); };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />Notificações</h1>
          <p className="text-[13px] text-muted-foreground">{all.filter(n=>!n.read).length} não lidas</p></div>
        <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm text-muted-foreground hover:bg-muted"><Check className="w-4 h-4" /> Marcar todas como lidas</button>
      </div>
      <div className="flex gap-2">
        {[["unread","Não lidas"],["all","Todas"]].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} className={`px-3 py-1.5 rounded text-xs font-medium ${tab===k?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground hover:bg-accent"}`}>{l}</button>
        ))}
      </div>
      <div className="panel">
        {filtered.length===0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <BellOff className="w-10 h-10 opacity-30" />
            <p className="text-sm">Nenhuma notificação.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(n => {
              const cls = PRIO[n.priority] || "badge-neutral";
              return (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${!n.read ? "bg-primary/5" : ""} hover:bg-muted/40`}>
                  <div className="text-lg shrink-0 mt-0.5">{TYPE_ICON[n.type] || "ℹ️"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!n.read ? "font-semibold text-foreground" : "text-foreground"}`}>{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      <span className={`${cls} ml-auto`}>{n.priority}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.read && <button onClick={()=>markRead(n)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"><Check className="w-3.5 h-3.5" /></button>}
                    <button onClick={()=>del(n.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}