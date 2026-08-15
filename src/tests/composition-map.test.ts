import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BIODY_COLUMNS } from "@/clinical-engine";
import { buildComposition, clasificarAecMca } from "@/modules/diagnoses/data/composition-map";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// Candado del mapeo de circunferencias. Un bug real (2026-07-24) hacia que `cintura` leyera la
// columna de UMBRAL de referencia ("Patient risk monitoring Waist Size ... referencia cm" = 102 cm,
// el corte OMS masculino) en vez de la MEDIDA ("Waist Size cm" = 98). Como el badge de riesgo CV se
// calcula sobre ese valor, cada hombre se comparaba contra su propio umbral (102 vs 102) -> "Riesgo
// CV elevado" SIEMPRE: falso positivo clinico sistematico. Este test lo ancla contra el export real.

// Crudos como los persiste el import: variable_name = normalizeHeader(header del export).
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/clinical-engine/biody-juan-esteban-anon.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

const raw: Record<string, number> = {};
for (const [k, v] of Object.entries(fixture)) {
  if (typeof v === "number") raw[normalizeHeader(k)] = v;
}

describe("buildComposition: mapeo de cintura/cadera (candado del falso positivo CV)", () => {
  const comp = buildComposition(raw, "2026-07-11T15:52:00+00:00");

  it("cintura lee la circunferencia MEDIDA (Waist Size cm = 98), no el umbral", () => {
    expect(comp.cintura).toBe(98);
    // Guarda explicita: NUNCA el umbral de referencia (102). Si alguien vuelve a apuntar el mapeo a
    // "Patient risk monitoring Waist Size ... referencia cm", este assert falla.
    expect(comp.cintura).not.toBe(102);
  });

  it("cadera lee la circunferencia MEDIDA (Hips Size cm = 105)", () => {
    expect(comp.cadera).toBe(105);
  });

  it("la fila Cintura de la tabla tambien usa la MEDIDA, no el umbral", () => {
    const nivelV = comp.levels.find((l) => l.title.includes("Cuerpo entero"));
    const filaCintura = nivelV?.rows.find((r) => r.key === "cintura");
    expect(filaCintura?.value).toBe(98);
    expect(filaCintura?.value).not.toBe(102);
  });

  it("el umbral de referencia (102) SI esta en los crudos: el bug era de lectura, no de datos", () => {
    // Ambas columnas se persisten; el bug era elegir la de referencia. Documenta que 102 existe.
    expect(raw[normalizeHeader("Patient risk monitoring Waist Size  measurementDetails.REFERENCEESTIMEEEXPORT cm")]).toBe(102);
  });

  // Estos asserts NO prueban que Atlas calcule los ratios (no los calcula, los LEE del export).
  // Prueban que los ratios LEIDOS son coherentes con la cintura MEDIDA (98), no con el umbral (102):
  // 102/105=0.971 y 102/180=0.567 fallarian. Ancla anti-mismapeo, no de calculo (misma disciplina
  // que las brechas declaradas de GOLDEN 1).
  it("ICC/ICT leidos son coherentes con la cintura MEDIDA (98), no el umbral (102)", () => {
    expect(comp.icc).toBeCloseTo(98 / 105, 2); // 0.933
    expect(comp.ict).toBeCloseTo(98 / 180, 2); // 0.544
  });

  it("BIODY_COLUMNS ya no mapea cintura (candado de la trampa latente removida)", () => {
    // Su importarComposicion la mapea al umbral de referencia (verificado en ATLAS_v7.html:5617);
    // Atlas la deja fuera a proposito. Si alguien la re-agrega, este candado cae.
    expect(BIODY_COLUMNS.cintura).toBeUndefined();
  });

  // C12: AEC/MCA = ECW/MCA (ATLAS_v7.html:5696), fila de Nivel III con referencia = corte 0.45.
  it("AEC/MCA: ratio ECW/MCA desde los valores MEDIDOS (VALEURCALCULEE), no umbrales", () => {
    const ecw = raw[normalizeHeader(BIODY_COLUMNS.ECW.header)];
    const mca = raw[normalizeHeader(BIODY_COLUMNS.MCA.header)];
    expect(ecw).toBeGreaterThan(0);
    expect(mca).toBeGreaterThan(0);
    expect(comp.aecMca).toBeCloseTo(ecw / mca, 3);
    const nivelIII = comp.levels.find((l) => l.title.includes("Celular"));
    const fila = nivelIII?.rows.find((r) => r.key === "aec_mca");
    expect(fila?.value).toBe(comp.aecMca);
    expect(fila?.reference).toBe(0.45); // corte, no referencia del dispositivo
    expect(fila?.referenceLabel).toBe("<0.45");
  });

  it("clasificarAecMca: cortes verbatim 0.45/0.55 (12734)", () => {
    expect(clasificarAecMca(0.4)?.label).toBe("Óptimo");
    expect(clasificarAecMca(0.5)?.label).toBe("Alerta"); // CA-2: valor 0.50 -> Alerta, Δ +0.05 (contra 0.45)
    expect(clasificarAecMca(0.6)?.label).toBe("Riesgo");
    expect(clasificarAecMca(0.45)?.label).toBe("Alerta"); // 0.45 no es < 0.45
    expect(clasificarAecMca(null)).toBeNull();
  });
});

// Candado de las filas nuevas de la tabla de Wang (cotejo j: "van todas las filas"). Ancla que estan
// presentes, que cadera/FFW tienen su tratamiento especial, y que el desglose de agua e impedancias van
// marcados como DETALLE (colapsable). Si un bump del mapeo las quita o cambia su grupo, este test cae.
describe("buildComposition: filas nuevas y grupos de detalle (cotejo j)", () => {
  const comp = buildComposition(raw, null);
  const allRows = comp.levels.flatMap((l) => l.rows);
  const byKey = (k: string) => allRows.find((r) => r.key === k);

  it("Cadera es una fila del Nivel V con la circunferencia MEDIDA", () => {
    const nivelV = comp.levels.find((l) => l.title.includes("Cuerpo entero"));
    const cadera = nivelV?.rows.find((r) => r.key === "cadera");
    expect(cadera).toBeDefined();
    expect(cadera?.value).toBe(comp.cadera);
  });

  it("FFW: la referencia se computa FFW - FFW_dif (no hay columna _ref)", () => {
    const ffw = byKey("FFW");
    expect(ffw).toBeDefined();
    const ffwVal = raw[normalizeHeader(BIODY_COLUMNS.FFW.header)];
    const ffwDif = raw[normalizeHeader(BIODY_COLUMNS.FFW_dif.header)];
    if (ffwVal != null && ffwDif != null) {
      expect(ffw?.reference).toBeCloseTo(ffwVal - ffwDif, 5);
    }
  });

  it("el desglose de agua va marcado como detalle 'agua'; las principales no", () => {
    expect(byKey("ECW_sg_pct")?.detail).toBe("agua");
    expect(byKey("ICW_sg")?.detail).toBe("agua");
    expect(byKey("ECW")?.detail).toBeUndefined(); // AEC con grasa (L) es principal
  });

  it("las impedancias/Cole-Cole crudos van como detalle 'bioelectrico'; el AF es principal", () => {
    expect(byKey("Z50")?.detail).toBe("bioelectrico");
    expect(byKey("Fo")?.detail).toBe("bioelectrico");
    expect(byKey("AF")?.detail).toBeUndefined(); // el angulo de fase es el marcador clinico, visible
  });
});
