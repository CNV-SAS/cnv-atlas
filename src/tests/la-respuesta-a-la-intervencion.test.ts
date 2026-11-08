import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PHI,
  respuestaALaIntervencion,
} from "@/modules/followups/respuesta-a-la-intervencion";
import type { PuntoSerie, RefCapacitancia } from "@/modules/followups/data/serie-types";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA RESPUESTA A LA INTERVENCION  ·  v15 §3, 2026-11-07
//
// ═══ LO QUE ESTE CANDADO VIGILA, Y POR QUE ES LO DELICADO DE LA TARJETA ═══
//
// Las tres cifras de su tarjeta NO MEJORAN EN LA MISMA DIRECCION:
//
//   · el riesgo integrado del DFI: menor es mejor;
//   · la capacitancia: mejorar es ACERCARSE A LA MEDIANA de su grupo, no subir (su regla del 2026-08-27
//     §9, con su razon medida: discrimina masa muscular baja por abajo y adiposidad por arriba);
//   · la PABU: mejorar es acercarse a φ, y tambien es bidireccional.
//
// Una tarjeta que pintara las tres con "subio = verde" diria lo contrario de su archivo en DOS de las
// tres, y lo diria en verde, que es la forma mas cara de equivocarse en una pantalla clinica.
//
// Y LO SEGUNDO: no se resta entre dos escalas del motor. Es la misma puerta que la banda de trayectoria
// (`sonComparables`), y sin ella el delta mediria el cambio de ESCALA y se lo ensenaria al profesional
// como el cambio del paciente.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const punto = (p: Partial<PuntoSerie> & { fecha: string }): PuntoSerie => ({
  evaluationId: `ev-${p.fecha}`,
  c: null,
  pabu: null,
  icaBis: null,
  dominios: null,
  riesgoScore: null,
  eb: null,
  engineVersion: "3.2.0",
  ...p,
});

const REF: RefCapacitancia = {
  mediana: 2.4,
  p25: 2.06,
  p75: 2.82,
  n: 503,
  valor: 2.4,
  etiqueta: "Normal",
  banda: "P25-P75",
  grupo: "Mujeres 30-39",
};

describe("el riesgo integrado: menor es mejor", () => {
  it("bajar es mejorar y subir es empeorar", () => {
    const baja = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", riesgoScore: 60 }), punto({ fecha: "2026-04-01", riesgoScore: 42 })],
      REF,
    );
    expect(baja?.riesgo).toMatchObject({ antes: 60, ahora: 42, delta: -18, direccion: "mejora" });
    const sube = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", riesgoScore: 40 }), punto({ fecha: "2026-04-01", riesgoScore: 55 })],
      REF,
    );
    expect(sube?.riesgo?.direccion).toBe("empeora");
  });

  it("y la misma cifra es 'sin cambio', no una mejora de cero", () => {
    const igual = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", riesgoScore: 40 }), punto({ fecha: "2026-04-01", riesgoScore: 40 })],
      REF,
    );
    expect(igual?.riesgo?.direccion).toBe("sin-cambio");
  });
});

