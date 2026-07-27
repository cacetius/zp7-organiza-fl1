import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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

// Regressão linear simples: retorna { slope, intercept }
function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return null;
  const xs = ys.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
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

    // Produção por hora (série temporal)
    const prodPorHora = horasPassadas.map(h =>
      prodData.filter(r => r.hora === h && r.testor_id !== "__objetivo__")
               .reduce((s, r) => s + (r.carros_produzidos || 0), 0)
    );

    // Perdas por hora (série temporal)
    const perdasPorHora = horasPassadas.map(h => {
      const brutas = lossData.filter(l =>
        l.motivo_perda !== "ganho" && l.item_perda && l.hora === h &&
        (l.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(l.item_perda)
      ).reduce((s, l) => s + (l.carros_perdidos || 0), 0);
      const ganhos = lossData.filter(l =>
        l.motivo_perda === "ganho" && l.hora === h && (l.carros_perdidos || 0) > 0
      ).reduce((s, l) => s + (l.carros_perdidos || 0), 0);
      return Math.max(0, brutas - ganhos);
    });

    const prodPassada = prodPorHora.reduce((a, b) => a + b, 0);
    const perdaRealPassada = perdasPorHora.reduce((a, b) => a + b, 0);

    // Regressão linear para tendência (mais preciso que média simples)
    const regProd = linearRegression(prodPorHora);
    const regPerd = linearRegression(perdasPorHora);

    const nPassadas = horasPassadas.length;
    let prodProjetada = 0;
    let perdaProjetada = 0;

    for (let i = 0; i < horasRestantes.length; i++) {
      const x = nPassadas + i;
      const prodPrev = regProd ? Math.max(0, regProd.slope * x + regProd.intercept) : (prodPassada / nPassadas);
      const perdPrev = regPerd ? Math.max(0, regPerd.slope * x + regPerd.intercept) : (perdaRealPassada / nPassadas);
      prodProjetada += prodPrev;
      perdaProjetada += perdPrev;
    }

    prodProjetada = Math.round(prodProjetada);
    perdaProjetada = Math.round(perdaProjetada);

    const objTotal = prodData.filter(r => r.testor_id === "__objetivo__")
                             .reduce((s, r) => s + (r.objetivo || 0), 0);

    const prodTotalPrevista = prodPassada + prodProjetada;
    const perdaTotalPrevista = perdaRealPassada + perdaProjetada;
    const liquidoFinalPrevisto = Math.max(0, prodTotalPrevista - perdaTotalPrevista);
    const desvioVsObjetivo = objTotal > 0 ? liquidoFinalPrevisto - objTotal : null;
    const pctPrevisto = objTotal > 0 ? Math.round((liquidoFinalPrevisto / objTotal) * 100) : null;

    // Tendência: slope positivo = acelerando, negativo = desacelerando
    const tendenciaProd = regProd ? (regProd.slope > 0.2 ? "subindo" : regProd.slope < -0.2 ? "caindo" : "estavel") : "estavel";
    const tendenciaPerd = regPerd ? (regPerd.slope > 0.1 ? "subindo" : "estavel") : "estavel";

    // Horas com maior perda (para sugestão)
    const piorHora = horasPassadas.reduce((best, h, i) =>
      perdasPorHora[i] > (perdasPorHora[horasPassadas.indexOf(best)] || 0) ? h : best,
      horasPassadas[0]
    );

    return {
      horasPassadas: horasPassadas.length,
      horasRestantes: horasRestantes.length,
      taxaProdPorHora: Math.round((prodPassada / nPassadas) * 10) / 10,
      prodPassada,
      prodTotalPrevista,
      liquidoFinalPrevisto,
      desvioVsObjetivo,
      pctPrevisto,
      objTotal,
      tendenciaProd,
      tendenciaPerd,
      piorHora,
      prodPorHora,
      perdasPorHora,
    };
  }, [prodData, lossData, currentShiftKey]);

  const fetchAiInsight = async () => {
    if (!forecast) return;
    setLoadingAi(true);
    setShowInsight(true);
    try {
      const ctx = `
Turno atual da Volkswagen ZP7 (Taubaté):
- Horas decorridas: ${forecast.horasPassadas}h
- Horas restantes: ${forecast.horasRestantes}h
- Produção acumulada: ${forecast.prodPassada} carros
- Taxa média: ${forecast.taxaProdPorHora} carros/h
- Tendência de produção: ${forecast.tendenciaProd}
- Tendência de perdas: ${forecast.tendenciaPerd}
- Projeção líquida final: ${forecast.liquidoFinalPrevisto} carros
- Meta do turno: ${forecast.objTotal} carros
- Desvio previsto: ${forecast.desvioVsObjetivo ?? "sem meta"} carros
- % meta prevista: ${forecast.pctPrevisto ?? "—"}%
- Hora com maior perda: ${forecast.piorHora}
- Produção por hora: ${forecast.prodPorHora.join(", ")}
- Perdas por hora: ${forecast.perdasPorHora.join(", ")}
`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em produção industrial automotiva. Analise os dados do turno ZP7 e dê UMA recomendação prática e objetiva (máx 2 frases) para o líder de turno recuperar ou manter a meta. Seja direto e use linguagem de chão de fábrica.\n\nDados:\n${ctx}`,
        model: "gemini_3_flash",
      });
      setAiInsight(typeof res === "string" ? res : res?.text || "Análise concluída.");
    } catch (e) {
      setAiInsight("Não foi possível gerar a análise no momento.");
    } finally {
      setLoadingAi(false);
    }
  };

  if (!forecast || forecast.objTotal === 0) return null;

  const { pctPrevisto, desvioVsObjetivo, liquidoFinalPrevisto, horasRestantes, tendenciaProd } = forecast;

  const isOk = pctPrevisto >= 95;
  const isWarn = pctPrevisto >= 75 && pctPrevisto < 95;

  const config = isOk
    ? { border: "border-green-500/30", bg: "bg-green-500/5", icon: CheckCircle2, iconColor: "text-green-400", iconBg: "bg-green-500/15", barColor: "bg-green-400", textColor: "text-green-400", label: "No caminho certo" }
    : isWarn
    ? { border: "border-yellow-500/30", bg: "bg-yellow-500/5", icon: AlertTriangle, iconColor: "text-yellow-400", iconBg: "bg-yellow-500/15", barColor: "bg-yellow-400", textColor: "text-yellow-400", label: "Ritmo abaixo do esperado" }
    : { border: "border-red-500/30", bg: "bg-red-500/5", icon: TrendingDown, iconColor: "text-red-400", iconBg: "bg-red-500/15", barColor: "bg-red-400", textColor: "text-red-400", label: "Risco de não bater a meta" };

  const Icon = config.icon;

  const tendenciaLabel = { subindo: "↗ Acelerando", caindo: "↘ Desacelerando", estavel: "→ Estável" };
  const tendenciaColor = { subindo: "text-green-400", caindo: "text-red-400", estavel: "text-muted-foreground" };

  return (
    <Card className={`border ${config.border} ${config.bg}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${config.iconBg} flex items-center justify-center shrink-0`}>
              <BrainCircuit className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Previsão de Desvio</h3>
              <p className="text-[10px] text-muted-foreground">Regressão linear · últimas {forecast.horasPassadas}h</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${config.border} ${config.textColor}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </div>
        </div>

        {/* Barra */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Projeção de meta atingida</span>
            <span className={`font-black ${config.textColor}`}>{pctPrevisto}%</span>
          </div>
          <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${config.barColor}`} style={{ width: `${Math.min(pctPrevisto, 100)}%` }} />
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center bg-muted/20 rounded-xl p-2.5 border border-border/40">
            <p className={`text-xl font-black leading-none ${config.textColor}`}>{liquidoFinalPrevisto}</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wide">Líquido previsto</p>
          </div>
          <div className="text-center bg-muted/20 rounded-xl p-2.5 border border-border/40">
            <p className={`text-xl font-black leading-none ${desvioVsObjetivo >= 0 ? "text-green-400" : "text-red-400"}`}>
              {desvioVsObjetivo >= 0 ? "+" : ""}{desvioVsObjetivo}
            </p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wide">Desvio vs meta</p>
          </div>
          <div className="text-center bg-muted/20 rounded-xl p-2.5 border border-border/40">
            <p className="text-xl font-black leading-none text-blue-400">{horasRestantes}h</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wide">Horas restantes</p>
          </div>
        </div>

        {/* Tendência */}
        <div className="flex items-center justify-between text-[11px] mb-3">
          <span className="text-muted-foreground">Tendência de produção:</span>
          <span className={`font-bold ${tendenciaColor[tendenciaProd]}`}>{tendenciaLabel[tendenciaProd]}</span>
        </div>

        {/* Botão análise IA */}
        <button
          onClick={showInsight ? () => setShowInsight(v => !v) : fetchAiInsight}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {loadingAi ? "Analisando..." : showInsight ? "Ocultar análise IA" : "Gerar análise IA"}
          {showInsight && !loadingAi && (aiInsight ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </button>

        {showInsight && (
          <div className="mt-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground leading-relaxed">
            {loadingAi ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" />
                Consultando IA industrial...
              </div>
            ) : (
              <p>{aiInsight}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}