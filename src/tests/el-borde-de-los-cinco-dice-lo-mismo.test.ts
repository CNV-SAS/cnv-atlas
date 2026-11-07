import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { BANDA_IAE_ANIOS, bandaIae } from "@/clinical-engine/presentacion-eb-bis";
import * as core from "@/clinical-engine/frozen/engine.core.js";
import * as ix from "@/clinical-engine/frozen/engine.indices.js";

import { CAMBIOS_NUEVOS, htmlDeCambioNuevo } from "./fixtures/html-vigente";

vi.mock("server-only", () => ({}));

const { lecturaDeLaEbBis } = await import("@/modules/reports/data/freno-de-la-contradiccion");

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EN EL BORDE EXACTO DE ±5 TODO EL SISTEMA DICE LO MISMO  ·  2026-11-07
//
// ═══ EL CASO, Y SALIO DE LA SIMULACION DEL RECALCULO CONTRA LA NUBE ═══
//
// La simulacion dijo que, despues del recalculo, UNA consulta seguia frenada (`0eebf4dd`) y OTRA quedaba
// frenada de nuevo (`fdb7e083`). Las dos tienen el IAE en **+5,0 exacto**.
//
// No era un dato raro: era que Atlas se contradecia consigo mismo en el borde, con CUATRO lectores y DOS
// cortes distintos.
//
//   · `presentacion-eb-bis.ts` (lo que el PACIENTE lee) ..... >= 5  ->  "acelerado"
//   · `cIAE` del frozen (la CLASIFICACION del profesional) .. <= 5  ->  "Concordante"
//   · la condicion de la ruta R4 (lo que se PRESCRIBE) ...... >  5  ->  no activa
//   · la condicion de la ruta R1 ........................... >  5  ->  no activa
//
// Asi que con un IAE de +5,0 el informe decia "envejecimiento acelerado estimado" arriba, la tabla decia
// "Acorde con sus pares", y el tratamiento no traia la ruta del envejecimiento. El freno de la
// contradiccion hacia exactamente su trabajo: lo que detectaba era REAL, y lo producia Atlas.
//
// ═══ QUIEN LO DECIDE, Y POR QUE ESTO NO ES UNA ELECCION NUESTRA ═══
//
// Gildardo, en su v15 y su v16: su `cIAE` (L4568 del v16) cierra los dos bordes hacia el extremo, y las
// condiciones de R1 y R4 de su archivo dicen `>= 5`. O sea que el corte cerrado es SUYO; lo que habia en
// Atlas era un porte del v8, anterior a esa decision, conviviendo con una capa de presentacion ya migrada.
// Las tres piezas se RE-PORTARON byte a byte de su v16, y eso es lo que comprueba el ultimo bloque.
//
// ═══ LO QUE SIGUE ABIERTO, Y NO SE TOCA AQUI ═══
//
// El Δ de su linea 15628 sigue con el corte ABIERTO en su propio archivo, asi que en +5,0 su documento se
// contradice solo: la fila dice "Envejecimiento acelerado estimado" y el Δ de al lado dice "0,0". Es su
// pregunta 36 de PENDIENTES y la decide el, no nosotros. Este candado cubre la BANDA, no el Δ.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Un `d` de indices que NO activa R4 por ninguna via que no sea el IAE. */
const sinOtrasCausas = {
  sexo: "F",
  FFMI: 20, // por encima del corte de 15 en mujeres
  nivelFFMI: "normal",
  obesidadSarcopenica: false,
};