describe("la capacitancia: mejorar es ACERCARSE a la mediana de su grupo, no subir", () => {
  it("subir hacia la mediana es mejorar", () => {
    const r = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", c: 1.8 }), punto({ fecha: "2026-04-01", c: 2.3 })],
      REF,
    );
    expect(r?.capacitancia).toMatchObject({ direccion: "mejora" });
  });

  it("Y SUBIR PASANDOSE DE LA MEDIANA ES EMPEORAR, que es el caso que una lectura ingenua pinta verde", () => {
    // Su §9 del 2026-08-27, con su razon medida: la capacitancia sube con el IMC, asi que un paciente que
    // pasa de 2,40 a 4,00 nF puede estar ganando adiposidad, no integridad de membrana. Con "subio =
    // mejoro" esta fila saldria en verde sobre un paciente que se alejo de su grupo.
    const r = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", c: 2.4 }), punto({ fecha: "2026-04-01", c: 4.0 })],
      REF,
    );
    expect(r?.capacitancia?.delta).toBeCloseTo(1.6, 5);
    expect(r?.capacitancia?.direccion, "subir alejandose de la mediana se leyo como mejoria").toBe(
      "empeora",
    );
  });

  it("y bajar hacia la mediana TAMBIEN es mejorar", () => {
    const r = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", c: 3.4 }), punto({ fecha: "2026-04-01", c: 2.6 })],
      REF,
    );
    expect(r?.capacitancia?.direccion).toBe("mejora");
  });

  it("SIN REFERENCIA no se afirma ninguna direccion: se dice cuanto se movio", () => {
    // Sin sexo o sin fecha de nacimiento no hay mediana de grupo, y entonces "subio" no significa nada:
    // puede ser mejoria o lo contrario segun de que lado estaba. La tarjeta lo dice.
    const r = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", c: 1.8 }), punto({ fecha: "2026-04-01", c: 2.3 })],
      null,
    );
    expect(r?.capacitancia?.delta).toBeCloseTo(0.5, 5);
    expect(r?.capacitancia?.direccion).toBeNull();
  });
});

describe("la PABU: mejorar es acercarse a φ", () => {
  it("φ es 1,618, de su archivo", () => {
    expect(PHI).toBe(1.618);
  });

  it("acercarse a φ desde arriba es mejorar, y alejarse por debajo es empeorar", () => {
    const sube = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", pabu: 2.45 }), punto({ fecha: "2026-04-01", pabu: 1.8 })],
      REF,
    );
    expect(sube?.pabu?.direccion).toBe("mejora");
    const baja = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", pabu: 1.6 }), punto({ fecha: "2026-04-01", pabu: 1.39 })],
      REF,
    );
    expect(baja?.pabu?.direccion, "alejarse de φ por debajo se leyo como mejoria").toBe("empeora");
  });
});

