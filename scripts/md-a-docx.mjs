#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DE MARKDOWN A .DOCX  ·  para los documentos que Gildardo recibe en Word
//
// ═══ POR QUE EXISTE ═══
//
// Los documentos para Gildardo se escriben en Markdown (viven en `docs/` y se versionan), y el los recibe
// en Word. Hasta hoy la conversion se hacia fuera del repo, asi que cada vez que el .md cambiaba habia que
// acordarse de regenerar el .docx a mano, y el .docx enviado podia quedar un paso atras del documento
// vivo. Eso ya tiene su precedente en esta casa: lo DERIVADO se deriva, no se mantiene en paralelo.
//
// ═══ POR QUE NO USA NINGUNA LIBRERIA ═══
//
// No hay pandoc en esta maquina, ni Python, ni una dependencia de docx o de zip declarada en el proyecto
// (hay `jszip` y `fflate` en el store de pnpm, pero son TRANSITIVAS: usarlas aqui seria depender de algo
// que nadie declaro y que desaparece el dia que su padre cambie de version). Y agregar una dependencia
// pide la aprobacion de DEPLOY.md.
//
// Un .docx es un ZIP con cuatro XML dentro, asi que el contenedor se escribe a mano. VA EN MODO "STORE"
// (sin comprimir, metodo 0): Word lo abre igual y se evita toda la superficie de error de la compresion.
// El archivo pesa mas, y para un documento de texto eso son unos cientos de kilobytes.
//
// ═══ QUE ENTIENDE DEL MARKDOWN ═══
//
// Lo que estos documentos usan, y nada mas: titulos `#` a `###`, parrafos, `**negrita**`, `*cursiva*`,
// `codigo`, tablas con `|`, citas con `>`, listas con `-` y `1.`, y la regla `---`. Lo que no entienda lo
// deja como texto plano, que es la salida segura: un documento con un asterisco de mas se lee; uno al que
// le falta un parrafo, no.
//
// USO:  node scripts/md-a-docx.mjs <entrada.md> <salida.docx>
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

// ── EL ZIP, EN MODO STORE ───────────────────────────────────────────────────────────────────────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Un ZIP sin comprimir desde una lista de {nombre, datos}. */
function zip(entradas) {
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const { nombre, datos } of entradas) {
    const nombreBuf = Buffer.from(nombre, "utf8");
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // firma
    local.writeUInt16LE(20, 4); // version necesaria
    local.writeUInt16LE(0, 6); // banderas
    local.writeUInt16LE(0, 8); // metodo 0 = store
    local.writeUInt16LE(0, 10); // hora
    local.writeUInt16LE(0x21, 12); // fecha (1 de enero de 1980, fija: la salida es reproducible)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombreBuf.length, 26);
    local.writeUInt16LE(0, 28); // sin extra
    locales.push(local, nombreBuf, datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version que lo creo
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(nombreBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrales.push(central, nombreBuf);

    offset += local.length + nombreBuf.length + datos.length;
  }
  const cuerpo = Buffer.concat(locales);
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(cuerpo.length, 16);
  fin.writeUInt16LE(0, 20);
  return Buffer.concat([cuerpo, directorio, fin]);
}

// ── EL XML ──────────────────────────────────────────────────────────────────────────────────────────

const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * UN TROZO DE TEXTO CON SU FORMATO, a partir del Markdown en linea.
 *
 * SE PARTE CON UNA SOLA PASADA y no con tres `replace` anidados: `**texto con *enfasis* dentro**` es
 * frecuente en estos documentos, y tres pasadas independientes dejan asteriscos sueltos en la salida.
 */
function trozos(texto) {
  const salida = [];
  const re = /(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) salida.push({ t: texto.slice(ultimo, m.index) });
    const bruto = m[0];
    if (bruto.startsWith("***")) salida.push({ t: bruto.slice(3, -3), b: true, i: true });
    else if (bruto.startsWith("**")) salida.push({ t: bruto.slice(2, -2), b: true });
    else if (bruto.startsWith("`")) salida.push({ t: bruto.slice(1, -1), mono: true });
    else salida.push({ t: bruto.slice(1, -1), i: true });
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) salida.push({ t: texto.slice(ultimo) });
  return salida.length ? salida : [{ t: "" }];
}

