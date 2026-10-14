import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  DECLARACIONES_PRESENCIALES,
  DECLARACION_PRESENCIAL,
  DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO,
  DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO_VERSION,
  DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO,
  DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO_VERSION,
  DECLARACION_PRESENCIAL_VERSION,
  declaracionAfirmaAsentimiento,
  declaracionPorEdad,
  esDeclaracionDeMenor,
  ramaSigueCorrespondiendo,
  textoDeLaDeclaracion,
} from "@/modules/consent/text/declaracion-presencial";

// ═══ UNA VERSION, UN TEXTO, PARA SIEMPRE (legal, 2026-10-12) ═══
//
// LA CONDICION, textual del abogado: *"una version, un texto, para siempre. Cualquier cambio de redaccion,
// por minimo que sea, es una version nueva."*
//
// Y SU RAZON, que es la que hace falta este candado: *"si alguien edita el texto de la 1.1-b el mes
// entrante sin crear una 1.2, todas las declaraciones anteriores pasan a apuntar a un texto distinto del
// que se mostro, y ahi si el registro deja de probar lo que dice probar."*
//
// ── POR QUE ESTE CANDADO SUSTITUYE AL HASH EN LA BASE ─────────────────────────────────────────────
//
// El abogado acepto no guardar el hash de cada declaracion: *"con tres textos congelados elegidos por
// fecha de nacimiento, el numero de version ya identifica el texto exacto de forma inequivoca"*. Esa
// conclusion solo se sostiene si los textos son DE VERDAD inmutables, y eso no lo garantiza una nota en un
// comentario: lo garantiza un hash que falla al editarlos.
//
// ASI QUE EL HASH VIVE AQUI, no en una columna. Mismo efecto probatorio, cero columnas, y el momento en que
// alguien se enteraria del cambio pasa a ser el commit en vez de un juicio.
//
// ── COMO SE ACTUALIZA, cuando de verdad haya un texto nuevo ──
//
// NO se edita el hash de una version existente: se AÑADE la version nueva con el suyo. Si este candado se
// pone rojo y la respuesta es cambiar un hash de esta lista, la respuesta es la equivocada.

const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex").slice(0, 32);

// LOS HASHES SE CALCULARON SOBRE LOS TEXTOS DEL DICTAMEN, el dia que entraron. No se recalculan.
const CONGELADOS: Readonly<Record<string, string>> = {
  "1.0": "c82f26aa05e5f8c6772359a8e9f7fc0d",
  "1.1-a": "31251af556b1e4cbbb8aca02f2e68d31",
  "1.1-b": "bf71818b1e72c4cf91262f35a13d4184",
};

describe("los textos de la declaracion estan congelados", () => {
  it("hay exactamente tres versiones, y son las que el dictamen define", () => {
    expect(Object.keys(DECLARACIONES_PRESENCIALES).sort()).toEqual(["1.0", "1.1-a", "1.1-b"]);
  });

  for (const [version, texto] of Object.entries(DECLARACIONES_PRESENCIALES)) {
    it(`la ${version} no cambio ni una palabra`, () => {
      expect(
        sha(texto),
        `El texto de la ${version} cambio. Una version es UN texto, para siempre: si la redaccion tenia ` +
          `que cambiar, esto es una version NUEVA (y las declaraciones ya firmadas siguen citando la ` +
          `vieja, que se queda). No se actualiza el hash de una version existente.`,
      ).toBe(CONGELADOS[version]);
    });
  }

  // LA 1.0 NO SE TOCA, textual: *"sigue vigente para pacientes mayores de edad. Son dos textos
  // coexistentes, no una sustitucion."*
  it("la 1.0 sigue siendo la de mayores, con sus cuatro afirmaciones", () => {
    expect(DECLARACION_PRESENCIAL_VERSION).toBe("1.0");
    expect(DECLARACION_PRESENCIAL).toContain("presenté el consentimiento al paciente");
    expect(DECLARACION_PRESENCIAL).toContain("tuvo oportunidad de leerlo");
    expect(DECLARACION_PRESENCIAL).toContain("fue él quien marcó las autorizaciones");
    expect(DECLARACION_PRESENCIAL).toContain("verifiqué su identidad contra su documento");
  });
});

