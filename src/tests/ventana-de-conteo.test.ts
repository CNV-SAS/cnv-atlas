import { describe, expect, it } from "vitest";

import {
  DIAS_DE_VENTANA_POR_DEFECTO,
  DIA_DE_APERTURA_POR_DEFECTO,
  estadoDelConteo,
  fraseDelConteo,
} from "@/modules/nutraceuticals/ventana-de-conteo";

// ═══ CANDADO DE LA VENTANA DEL CONTEO FISICO (Santiago, 2026-10-06) ═══
//
// EL PROBLEMA QUE ESTA PIEZA RESUELVE no era que faltara un interruptor: la seccion de conteo estaba SIEMPRE
// abierta y por eso no decia CUANDO TOCA, asi que la gente entendia que habia que contar al recibir.
//
// LA CADENCIA ES NUESTRA Y NO DEL MODELO (verificado el 2026-10-05): el modelo solo dice que el conteo se
// mantiene en ambas modalidades. El "semanal" venia de nuestra planeacion de T3b-3. Por eso los valores viven
// en configuracion y estos casos los pasan explicitos.

const SIN_CONTEO = { ultimoConteo: null };

describe("la ventana mensual", () => {
  it("por defecto abre el dia 1 y dura cinco dias", () => {
    expect(DIA_DE_APERTURA_POR_DEFECTO).toBe(1);
    expect(DIAS_DE_VENTANA_POR_DEFECTO).toBe(5);
  });

  it("el primer dia esta dentro", () => {
    const e = estadoDelConteo({ hoy: "2026-10-01", ...SIN_CONTEO });
    expect(e.abierto).toBe(true);
  });

  // EL ULTIMO DIA ESTA DENTRO, inclusive. Es el limite que se resuelve distinto en dos sitios y le quita un
  // dia a alguien sin que nadie lo note.
  it("el ultimo dia tambien, inclusive", () => {
    const e = estadoDelConteo({ hoy: "2026-10-05", ...SIN_CONTEO });
    expect(e.abierto).toBe(true);
    if (e.abierto) expect(e.ventana).toEqual({ desde: "2026-10-01", hasta: "2026-10-05" });
  });

  it("el dia siguiente ya no", () => {
    const e = estadoDelConteo({ hoy: "2026-10-06", ...SIN_CONTEO });
    expect(e.abierto).toBe(false);
  });

  // SE DICE CUANDO LE TOCA, no solo que no puede: "no disponible" sin fecha deja al Integrante sin nada que
  // hacer con la informacion, que es el problema con el que empezo todo esto.
  it("y fuera de la ventana dice cuando es la proxima", () => {
    const e = estadoDelConteo({ hoy: "2026-10-20", ...SIN_CONTEO });
    expect(e.abierto).toBe(false);
    if (!e.abierto && e.porQue === "fuera_de_ventana") {
      expect(e.proxima).toEqual({ desde: "2026-11-01", hasta: "2026-11-05" });
    } else {
      throw new Error("tenia que estar fuera de ventana");
    }
  });

  it("la ventana es configurable", () => {
    const e = estadoDelConteo({ hoy: "2026-10-27", diaDeApertura: 25, diasDeVentana: 3, ...SIN_CONTEO });
    expect(e.abierto).toBe(true);
    if (e.abierto) expect(e.ventana).toEqual({ desde: "2026-10-25", hasta: "2026-10-27" });
  });

  // ── LOS DOS BORDES DEL CALENDARIO, que son donde esta aritmetica se rompe si se escribe a mano ──

  // UNA VENTANA QUE PASA AL MES SIGUIENTE. Con apertura el 28 y cinco dias, la de septiembre llega al 2 de
  // octubre. Un Integrante que entre el 1 de octubre esta DENTRO de la de septiembre, no fuera de la de
  // octubre: calcular solo la del mes en curso le negaria una ventana abierta, que es el peor fallo posible.
  it("una ventana que cruza el fin de mes sigue abierta al otro lado", () => {
    const e = estadoDelConteo({ hoy: "2026-10-01", diaDeApertura: 28, diasDeVentana: 5, ...SIN_CONTEO });
    expect(e.abierto, "el 1 de octubre cae dentro de la ventana de septiembre").toBe(true);
    if (e.abierto) expect(e.ventana).toEqual({ desde: "2026-09-28", hasta: "2026-10-02" });
  });

  // UN DIA DE APERTURA QUE NO EXISTE EN ESE MES se recorta al ultimo. Con 31, febrero abre el 28.
  it("el dia 31 en febrero abre el ultimo dia del mes", () => {
    const e = estadoDelConteo({ hoy: "2026-02-28", diaDeApertura: 31, diasDeVentana: 2, ...SIN_CONTEO });
    expect(e.abierto).toBe(true);
    if (e.abierto) expect(e.ventana.desde).toBe("2026-02-28");
  });
});

