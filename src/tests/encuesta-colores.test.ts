import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { COLOR_DE_NIVEL, nivelDeRespuesta } from "@/clinical-engine/encuesta-colores";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

// ═══ CANDADO DE LOS COLORES DE LA ENCUESTA (porte del ATLAS_v9, 2026-09-21) ═══
//
// QUE PROTEGE: que el clasificador de D2-D8 siga siendo EL SUYO. Es texto clinico que decide que respuesta
// sale en rojo delante del profesional, y dos cosas pueden romperlo sin que nada falle:
//
//   1. Que el mande otra entrega y cambie una rama (un campo nuevo, una opcion que pasa de ambar a rojo).
//   2. Que NUESTRA encuesta cambie el texto de una opcion. Su clasificador compara por texto exacto
//      ("7–8 horas"); si la opcion guardada dice otra cosa, la respuesta cae a la rama por defecto y sale en
//      ROJO sin serlo. Es el peor fallo posible aqui, porque se ve como un veredicto.
//
// POR ESO SE DERIVA DE LOS DOS ARCHIVOS: su HTML vigente (el clasificador) y nuestro seed (las opciones).

const HTML = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
const SEED = readFileSync("supabase/seed.ts", "utf8").replace(/\r\n/g, "\n");
const NUESTRO = readFileSync("src/clinical-engine/encuesta-colores.ts", "utf8");

/** Su `_encClf`, de la apertura al cierre del `switch`. */
function suClasificador(): string {
  const i = HTML.indexOf("const _encClf = (k, v) => {");
  if (i < 0) throw new Error(`no aparece _encClf en ${HTML_VIGENTE}`);
  const fin = HTML.indexOf("default: return ENC_INFO;", i);
  if (fin < 0) throw new Error("no aparece el default de _encClf");
  return HTML.slice(i, fin);
}

/** Los campos que su clasificador juzga, en su orden. */
function susCampos(): string[] {
  return [...suClasificador().matchAll(/case "([a-z0-9_]+)":/g)].map((m) => m[1]);
}