describe("y no se resta entre dos escalas del motor", () => {
  it("con la anterior de otra version MAYOR, no hay comparacion", () => {
    const r = respuestaALaIntervencion(
      [
        punto({ fecha: "2026-01-01", riesgoScore: 60, engineVersion: "2.0.0" }),
        punto({ fecha: "2026-04-01", riesgoScore: 42, engineVersion: "3.2.0" }),
      ],
      REF,
    );
    expect(r, "resto entre la v5 y la v7: el delta mediria el cambio de escala").toBeNull();
  });

  it("y la ULTIMA COMPARABLE se busca hacia atras, no es siempre la penultima", () => {
    // Es lo que dice su texto ("la última consulta comparable") y no "la anterior": si la penultima es de
    // otra era del motor pero la de antes es de la misma, esa SI se puede comparar.
    const r = respuestaALaIntervencion(
      [
        punto({ fecha: "2026-01-01", riesgoScore: 70, engineVersion: "3.0.0" }),
        punto({ fecha: "2026-02-01", riesgoScore: 65, engineVersion: "anibise-1.4.0" }),
        punto({ fecha: "2026-04-01", riesgoScore: 50, engineVersion: "3.2.0" }),
      ],
      REF,
    );
    expect(r?.anterior.fecha).toBe("2026-01-01");
    expect(r?.riesgo?.antes).toBe(70);
  });

  it("pero `anibise-1.4.0` y `1.0.0` SI se comparan: es el mismo MAYOR con dos grafias", () => {
    // ═══ LA DUDA DE SANTIAGO DEL 2026-11-07, Y POR QUE LA RESPUESTA ES AL REVES ═══
    //
    // Vio la tarjeta comparar contra la consulta del 13 de julio y escribio: *"si el 13 de julio esta en
    // 1.0.0 (los de prueba no se reemitieron), no deberia ser comparable"*. Medido en la nube ese mismo
    // dia, el paciente es f21235ca (DE PRUEBA) y sus dos extremos son `anibise-1.4.0` (13 jul) y `1.0.0`
    // (14 sep): los dos son MAYOR 1, asi que son comparables, y estar en 1.x es justo lo que los hace
    // comparables, no lo que deberia impedirlo. El criterio es `docs/VERSIONES.md`: *"Mayor = la ciencia
    // cambia y lo emitido antes no es comparable"*.
    //
    // ESTE CASO EXISTE PARA QUE LA RESPUESTA NO HAYA QUE VOLVER A MEDIRLA: en produccion conviven las dos
    // grafias del mismo mayor, y una lectura que comparase la cadena entera las separaria en silencio, lo
    // que apagaria la tarjeta en los pacientes mas antiguos sin que nada fallara.
    const r = respuestaALaIntervencion(
      [
        punto({ fecha: "2026-07-13", riesgoScore: 15, engineVersion: "anibise-1.4.0" }),
        punto({ fecha: "2026-09-14", riesgoScore: 95, engineVersion: "1.0.0" }),
      ],
      REF,
    );
    expect(r?.anterior.fecha, "las dos grafias del mayor 1 dejaron de compararse").toBe("2026-07-13");
    expect(r?.riesgo).toMatchObject({ antes: 15, ahora: 95, direccion: "empeora" });
  });

  it("con una sola consulta no hay respuesta a nada", () => {
    expect(respuestaALaIntervencion([punto({ fecha: "2026-04-01", riesgoScore: 42 })], REF)).toBeNull();
    expect(respuestaALaIntervencion([], REF)).toBeNull();
  });

  it("y una cifra que falta en CUALQUIERA de los dos extremos no se compara", () => {
    // Un campo ausente leido como cero daria un delta enorme sobre algo que nadie midio.
    const r = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", riesgoScore: 60 }), punto({ fecha: "2026-04-01" })],
      REF,
    );
    expect(r?.riesgo).toBeNull();
    expect(r?.capacitancia).toBeNull();
    expect(r?.pabu).toBeNull();
    // Y la tarjeta igual sale, porque sabe CONTRA QUE compara: solo queda sin filas.
    expect(r?.anterior.fecha).toBe("2026-01-01");
  });
});

describe("y la pantalla dice lo que falta de su tarjeta, en vez de inventarlo", () => {
  const PANTALLA = readFileSync("src/modules/followups/components/seguimiento-visual.tsx", "utf8");

  it("la tarjeta se pinta y va PRIMERA, antes del detalle por indicador", () => {
    expect(PANTALLA).toContain("{respuesta ? <RespuestaCard r={respuesta} /> : null}");
    expect(PANTALLA.indexOf("<RespuestaCard")).toBeLessThan(
      PANTALLA.indexOf("<CapacitanciaCard refC={serie.refC}"),
    );
  });

  it("y DICE que la adherencia y el escenario de la tabla 6 llegan con la CNV-S", () => {
    // Su tarjeta lleva tres cosas y hoy entra una. Media tabla de decision, con el eje de la adherencia
    // inventado, diria "respuesta compatible con la ruta" sobre un paciente del que no se sabe si siguio
    // la ruta. Se dice que falta, que es la regla de la casa con las piezas a medias.
    expect(PANTALLA).toContain("La adherencia y el escenario de respuesta de la tabla 6 llegan con la");
    expect(PANTALLA).toContain("Módulo S");
  });

  it("y NO decide por su cuenta si una cifra mejoro: la direccion llega resuelta", () => {
    // Si la pantalla comparara, seria la segunda definicion de "mejoro" y las dos podrian divergir. Es el
    // mismo criterio que la banda de trayectoria y las observaciones vigentes.
    const limpia = sinComentarios(PANTALLA);
    expect(limpia).toContain("lecturaDeDireccion(dato.direccion)");
    expect(limpia, "la pantalla volvio a comparar por su cuenta").not.toMatch(
      /dato\.(ahora|antes)\s*[<>]/,
    );
  });
});
