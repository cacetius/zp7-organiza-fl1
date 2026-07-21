import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DEFAULT_LOSS_ITEMS = [
  "COMANDO VALVULA (PRÉ)", "CAMBIO AUT. (PRÉ)", "AR CONDICIONADO",
  "AGREGADO (Reprov. Testor)", "BOX ZP6", "SISTEMA FIS",
  "TORQUE LINHA", "TORQUE FAROL", "ELÉTRICA",
  "DIREÇÃO ELETRICA (Alinh.)", "BZD", "AJUSTE",
  "FREIO", "GEOMETRIA", "COMANDO AC",
  "R2 LINHA", "FALHA IDT", "SIST FIS (PINT)",
];

function getBrasiliaTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function detectTurno() {
  const h = getBrasiliaTime().getHours();
  if (h >= 6 && h < 15) return { key: "primeiro", label: "1º Turno (06h–15h)" };
  if (h >= 15 && h < 23) return { key: "segundo", label: "2º Turno (15h–23h)" };
  return { key: "terceiro", label: "3º Turno (21h–06h)" };
}

function formatDate(d) {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Suporta chamada manual (autenticada) ou automação (service role via payload)
    let isAutomation = false;
    let payload = {};
    try {
      payload = await req.clone().json();
      isAutomation = payload._automation === true;
    } catch (_) {}

    if (!isAutomation) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = getBrasiliaTime();
    const today = now.toISOString().slice(0, 10);
    const turno = payload.turno ? { key: payload.turno, label: payload.turnoLabel || payload.turno } : detectTurno();

    // Busca dados do turno
    const [prodRecords, lossRecords, occurrences, maintenance, tasks] = await Promise.all([
      base44.asServiceRole.entities.ProductionControl.filter({ data: today, turno: turno.key }),
      base44.asServiceRole.entities.LossControl.filter({ data: today, turno: turno.key }),
      base44.asServiceRole.entities.Occurrence.filter({ status: "aberta" }),
      base44.asServiceRole.entities.MaintenanceRequest.filter({ status: "aberto" }),
      base44.asServiceRole.entities.Task.filter({ status: "aberta" }),
    ]);

    // Cálculos
    const totalProd = prodRecords.reduce((s, r) => s + (r.carros_produzidos || 0), 0);

    const perdasBrutas = lossRecords.filter(r =>
      r.motivo_perda !== "ganho" && r.item_perda && r.hora && (r.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(r.item_perda)
    ).reduce((s, r) => s + (r.carros_perdidos || 0), 0);

    const ganhos = lossRecords.filter(r =>
      r.motivo_perda === "ganho" && (r.carros_perdidos || 0) > 0
    ).reduce((s, r) => s + (r.carros_perdidos || 0), 0);

    const perdaReal = Math.max(0, perdasBrutas - ganhos);
    const prodLiquida = Math.max(0, totalProd - perdaReal);

    // Top 5 itens de perda
    const perdasPorItem = {};
    lossRecords.filter(r =>
      r.motivo_perda !== "ganho" && r.item_perda && (r.carros_perdidos || 0) > 0 && DEFAULT_LOSS_ITEMS.includes(r.item_perda)
    ).forEach(r => {
      perdasPorItem[r.item_perda] = (perdasPorItem[r.item_perda] || 0) + (r.carros_perdidos || 0);
    });
    const topPerdas = Object.entries(perdasPorItem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const eficiencia = totalProd > 0 ? Math.round((prodLiquida / totalProd) * 100) : 0;
    const eficColor = eficiencia >= 80 ? "#16a34a" : eficiencia >= 60 ? "#d97706" : "#dc2626";

    // Ocorrências críticas
    const criticas = occurrences.filter(o => o.gravidade === "critica" || o.gravidade === "alta");

    // Busca usuários administradores para envio
    const users = await base44.asServiceRole.entities.User.list();
    const adminUsers = users.filter(u => u.role === "admin" && u.email);

    const dateLabel = formatDate(now);
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

    const topPerdasRows = topPerdas.length > 0
      ? topPerdas.map(([item, val]) =>
          `<tr><td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px">${item}</td>
           <td style="padding:6px 12px;border-bottom:1px solid #1e293b;text-align:center;font-weight:700;color:#f87171;font-size:13px">${val}</td></tr>`
        ).join("")
      : `<tr><td colspan="2" style="padding:12px;text-align:center;color:#64748b;font-size:13px">Nenhuma perda registrada</td></tr>`;

    const critiasRows = criticas.length > 0
      ? criticas.slice(0, 3).map(o =>
          `<tr><td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px">${(o.tipo || "").replace(/_/g, " ")}</td>
           <td style="padding:6px 12px;border-bottom:1px solid #1e293b;text-align:center;color:#94a3b8;font-size:13px">${o.testor || "—"}</td>
           <td style="padding:6px 12px;border-bottom:1px solid #1e293b;text-align:center;font-weight:700;color:#f87171;font-size:13px">${o.gravidade}</td></tr>`
        ).join("")
      : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#64748b;font-size:13px">✅ Nenhuma ocorrência crítica</td></tr>`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#0f172a 80%);border-radius:16px;padding:28px;margin-bottom:20px;text-align:center">
      <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:8px 20px;display:inline-block;margin-bottom:12px">
        <span style="color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Volkswagen Taubaté · ZP7</span>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 6px">📊 Relatório de Turno</h1>
      <p style="color:#93c5fd;font-size:14px;margin:0">${turno.label}</p>
      <p style="color:#64748b;font-size:12px;margin:8px 0 0;text-transform:capitalize">${dateLabel} · ${timeStr}</p>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center;border:1px solid #334155">
        <p style="color:#60a5fa;font-size:28px;font-weight:900;margin:0">${totalProd}</p>
        <p style="color:#64748b;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px">Produção Bruta</p>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center;border:1px solid #334155">
        <p style="color:#4ade80;font-size:28px;font-weight:900;margin:0">${prodLiquida}</p>
        <p style="color:#64748b;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px">Prod. Líquida</p>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center;border:1px solid #334155">
        <p style="color:#f87171;font-size:28px;font-weight:900;margin:0">${perdaReal}</p>
        <p style="color:#64748b;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px">Perda Real</p>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center;border:1px solid #334155">
        <p style="color:${eficColor};font-size:28px;font-weight:900;margin:0">${eficiencia}%</p>
        <p style="color:#64748b;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px">Eficiência</p>
      </div>
    </div>

    <!-- Top Perdas -->
    <div style="background:#1e293b;border-radius:12px;margin-bottom:16px;overflow:hidden;border:1px solid #334155">
      <div style="background:#991b1b;padding:12px 16px">
        <p style="color:#fff;font-size:13px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:1px">🔴 Top Perdas por Item</p>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0f172a">
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">Item</th>
            <th style="padding:8px 12px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">Qtd</th>
          </tr>
        </thead>
        <tbody>${topPerdasRows}</tbody>
      </table>
    </div>

    <!-- Ocorrências Críticas -->
    <div style="background:#1e293b;border-radius:12px;margin-bottom:16px;overflow:hidden;border:1px solid #334155">
      <div style="background:#92400e;padding:12px 16px">
        <p style="color:#fff;font-size:13px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:1px">⚠️ Ocorrências Abertas (${occurrences.length})</p>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0f172a">
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">Tipo</th>
            <th style="padding:8px 12px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">Testor</th>
            <th style="padding:8px 12px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">Gravidade</th>
          </tr>
        </thead>
        <tbody>${critiasRows}</tbody>
      </table>
    </div>

    <!-- Rodapé de pendências -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
      <div style="background:#1e293b;border-radius:12px;padding:14px;text-align:center;border:1px solid #334155">
        <p style="color:#fbbf24;font-size:22px;font-weight:900;margin:0">${tasks.length}</p>
        <p style="color:#64748b;font-size:11px;margin:4px 0 0">Tarefas abertas</p>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:14px;text-align:center;border:1px solid #334155">
        <p style="color:#f87171;font-size:22px;font-weight:900;margin:0">${maintenance.length}</p>
        <p style="color:#64748b;font-size:11px;margin:4px 0 0">Manutenções abertas</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px;border-top:1px solid #1e293b">
      <p style="color:#334155;font-size:11px;margin:0">Sistema ZP7 Organização · Volkswagen Taubaté</p>
      <p style="color:#1e293b;font-size:10px;margin:4px 0 0">Relatório gerado automaticamente em ${timeStr}</p>
    </div>
  </div>
</body>
</html>`;

    // Envia para todos os admins
    let enviados = 0;
    for (const u of adminUsers) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: `📊 ZP7 · Relatório ${turno.label} · ${today} · ${totalProd} carros`,
          body: emailHtml,
        });
        enviados++;
      } catch (_) {}
    }

    return Response.json({
      ok: true,
      turno: turno.key,
      data: today,
      totalProd,
      prodLiquida,
      perdaReal,
      eficiencia,
      adminUsers: adminUsers.length,
      enviados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});