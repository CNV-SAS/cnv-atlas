import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { restriccionesDeLaEncuesta } from "@/modules/treatment/services/restricciones-de-la-encuesta";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO DE LA PRECARGA DE RESTRICCIONES (Gildardo via Santiago, 2026-09-21) ═══
//
// LO QUE SE DECIDIO: lo que el paciente declaro en patron alimentario, alergias e intolerancias, si no es
// "Ninguna", va precargado al campo de restricciones del profesional. Y el profesional lo edita o lo borra.
//
// LAS TRES COSAS QUE PUEDEN SALIR MAL SIN QUE NADA FALLE, y que este candado cierra:
//   1. Que se TRADUZCA ("Mariscos" -> "camarón, langostino"), que es contenido clinico que su archivo no
//      tiene (27-ago §10).
//   2. Que la precarga PISE lo que el profesional ya escribio al volver a entrar.
//   3. Que el patron siga llegando a la IA por el camino viejo aunque el profesional lo haya borrado.

const r = (fieldKey: string, valor: string | null) => ({ fieldKey, valor });

describe("qué se precarga", () => {
  it("lo que declaró, con la pregunta de la que vino", () => {
    expect(
      restriccionesDeLaEncuesta([
        r("d4_34", '["Vegano"]'),
        r("d6_43", '["Mariscos","Maní"]'),
        r("d6_44", '["Lactosa (leche y lácteos)"]'),
      ]),
    ).toEqual([
      "Patrón alimentario: Vegano",
      "Alergia alimentaria: Mariscos",
      "Alergia alimentaria: Maní",
      "Intolerancia alimentaria: Lactosa (leche y lácteos)",
    ]);
  });

  it("sin traducir: la opción y el texto libre van tal cual", () => {
    const lineas = restriccionesDeLaEncuesta([r("d6_43", '["Otra: frutos rojos y kiwi"]')]);
    expect(lineas).toEqual(["Alergia alimentaria: frutos rojos y kiwi"]);
    // Ni un alimento de mas: "Mariscos" no se abre en camaron, langostino o calamar.
    const mariscos = restriccionesDeLaEncuesta([r("d6_43", '["Mariscos"]')]);
    expect(mariscos).toEqual(["Alergia alimentaria: Mariscos"]);
  });

  it("\"Ninguna\" no entra, ni \"Otra\" sin texto", () => {
    expect(restriccionesDeLaEncuesta([r("d6_43", '["Ninguna"]'), r("d4_34", '["Ninguno"]')])).toEqual([]);
    expect(restriccionesDeLaEncuesta([r("d6_44", '["Otra"]'), r("d6_43", '["Otra: "]')])).toEqual([]);
  });

  it("sin respuesta no inventa nada, y otras preguntas no cuelan", () => {
    expect(restriccionesDeLaEncuesta([r("d6_43", null), r("d6_43", "")])).toEqual([]);
    expect(restriccionesDeLaEncuesta([r("d5_39", '["Diabetes"]')])).toEqual([]);
  });

  it("una opción simple guardada como texto plano también se lee", () => {
    expect(restriccionesDeLaEncuesta([r("d4_34", "Vegetariano")])).toEqual(["Patrón alimentario: Vegetariano"]);
  });
});

describe("se precarga UNA vez, al nacer el tratamiento, y nunca pisa", () => {
  const ESCRITOR = sinComentarios(readFileSync("src/modules/clinical-pipeline/data/pipeline-writer.ts", "utf8"));

  it("la precarga vive en el INSERT del tratamiento", () => {
    expect(ESCRITOR).toContain("restricciones: input.restriccionesIniciales,");
  });

  it("y ningún otro sitio del código la vuelve a escribir", () => {
    // Si alguna lectura posterior (abrir la pestaña, regenerar el menú) llamara a la precarga, lo que el
    // profesional borró en consulta volvería a aparecer. Se permite solo en los dos sitios que CREAN un
    // tratamiento: el pipeline y la corrección (que crea una versión nueva).
    const LLAMADORES = [
      "src/modules/clinical-pipeline/services/run-pipeline.ts",
      "src/modules/corrections/services/correct-evaluation.ts",
    ];
    const todos = [
      "src/modules/treatment/services/generate-menu.ts",
      "src/modules/treatment/components/treatment-panel.tsx",
      "src/modules/treatment/data/treatment-writer.ts",
      "src/modules/treatment/data/protocolo-writer.ts",
      "src/app/(app)/ani-bis-e/[id]/page.tsx",
    ];
    for (const f of LLAMADORES) {
      expect(readFileSync(f, "utf8"), f).toContain("restriccionesDeLaEncuesta(");
    }
    for (const f of todos) {
      let src = "";
      try {
        src = readFileSync(f, "utf8");
      } catch {
        continue;
      }
      expect(sinComentarios(src), `${f} vuelve a precargar`).not.toContain("restriccionesDeLaEncuesta(");
    }
  });
});

describe("un solo camino a la IA del menú", () => {
  it("el patrón ya no viaja aparte: llega dentro de las restricciones del profesional", () => {
    const GENERA = sinComentarios(readFileSync("src/modules/treatment/services/generate-menu.ts", "utf8"));
    expect(GENERA).toContain("restriccionesProfesional: protocol.restricciones");
    expect(GENERA).toContain("patronAlimentario: []");
  });
});
