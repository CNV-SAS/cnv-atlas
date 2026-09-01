import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE "LOS DOS DOCUMENTOS DE UNA CONSULTA DICEN LO MISMO" (smoke 2026-09-01).
//
// EL DEFECTO: el reporte del paciente sacaba sus cifras de la cadena EFECTIVA (lo que el profesional
// prescribió) y la historia clínica las sacaba del snapshot SELLADO (lo que el modelo había propuesto,
// antes de los ajustes). Con el paciente del smoke: el nutricionista fijó su objetivo y la historia
// registró 2.574 kcal y 58 g de proteína, que es lo que el modelo propuso y nadie prescribió.
//
// Y era PEOR EN BORRADOR, que es cuando el profesional trabaja: `treatments.kcal_objetivo` y `proteina_g`
// se llenan AL APROBAR, así que mientras el tratamiento fuera borrador el fallback al sellado se usaba
// siempre.
//
// Un documento clínico no puede registrar una cifra que nadie prescribió, y dos documentos de la misma
// consulta no pueden contradecirse.

const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");
const HC = readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8");
const PLAN = readFileSync("src/modules/reports/data/plan-paciente-reader.ts", "utf8");
const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

describe("la historia y el plan salen de la MISMA cadena", () => {
  it("la historia clínica computa el efectivo, no lee el sellado", () => {
    expect(PAGE).toContain("const hcEfectivo = ps");
    expect(PAGE).toContain("computeProtocoloEfectivo(ps, {");
    // Los seis campos salen del efectivo. Si alguno volviera a `ps.calorico`, los documentos se separan.
    for (const campo of ["geb", "get", "kcalObj", "protG", "protGKg", "choG", "fatG"]) {
      expect(sinComentarios(PAGE), `el plan de la HC volvió a leer ${campo} del sellado`).not.toContain(
        `ps.calorico.${campo}`,
      );
    }
  });

  it("y el plan del paciente también", () => {
    expect(PLAN).toContain("computeProtocoloEfectivo(snap, {");
  });

  it("los dos pasan los MISMOS seis ajustes, incluido el déficit y el peso meta", () => {
    // Si uno pasara cinco y el otro seis, volverían a discrepar por el que falta.
    for (const src of [PAGE, PLAN]) {
      for (const a of ["adjGeb", "adjPal", "adjKcalObj", "adjProtGkg", "adjFatPct", "adjDeficit"]) {
        expect(src, `falta ${a} en una de las dos cadenas`).toContain(a);
      }
      expect(src).toContain("pesoMetaFijado");
    }
  });
});

describe("el sodio de la historia clínica ya no promete algo que ya está hecho", () => {
  it("no queda el texto que decía que el motor no se había incorporado", () => {
    // Era cierto cuando se escribió y falso desde el 2026-08-31, cuando ese motor se conectó. Nadie volvió
    // a esa línea: la misma forma que el congelamiento vencido de P-50.
    expect(sinComentarios(HC)).not.toContain("se emitirá cuando se incorpore el motor");
    expect(sinComentarios(HC)).not.toContain("todavía no se calcula");
  });

  it("y el valor viene del motor que gobierna", () => {
    expect(PAGE).toContain("sodioMax: prescripcionNutricional?.sodioMax ?? null");
    expect(HC).toContain("plan.sodioMax");
  });
});

describe("el reporte del paciente ya no se contradice consigo mismo", () => {
  it("no declara que no diagnostica, en un documento que diagnostica", () => {
    // "Patrones asociados a valorar clínicamente, no constituye diagnóstico" era NUESTRA (no aparece ni
    // una vez en su archivo) y contradecía el bloque siguiente, que le dice al paciente cómo está, y su
    // §7.1, que pone el diagnóstico como lo PRIMERO que el paciente recibe.
    // Sin comentarios: el comentario que explica por que se retiro CITA la frase retirada.
    expect(sinComentarios(DOC)).not.toContain("no constituye diagnóstico");
  });

  it("distingue la fecha de la MEDICIÓN de la de la CONSULTA", () => {
    // "Fecha" a secas era la de la medición, y el paciente no tenía cómo saberlo. Con el tamizaje en casa
    // las dos se van a separar siempre.
    expect(DOC).toContain("Fecha de la medición");
    expect(DOC).toContain("Fecha de la consulta");
  });

  it("el pie lleva el identificador y no las tres versiones del motor", () => {
    // Las versiones son la constelación de la regla dura 7 y NO se pierden: viven selladas en el snapshot
    // y en el diagnóstico. En el documento del paciente no informan a nadie.
    const pie = DOC.slice(DOC.indexOf("styles.footer"));
    expect(pie).toContain("Reporte {meta.reportId}");
    expect(pie).not.toContain("versions.engine");
    expect(pie).not.toContain("versions.model");
  });
});

describe("las dos proteínas del mismo paciente se avisan, no se esconden", () => {
  it("el panel avisa cuando el motor que gobierna y la cadena no coinciden", () => {
    // El chip dice lo que PRESCRIBE `motorTratNutri`; la cadena calcula con el `protMin` de
    // `atlas-protocolo`. Para el paciente del smoke: 1 g/kg contra 0,8, que en 80 kg son 16 gramos al día.
    // Cuál motor manda es la pregunta abierta P-32/P-35 y NO se decide aquí; lo que no puede pasar es que
    // el profesional descubra la diferencia comparando dos números a ojo.
    expect(PANEL).toContain("prescripcion != null && prescripcion.protKg !== cal.protGKg");
    expect(PANEL).toContain("El modelo de nutrición prescribe");
    expect(PANEL).toContain("Si quieres el del modelo, escríbelo en Proteína (g/kg)");
  });
});
