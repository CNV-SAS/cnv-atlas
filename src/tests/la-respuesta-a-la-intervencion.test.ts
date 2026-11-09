import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  escenarioDeLaTabla6,
  PHI,
  respuestaALaIntervencion,
} from "@/modules/followups/respuesta-a-la-intervencion";
import type {
  ModuloSDelPunto,
  PuntoSerie,
  RefCapacitancia,
} from "@/modules/followups/data/serie-types";

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
  // SIN MODULO S POR DEFECTO: es un punto de la linea base, que es lo que son las 500 consultas que ya
  // existen. Los casos de la CNV-S lo pasan explicito.
  moduloS: null,
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
    expect(r?.anterior?.fecha).toBe("2026-01-01");
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
    expect(r?.anterior?.fecha, "las dos grafias del mayor 1 dejaron de compararse").toBe("2026-07-13");
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
    expect(r?.anterior?.fecha).toBe("2026-01-01");
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

  it("y NO decide por su cuenta si una cifra mejoro: la direccion llega resuelta", () => {
    // Si la pantalla comparara, seria la segunda definicion de "mejoro" y las dos podrian divergir. Es el
    // mismo criterio que la banda de trayectoria y las observaciones vigentes.
    const limpia = sinComentarios(PANTALLA);
    expect(limpia).toContain("lecturaDeDireccion(dato.direccion)");
    expect(limpia, "la pantalla volvio a comparar por su cuenta").not.toMatch(
      /dato\.(ahora|antes)\s*[<>]/,
    );
  });

  it("y YA NO dice que la adherencia y el escenario estan por llegar, porque llegaron", () => {
    // ═══ EL AVISO QUE SE RETIRA, Y POR QUE SU RETIRADA ES PARTE DE LA MISMA REGLA ═══
    //
    // Del 7 al 9 de noviembre la tarjeta decia: *"la adherencia y el escenario de respuesta de la tabla 6
    // llegan con la encuesta de seguimiento (CNV-S)"*. Era cierto y era la regla de la casa con las piezas
    // a medias: media tabla de decision, con el eje de la adherencia inventado, diria "respuesta
    // compatible con la ruta" sobre un paciente del que no se sabe si siguio la ruta.
    //
    // Desde el 9 de noviembre el Modulo S existe, se guarda y se lee, asi que ese aviso paso a ser lo
    // contrario de lo que se escribio para evitar: una pantalla diciendo que falta algo que ya esta.
    //
    // LO QUE NO SE RETIRA ES LA REGLA: con un eje ausente el escenario sigue sin decirse (los casos de
    // abajo), y la tarjeta explica cual falta.
    expect(PANTALLA, "el aviso de que la CNV-S esta por llegar sigue en la pantalla").not.toContain(
      "llegan con la encuesta de seguimiento",
    );
    expect(PANTALLA).toContain("{r.escenario ?");
    expect(PANTALLA).toContain("{r.seguimiento ?");
  });

  it("y las cuatro frases de la tabla 6 NO viven en la pantalla", () => {
    // Son su clasificacion, no copy de interfaz: si la pantalla las escribiera, habria dos tablas 6 (la
    // del modulo y la de la pantalla) y el dia que el cambie una casilla cambiaria solo una.
    const limpia = sinComentarios(PANTALLA);
    for (const casilla of [
      "Respuesta compatible con la ruta",
      "Mejora no atribuible a la ruta",
      "Respuesta insuficiente con exposición adecuada",
      "Exposición insuficiente",
    ]) {
      expect(limpia, `la pantalla escribe "${casilla}" por su cuenta`).not.toContain(casilla);
    }
    // Y tampoco decide la adherencia: sus dos umbrales son de `modulo-s`.
    expect(limpia, "la pantalla volvio a decidir la adherencia").not.toContain("Casi todo");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA TABLA 6  ·  su v15 §3  ·  2026-11-09
//
// | Delta del DFI | Adherencia adecuada | Adherencia insuficiente |
// |---|---|---|
// | Mejora | Respuesta compatible con la ruta | Mejora no atribuible a la ruta |
// | Sin cambio o empeoramiento | Respuesta insuficiente con exposición adecuada | Exposición insuficiente |
//
// LAS CUATRO FRASES SON AFIRMACIONES FUERTES: dos le atribuyen el resultado al tratamiento y dos se lo
// quitan. Por eso este candado fija las cuatro casillas Y los dos casos en que no se dice ninguna.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("el escenario de la tabla 6", () => {
  it("las cuatro casillas, con sus palabras", () => {
    expect(escenarioDeLaTabla6("mejora", true)?.titulo).toBe("Respuesta compatible con la ruta");
    expect(escenarioDeLaTabla6("mejora", false)?.titulo).toBe("Mejora no atribuible a la ruta");
    expect(escenarioDeLaTabla6("empeora", true)?.titulo).toBe(
      "Respuesta insuficiente con exposición adecuada",
    );
    expect(escenarioDeLaTabla6("empeora", false)?.titulo).toBe("Exposición insuficiente");
  });

  it("SIN CAMBIO va con el empeoramiento, como lo escribio, no con la mejora", () => {
    // Su fila es "sin cambio o empeoramiento". Agruparlo con la mejora convertiria una intervencion que
    // no movio nada en una respuesta a la ruta, que es la conclusion mas cara de las cuatro.
    expect(escenarioDeLaTabla6("sin-cambio", true)?.titulo).toBe(
      "Respuesta insuficiente con exposición adecuada",
    );
    expect(escenarioDeLaTabla6("sin-cambio", false)?.titulo).toBe("Exposición insuficiente");
  });

  it("y las dos coordenadas viajan con la casilla, para poder auditarla", () => {
    expect(escenarioDeLaTabla6("mejora", false)).toMatchObject({
      delta: "mejora",
      adherencia: "insuficiente",
    });
  });

  it("sin uno de los dos ejes NO hay casilla", () => {
    // Sin delta del DFI (una sola consulta, o dos escalas distintas del motor) y sin adherencia (una
    // encuesta sin el S3) no se elige entre cuatro frases: se dice que falta.
    expect(escenarioDeLaTabla6(null, true)).toBeNull();
    expect(escenarioDeLaTabla6("mejora", null)).toBeNull();
    expect(escenarioDeLaTabla6(null, null)).toBeNull();
  });
});

