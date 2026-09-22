import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONSENT_HTML_DOCUMENT_HASH, computeConsentHash } from "@/modules/consent/consent-hash";
import { CONSENT_HTML_VERSION, CONSENT_TEXT_HTML_CNV_V3_0 } from "@/modules/consent/text/consent-html-cnv-v3.0";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

// ═══ EL CONSENTIMIENTO DEL HTML, ARCHIVADO FIEL (importacion desde el HTML, sesion 1, 2026-09-22) ═══
//
// El texto archivado es una TRANSCRIPCION del componente `ConsentimientoScreen` del HTML de Gildardo. Lo que
// este candado garantiza, y lo que el legal necesita poder afirmar:
//   1. que cada frase del texto archivado esta en el HTML (no se anadio ni se reescribio nada);
//   2. que cada texto del documento que el HTML mostraba esta en el archivado (no se omitio nada, salvo los
//      botones y los avisos de validacion, que se declaran abajo);
//   3. que el texto es el MISMO en todas las versiones del HTML del repositorio, asi que todo paciente
//      importado firmo este;
//   4. y que su hash no cambia sin que alguien lo decida.

function htmlsDelRepositorio(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/^ATLAS.*\.html$/.test(f)) out.push(p);
    }
  };
  walk("docs/entregas");
  return out;
}

function leerLiteral(lit: string): string {
  const s = lit.replace(/\\x([0-9A-Fa-f]{2})/g, "\\u00$1").replace(/\\'/g, "'");
  return JSON.parse(`"${s}"`) as string;
}

/** Todos los textos del componente, en orden, incluidos los de las casillas (que van como `label:`). */
function textosDelComponente(html: string, soloConLetras = true): string[] {
  const i = html.indexOf("function ConsentimientoScreen(");
  const j = html.indexOf("\nfunction ", i + 10);
  const src = html.slice(i, j);
  const out: string[] = [];
  for (const m of src.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    const antes = src.slice(Math.max(0, m.index - 40), m.index);
    if (/createElement\(\s*$/.test(antes)) continue; // nombre de etiqueta
    // Los valores de propiedad no son texto, salvo el rotulo de cada casilla y la indicacion del campo del
    // nombre (su `placeholder`, que el paciente ve escrita dentro del campo).
    if (/:\s*$/.test(antes) && !/(label|placeholder):\s*$/.test(antes)) continue;
    const s = leerLiteral(m[1]);
    if (/^#[0-9a-f]{3,8}$/i.test(s)) continue; // un color
    if (/^(pointer|not-allowed|es-CO)$/.test(s)) continue; // valores de estilo dentro de un ternario
    // Para comparar frases hacen falta tambien los literales cortos (", la ", "."); para listar textos, no.
    if (soloConLetras ? /\p{L}{3,}/u.test(s) : s !== "") out.push(s);
  }
  return out;
}

// Sin espacios: el HTML parte las frases entre elementos (una negrita, un enlace) y los espacios de las
// uniones no son parte del texto. Se comparan las letras, los numeros y la puntuacion.
const sinEspacios = (s: string) => s.replace(/\s+/g, "");

// Lo que el HTML muestra y NO es el documento: los controles del formulario.
const NO_SON_DOCUMENTO = [
  "Escriba su nombre completo (mínimo 3 caracteres)",
  "Consentimiento listo para registrar",
  "No acepto — Cancelar consulta",
  "Acepto — Iniciar encuesta",
];

// El HTML VIGENTE, no una ruta fija: si llega uno nuevo con otro texto de consentimiento, la prueba de "el
// mismo texto en todas las versiones" lo dice, y ese texto nuevo es otra version que archivar.
const v9 = readFileSync(HTML_VIGENTE, "utf8");

describe("el consentimiento del HTML, archivado", () => {
  it("cada frase del archivado está en el HTML", () => {
    const html = sinEspacios(textosDelComponente(v9, false).join(""));
    const lineas = CONSENT_TEXT_HTML_CNV_V3_0.split("\n")
      .map((l) => l.replace(/^\[ \] /, ""))
      .flatMap((l) => l.split(/\{\{[a-z_]+\}\}/))
      .map((l) => l.trim())
      .filter((l) => l !== "");
    expect(lineas.length).toBeGreaterThan(30);
    for (const l of lineas) {
      // "Nombre completo del paciente / titular:" lleva los dos puntos de la transcripcion, no del HTML.
      expect(html, `no está en el HTML: ${l}`).toContain(sinEspacios(l.replace(/:$/, "")));
    }
  });

  it("y cada texto del documento está en el archivado", () => {
    const archivado = sinEspacios(CONSENT_TEXT_HTML_CNV_V3_0);
    const textos = textosDelComponente(v9)
      .map((t) => t.replace(/^[^\p{L}¿]+/u, "").trim())
      .filter((t) => t.length >= 6)
      .filter((t) => !NO_SON_DOCUMENTO.some((n) => t.includes(n)))
      .filter((t) => !/[{};]|rgba|system-ui/.test(t));
    expect(textos.length).toBeGreaterThan(40);
    for (const t of textos) expect(archivado, `falta en el archivado: ${t}`).toContain(sinEspacios(t));
  });

  it("es el mismo texto en todas las versiones del HTML del repositorio", () => {
    const files = htmlsDelRepositorio();
    expect(files.length).toBeGreaterThanOrEqual(10);
    const base = textosDelComponente(v9).join("\n");
    for (const f of files) {
      expect(textosDelComponente(readFileSync(f, "utf8")).join("\n"), `el texto cambió en ${f}`).toBe(base);
    }
  });

  it("su versión y su hash, anclados", () => {
    expect(CONSENT_HTML_VERSION).toBe("Encuesta CNV v3.0");
    expect(CONSENT_HTML_DOCUMENT_HASH).toBe(computeConsentHash(CONSENT_TEXT_HTML_CNV_V3_0));
    // Si este valor cambia, cambio el texto archivado: eso es una decision, no un ajuste.
    expect(CONSENT_HTML_DOCUMENT_HASH).toBe("6a4648033dd72d9c6a5a64025ceaa2bb16c30cf548a487672159465e9a53dbfa");
  });

  it("y la tabla nueva no es la del gate de la regla 15", () => {
    const migracion = readFileSync("drizzle/0159_consentimiento_de_origen_html.sql", "utf8");
    expect(migracion).toContain('CREATE TABLE IF NOT EXISTS "patient_external_consents"');
    expect(migracion).not.toMatch(/insert into\s+"?patient_consents/i);
    // El gate lee patient_consents, no la de origen externo.
    const gate = readFileSync("src/modules/evaluations/policies/can-create-evaluation.ts", "utf8");
    expect(gate).not.toContain("external_consents");
    expect(gate).not.toContain("patientExternalConsents");
  });
});

describe("la ficha del paciente importado lo dice", () => {
  it("la ficha lee los de origen HTML aparte y los muestra con el mensaje del enlace", () => {
    const ficha = readFileSync("src/app/(app)/pacientes/[patientId]/page.tsx", "utf8");
    expect(ficha).toContain("getExternalConsents(patientId)");
    expect(ficha).toContain("<ConsentimientosOrigenHtml");
    const panel = readFileSync("src/modules/consent/components/consentimientos-origen-html.tsx", "utf8");
    expect(panel).toContain("Consentimiento de origen HTML. Firmará el de Atlas en su próxima consulta");
    expect(panel).toContain("sin código de verificación");
  });
});