// ═══ LA FRASE DEL ASENTIMIENTO ES CONDICIONAL, Y ES EL PUNTO DE LA 1.1 ═══
//
// Textual: *"para un menor de 14 años esa frase no debe aparecer en el texto declarado, porque el
// profesional estaria declarando algo que no ocurrio"*.
describe("la 1.1-a no afirma un asentimiento que no ocurrio", () => {
  it("la 1.1-a NO menciona el asentimiento, en ninguna forma", () => {
    expect(DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO.toLowerCase()).not.toContain("asentimiento");
    expect(DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO).not.toContain("catorce");
  });

  it("y la 1.1-b si, con los dos limites de edad escritos", () => {
    expect(DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO).toContain("otorgó su asentimiento en mi presencia");
    expect(DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO).toContain("catorce (14) y diecisiete (17)");
  });

  // LO UNICO QUE CAMBIA ENTRE LAS DOS es la ultima clausula (y la "y" que unia la anterior). Si alguien
  // reescribe una de las dos, este candado dice que ya no son el mismo texto con y sin esa frase, que es
  // la relacion que el dictamen describe.
  it("las dos afirman LO MISMO sobre el representante: solo cambia la ultima clausula", () => {
    const comun = [
      "presenté el consentimiento informado de ATLAS al representante legal del paciente menor de edad",
      "tuvo oportunidad de leerlo íntegramente y de formular preguntas antes de otorgarlo",
      "fue el representante legal, y no otra persona, quien marcó las autorizaciones registradas",
      "verifiqué su identidad contra su documento de identificación y su calidad de representante legal",
    ];
    for (const frase of comun) {
      expect(DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO, frase).toContain(frase);
      expect(DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO, frase).toContain(frase);
    }
  });

  it("las dos declaran 'bajo mi responsabilidad', que la 1.0 no dice", () => {
    expect(DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO).toContain("bajo mi responsabilidad");
    expect(DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO).toContain("bajo mi responsabilidad");
  });
});

// ═══ LA ELECCION POR EDAD ═══
describe("que declaracion le toca a cada edad", () => {
  it("18 y mas: la 1.0", () => {
    expect(declaracionPorEdad(18)?.version).toBe("1.0");
    expect(declaracionPorEdad(45)?.version).toBe("1.0");
  });

  it("de 14 a 17: la 1.1-b, que es la que afirma el asentimiento", () => {
    expect(declaracionPorEdad(14)?.version).toBe(DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO_VERSION);
    expect(declaracionPorEdad(17)?.version).toBe(DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO_VERSION);
  });

  it("menos de 14: la 1.1-a, SIN la frase del asentimiento", () => {
    expect(declaracionPorEdad(13)?.version).toBe(DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO_VERSION);
    expect(declaracionPorEdad(0)?.version).toBe(DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO_VERSION);
    expect(declaracionPorEdad(13)?.texto.toLowerCase()).not.toContain("asentimiento");
  });

  // SIN EDAD NO SE ELIGE, y no cae a la 1.0. La 1.0 afirma que marco EL PACIENTE; servirla por defecto
  // cuando no se sabe la edad es como se firma la declaracion equivocada sobre un menor.
  it("sin edad NO devuelve la 1.0 por defecto: devuelve null", () => {
    expect(declaracionPorEdad(null)).toBeNull();
    expect(declaracionPorEdad(-1)).toBeNull();
  });

  it("los dos predicados coinciden con las versiones", () => {
    expect(esDeclaracionDeMenor("1.0")).toBe(false);
    expect(esDeclaracionDeMenor("1.1-a")).toBe(true);
    expect(esDeclaracionDeMenor("1.1-b")).toBe(true);
    expect(declaracionAfirmaAsentimiento("1.1-a")).toBe(false);
    expect(declaracionAfirmaAsentimiento("1.1-b")).toBe(true);
    expect(declaracionAfirmaAsentimiento("1.0")).toBe(false);
  });

  it("y una version guardada siempre se puede citar", () => {
    for (const v of ["1.0", "1.1-a", "1.1-b"]) {
      expect(textoDeLaDeclaracion(v)).toBeTruthy();
    }
    expect(textoDeLaDeclaracion("9.9"), "una version que no existe no se inventa").toBeNull();
  });
});

