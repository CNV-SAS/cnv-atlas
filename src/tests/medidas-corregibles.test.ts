import { describe, expect, it } from "vitest";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import {
  CORREGIBLES,
  MEDIDAS_CORREGIBLES,
  variableCruda,
} from "@/modules/bis-intake/services/medidas-corregibles";

// CANDADO DEL NAMESPACE. Nace de un defecto real (smoke 2026-08-27) y es de los que fallan MUDOS.
//
// Los crudos del Biody NO se guardan como "cintura" ni "peso", sino con el encabezado NORMALIZADO del
// export ("Waist Size cm", "Peso kg"). La primera version de la correccion los escribio con el nombre
// corto: se guardaba bien, no coincidia con ningun crudo, y la pantalla seguia mostrando el valor
// viejo como si nada hubiera pasado. Nada fallaba; simplemente no servia.
//
// Por eso el candado NO comprueba que la traduccion "exista": comprueba que cada campo editable
// resuelve a un nombre NO VACIO, y que agregar uno sin equivalente TRUENA en vez de guardar basura.

describe("medidas corregibles: cada campo editable sabe a que crudo va", () => {
  it("los cuatro campos tienen encabezado del Biody, y ninguno vacío", () => {
    expect(CORREGIBLES).toEqual(["peso", "talla", "cintura", "cadera"]);
    for (const m of CORREGIBLES) {
      expect(MEDIDAS_CORREGIBLES[m], `"${m}" sin encabezado`).toBeTruthy();
      expect(variableCruda(m).length).toBeGreaterThan(0);
    }
  });

  it("resuelven a los encabezados REALES del export, no a los nombres cortos", () => {
    // Si esto se rompe, es que alguien cambio el mapeo: hay que comprobar contra la BD, no ajustar el
    // test. Los nombres cortos NUNCA son validos aqui.
    expect(variableCruda("peso")).toBe(normalizeHeader("Peso kg"));
    expect(variableCruda("talla")).toBe(normalizeHeader("Altura cm"));
    expect(variableCruda("cintura")).toBe(normalizeHeader("Waist Size cm"));
    expect(variableCruda("cadera")).toBe(normalizeHeader("Hips Size cm"));
    for (const m of CORREGIBLES) expect(variableCruda(m)).not.toBe(m);
  });

  it("cintura y cadera usan la circunferencia MEDIDA, no el umbral de referencia", () => {
    // Es la familia del bug de cintura que ya esta anotada en composition-map: el umbral de
    // BIODY_COLUMNS y la circunferencia medida son variables distintas del mismo export.
    // normalizeHeader NO pasa a minusculas (solo reemplaza tokens y colapsa espacios), asi que la
    // comparacion va sin distinguir mayusculas. Lo escribi al reves la primera vez y el test lo dijo.
    expect(variableCruda("cintura").toLowerCase()).toContain("waist");
    expect(variableCruda("cadera").toLowerCase()).toContain("hips");
  });

  it("un campo SIN equivalente truena en vez de guardar algo que nadie lee", () => {
    // El control negativo del candado: si esto no lanzara, agregar un campo editable nuevo sin su
    // encabezado dejaria correcciones huerfanas, que es exactamente el defecto que lo origino.
    expect(() => variableCruda("inventado" as never)).toThrow(/no tiene encabezado/i);
  });

  it("los cuatro resuelven a nombres DISTINTOS entre sí", () => {
    const vistos = new Set(CORREGIBLES.map((m) => variableCruda(m)));
    expect(vistos.size).toBe(CORREGIBLES.length);
  });
});
