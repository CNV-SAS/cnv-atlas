import { describe, expect, it } from "vitest";

import {
  COLOMBIA_CITIES,
  COLOMBIA_CITIES_GEO,
  cityGeo,
} from "@/modules/evaluations/data/geo";

// Candado de la tabla geografica (bump de encuesta 2026-08-15 §3): la altitud alimenta analisis del
// observatorio, asi que se ancla contra fuente (IGAC/DANE, cabecera municipal) y se prueba la derivacion
// al leer. Si alguien mueve una altitud clave o rompe cityGeo, cae aqui.

describe("geo: tabla de ciudades con altitud/departamento/region", () => {
  it("altitudes ancladas contra fuente (capitales departamentales, msnm)", () => {
    const alt = (c: string) => cityGeo(c)?.altitudMsnm;
    expect(alt("Bogotá")).toBe(2640);
    expect(alt("Tunja")).toBe(2820); // la mas alta del grupo verificado
    expect(alt("Pasto")).toBe(2527);
    expect(alt("Manizales")).toBe(2160);
    expect(alt("Bucaramanga")).toBe(959);
    expect(alt("Medellín")).toBe(1495);
    expect(alt("Cali")).toBe(1018);
    expect(alt("Barranquilla")).toBe(18);
    expect(alt("Cartagena")).toBe(2);
  });

  it("toda ciudad tiene departamento, region valida y altitud >= 0", () => {
    const REGIONS = new Set(["Andina", "Caribe", "Pacífica", "Orinoquía", "Amazonía", "Insular"]);
    for (const c of COLOMBIA_CITIES_GEO) {
      expect(c.departamento.length, `${c.ciudad} sin departamento`).toBeGreaterThan(0);
      expect(REGIONS.has(c.region), `${c.ciudad} region invalida: ${c.region}`).toBe(true);
      expect(c.altitudMsnm, `${c.ciudad} altitud negativa`).toBeGreaterThanOrEqual(0);
      expect(c.altitudMsnm, `${c.ciudad} altitud implausible`).toBeLessThan(4000);
    }
  });

  it("no hay ciudades duplicadas y COLOMBIA_CITIES deriva de la tabla geo", () => {
    const nombres = COLOMBIA_CITIES_GEO.map((c) => c.ciudad);
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(COLOMBIA_CITIES).toEqual(nombres); // una sola fuente
  });

  it("cityGeo deriva sin importar acentos ni mayusculas (tolera como se guardo)", () => {
    expect(cityGeo("bogota")?.altitudMsnm).toBe(2640);
    expect(cityGeo("  MEDELLÍN ")?.departamento).toBe("Antioquia");
    expect(cityGeo("cúcuta")?.region).toBe("Andina");
  });

  it("cityGeo devuelve null para texto libre 'Otra', ciudad desconocida o vacio (no inventa altitud)", () => {
    expect(cityGeo("Otra")).toBeNull();
    expect(cityGeo("Villa del Rosario")).toBeNull(); // no esta en la lista curada
    expect(cityGeo(null)).toBeNull();
    expect(cityGeo("")).toBeNull();
  });
});