/** Cada campo con las opciones que su rama nombra. */
function susOpcionesPorCampo(): Map<string, string[]> {
  const src = suClasificador();
  const out = new Map<string, string[]>();
  // Un bloque = uno o varios `case` seguidos y su cuerpo hasta el siguiente `case` o el final.
  const bloques = src.split(/\n\s*(?=case ")/).slice(1);
  let pendientes: string[] = [];
  for (const b of bloques) {
    const campos = [...b.matchAll(/case "([a-z0-9_]+)":/g)].map((m) => m[1]);
    const cuerpo = b.replace(/case "[a-z0-9_]+":/g, "");
    const opciones = [...cuerpo.matchAll(/es\(([^)]*)\)/g)].flatMap((m) =>
      [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
    );
    pendientes.push(...campos);
    if (cuerpo.trim()) {
      for (const c of pendientes) out.set(c, opciones);
      pendientes = [];
    }
  }
  return out;
}

/** Las opciones de una pregunta en nuestro seed. */
function opcionesDelSeed(campo: string): string[] | null {
  const linea = SEED.split("\n").find((l) => l.includes(`key: "${campo}"`));
  if (!linea) return null;
  const m = /options: \[([^\]]*)\]/.exec(linea);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
}

describe("el clasificador es el suyo", () => {
  it("el control: su clasificador se lee y trae campos", () => {
    expect(susCampos().length, "no se leyó ningún campo de _encClf").toBeGreaterThan(20);
    // Y el extractor de opciones no esta vacio: sin esto, los dos barridos de abajo pasarian comparando nada.
    expect(susOpcionesPorCampo().get("d3_26")).toEqual(["7–8 horas", "6–7 horas", "5–6 horas"]);
    expect(susOpcionesPorCampo().get("d6_49")).toEqual(["Nunca", "A veces"]);
  });

  it("juzga exactamente los mismos campos que el suyo", () => {
    const nuestros = [...NUESTRO.matchAll(/case "([a-z0-9_]+)":/g)].map((m) => m[1]);
    expect(nuestros).toEqual(susCampos());
  });

  it("y cada opción que él nombra aparece en nuestro porte", () => {
    for (const [campo, opciones] of susOpcionesPorCampo()) {
      for (const o of opciones) {
        expect(NUESTRO, `${campo}: su rama nombra "${o}" y la nuestra no`).toContain(`"${o}"`);
      }
    }
  });

  it("los colores son los suyos, verbatim", () => {
    const m = /const ENC_OK = "(#[0-9a-f]{6})", ENC_MED = "(#[0-9a-f]{6})", ENC_ALT = "(#[0-9a-f]{6})",\s*ENC_INFO = "(#[0-9a-f]{6})", ENC_NA = "(#[0-9a-f]{6})"/.exec(
      HTML,
    );
    expect(m, "no se leyeron sus colores").not.toBeNull();
    expect([
      COLOR_DE_NIVEL.adecuado,
      COLOR_DE_NIVEL.vigilar,
      COLOR_DE_NIVEL.atencion,
      COLOR_DE_NIVEL.informativo,
      COLOR_DE_NIVEL.sin_dato,
    ]).toEqual(m!.slice(1, 6));
  });
});

describe("las opciones que su clasificador compara existen en NUESTRA encuesta", () => {
  // Si no existieran, la respuesta del paciente nunca coincidiria con su texto y caeria a la rama por
  // defecto, que en casi todos los campos es la ROJA.
  it("cada opción nombrada es una opción real de esa pregunta", () => {
    for (const [campo, opciones] of susOpcionesPorCampo()) {
      const delSeed = opcionesDelSeed(campo);
      expect(delSeed, `${campo} no existe en nuestra encuesta`).not.toBeNull();
      // Los campos numéricos o de escala (d3_23, d3_29) no tienen opciones que comparar.
      if (!delSeed!.length) continue;
      for (const o of opciones) {
        expect(delSeed, `${campo}: su clasificador espera "${o}" y nuestra encuesta no la ofrece`).toContain(o);
      }
    }
  });
});

describe("cómo lee cada respuesta", () => {
  const vacia = {};

  it("sueño: 7-8 horas adecuado, 6-7 vigilar, menos de 5 atención", () => {
    expect(nivelDeRespuesta("d3_26", "7–8 horas", vacia)).toBe("adecuado");
    expect(nivelDeRespuesta("d3_26", "6–7 horas", vacia)).toBe("vigilar");
    expect(nivelDeRespuesta("d3_26", "Menos de 5h", vacia)).toBe("atencion");
  });

  it("actividad física: se juzga con días por minutos, como en su LE8", () => {
    // 5 días de 30-45 min = 185 min: cumple los 150 de su corte.
    expect(nivelDeRespuesta("d3_24", "30–45 min", { d3_23: "5", d3_24: "30–45 min" })).toBe("adecuado");
    expect(nivelDeRespuesta("d3_23", "1", { d3_23: "1", d3_24: "15–30 min" })).toBe("vigilar");
    expect(nivelDeRespuesta("d3_24", "0 minutos a la semana", { d3_23: "3", d3_24: "0 minutos a la semana" })).toBe(
      "atencion",
    );
  });

  it("conductas de riesgo de la 21: cualquiera de las tres es atención", () => {
    expect(nivelDeRespuesta("d2_21", ["Vómito"], vacia)).toBe("atencion");
    expect(nivelDeRespuesta("d2_21", ["Ninguno"], vacia)).toBe("adecuado");
  });

  it("estrés: 1-3 bajo, 4-6 moderado, 7 o más elevado; 0 no es una respuesta", () => {
    expect(nivelDeRespuesta("d3_29", "2", vacia)).toBe("adecuado");
    expect(nivelDeRespuesta("d3_29", "5", vacia)).toBe("vigilar");
    expect(nivelDeRespuesta("d3_29", "8", vacia)).toBe("atencion");
    expect(nivelDeRespuesta("d3_29", "0", vacia)).toBe("sin_dato");
  });
});

describe("el gris no es normal", () => {
  // Su guia: "Gris no significa normal: significa que ATLAS registra el dato pero no emite juicio sobre él".
  it("un campo sin criterio queda informativo, nunca adecuado", () => {
    for (const campo of ["d2_19", "d2_20", "d4_32", "d4_34", "d5_39", "d5_40", "d8_59"]) {
      expect(nivelDeRespuesta(campo, "cualquier cosa", {}), campo).toBe("informativo");
    }
  });

  it("sin respuesta es sin dato, no adecuado ni informativo", () => {
    expect(nivelDeRespuesta("d3_26", "", {})).toBe("sin_dato");
    expect(nivelDeRespuesta("d3_26", null, {})).toBe("sin_dato");
    expect(nivelDeRespuesta("d6_43", [], {})).toBe("sin_dato");
  });

  it("y los dos grises no son el verde", () => {
    expect(COLOR_DE_NIVEL.informativo).not.toBe(COLOR_DE_NIVEL.adecuado);
    expect(COLOR_DE_NIVEL.sin_dato).not.toBe(COLOR_DE_NIVEL.adecuado);
  });
});

describe("un solo semáforo en la pantalla de la encuesta", () => {
  // Santiago: los chips de D2-D8 se veían distintos a los de D1. Los hex eran los mismos; la FORMA no
  // (tamaño, fondo, borde). Un semáforo con dos verdes en la misma pantalla se lee como dos significados.
  const SECCION = readFileSync("src/modules/diagnoses/components/survey-diagnosis-section.tsx", "utf8");

  it("D1 y D2-D8 usan la misma pastilla", () => {
    expect(SECCION).toContain("function PastillaDeColor(");
    expect(SECCION).not.toContain("function PastillaDeRespuesta(");
    // Una en la grilla de D1 y otra en el read-out de D2-D8.
    expect((SECCION.match(/<PastillaDeColor\s/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("y los colores de D1 son los mismos del clasificador de D2-D8", () => {
    for (const hex of [COLOR_DE_NIVEL.adecuado, COLOR_DE_NIVEL.vigilar, COLOR_DE_NIVEL.atencion, COLOR_DE_NIVEL.sin_dato]) {
      expect(SECCION, `D1 no usa ${hex}`).toContain(`"${hex}"`);
    }
  });
});

describe("el tamaño de la pastilla sigue a su contexto", () => {
  // Santiago: en D2-D8 la pastilla se leía pequeña al lado de la pregunta. Mide lo que la pregunta.
  const SECCION = readFileSync("src/modules/diagnoses/components/survey-diagnosis-section.tsx", "utf8");

  it("en D2-D8, 12 px en negrita junto a la pregunta de 14, como en D1, y apilada en angosto", () => {
    expect(SECCION).toContain("flex flex-col gap-1 py-2 sm:flex-row");
    expect(SECCION).toContain('tamano="respuesta"');
    expect(SECCION).toContain('"rounded-xl px-2.5 py-0.5 text-xs leading-snug"');
  });

  it("en D1, un escalón más que antes, grupo y pastilla juntos", () => {
    expect(SECCION).toContain('"rounded-full px-2 py-0.5 text-xs"');
    expect(SECCION).toContain('<span className="text-sm text-foreground">{g.label}</span>');
    expect(SECCION).not.toContain("text-[10px]");
  });
});
