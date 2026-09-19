import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ LAS TRES SALIDAS DE UN INFORME, Y QUE NO SE CONFUNDAN (2026-09-19) ═══
//
// LA PREGUNTA DE SANTIAGO QUE LO PIDIÓ: *"¿qué pasa si cambio algo del diagnóstico o de las notas de
// seguimiento y quiero que vayan en el nuevo reporte? No hay forma, ya que solo puedo reenviar el
// anterior."* Tenía razón: era el caso normal de una consulta y no tenía salida.
//
// LAS TRES, QUE HACEN COSAS DISTINTAS:
//   · REENVIAR       manda EL MISMO archivo. Es la constancia de lo que el paciente recibió.
//   · VERSIÓN NUEVA  mismo diagnóstico, con lo que cambió después (la observación, el plan ajustado).
//   · CORREGIR       rehace la cadena entera porque un DATO estaba mal.
//
// LO QUE ESTE CANDADO PROTEGE ES LA FRONTERA, no la función: confundirlas tiene consecuencias distintas, y
// la más grave sería que emitir una versión nueva se convirtiera en la forma de reescribir lo entregado.

const WRITER = readFileSync("src/modules/reports/data/reports-writer.ts", "utf8");
const ACCIONES = sinComentarios(readFileSync("src/modules/reports/actions.ts", "utf8"));
const CARD = readFileSync("src/modules/reports/components/report-card.tsx", "utf8");

const fn = WRITER.slice(
  WRITER.indexOf("export async function emitirVersionNueva"),
  WRITER.indexOf("export type MarkReportSentInput"),
);

describe("emitir una versión nueva del informe", () => {
  it("INSERTA una fila nueva y no toca la anterior", () => {
    // Es lo único que no puede fallar: el documento que el paciente ya tiene en su correo no se reescribe.
    expect(fn).toContain(".insert(reports)");
    expect(fn, "una versión nueva no actualiza el informe anterior").not.toContain(".update(reports)");
  });

  it("copia el snapshot SELLADO: no recalcula el diagnóstico", () => {
    // Si recalculara, sería una corrección con otro nombre, y una corrección versiona TODA la cadena
    // (diagnóstico, tratamiento y reporte), no solo el documento.
    expect(fn).toContain("snapshot: anterior.snapshot");
  });

  it("y copia la trayectoria, o emitir sería la forma de saltarse el freno", () => {
    // El freno del cambio desfavorable lee la banda del reporte más reciente. Sin copiarla, una versión
    // nueva saldría sin banda y el "empeoró" se entregaría sin cita agendada.
    expect(fn).toContain("trajectory: anterior.trajectory");
  });

  it("solo desde un informe ENVIADO: si aún no salió, se envía ese", () => {
    // Ofrecer las dos cosas dejaría dos borradores del mismo informe sin que nadie sepa cuál es el bueno.
    expect(fn).toContain('anterior.status !== "sent"');
    expect(fn).toContain("envíalo en vez de emitir otro");
  });

  it("una sola versión abierta a la vez", () => {
    expect(fn).toContain("Ya hay una versión nueva sin enviar");
  });

  it("deja rastro de CUÁL sucede a cuál (regla 8, inline)", () => {
    expect(fn).toContain('event: "report.reissued"');
    expect(fn).toContain("version_anterior");
    expect(fn.slice(fn.indexOf("db.transaction"))).toContain("recordAudit(tx");
  });

  it("la action verifica la policy Y que el informe sea suyo", () => {
    const accion = ACCIONES.slice(ACCIONES.indexOf("export async function emitirVersionNuevaAction"));
    expect(accion).toContain("canManageReports(user)");
    expect(accion).toContain("getReportDispatch(reportId)");
  });

  it("la pantalla EXPLICA la diferencia con las otras dos salidas", () => {
    // Las tres se parecen. Un botón más, sin decir en qué se diferencia, convierte la elección en un
    // volado: el profesional reenviaría creyendo que manda lo nuevo.
    expect(CARD).toContain("Emitir una versión nueva");
    // El texto envuelve en dos lineas: se afirma la frase corta que no se parte.
    expect(CARD).toContain("si lo que está mal es un dato");
    expect(CARD).toContain("El informe que ya recibió el paciente se conserva tal cual");
  });

  it("y pide confirmación, como las otras dos salidas hacia el paciente", () => {
    expect(CARD).toContain("confirmandoVersion");
    expect(CARD).toContain("Sí, emitirla");
  });
});
