import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  RepartoInvalidoError,
  mereceAviso,
  repartir,
  residuoDeCnv,
  selladoCuadra,
} from "@/modules/payments/reparto";

// ═══ CANDADO DEL REPARTO (Bloque 1, 2026-09-11) ═══
//
// Lo que protege no es una formula: es que el margen de CNV sea EL RESIDUO y que el residuo no pueda
// quedar negativo sin que nadie se entere. El residuo no protesta: si alguien teclea mal una tasa, el
// Integrante y el proveedor cobran integro y CNV absorbe la diferencia en silencio.

const BASE_LUVIA = 75630; // PVP 90.000 con IVA, confirmado por contabilidad

describe("CNV es el residuo, y el modelo comercial lo afirma", () => {
  it("producto PROPIO: el Integrante su tasa, CNV el resto", () => {
    const r = repartir({ base: 100000, tasaIntegrante: 0.2, participacionProveedor: 0 });
    expect(r.montoIntegrante).toBe(20000);
    expect(r.montoProveedor).toBe(0);
    expect(r.montoCnv).toBe(80000);
  });

  it("producto de TERCERO: el proveedor su 70%, el Integrante su tasa, CNV lo que queda", () => {
    // Las cifras del §7.2 del modelo comercial, sobre la base de LUVIA.
    const r = repartir({ base: BASE_LUVIA, tasaIntegrante: 0.2, participacionProveedor: 0.7 });
    expect(r.montoProveedor).toBe(52941);
    expect(r.montoIntegrante).toBe(15126);
    expect(r.montoCnv).toBe(7563);
  });

  it("y si el Integrante sube al 30%, CNV queda en CERO, no en su margen de siempre", () => {
    // ES LA CONSECUENCIA DEL DISEÑO, dicha en voz alta. No es un caso raro: es lo que pasa en cuanto
    // alguien renegocie la comision hacia arriba, que es algo que va a pasar.
    const r = repartir({ base: BASE_LUVIA, tasaIntegrante: 0.3, participacionProveedor: 0.7 });
    expect(r.montoCnv).toBe(0);
    expect(residuoDeCnv(0.3, 0.7)).toBeCloseTo(0, 10);
  });

  it("la tasa del Integrante NO depende del producto: la misma da lo mismo en propio y en tercero", () => {
    // Es el criterio entero en un caso: para el Integrante la operacion es indistinta.
    const propio = repartir({ base: BASE_LUVIA, tasaIntegrante: 0.2, participacionProveedor: 0 });
    const tercero = repartir({ base: BASE_LUVIA, tasaIntegrante: 0.2, participacionProveedor: 0.7 });
    expect(propio.montoIntegrante).toBe(tercero.montoIntegrante);
    // Y la diferencia la absorbe CNV, que es la otra mitad de la frase del modelo.
    expect(propio.montoCnv - tercero.montoCnv).toBe(tercero.montoProveedor);
  });
});

describe("CNV no puede pagar por vender", () => {
  it("un residuo negativo FALLA, no avisa", () => {
    // Avisar no basta: el residuo no protesta, asi que un aviso ignorable se ignora y el error solo se
    // veria cuando una liquidacion saliera mal.
    expect(() => repartir({ base: BASE_LUVIA, tasaIntegrante: 0.35, participacionProveedor: 0.7 })).toThrow(
      RepartoInvalidoError,
    );
  });

  it("y el mensaje dice las dos tasas y el residuo, no 'datos inválidos'", () => {
    // Quien lo lea tiene que poder saber CUAL de las dos mover.
    try {
      repartir({ base: BASE_LUVIA, tasaIntegrante: 0.35, participacionProveedor: 0.7 });
      throw new Error("no falló");
    } catch (e) {
      const m = (e as Error).message;
      expect(m).toContain("70%");
      expect(m).toContain("35%");
      expect(m).toContain("-5%");
    }
  });

  it("cero SI se puede: es una decisión comercial, negativo no", () => {
    expect(() => repartir({ base: BASE_LUVIA, tasaIntegrante: 0.3, participacionProveedor: 0.7 })).not.toThrow();
  });

  it("y un 80/20 legítimo NO se bloquea por la coma flotante", () => {
    // ═══ DEFECTO ENCONTRADO POR EL CANDADO DEL UMBRAL, no por una revisión ═══
    //
    // En coma flotante `1 - 0.8 - 0.2` da -5,5e-17, o sea NEGATIVO. Sin redondear, el reparto propio de
    // todos los días habría disparado "CNV no puede pagar por vender" por un error de la decimosexta
    // cifra. Es la peor forma de este fallo: no se ve mirando los números, y habría aparecido el día que
    // alguien guardara un producto de tercero al 80%.
    expect(() => repartir({ base: 100000, tasaIntegrante: 0.2, participacionProveedor: 0.8 })).not.toThrow();
    expect(residuoDeCnv(0.2, 0.8)).toBe(0);
    // Y el otro lado del mismo defecto: 1 - 0.7 - 0.2 da 0,10000...3, que es MAYOR que 0,1, así que el
    // umbral del 10% no se habría disparado nunca justo en el caso para el que se escribió.
    expect(residuoDeCnv(0.2, 0.7)).toBe(0.1);
  });
});

