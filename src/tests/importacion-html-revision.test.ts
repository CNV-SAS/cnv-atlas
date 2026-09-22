import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

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
    expect(r.pacientes[0].consultas[0].medicion).toEqual({ tiene: true, faltan: [], respaldo: [] });
    expect(r.pacientes[1].consultas[0].medicion).toEqual({ tiene: true, faltan: ["cintura", "cadera"], respaldo: [] });
    expect(menor.consultas[0].medicion).toEqual({ tiene: false, faltan: [], respaldo: [] });
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
  // SOLO LA REVISION: desde la sesion 4 el modulo tambien importa, y eso SI escribe. Lo que este candado
  // protege es que el camino de revisar siga sin tocar nada: se puede revisar un archivo las veces que haga
  // falta sin consecuencias.
  const DE_LA_REVISION = [
    "src/modules/importacion-html/services/revisar-lote.ts",
    "src/modules/importacion-html/services/revisar-archivo.ts",
    "src/modules/importacion-html/services/normalizar.ts",
    "src/modules/importacion-html/data/contexto-reader.ts",
    "src/modules/importacion-html/validations/archivo.ts",
  ];

  it("ningún archivo de la revisión inserta, actualiza, borra ni sube", () => {
    for (const f of DE_LA_REVISION) {
      const s = sinComentarios(readFileSync(f, "utf8"));
      // Escrituras de Supabase (from(...).insert/update/upsert/delete), de Drizzle (db.insert/update/delete,
      // transacciones) y de almacenamiento. El `.update(` del hash no es una escritura.
      expect(s, `${f} escribe`).not.toMatch(
        /\.from\([^)]*\)[\s\S]{0,40}?\.(insert|update|upsert|delete)\(|\bdb\.(insert|update|delete)\(|db\.transaction|\.rpc\(|storage\.from/,
      );
    }
  });

  it("y el escritor de la importación sí escribe, pero solo él y en una transacción", () => {
    const escritor = sinComentarios(readFileSync("src/modules/importacion-html/data/importar-lote-writer.ts", "utf8"));
    expect(escritor).toContain("db.transaction(");
    expect(escritor).toContain("recordAudit(tx,");
    // Ni diagnostico, ni tratamiento, ni reporte, ni condiciones de la toma: eso lo hace el profesional.
    for (const tabla of ["diagnoses", "treatments", "reports", "evaluationBisIntake"]) {
      expect(escritor, `el escritor escribe en ${tabla}`).not.toContain(`insert(${tabla})`);
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

// ═══ LO QUE DESTAPARON LOS DOS ARCHIVOS REALES DE SANTIAGO (2026-09-22) ═══
// Mismos casos, con datos de prueba (los archivos reales no entran al repositorio).
describe("ajustes con los archivos reales", () => {
  const exportar = (nav: [string, string][], docs: string[]) =>
    archivoDeExportacionSchema.parse(exportador.construirExportacion(nav, docs, "2026-09-22T10:00:00Z", "2026-09-22T10:00:00Z"));
  const SESION: [string, string] = ["atlas:sesion:profesional", '{"nombre":"Profesional Que Exporta"}'];

  it("la cintura guardada a mano respalda SOLO la consulta más reciente, y lo dice", () => {
    const nav: [string, string][] = [
      [
        "atlas:900",
        JSON.stringify([
          consulta({ fechaConsulta: "2026-08-13", ...bis, cintura: null, cadera: 106 }),
          consulta({ fechaConsulta: "2026-08-25", ...bis, cintura: null, cadera: 106 }),
        ]),
      ],
      ["atlas:antro:900", '{"cintura":84,"cadera":106}'],
      // El Excel guardado no la trae; lo guardado a mano si.
      ["atlas_bis_900", '{"cintura":null,"cadera":106}'],
      SESION,
    ];
    const [p] = revisarLote(exportar(nav, ["900"]), CONTEXTO).pacientes;
    expect(p.consultas[0].medicion.faltan).toEqual(["cintura"]); // la vieja: no se le presta
    expect(p.consultas[1].medicion).toEqual({
      tiene: true,
      faltan: [],
      respaldo: [{ campo: "cintura", fuente: "guardado_a_mano" }],
    });
  });

  it("un cero guardado a mano no es una cintura (su atlasCirc descarta 20 cm o menos)", () => {
    const nav: [string, string][] = [
      ["atlas:901", JSON.stringify([consulta({ ...bis, cintura: null, cadera: 106 })])],
      ["atlas:antro:901", '{"cintura":0,"cadera":106}'],
      SESION,
    ];
    expect(revisarLote(exportar(nav, ["901"]), CONTEXTO).pacientes[0].consultas[0].medicion.faltan).toEqual(["cintura"]);
  });

  it("el informe enviado al paciente no es una consulta", () => {
    const nav: [string, string][] = [
      [
        "atlas:902",
        JSON.stringify([
          { fecha: "2026-09-04", nombre: "Ana Prueba", documento: "902", informePaciente: { fechaConsulta: "2026-09-04", fechaEnvio: "2026-09-05", resumen: "..." } },
          consulta({ fechaConsulta: "2026-09-04" }),
        ]),
      ],
      SESION,
    ];
    const [p] = revisarLote(exportar(nav, ["902"]), CONTEXTO).pacientes;
    expect(p.consultas).toHaveLength(1);
    expect(p.informesEnviados).toEqual([{ fechaConsulta: "2026-09-04", fechaEnvio: "2026-09-05" }]);
    expect(p.problemas).toEqual([]);
  });

  it("el texto de una versión anterior de la encuesta y 'Otras' calzan", () => {
    const ctx: ContextoDeRevision = {
      pacientesAtlas: [],
      preguntas: [
        { clave: "d6_44", tipo: "opcion_multiple", opciones: ["Ninguna", "Gluten (trigo, pan, pasta)", "Otra"], opcionesAnteriores: ["Gluten"] },
        { clave: "d6_43", tipo: "opcion_multiple", opciones: ["Ninguna", "Maní", "Otra"] },
      ],
    };
    const nav: [string, string][] = [["atlas:903", JSON.stringify([consulta({ d6_44: ["Gluten"], d6_43: ["Otras"] })])], SESION];
    const [c] = revisarLote(exportar(nav, ["903"]), ctx).pacientes[0].consultas;
    expect(c.respuestasQueNoCalzan).toEqual([]);
    expect(c.respuestasDeVersionAnterior).toBe(1);
  });

  it("nacer después de firmar no es ser menor: es una fecha imposible", () => {
    const nav: [string, string][] = [
      ["atlas:904", JSON.stringify([consulta({ fechaNac: "2026-08-06", fechaConsulta: "2026-07-08" })])],
      SESION,
    ];
    const [p] = revisarLote(exportar(nav, ["904"]), CONTEXTO).pacientes;
    expect(p.fechaNacimientoImposible).toBe(true);
    expect(p.menorDeEdad).toBe(false);
  });

  it("la consulta de otro profesional se marca, y el lote dice quiénes aparecen", () => {
    const nav: [string, string][] = [
      [
        "atlas:905",
        JSON.stringify([
          consulta({ fechaConsulta: "2026-08-13", profesional: "Profesional Que Exporta" }),
          consulta({ fechaConsulta: "2026-08-25", profesional: "Otra Profesional" }),
        ]),
      ],
      SESION,
    ];
    const r = revisarLote(exportar(nav, ["905"]), CONTEXTO);
    expect(r.exportadoPor).toBe("Profesional Que Exporta");
    expect(r.pacientes[0].consultas.map((c) => c.deOtroProfesional)).toEqual([false, true]);
    expect(r.profesionalesDelArchivo).toEqual(["Otra Profesional", "Profesional Que Exporta"]);
  });

  it("una firma con otro nombre se avisa; un nombre corto del mismo paciente, no", () => {
    const nav: [string, string][] = [
      [
        "atlas:906",
        JSON.stringify([
          consulta({ nombre: "Nico Prueba Completo", firmaNombre: "NICO", fechaConsulta: "2026-08-13" }),
          consulta({ nombre: "Nico Prueba Completo", firmaNombre: "dsadsads", fechaConsulta: "2026-08-25" }),
        ]),
      ],
      SESION,
    ];
    const [p] = revisarLote(exportar(nav, ["906"]), CONTEXTO).pacientes;
    expect(p.consultas.map((c) => c.consentimiento.nombreDistinto)).toEqual([false, true]);
  });
});
