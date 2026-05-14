/**
 * Utilitário de exportação PDF — ZP7
 * Gera relatórios HTML visuais prontos para impressão/PDF
 */

const PDF_STYLES = `
  @page { size: A4 landscape; margin: 10mm 12mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; color: #1e293b; background: #fff; }
  .header {
    background: linear-gradient(135deg, #1d4ed8 0%, #0f172a 70%, #1e1b4b 100%);
    color: white; padding: 14px 20px; border-radius: 10px; margin-bottom: 14px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .header-title { font-size: 17px; font-weight: 900; letter-spacing: 1px; }
  .header-sub { font-size: 8px; opacity: 0.7; margin-top: 3px; }
  .header-badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 5px 12px; font-size: 10px; font-weight: 700; }
  .kpi-row { display: grid; gap: 8px; margin-bottom: 14px; }
  .kpi { border-radius: 8px; border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; position: relative; overflow: hidden; }
  .kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .kpi-blue { background: #eff6ff; } .kpi-blue::before { background: #2563eb; } .kpi-blue .val { color: #1d4ed8; }
  .kpi-red { background: #fef2f2; } .kpi-red::before { background: #dc2626; } .kpi-red .val { color: #dc2626; }
  .kpi-green { background: #f0fdf4; } .kpi-green::before { background: #16a34a; } .kpi-green .val { color: #16a34a; }
  .kpi-orange { background: #fff7ed; } .kpi-orange::before { background: #ea580c; } .kpi-orange .val { color: #ea580c; }
  .kpi-yellow { background: #fffbeb; } .kpi-yellow::before { background: #d97706; } .kpi-yellow .val { color: #d97706; }
  .kpi .val { font-size: 26px; font-weight: 900; line-height: 1; margin-bottom: 3px; }
  .kpi .lbl { font-size: 7.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .section-header {
    display: flex; justify-content: space-between; align-items: center;
    color: white; padding: 7px 12px; font-size: 10px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 1px; border-radius: 6px 6px 0 0; margin-top: 14px;
  }
  table { border-collapse: collapse; width: 100%; }
  thead th { padding: 5px 7px; font-size: 8px; font-weight: 700; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.15); color: white; text-align: left; }
  td { padding: 4px 7px; border: 1px solid #e2e8f0; font-size: 8.5px; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr.total-row td { background: #eff6ff; border-top: 2px solid #bfdbfe; font-weight: 900; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 7.5px; font-weight: 700; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-orange { background: #ffedd5; color: #9a3412; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-gray { background: #f1f5f9; color: #475569; }
  .footer { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .footer-brand { font-weight: 700; color: #64748b; }
`;

