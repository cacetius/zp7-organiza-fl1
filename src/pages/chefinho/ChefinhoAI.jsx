import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, Send, Sparkles } from "lucide-react";

const SUGGEST = [
  "Como está o índice de conformidade?",
  "Quais equipamentos estão vencidos?",
  "Liste as NCs críticas em aberto",
  "Sumarize o status das auditorias",
];

export default function ChefinhoAI() {
  const [messages, setMessages] = useState([{ role: "bot", text: "Olá! Sou o Chefinho IA. Posso analisar auditorias, NCs, calibrações e ativos. Pergunte algo 👇" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const gatherContext = async () => {
    const [audits, ncs, plans, assets, maint, calib, tools] = await Promise.all([
      base44.entities.ChefAudit.list("-created_date", 50),
      base44.entities.ChefNonConformity.list("-created_date", 50),
      base44.entities.ChefActionPlan.list("-created_date", 50),
      base44.entities.ChefAsset.list("-created_date", 100),
      base44.entities.ChefMaintenanceOrder.list("-created_date", 50),
      base44.entities.ChefCalibration.list("-calibration_date", 50),
      base44.entities.ChefTool.list("-created_date", 100),
    ]);
    const done = audits.filter(a => a.status === "completed").length;
    const appro = audits.filter(a => a.result === "approved").length;
    return {
      auditorias: { total: audits.length, concluidas: done, aprovadas: appro, conformidade: done>0?Math.round(appro/done*100):0, planejadas: audits.filter(a=>a.status==="planned").length },
      ncs: { total: ncs.length, abertas: ncs.filter(n=>["open","in_progress"].includes(n.status)).length, criticas: ncs.filter(n=>n.severity==="critical").length },
      planos: { total: plans.length, pendentes: plans.filter(p=>["pending","in_progress"].includes(p.status)).length },
      ativos: { total: assets.length, criticos: assets.filter(a=>a.criticality==="critical").length, em_manutencao: assets.filter(a=>a.status==="maintenance").length },
      ferramentas: { total: tools.length, em_calibracao: tools.filter(t=>t.status==="calibration").length },
      manut: { total: maint.length, abertas: maint.filter(m=>["planned","in_progress"].includes(m.status)).length },
      calib: { total: calib.length, vencidas: calib.filter(c=>c.status==="expired").length, validas: calib.filter(c=>c.status==="valid").length },
    };
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setMessages(m => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const ctx = await gatherContext();
      const prompt = `Você é o "Chefinho IA", assistente de gestão industrial de qualidade/manutenção. Use EXCLUSIVAMENTE este contexto em JSON para responder de forma objetiva e em português.\n\nContexto:\n${JSON.stringify(ctx)}\n\nPergunta: ${q}`;
      const res = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: { type: "object", properties: { resposta: { type: "string" } }, required: ["resposta"] } });
      const texto = res?.resposta || "Não consegui processar agora.";
      setMessages(m => [...m, { role: "bot", text: texto }]);
    } catch (e) {
      setMessages(m => [...m, { role: "bot", text: "Erro ao consultar a IA. Tente novamente." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div><h1 className="text-lg font-semibold flex items-center gap-2"><Bot className="w-5 h-5 text-primary" />Chefinho IA</h1>
        <p className="text-[13px] text-muted-foreground">Assistente que analisa os dados do Chefinho em tempo real</p></div>

      <div className="panel flex flex-col" style={{ minHeight: "60vh" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                {m.role === "bot" && <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-primary" />}
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start"><div className="bg-muted px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm text-muted-foreground">Chefinho está pensando...</div></div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {SUGGEST.map(s => <button key={s} onClick={()=>send(s)} className="px-3 py-1.5 rounded-full bg-muted text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground">{s}</button>)}
          </div>
        )}

        <div className="border-t border-border p-3 flex gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==="Enter") send(); }}
            placeholder="Pergunte sobre auditorias, NCs, calibrações..."
            className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={()=>send()} disabled={loading} className="px-3 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium">
            <Send className="w-4 h-4" /> <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </div>
    </div>
  );
}