function runs(texto, { color, mono } = {}) {
  return trozos(texto)
    .map((p) => {
      const props = [];
      if (p.b) props.push("<w:b/>");
      if (p.i) props.push("<w:i/>");
      if (p.mono || mono) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
      if (color) props.push(`<w:color w:val="${color}"/>`);
      const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
      return `<w:r>${rPr}<w:t xml:space="preserve">${esc(p.t)}</w:t></w:r>`;
    })
    .join("");
}

const parrafo = (texto, { estilo, color, mono } = {}) =>
  `<w:p>${estilo ? `<w:pPr><w:pStyle w:val="${estilo}"/></w:pPr>` : ""}${runs(texto, { color, mono })}</w:p>`;

/** Una tabla de Markdown: la primera fila es encabezado y la de guiones se descarta. */
function tabla(filas) {
  const celdas = (fila, encabezado) =>
    fila
      .map(
        (c) =>
          `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${
            encabezado ? '<w:shd w:val="clear" w:fill="EEF2F7"/>' : ""
          }</w:tcPr>${parrafo(encabezado ? `**${c}**` : c)}</w:tc>`,
      )
      .join("");
  const cuerpo = filas
    .map((f, i) => `<w:tr>${celdas(f, i === 0)}</w:tr>`)
    .join("");
  return (
    '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/>' +
    '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFBFBF"/>' +
    '<w:left w:val="single" w:sz="4" w:color="BFBFBF"/>' +
    '<w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/>' +
    '<w:right w:val="single" w:sz="4" w:color="BFBFBF"/>' +
    '<w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/>' +
    '<w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/></w:tblBorders></w:tblPr>' +
    cuerpo +
    "</w:tbl>" +
    parrafo("")
  );
}

const filaDeTabla = (linea) =>
  linea
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const esSeparadorDeTabla = (linea) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(linea.trim()) && linea.includes("-");

