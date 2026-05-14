import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { subDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, Clock, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TestorWeeklyHistory({ testor, onClose }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");

  const { data: prodData = [] } = useQuery({
    queryKey: [`testor-prod-${testor.id}`],
    queryFn: () => base44.entities.ProductionControl.list(),
  });

  const { data: maintenanceData = [] } = useQuery({
    queryKey: [`testor-maint-${testor.id}`],
    queryFn: () => base44.entities.MaintenanceRequest.list(),
  });

  // Processa dados do testor
  const weeklyData = useMemo(() => {
    const data = {};
    
    // Inicializa dias da semana
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      const dayName = format(parseISO(date), "EEE", { locale: ptBR }).substring(0, 3).toUpperCase();
      data[date] = {
        date,
        day: dayName,
        carros: 0,
        falhas: 0,
        tempoFalha: 0,
        qtdFalhas: 0,
      };
    }

    // Preenche com dados de produção
    prodData
      .filter(p => p.testor_id === testor.id && p.data >= sevenDaysAgo && p.data <= today)
      .forEach(p => {
        if (data[p.data]) {
          data[p.data].carros += p.carros_produzidos || 0;
        }
      });

    // Preenche com dados de manutenção
    maintenanceData
      .filter(m => m.testor_nome === testor.nome && m.data >= sevenDaysAgo && m.data <= today)
      .forEach(m => {
        if (data[m.data]) {
          data[m.data].qtdFalhas += 1;
          data[m.data].tempoFalha += m.tempo_estimado_reparo || 0;
        }
      });

    return Object.values(data);
  }, [prodData, maintenanceData, testor.id, testor.nome, sevenDaysAgo, today]);

  const stats = useMemo(() => {
    const carrosTotal = weeklyData.reduce((sum, d) => sum + d.carros, 0);
    const falhasTotal = weeklyData.reduce((sum, d) => sum + d.qtdFalhas, 0);
    const tempoMedio = falhasTotal > 0 ? Math.round(weeklyData.reduce((sum, d) => sum + d.tempoFalha, 0) / falhasTotal) : 0;
    const carrosPorDia = weeklyData.length > 0 ? Math.round(carrosTotal / 7) : 0;

    return { carrosTotal, falhasTotal, tempoMedio, carrosPorDia };
  }, [weeklyData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Histórico Semanal — {testor.nome}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Últimos 7 dias</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Produzido</p>
              <p className="text-2xl font-black text-blue-400">{stats.carrosTotal}</p>
              <p className="text-[10px] text-muted-foreground">carros na semana</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Média Diária</p>
              <p className="text-2xl font-black text-cyan-400">{stats.carrosPorDia}</p>
              <p className="text-[10px] text-muted-foreground">carros/dia</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Falhas
              </p>
              <p className={`text-2xl font-black ${stats.falhasTotal > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {stats.falhasTotal}
              </p>
              <p className="text-[10px] text-muted-foreground">na semana</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" /> Tempo Médio
              </p>
              <p className={`text-2xl font-black ${stats.tempoMedio > 0 ? "text-orange-400" : "text-muted-foreground"}`}>
                {stats.tempoMedio}
              </p>
              <p className="text-[10px] text-muted-foreground">min/falha</p>
            </div>
          </div>

          {/* Gráfico de Produção */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Evolução de Produtividade
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                  cursor={{ stroke: "#3b82f6", strokeWidth: 2 }}
                  formatter={(value) => [value, "Carros"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="carros"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Carros Produzidos"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Falhas */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              Tempo Médio de Falhas por Dia
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                  cursor={{ fill: "#ea580c", opacity: 0.1 }}
                  formatter={(value, name) => {
                    if (name === "tempoFalha") return [value > 0 ? `${value} min` : "—", "Tempo Total"];
                    return [value, "Qtd Falhas"];
                  }}
                />
                <Legend />
                <Bar dataKey="qtdFalhas" fill="#ea580c" name="Quantidade de Falhas" />
                <Bar dataKey="tempoFalha" fill="#f97316" name="Tempo Total (min)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela resumida */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm">Detalhes Diários</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-3 py-2 text-left font-bold">Dia</th>
                    <th className="px-3 py-2 text-center font-bold">Carros</th>
                    <th className="px-3 py-2 text-center font-bold">Falhas</th>
                    <th className="px-3 py-2 text-center font-bold">Tempo Total</th>
                    <th className="px-3 py-2 text-center font-bold">Média/Falha</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyData.map((day, idx) => (
                    <tr key={day.date} className={`border-b border-border ${idx % 2 === 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-3 py-2 font-medium">{day.day}</td>
                      <td className="px-3 py-2 text-center text-blue-400 font-bold">{day.carros}</td>
                      <td className={`px-3 py-2 text-center font-bold ${day.qtdFalhas > 0 ? "text-orange-400" : "text-muted-foreground"}`}>
                        {day.qtdFalhas}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {day.tempoFalha > 0 ? `${day.tempoFalha}min` : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {day.qtdFalhas > 0 ? `${Math.round(day.tempoFalha / day.qtdFalhas)}min` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}