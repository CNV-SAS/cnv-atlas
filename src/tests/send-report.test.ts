import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok as okResult } from "@/core/errors";
import type { ReportDispatch } from "@/modules/reports/data/reports-repository";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/reports/services/render-report", () => ({
  renderReportPdf: vi.fn(async () => Buffer.from("%PDF-fake")),
}));
vi.mock("@/modules/reports/data/reports-repository", () => ({
  getReportDispatch: vi.fn(),
}));
// El PLAN del paciente (Gildardo §7.1) lo lee `sendReport` de la BD. Se mockea como el resto de la
// cadena: este test es de ORQUESTACION (que el orden de los pasos sea el correcto y que un fallo no marque
// enviado), no del contenido del documento. El contenido lo cubre `report-render`.
vi.mock("@/modules/reports/data/plan-paciente-reader", () => ({
  getPlanPaciente: vi.fn(async () => null),
}));
// EL GATE DE EMISION (2026-09-01): el protocolo tiene que estar aprobado para que el reporte salga. Se
// mockea aprobado por defecto, y hay un caso propio abajo para el borrador: si no se mockeara, TODOS los
// casos de orquestacion se caerian por el gate y el test diria que el orden de los pasos esta mal.
vi.mock("@/modules/treatment/data/treatment-reader", () => ({
  getProtocolApprovalState: vi.fn(async () => ({ approved: true })),
}));
vi.mock("@/modules/reports/data/report-storage", () => ({
  uploadReportPdf: vi.fn(),
}));
vi.mock("@/lib/email/resend", () => ({
  sendReportEmail: vi.fn(),
}));
vi.mock("@/modules/reports/data/reports-writer", () => {
  class ReportStateError extends Error {}
  return { ReportStateError, markReportSent: vi.fn(), markReportResent: vi.fn() };
});

const repo = await import("@/modules/reports/data/reports-repository");
const storage = await import("@/modules/reports/data/report-storage");
const email = await import("@/lib/email/resend");
const writer = await import("@/modules/reports/data/reports-writer");
const treatmentReader = await import("@/modules/treatment/data/treatment-reader");
const { sendReport, resendReport } = await import("@/modules/reports/services/send-report");

function dispatch(over: Partial<ReportDispatch> = {}): ReportDispatch {
  return {
    reportId: "rep-1",
    evaluationId: "ev-1",
    patientId: "pat-1",
    status: "approved",
    // snapshot parcial: sendReport solo se lo pasa a renderReportPdf, que esta mockeado.
    snapshot: { versions: { engine: "anibise-1.0.0" } } as unknown as ReportDispatch["snapshot"],
    professionalNotes: null,
    sendMode: null,
    storagePath: null,
    patientName: "Ana",
    documentLabel: "CC 1",
    email: "ana@example.com",
    evaluationDate: "2026-04-12T00:00:00Z",
  consultationDate: "2026-04-10T00:00:00Z",
    patientBandText: null,
    patientBandAppointmentDate: null,
    ...over,
  };
}

const baseInput = () => ({ ...input });

const input = {
  reportId: "rep-1",
  mode: "atlas" as const,
  actorId: "u-1",
  actorEmail: "pro@cnv",
  ip: null,
};