describe("ya conto en esta ventana", () => {
  // ES LA MITAD QUE VUELVE COHERENTE A LA VENTANA (lo añadio Santiago): si despues de contar siguiera
  // abierta, la ventana no significaria nada y volveriamos a la seccion siempre encendida con otro texto.
  it("contar cierra la ventana", () => {
    const e = estadoDelConteo({ hoy: "2026-10-03", ultimoConteo: "2026-10-02" });
    expect(e.abierto).toBe(false);
    if (!e.abierto && e.porQue === "ya_conto") expect(e.contadoEl).toBe("2026-10-02");
    else throw new Error("tenia que decir que ya conto");
  });

  // UN CONTEO DEL MES PASADO NO CIERRA LA DE ESTE MES. Si lo hiciera, quien conto una vez no volveria a
  // contar nunca, y el control que detecta ventas no registradas se apagaria en silencio.
  it("un conteo del periodo anterior no cierra el de este", () => {
    const e = estadoDelConteo({ hoy: "2026-10-02", ultimoConteo: "2026-09-03" });
    expect(e.abierto).toBe(true);
  });
});

describe("la apertura que concede admin", () => {
  // ES LA SALIDA PARA LO QUE EL CALENDARIO NO CUBRE: hay sospecha de una diferencia y hay que contar ya. Y es
  // la salida de quien se paso su ventana.
  it("abre el conteo fuera de la ventana", () => {
    const e = estadoDelConteo({
      hoy: "2026-10-20",
      ...SIN_CONTEO,
      aperturaManual: { yaRespondida: false, hasta: "2026-10-25", motivo: "una venta no cuadra con su saldo" },
    });
    expect(e.abierto).toBe(true);
    if (e.abierto) {
      expect(e.porQue).toBe("apertura_manual");
      // EL MOTIVO LLEGA A LA PANTALLA: si le abren el conteo, tiene derecho a saber por que. Una peticion sin
      // explicacion se lee como una acusacion.
      expect(e.motivo).toBe("una venta no cuadra con su saldo");
    }
  });

  it("vencida no abre nada", () => {
    const e = estadoDelConteo({
      hoy: "2026-10-26",
      ...SIN_CONTEO,
      aperturaManual: { yaRespondida: false, hasta: "2026-10-25", motivo: "x" },
    });
    expect(e.abierto).toBe(false);
  });

  // EL CASO FINO: admin le pide contar DESPUES de que ya conto este mes. El conteo anterior no puede tapar la
  // peticion nueva, porque la peticion existe justamente porque algo no cuadro.
  it("una peticion posterior al conteo vuelve a abrirlo", () => {
    const e = estadoDelConteo({
      hoy: "2026-10-04",
      ultimoConteo: "2026-10-02",
      aperturaManual: { yaRespondida: false, hasta: "2026-10-10", motivo: "el conteo del 2 no explica la diferencia" },
    });
    expect(e.abierto, "la peticion de admin manda sobre un conteo ya hecho").toBe(true);
  });
});

describe("la frase que ve el Integrante", () => {
  // VIVE EN EL MODULO y no en la pantalla porque el SERVIDOR la usa tambien, al rechazar un conteo fuera de
  // plazo. Dos copias se separan, y entonces la pantalla y el error dirian fechas distintas.
  it("abierta dice hasta cuando", () => {
    const e = estadoDelConteo({ hoy: "2026-10-02", ...SIN_CONTEO });
    expect(fraseDelConteo(e)).toMatch(/hasta el 2026-10-05/);
  });

  it("cerrada dice cuando se abre, con las dos fechas", () => {
    const e = estadoDelConteo({ hoy: "2026-10-20", ...SIN_CONTEO });
    expect(fraseDelConteo(e)).toMatch(/se abre el 2026-11-01/);
    expect(fraseDelConteo(e)).toMatch(/2026-11-05/);
  });

  it("si ya conto lo dice con la fecha, en vez de decir que no puede", () => {
    const e = estadoDelConteo({ hoy: "2026-10-03", ultimoConteo: "2026-10-02" });
    expect(fraseDelConteo(e)).toMatch(/Ya contaste/);
    expect(fraseDelConteo(e)).toMatch(/2026-10-02/);
  });

  it("y si CNV se lo pidio, dice la razon", () => {
    const e = estadoDelConteo({
      hoy: "2026-10-20",
      ...SIN_CONTEO,
      aperturaManual: { yaRespondida: false, hasta: "2026-10-25", motivo: "una venta no cuadra" },
    });
    expect(fraseDelConteo(e)).toMatch(/CNV te pidió un conteo/);
    expect(fraseDelConteo(e)).toMatch(/una venta no cuadra/);
  });

  // NINGUNA FRASE SALE CON UN HUECO. Es la misma clase de defecto que el toast del import del BIS, que salio
  // con "( variables)" porque un reemplazo se comio los ${...}: compila y solo se ve en pantalla.
  it("ninguna frase sale con un hueco", () => {
    const estados = [
      estadoDelConteo({ hoy: "2026-10-02", ...SIN_CONTEO }),
      estadoDelConteo({ hoy: "2026-10-20", ...SIN_CONTEO }),
      estadoDelConteo({ hoy: "2026-10-03", ultimoConteo: "2026-10-02" }),
      estadoDelConteo({ hoy: "2026-10-20", ...SIN_CONTEO, aperturaManual: { yaRespondida: false, hasta: "2026-10-25", motivo: "x y z" } }),
    ];
    for (const e of estados) {
      const f = fraseDelConteo(e);
      expect(f, "una frase quedo con un hueco donde iba una fecha").not.toMatch(/ el \.| {2}|undefined|NaN/);
      expect(f.length).toBeGreaterThan(20);
    }
  });
});
