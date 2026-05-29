import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TURNOS = {
  primeiro: { label: "1º Turno (06h–15h)", horas: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"] },
  segundo:  { label: "2º Turno (16h–23:45)", horas: ["16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","23:45"] },
  terceiro: { label: "3º Turno (22h–05h)", horas: ["22:00","23:00","00:00","01:00","02:00","03:00","04:00","05:00"] },
};

function detectTurnoAtual() {
  const now = new Date();
  // Horário de Brasília (UTC-3)
  const brtOffset = -3 * 60;
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const brtMin = ((utcMin + brtOffset) + 1440) % 1440;
  const h = Math.floor(brtMin / 60);
  const m = brtMin % 60;
  const total = h * 60 + m;

  // 1º turno: 06:00 – 15:59
  if (total >= 6*60 && total < 16*60) return "primeiro";
  // 2º turno: 16:00 – 21:59
  if (total >= 16*60 && total < 22*60) return "segundo";
  // 3º turno: 22:00 – 06:59
  return "terceiro";
}

function getBRTDate() {
  const now = new Date();
  const brtOffset = -3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() + brtOffset);
  const yyyy = brtNow.getUTCFullYear();
  const mm = String(brtNow.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(brtNow.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Aceita turno e data via payload (ou detecta automaticamente)
  const body = await req.json().catch(() => ({}));
  const turnoKey = body.turno || detectTurnoAtual();
  const dataStr = body.data || getBRTDate();

  const turno = TURNOS[turnoKey];
  if (!turno) {
    return Response.json({ error: "Turno inválido" }, { status: 400 });
  }

  // Busca dados em paralelo
  const [prodRecords, lossRecords, occurrences] = await Promise.all([
    base44.asServiceRole.entities.ProductionControl.filter({ data: dataStr, turno: turnoKey }),
    base44.asServiceRole.entities.LossControl.filter({ data: dataStr, turno: turnoKey }),
    base44.asServiceRole.entities.Occurrence.list("-created_date", 100),
  ]);

  // Filtra ocorrências do dia e turno
  const occDia = occurrences.filter(o => {
    const d = o.created_date ? o.created_date.slice(0, 10) : "";
    return d === dataStr && o.turno === turnoKey;
  });

  // Cálculos
  const totalProd = prodRecords.reduce((s, r) => s + (r.carros_produzidos || 0), 0);
  const lossBruto = lossRecords.filter(r => r.motivo_perda !== "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
  const lossGanho = lossRecords.filter(r => r.motivo_perda === "ganho").reduce((s, r) => s + (r.carros_perdidos || 0), 0);
  const perdaReal = Math.max(0, lossBruto - lossGanho);
  const prodLiquida = Math.max(0, totalProd - perdaReal);
  const efic = totalProd > 0 ? Math.round((prodLiquida / totalProd) * 100) : 0;

  // Produção por hora
  const prodPorHora = {};
  turno.horas.forEach(h => {
    prodPorHora[h] = prodRecords.reduce((s, r) => s + (r.hora === h ? (r.carros_produzidos || 0) : 0), 0);
  });

  // Perdas por hora
  const perdasPorHora = {};
  turno.horas.forEach(h => {
    const bruto = lossRecords.filter(r => r.motivo_perda !== "ganho" && r.hora === h).reduce((s, r) => s + (r.carros_perdidos || 0), 0);
    const ganho = lossRecords.filter(r => r.motivo_perda === "ganho" && r.hora === h).reduce((s, r) => s + (r.carros_perdidos || 0), 0);
    perdasPorHora[h] = { bruto, ganho, real: Math.max(0, bruto - ganho), liq: Math.max(0, (prodPorHora[h] || 0) - Math.max(0, bruto - ganho)) };
  });

  // Ranking de perdas
  const lossMap = {};
  lossRecords.filter(r => r.motivo_perda !== "ganho" && r.item_perda).forEach(r => {
    lossMap[r.item_perda] = (lossMap[r.item_perda] || 0) + (r.carros_perdidos || 0);
  });
  const lossRanking = Object.entries(lossMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Justificativas com foto
  const justMap = {};
  prodRecords.forEach(r => {
    if (r.testor_nome && r.hora && r.justificativa) {
      justMap[`${r.testor_nome}-${r.hora}`] = { texto: r.justificativa, fotoUrl: r.justificativa_foto_url || "" };
    }
  });

  // Produção por testor
  const testorMap = {};
  prodRecords.forEach(r => {
    if (!r.testor_nome) return;
    testorMap[r.testor_nome] = (testorMap[r.testor_nome] || 0) + (r.carros_produzidos || 0);
  });

  const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const dataLabel = new Date(dataStr + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const eficColor = efic >= 85 ? "#16a34a" : efic >= 65 ? "#d97706" : "#dc2626";

  const horaRows = turno.horas.map(h => {
    const p = perdasPorHora[h];
    const prod = prodPorHora[h] || 0;
    return `<tr>
      <td><strong>${h}</strong></td>
      <td style="text-align:center;color:#1d4ed8;font-weight:700">${prod || "—"}</td>
      <td style="text-align:center;color:#dc2626;font-weight:700">${p.bruto > 0 ? p.bruto : "—"}</td>
      <td style="text-align:center;color:#16a34a;font-weight:700">${p.ganho > 0 ? p.ganho : "—"}</td>
      <td style="text-align:center;color:#ea580c;font-weight:700">${p.real > 0 ? p.real : "—"}</td>
      <td style="text-align:center;color:#059669;font-weight:700">${p.liq > 0 ? p.liq : "—"}</td>
    </tr>`;
  }).join("");

  const rankRows = lossRanking.map(([item, val], i) => `
    <tr>
      <td><span style="background:${i===0?'#fee2e2':i<=2?'#fff7ed':'#eff6ff'};color:${i===0?'#991b1b':i<=2?'#9a3412':'#1e40af'};padding:2px 8px;border-radius:999px;font-size:9px;font-weight:700">${i+1}°</span>&nbsp;${item}</td>
      <td style="text-align:center;font-weight:800;color:${i===0?'#dc2626':i<=2?'#ea580c':'#3b82f6'}">${val}</td>
    </tr>`).join("");

  const testorRows = Object.entries(testorMap).map(([nome, total]) => `
    <tr><td>${nome}</td><td style="text-align:center;font-weight:700;color:#1d4ed8">${total}</td></tr>`).join("");

  const occRows = occDia.map(o => `
    <tr>
      <td>${o.tipo?.replace(/_/g," ") || "—"}</td>
      <td>${o.testor || "—"}</td>
      <td><span style="background:${o.gravidade==='critica'?'#fee2e2':o.gravidade==='alta'?'#ffedd5':'#fef3c7'};color:${o.gravidade==='critica'?'#991b1b':o.gravidade==='alta'?'#9a3412':'#92400e'};padding:2px 6px;border-radius:999px;font-size:8px;font-weight:700">${o.gravidade?.toUpperCase() || "—"}</span></td>
      <td>${o.descricao || "—"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="utf-8">
  <title>Relatório de Fechamento — ${turno.label} — ${dataLabel}</title>
  <style>
    @page { size: A4; margin: 12mm 12mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; }

    .header {
      background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 55%, #1e1b4b 100%);
      color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 16px;
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .header h1 { font-size: 19px; font-weight: 900; letter-spacing: 1px; margin-bottom: 5px; }
    .header .sub { font-size: 9px; opacity: 0.7; }
    .header .badge {
      display: inline-block; background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
      padding: 7px 14px; font-size: 11px; font-weight: 800; text-align: center; white-space: nowrap;
    }
    .header .date { font-size: 8px; opacity: 0.65; margin-top: 4px; text-align: right; }
    .stamp {
      display: inline-block; border: 3px solid #16a34a; border-radius: 8px;
      padding: 4px 12px; color: #16a34a; font-size: 9px; font-weight: 800;
      letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px;
    }
    .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px; }
    .kpi { border-radius: 10px; padding: 14px 12px; text-align: center; border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
    .kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; }
    .kpi-blue { background:#eff6ff; } .kpi-blue::before { background:#2563eb; } .kpi-blue .val { color:#1d4ed8; }
    .kpi-red { background:#fef2f2; } .kpi-red::before { background:#dc2626; } .kpi-red .val { color:#dc2626; }
    .kpi-green { background:#f0fdf4; } .kpi-green::before { background:#16a34a; } .kpi-green .val { color:#16a34a; }
    .kpi-orange { background:#fff7ed; } .kpi-orange::before { background:#ea580c; } .kpi-orange .val { color:#ea580c; }
    .kpi-emerald { background:#ecfdf5; } .kpi-emerald::before { background:#059669; } .kpi-emerald .val { color:#059669; }
    .kpi-yellow { background:#fffbeb; } .kpi-yellow::before { background:#d97706; } .kpi-yellow .val { color:#d97706; }
    .kpi .val { font-size: 30px; font-weight: 900; line-height: 1; margin-bottom: 3px; }
    .kpi .lbl { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .kpi .sub-val { font-size: 8.5px; color: #94a3b8; margin-top: 2px; }
    .efic-wrap { margin: 0 0 16px; }
    .efic-label { display:flex; justify-content:space-between; font-size:10px; font-weight:700; color:#0369a1; margin-bottom:6px; }
    .efic-track { background:#e2e8f0; border-radius:8px; height:14px; overflow:hidden; }
    .efic-fill { height:14px; border-radius:8px; display:flex; align-items:center; padding-left:8px; }
    .efic-fill span { color:white; font-size:9px; font-weight:700; }
    h2 { font-size:12px; font-weight:800; color:#1e3a8a; border-bottom:2px solid #dbeafe; padding-bottom:5px; margin:16px 0 8px; display:flex; align-items:center; gap:6px; }
    h2 .dot { width:8px; height:8px; border-radius:50%; display:inline-block; flex-shrink:0; }
    table { border-collapse:collapse; width:100%; margin-bottom:14px; border-radius:8px; overflow:hidden; }
    thead th { background:linear-gradient(90deg,#1e40af,#2563eb); color:white; padding:7px 10px; text-align:left; font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
    td { padding:6px 10px; border-bottom:1px solid #f1f5f9; font-size:9px; }
    tr:last-child td { border-bottom:none; }
    tr:nth-child(even) td { background:#f8fafc; }
    .total-row td { background:#eff6ff !important; font-weight:900; border-top:2px solid #bfdbfe; }
    .section-box { border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
    .section-box table { margin:0; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
    .no-data { text-align:center; color:#94a3b8; font-size:9px; padding:14px; }
    .footer { margin-top:20px; font-size:8px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:10px; display:flex; justify-content:space-between; }
    .footer-brand { font-weight:700; color:#64748b; }
    .alert-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:9px; color:#166534; font-weight:600; }
  </style></head><body>

  <!-- HEADER -->
  <div class="header">
    <div>
      <h1>🏭 Relatório de Fechamento — ZP7</h1>
      <div class="sub">Volkswagen Taubaté · Zona de Produção 7 · Gerado em ${geradoEm}</div>
    </div>
    <div>
      <div class="badge">⏱ ${turno.label}</div>
      <div class="date">📅 ${dataLabel}</div>
    </div>
  </div>

  <div class="stamp">✅ Relatório de Fechamento de Turno</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <div class="kpi kpi-blue">
      <div class="val">${totalProd}</div>
      <div class="lbl">Produção Bruta</div>
      <div class="sub-val">carros no turno</div>
    </div>
    <div class="kpi kpi-red">
      <div class="val">${lossBruto}</div>
      <div class="lbl">Perdas Brutas</div>
      <div class="sub-val">do controle de perdas</div>
    </div>
    <div class="kpi kpi-green">
      <div class="val">${lossGanho}</div>
      <div class="lbl">Carros Ganhos</div>
      <div class="sub-val">recuperados</div>
    </div>
    <div class="kpi kpi-orange">
      <div class="val">${perdaReal}</div>
      <div class="lbl">Perda Real</div>
      <div class="sub-val">bruto − ganhos</div>
    </div>
    <div class="kpi kpi-emerald">
      <div class="val">${prodLiquida}</div>
      <div class="lbl">Produção Líquida</div>
      <div class="sub-val">bruto − perda real</div>
    </div>
    <div class="kpi kpi-yellow">
      <div class="val">${occDia.length}</div>
      <div class="lbl">Ocorrências</div>
      <div class="sub-val">registradas no turno</div>
    </div>
  </div>

  <!-- EFICIÊNCIA -->
  <div class="efic-wrap">
    <div class="efic-label">
      <span>📊 Eficiência do Turno (Prod. Líquida / Prod. Bruta)</span>
      <span style="color:${eficColor};font-size:13px">${efic}%</span>
    </div>
    <div class="efic-track">
      <div class="efic-fill" style="width:${efic}%;background:linear-gradient(90deg,#2563eb,${eficColor})">
        <span>${efic}% eficiência</span>
      </div>
    </div>
  </div>

  <!-- PRODUÇÃO POR HORA E TESTOR -->
  <div class="two-col">
    <div>
      <h2><span class="dot" style="background:#2563eb"></span> Produção por Hora</h2>
      <div class="section-box">
        ${totalProd > 0
          ? `<table>
              <thead><tr><th>Hora</th><th style="text-align:center">Carros</th></tr></thead>
              <tbody>
                ${turno.horas.map(h => `<tr><td><strong>${h}</strong></td><td style="text-align:center;color:#1d4ed8;font-weight:700">${prodPorHora[h] || "—"}</td></tr>`).join("")}
                <tr class="total-row"><td>TOTAL</td><td style="text-align:center;color:#1d4ed8">${totalProd}</td></tr>
              </tbody>
            </table>`
          : `<div class="no-data">Sem dados de produção</div>`}
      </div>
    </div>
    <div>
      <h2><span class="dot" style="background:#16a34a"></span> Produção por Testor</h2>
      <div class="section-box">
        ${testorRows
          ? `<table><thead><tr><th>Testor</th><th style="text-align:center">Total</th></tr></thead><tbody>${testorRows}</tbody></table>`
          : `<div class="no-data">Sem dados de testor</div>`}
      </div>
    </div>
  </div>

  <!-- CONSOLIDADO POR HORA -->
  <h2><span class="dot" style="background:#7c3aed"></span> Consolidado de Produção × Perdas por Hora</h2>
  <div class="section-box">
    <table>
      <thead><tr>
        <th>Hora</th>
        <th style="text-align:center;color:#93c5fd">Produção</th>
        <th style="text-align:center;color:#fca5a5">Perdas Brutas</th>
        <th style="text-align:center;color:#86efac">Ganhos</th>
        <th style="text-align:center;color:#fdba74">Perda Real</th>
        <th style="text-align:center;color:#6ee7b7">Prod. Líquida</th>
      </tr></thead>
      <tbody>
        ${horaRows}
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align:center;color:#1d4ed8">${totalProd}</td>
          <td style="text-align:center;color:#dc2626">${lossBruto}</td>
          <td style="text-align:center;color:#16a34a">${lossGanho}</td>
          <td style="text-align:center;color:#ea580c">${perdaReal}</td>
          <td style="text-align:center;color:#059669">${prodLiquida}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- RANKING DE PERDAS -->
  ${rankRows ? `
  <h2><span class="dot" style="background:#dc2626"></span> Ranking de Perdas do Turno</h2>
  <div class="section-box">
    <table>
      <thead><tr><th>#</th><th>Item de Perda</th><th style="text-align:center">Carros Perdidos</th></tr></thead>
      <tbody>${rankRows}</tbody>
    </table>
  </div>` : ""}

  <!-- OCORRÊNCIAS -->
  ${occRows ? `
  <h2><span class="dot" style="background:#f59e0b"></span> Ocorrências do Turno</h2>
  <div class="section-box">
    <table>
      <thead><tr><th>Tipo</th><th>Testor</th><th>Gravidade</th><th>Descrição</th></tr></thead>
      <tbody>${occRows}</tbody>
    </table>
  </div>` : `
  <div class="alert-box">✅ Nenhuma ocorrência registrada neste turno.</div>`}

  <!-- JUSTIFICATIVAS -->
  ${Object.keys(justMap).length > 0 ? `
  <h2><span class="dot" style="background:#f59e0b"></span> Justificativas por Hora</h2>
  <div class="section-box">
    <table>
      <thead><tr><th>Testor · Hora</th><th>Justificativa</th></tr></thead>
      <tbody>
        ${Object.entries(justMap).map(([key, j]) => `
          <tr>
            <td style="white-space:nowrap;font-weight:700;color:#1d4ed8">${key.replace("-", " · ")}</td>
            <td>${j.texto}${j.fotoUrl ? `<br/><img src="${j.fotoUrl}" style="max-height:100px;max-width:180px;border-radius:6px;margin-top:6px;object-fit:cover;border:1px solid #e2e8f0" />` : ""}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <span class="footer-brand">ZP7 — Volkswagen Taubaté</span>
    <span>Relatório de Fechamento de Turno — gerado automaticamente pelo sistema</span>
    <span>${geradoEm}</span>
  </div>

  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Content-Disposition": `inline; filename="relatorio_fechamento_${turnoKey}_${dataStr}.html"`,
    },
  });
});