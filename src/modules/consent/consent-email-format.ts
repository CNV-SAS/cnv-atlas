// Conversor del markdown del consentimiento a (a) HTML con estilos EN LINEA para el correo y (b) texto
// plano LIMPIO como alternativa. Modulo puro (sin server-only). No es un parser de markdown general:
// cubre EXACTAMENTE el subconjunto que usa el consentimiento (encabezados, negrita, citas, tablas,
// listas, casillas, reglas, codigo en linea), con control total sobre los estilos.
//
// Decisiones para clientes de correo reales:
//  - Estilos EN LINEA en cada elemento (muchos clientes descartan <style> o <head>).
//  - Tema CLARO (texto oscuro sobre blanco): legible e IMPRIMIBLE (nada de fondos oscuros ni columnas
//    fijas que se rompan al imprimir).
//  - La TABLA del numeral 2 se convierte en LINEAS "etiqueta: valor": las tablas se comportan distinto
//    en cada cliente; es presentacion, no contenido. Asi nunca se descuadra.
//  - El texto plano alternativo NO lleva simbolos de markdown: si un cliente no muestra HTML, el
//    paciente recibe texto limpio, no ##, ** ni tuberias.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Inline para HTML: escapa, quita backticks (deja el valor), aplica negrita (**) y cursiva (*). El
// orden importa: ** antes de * (si no, ** se comeria como dos cursivas vacias).
function inlineHtml(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// Inline para texto plano: quita backticks y marcadores de negrita/cursiva, deja el contenido.
function inlineText(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

function splitCells(row: string): string[] {
  return row
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

// Fila de tabla "de datos" (no separadora ni de encabezado vacio): tiene alguna celda con contenido y
// no es solo guiones.
function isDataRow(cells: string[]): boolean {
  return cells.some((c) => c !== "" && !/^-+$/.test(c));
}

const S = {
  container:
    "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.5;font-size:14px;max-width:640px;margin:0 auto;padding:16px;background:#ffffff;",
  h2: "font-size:18px;font-weight:700;margin:20px 0 8px;color:#0f172a;",
  h3: "font-size:15px;font-weight:700;margin:14px 0 6px;color:#0f172a;",
  p: "margin:8px 0;",
  quote:
    "margin:8px 0;padding:8px 12px;border-left:3px solid #cbd5e1;background:#f8fafc;color:#334155;",
  hr: "border:none;border-top:1px solid #e2e8f0;margin:16px 0;",
  item: "margin:3px 0;",
};

function renderListItemHtml(item: string): string {
  if (/^\[x\]\s/i.test(item)) return `<p style="${S.item}">&#9745; ${inlineHtml(item.slice(4))}</p>`;
  if (/^\[ \]\s/.test(item)) return `<p style="${S.item}">&#9744; ${inlineHtml(item.slice(4))}</p>`;
  return `<p style="${S.item}">&bull; ${inlineHtml(item)}</p>`;
}

export function markdownToEmailHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(`<h2 style="${S.h2}">${inlineHtml(line.slice(3))}</h2>`);
      i++;
    } else if (line.startsWith("### ")) {
      out.push(`<h3 style="${S.h3}">${inlineHtml(line.slice(4))}</h3>`);
      i++;
    } else if (line.trim() === "---") {
      out.push(`<hr style="${S.hr}">`);
      i++;
    } else if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      for (const r of rows) {
        const cells = splitCells(r);
        if (!isDataRow(cells)) continue; // separador |---| o encabezado vacio | |
        const label = cells[0];
        const rest = cells.slice(1).filter((c) => c !== "");
        const body = label ? `${inlineHtml(label)}: ${rest.map(inlineHtml).join(" ")}` : rest.map(inlineHtml).join(" ");
        out.push(`<p style="${S.p}">${body}</p>`);
      }
    } else if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote style="${S.quote}">${quote.map(inlineHtml).join("<br>")}</blockquote>`);
    } else if (/^-\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s/.test(lines[i])) items.push(lines[i++].slice(2));
      out.push(items.map(renderListItemHtml).join("\n"));
    } else {
      const para: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !/^(#{2,3}\s|>|\||-\s)/.test(lines[i]) &&
        lines[i].trim() !== "---"
      ) {
        para.push(lines[i++]);
      }
      out.push(`<p style="${S.p}">${para.map(inlineHtml).join(" ")}</p>`);
    }
  }
  return `<div style="${S.container}">\n${out.join("\n")}\n</div>`;
}

export function markdownToPlainText(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      for (const r of rows) {
        const cells = splitCells(r);
        if (!isDataRow(cells)) continue;
        out.push(cells.filter((c) => c !== "").map(inlineText).join(": "));
      }
      continue;
    }
    line = line.replace(/^#{1,6}\s+/, "").replace(/^>\s?/, "");
    if (/^-\s\[x\]\s/i.test(line)) line = "[x] " + line.replace(/^-\s\[x\]\s/i, "");
    else if (/^-\s\[ \]\s/.test(line)) line = "[ ] " + line.replace(/^-\s\[ \]\s/, "");
    else if (/^-\s/.test(line)) line = "- " + line.replace(/^-\s/, "");
    if (line.trim() === "---") line = "------------------------------";
    out.push(inlineText(line));
    i++;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
