import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { bandaIae, cifraEbBis, textoIae } from "@/clinical-engine/presentacion-eb-bis";

import { sinComentarios } from "./helpers/sin-comentarios";

vi.mock("server-only", () => ({}));

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO DE LOS TRES AJUSTES DEL DIAGNOSTICO REEMITIDO (Santiago, 2026-10-29)
//
//   (a) el rotulo del IAE son SUS textos de la tabla 3, no "Concordante" de su display viejo
//   (b) coma decimal en toda la fila, no "23,5" junto a "20.0" y "+3.5"
//   (c) el diagnostico dice que se reemitio, y deja ver lo que decia antes
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("(a) el rotulo del IAE son sus textos de la tabla 3", () => {
  it("las tres frases, con sus cortes CERRADOS en los dos extremos", () => {
    // Su tabla 3, literal: *"'+12,4 años: envejecimiento acelerado estimado' si IAE >= +5,0; 'acorde con
    // sus pares' entre -5,0 y +5,0; 'desacelerado estimado' si IAE <= -5,0"*.
    expect(bandaIae(12.4)).toBe("envejecimiento acelerado estimado");
    expect(bandaIae(5)).toBe("envejecimiento acelerado estimado");
    expect(bandaIae(4.9)).toBe("acorde con sus pares");
    expect(bandaIae(0)).toBe("acorde con sus pares");
    expect(bandaIae(-4.9)).toBe("acorde con sus pares");
    expect(bandaIae(-5)).toBe("envejecimiento desacelerado estimado");
  });

  it('la palabra "estimado" no se puede perder: su pie de tabla la exige', () => {
    // *"Toda salida se presenta como estimacion, nunca como diagnostico."* Quitarla convertiria una
    // estimacion poblacional en una afirmacion sobre la persona.
    expect(bandaIae(9)).toContain("estimado");
    expect(bandaIae(-9)).toContain("estimado");
  });

  it("y la tabla de indicadores ya no pinta el rotulo de su display viejo", () => {
    // `dIAE` (ATLAS_v8 L14444) decia "Concordante", y es anterior a la tabla 3. El candado mira el CODIGO
    // sin comentarios: la explicacion de por que se retiro tiene que poder nombrarlo.
    const rangos = sinComentarios(
      readFileSync("src/modules/diagnoses/data/indicator-ranges.ts", "utf8"),
    );
    expect(rangos, 'la tabla volvio a rotular el IAE como "Concordante"').not.toContain("Concordante");
    // Y lo hace DELEGANDO, no copiando las frases: cuatro copias de la misma frase divergen.
    expect(rangos).toContain("bandaIae(v)");
  });

  it("CONTROL: el clasificador CONGELADO sigue diciendo Concordante, que es lo correcto", () => {
    // La frase de pantalla cambia; la del motor NO se toca. Si alguien "barriera" tambien el frozen, se
    // romperian las ramas del DFI que comparan contra esa cadena (`idx.iaeCl.l === "Concordante"`).
    const motor = readFileSync("src/clinical-engine/frozen/engine.core.js", "utf8");
    expect(motor, "alguien cambio el rotulo del clasificador congelado").toContain('l: "Concordante"');
  });

  it("y el texto con cifra se compone de la misma banda, sin repetir los cortes", () => {
    expect(textoIae(12.4)).toBe("+12,4 años: envejecimiento acelerado estimado");
    expect(textoIae(-1.4)).toBe("-1,4 años: acorde con sus pares");
  });
});

describe("(b) coma decimal en toda la fila de la edad biologica", () => {
  it("las cifras llevan coma y conservan el cero final", () => {
    // El cero final importa: su tabla 3 escribe "76,4" y "40,0". Una celda que dijera "40" al lado de
    // otra que dice "23,5" vuelve a mezclar formatos, ahora por otra via.
    expect(cifraEbBis(23.5)).toBe("23,5");
    expect(cifraEbBis(20)).toBe("20,0");
    expect(cifraEbBis(3.5)).toBe("3,5");
  });

  it("y la fila del EB no formatea a mano con toFixed", () => {
    // LA FORMA PROHIBIDA, que es la que produjo "20.0" y "+3.5": `toFixed` es el default de JavaScript y
    // usa punto. La celda de Valor de la MISMA fila ya pasaba por el formateador en español.
    const comp = sinComentarios(
      readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8"),
    );
    expect(comp, "volvio un toFixed a la fila de la edad cronologica").not.toContain(
      "edadCronologica.toFixed",
    );
    expect(comp, "volvio un toFixed al delta del IAE").not.toContain("indicators.iae.toFixed");
  });
});

