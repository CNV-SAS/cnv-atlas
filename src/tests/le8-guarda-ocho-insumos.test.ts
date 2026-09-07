import { describe, expect, it } from "vitest";

import { calcLE8 } from "@/clinical-engine/frozen/engine.dfi.authorized.js";

// CANDADO DE LA GUARDA DEL LE8 · OCHO INSUMOS, NO SEIS (2026-09-06).
//
// EL DEFECTO: al encender `LE8_MAPEO_CORREGIDO` (1.3.0), el motor pasó a leer `d7_agua` y la matriz de
// frecuencia `d1_1_i..d1_15_i`, y la guarda se quedó exigiendo los seis de antes. Su propia nota lo había
// avisado: *"si algún día se activa el mapeo, esta lista debe revisarse ahí"*. Se activó y no se revisó.
//
// LO QUE HACÍA CON LOS DOS QUE NO EXIGÍA, y es la razón por la que esto importa:
//   · sin `d7_agua`  →  `Number(enc.d7_agua) || 0`  puntuaba **cero**, el peor valor posible. Un paciente
//     que no contestó quedaba registrado como uno que no bebe agua.
//   · sin la matriz  →  `calcPatron` devolvía la base (10), y con la matriz a medias bajaba en silencio
//     proporcional a cuántos grupos faltaran.
//
// LO QUE ESTE CANDADO AFIRMA, y es la distinción exacta que pidió Santiago: **sin agua o sin matriz, el
// dominio NO PUNTÚA; no puntúa cero.** El LE8 entero devuelve `total: null` y `scores: []`, así que
// EB-BIS e ICEC no salen. Frenar el compuesto entero es deliberado: emitirlo con un dominio en su default
// sesgaría el ICEC y con él la edad biológica.

/** Una encuesta COMPLETA para el LE8: los seis de siempre, el agua y los quince grupos. */
function encCompleta(): Record<string, unknown> {
  const enc: Record<string, unknown> = {
    d3_23: "3",
    d3_24: "30–45 min",
    d3_30: "Nunca he fumado",
    d3_26: "7–8 horas",
    d5_39: [],
    d5_36: "No",
    d7_agua: "8",
  };
  for (let i = 1; i <= 15; i++) enc[`d1_${i}_i`] = 2;
  return enc;
}

describe("el LE8 no se calcula sobre ausencias", () => {
  it("el control: con los ocho insumos SÍ emite", () => {
    // Sin este control, todo lo de abajo pasaría igual si la guarda bloqueara siempre.
    const r = calcLE8(encCompleta()) as { scores: unknown[]; total: number | null };
    expect(r.total, "con la encuesta completa tiene que salir un total").not.toBeNull();
    expect(r.scores.length).toBeGreaterThan(0);
  });

  it("SIN AGUA: no puntúa, y no puntúa cero", () => {
    const enc = encCompleta();
    delete enc.d7_agua;
    const r = calcLE8(enc) as { scores: { dom: string; v: number }[]; total: number | null };
    expect(r.total, "sin agua el LE8 no se emite").toBeNull();
    // LA DISTINCIÓN QUE IMPORTA: no es que hidratación valga 0, es que no hay dominio ninguno.
    expect(r.scores, "no puede quedar un dominio con su default").toEqual([]);
  });

  it("y el agua VACÍA cuenta como ausente, no como cero vasos", () => {
    const enc = encCompleta();
    enc.d7_agua = "";
    expect((calcLE8(enc) as { total: number | null }).total).toBeNull();
  });

  it("SIN LA MATRIZ de frecuencia: tampoco puntúa", () => {
    const enc = encCompleta();
    for (let i = 1; i <= 15; i++) delete enc[`d1_${i}_i`];
    const r = calcLE8(enc) as { scores: unknown[]; total: number | null };
    expect(r.total).toBeNull();
    expect(r.scores).toEqual([]);
  });

  it("con la matriz A MEDIAS tampoco: se exige ENTERA", () => {
    // `calcPatron` suma y resta por grupo, así que un grupo ausente no da error: baja el score en
    // silencio, proporcional a cuántos falten. Por eso no vale exigir "alguno".
    const enc = encCompleta();
    delete enc.d1_7_i;
    expect((calcLE8(enc) as { total: number | null }).total, "falta UN grupo y ya no se emite").toBeNull();
  });

  it("y los seis de siempre siguen frenando, uno por uno", () => {
    // La ampliación no puede haber aflojado lo que ya estaba: se prueba cada uno por separado.
    for (const k of ["d3_23", "d3_24", "d3_30", "d3_26", "d5_39", "d5_36"]) {
      const enc = encCompleta();
      delete enc[k];
      expect((calcLE8(enc) as { total: number | null }).total, `${k} ausente tiene que frenar`).toBeNull();
    }
  });

  it("un CERO respondido sigue contando: la guarda distingue responder 0 de no responder", () => {
    // Es la mitad de la instrucción del 2026-08-13 que no se puede perder al endurecer la guarda:
    // "un 0 respondido (0 dias, Nunca=0) SÍ cuenta; el campo NO respondido no".
    const enc = encCompleta();
    enc.d3_23 = "0";
    enc.d7_agua = "0";
    const r = calcLE8(enc) as { total: number | null };
    expect(r.total, "responder cero no es lo mismo que no responder").not.toBeNull();
  });

  it("y d5_39 vacío es una respuesta válida (sin diagnósticos), no una ausencia", () => {
    const enc = encCompleta();
    enc.d5_39 = [];
    expect((calcLE8(enc) as { total: number | null }).total).not.toBeNull();
  });
});
