import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Reconcilia os registros de ProductionControl com LossControl.
 * 
 * Regra: Para cada (data, turno, hora), o campo "perdas_producao" no ProductionControl
 * deve refletir a Perda Real do LossControl daquela hora:
 *   perda_real_hora = max(0, sum(carros_perdidos WHERE motivo != "ganho") - sum(carros_perdidos WHERE motivo = "ganho"))
 * 
 * Se houver divergência, atualiza os registros de ProductionControl para corrigir.
 * Retorna um relatório detalhado das correções feitas.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Permite ser chamado por automação agendada (sem usuário) ou por admin logado
  let isAdmin = false;
  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }
    isAdmin = true;
  } catch (_) {
    // Chamada via automação agendada — sem usuário autenticado, usa service role
  }

  const body = await req.json().catch(() => ({}));

  // Aceita data específica via payload, ou reconcilia os últimos 2 dias
  let datas = [];
  if (body.data) {
    datas = [body.data];
  } else {
    // Últimas 48h (hoje + ontem) no horário de Brasília
    const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = brtNow.toISOString().slice(0, 10);
    const ontem = new Date(brtNow - 86400000).toISOString().slice(0, 10);
    datas = [hoje, ontem];
  }

  const turnos = ['primeiro', 'segundo', 'terceiro'];
  const corrections = [];
  const skipped = [];

  for (const data of datas) {
    for (const turno of turnos) {
      // Busca registros de ambos os módulos em paralelo
      const [prodRecords, lossRecords] = await Promise.all([
        base44.asServiceRole.entities.ProductionControl.filter({ data, turno }),
        base44.asServiceRole.entities.LossControl.filter({ data, turno }),
      ]);

      if (prodRecords.length === 0 && lossRecords.length === 0) continue;

      // Calcula perda real por hora a partir do LossControl
      const perdasRealPorHora = {};
      lossRecords.forEach(r => {
        if (!r.hora) return;
        if (!perdasRealPorHora[r.hora]) perdasRealPorHora[r.hora] = { brutas: 0, ganhos: 0 };
        if (r.motivo_perda === 'ganho') {
          perdasRealPorHora[r.hora].ganhos += (r.carros_perdidos || 0);
        } else {
          perdasRealPorHora[r.hora].brutas += (r.carros_perdidos || 0);
        }
      });

      // Para cada hora que tem registros no LossControl, verifica os registros de ProductionControl
      for (const [hora, vals] of Object.entries(perdasRealPorHora)) {
        const perdaRealLoss = Math.max(0, vals.brutas - vals.ganhos);

        // Soma o que está registrado como perdas_producao no ProductionControl para essa hora
        const prodHora = prodRecords.filter(r => r.hora === hora);
        const perdaProdAtual = prodHora.reduce((s, r) => s + (r.perdas_producao || 0), 0);

        if (perdaProdAtual === perdaRealLoss) {
          skipped.push({ data, turno, hora, motivo: 'já consistente', valor: perdaRealLoss });
          continue;
        }

        // Há divergência — corrige distribuindo a perda real proporcionalmente entre os testores
        const totalProd = prodHora.reduce((s, r) => s + (r.carros_produzidos || 0), 0);

        if (prodHora.length === 0) {
          skipped.push({ data, turno, hora, motivo: 'sem registros de produção para corrigir' });
          continue;
        }

        let restante = perdaRealLoss;
        for (let i = 0; i < prodHora.length; i++) {
          const rec = prodHora[i];
          let novaPerda;
          if (i === prodHora.length - 1) {
            // Último registro recebe o restante para garantir soma exata
            novaPerda = restante;
          } else if (totalProd > 0) {
            // Distribui proporcionalmente pela produção de cada testor
            const proporcao = (rec.carros_produzidos || 0) / totalProd;
            novaPerda = Math.round(perdaRealLoss * proporcao);
          } else {
            // Sem produção, distribui igualmente
            novaPerda = Math.floor(perdaRealLoss / prodHora.length);
          }
          novaPerda = Math.max(0, novaPerda);
          restante -= novaPerda;

          if ((rec.perdas_producao || 0) !== novaPerda) {
            await base44.asServiceRole.entities.ProductionControl.update(rec.id, {
              perdas_producao: novaPerda,
            });
            corrections.push({
              data, turno, hora,
              testor: rec.testor_nome || rec.testor_id,
              de: rec.perdas_producao || 0,
              para: novaPerda,
              perda_real_loss: perdaRealLoss,
            });
          }
        }
      }

      // Zera perdas_producao de horas que não têm nenhum registro no LossControl
      const horasComLoss = new Set(Object.keys(perdasRealPorHora));
      for (const rec of prodRecords) {
        if (!rec.hora) continue;
        if (!horasComLoss.has(rec.hora) && (rec.perdas_producao || 0) > 0) {
          await base44.asServiceRole.entities.ProductionControl.update(rec.id, { perdas_producao: 0 });
          corrections.push({
            data, turno, hora: rec.hora,
            testor: rec.testor_nome || rec.testor_id,
            de: rec.perdas_producao,
            para: 0,
            motivo: 'sem perda no LossControl para esta hora',
          });
        }
      }
    }
  }

  const summary = {
    executado_em: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    datas_verificadas: datas,
    total_correcoes: corrections.length,
    total_ja_consistentes: skipped.filter(s => s.motivo === 'já consistente').length,
    correcoes: corrections,
    sem_alteracao: skipped,
  };

  console.log(`[reconciliar] ${corrections.length} correções feitas em ${datas.join(', ')}`);
  if (corrections.length > 0) {
    console.log(JSON.stringify(corrections, null, 2));
  }

  return Response.json(summary);
});