describe("(c) el diagnostico dice que se reemitio", () => {
  const MARCA = readFileSync("src/modules/diagnoses/components/marca-de-reemision.tsx", "utf8");

  it("con la frase que pidio Santiago y las DOS versiones del motor", () => {
    expect(MARCA).toContain("Reemitido el ");
    expect(MARCA).toContain("por recalibración científica");
    expect(MARCA).toContain("reemision.versionAnterior");
    expect(MARCA).toContain("reemision.versionNueva");
  });

  it("y dice que el tratamiento y el informe enviado NO se tocaron", () => {
    // Es la pregunta que el profesional se hace al ver que su documento cambio, y la respuesta tiene que
    // estar donde esta la noticia, no solo en el rastro de auditoria.
    expect(MARCA).toContain("La prescripción que indicaste no se modificó");
    expect(MARCA).toContain("el informe que el paciente ya recibió tampoco");
  });

  it("no usa la capa clinica de color: es procedencia, no riesgo del paciente", () => {
    // Mismo criterio que `AvisoCienciaAnterior`: el rojo y el ambar significan riesgo del PACIENTE. Un
    // color que afirma de mas es un defecto, no una decoracion.
    expect(MARCA, "la marca de reemision uso un color clinico").not.toMatch(/clinical-(critical|warning)/);
  });

  it("deja ver la version anterior con los MISMOS textos que la vigente", () => {
    // Comparar dos cifras es el punto; comparar dos vocabularios no.
    expect(MARCA).toContain("bandaIae(reemision.anterior.iae)");
    expect(MARCA).toContain("cifraEbBis(reemision.anterior.eb)");
  });

  it("y la marca se DERIVA, sin columna que acordarse de poner", () => {
    const lector = sinComentarios(
      readFileSync("src/modules/diagnoses/data/reemision-reader.ts", "utf8"),
    );
    expect(lector).toContain("dxs.length < 2");
    for (const prohibido of ["reemitido_at", "es_reemision", "update(", "insert("]) {
      expect(lector, `el lector de la reemision escribe o sella (${prohibido})`).not.toContain(prohibido);
    }
  });
});

describe("las cifras viejas se leen de las DOS formas de snapshot", () => {
  it("de la v7, que las lleva en ebBis", async () => {
    const { cifrasDelSnapshot } = await import("@/modules/diagnoses/data/reemision-reader");
    expect(cifrasDelSnapshot({ ebBis: { eb: 54.2, iae: 7.1 } })).toEqual({ eb: 54.2, iae: 7.1 });
  });

  it("y de la v5, que solo las tiene en indicators (el caso para el que existe)", async () => {
    // ES EL CASO QUE IMPORTA: cualquier documento reemitido HOY venia de la v5. Un lector que solo mirara
    // `ebBis` dejaria la comparacion vacia justo donde tiene que llenarse, y la pantalla diria "no hay
    // version anterior" sobre un documento que si la tiene.
    const { cifrasDelSnapshot } = await import("@/modules/diagnoses/data/reemision-reader");
    expect(cifrasDelSnapshot({ indicators: { eb: 24.6, iae: -29.9 } })).toEqual({
      eb: 24.6,
      iae: -29.9,
    });
  });

  it("y devuelve null, no cero, cuando no estan", async () => {
    // Un cero aqui se CLASIFICARIA: `bandaIae(0)` da "acorde con sus pares", o sea una lectura favorable
    // afirmada sobre lo que no se midio. Es el defecto del dominio sin dato, en otra superficie.
    const { cifrasDelSnapshot } = await import("@/modules/diagnoses/data/reemision-reader");
    for (const vacio of [null, undefined, {}, { ebBis: null }, { indicators: { eb: 30 } }]) {
      expect(cifrasDelSnapshot(vacio)).toBeNull();
    }
    expect(cifrasDelSnapshot({ ebBis: { eb: Number.NaN, iae: 1 } })).toBeNull();
  });
});
