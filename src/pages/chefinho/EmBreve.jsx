import React from "react";
import { Link } from "react-router-dom";
import { Hammer, ArrowRight } from "lucide-react";

export default function EmBreve({ nome = "Página" }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Hammer className="w-7 h-7 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{nome}</h2>
      <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
        Este módulo do Chefinho está sendo reconstruído. Em breve disponível na central.
      </p>
      <Link to="/chefinho" className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90">
        Voltar ao Dashboard <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}