describe("el Modulo S en la tarjeta", () => {
  const moduloS = (p: Partial<ModuloSDelPunto>): ModuloSDelPunto => ({
    s1: null,
    s2: null,
    s3: null,
    s4: null,
    s5: null,
    s6: null,
    nombresDeProductos: {},
    ...p,
  });

  it("la adherencia y el escenario salen del Modulo S de ESTA consulta", () => {
    const r = respuestaALaIntervencion(
      [
        punto({ fecha: "2026-01-01", riesgoScore: 60 }),
        punto({
          fecha: "2026-04-01",
          riesgoScore: 42,
          moduloS: moduloS({ s3: "Todo", s1: { p1: "Todos los días" } }),
        }),
      ],
      REF,
    );
    expect(r?.seguimiento?.adherencia).toBe(true);
    expect(r?.escenario?.titulo).toBe("Respuesta compatible con la ruta");
  });

  it("una consulta de LINEA BASE no habla de adherencia (null, no «insuficiente»)", () => {
    // Es la diferencia entre "no siguio la ruta" y "no se le pregunto". Las 500 consultas que ya existen
    // son esto, y un `false` aqui las pondria todas en la columna de adherencia insuficiente.
    const r = respuestaALaIntervencion(
      [punto({ fecha: "2026-01-01", riesgoScore: 60 }), punto({ fecha: "2026-04-01", riesgoScore: 42 })],
      REF,
    );
    expect(r?.seguimiento).toBeNull();
    expect(r?.escenario).toBeNull();
    expect(r?.riesgo?.direccion, "el delta tiene que seguir saliendo").toBe("mejora");
  });

  it("una medicion NO COMPARABLE no entra al delta, y se dice con que evento", () => {
    // Su §3: "una medicion marcada como no comparable se guarda y se informa, pero no entra al delta".
    const r = respuestaALaIntervencion(
      [
        punto({ fecha: "2026-01-01", riesgoScore: 60 }),
        punto({
          fecha: "2026-04-01",
          riesgoScore: 42,
          moduloS: moduloS({ s3: "Todo", s4: ["Hospitalización o cirugía"] }),
        }),
      ],
      REF,
    );
    expect(r?.seguimiento?.comparable).toBe(false);
    expect(r?.seguimiento?.eventos).toEqual(["Hospitalización o cirugía"]);
    expect(r?.riesgo, "la medicion no comparable entro al delta").toBeNull();
    expect(r?.anterior, "no se compara contra nada").toBeNull();
    // Y SIN ESCENARIO, porque sin delta falta uno de los dos ejes.
    expect(r?.escenario).toBeNull();
  });

  it("y si la NO COMPARABLE es la anterior, se sigue buscando hacia atras", () => {
    // Restar contra la consulta de una neumonia hace que cualquier recuperacion se lea como respuesta a
    // la ruta. Es la misma busqueda hacia atras que ya hace con las escalas del motor.
    const r = respuestaALaIntervencion(
      [
        punto({ fecha: "2026-01-01", riesgoScore: 70 }),
        punto({
          fecha: "2026-02-01",
          riesgoScore: 90,
          moduloS: moduloS({ s4: ["Enfermedad aguda (fiebre, infección, diarrea)"] }),
        }),
        punto({ fecha: "2026-04-01", riesgoScore: 50, moduloS: moduloS({ s3: "Todo" }) }),
      ],
      REF,
    );
    expect(r?.anterior?.fecha, "comparo contra la consulta del evento agudo").toBe("2026-01-01");
    expect(r?.riesgo?.antes).toBe(70);
  });

  it("con Modulo S pero sin pareja comparable, la tarjeta SALE igual", () => {
    // La adherencia y los eventos son lectura de ESTA consulta, no de la pareja: esconder la tarjeta
    // perderia lo unico que si se sabe.
    const r = respuestaALaIntervencion(
      [punto({ fecha: "2026-04-01", riesgoScore: 42, moduloS: moduloS({ s3: "Nada" }) })],
      REF,
    );
    expect(r).not.toBeNull();
    expect(r?.anterior).toBeNull();
    expect(r?.seguimiento?.adherencia).toBe(false);
    expect(r?.escenario, "sin delta no hay casilla").toBeNull();
  });
});
