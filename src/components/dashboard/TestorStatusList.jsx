import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "lucide-react";

const statusConfig = {
  rodando: { label: "Rodando", className: "bg-green-500/10 text-green-400 border-green-500/30" },
  atencao: { label: "Atenção", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  parado: { label: "Parado", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  manutencao: { label: "Manutenção", className: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  bloqueado: { label: "Bloqueado", className: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};

export default function TestorStatusList({ testores }) {
  if (!testores?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="w-4 h-4" /> Testores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum testor cadastrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Status dos Testores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {testores.map((t) => {
          const cfg = statusConfig[t.status] || statusConfig.rodando;
          return (
            <div
              key={t.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
            >
              <div>
                <p className="font-medium text-sm">{t.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {t.carros_testados_turno || 0} carros • {t.carros_por_hora || 0}/h
                </p>
              </div>
              <div className="flex items-center gap-2">
                {t.risco_score > 60 && (
                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30">
                    Risco {t.risco_score}%
                  </Badge>
                )}
                <Badge className={`text-[10px] border ${cfg.className}`}>
                  {cfg.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}