describe("el borde de +5,0 exacto", () => {
  it("la clasificacion del profesional dice Acelerado, no Concordante", () => {
    expect(core.cIAE(5).l).toBe("Acelerado");
    // Y un pelo por debajo sigue siendo la banda central, que es lo que prueba que el corte esta en 5 y
    // no se corrio a otro sitio.
    expect(core.cIAE(4.9).l).toBe("Concordante");
  });

  it("el texto que el paciente lee dice lo mismo", () => {
    expect(bandaIae(5)).toBe("envejecimiento acelerado estimado");
    expect(bandaIae(4.9)).toBe("acorde con sus pares");
  });

  it("la ruta R4 (la que TRATA el envejecimiento) se activa", () => {
    // ERA EL AGUJERO QUE MAS DAÑO HACIA: se le nombraba el problema al paciente y el documento no
    // prescribia nada para el.
    expect(ix.RUTA_COND.R4({ ...sinOtrasCausas, iae: 5 })).toBe(true);
    expect(ix.RUTA_COND.R4({ ...sinOtrasCausas, iae: 4.9 })).toBe(false);
  });

  it("y la R1 tambien, que comparte el mismo corte", () => {
    const base = { ifc: 4, irc: 4 };
    expect(ix.RUTA_COND.R1({ ...base, iae: 5 })).toBe(true);
    expect(ix.RUTA_COND.R1({ ...base, iae: 4.9 })).toBe(false);
  });

  it("el freno lee la MISMA banda, y por eso ya no puede inventar una contradiccion", () => {
    expect(lecturaDeLaEbBis(5)).toBe("acelerado");
    expect(lecturaDeLaEbBis(4.9)).toBe("acorde o desacelerado");
  });

  it("EL CONTROL, que es lo que de verdad cierra el caso: las cuatro lecturas CONCUERDAN", () => {
    // Una por una, cualquiera de las aserciones de arriba se puede cumplir con el resto roto. Esto
    // compara las cuatro entre si, que es la forma del defecto: no habia un lector mal, habia dos cortes.
    for (const iae of [-6, -5, -4.9, 0, 4.9, 5, 6]) {
      const esAcelerado = iae >= BANDA_IAE_ANIOS;
      expect(core.cIAE(iae).l === "Acelerado", `cIAE discrepa en ${iae}`).toBe(esAcelerado);
      expect(bandaIae(iae) === "envejecimiento acelerado estimado", `el texto discrepa en ${iae}`).toBe(
        esAcelerado,
      );
      expect(lecturaDeLaEbBis(iae) === "acelerado", `el freno discrepa en ${iae}`).toBe(esAcelerado);
      // La R4 tiene otras causas ademas del IAE, asi que solo se afirma la direccion del IAE.
      expect(ix.RUTA_COND.R4({ ...sinOtrasCausas, iae }), `R4 discrepa en ${iae}`).toBe(esAcelerado);
    }
  });
});

describe("el borde de -5,0 exacto, que es el otro extremo del mismo corte", () => {
  it("dice Desacelerado, no Concordante", () => {
    // En la simulacion hay DOS consultas en -5,0 exacto (`58d6ec8a` y `84253510`). Antes del re-porte su
    // tabla las llamaba "Acorde con sus pares" y el texto del paciente "desacelerado": la misma
    // contradiccion, en el extremo bueno, donde nadie la habria reportado.
    expect(core.cIAE(-5).l).toBe("Desacelerado");
    expect(core.cIAE(-4.9).l).toBe("Concordante");
    expect(bandaIae(-5)).toBe("envejecimiento desacelerado estimado");
  });
});

describe("y los tres bloques son los de su v16, byte a byte", () => {
  const ENTREGA = "4 noviembre";

  it("la entrega del 4 de noviembre existe y se deriva del directorio", () => {
    expect(CAMBIOS_NUEVOS).toContain(ENTREGA);
  });

  const suyo = readFileSync(htmlDeCambioNuevo(ENTREGA), "utf8").replace(/\r\n/g, "\n");

  it("cIAE esta byte a byte como en su v16, con sus tres textos", () => {
    const nuestro = readFileSync("src/clinical-engine/frozen/engine.core.js", "utf8").replace(/\r\n/g, "\n");
    const i = nuestro.indexOf("const cIAE = v =>");
    expect(i).toBeGreaterThan(0);
    const bloque = nuestro.slice(i, nuestro.indexOf("};", i) + 2);
    expect(suyo.includes(bloque)).toBe(true);
    // Sus tres textos de banda vienen con el bloque. No se usan todavia; viajan con el para que el dia
    // que el informe los necesite no haya que volver a su archivo.
    expect(bloque).toContain("Envejecimiento acelerado estimado");
    expect(bloque).toContain("Acorde con sus pares");
    expect(bloque).toContain("Envejecimiento desacelerado estimado");
  });

  for (const ruta of ["R1", "R4"]) {
    it(`el cuerpo de la condicion de ${ruta} esta byte a byte como en su v16`, () => {
      const nuestro = readFileSync("src/clinical-engine/frozen/engine.indices.js", "utf8").replace(
        /\r\n/g,
        "\n",
      );
      const linea = nuestro.split("\n").find((l) => l.trim().startsWith(`${ruta}: d =>`));
      expect(linea, `no aparece ${ruta} en RUTA_COND`).toBeTruthy();
      const cuerpo = (linea as string)
        .trim()
        .replace(new RegExp(`^${ruta}: d => `), "")
        .replace(/,$/, "");
      expect(suyo.includes(cuerpo)).toBe(true);
      // Y el control negativo: que no quede ningun `> 5` sobre el IAE en las condiciones de ruta.
      expect(cuerpo).not.toMatch(/\.IAE\)\s*>\s*5/);
    });
  }
});
