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

// EL ANCLA CAMBIO CON LA HOJA (2026-09-18): la tarjeta dejo de ramificar por los tres estados (el
// reporte ya no se aprueba) y ahora pregunta `enviado`. Lo que se blinda no cambia: el bloque de reenvio
// existe SOLO cuando el documento ya salio.
const bloqueReenvio = CARD.slice(
  CARD.indexOf("{enviado ? ("),
  CARD.indexOf("{/* CUANDO SALIO Y A DONDE"),
);

describe("reenvio del reporte", () => {
  it("el bloque solo aparece con el reporte ENVIADO", () => {
    expect(CARD).toContain('const enviado = report.status === "sent";');
    expect(CARD).toContain("{enviado ? (");
    expect(bloqueReenvio.length).toBeGreaterThan(0);
  });

  it("la pantalla dice EL MISMO documento, en el titulo y en el boton", () => {
    // Si el texto no lo dice, se lee como emitir uno nuevo. Es la confusion que el bloque debe evitar.
    expect(bloqueReenvio).toContain("Reenviar el mismo documento");
    expect(bloqueReenvio).toContain("el mismo informe");
    expect(bloqueReenvio).toContain("No genera uno");
  });

  it("NO ofrece elegir modo de envio: cambiarlo cambiaria lo que el paciente recibe", () => {
    expect(bloqueReenvio).not.toContain("sendMode");
    // Y el servicio reusa el modo del envio original, no uno recibido por parametro.
    expect(SERVICE).toContain("dispatch.sendMode ?? \"atlas\"");
  });

  // EL MOTIVO DEJO DE PEDIRSE (Santiago, 2026-09-19): convertia un gesto de un clic ("el correo reboto")
  // en un formulario, y lo que se escribia no lo leia nadie. Lo que se blinda ahora es lo que SI queda: la
  // confirmacion antes de mandar, la cuenta de reenvios, y el tope de tamano si el motivo vuelve a llegar.
  it("reenviar pide CONFIRMACION, no un motivo escrito", () => {
    expect(bloqueReenvio, "volvio el campo del motivo").not.toContain('name="reason"');
    expect(bloqueReenvio).toContain("confirmandoReenvio");
    expect(bloqueReenvio).toContain("Sí, reenviar");
    expect(bloqueReenvio).toContain("Cancelar");
    // El tope sigue en el esquema: toda entrada externa lo lleva, venga de donde venga.
    expect(ACTIONS).toMatch(/resendReasonSchema[\s\S]{0,200}\.max\(300/);
  });

  it("y la CUENTA de reenvios se conserva, que es lo que el profesional sí mira", () => {
    expect(bloqueReenvio).toContain("resentCount");
    expect(WRITER).toContain("resentCount");
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
    // EL ANCLA SE MUEVE, NO LA ASERCION (2026-09-10): la invocacion pasó por `ejecutarAccion`, que hace
    // el `startTransition` ademas de armar el guard del scroll. Se afirma lo mismo: onSubmit, no la prop
    // `action`, para que un error no borre el motivo escrito.
    expect(bloqueReenvio).toContain("ejecutarAccion(");
    expect(bloqueReenvio).not.toContain("action={resend}");
  });
});
