import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok as okResult } from "@/core/errors";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/reports/services/render-report", () => ({
  renderReportPdf: vi.fn(async () => Buffer.from("%PDF-fake")),
}));
vi.mock("@/modules/reports/data/reports-repository", () => ({
  getReportDispatch: vi.fn(),
}));
vi.mock("@/modules/reports/data/report-storage", () => ({
  uploadReportPdf: vi.fn(),
}));
vi.mock("@/lib/email/resend", () => ({
  sendReportEmail: vi.fn(),
}));
vi.mock("@/modules/reports/data/reports-writer", () => {
  class ReportStateError extends Error {}
  return { ReportStateError, markReportSent: vi.fn() };
});

const repo = await import("@/modules/reports/data/reports-repository");
const storage = await import("@/modules/reports/data/report-storage");
const email = await import("@/lib/email/resend");
const writer = await import("@/modules/reports/data/reports-writer");
const { sendReport } = await import("@/modules/reports/services/send-report");

function dispatch(over: Record<string, unknown> = {}) {
  return {
    reportId: "rep-1",
    evaluationId: "ev-1",
    patientId: "pat-1",
    status: "approved",
    snapshot: { versions: { engine: "stub-0.1.0" } },
    storagePath: null,
    patientName: "Ana",
    documentLabel: "CC 1",
    email: "ana@example.com",
    evaluationDate: "2026-04-12T00:00:00Z",
    ...over,
  };
}

const input = { reportId: "rep-1", actorId: "u-1", actorEmail: "pro@cnv", ip: null };

describe("sendReport (orquestacion D4)", () => {
  beforeEach(() => {
    vi.mocked(storage.uploadReportPdf).mockReset().mockResolvedValue({ path: "pat-1/rep-1.pdf" });
    vi.mocked(email.sendReportEmail).mockReset().mockResolvedValue(okResult({ id: "email-1" }));
    vi.mocked(writer.markReportSent).mockReset().mockResolvedValue(undefined);
    vi.mocked(repo.getReportDispatch).mockReset().mockResolvedValue(dispatch());
  });

  it("orden: sube a Storage, luego envia correo, luego marca enviado", async () => {
    const res = await sendReport(input);
    expect(res.ok).toBe(true);
    // orden de invocacion
    const up = vi.mocked(storage.uploadReportPdf).mock.invocationCallOrder[0];
    const send = vi.mocked(email.sendReportEmail).mock.invocationCallOrder[0];
    const mark = vi.mocked(writer.markReportSent).mock.invocationCallOrder[0];
    expect(up).toBeLessThan(send);
    expect(send).toBeLessThan(mark);
    // marca enviado con el path subido
    expect(vi.mocked(writer.markReportSent).mock.calls[0][0]).toMatchObject({
      reportId: "rep-1",
      storagePath: "pat-1/rep-1.pdf",
    });
  });

  it("si el correo falla, NO marca enviado (reintentable)", async () => {
    vi.mocked(email.sendReportEmail).mockResolvedValue({
      ok: false,
      error: { code: "internal", message: "Resend cayo" },
    });
    const res = await sendReport(input);
    expect(res.ok).toBe(false);
    expect(writer.markReportSent).not.toHaveBeenCalled();
  });

  it("si la subida falla, NO envia correo", async () => {
    vi.mocked(storage.uploadReportPdf).mockResolvedValue(null);
    const res = await sendReport(input);
    expect(res.ok).toBe(false);
    expect(email.sendReportEmail).not.toHaveBeenCalled();
    expect(writer.markReportSent).not.toHaveBeenCalled();
  });

  it("rechaza si el reporte no esta aprobado", async () => {
    vi.mocked(repo.getReportDispatch).mockResolvedValue(dispatch({ status: "draft" }));
    const res = await sendReport(input);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("conflict");
    expect(storage.uploadReportPdf).not.toHaveBeenCalled();
  });

  it("rechaza si el paciente no tiene correo", async () => {
    vi.mocked(repo.getReportDispatch).mockResolvedValue(dispatch({ email: null }));
    const res = await sendReport(input);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("validation");
    expect(storage.uploadReportPdf).not.toHaveBeenCalled();
  });
});
