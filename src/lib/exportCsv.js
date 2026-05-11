/**
 * Exporta um array de objetos como arquivo .csv
 * @param {string} filename - nome do arquivo (sem .csv)
 * @param {string[]} headers - cabeçalhos das colunas
 * @param {(string|number)[][]} rows - linhas de dados
 */
export function exportCsv(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
  };
  const lines = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))];
  const bom = "\uFEFF"; // BOM para Excel reconhecer UTF-8
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
}