import { describe, expect, it } from "vitest";

import {
  KNOWN_MOTOR_NAMES,
  resolveRecommendation,
  type RecommendationCatalogItem,
} from "@/modules/treatment/nutraceuticals-recommendation";

// Catalogo con la grafia del registro sanitario: las 10 canonicas. MULTI-CELL BASE, HEPA-DETOX y
// GUT-IMMUNE PRO con guion. MULTI-CELL BASE fue "MULTICELL BASE" hasta el 2026-09-13 (migracion 0137): el
// registro RSA-3987-2026 lleva guion. Ahora la grafia MINORITARIA del motor (sin guion) es la que no
// empareja directo, y por eso el alias sigue siendo imprescindible, al reves que antes.
const NAMES = [
  "OMEGA COMPLEX", "MULTI-CELL BASE", "CURCUMIN BIOACTIV", "D3-K2 OSTEO", "BERBERINA METABO",
  "MITO-Q10 PLUS", "HEPA-DETOX", "ADAPTO-STRESS", "SARCO-PROTECT", "GUT-IMMUNE PRO",
];
const CATALOG: RecommendationCatalogItem[] = NAMES.map((name, i) => ({
  id: `id-${i}`,
  name,
  indication: `indicacion ${name}`,
  commercialAvailability: i < 4 ? "en_consultorio" : "solo_tienda",
}));
const byName = (n: string) => CATALOG.find((c) => c.name === n)!;

describe("resolveRecommendation: emparejamiento con alias explicito", () => {
  it("null o vacio -> lista vacia", () => {
    expect(resolveRecommendation(null, CATALOG)).toEqual([]);
    expect(resolveRecommendation("   ", CATALOG)).toEqual([]);
  });

  it("preserva el orden del string del motor (prioridad implicita)", () => {
    const r = resolveRecommendation("OMEGA COMPLEX, MITO-Q10 PLUS", CATALOG);
    expect(r.map((x) => (x.status === "en_catalogo" ? x.product.name : x.motorName))).toEqual([
      "OMEGA COMPLEX",
      "MITO-Q10 PLUS",
    ]);
    expect(r.every((x) => x.status === "en_catalogo")).toBe(true);
  });

  it("resuelve las 3 grafias inconsistentes del motor via alias, a la grafia del catalogo", () => {
    // Desde la 0137 el catalogo lleva guion: la dominante del motor empareja directo y la minoritaria (sin
    // guion) necesita el alias.
    const cases: [string, string][] = [
      ["MULTI-CELL BASE", "MULTI-CELL BASE"], // motor dominante (con guion) -> directo
      ["MULTICELL BASE", "MULTI-CELL BASE"], // motor minoritario (sin guion) -> alias
      ["HEPA DETOX", "HEPA-DETOX"],
      ["GUTIMMUNE PRO", "GUT-IMMUNE PRO"],
    ];
    for (const [motor, canonical] of cases) {
      const [r] = resolveRecommendation(motor, CATALOG);
      expect(r.status, `${motor} debe emparejar`).toBe("en_catalogo");
      if (r.status === "en_catalogo") expect(r.product).toEqual(byName(canonical));
    }
  });

  it("un producto que el modelo recomienda pero no existe en el catalogo -> no_en_catalogo (visible)", () => {
    const [r] = resolveRecommendation("NUTRA-FUTURO 2027", CATALOG);
    expect(r.status).toBe("no_en_catalogo");
    if (r.status === "no_en_catalogo") expect(r.motorName).toBe("NUTRA-FUTURO 2027");
  });

  it("mezcla: emparejados y no-en-catalogo conviven en la misma lista", () => {
    const r = resolveRecommendation("OMEGA COMPLEX, INEXISTENTE, HEPA DETOX", CATALOG);
    expect(r.map((x) => x.status)).toEqual(["en_catalogo", "no_en_catalogo", "en_catalogo"]);
  });
});

describe("CANDADO: cada nombre que el motor puede emitir resuelve a un producto del catalogo", () => {
  // Si el catalogo se renombra o falta un alias, esto truena en CI en vez de fallar en silencio (un
  // recomendado que desaparece de la pantalla). Cubre las 13 grafias conocidas (Q31).
  for (const motorName of KNOWN_MOTOR_NAMES) {
    it(`"${motorName}" empareja con el catalogo`, () => {
      const [r] = resolveRecommendation(motorName, CATALOG);
      expect(r.status, `"${motorName}" no empareja: falta alias o el catalogo lo renombro`).toBe(
        "en_catalogo",
      );
    });
  }
});
