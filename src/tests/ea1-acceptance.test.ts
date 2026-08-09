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
const { buildComposition } = await import("@/modules/diagnoses/data/composition-map");
const { buildBisRow } = await import("@/modules/clinical-pipeline/services/build-engine-input");
const { analizarDesdeBiody } = await import("@/clinical-engine/analysis");
const { computeCelularBadges } = await import("@/modules/treatment/data/celular-badges");

const SHORT_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "biody-bis-male-synthetic.xlsx",
);

// PRUEBA DE ACEPTACION DE EA1 (Santiago): importar el export CORTO del Biody BIS de punta a punta y
// confirmar los cuatro: (1) la tabla de Wang se llena, (2) el IEHH se emite, (3) el ISCM queda en null
// (por MCA_ref, pendiente de Gildardo), (4) las badges celulares: MCA e hidratacion NO evaluables
// (esperan las referencias), ECM/BCM SI se evalua. Corre sin BD: el writer se mockea para reconstruir
// lo que se habria persistido (medido + derivado), que es lo que leen la composicion, el motor y las badges.
describe("EA1 aceptacion: import corto -> composicion derivada -> Wang + IEHH + ISCM null + badges", () => {
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
    for (const lvl of comp.levels) for (const r of lvl.rows) rowByKey.set(r.key, r.value);
    // Estas filas de Wang NO venian en el export corto; ahora tienen valor (derivado). FFW no es una
    // fila de la tabla (es insumo de IEHH/hidSG): su presencia la prueba el IEHH en el test siguiente.
    for (const key of ["MCA", "protActiva", "hidSG"]) {
      expect(rowByKey.get(key), `fila ${key} de Wang`).toBeTypeOf("number");
    }
    expect(comp.hasDerivedValues).toBe(true);
    // AEC/MCA (ECW medido / MCA derivado) tambien se puede mostrar ahora.
    expect(comp.aecMca).toBeTypeOf("number");
  });

  it("(2) IEHH se emite y (3) ISCM queda en null (falta MCA_ref)", () => {
    const row = buildBisRow(persisted);
    const a = analizarDesdeBiody(row, "M", { icec: 60, edad: 40 });
    expect(a.indices.IEHH, "IEHH emitido").toBeTypeOf("number");
    expect(a.indices.ISCM, "ISCM en null por MCA_ref pendiente").toBeNull();
  });

  it("(4) badges: MCA e hidratacion no evaluables (referencia pendiente), ECM/BCM si se evalua", () => {
    const badges = computeCelularBadges(persisted, true);
    expect(badges.dataAvailable).toBe(true);
    const notEval = badges.notEvaluable.map((n) => n.id);
    expect(notEval).toContain("mca");
    expect(notEval).toContain("hid");
    expect(notEval).not.toContain("ecm"); // ECM/BCM se deriva -> es evaluable
  });
});
