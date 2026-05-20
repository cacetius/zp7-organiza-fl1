import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const occurrence = payload.data || payload;

    const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!webhookUrl) {
      return Response.json({ error: "SLACK_WEBHOOK_URL não configurado" }, { status: 500 });
    }

    const gravidadeEmoji = {
      critica: "🚨",
      alta: "⚠️",
      media: "🔶",
      baixa: "🔵",
    };

    const emoji = gravidadeEmoji[occurrence.gravidade] || "⚠️";
    const tipo = occurrence.tipo || "Ocorrência";
    const gravidade = (occurrence.gravidade || "—").toUpperCase();
    const testor = occurrence.testor || "—";
    const descricao = occurrence.descricao || occurrence.acao_tomada || "Sem descrição";
    const responsavel = occurrence.responsavel || "—";
    const turno = occurrence.turno || "—";
    const data = occurrence.created_date ? String(occurrence.created_date).slice(0, 10) : new Date().toISOString().slice(0, 10);

    const message = {
      text: `${emoji} *Nova Ocorrência ${gravidade} registrada no ZP7*`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `${emoji} Ocorrência ${gravidade} — ZP7`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Tipo:*\n${tipo}` },
            { type: "mrkdwn", text: `*Gravidade:*\n${gravidade}` },
            { type: "mrkdwn", text: `*Testor:*\n${testor}` },
            { type: "mrkdwn", text: `*Turno:*\n${turno}` },
            { type: "mrkdwn", text: `*Responsável:*\n${responsavel}` },
            { type: "mrkdwn", text: `*Data:*\n${data}` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Descrição:*\n${descricao}` },
        },
        {
          type: "divider",
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: "🏭 ZP7 — Sistema de Controle de Produção" },
          ],
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Slack retornou erro: ${text}` }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});