function openPdfHtml(html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function buildHeader(title, subtitle, badgeText) {
  const now = new Date().toLocaleString("pt-BR");
  return `
    <div class="header">
      <div>
        <div class="header-title">${title}</div>
        <div class="header-sub">${subtitle} · Gerado em ${now}</div>
      </div>
      ${badgeText ? `<div class="header-badge">${badgeText}</div>` : ""}
    </div>`;
}

function buildKpiRow(kpis, cols = 4) {
  const items = kpis.map(k => `
    <div class="kpi kpi-${k.color}">
      <div class="val">${k.value}</div>
      <div class="lbl">${k.label}</div>
    </div>`).join("");
  return `<div class="kpi-row" style="grid-template-columns: repeat(${cols}, 1fr)">${items}</div>`;
}

function buildSection(title, bgColor, headerColor, columns, rows, badgeMap = null) {
  const ths = columns.map((c, i) => `<th style="text-align:${i === 0 ? "left" : "center"}">${c}</th>`).join("");
  const trs = rows.map((row, ri) => {
    const isTotal = ri === rows.length - 1 && row[0]?.toString().startsWith("TOTAL");
    const tds = row.map((cell, ci) => {
      let content = cell === 0 || cell === "0" ? "—" : cell;
      if (badgeMap && badgeMap[ci] && badgeMap[ci][cell]) {
        const cls = badgeMap[ci][cell];
        content = `<span class="badge badge-${cls}">${cell}</span>`;
      }
      return `<td style="text-align:${ci === 0 ? "left" : "center"}">${content ?? "—"}</td>`;
    }).join("");
    return `<tr class="${isTotal ? "total-row" : ""}">${tds}</tr>`;
  }).join("");

  return `
    <div class="section-header" style="background:${bgColor}">
      <span>${title}</span>
    </div>
    <table>
      <thead><tr style="background:${headerColor}">${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function buildFooter() {
  const now = new Date().toLocaleString("pt-BR");
  return `
    <div class="footer">
      <span class="footer-brand">ZP7 — Volkswagen Taubaté</span>
      <span>Sistema de Controle de Produção</span>
      <span>${now}</span>
    </div>`;
}

// ─── TAREFAS ─────────────────────────────────────────────────────────────────
export function exportTasksPdf(tasks) {
  const counts = {
    abertas: tasks.filter(t => t.status === "aberta").length,
    em_andamento: tasks.filter(t => t.status === "em_andamento").length,
    concluidas: tasks.filter(t => t.status === "concluida").length,
    atrasadas: tasks.filter(t => t.status === "atrasada").length,
  };
  const rows = tasks.map(t => [
    t.titulo || "—",
    t.responsavel || "—",
    t.prioridade || "—",
    t.status?.replace(/_/g, " ") || "—",
    t.prazo || "—",
    t.descricao || "—",
  ]);

  const badgeMap = {
    2: { baixa: "blue", media: "yellow", alta: "orange", critica: "red" },
    3: { aberta: "blue", em_andamento: "yellow", concluida: "green", atrasada: "red" },
  };

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Tarefas ZP7</title>
  <style>${PDF_STYLES}</style></head><body>
  ${buildHeader("📋 Tarefas — ZP7", "Volkswagen Taubaté · Zona de Produção 7", `${tasks.length} tarefas`)}
  ${buildKpiRow([
    { label: "Abertas", value: counts.abertas, color: "blue" },
    { label: "Em Andamento", value: counts.em_andamento, color: "yellow" },
    { label: "Concluídas", value: counts.concluidas, color: "green" },
    { label: "Atrasadas", value: counts.atrasadas, color: "red" },
  ])}
  ${buildSection("LISTA DE TAREFAS", "#1d4ed8", "#1e40af",
    ["Tarefa", "Responsável", "Prioridade", "Status", "Prazo", "Descrição"],
    rows, badgeMap
  )}
  ${buildFooter()}
  <script>window.onload=function(){window.print()}<\/script></body></html>`;
  openPdfHtml(html);
}

// ─── OCORRÊNCIAS ──────────────────────────────────────────────────────────────
export function exportOccurrencesPdf(occurrences) {
  const tipoLabel = {
    falha_mecanica: "Falha Mecânica", falha_eletrica: "Falha Elétrica",
    qualidade: "Qualidade", seguranca: "Segurança", parada: "Parada", outro: "Outro"
  };
  const abertas = occurrences.filter(o => o.status === "aberta").length;
  const criticas = occurrences.filter(o => o.gravidade === "critica").length;
  const totalParada = occurrences.reduce((s, o) => s + (o.tempo_parada || 0), 0);
  const totalCarros = occurrences.reduce((s, o) => s + (o.impacto_producao || 0), 0);

  const rows = occurrences.map(o => [
    `${o.data || "—"} ${o.hora || ""}`.trim(),
    tipoLabel[o.tipo] || o.tipo || "—",
    o.testor || "—",
    o.gravidade || "—",
    o.status?.replace(/_/g, " ") || "—",
    o.tempo_parada ? `${o.tempo_parada} min` : "—",
    o.impacto_producao || 0,
    o.descricao || "—",
  ]);

  const badgeMap = {
    3: { baixa: "blue", media: "yellow", alta: "orange", critica: "red" },
    4: { aberta: "red", em_andamento: "yellow", resolvida: "green" },
  };

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ocorrências ZP7</title>
  <style>${PDF_STYLES}</style></head><body>
  ${buildHeader("⚠ Ocorrências — ZP7", "Volkswagen Taubaté · Zona de Produção 7", `${occurrences.length} registradas`)}
  ${buildKpiRow([
    { label: "Total", value: occurrences.length, color: "blue" },
    { label: "Abertas", value: abertas, color: "red" },
    { label: "Críticas", value: criticas, color: "orange" },
    { label: "T. Parado (min)", value: totalParada, color: "yellow" },
    { label: "Carros Perdidos", value: totalCarros, color: "red" },
  ], 5)}
  ${buildSection("REGISTRO DE OCORRÊNCIAS", "#dc2626", "#991b1b",
    ["Data/Hora", "Tipo", "Testor", "Gravidade", "Status", "T. Parada", "Carros", "Descrição"],
    rows, badgeMap
  )}
  ${buildFooter()}
  <script>window.onload=function(){window.print()}<\/script></body></html>`;
  openPdfHtml(html);
}

// ─── MANUTENÇÃO ───────────────────────────────────────────────────────────────
export function exportMaintenancePdf(requests) {
  const tipoLabel = { mecanica: "Mecânica", eletrica: "Elétrica", software: "Software", calibracao: "Calibração", outro: "Outro" };
  const abertos = requests.filter(r => r.status === "aberto").length;
  const concluidos = requests.filter(r => r.status === "concluido").length;
  const totalCarros = requests.reduce((s, r) => s + (r.impacto_carros || 0), 0);
  const totalMin = requests.reduce((s, r) => s + (r.tempo_estimado_reparo || 0), 0);

  const rows = requests.map(r => [
    r.testor_nome || "—",
    tipoLabel[r.tipo_falha] || r.tipo_falha || "—",
    r.prioridade || "—",
    r.status?.replace(/_/g, " ") || "—",
    r.responsavel || "—",
    r.tempo_estimado_reparo ? `${r.tempo_estimado_reparo} min` : "—",
    r.impacto_carros || 0,
    r.descricao || "—",
  ]);

  const badgeMap = {
    2: { baixa: "blue", media: "yellow", alta: "orange", critica: "red" },
    3: { aberto: "red", em_andamento: "yellow", concluido: "green" },
  };

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Manutenção ZP7</title>
  <style>${PDF_STYLES}</style></head><body>
  ${buildHeader("🔧 Chamados de Manutenção — ZP7", "Volkswagen Taubaté · Zona de Produção 7", `${requests.length} chamados`)}
  ${buildKpiRow([
    { label: "Total", value: requests.length, color: "blue" },
    { label: "Abertos", value: abertos, color: "red" },
    { label: "Concluídos", value: concluidos, color: "green" },
    { label: "T. Estimado (min)", value: totalMin, color: "yellow" },
    { label: "Carros Impactados", value: totalCarros, color: "orange" },
  ], 5)}
  ${buildSection("CHAMADOS DE MANUTENÇÃO", "#ea580c", "#9a3412",
    ["Testor", "Tipo", "Prioridade", "Status", "Responsável", "T. Reparo", "Carros", "Descrição"],
    rows, badgeMap
  )}
  ${buildFooter()}
  <script>window.onload=function(){window.print()}<\/script></body></html>`;
  openPdfHtml(html);
}

// ─── CHECKLIST ───────────────────────────────────────────────────────────────
export function exportChecklistPdf(items, categoriaLabel) {
  const total = items.length;
  const conformes = items.filter(i => i.status === "conforme").length;
  const naoConformes = items.filter(i => i.status === "nao_conforme").length;
  const pendentes = items.filter(i => i.status === "pendente").length;
  const pct = total > 0 ? Math.round((conformes / total) * 100) : 0;

  // Agrupar por categoria
  const byCategoria = {};
  items.forEach(item => {
    const cat = categoriaLabel[item.categoria] || item.categoria || "Geral";
    if (!byCategoria[cat]) byCategoria[cat] = [];
    byCategoria[cat].push(item);
  });

  const statusBadge = {
    conforme: "green", nao_conforme: "red", pendente: "yellow", nao_aplicavel: "gray"
  };
  const statusLabel = {
    conforme: "Conforme", nao_conforme: "Não Conforme", pendente: "Pendente", nao_aplicavel: "N/A"
  };

  const sections = Object.entries(byCategoria).map(([cat, catItems]) => {
    const rows = catItems.map(item => [
      item.descricao || "—",
      statusLabel[item.status] || item.status || "Pendente",
      item.responsavel || "—",
      item.horario || "—",
      item.observacao || "—",
    ]);
    const badgeMap = { 1: statusBadge };
    return buildSection(`📋 ${cat}`, "#1d4ed8", "#1e40af",
      ["Item", "Status", "Responsável", "Horário", "Observação"],
      rows, badgeMap
    );
  }).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Checklist ZP7</title>
  <style>${PDF_STYLES}</style></head><body>
  ${buildHeader("✅ Checklist — ZP7", "Volkswagen Taubaté · Zona de Produção 7", `${pct}% conforme`)}
  ${buildKpiRow([
    { label: "Total de Itens", value: total, color: "blue" },
    { label: "Conformes", value: conformes, color: "green" },
    { label: "Não Conformes", value: naoConformes, color: "red" },
    { label: "Pendentes", value: pendentes, color: "yellow" },
  ])}
  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:#0369a1;margin-bottom:6px">
      <span>📊 Conformidade Geral</span><span>${pct}%</span>
    </div>
    <div style="background:#e0f2fe;border-radius:8px;height:12px;overflow:hidden">
      <div style="height:12px;border-radius:8px;background:linear-gradient(90deg,#2563eb,#16a34a);width:${pct}%"></div>
    </div>
  </div>
  ${sections}
  ${buildFooter()}
  <script>window.onload=function(){window.print()}<\/script></body></html>`;
  openPdfHtml(html);
}