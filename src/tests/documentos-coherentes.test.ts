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
const COMP = readFileSync("src/modules/reports/data/hc-composicion.ts", "utf8");
const HC = readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8");
const PLAN = readFileSync("src/modules/reports/data/plan-paciente-reader.ts", "utf8");
const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

describe("la historia y el plan salen de la MISMA cadena", () => {
  it("la historia clínica computa el efectivo, no lee el sellado", () => {
    // LA ASERCIÓN SE MOVIÓ DE SITIO, no de contenido (2026-09-02). El cómputo salió de `page.tsx` a
    // `componerHistoriaClinica`, que es la condición para portar la HC a PDF: los seis bloques que se
    // armaban sueltos en la página no tenían nombre en ninguna parte, así que un segundo documento los
    // habría armado a su manera. La garantía es la misma y por eso la fila se queda: la historia computa
    // el efectivo, nunca lee el sellado.
    expect(COMP).toContain("computeProtocoloEfectivo(e.suggested, e.ajustes, {");
    expect(PAGE).toContain("componerHistoriaClinica({");
    // Los seis campos salen del efectivo. Si alguno volviera al SELLADO, los documentos se separan.
    //
    // SE NOMBRA LA VARIABLE DEL SELLADO, no `.calorico.` a secas: al generalizar la aserción la escribí
    // así y cazó `cadenaEfectiva.calorico.kcalObj`, que es JUSTO lo correcto (la cadena efectiva del
    // panel). Un candado que prohíbe la forma buena junto con la mala se relaja al primer rojo legítimo.
    for (const campo of ["geb", "get", "kcalObj", "protG", "protGKg", "choG", "fatG"]) {
      for (const [nombre, src, sellado] of [
        ["la página", PAGE, "ps.calorico"],
        ["la composición", COMP, "suggested.calorico"],
      ] as const) {
        expect(sinComentarios(src), `el plan de la HC volvió a leer ${campo} del sellado en ${nombre}`)
          .not.toContain(`${sellado}.${campo}`);
      }
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

describe("ya no hay dos proteínas del mismo paciente: la prescribe el motor", () => {
  // ESTE BLOQUE CAMBIÓ DE SIGNO EL 2026-09-03, y el cambio es el hallazgo. Antes afirmaba que el panel
  // AVISABA de la diferencia (el chip decía 1 g/kg y la cadena calculaba con 0,8), porque cuál motor
  // manda era la pregunta abierta P-32/P-35. Gildardo la respondió en su §9.6 punto 4: "la proteína la
  // prescribe el motor -1 g/kg, no el mínimo poblacional de 0,8- sobre el peso meta que fije el
  // nutricionista". Con la cadena leyendo esa misma cifra, las dos coinciden por construcción y el aviso
  // dejó de tener objeto: seguir avisando sería advertir sobre la cifra que el profesional acaba de
  // escribir, que es justo lo que su §5 del 27-ago prohíbe.

  it("el aviso de las dos proteínas se retiró, y no quedó su texto suelto", () => {
    // Se barren las TRES cadenas, no solo la condición: un texto que describe un mecanismo retirado
    // miente igual que uno que describe uno que nunca existió.
    expect(PANEL).not.toContain("prescripcion.protKg !== cal.protGKg");
    expect(PANEL).not.toContain("El modelo de nutrición prescribe");
    expect(PANEL).not.toContain("Si quieres el del modelo, escríbelo en Proteína (g/kg)");
  });

  it("y en su lugar el panel declara de dónde salió la proteína", () => {
    // La cascada resuelve entre cuatro fuentes; la única que no debería alcanzarse por un camino vivo
    // es el mínimo poblacional, y por eso es la que se dice en pantalla.
    expect(PANEL).toContain('efectivo.protFuente === "protMin"');
    expect(PANEL).toContain("sale del mínimo poblacional");
  });

  it("y la cadena efectiva del panel recibe la proteína del motor", () => {
    // CONTROL del cableado: sin esto, los snapshots anteriores al sellado caerían al mínimo poblacional
    // y el defecto seguiría vivo justo en los pacientes que ya existen.
    expect(PANEL).toContain("protKgVigente: prescripcion?.protKg ?? null");
  });
});