describe("el sellado es auto-verificable", () => {
  it("los tres importes suman la base", () => {
    for (const [tasa, prov] of [
      [0.2, 0],
      [0.2, 0.7],
      [0.15, 0.7],
      [0.3, 0.7],
      [0.2, 0.65],
    ] as const) {
      const r = repartir({ base: BASE_LUVIA, tasaIntegrante: tasa, participacionProveedor: prov });
      expect(selladoCuadra(r), `${tasa}/${prov} no cuadra`).toBe(true);
    }
  });

  it("el redondeo lo absorbe CNV, que es coherente con ser el residuo", () => {
    // Una base y unas tasas que no dan centavos redondos: el Integrante y el proveedor cobran su
    // fraccion exacta, y la diferencia queda del lado del que ya absorbe todo lo demas.
    const r = repartir({ base: 33333.33, tasaIntegrante: 0.17, participacionProveedor: 0.41 });
    expect(r.montoIntegrante).toBe(5666.67);
    expect(r.montoProveedor).toBe(13666.67);
    expect(selladoCuadra(r)).toBe(true);
    // Y la suma da la base EXACTA, no "casi".
    expect(r.montoIntegrante + r.montoProveedor + r.montoCnv).toBeCloseTo(r.base, 2);
  });

  it("una fila manipulada NO cuadra: para eso existe la invariante", () => {
    const r = repartir({ base: BASE_LUVIA, tasaIntegrante: 0.2, participacionProveedor: 0.7 });
    expect(selladoCuadra({ ...r, montoCnv: r.montoCnv + 1000 })).toBe(false);
  });
});

describe("el aviso es política comercial y es POR PRODUCTO", () => {
  // Un producto propio deja a CNV el 80% y uno de tercero el 10%: con un umbral unico del 10%, el propio
  // no avisaria nunca y LUVIA avisaria desde el primer dia. Por eso el umbral vive junto al reparto.
  it("con el umbral global en 0, un producto propio al 20% no avisa", () => {
    expect(mereceAviso(0.2, 0, null, 0)).toBe(false);
  });

  it("y LUVIA con su umbral propio del 10% avisa en cuanto la tasa pasa del 20%", () => {
    expect(mereceAviso(0.2, 0.7, 0.1, 0)).toBe(true); // residuo 10% = umbral -> avisa
    expect(mereceAviso(0.19, 0.7, 0.1, 0)).toBe(false); // residuo 11% -> no
    expect(mereceAviso(0.25, 0.7, 0.1, 0)).toBe(true); // residuo 5% -> si
  });

  it("sin umbral propio usa el global", () => {
    expect(mereceAviso(0.25, 0.7, null, 0.1)).toBe(true);
    expect(mereceAviso(0.25, 0.7, null, 0)).toBe(false);
  });
});

describe("lo que el módulo NO hace, y es deliberado", () => {
  const src = readFileSync("src/modules/payments/reparto.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("no conoce el IVA ni el PVP: solo reparte la BASE", () => {
    // Principio 1 del modelo: el reparto se calcula SIEMPRE sobre la base sin IVA. Si este modulo
    // supiera del IVA, alguien acabaria pasandole el total, y el resultado seria aritmeticamente
    // coherente y comercialmente falso, que es el peor tipo de error: no se ve mirando los numeros.
    expect(src).not.toContain("IVA_RATE");
    expect(src).not.toContain("baseFromTotal");
    expect(src.toLowerCase()).not.toContain("pvp");
  });

  it("no lleva ningún porcentaje escrito a mano", () => {
    // Principio 2: nada de valores fijos. Las tasas ENTRAN, no se declaran aqui. Un 0,20 escrito en este
    // archivo seria la tasa de hoy convertida en regla.
    expect(src).not.toMatch(/=\s*0\.\d+/);
  });

  it("es NEUTRO: ni server-only ni cliente", () => {
    expect(src).not.toContain("server-only");
    expect(src).not.toContain('"use client"');
  });
});
