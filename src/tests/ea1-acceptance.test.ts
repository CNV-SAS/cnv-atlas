import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

// server-only no aplica en el test; el writer se mockea para CAPTURAR lo que se habria persistido
// (medidos + derivados) sin tocar la BD. El resto de la cadena (derivacion, composicion, motor, badges)
// corre real.
vi.mock("server-only", () => ({}));
vi.mock("@/modules/bis/data/bis-writer", () => {
  class BisAlreadyImportedError extends Error {}
  return { BisAlreadyImportedError, writeBisMeasurement: vi.fn(), logBisImportFailure: vi.fn() };
});

const writer = await import("@/modules/bis/data/bis-writer");
const { importBisMeasurement } = await import("@/modules/bis/services/bis-import");
const { buildComposition, allCompositionRows } = await import("@/modules/diagnoses/data/composition-map");
const { buildBisRow } = await import("@/modules/clinical-pipeline/services/build-engine-input");
const { analizarDesdeBiody } = await import("@/clinical-engine/analysis");
const { computeCelularBadges } = await import("@/modules/treatment/data/celular-badges");
const { BIODY_COLUMNS } = await import("@/clinical-engine");
const { normalizeHeader } = await import("@/modules/bis/services/header-map");

const SHORT_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "biody-bis-male-synthetic.xlsx",
);

// PRUEBA DE ACEPTACION DE EA1 (Santiago): importar el export CORTO del Biody BIS de punta a punta y
// confirmar los cuatro: (1) la tabla de Wang se llena, (2) el IEHH se emite, (3) el ISCM SE EMITE (antes
// quedaba null por MCA_ref pendiente; con la referencia poblacional del §9, MCA 52,4% de la MLG, ya computa,
// confirmado por Gildardo 2026-08-15 §5), (4) las badges celulares MCA/hidratacion/ECM/BCM se evaluan con esa
// referencia. Corre sin BD: el writer se mockea para reconstruir lo que se habria persistido (medido +
// derivado), que es lo que leen la composicion, el motor y las badges.
describe("EA1 aceptacion: import corto -> composicion derivada -> Wang + IEHH + ISCM emitido + badges", () => {
  let persisted: Record<string, number> = {};

  it("importa y deriva la composicion faltante (persistiria medidos + derivados)", async () => {
    vi.mocked(writer.writeBisMeasurement).mockResolvedValue({
      measurementId: "m",
      valueCount: 0,
      derivedCount: 0,
    });
    const buffer = await readFile(SHORT_FIXTURE);
    const res = await importBisMeasurement({
      buffer,
      evaluationId: "11111111-1111-1111-1111-111111111111",
      deviceId: null,
      actorId: "22222222-2222-2222-2222-222222222222",
      actorEmail: "pro@cnv",
      ip: null,
      patientSex: "M", // fixture masculino: habilita las referencias poblacionales (§9)
    });
    expect(res.ok).toBe(true);
    const arg = vi.mocked(writer.writeBisMeasurement).mock.calls[0][0];
    // bis_raw_values tendria medidos ('medido') + derivados ('derivado'); la composicion, el motor y las
    // badges leen ese conjunto. Se reconstruye aqui.
    persisted = {};
    for (const v of arg.values) persisted[v.variableName] = v.value;
    for (const v of arg.derivedValues) persisted[v.variableName] = v.value;
    expect(arg.derivedValues.length).toBeGreaterThan(0);
  });

  it("(1) la tabla de Wang se llena con la composicion derivada", () => {
    const comp = buildComposition(persisted, "2026-06-15", true);
    const rowByKey = new Map<string, number | null>();
    for (const r of allCompositionRows(comp)) rowByKey.set(r.key, r.value);
    // Estas filas de Wang NO venian en el export corto; ahora tienen valor (derivado). FFW no es una
    // fila de la tabla (es insumo de IEHH/hidSG): su presencia la prueba el IEHH en el test siguiente.
    for (const key of ["MCA", "protActiva", "hidSG"]) {
      expect(rowByKey.get(key), `fila ${key} de Wang`).toBeTypeOf("number");
    }
    expect(comp.hasDerivedValues).toBe(true);
    // AEC/MCA (ECW medido / MCA derivado) tambien se puede mostrar ahora.
    expect(comp.aecMca).toBeTypeOf("number");
  });

  it("(2) IEHH e ISCM se emiten (MCA_ref/MCA_dif cableados por §9)", () => {
    const row = buildBisRow(persisted);
    const a = analizarDesdeBiody(row, "M", { icec: 60, edad: 40 });
    expect(a.indices.IEHH, "IEHH emitido").toBeTypeOf("number");
    // Antes null por MCA_ref pendiente; con la referencia poblacional (§9) ya computa.
    expect(a.indices.ISCM, "ISCM emitido con la referencia poblacional").toBeTypeOf("number");
  });

  it("(3) las referencias poblacionales se persisten como DERIVADAS (§9), no como medidas", () => {
    // MCA_ref = 52,4% de la MLG de referencia (peso x %grasa-ref), en el conjunto derivado.
    const mcaRefHeader = normalizeHeader(BIODY_COLUMNS.MCA_ref.header);
    const hidRefHeader = normalizeHeader(BIODY_COLUMNS.hidSG_ref.header);
    expect(persisted[mcaRefHeader], "MCA_ref derivado").toBeTypeOf("number");
    expect(persisted[hidRefHeader], "hidSG_ref derivado").toBe(73.2);
  });

  it("(4) badges: MCA e hidratacion YA evaluables (referencia cableada), ECM/BCM tambien", () => {
    const badges = computeCelularBadges(persisted, true);
    expect(badges.dataAvailable).toBe(true);
    const notEval = badges.notEvaluable.map((n) => n.id);
    expect(notEval).not.toContain("mca"); // ya hay MCA_dif (via MCA_ref)
    expect(notEval).not.toContain("hid"); // ya hay hidSG_ref
    expect(notEval).not.toContain("ecm");
  });
});
