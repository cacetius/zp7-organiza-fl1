import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Calendar as Cal, ChevronLeft, ChevronRight } from "lucide-react";
import format from "date-fns/format";
import parseISO from "date-fns/parseISO";
import startOfMonth from "date-fns/startOfMonth";
import endOfMonth from "date-fns/endOfMonth";
import eachDayOfInterval from "date-fns/eachDayOfInterval";
import isSameMonth from "date-fns/isSameMonth";
import isSameDay from "date-fns/isSameDay";
import startOfWeek from "date-fns/startOfWeek";
import endOfWeek from "date-fns/endOfWeek";
import { ptBR } from "date-fns/locale";

const TYPE_LABEL = { auditoria:"Auditoria", calibracao:"Calibração", vencimento:"Vencimento", troca_etiqueta:"Troca etiqueta", troca_faixa:"Troca faixa", revisao:"Revisão", tarefa:"Tarefa" };
const TYPE_CLR = { auditoria:"bg-blue-500/15 text-blue-500", calibracao:"bg-orange-500/15 text-orange-500", vencimento:"bg-red-500/15 text-red-500", troca_etiqueta:"bg-purple-500/15 text-purple-500", troca_faixa:"bg-purple-500/15 text-purple-500", revisao:"bg-emerald-500/15 text-emerald-500", tarefa:"bg-slate-500/15 text-slate-500" };

export default function CalendarView() {
  const [monthDate, setMonthDate] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const { data: events = [] } = useQuery({ queryKey: ["chef-events"], queryFn: () => base44.entities.ChefCalendarEvent.list("date") });

  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  const dayEvents = (day) => events.filter(e => e.date && isSameDay(parseISO(e.date), day));
  const selectedEvents = dayEvents(selected);

  const counts = {
    total: events.length,
    pending: events.filter(e => e.status === "pendente").length,
    done: events.filter(e => e.status === "concluido").length,
    late: events.filter(e => e.status === "atrasado").length,
  };

  return (
    <div className="space-y-4">
      <div><h1 className="text-lg font-semibold flex items-center gap-2"><Cal className="w-5 h-5 text-primary" />Calendário</h1>
        <p className="text-[13px] text-muted-foreground">Auditorias, calibrações e vencimentos</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Eventos",v:counts.total,c:"text-foreground"},{l:"Pendentes",v:counts.pending,c:"text-amber-500"},{l:"Concluídos",v:counts.done,c:"text-emerald-500"},{l:"Atrasados",v:counts.late,c:"text-red-500"}].map(k=>(
          <div key={k.l} className="panel p-3"><p className={`text-2xl font-semibold tabular-nums ${k.c}`}>{k.v}</p><p className="text-[11px] text-muted-foreground mt-0.5">{k.l}</p></div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 panel p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold capitalize">{format(monthDate, "MMMM yyyy", { locale: ptBR })}</p>
            <div className="flex gap-1">
              <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1))} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setMonthDate(new Date())} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded">Hoje</button>
              <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1))} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px text-center">
            {["D","S","T","Q","Q","S","S"].map((d,i) => <div key={i} className="text-[10px] font-semibold uppercase text-muted-foreground py-1">{d}</div>)}
            {days.map((day, i) => {
              const evs = dayEvents(day);
              const inMonth = isSameMonth(day, monthDate);
              const isSel = isSameDay(day, selected);
              return (
                <button key={i} onClick={() => setSelected(day)}
                  className={`min-h-[52px] p-1 rounded text-left transition-colors ${inMonth ? "bg-card hover:bg-muted" : "bg-muted/30 text-muted-foreground"} ${isSel ? "ring-2 ring-primary" : ""}`}>
                  <span className="text-[11px] block">{format(day, "d")}</span>
                  {evs.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap mt-0.5">
                      {evs.slice(0,3).map((e, j) => <span key={j} className={`w-1.5 h-1.5 rounded-full ${TYPE_CLR[e.type] ? TYPE_CLR[e.type].split(" ")[0].replace("/15","") : "bg-muted"} inline-block`} />)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="panel p-4">
          <p className="label-section mb-3 capitalize">{format(selected, "dd 'de' MMMM", { locale: ptBR })}</p>
          <div className="space-y-2">
            {selectedEvents.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhum evento.</p> : selectedEvents.map(e => (
              <div key={e.id} className={`px-3 py-2 rounded-lg ${TYPE_CLR[e.type]||"bg-muted"}`}>
                <p className="text-[13px] font-medium text-foreground">{e.title}</p>
                <p className="text-[11px] text-muted-foreground">{TYPE_LABEL[e.type]||e.type}{e.responsible_name ? ` · ${e.responsible_name}` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}