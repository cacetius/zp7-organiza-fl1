import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const tipoLabel = {
  falha_mecanica: "Falha Mecânica",
  falha_eletrica: "Falha Elétrica",
  qualidade: "Qualidade",
  seguranca: "Segurança",
  parada: "Parada",
  outro: "Outro"
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;

    // Só processa criação de ocorrências críticas
    if (!data || data.gravidade !== "critica") {
      return Response.json({ skipped: true, reason: "not critical" });
    }

    // Busca todos os líderes de turno com telefone cadastrado
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ funcao: "lider", ativo: true });

    if (!profiles || profiles.length === 0) {
      return Response.json({ skipped: true, reason: "no leaders found" });
    }

    const turnoLabel = { primeiro: "1º Turno", segundo: "2º Turno", terceiro: "3º Turno" };
    const tipo = tipoLabel[data.tipo] || data.tipo || "Ocorrência";
    const hora = data.hora || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const dataStr = data.data || new Date().toLocaleDateString("pt-BR");

    const mensagem = `🔴 *OCORRÊNCIA CRÍTICA - ZP7*\n\n` +
      `⚠️ Tipo: ${tipo}\n` +
      `🏭 Testor: ${data.testor || "Não informado"}\n` +
      `📅 Data/Hora: ${dataStr} às ${hora}\n` +
      `🔧 Turno: ${turnoLabel[data.turno] || data.turno || "Não informado"}\n` +
      `⏱️ Parada: ${data.tempo_parada || 0} min\n` +
      `🚗 Impacto: ${data.impacto_producao || 0} carros\n` +
      (data.descricao ? `📝 Descrição: ${data.descricao}\n` : "") +
      `\nAcesse o sistema ZP7 para tratar a ocorrência.`;

    const mensagemEncoded = encodeURIComponent(mensagem);

    const notificados = [];
    const semTelefone = [];

    for (const leader of profiles) {
      if (!leader.telefone) {
        semTelefone.push(leader.nome);
        continue;
      }

      // Remove caracteres não numéricos do telefone
      const tel = leader.telefone.replace(/\D/g, "");
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${tel}&text=${mensagemEncoded}`;

      notificados.push({
        nome: leader.nome,
        telefone: tel,
        whatsapp_link: whatsappUrl
      });
    }

    return Response.json({
      success: true,
      notificados,
      semTelefone,
      mensagem
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});