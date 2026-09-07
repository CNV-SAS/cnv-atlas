import { describe, expect, it } from "vitest";

import { analizarDFI, calcLE8 } from "@/clinical-engine/analysis";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import encJson from "./fixtures/clinical-engine/encuesta-sintetica.json";

// Guarda de calcLE8 (CA-3, Gildardo 2026-08-13 §1): el LE8 NO se calcula sobre AUSENCIAS. Un dato en CERO
// respondido cuenta; el campo NO respondido no. Corre por el `.authorized` (import reapuntado en
// analysis.ts).
//
// SON OCHO INSUMOS, NO SEIS (motor 1.4.0, 2026-09-06). Este encabezado describia el estado con
// `LE8_MAPEO_CORREGIDO=false` y decia que alimentacion e hidratacion corrian en default "por hueco de
// datos". Eso dejo de ser cierto al encenderse el mapeo (1.3.0): el motor pasa a leer `d7_agua` y los
// quince grupos de frecuencia, y la guarda los exige desde 1.4.0.
//   los seis de siempre  d3_23/d3_24 (actividad), d3_30 (tabaco), d3_26 (sueno),
//                        d5_39 (glucosa/colesterol/presion), d5_36 (presion)
//   mas                  d7_agua (hidratacion) y la matriz d1_1_i..d1_15_i COMPLETA (alimentacion)
//
// ESTE ARCHIVO CUBRE LOS SEIS ORIGINALES y su distincion cero-contra-ausencia; los dos nuevos y la
// exigencia de matriz entera van en `le8-guarda-ocho-insumos.test.ts`. Se dejan separados a proposito:
// este prueba la instruccion del 13 de agosto, aquel la ampliacion del 6 de septiembre.

const biody = biodyJson as Record<string, unknown>;
const enc = encJson as Record<string, unknown>; // encuesta COMPLETA: trae los OCHO insumos del LE8 (verificado: seis + d7_agua + los quince grupos)

describe("calcLE8: guarda de ausencia (Gildardo 2026-08-13 §1)", () => {
  it("encuesta completa: emite total (los 6 insumos presentes)", () => {
    expect(calcLE8(enc).total).not.toBeNull();
  });

  it("un CERO respondido SI cuenta: 0 dias de actividad no es ausencia", () => {
    expect(calcLE8({ ...enc, d3_23: "0" }).total).not.toBeNull();
  });

  it("la AUSENCIA de un insumo NUMERICO (d3_23) frena: total null", () => {
    const sin = { ...enc };
    delete sin.d3_23;
    expect(calcLE8(sin).total).toBeNull();
  });

  it("la AUSENCIA de un insumo CATEGORICO (d3_30 tabaco) frena: total null", () => {
    const sin = { ...enc };
    delete sin.d3_30;
    expect(calcLE8(sin).total).toBeNull();
  });

  it("d5_39 = [] ('sin diagnosticos') es respuesta y PUNTUA, no es ausencia", () => {
    // el golden usa [] y produce total; el arreglo vacio es "respondio, sin diagnosticos".
    expect(Array.isArray(enc.d5_39) && (enc.d5_39 as unknown[]).length === 0).toBe(true);
    expect(calcLE8(enc).total).not.toBeNull();
  });

  it("d5_39 AUSENTE (no respondido, sin la clave) frena: total null", () => {
    const sin = { ...enc };
    delete sin.d5_39;
    expect(calcLE8(sin).total).toBeNull();
  });

  // care (a): la guarda corre por el PIPELINE, no solo unitaria. analizarDFI usa el calcLE8 reapuntado
  // al .authorized; un caso con ausencia devuelve le8 null de verdad al pasar por la cadena.
  it("end-to-end (analizarDFI, camino reapuntado): completa emite le8; ausencia lo anula", () => {
    expect(analizarDFI(biody, enc).le8.total).not.toBeNull();
    const sin = { ...enc };
    delete sin.d3_23;
    expect(analizarDFI(biody, sin).le8.total).toBeNull();
  });
});
