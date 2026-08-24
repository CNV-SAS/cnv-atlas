import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DEL GATE DEL "EMPEORO" (2026-08-24). Aprobar es el paso que manda el documento hacia el paciente.
// Hasta hoy el bloque de confirmacion INVITABA: se podia aprobar y enviar un "empeoro" sin confirmar y sin
// agendar, y el paciente recibia la mala noticia sin saber cuando lo vuelven a ver.
//
// Lo que se blinda son las DOS mitades, porque cada una sola es insuficiente: el guard del servidor (la UI
// no es autoridad; las server actions se invocan sin pasar por la pantalla) y la explicacion en la pantalla
// (un boton deshabilitado sin motivo se lee como defecto). Y sobre todo: que el gate NO atrape otros casos.

const WRITER = readFileSync("src/modules/reports/data/reports-writer.ts", "utf8");
const CARD = readFileSync("src/modules/reports/components/report-card.tsx", "utf8");

const approveFn = WRITER.slice(
  WRITER.indexOf("export async function approveReport"),
  WRITER.indexOf("export type ConfirmTrajectory") > 0
    ? WRITER.indexOf("export type ConfirmTrajectory")
    : WRITER.indexOf("export async function confirmTrajectoryCommunication"),
);

describe("gate del empeoro al aprobar", () => {
  it("el SERVIDOR lo impone, no solo la pantalla", () => {
    // Las server actions se invocan sin pasar por la UI: un gate solo visual no es un gate.
    expect(approveFn).toContain('band === "empeoro"');
    expect(approveFn).toContain("trajectoryCommunicatedAt == null");
    expect(approveFn).toContain("ReportStateError");
  });

  it("el mensaje dice QUE falta hacer, no solo que no se puede", () => {
    expect(approveFn).toContain("Confirma la comunicación y agenda la próxima cita");
  });

  it("SOLO alcanza a 'empeoro': una trayectoria estable o mejor no pide nada", () => {
    // El gate lee la banda antes de exigir. Si comparara solo contra la confirmacion, atraparia a
    // 'mejoro' y 'sin_cambio', que son la mayoria de los seguimientos.
    // Desde la lectura de la banda, la condicion completa (no hasta el primer ReportStateError, que es
    // el de "Reporte no encontrado" y va ANTES).
    const i = approveFn.indexOf("const band =");
    const linea = approveFn.slice(i, i + 400);
    expect(linea).toContain('band === "empeoro"');
    for (const otra of ["mejoro", "sin_cambio"]) {
      expect(linea, `el gate no debe mencionar ${otra}`).not.toContain(otra);
    }
  });

  it("un reporte SIN banda (inicial, o seguimiento sin previa comparable) no lo ve", () => {
    // trajectory null -> band undefined -> la condicion no se cumple. Se blinda el acceso opcional.
    expect(approveFn).toContain("(report.trajectory as { band?: string } | null)?.band");
  });

  it("la PANTALLA deshabilita Aprobar con la misma condicion que muestra el bloque", () => {
    // Misma condicion en los dos sitios: si divergieran, habria un boton deshabilitado sin bloque que
    // resuelva, o un boton activo que el servidor rechaza.
    expect(CARD).toContain("disabled={approving || showConfirm}");
  });

  it("el boton deshabilitado DICE por que (no queda muerto)", () => {
    expect(CARD).toContain("Falta confirmar la comunicación del cambio desfavorable y agendar");
  });

  it("confirmar sigue siendo un ACTO APARTE de aprobar (matiz de Gildardo)", () => {
    // Aprobar NO confirma por su cuenta: si lo hiciera, comunicar un empeoramiento seria un automatismo.
    expect(approveFn).not.toContain("trajectoryCommunicatedAt: sql");
    expect(CARD).toContain("confirmTrajectoryCommunicationAction");
  });
});
