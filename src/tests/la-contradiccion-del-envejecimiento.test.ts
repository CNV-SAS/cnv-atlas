import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

vi.mock("server-only", () => ({}));

const { seContradicen } = await import("@/modules/reports/data/freno-de-la-contradiccion");

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: UN DOCUMENTO QUE SE CONTRADICE SOBRE EL ENVEJECIMIENTO NO SALE  ·  2026-11-03
//
// ═══ EL CASO, EN UN INFORME REAL (Santiago) ═══
//
// Arriba: "Edad biológica estimada: 24,7 años · −1,3 años: acorde con sus pares". Tres líneas más abajo:
// "Envejecimiento · A trabajar. Envejecimiento acelerado: intervenir". Y la HC de la misma consulta:
// "su envejecimiento biológico está acelerado", con la ruta R4 activada.
//
// ═══ LA CAUSA, Y ES UN PORTE A MEDIAS NUESTRO ═══
//
// Su §2 del 26-oct retira la EB-BIS v5 del motor. `analizarDesdeBiody` se migró a la v7;
// `analizarDFI` NO: sigue llamando a `computeEBBIS`/`computeIAE` (la v5), y ESE IAE alimenta el dominio
// 3, el riesgo integrado y las rutas. Dos edades biológicas en la misma consulta: la que se le dice al
// paciente y la que decide lo que se le prescribe.
//
// MEDIDO EN PRODUCCIÓN (2026-11-03, sobre 389 informes vigentes con sello 2.x): 17 dicen "acorde" y
// activan R4; 43 dicen ACELERADO y no activan nada; 326 coinciden. NINGUNO de los 60 se había enviado.
//
// ═══ LO QUE ESTE CANDADO PROTEGE, Y LO QUE NO ═══
//
// NO fija el criterio clínico: cuál de las dos lecturas debe regir es de Gildardo, y está en el documento
// de dudas. Lo que fija es que, mientras tanto, un documento que afirma dos cosas opuestas sobre el
// mismo cuerpo NO le llegue al paciente, y que el profesional se entere ANTES de pulsar enviar.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("las dos lecturas del envejecimiento", () => {
  const acorde = { iae: -1.3, segunLaEbBis: "acorde o desacelerado", segunElDfi: "acelerado" } as const;
  const acelerado = { iae: 7.2, segunLaEbBis: "acelerado", segunElDfi: "no acelerado" } as const;

  it("se contradicen en LAS DOS direcciones, y la segunda es la peor", () => {
    // El caso de Santiago: la EB-BIS dice que está bien y el documento prescribe la ruta del
    // envejecimiento.
    expect(seContradicen(acorde)).toBe(true);
    // Y el contrario, que es el que de verdad deja al paciente sin atención: se le nombra el problema
    // arriba y el documento no prescribe nada para él. Son 43 de los 60 medidos.
    expect(seContradicen(acelerado)).toBe(true);
  });

  it("y no frenan cuando coinciden, en cualquiera de los dos valores", () => {
    expect(seContradicen({ iae: 7.2, segunLaEbBis: "acelerado", segunElDfi: "acelerado" })).toBe(false);
    expect(
      seContradicen({ iae: -1.3, segunLaEbBis: "acorde o desacelerado", segunElDfi: "no acelerado" }),
    ).toBe(false);
  });

  it("sin dos lecturas que comparar no se frena nada", () => {
    // Un documento sellado con un motor anterior a la v7 no puede tener esta contradicción: las dos
    // lecturas salían del MISMO cálculo. Frenarlo sería frenar por un defecto que no tiene.
    expect(seContradicen(null)).toBe(false);
  });
});

describe("el freno vive donde no se puede saltar, y la pantalla lo dice antes", () => {
  const FRENO = sinComentarios(
    readFileSync("src/modules/reports/data/freno-de-la-contradiccion.ts", "utf8"),
  );
  const ENVIAR = sinComentarios(readFileSync("src/modules/reports/services/send-report.ts", "utf8"));
  const HC = sinComentarios(readFileSync("src/modules/reports/services/entregar-hc.ts", "utf8"));
  const PAGINA = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"));

  it("los DOS servicios de entrega lo consultan", () => {
    // Una pantalla se puede saltar (imprimir, volver atrás); un servicio no. Es el mismo sitio donde vive
    // el freno del cambio desfavorable, y por la misma razón.
    expect(ENVIAR).toContain('frenoDeLaContradiccion(dispatch.evaluationId, "reporte")');
    expect(HC).toContain('frenoDeLaContradiccion(input.evaluationId, "hc")');
  });

  it("frena las dos hojas que le cuentan al paciente cómo va, y solo esas", () => {
    // El plan y las rutas dicen QUÉ HACER, no qué le pasa a su cuerpo: bloquearlos dejaría al profesional
    // sin nada que entregarle al paciente que tiene delante.
    expect(FRENO).toContain('new Set(["reporte", "hc"])');
  });

  it("la banda sale del motor, no está escrita en el freno", () => {
    // Es la MISMA banda que decide el texto que el informe pinta arriba. Escrita aquí a mano, las dos
    // podrían divergir y el freno compararía contra un corte que la pantalla ya no usa.
    expect(FRENO).toContain("BANDA_IAE_ANIOS");
    expect(FRENO, "el corte se escribió a mano").not.toMatch(/>=\s*5\b/);
  });

  it("solo mira los documentos sellados con la v7", () => {
    expect(FRENO).toContain("'2.%'");
  });

  it("y la pantalla avisa ANTES, con la MISMA función que decide el freno", () => {
    // Un freno que solo habla cuando ya se pulsó el botón deja al profesional recibiendo un error que no
    // esperaba, con el paciente delante. Y si la pantalla usara su propio criterio, las dos acabarían
    // diciendo cosas distintas sobre la misma consulta.
    expect(PAGINA).toContain("seContradicen(lecturasCrudas)");
    expect(PAGINA).toContain("<AvisoDeContradiccion lecturas={dosLecturas} />");
  });
});

describe("la narrativa del DFI concuerda en singular", () => {
  it("un año no son 'años'", () => {
    // Salía "acelerado (1 años por encima de lo esperado)" en un documento clínico que lee otro
    // profesional. Es la regla de ortografía por superficie: media corrección deja el sistema leyéndose
    // como mal hecho.
    const SRC = sinComentarios(readFileSync("src/clinical-engine/dfi-narrative.ts", "utf8"));
    expect(SRC).toContain('=== 1 ? " año" : " años"');
  });
});
