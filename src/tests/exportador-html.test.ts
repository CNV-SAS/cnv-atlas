import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";

import { describe, expect, it } from "vitest";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

// ═══ EL EXPORTADOR DEL HTML (importacion desde el HTML, sesion 2, 2026-09-22) ═══
//
// Sobre una copia SINTETICA del navegador de un profesional: exporta lo que hay, no inventa y no pierde
// claves. Y la copia que se distribuye es el HTML de Gildardo intacto mas el exportador.

type Exportador = {
  DECLARACION: string[];
  listarPacientes(e: [string, string][]): { documento: string; nombre: string; consultas: number; ultimaConsulta: string }[];
  construirExportacion(
    e: [string, string][],
    docs: string[],
    aceptadaEn: string,
    ahora: string,
  ): {
    formato: string;
    version: number;
    profesional: string | null;
    declaracion: { version: string; texto: string[]; aceptadaEn: string };
    pacientes: { documento: string; clave: string; historia: string | null; relacionadas: Record<string, string> }[];
  };
};

const exportador = createRequire(import.meta.url)("../../scripts/exportador-html/exportador.js") as Exportador;

const HISTORIA_123 = JSON.stringify([
  {
    documento: "123",
    nombre: "Ana Prueba",
    fechaConsulta: "2026-08-02",
    firmaNombre: "Ana Prueba",
    fechaConsentimiento: "02 de agosto de 2026",
    email: "ana@example.com",
    telefono: "3000000000",
    etnia: "Ninguna",
    d5_41: "No",
  },
  { documento: "123", nombre: "Ana Prueba", fechaConsulta: "2026-09-02", Re: 627.3 },
]);
const HISTORIA_1234 = JSON.stringify([{ documento: "1234", nombre: "Beto Prueba", fechaConsulta: "2026-07-01" }]);

// Lo que un navegador real tiene: pacientes, sus claves relacionadas y claves del propio HTML que no son
// de ningun paciente.
const NAVEGADOR: [string, string][] = [
  ["atlas:123", HISTORIA_123],
  ["atlas:1234", HISTORIA_1234],
  ["atlas_bis_123", '{"Re":627.3}'],
  ["atlas:antro:123", '{"cintura":84}'],
  ["atlas:plan:123", '{"kcal":2377}'],
  ["atlas_bis_1234", '{"Re":500}'],
  ["atlas:profesionales", "[]"],
  ["atlas:_pendingSync", "[]"],
  ["atlas:sesion:profesional", '{"nombre":"Profesional HTML"}'],
  ["atlas_peso_meta", "70"],
  ["atlas_ultimo_paciente", "123"],
];

describe("el exportador, sobre un navegador sintético", () => {
  it("lista solo los pacientes, con su nombre y sus consultas", () => {
    const lista = exportador.listarPacientes(NAVEGADOR);
    expect(lista.map((p) => p.documento).sort()).toEqual(["123", "1234"]);
    const ana = lista.find((p) => p.documento === "123");
    expect(ana).toEqual({ documento: "123", nombre: "Ana Prueba", consultas: 2, ultimaConsulta: "2026-09-02" });
  });

  it("exporta lo que hay, tal cual, sin leerlo ni reescribirlo", () => {
    const exp = exportador.construirExportacion(NAVEGADOR, ["123"], "2026-09-22T10:00:00Z", "2026-09-22T10:00:00Z");
    expect(exp.pacientes).toHaveLength(1);
    const p = exp.pacientes[0];
    // La historia, byte por byte: con la firma, la etnia y el contacto, que la copia en la nube no tiene.
    expect(p.historia).toBe(HISTORIA_123);
    expect(p.historia).toContain('"firmaNombre":"Ana Prueba"');
    expect(p.historia).toContain('"etnia":"Ninguna"');
    // Todas sus claves relacionadas, y ninguna de otro paciente ("atlas_bis_1234" no es de "123").
    expect(p.relacionadas).toEqual({
      atlas_bis_123: '{"Re":627.3}',
      "atlas:antro:123": '{"cintura":84}',
      "atlas:plan:123": '{"kcal":2377}',
    });
    expect(exp.profesional).toBe('{"nombre":"Profesional HTML"}');
  });

  it("no inventa: un paciente no marcado no viaja", () => {
    const exp = exportador.construirExportacion(NAVEGADOR, ["123"], "x", "x");
    expect(JSON.stringify(exp)).not.toContain("Beto Prueba");
    expect(JSON.stringify(exp)).not.toContain('"Re":500');
  });

  it("lleva la declaración del legal, sus tres partes, con versión y fecha", () => {
    const exp = exportador.construirExportacion(NAVEGADOR, ["123"], "2026-09-22T10:00:00Z", "2026-09-22T10:00:00Z");
    expect(exp.formato).toBe("atlas-exportacion-html");
    expect(exp.version).toBe(1);
    expect(exp.declaracion.version).toBe("1.0");
    expect(exp.declaracion.aceptadaEn).toBe("2026-09-22T10:00:00Z");
    expect(exp.declaracion.texto).toHaveLength(3);
    expect(exp.declaracion.texto.join(" ")).toContain("voluntad de continuar su atención en Atlas web");
    expect(exp.declaracion.texto.join(" ")).toContain("con el texto del consentimiento de este HTML");
    expect(exp.declaracion.texto.join(" ")).toContain("Esta exportación es fiel");
  });
});

describe("la copia que se distribuye", () => {
  // La copia se arma sobre el HTML VIGENTE y conserva su nombre. Cuando llegue otro, esto falla hasta que se
  // vuelva a correr construir.mjs sobre el nuevo.
  const original = readFileSync(HTML_VIGENTE, "utf8");
  const copia = readFileSync(join("docs/distribucion/exportador-html", basename(HTML_VIGENTE)), "utf8");
  const script = readFileSync("scripts/exportador-html/exportador.js", "utf8");

  it("es el HTML de Gildardo intacto más el exportador, y está al día con el script", () => {
    const marca = "<!-- EXPORTADOR A ATLAS WEB (agregado por CNV; el resto del archivo es el original) -->";
    const i = copia.indexOf(marca);
    expect(i).toBeGreaterThan(0);
    const bloque = `${marca}\n<script>\n${script}\n</script>\n`;
    // Si esto falla, se cambio exportador.js sin volver a correr construir.mjs.
    expect(copia.slice(i, i + bloque.length)).toBe(bloque);
    expect(copia.slice(0, i) + copia.slice(i + bloque.length)).toBe(original);
  });

  it("el script para la consola es el mismo del exportador", () => {
    expect(readFileSync("docs/distribucion/exportador-html/exportador-consola.js", "utf8")).toBe(script);
  });

  it("ningún dato del paciente se inserta como HTML: todo va por textContent", () => {
    expect(script).not.toContain("innerHTML");
    expect(script).not.toContain("insertAdjacentHTML");
  });
});
