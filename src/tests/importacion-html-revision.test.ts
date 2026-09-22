import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { difierenEnUno, normalizarDocumento } from "@/modules/importacion-html/services/normalizar";
import { revisarLote, type ContextoDeRevision } from "@/modules/importacion-html/services/revisar-lote";
import { archivoDeExportacionSchema } from "@/modules/importacion-html/validations/archivo";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ LA REVISION DEL LOTE (importacion desde el HTML, sesion 3, 2026-09-22) ═══
//
// DE PUNTA A PUNTA: el archivo lo arma el EXPORTADOR REAL sobre un navegador sintetico, lo valida el mismo
// esquema que usa la pantalla y lo revisa `revisarLote`. Si el formato del exportador y el del lector se
// separan, esto se pone rojo antes de que llegue un archivo real.

type Exportador = {
  construirExportacion(e: [string, string][], docs: string[], a: string, b: string): unknown;
};
const exportador = createRequire(import.meta.url)("../../scripts/exportador-html/exportador.js") as Exportador;

const bis = { Re: 627.3, Ri: 1306.4, Rinf: 423.8, C: 2.96, FM: 18.04, FFMI: 19.9, peso: 80.4, tallaCm: 177 };
const consulta = (extra: Record<string, unknown>) => ({
  nombre: "Ana Prueba",
  fechaNac: "1990-05-01",
  fechaConsulta: "2026-08-02",
  consentimientoAceptado: true,
  firmaNombre: "Ana Prueba",
  fechaConsentimiento: "02 de agosto de 2026",
  d2_21: ["Ninguno"],
  d3_27: "Muy mala",
  ...extra,
});

const NAVEGADOR: [string, string][] = [
  // Existe en Atlas con otro formato de documento.
  ["atlas:1.040.742.568", JSON.stringify([consulta({ ...bis, cintura: 84, cadera: 106 })])],
  // Un digito distinto de alguien de Atlas: parecido, no el mismo.
  ["atlas:1040742569", JSON.stringify([consulta({ nombre: "Otro Nombre", ...bis })])],
  // Nuevo, menor al firmar, sin firma en su segunda consulta, y una respuesta que ya no existe.
  [
    "atlas:555",
    JSON.stringify([
      consulta({ nombre: "Menor Prueba", fechaNac: "2012-01-01", fechaConsulta: "2026-01-10" }),
      consulta({
        nombre: "Menor Prueba",
        fechaNac: "2012-01-01",
        fechaConsulta: "2026-03-10",
        consentimientoAceptado: false,
        firmaNombre: "",
        d3_27: "Pésima",
        d2_21: ["Otra: ayuno prolongado"],
      }),
    ]),
  ],
  ["atlas:sesion:profesional", '{"nombre":"Profesional HTML"}'],
];

const CONTEXTO: ContextoDeRevision = {
  pacientesAtlas: [{ id: "p-1", documento: "1040742568", nombre: "Ana Prueba", fechaNacimiento: "1990-05-01" }],
  preguntas: [
    { clave: "d2_21", tipo: "opcion_multiple", opciones: ["Ninguno", "Vómito", "Otra"] },
    { clave: "d3_27", tipo: "opcion", opciones: ["Muy buena", "Buena", "Regular", "Mala", "Muy mala"] },
  ],
};

function revisar(docs: string[]) {
  const archivo = archivoDeExportacionSchema.parse(
    exportador.construirExportacion(NAVEGADOR, docs, "2026-09-22T10:00:00Z", "2026-09-22T10:00:00Z"),
  );
  return revisarLote(archivo, CONTEXTO);
}

