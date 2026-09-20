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
// Y el resto del informe (rutas, suplementos, remisiones, seguimiento), por lo mismo: su contenido lo
// cubre `informe-paciente.test.ts`; aqui importa que el envio lo pida y lo pase al render.
// LA SERIE DE LA GRAFICA: mismo trato que el plan y el informe. Vacia por defecto, que es el caso de una
// primera consulta (una trayectoria de un punto no se pinta).
vi.mock("@/modules/reports/data/serie-del-paciente", () => ({
  getSerieDelPaciente: vi.fn(async () => []),
}));
vi.mock("@/modules/reports/data/informe-paciente-reader", () => ({
  getInformeDelPaciente: vi.fn(async () => ({
    rutas: [],
    suplementos: { delModelo: null, delProfesional: [] },
    remisiones: { delModelo: [], delProfesional: [] },
    seguimiento: { observacion: null, proximaCita: null },
  })),
}));
// EL GATE DE EMISION (2026-09-01): el protocolo tiene que estar aprobado para que el reporte salga. Se
// mockea aprobado por defecto, y hay un caso propio abajo para el borrador: si no se mockeara, TODOS los
// casos de orquestacion se caerian por el gate y el test diria que el orden de los pasos esta mal.
// EL SERVICIO DE TRATAMIENTO, mockeado desde el 2026-09-09: enviar ya no EXIGE la aprobacion, la HACE.
vi.mock("@/modules/treatment/services/treatment-service", () => ({
  emitirPrescripcion: vi.fn(async () => ({ ok: true, value: undefined })),
}));
// EL FRENO DEL CAMBIO DESFAVORABLE y LA OBSERVACION DE LA CONSULTA: dos lecturas de BD que el servicio
// hace ahora (2026-09-18). Por defecto no frena y no hay observacion; cada caso propio los cambia.
vi.mock("@/modules/reports/data/freno-de-trayectoria", () => ({
  frenoDeTrayectoria: vi.fn(async () => null),
  ultimaObservacionDeLaConsulta: vi.fn(async () => null),
}));
// EL REGISTRO DE ENTREGAS (0148): el reporte deja su fila junto a las demas hojas.
vi.mock("@/modules/reports/data/hc-entregas-writer", () => ({
  writeHcDelivery: vi.fn(async () => undefined),
}));
vi.mock("@/modules/reports/data/report-storage", () => ({
  uploadReportPdf: vi.fn(),
  downloadReportPdf: vi.fn(async () => Buffer.from("%PDF-guardado")),
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
const freno = await import("@/modules/reports/data/freno-de-trayectoria");
const entregas = await import("@/modules/reports/data/hc-entregas-writer");
const almacenamiento = await import("@/modules/reports/data/report-storage");
const treatmentService = await import("@/modules/treatment/services/treatment-service");
const { sendReport, resendReport } = await import("@/modules/reports/services/send-report");

function dispatch(over: Partial<ReportDispatch> = {}): ReportDispatch {
  return {
    reportId: "rep-1",
    evaluationId: "ev-1",
    patientId: "pat-1",
    status: "draft",
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
    vi.mocked(freno.frenoDeTrayectoria).mockReset().mockResolvedValue(null);
    vi.mocked(freno.ultimaObservacionDeLaConsulta).mockReset().mockResolvedValue(null);
    vi.mocked(entregas.writeHcDelivery).mockReset().mockResolvedValue(undefined);
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
    // marca enviado con el path subido y con lo que EFECTIVAMENTE salio (trazabilidad). Sin observacion
    // de la consulta, lo que sale es el reporte solo.
    expect(vi.mocked(writer.markReportSent).mock.calls[0][0]).toMatchObject({
      reportId: "rep-1",
      storagePath: "pat-1/rep-1.pdf",
      sendMode: "atlas",
    });
  });

  // LOS TRES MODOS SE RETIRARON (2026-09-18): elegir entre el reporte y unas notas que ya no se escriben
  // era una decision que no aportaba. Lo que decide ahora es un hecho, no una eleccion: si el profesional
  // dejo su observacion de la consulta (en Seguimiento), viaja con el reporte.
  it("si el profesional escribio la observacion de la consulta, viaja con el reporte", async () => {
    vi.mocked(freno.ultimaObservacionDeLaConsulta).mockResolvedValue("Toleró bien el cambio de porciones.");
    const res = await sendReport(baseInput());
    expect(res.ok).toBe(true);
    expect(vi.mocked(writer.markReportSent).mock.calls[0][0]).toMatchObject({ sendMode: "ambos" });
  });

  it("y si no escribio nada, sale el reporte solo (no se bloquea el envio)", async () => {
    const res = await sendReport(baseInput());
    expect(res.ok).toBe(true);
    expect(vi.mocked(writer.markReportSent).mock.calls[0][0]).toMatchObject({ sendMode: "atlas" });
  });

  // EL FRENO CLINICO, que es lo unico de la ceremonia retirada que NO podia caerse: un documento que
  // informa un cambio desfavorable no sale si el paciente no tiene la proxima cita agendada.
  it("un cambio desfavorable sin cita agendada no sale, y no toca nada externo", async () => {
    vi.mocked(freno.frenoDeTrayectoria).mockResolvedValue("Agéndala en Seguimiento antes de entregarlo.");
    const res = await sendReport(baseInput());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("conflict");
    expect(storage.uploadReportPdf).not.toHaveBeenCalled();
    expect(email.sendReportEmail).not.toHaveBeenCalled();
    expect(writer.markReportSent).not.toHaveBeenCalled();
  });

  it("la entrega queda registrada con SU documento, junto a las demas hojas", async () => {
    const res = await sendReport(baseInput());
    expect(res.ok).toBe(true);
    expect(vi.mocked(entregas.writeHcDelivery).mock.calls[0][0]).toMatchObject({
      evaluationId: "ev-1",
      documento: "reporte",
      sentTo: "ana@example.com",
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

  // YA NO SE APRUEBA (2026-09-18): un reporte en borrador SE ENVIA, porque el borrador es el estado normal
  // de una hoja que nadie ha mandado todavia. Lo que se rechaza es mandar dos veces el primer envio: para
  // eso esta el reenvio, que manda el MISMO archivo con su motivo.
  it("un reporte en borrador SI se envia (la aprobacion se retiro)", async () => {
    vi.mocked(repo.getReportDispatch).mockResolvedValue(dispatch({ status: "draft" }));
    const res = await sendReport(input);
    expect(res.ok).toBe(true);
    expect(email.sendReportEmail).toHaveBeenCalledTimes(1);
  });

  it("rechaza si el reporte YA se envio (eso es el reenvio)", async () => {
    vi.mocked(repo.getReportDispatch).mockResolvedValue(dispatch({ status: "sent" }));
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
    vi.mocked(freno.frenoDeTrayectoria).mockReset().mockResolvedValue(null);
    vi.mocked(freno.ultimaObservacionDeLaConsulta).mockReset().mockResolvedValue(null);
    vi.mocked(entregas.writeHcDelivery).mockReset().mockResolvedValue(undefined);
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
    vi.mocked(almacenamiento.downloadReportPdf)
      .mockReset()
      .mockResolvedValue(Buffer.from("%PDF-guardado"));
    vi.mocked(freno.frenoDeTrayectoria).mockReset().mockResolvedValue(null);
    vi.mocked(treatmentService.emitirPrescripcion)
      .mockReset()
      .mockResolvedValue({ ok: true, value: undefined });
  });

  it("manda los BYTES GUARDADOS, no un render nuevo", async () => {
    // Es lo que hace que "el mismo documento" sea verdad. Se re-renderizaba desde el snapshot, y eso valia
    // mientras el tratamiento quedara congelado al aprobarse; desde el 2026-09-09 la prescripcion esta
    // siempre abierta, asi que un render nuevo podia salir distinto del que recibio el paciente.
    const render = await import("@/modules/reports/services/render-report");
    vi.mocked(render.renderReportPdf).mockClear();
    vi.mocked(repo.getReportDispatch).mockResolvedValue({
      ...dispatch(),
      status: "sent",
      sendMode: "atlas",
      storagePath: "pat-1/rep-1.pdf",
    });
    const r = await resendReport({
      reportId: "rep-1",
      reason: null,
      actorId: "u-1",
      actorEmail: "pro@cnv.test",
      ip: null,
    });
    expect(r.ok).toBe(true);
    expect(almacenamiento.downloadReportPdf).toHaveBeenCalledWith("pat-1/rep-1.pdf");
    expect(
      render.renderReportPdf,
      "el reenvio re-renderizo el documento en vez de mandar el que salio",
    ).not.toHaveBeenCalled();
  });

  it("y si no hay copia guardada (reportes viejos), lo reconstruye antes que no mandar nada", async () => {
    vi.mocked(almacenamiento.downloadReportPdf).mockResolvedValueOnce(null);
    vi.mocked(repo.getReportDispatch).mockResolvedValue({
      ...dispatch(),
      status: "sent",
      sendMode: "atlas",
      storagePath: null,
    });
    const r = await resendReport({
      reportId: "rep-1",
      reason: null,
      actorId: "u-1",
      actorEmail: "pro@cnv.test",
      ip: null,
    });
    expect(r.ok).toBe(true);
    expect(email.sendReportEmail).toHaveBeenCalledTimes(1);
  });

  it("reenvia aunque la prescripcion este en borrador", async () => {
    // Un paciente que ya tiene su plan no puede quedarse sin poder recibirlo otra vez porque hoy pidamos
    // una firma que cuando se emitio no existia. `resendReport` reenvia el archivo que YA salio de la
    // clinica: no rearma nada, asi que no hay prescripcion nueva que firmar.
    vi.mocked(repo.getReportDispatch).mockResolvedValue({ ...dispatch(), status: "sent", sendMode: "atlas" });
    const r = await resendReport({
      reportId: "rep-1",
      reason: null,
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
