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
// EL SERVICIO DE TRATAMIENTO, mockeado desde el 2026-09-09: enviar ya no EXIGE la aprobacion, la HACE.
vi.mock("@/modules/treatment/services/treatment-service", () => ({
  emitirPrescripcion: vi.fn(async () => ({ ok: true, value: undefined })),
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
const treatmentService = await import("@/modules/treatment/services/treatment-service");
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
    vi.mocked(treatmentService.emitirPrescripcion)
      .mockReset()
      .mockResolvedValue({ ok: true, value: undefined });
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

// ── ENVIAR ES ENTREGAR: el envio deja constancia de lo que salio ────────────────────────────────────
//
// LA RAZON QUE DECIDE (Santiago, 2026-09-01), y sigue siendo la misma tres cambios despues: un plan
// emitido sin dejar copia no es RECONSTRUIBLE. Los `adj_*` se pueden mover despues de enviarlo y nadie
// sabra que recibio el paciente.
//
// COMO SE HA RESUELTO ESA REGLA, EN TRES PASOS, porque explica por que el disenio actual no es un
// descuido:
//   1. Se EXIGIA la aprobacion previa, y se mandaba al profesional a otra pestaña a pulsar un boton.
//   2. El envio la HACIA, en el mismo acto (2026-09-09).
//   3. Ahora el envio EMITE: guarda una copia inmutable de lo que salio y NO cierra la prescripcion.
//      Aprobar sellaba y cerraba; solo la primera mitad hacia falta, y el cierre era lo que obligaba a
//      reabrir con motivo para corregir una coma.
//
// LO QUE SE BLINDA AQUI ES LO MISMO DESDE EL PASO 1: que no salga un plan del que no quede constancia.
describe("enviar el reporte deja constancia de la entrega", () => {
  beforeEach(() => {
    vi.mocked(storage.uploadReportPdf).mockReset().mockResolvedValue({ path: "pat-1/rep-1.pdf" });
    vi.mocked(email.sendReportEmail).mockReset().mockResolvedValue(okResult({ id: "email-1" }));
    vi.mocked(writer.markReportSent).mockReset().mockResolvedValue(undefined);
    vi.mocked(repo.getReportDispatch).mockReset().mockResolvedValue(dispatch());
    vi.mocked(treatmentService.emitirPrescripcion)
      .mockReset()
      .mockResolvedValue({ ok: true, value: undefined });
  });

  it("enviar registra la emision, y por la via 'correo'", async () => {
    const r = await sendReport(baseInput());
    expect(r.ok).toBe(true);
    expect(treatmentService.emitirPrescripcion).toHaveBeenCalledWith(
      expect.objectContaining({ evaluationId: expect.any(String) }),
      expect.anything(),
      "correo",
    );
  });

  it("y si el registro FALLA, no se envia nada", async () => {
    // Es la mitad que hace segura la union de los dos actos: si el registro fallara y el envio siguiera,
    // el paciente recibiria un plan del que no queda constancia. No basta con devolver error: hay que
    // comprobar que no se toco nada externo.
    vi.mocked(treatmentService.emitirPrescripcion).mockResolvedValueOnce({
      ok: false,
      error: { code: "conflict", message: "no se pudo" },
    } as Awaited<ReturnType<typeof treatmentService.emitirPrescripcion>>);
    const r = await sendReport(baseInput());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("conflict");
    expect(storage.uploadReportPdf).not.toHaveBeenCalled();
    expect(email.sendReportEmail).not.toHaveBeenCalled();
    expect(writer.markReportSent).not.toHaveBeenCalled();
  });

  it("y con el registro bien sale, que es el control", async () => {
    // Sin este control, el caso de arriba pasaria verde tambien con un sendReport que nunca envia nada.
    const r = await sendReport(baseInput());
    expect(r.ok).toBe(true);
    expect(email.sendReportEmail).toHaveBeenCalledTimes(1);
  });

  it("NO hay gate de 'ya emitida': cada envio es una salida distinta", async () => {
    // Un gate ahi seria el candado con otro nombre. Dos envios dejan dos emisiones, que es la verdad: el
    // paciente recibio el plan dos veces.
    await sendReport(baseInput());
    await sendReport(baseInput());
    expect(treatmentService.emitirPrescripcion).toHaveBeenCalledTimes(2);
  });
});

describe("el REENVIO no lleva el gate, a proposito", () => {
  beforeEach(() => {
    vi.mocked(storage.uploadReportPdf).mockReset().mockResolvedValue({ path: "pat-1/rep-1.pdf" });
    vi.mocked(email.sendReportEmail).mockReset().mockResolvedValue(okResult({ id: "email-1" }));
    vi.mocked(writer.markReportResent).mockReset().mockResolvedValue({ attempt: 1 });
    vi.mocked(treatmentService.emitirPrescripcion)
      .mockReset()
      .mockResolvedValue({ ok: true, value: undefined });
  });

  it("reenvia aunque la prescripcion este en borrador", async () => {
    // Un paciente que ya tiene su plan no puede quedarse sin poder recibirlo otra vez porque hoy pidamos
    // una firma que cuando se emitio no existia. `resendReport` reenvia el archivo que YA salio de la
    // clinica: no rearma nada, asi que no hay prescripcion nueva que firmar.
    vi.mocked(repo.getReportDispatch).mockResolvedValue({ ...dispatch(), status: "sent", sendMode: "atlas" });
    const r = await resendReport({
      reportId: "rep-1",
      reason: "el correo rebotó",
      actorId: "u-1",
      actorEmail: "pro@cnv.test",
      ip: null,
    });
    expect(r.ok, "el reenvio quedo bloqueado por el gate de emision").toBe(true);
    expect(
      treatmentService.emitirPrescripcion,
      "el reenvio registro una emision nueva: no es una salida nueva, es la misma otra vez",
    ).not.toHaveBeenCalled();
  });
});