describe("el cruce por documento", () => {
  it("normaliza puntos, espacios, guiones y ceros a la izquierda", () => {
    expect(normalizarDocumento("1.040.742.568")).toBe("1040742568");
    expect(normalizarDocumento(" 01040-742 568 ")).toBe("1040742568");
    expect(normalizarDocumento("pa-12.345")).toBe("PA12345");
    expect(difierenEnUno("1040742568", "1040742569")).toBe(true);
    expect(difierenEnUno("1040742568", "104074256")).toBe(true);
    expect(difierenEnUno("1040742568", "1040742599")).toBe(false);
  });

  it("coincidencia exacta normalizada: ya existe; un dígito distinto: parecido, sin unir", () => {
    const r = revisar(["1.040.742.568", "1040742569", "555"]);
    const [existe, parecido, nuevo] = r.pacientes;
    expect(existe.cruce).toEqual({ tipo: "existe", pacienteId: "p-1", nombre: "Ana Prueba" });
    expect(parecido.cruce.tipo).toBe("parecido");
    expect(nuevo.cruce).toEqual({ tipo: "nuevo" });
  });
});

describe("lo que el informe dice de cada consulta", () => {
  const r = revisar(["1.040.742.568", "1040742569", "555"]);
  const menor = r.pacientes[2];

  it("la firma del consentimiento, consulta por consulta", () => {
    expect(menor.consultas.map((c) => c.consentimiento.firmado)).toEqual([true, false]);
    expect(menor.consultas[0].consentimiento.nombre).toBe("Ana Prueba");
  });

  it("las respuestas que no calzan con la encuesta de hoy, y 'Otra: texto' sí calza", () => {
    expect(menor.consultas[1].respuestasQueNoCalzan).toEqual([{ clave: "d3_27", valor: "Pésima" }]);
  });

  it("la medición: completa, con faltantes, o sin medición", () => {
    expect(r.pacientes[0].consultas[0].medicion).toEqual({ tiene: true, faltan: [] });
    expect(r.pacientes[1].consultas[0].medicion).toEqual({ tiene: true, faltan: ["cintura", "cadera"] });
    expect(menor.consultas[0].medicion).toEqual({ tiene: false, faltan: [] });
  });

  it("menor de edad cuando firmó, y en orden de fecha", () => {
    expect(menor.menorDeEdad).toBe(true);
    expect(r.pacientes[0].menorDeEdad).toBe(false);
    expect(menor.consultas.map((c) => c.fecha)).toEqual(["2026-01-10", "2026-03-10"]);
  });

  it("el mismo documento dos veces en el archivo se avisa", () => {
    const doble = revisar(["555", "555"]);
    expect(doble.documentosRepetidosEnElArchivo).toEqual(["555", "555"]);
  });
});

describe("el archivo", () => {
  it("se rechaza si no es del exportador", () => {
    expect(archivoDeExportacionSchema.safeParse({ formato: "otro", version: 1 }).success).toBe(false);
    expect(archivoDeExportacionSchema.safeParse({ formato: "atlas-exportacion-html", version: 2 }).success).toBe(false);
  });
});

describe("la revisión no escribe nada", () => {
  it("ningún archivo del módulo inserta, actualiza, borra ni sube", () => {
    const archivos: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else archivos.push(p);
      }
    };
    walk("src/modules/importacion-html");
    for (const f of archivos) {
      const s = sinComentarios(readFileSync(f, "utf8"));
      // Escrituras de Supabase (from(...).insert/update/upsert/delete), de Drizzle (db.insert/update/delete,
      // transacciones) y de almacenamiento. El `.update(` del hash no es una escritura.
      expect(s, `${f} escribe`).not.toMatch(
        /\.from\([^)]*\)[\s\S]{0,40}?\.(insert|update|upsert|delete)\(|\bdb\.(insert|update|delete)\(|db\.transaction|\.rpc\(|storage\.from/,
      );
    }
  });

  it("y solo la ve admin", () => {
    const pagina = readFileSync("src/app/(app)/admin/importar-html/page.tsx", "utf8");
    expect(pagina).toContain("canImportFromHtml(user)");
    const policy = readFileSync("src/modules/importacion-html/policies/can-import-from-html.ts", "utf8");
    expect(sinComentarios(policy)).toContain('return hasRole(user, "admin");');
    const accion = readFileSync("src/modules/importacion-html/actions.ts", "utf8");
    expect(accion).toContain("if (!canImportFromHtml(user))");
  });
});
