import React, { useMemo, useState } from "react";
import { BrainCircuit, TrendingDown, AlertTriangle, CheckCircle2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

const SHIFT_HOURS = {
  primeiro: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00"],
  segundo:  ["15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","23:45"],
  terceiro: ["22:00","23:00","00:00","01:00","02:00","03:00","04:00","05:00","06:00"],
};

const DEFAULT_LOSS_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return null;
  const xs = ys.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  if (den === 0) return null;
  return { slope: num / den, intercept: yMean - (num / den) * xMean };
}

export default function ShiftDeviationForecast({ prodData, lossData, currentShiftKey }) {
  const [aiInsight, setAiInsight] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showInsight, setShowInsight] = useState(false);

  const forecast = useMemo(() => {
    const hours = SHIFT_HOURS[currentShiftKey] || [];
    if (!hours.length) return null;

    const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const nowStr = `${String(nowBrasilia.getHours()).padStart(2, "0")}:${String(nowBrasilia.getMinutes()).padStart(2, "0")}`;

    const horasPassadas = hours.filter(h => h <= nowStr);
    const horasRestantes = hours.filter(h => h > nowStr);
    if (horasPassadas.length === 0 || horasRestantes.length === 0) return null;

    const prodPorHora = horasPassadas.map(h =>
      prodData.filter(r => r.hora === h && r.testor_id !== "__objetivo__").reduce((s, r) => s + (r.carros_produzidos || 0), 0)
    );
    const perdasPorHora = horasPassadas.map(h => {
      const brutas = lossData.filter(l => l.motivo_perda !== "ganho" && l.item_perda && l.hora === h && (l.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(l.item_perda)).reduce((s, l) => s + (l.carros_perdidos || 0), 0);
      const ganhos = lossData.filter(l => l.motivo_perda === "ganho" && l.hora === h && (l.carros_perdidos || 0) > 0).reduce((s, l) => s + (l.carros_perdidos || 0), 0);
      return Math.max(0, brutas - ganhos);
    });

    const prodPassada = prodPorHora.reduce((a, b) => a + b, 0);
    const perdaRealPassada = perdasPorHora.reduce((a, b) => a + b, 0);
    const nPassadas = horasPassadas.length;
    const regProd = linearRegression(prodPorHora);
    const regPerd = linearRegression(perdasPorHora);

    let prodProjetada = 0, perdaProjetada = 0;
    for (let i = 0; i < horasRestantes.length; i++) {
      const x = nPassadas + i;
      prodProjetada += regProd ? Math.max(0, regProd.slope * x + regProd.intercept) : (prodPassada / nPassadas);
      perdaProjetada += regPerd ? Math.max(0, regPerd.slope * x + regPerd.intercept) : (perdaRealPassada / nPassadas);
    }

    const prodTotalPrevista = prodPassada + Math.round(prodProjetada);
    const perdaTotalPrevista = perdaRealPassada + Math.round(perdaProjetada);
    const liquidoFinalPrevisto = Math.max(0, prodTotalPrevista - perdaTotalPrevista);
    const objTotal = prodData.filter(r => r.testor_id === "__objetivo__").reduce((s, r) => s + (r.objetivo || 0), 0);
    const desvioVsObjetivo = objTotal > 0 ? liquidoFinalPrevisto - objTotal : null;
    const pctPrevisto = objTotal > 0 ? Math.round((liquidoFinalPrevisto / objTotal) * 100) : null;
    const tendenciaProd = regProd ? (regProd.slope > 0.2 ? "subindo" : regProd.slope < -0.2 ? "caindo" : "estavel") : "estavel";

    return { horasPassadas: nPassadas, horasRestantes: horasRestantes.length, prodPassada, liquidoFinalPrevisto, desvioVsObjetivo, pctPrevisto, objTotal, tendenciaProd, prodPorHora, perdasPorHora, taxaProdPorHora: Math.round((prodPassada / nPassadas) * 10) / 10 };
  }, [prodData, lossData, currentShiftKey]);

  const fetchAiInsight = async () => {
    if (!forecast) return;
    setLoadingAi(true); setShowInsight(true);
    try {
      const ctx = `Turno ZP7 — ${forecast.horasPassadas}h decorridas, ${forecast.horasRestantes}h restantes. Produção: ${forecast.prodPassada}. Taxa: ${forecast.taxaProdPorHora}/h. Tendência: ${forecast.tendenciaProd}. Projeção líquida: ${forecast.liquidoFinalPrevisto}. Meta: ${forecast.objTotal}. Desvio: ${forecast.desvioVsObjetivo ?? "sem meta"}. Meta prevista: ${forecast.pctPrevisto ?? "—"}%.`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Especialista em produção automotiva. Analise o turno ZP7 e dê UMA recomendação objetiva (máx 2 frases) para o líder recuperar ou manter a meta. Use linguagem de chão de fábrica.\n\n${ctx}`,
        model: "gemini_3_flash",
      });
      setAiInsight(typeof res === "string" ? res : res?.text || "Análise concluída.");
    } catch { setAiInsight("Não foi possível gerar a análise no momento."); }
    finally { setLoadingAi(false); }
  };

  if (!forecast || forecast.objTotal === 0) return null;

  const { pctPrevisto, desvioVsObjetivo, liquidoFinalPrevisto, horasRestantes, tendenciaProd } = forecast;
  const isOk = pctPrevisto >= 95;
  const isWarn = pctPrevisto >= 75 && pctPrevisto < 95;

  const StatusIcon = isOk ? CheckCircle2 : isWarn ? AlertTriangle : TrendingDown;
  const statusColor = isOk ? "text-green-500" : isWarn ? "text-amber-500" : "text-red-500";
  const barColor = isOk ? "bg-green-500" : isWarn ? "bg-amber-500" : "bg-red-500";
  const statusLabel = isOk ? "Meta atingível" : isWarn ? "Ritmo abaixo do esperado" : "Risco de não bater a meta";
  const tendenciaLabel = { subindo: "↗ Acelerando", caindo: "↘ Desacelerando", estavel: "→ Estável" };
  const tendenciaColor = { subindo: "text-green-500", caindo: "text-red-500", estavel: "text-muted-foreground" };

  return (
    <div className="page-section">
      <div className="page-section-header">
        <span className="page-section-title flex items-center gap-2">
          <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" /> Previsão de Desvio
          <span className="text-[10px] text-muted-foreground font-normal">· regressão linear · {forecast.horasPassadas}h de dados</span>
        </span>
        <span className={`flex items-center gap-1.5 text-[12px] font-medium ${statusColor}`}>
          <StatusIcon className="w-3.5 h-3.5" /> {statusLabel}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Barra de progresso */}
        <div>
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="text-muted-foreground">Meta prevista ao final do turno</span>
            <span className={`font-semibold tabular-nums ${statusColor}`}>{pctPrevisto}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pctPrevisto, 100)}%` }} />
          </div>
        </div>

        {/* Métricas em linha */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-border rounded px-3 py-2.5">
            <p className={`text-xl font-semibold tabular-nums ${statusColor}`}>{liquidoFinalPrevisto}</p>
            <p className="stat-label mt-0.5">Líquido previsto</p>
          </div>
          <div className="border border-border rounded px-3 py-2.5">
            <p className={`text-xl font-semibold tabular-nums ${desvioVsObjetivo >= 0 ? "text-green-500" : "text-red-500"}`}>
              {desvioVsObjetivo >= 0 ? "+" : ""}{desvioVsObjetivo}
            </p>
            <p className="stat-label mt-0.5">Desvio vs meta</p>
          </div>
          <div className="border border-border rounded px-3 py-2.5">
            <p className="text-xl font-semibold tabular-nums text-foreground">{horasRestantes}h</p>
            <p className="stat-label mt-0.5">Horas restantes</p>
          </div>
        </div>

        {/* Tendência + botão IA */}
        <div className="flex items-center justify-between">
          <div className="text-[12px]">
            <span className="text-muted-foreground">Tendência: </span>
            <span className={`font-medium ${tendenciaColor[tendenciaProd]}`}>{tendenciaLabel[tendenciaProd]}</span>
          </div>
          <button
            onClick={showInsight ? () => setShowInsight(v => !v) : fetchAiInsight}
            className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary/80 font-medium"
          >
            <Sparkles className="w-3 h-3" />
            {loadingAi ? "Analisando…" : showInsight ? "Ocultar análise" : "Análise IA"}
            {showInsight && !loadingAi && (aiInsight ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
        </div>

        {showInsight && (
          <div className="p-3 rounded bg-muted/30 border border-border text-[13px] text-foreground leading-relaxed">
            {loadingAi ? (
              <span className="text-muted-foreground flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin shrink-0" />
                Consultando análise industrial…
              </span>
            ) : aiInsight}
          </div>
        )}
      </div>
    </div>
  );
}