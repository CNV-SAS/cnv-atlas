import { describe, expect, it } from "vitest";

import {
  KNOWN_MOTOR_NAMES,
  resolveRecommendation,
  type RecommendationCatalogItem,
} from "@/modules/treatment/nutraceuticals-recommendation";

// Catalogo con la grafia INVIMA (la del seed): las 10 canonicas. MULTICELL BASE sin guion, HEPA-DETOX y
// GUT-IMMUNE PRO con guion (la grafia dominante del motor para MultiCell lleva guion y NO empareja
// directo: por eso el alias es imprescindible).
const NAMES = [
  "OMEGA COMPLEX", "MULTICELL BASE", "CURCUMIN BIOACTIV", "D3-K2 OSTEO", "BERBERINA METABO",
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
    // La DOMINANTE del motor para MultiCell lleva guion y el catalogo no: sin alias no emparejaria.
    const cases: [string, string][] = [
      ["MULTI-CELL BASE", "MULTICELL BASE"], // motor dominante (con guion) -> catalogo (sin)
      ["MULTICELL BASE", "MULTICELL BASE"], // motor minoritario (sin guion) -> directo
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
