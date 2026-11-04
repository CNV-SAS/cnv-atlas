import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RUTAS_CONTENT } from "@/clinical-engine/rutas-content";
import { recomendacionesDe } from "@/modules/reports/data/hc-recomendaciones";
import { remisionesExigidas } from "@/modules/reports/data/hc-composicion";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: QUE LLEVA LA HISTORIA CLINICA Y QUE NO  ·  2026-11-03
//
// ═══ LA DECISION DE FONDO, Y SU MATIZ ═══
//
// La HC es el REGISTRO CLINICO del profesional, no un documento para el paciente: por eso se queda con el
// plan, las kcal, los macros y las rutas. Eso no cambió.
//
// LO QUE SE AFINA (Santiago, 2026-11-03) es otra cosa: *"¿realmente esa información es necesaria? ¿Para
// qué le sirve al profesional o al paciente que eso esté ahí?"* Y el criterio que sale de ahí no es
// "técnico sí / técnico no", es **si dice algo de ESTE paciente**:
//
//   · La tabla de dieciséis filas del ICN es la HERRAMIENTA con la que se ajusta el plan. Vive donde se
//     ajusta (Tratamiento). En el documento consta el RESULTADO.
//   · "Alimentación saludable general" es el mismo párrafo en las 569 consultas. Va en la hoja del plan,
//     que es lo que el paciente se lleva, y ahí sí sirve.
//   · "Valoración médica si IRC > 5.0" en una paciente con IRC 2,89 NO es una exigencia del modelo: es el
//     catálogo. Y el bloque se titula "LO QUE EL MODELO EXIGIÓ".
//
// Un documento clínico que repite lo mismo en todas las consultas enseña a saltárselo, incluido lo que sí
// es de esta persona.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const HC = sinComentarios(readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8"));

describe("lo que SE QUEDA en la historia clínica", () => {
  it("el plan, el objetivo y la decisión del profesional sobre cifras fuera de rango", () => {
    // Es el registro de CÓMO se prescribió, y es lo que un auditor viene a mirar.
    expect(HC).toContain("Tratamiento · plan nutricional");
    expect(HC).toContain("Decisión del profesional");
  });

  it("y el ICN, pero como CIFRA y no como tabla", () => {
    expect(HC, "el ICN desapareció de la historia clínica").toContain("Nutrientes con ICN");
    expect(HC, "volvió la tabla de dieciséis filas").not.toContain("% Cubrim.");
    expect(HC, "y con ella sus colores").not.toContain("CLASE_DEL_NIVEL");
    // Y SE DICE DÓNDE ESTÁ EL DETALLE: retirarlo sin decir dónde fue deja al profesional buscándolo.
    expect(HC).toContain("El detalle nutriente por nutriente está en Tratamiento");
  });
});

describe("lo que SALE de la historia clínica", () => {
  it("las recomendaciones genéricas van al plan del paciente, no al documento clínico", () => {
    const clinica = recomendacionesDe({
      diagnosticos: [],
      tieneHTA: false,
      tieneIRC: false,
      sarcopenia: false,
      exceso: false,
      pesoKg: 74,
      voz: "clinica",
    });
    const paciente = recomendacionesDe({
      diagnosticos: [],
      tieneHTA: false,
      tieneIRC: false,
      sarcopenia: false,
      exceso: false,
      pesoKg: 74,
      voz: "paciente",
    });
    expect(
      clinica.map((b) => b.titulo),
      "el bloque genérico volvió a la historia clínica",
    ).not.toContain("Alimentación saludable general");
    expect(
      paciente.map((b) => b.titulo),
      "y se perdió del plan, que es donde SÍ sirve",
    ).toContain("Alimentación saludable general");
  });

  it("pero los CONDICIONALES se quedan en las dos: esos sí son de este paciente", () => {
    // "Dieta DASH y control de sodio" sale porque este paciente tiene hipertensión. Eso es un hecho de la
    // consulta y consta. La diferencia no es de longitud, es de a quién describe.
    const conHta = recomendacionesDe({
      diagnosticos: [],
      tieneHTA: true,
      tieneIRC: false,
      sarcopenia: false,
      exceso: false,
      pesoKg: 74,
      voz: "clinica",
    });
    expect(conHta.map((b) => b.titulo)).toContain("Dieta DASH y control de sodio");
  });

  it("y las líneas condicionales de las remisiones no se afirman como exigidas", () => {
    const rutas = Object.values(RUTAS_CONTENT);
    const exigidas = remisionesExigidas(rutas, []);
    const condicionales = exigidas.flatMap((r) => r.indicaciones).filter((i) => /\bsi\s/i.test(i));
    expect(
      condicionales,
      'el bloque se titula "lo que el modelo EXIGIÓ": una línea condicional afirma una exigencia que para este paciente no existe',
    ).toEqual([]);
    // Y LA REMISIÓN EN SÍ NO SE TOCA: a quién acudir es lo que no puede faltar.
    expect(exigidas.length, "se fueron también las remisiones").toBeGreaterThan(0);
    expect(exigidas.every((r) => r.destino.length > 0)).toBe(true);
  });

  it("y el bloque del resumen no sale cuando no hay resumen", () => {
    // Salía un apartado entero con un texto que le habla a QUIEN MIRA LA PANTALLA ("tu rol no tiene
    // uno"). Impreso, le explica al lector de dentro de un año por qué el que lo descargó no veía una
    // sección, que no es un hecho de la consulta.
    expect(HC).toContain("if (!texto) return null;");
  });
});
