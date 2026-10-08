import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { capRef } from "@/clinical-engine/capacitancia";
import { esFechaDeNacimientoPosible, PRIMER_ANIO_DE_NACIMIENTO_POSIBLE } from "@/modules/consent/validations";

// ═══ UNA FECHA DE NACIMIENTO IMPOSIBLE NO PUEDE LLEGAR AL MOTOR (Santiago, smoke 2026-10-08) ═══
//
// ── LO QUE EL BARRIDO ENCONTRO ────────────────────────────────────────────────────────────────────
//
//   CC 43597117 · 1795-02-21 (231 años) · importado     · 1 DIAGNOSTICO EMITIDO
//   CC 43202057 · 41980-04-19            · NO importado  · 1 DIAGNOSTICO EMITIDO
//   CC 70696566 · 51977-02-08            · importado     · sin diagnostico
//
// Y SALIO DE CASUALIDAD: la consulta de los menores imprimia la edad, y una fila decia -49950. Nadie estaba
// buscando esto.
//
// ── POR QUE NO SE PUEDE ARREGLAR EN EL MOTOR, QUE ES DONDE UNO MIRARIA ───────────────────────────
//
// Con 231 años el motor NO FALLA: `capRef` acepta la edad (finita y positiva), cae a la ultima banda de su
// tabla y marca `fueraDeRango`. Produce una clasificacion PLAUSIBLE.
//
// Y ESE FLAG NO SIRVE DE DETECTOR, que es la parte que importa: la tabla empieza en 18, asi que
// `fueraDeRango` tambien es true para CUALQUIER MENOR, y menores hay once. Dice "la tabla no llega hasta la
// unica defensa es no dejar entrar la fecha.
//
// LOS DOS CASOS SON DISTINTOS Y LOS DOS MALOS, por razones opuestas: la fecha FUTURA deja al motor sin
// referencia y lo dice en voz alta; la del pasado imposible lo deja clasificar en silencio. **La que no falla
// es la peligrosa.**

describe("el motor no puede ser el detector: clasifica 231 años sin quejarse", () => {
  it("una edad imposible del pasado cae en la ultima decada y se ve plausible", () => {
    const r = capRef("F", 231);
    expect(r, "si esto fuera null, el motor seria el detector y no haria falta validar la entrada").not.toBeNull();
    expect(r?.fueraDeRango).toBe(true);
  });

  it("y el flag no distingue un dato roto de un MENOR, que aqui es el caso real", () => {
    // ME CORRIJO SOBRE LA MARCHA: primero puse de ejemplo a un paciente de 95 años, y la tabla llega hasta 200,
    // asi que 95 entra sin marca. El ejemplo estaba mal; el argumento no, y el caso que lo prueba es mejor.
    //
    // LA TABLA EMPIEZA EN 18, asi que `fueraDeRango` tambien es true para CUALQUIER MENOR. Y menores hay: una
    // integrante atiende once. Actuar sobre el flag habria bloqueado a todos ellos para atrapar una fecha rota.
    expect(capRef("F", 15)?.fueraDeRango, "un menor legitimo tambien cae fuera de la tabla").toBe(true);
    expect(capRef("F", 231)?.fueraDeRango).toBe(true);
    // Y DENTRO DE LA TABLA no marca nada, ni con 95: el flag habla del RANGO DE LA TABLA, no de si el dato es
    // posible. Son dos preguntas distintas y solo una se puede contestar aqui.
    expect(capRef("F", 95)?.fueraDeRango).toBe(false);
  });

  it("la fecha FUTURA si deja al motor sin referencia, que es el caso menos peligroso", () => {
    expect(capRef("F", -39953)).toBeNull();
  });
});

describe("el cinturon de la entrada, ancho a proposito", () => {
  const hoy = new Date("2026-10-08T12:00:00Z");

  it("atrapa las tres fechas reales del barrido", () => {
    expect(esFechaDeNacimientoPosible("1795-02-21", hoy)).toBe(false);
    expect(esFechaDeNacimientoPosible("41980-04-19", hoy)).toBe(false);
    expect(esFechaDeNacimientoPosible("51977-02-08", hoy)).toBe(false);
  });

  it("y NO atrapa a nadie real, incluido alguien muy mayor", () => {
    // EL CONTROL QUE IMPIDE EL CINTURON ESTRECHO: una persona de 104 años es rara y existe, y un rango sin
    // fuente que la rechazara seria una cifra nuestra frenando un paciente de verdad.
    expect(esFechaDeNacimientoPosible("1922-03-15", hoy)).toBe(true);
    expect(esFechaDeNacimientoPosible("2024-01-01", hoy)).toBe(true);
    // El limite exacto, por los dos lados.
    expect(esFechaDeNacimientoPosible(`${PRIMER_ANIO_DE_NACIMIENTO_POSIBLE}-01-01`, hoy)).toBe(true);
    expect(esFechaDeNacimientoPosible(`${PRIMER_ANIO_DE_NACIMIENTO_POSIBLE - 1}-12-31`, hoy)).toBe(false);
    expect(esFechaDeNacimientoPosible("2026-10-08", hoy), "hoy mismo es posible").toBe(true);
    expect(esFechaDeNacimientoPosible("2026-10-09", hoy), "mañana no es la fecha de nadie").toBe(false);
  });

  it("y queda dicho que un error de tecleo plausible NO lo atrapa", () => {
    // SE PRUEBA LA LIMITACION A PROPOSITO, para que nadie crea que esto valida la fecha: 1960 tecleado como
    // 1990 pasa, y no hay cinturon que lo pare. Si algun dia alguien estrecha el rango creyendo que lo cubre,
    // este caso dice que no era por ahi.
    expect(esFechaDeNacimientoPosible("1990-05-05", hoy)).toBe(true);
    expect(esFechaDeNacimientoPosible("1960-05-05", hoy)).toBe(true);
  });
});

describe("y los dos caminos de entrada usan el MISMO criterio", () => {
  it("el intake de la encuesta lo valida", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/modules/evaluations/validations.ts", "utf8");
    expect(src).toContain("esFechaDeNacimientoPosible");
  });

  it("y la revision del import tambien, no solo las fechas futuras", async () => {
    // MIRABA SOLO `edadAlFirmar < 0`, asi que la de 1795 paso la revision SIN UNA SOLA MARCA. Dos criterios de
    // "fecha imposible" en dos sitios es como se llega a que el import acepte lo que el formulario rechaza.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/modules/importacion-html/services/revisar-lote.ts", "utf8");
    expect(src).toContain("esFechaDeNacimientoPosible");
  });
});
