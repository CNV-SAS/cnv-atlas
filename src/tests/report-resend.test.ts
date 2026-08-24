import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DEL REENVIO (2026-08-24). Reenviar es mandar OTRA VEZ EL MISMO documento; reemitir es crear uno
// nuevo, y no existe (va con el mecanismo de sucesion de versiones). Lo que se blinda aqui es justo la
// frontera entre los dos, porque confundirlos en la pantalla es lo que haria que un profesional creyera
// que corrigio un reporte cuando solo lo volvio a mandar.

const CARD = readFileSync("src/modules/reports/components/report-card.tsx", "utf8");
const SERVICE = readFileSync("src/modules/reports/services/send-report.ts", "utf8");
const WRITER = readFileSync("src/modules/reports/data/reports-writer.ts", "utf8");
const ACTIONS = readFileSync("src/modules/reports/actions.ts", "utf8");

const bloqueReenvio = CARD.slice(
  CARD.indexOf('{report.status === "sent" ? ('),
  CARD.indexOf('{report.status === "approved" || report.status === "sent" ? ('),
);

describe("reenvio del reporte", () => {
  it("el bloque solo aparece con el reporte ENVIADO", () => {
    expect(CARD).toContain('{report.status === "sent" ? (');
    expect(bloqueReenvio.length).toBeGreaterThan(0);
  });

  it("la pantalla dice EL MISMO documento, en el titulo y en el boton", () => {
    // Si el texto no lo dice, se lee como emitir uno nuevo. Es la confusion que el bloque debe evitar.
    expect(bloqueReenvio).toContain("Reenviar el mismo documento");
    expect(bloqueReenvio).toContain("el mismo reporte");
    expect(bloqueReenvio).toContain("No genera un reporte nuevo");
  });

  it("NO ofrece elegir modo de envio: cambiarlo cambiaria lo que el paciente recibe", () => {
    expect(bloqueReenvio).not.toContain("sendMode");
    // Y el servicio reusa el modo del envio original, no uno recibido por parametro.
    expect(SERVICE).toContain("dispatch.sendMode ?? \"atlas\"");
  });

  it("el motivo es OBLIGATORIO y acotado (un documento clinico que sale dos veces deja rastro)", () => {
    expect(bloqueReenvio).toContain('name="reason"');
    expect(bloqueReenvio).toContain("required");
    expect(ACTIONS).toMatch(/resendReasonSchema[\s\S]{0,200}\.min\(3/);
    expect(ACTIONS).toMatch(/resendReasonSchema[\s\S]{0,200}\.max\(300/);
  });

  it("el motivo va al AUDIT, que es el registro que no se reescribe (regla 8)", () => {
    expect(WRITER).toContain('event: "report.resent"');
    expect(WRITER).toMatch(/reason: input\.reason/);
  });

  it("el reenvio NO reescribe sent_at: la fecha del PRIMER envio es dato clinico", () => {
    const fn = WRITER.slice(WRITER.indexOf("export async function markReportResent"));
    //  evita casar el sufijo de lastResentAt, que si es del reenvio.
    expect(fn).not.toMatch(/sentAt/);
    expect(fn).toContain("resentCount");
  });

  it("el reenvio NO toca el documento: ni snapshot, ni notas, ni trayectoria", () => {
    const fn = WRITER.slice(WRITER.indexOf("export async function markReportResent"));
    for (const campo of ["snapshot", "professionalNotes", "trajectory"]) {
      expect(fn, `markReportResent no debe tocar ${campo}`).not.toContain(campo);
    }
  });

  it("solo se reenvia lo ya ENVIADO (no un borrador ni un aprobado sin enviar)", () => {
    const fn = WRITER.slice(WRITER.indexOf("export async function markReportResent"));
    expect(fn).toContain('report.status !== "sent"');
    expect(SERVICE).toContain('dispatch.status !== "sent"');
  });

  it("el envio por onSubmit, no por la prop action (si no, un error borra el motivo escrito)", () => {
    // Hazard de React 19 registrado en CLAUDE.md: la prop `action` resetea los inputs no controlados.
    expect(bloqueReenvio).toContain("onSubmit");
    expect(bloqueReenvio).toContain("startTransition");
    expect(bloqueReenvio).not.toContain("action={resend}");
  });
});
