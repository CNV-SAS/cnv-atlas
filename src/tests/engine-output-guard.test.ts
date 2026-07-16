import { describe, expect, it } from "vitest";

import { isEngineOutput } from "@/clinical-engine";

// Regresion del bug del 500 en la vista de resultados (B13): reports es inmutable y guarda
// snapshots de eras anteriores del motor. El guard isEngineOutput distingue la forma ACTUAL
// (anibise-1.0.0: efrPhenotype/dfi/structural) de la vieja (stub-0.1.0: efrState/fenotipo/
// sectorFR) para que los consumidores degraden en vez de tronar. Las claves de cada forma
// son las observadas en snapshots reales de la BD.

// Snapshot con la forma actual del motor (claves estructurales minimas).
const anibiseSnapshot = {
  sexo: "M",
  indicators: { ifc: 1.2, irc: 0.9 },
  classifications: {},
  efrPhenotype: { stateNumber: 33, key: "N_N_N_A", bands: { ifc: 2, irc: 2, ffmi: 2, fmi: 3 } },
  structural: { key: "N_A", nombre: "Fenotipo fuerte-adiposo" },
  frSector: { key: "N_N", nombre: "Desempeno normal, riesgo moderado" },
  dfi: { domains: [], riesgo: { nivel: "MEDIO", score: 3, descripcion: "" }, rutas: [] },
  nutraceuticos: "",
  resumenClinico: "",
  versions: { engine: "anibise-1.0.0", model: "v1", rules: "r1" },
};

// Snapshot de la era stub (pre-B11): otra forma, sin efrPhenotype/dfi/structural.
const stubSnapshot = {
  alerts: [],
  classifications: {},
  efrState: 42,
  estadoEIEC: {},
  estadoPBI: {},
  fenotipo: {},
  indicators: {},
  protocol: {},
  sectorFR: {},
  versions: { engine: "stub-0.1.0" },
};

describe("isEngineOutput", () => {
  it("acepta un snapshot con la forma actual del motor", () => {
    expect(isEngineOutput(anibiseSnapshot)).toBe(true);
  });

  it("rechaza un snapshot de la era stub (sin efrPhenotype/dfi/structural)", () => {
    expect(isEngineOutput(stubSnapshot)).toBe(false);
  });

  it("rechaza valores no-objeto o nulos", () => {
    expect(isEngineOutput(null)).toBe(false);
    expect(isEngineOutput(undefined)).toBe(false);
    expect(isEngineOutput("x")).toBe(false);
    expect(isEngineOutput({})).toBe(false);
  });
});
