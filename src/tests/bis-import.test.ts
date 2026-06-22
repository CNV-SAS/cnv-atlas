import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only no aplica en el test; el writer se mockea para no tocar la BD.
vi.mock("server-only", () => ({}));

// El error de reimport se define DENTRO del factory (hoisting) y se referencia desde
// el modulo mockeado, igual que en B7, para que instanceof funcione en el servicio.
vi.mock("@/modules/bis/data/bis-writer", () => {
  class BisAlreadyImportedError extends Error {
    constructor(public readonly evaluationId: string) {
      super(`dup ${evaluationId}`);
      this.name = "BisAlreadyImportedError";
    }
  }
  return {
    BisAlreadyImportedError,
    writeBisMeasurement: vi.fn(),
    logBisImportFailure: vi.fn(),
  };
});

const writer = await import("@/modules/bis/data/bis-writer");
const { importBisMeasurement } = await import("@/modules/bis/services/bis-import");

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "biody_synthetic.xlsx");

async function tooFewColumnsBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Measures");
  ws.addRow(["Measurement date ", "Peso kg"]);
  ws.addRow(["12-04-2026 19:18", 70]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const baseInput = {
  evaluationId: "11111111-1111-1111-1111-111111111111",
  deviceId: null,
  actorId: "22222222-2222-2222-2222-222222222222",
  actorEmail: "pro@cnv",
  ip: null,
};

describe("importBisMeasurement (orquestacion)", () => {
  beforeEach(() => {
    vi.mocked(writer.writeBisMeasurement).mockReset();
    vi.mocked(writer.logBisImportFailure).mockReset();
  });

  it("exito: parsea, valida y persiste; no registra fallo", async () => {
    vi.mocked(writer.writeBisMeasurement).mockResolvedValue({
      measurementId: "meas-1",
      valueCount: 120,
    });
    const buffer = await readFile(FIXTURE);
    const res = await importBisMeasurement({ ...baseInput, buffer });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.measurementId).toBe("meas-1");
    expect(writer.logBisImportFailure).not.toHaveBeenCalled();
    // el writer recibe la fecha parseada y una lista de valores
    const arg = vi.mocked(writer.writeBisMeasurement).mock.calls[0][0];
    expect(arg.measurementDate).toBeInstanceOf(Date);
    expect(arg.values.length).toBeGreaterThan(10);
  });

  it("archivo no XLSX: parse_failed y no persiste", async () => {
    const res = await importBisMeasurement({ ...baseInput, buffer: Buffer.from("no soy xlsx") });
    expect(res.ok).toBe(false);
    expect(writer.writeBisMeasurement).not.toHaveBeenCalled();
    expect(writer.logBisImportFailure).toHaveBeenCalledWith(
      expect.objectContaining({ status: "parse_failed", evaluationId: baseInput.evaluationId }),
    );
  });

  it("datos invalidos: validation_failed con detalle y no persiste", async () => {
    const res = await importBisMeasurement({ ...baseInput, buffer: await tooFewColumnsBuffer() });
    expect(res.ok).toBe(false);
    expect(writer.writeBisMeasurement).not.toHaveBeenCalled();
    const call = vi.mocked(writer.logBisImportFailure).mock.calls[0][0];
    expect(call.status).toBe("validation_failed");
    expect(call.errorDetail.length).toBeGreaterThan(0);
  });

  it("reimport: mapea BisAlreadyImportedError a conflicto, sin fila de log", async () => {
    vi.mocked(writer.writeBisMeasurement).mockRejectedValue(
      new writer.BisAlreadyImportedError(baseInput.evaluationId),
    );
    const buffer = await readFile(FIXTURE);
    const res = await importBisMeasurement({ ...baseInput, buffer });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("conflict");
    expect(writer.logBisImportFailure).not.toHaveBeenCalled();
  });
});