// ═══ LA RAMA CONTRA UNA FECHA CORREGIDA (el hallazgo del abogado, 2026-10-14) ═══
//
// *"Si esa fecha esta mal digitada y se corrige despues, el consentimiento ya firmado quedo bajo la rama
// equivocada, y NADA LO VA A DETECTAR."*
//
// LO QUE ESTE CANDADO SOSTIENE, y es lo unico de esa pieza que puede salir mal en silencio: la ARITMETICA.
// La deteccion vive en un script (`RAMA_DEL_CONSENTIMIENTO_CONTRA_LA_FECHA_DE_HOY.sql`) y la superficie que
// lo avise es la pieza 2; pero si estas cuentas estuvieran mal, el script diria "no hay nada" y seria peor
// que no tenerlo.
describe("la rama declarada contra una fecha de nacimiento corregida", () => {
  it("sin la fecha congelada no afirma nada, en vez de adivinar", () => {
    // Las sesiones anteriores a la 0216 no la tienen. Decir de ellas que estan mal seria inventar.
    expect(ramaSigueCorrespondiendo({ fechaAlEmitir: null, fechaDeHoy: "2010-01-01", diaDelActo: "2026-10-14" })).toBeNull();
    expect(ramaSigueCorrespondiendo({ fechaAlEmitir: "2010-01-01", fechaDeHoy: null, diaDelActo: "2026-10-14" })).toBeNull();
  });

  it("la misma fecha es coherente, y un error que NO cruza umbral tampoco alarma", () => {
    const igual = ramaSigueCorrespondiendo({
      fechaAlEmitir: "1990-05-20",
      fechaDeHoy: "1990-05-20",
      diaDelActo: "2026-10-14",
    });
    expect(igual?.coherente).toBe(true);

    // Un dedazo en el DIA de un adulto: sigue siendo adulto, y marcarlo seria ruido.
    const dedazo = ramaSigueCorrespondiendo({
      fechaAlEmitir: "1990-05-20",
      fechaDeHoy: "1990-05-02",
      diaDelActo: "2026-10-14",
    });
    expect(dedazo?.coherente, "un error que no cambia la rama no cambia nada de lo declarado").toBe(true);
  });

  it("EL CASO GRAVE: se declaro como adulto y era menor", () => {
    const r = ramaSigueCorrespondiendo({
      fechaAlEmitir: "2006-03-10", // 20 años el dia del acto
      fechaDeHoy: "2016-03-10", // 10 años
      diaDelActo: "2026-10-14",
    });
    expect(r?.coherente).toBe(false);
    expect(r?.versionQueSeUso).toBe("1.0");
    expect(r?.versionQueCorresponde, "faltaria el representante legal entero").toBe("1.1-a");
  });

  it("y el umbral del asentimiento, que es el que mas facil se pasa por alto", () => {
    const r = ramaSigueCorrespondiendo({
      fechaAlEmitir: "2013-01-01", // 13 el dia del acto: 1.1-a
      fechaDeHoy: "2011-01-01", // 15: 1.1-b
      diaDelActo: "2026-10-14",
    });
    expect(r?.versionQueSeUso).toBe("1.1-a");
    expect(r?.versionQueCorresponde).toBe("1.1-b");
    expect(r?.coherente).toBe(false);
  });

  // ── LA EDAD SE MIDE EL DIA DEL ACTO, NO HOY, y esto es lo que lo prueba ────────────────────────
  //
  // Un menor que firmo bien y cumplio 18 despues NO esta mal declarado. Comparado contra hoy saldria como
  // incoherente, y el script se llenaria de falsos positivos que harian que nadie lo mirara.
  it("el paso del tiempo NO vuelve incoherente un consentimiento bien firmado", () => {
    const r = ramaSigueCorrespondiendo({
      fechaAlEmitir: "2008-06-01",
      fechaDeHoy: "2008-06-01",
      diaDelActo: "2025-01-15", // tenia 16: 1.1-b, correcto
    });
    expect(r?.versionQueSeUso).toBe("1.1-b");
    expect(r?.coherente, "hoy ya tiene 18, y eso no cambia lo que firmo con 16").toBe(true);
  });

  // EL CUMPLEAÑOS EXACTO, que es donde una resta de milisegundos se equivoca por un dia.
  it("cumplir 18 el dia mismo del acto ya es adulto", () => {
    const r = ramaSigueCorrespondiendo({
      fechaAlEmitir: "2008-10-14",
      fechaDeHoy: "2008-10-14",
      diaDelActo: "2026-10-14",
    });
    expect(r?.versionQueSeUso).toBe("1.0");
    const vispera = ramaSigueCorrespondiendo({
      fechaAlEmitir: "2008-10-15",
      fechaDeHoy: "2008-10-15",
      diaDelActo: "2026-10-14",
    });
    expect(vispera?.versionQueSeUso, "la vispera todavia es menor").toBe("1.1-b");
  });
});
