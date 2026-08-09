import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BIODY_COLUMNS } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { computeCelularBadges } from "@/modules/treatment/data/celular-badges";

// Arma el `raw` (variable_name normalizado -> valor) desde claves de BIODY_COLUMNS, como llega de B8.
function mk(vals: Partial<Record<string, number>>): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [key, v] of Object.entries(vals)) {
    if (v != null && BIODY_COLUMNS[key]) raw[normalizeHeader(BIODY_COLUMNS[key].header)] = v;
  }
  return raw;
}

describe("computeCelularBadges: badges por umbral (H)", () => {
  it("AF: lee cAF (Bajo H<6.5) -> dispara en 6.4, NO en 6.6", () => {
    expect(computeCelularBadges(mk({ AF: 6.4 }), true).badges.map((b) => b.id)).toContain("af");
    expect(computeCelularBadges(mk({ AF: 6.6 }), true).badges.map((b) => b.id)).not.toContain("af");
  });
  it("AF: umbral femenino (Bajo M<6.0) -> dispara en 5.9, NO en 6.1", () => {
    expect(computeCelularBadges(mk({ AF: 5.9 }), false).badges.map((b) => b.id)).toContain("af");
    expect(computeCelularBadges(mk({ AF: 6.1 }), false).badges.map((b) => b.id)).not.toContain("af");
  });
  it("MCA_dif < -1 -> dispara en -1.5, NO en -0.5", () => {
    expect(computeCelularBadges(mk({ MCA_dif: -1.5 }), true).badges.map((b) => b.id)).toContain("mca");
    expect(computeCelularBadges(mk({ MCA_dif: -0.5 }), true).badges.map((b) => b.id)).not.toContain("mca");
  });
  it("hidSG < su referencia -> dispara (70<73), NO si iguala o supera (74>=73)", () => {
    expect(computeCelularBadges(mk({ hidSG: 70, hidSG_ref: 73 }), true).badges.map((b) => b.id)).toContain("hid");
    expect(computeCelularBadges(mk({ hidSG: 74, hidSG_ref: 73 }), true).badges.map((b) => b.id)).not.toContain("hid");
  });
  it("ECM_BCM > 1.4 -> dispara en 1.5, NO en 1.3", () => {
    expect(computeCelularBadges(mk({ ECM_BCM: 1.5 }), true).badges.map((b) => b.id)).toContain("ecm");
    expect(computeCelularBadges(mk({ ECM_BCM: 1.3 }), true).badges.map((b) => b.id)).not.toContain("ecm");
  });
});

describe("computeCelularBadges: los TRES estados se distinguen", () => {
  it("datos presentes y ninguna alteracion -> dataAvailable=true, badges=[]", () => {
    const r = computeCelularBadges(mk({ AF: 7, MCA_dif: 0, hidSG: 75, hidSG_ref: 73, ECM_BCM: 1.0 }), true);
    expect(r.dataAvailable).toBe(true);
    expect(r.badges).toEqual([]);
  });
  it("sin ninguna columna celular -> dataAvailable=false (no se pudo evaluar), distinto de 'sin alteraciones'", () => {
    const r = computeCelularBadges(mk({}), true);
    expect(r.dataAvailable).toBe(false);
    expect(r.badges).toEqual([]);
    expect(r.notEvaluable).toEqual([]); // sin datos = "sin datos", no "sin referencia"
  });
});

describe("computeCelularBadges: no evaluable por falta de REFERENCIA (export corto, EA1)", () => {
  it("MCA e hidratacion quedan NO evaluables sin sus referencias; ECM/BCM si se evalua", () => {
    // Caso del export corto: hidSG y ECM/BCM derivados (presentes), pero sin MCA_dif ni hidSG_ref
    // (referencias pendientes de Gildardo). AF viene medido.
    const r = computeCelularBadges(mk({ AF: 7, hidSG: 68, ECM_BCM: 1.0 }), true);
    expect(r.dataAvailable).toBe(true);
    const notEval = r.notEvaluable.map((n) => n.id);
    expect(notEval).toContain("mca");
    expect(notEval).toContain("hid");
    // ECM/BCM SI es evaluable (aqui no dispara por estar en 1.0, pero se evaluo, no queda "no evaluable").
    expect(notEval).not.toContain("ecm");
  });

  it("con las referencias presentes, nada queda 'no evaluable'", () => {
    const r = computeCelularBadges(mk({ AF: 7, MCA_dif: 0, hidSG: 75, hidSG_ref: 73, ECM_BCM: 1.0 }), true);
    expect(r.notEvaluable).toEqual([]);
  });
});

// CANDADO de los umbrales inline contra el vigente (los tres que NO tienen clasificador: MCA_dif,
// hidSG, ECM/BCM; AF ya lo ancla cAF). Lee el bloque `celBadges` del vigente y verifica que los
// umbrales que porta la funcion siguen siendo los del archivo. Si Gildardo mueve uno, truena.
describe("CANDADO: los umbrales de las badges coinciden con el vigente", () => {
  const html = readFileSync("docs/entregas/gildardo-2026-07-30/ATLAS_v7.html", "utf8");
  it("el vigente sigue disparando con los mismos umbrales", () => {
    expect(html).toContain("_af_val<(sexoM_pn?6.5:6.0)");
    expect(html).toContain("_mca_dif<-1");
    expect(html).toContain("_hidSG<_hidSG_ref");
    expect(html).toContain("_ecm_bcm>1.4");
  });
  // El -1 de MCA_dif vive en DOS sitios: esta badge y el frozen (suplementacion de Zinc). Si Gildardo
  // lo cambia, los dos deben moverse juntos; este assert deja el segundo sitio anclado y visible.
  it("el -1 de MCA_dif tambien vive en el frozen (atlas-protocolo, suplementacion de Zinc)", () => {
    const frozen = readFileSync("src/clinical-engine/frozen/atlas-protocolo.js", "utf8");
    expect(frozen).toContain("MCA_dif||0) < -1");
  });
});