/** El cuerpo del documento desde el Markdown. */
function cuerpoDocx(md) {
  const lineas = md.split(/\r?\n/);
  const salida = [];
  let i = 0;
  // Un parrafo puede ocupar varias lineas: se juntan hasta la linea vacia.
  const juntar = (predicado) => {
    const partes = [];
    while (i < lineas.length && lineas[i].trim() !== "" && predicado(lineas[i])) {
      partes.push(lineas[i].trim());
      i++;
    }
    return partes.join(" ");
  };

  while (i < lineas.length) {
    const linea = lineas[i];
    const limpia = linea.trim();

    if (limpia === "") {
      i++;
      continue;
    }
    // Titulos
    const titulo = /^(#{1,4})\s+(.*)$/.exec(limpia);
    if (titulo) {
      salida.push(parrafo(titulo[2], { estilo: `Heading${titulo[1].length}` }));
      i++;
      continue;
    }
    // Regla horizontal: en Word es un parrafo con borde inferior.
    if (/^(---|\*\*\*|___)$/.test(limpia)) {
      salida.push(
        '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="BFBFBF"/></w:pBdr></w:pPr></w:p>',
      );
      i++;
      continue;
    }
    // Tabla
    if (limpia.startsWith("|") && i + 1 < lineas.length && esSeparadorDeTabla(lineas[i + 1])) {
      const filas = [filaDeTabla(lineas[i])];
      i += 2; // el encabezado y su separador
      while (i < lineas.length && lineas[i].trim().startsWith("|")) {
        filas.push(filaDeTabla(lineas[i]));
        i++;
      }
      salida.push(tabla(filas));
      continue;
    }
    // Cita
    if (limpia.startsWith(">")) {
      const texto = juntar((l) => l.trim().startsWith(">"))
        .replace(/>\s?/g, " ")
        .trim();
      salida.push(parrafo(texto, { estilo: "Quote", color: "444444" }));
      continue;
    }
    // Lista con viñeta o numerada
    const lista = /^([-*]|\d+\.)\s+(.*)$/.exec(limpia);
    if (lista) {
      const numerada = /^\d+\./.test(lista[1]);
      while (i < lineas.length) {
        const l = lineas[i].trim();
        const m = /^([-*]|\d+\.)\s+(.*)$/.exec(l);
        if (!m) {
          // Una linea sin marca que sigue a un item es su continuacion (sangria del Markdown).
          if (l !== "" && /^\s/.test(lineas[i]) && salida.length) {
            salida[salida.length - 1] = salida[salida.length - 1].replace(
              "</w:p>",
              `${runs(" " + l)}</w:p>`,
            );
            i++;
            continue;
          }
          break;
        }
        salida.push(
          `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/>` +
            `<w:numId w:val="${numerada ? 2 : 1}"/></w:numPr></w:pPr>${runs(m[2])}</w:p>`,
        );
        i++;
      }
      continue;
    }
    // Parrafo normal
    const texto = juntar((l) => {
      const t = l.trim();
      return (
        !/^#{1,4}\s/.test(t) &&
        !t.startsWith("|") &&
        !t.startsWith(">") &&
        !/^([-*]|\d+\.)\s/.test(t) &&
        !/^(---|\*\*\*|___)$/.test(t)
      );
    });
    if (texto) salida.push(parrafo(texto));
    else i++;
  }
  return salida.join("");
}

// ── LOS CUATRO XML DEL CONTENEDOR ───────────────────────────────────────────────────────────────────

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

/** Un estilo de titulo: tamaño en medios puntos, color del azul hondo de marca. */
const estiloTitulo = (n, medioPunto) =>
  `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/>` +
  `<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 360 : 240}" w:after="120"/></w:pPr>` +
  `<w:rPr><w:b/><w:color w:val="071B4D"/><w:sz w:val="${medioPunto}"/></w:rPr></w:style>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
${estiloTitulo(1, 36)}${estiloTitulo(2, 28)}${estiloTitulo(3, 24)}${estiloTitulo(4, 22)}
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/>
<w:pPr><w:ind w:left="360"/><w:pBdr><w:left w:val="single" w:sz="12" w:color="205DFD"/></w:pBdr></w:pPr>
<w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>
<w:pPr><w:ind w:left="720"/><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>
</w:styles>`;

const nivel = (id, formato, texto) =>
  `<w:abstractNum w:abstractNumId="${id}"><w:lvl w:ilvl="0"><w:start w:val="1"/>` +
  `<w:numFmt w:val="${formato}"/><w:lvlText w:val="${texto}"/><w:lvlJc w:val="left"/>` +
  `<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${nivel(0, "bullet", "•")}${nivel(1, "decimal", "%1.")}
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

// ── MAIN ────────────────────────────────────────────────────────────────────────────────────────────

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) {
  console.error("uso: node scripts/md-a-docx.mjs <entrada.md> <salida.docx>");
  process.exit(1);
}

const md = fs.readFileSync(entrada, "utf8");
const cuerpo = cuerpoDocx(md);

const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${cuerpo}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>` +
  `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;

const partes = [
  { nombre: "[Content_Types].xml", datos: Buffer.from(CONTENT_TYPES, "utf8") },
  { nombre: "_rels/.rels", datos: Buffer.from(RELS, "utf8") },
  { nombre: "word/document.xml", datos: Buffer.from(DOCUMENT, "utf8") },
  { nombre: "word/styles.xml", datos: Buffer.from(STYLES, "utf8") },
  { nombre: "word/numbering.xml", datos: Buffer.from(NUMBERING, "utf8") },
  { nombre: "word/_rels/document.xml.rels", datos: Buffer.from(DOC_RELS, "utf8") },
];

fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, zip(partes));

const parrafos = (cuerpo.match(/<w:p>/g) ?? []).length;
const tablas = (cuerpo.match(/<w:tbl>/g) ?? []).length;
console.log(
  `${salida}: ${parrafos} parrafos, ${tablas} tablas, ${(fs.statSync(salida).size / 1024).toFixed(0)} KB`,
);