describe("sendReport (orquestacion D4)", () => {
  beforeEach(() => {
    vi.mocked(storage.uploadReportPdf).mockReset().mockResolvedValue({ path: "pat-1/rep-1.pdf" });
    vi.mocked(email.sendReportEmail).mockReset().mockResolvedValue(okResult({ id: "email-1" }));
    vi.mocked(writer.markReportSent).mockReset().mockResolvedValue(undefined);
    vi.mocked(repo.getReportDispatch).mockReset().mockResolvedValue(dispatch());
    vi.mocked(writer.markReportResent).mockReset().mockResolvedValue({ attempt: 1 });
    vi.mocked(treatmentReader.getProtocolApprovalState)
      .mockReset()
      .mockResolvedValue({ approved: true });
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
    // marca enviado con el path subido y el modo elegido (trazabilidad).
    expect(vi.mocked(writer.markReportSent).mock.calls[0][0]).toMatchObject({
      reportId: "rep-1",
      storagePath: "pat-1/rep-1.pdf",
      sendMode: "atlas",
    });
  });

  it("bloquea el envio si el modo incluye notas y no hay notas escritas", async () => {
    for (const mode of ["notas", "ambos"] as const) {
      vi.mocked(repo.getReportDispatch).mockResolvedValue(dispatch({ professionalNotes: null }));
      const res = await sendReport({ ...input, mode });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe("validation");
      expect(storage.uploadReportPdf).not.toHaveBeenCalled();
    }
  });

  it("permite modo 'ambos' cuando hay notas, y sella el modo", async () => {
    vi.mocked(repo.getReportDispatch).mockResolvedValue(
      dispatch({ professionalNotes: "Interpretacion del profesional." }),
    );
    const res = await sendReport({ ...input, mode: "ambos" });
    expect(res.ok).toBe(true);
    expect(vi.mocked(writer.markReportSent).mock.calls[0][0]).toMatchObject({ sendMode: "ambos" });
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

// ── EL GATE DE EMISION: la prescripcion tiene que estar aprobada ────────────────────────────────────
//
// LA RAZON QUE DECIDE (Santiago, 2026-09-01), y no es la simetria con el reporte: un plan emitido desde el
// BORRADOR no es RECONSTRUIBLE. Los `adj_*` se pueden mover despues de enviarlo y nadie sabra que recibio
// el paciente. Con el protocolo aprobado, el trigger 0026 lo congela.
//
// Y NO ES UNA REGLA NUEVA: el comentario de `sendReport` ya AFIRMABA que "el tratamiento ya esta aprobado
// cuando el reporte se envia (el gate de arriba lo exige)", y era falso: ese gate mira el estado del
// REPORTE. El codigo ya suponia lo que ahora se comprueba.
describe("gate de emision: el protocolo aprobado", () => {
  beforeEach(() => {
    vi.mocked(storage.uploadReportPdf).mockReset().mockResolvedValue({ path: "pat-1/rep-1.pdf" });
    vi.mocked(email.sendReportEmail).mockReset().mockResolvedValue(okResult({ id: "email-1" }));
    vi.mocked(writer.markReportSent).mockReset().mockResolvedValue(undefined);
    vi.mocked(repo.getReportDispatch).mockReset().mockResolvedValue(dispatch());
    vi.mocked(treatmentReader.getProtocolApprovalState)
      .mockReset()
      .mockResolvedValue({ approved: true });
  });

  it("con la prescripcion en BORRADOR no se envia, y NO se toca nada externo", async () => {
    // Lo que mas importa del caso: no basta con que devuelva error. Si el PDF se hubiera subido o el
    // correo hubiera salido, el gate llegaria tarde.
    vi.mocked(treatmentReader.getProtocolApprovalState).mockResolvedValueOnce({ approved: false });
    const r = await sendReport(baseInput());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("conflict");
      // EL MENSAJE TIENE QUE SER UTIL: que hacer y donde, no un error generico.
      expect(r.error.message).toContain("aprobar la prescripción");
      expect(r.error.message).toContain("Tratamiento");
    }
    expect(storage.uploadReportPdf).not.toHaveBeenCalled();
    expect(email.sendReportEmail).not.toHaveBeenCalled();
    expect(writer.markReportSent).not.toHaveBeenCalled();
  });

  it("y con la prescripcion aprobada sale, que es el control", async () => {
    // Sin este control, el caso de arriba pasaria verde tambien con un `sendReport` que nunca envia nada.
    vi.mocked(treatmentReader.getProtocolApprovalState).mockResolvedValueOnce({ approved: true });
    const r = await sendReport(baseInput());
    expect(r.ok).toBe(true);
    expect(email.sendReportEmail).toHaveBeenCalledTimes(1);
  });

  it("una evaluacion SIN tratamiento no se bloquea: no hay prescripcion que aprobar", async () => {
    // Ausencia contra fila vacia. `null` = no hay tratamiento (el PDF omite el plan entero, que ya estaba
    // resuelto); `{approved:false}` = hay una prescripcion viva sin firmar, que es lo que se frena.
    vi.mocked(treatmentReader.getProtocolApprovalState).mockResolvedValueOnce(null);
    const r = await sendReport(baseInput());
    expect(r.ok).toBe(true);
  });
});

describe("el REENVIO no lleva el gate, a proposito", () => {
  beforeEach(() => {
    vi.mocked(storage.uploadReportPdf).mockReset().mockResolvedValue({ path: "pat-1/rep-1.pdf" });
    vi.mocked(email.sendReportEmail).mockReset().mockResolvedValue(okResult({ id: "email-1" }));
    vi.mocked(writer.markReportResent).mockReset().mockResolvedValue({ attempt: 1 });
    vi.mocked(treatmentReader.getProtocolApprovalState).mockReset();
  });

  it("reenvia aunque la prescripcion este en borrador", async () => {
    // Un paciente que ya tiene su plan no puede quedarse sin poder recibirlo otra vez porque hoy pidamos
    // una firma que cuando se emitio no existia. `resendReport` reenvia el archivo que YA salio de la
    // clinica: no rearma nada, asi que no hay prescripcion nueva que firmar.
    vi.mocked(repo.getReportDispatch).mockResolvedValue({ ...dispatch(), status: "sent", sendMode: "atlas" });
    vi.mocked(treatmentReader.getProtocolApprovalState).mockResolvedValue({ approved: false });
    const r = await resendReport({
      reportId: "rep-1",
      reason: "el correo rebotó",
      actorId: "u-1",
      actorEmail: "pro@cnv.test",
      ip: null,
    });
    expect(r.ok, "el reenvio quedo bloqueado por el gate de emision").toBe(true);
    expect(treatmentReader.getProtocolApprovalState).not.toHaveBeenCalled();
  });
});
