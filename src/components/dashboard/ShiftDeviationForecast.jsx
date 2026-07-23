import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

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

export default function ShiftDeviationForecast({ prodData, lossData, currentShiftKey }) {
  const forecast = useMemo(() => {
    const hours = SHIFT_HOURS[currentShiftKey] || [];
    if (!hours.length) return null;

    // Horas que já ocorreram neste turno
    const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const nowStr = `${String(nowBrasilia.getHours()).padStart(2, "0")}:${String(nowBrasilia.getMinutes()).padStart(2, "0")}`;

    const horasPassadas = hours.filter(h => h <= nowStr);
    const horasRestantes = hours.filter(h => h > nowStr);

    if (horasPassadas.length === 0 || horasRestantes.length === 0) return null;

    // Produção e objetivo acumulados nas horas passadas
    const prodPassada = prodData.reduce((s, r) => {
      if (horasPassadas.includes(r.hora)) return s + (r.carros_produzidos || 0);
      return s;
    }, 0);

    const objTotal = prodData.reduce((s, r) => {
      if (r.testor_id === "__objetivo__") return s + (r.objetivo || 0);
      return s;
    }, 0);

    const objPassado = prodData.reduce((s, r) => {
      if (r.testor_id === "__objetivo__" && horasPassadas.includes(r.hora)) return s + (r.objetivo || 0);
      return s;
    }, 0);

    const objRestante = Math.max(0, objTotal - objPassado);

    // Perdas reais nas horas passadas
    const perdasPassadas = lossData.filter(l =>
      l.motivo_perda !== "ganho" && l.item_perda && l.hora && (l.carros_perdidos || 0) > 0
      && DEFAULT_LOSS_ITEMS.includes(l.item_perda) && horasPassadas.includes(l.hora)
    ).reduce((s, l) => s + (l.carros_perdidos || 0), 0);

    const ganhosPassados = lossData.filter(l =>
      l.motivo_perda === "ganho" && (l.carros_perdidos || 0) > 0 && horasPassadas.includes(l.hora)
    ).reduce((s, l) => s + (l.carros_perdidos || 0), 0);

    const perdaRealPassada = Math.max(0, perdasPassadas - ganhosPassados);

    // Taxa de produção por hora e taxa de perda por hora
    const taxaProdPorHora = horasPassadas.length > 0 ? prodPassada / horasPassadas.length : 0;
    const taxaPerdaPorHora = horasPassadas.length > 0 ? perdaRealPassada / horasPassadas.length : 0;

    // Projeção: o que vamos produzir e perder nas horas restantes
    const prodProjetada = Math.round(taxaProdPorHora * horasRestantes.length);
    const perdaProjetada = Math.round(taxaPerdaPorHora * horasRestantes.length);

    const prodTotalPrevista = prodPassada + prodProjetada;
    const perdaTotalPrevista = perdaRealPassada + perdaProjetada;
    const liquidoFinalPrevisto = Math.max(0, prodTotalPrevista - perdaTotalPrevista);

    const desvioVsObjetivo = objTotal > 0 ? liquidoFinalPrevisto - objTotal : null;
    const pctPrevisto = objTotal > 0 ? Math.round((liquidoFinalPrevisto / objTotal) * 100) : null;

    return {
      horasPassadas: horasPassadas.length,
      horasRestantes: horasRestantes.length,
      taxaProdPorHora: Math.round(taxaProdPorHora * 10) / 10,
      taxaPerdaPorHora: Math.round(taxaPerdaPorHora * 10) / 10,
      prodPassada,
      prodTotalPrevista,
      liquidoFinalPrevisto,
      desvioVsObjetivo,
      pctPrevisto,
      objTotal,
    };
  }, [prodData, lossData, currentShiftKey]);

  if (!forecast || forecast.objTotal === 0) return null;

  const { pctPrevisto, desvioVsObjetivo, liquidoFinalPrevisto, taxaProdPorHora, horasRestantes } = forecast;

  const isOk = pctPrevisto >= 95;
  const isWarn = pctPrevisto >= 75 && pctPrevisto < 95;
  const isCrit = pctPrevisto < 75;

  const config = isOk
    ? { border: "border-green-500/30", bg: "bg-green-500/5", icon: CheckCircle2, iconColor: "text-green-400", iconBg: "bg-green-500/15", barColor: "bg-green-400", textColor: "text-green-400", label: "No caminho certo" }
    : isWarn
    ? { border: "border-yellow-500/30", bg: "bg-yellow-500/5", icon: AlertTriangle, iconColor: "text-yellow-400", iconBg: "bg-yellow-500/15", barColor: "bg-yellow-400", textColor: "text-yellow-400", label: "Atenção — ritmo abaixo do esperado" }
    : { border: "border-red-500/30", bg: "bg-red-500/5", icon: TrendingDown, iconColor: "text-red-400", iconBg: "bg-red-500/15", barColor: "bg-red-400", textColor: "text-red-400", label: "Risco de não bater a meta" };

  const Icon = config.icon;

  return (
    <Card className={`border ${config.border} ${config.bg}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${config.iconBg} flex items-center justify-center shrink-0`}>
              <BrainCircuit className={`w-4.5 h-4.5 ${config.iconColor}`} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Previsão de Desvio</h3>
              <p className="text-[10px] text-muted-foreground">Baseado no ritmo atual do turno</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${config.border} ${config.textColor}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </div>
        </div>

        {/* Barra de previsão */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Projeção de meta atingida</span>
            <span className={`font-black ${config.textColor}`}>{pctPrevisto}%</span>
          </div>
          <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${config.barColor}`}
              style={{ width: `${Math.min(pctPrevisto, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0%</span>
            <span>Meta 100%</span>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
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

        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          Ritmo atual: <span className="font-bold text-foreground">{taxaProdPorHora} carros/h</span> · Projeção baseada nas últimas {forecast.horasPassadas} horas
        </p>
      </CardContent>
    </Card>
  );
}