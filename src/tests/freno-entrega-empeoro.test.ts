import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// ═══ CANDADO DEL FRENO DEL "EMPEORO" (2026-08-24, mudado el 2026-09-18) ═══
//
// DE DONDE VIENE: un documento que le dice al paciente que empeoró no puede salir sin que tenga la próxima
// cita agendada. Enterarse de que se está peor sin saber cuándo lo vuelven a ver es la peor forma de
// recibir esa noticia (Gildardo, P0 Parte 2).
//
// QUE CAMBIO: el freno vivía en APROBAR el reporte. Al retirarse la ceremonia (el reporte es una hoja más),
// se mudó al acto de ENTREGAR, donde es más fuerte: la impresión se lo saltaba y ahora no.
//
// Lo que se blinda son las DOS mitades, porque cada una sola es insuficiente: el guard del SERVICIO (la UI
// no es autoridad; las server actions se invocan sin pasar por la pantalla) y la explicación en la PANTALLA
// (un botón deshabilitado sin motivo se lee como defecto). Y sobre todo: que el freno NO atrape otros casos.

const FRENO = readFileSync("src/modules/reports/data/freno-de-trayectoria.ts", "utf8");
const ENVIO = readFileSync("src/modules/reports/services/send-report.ts", "utf8");
const HC = readFileSync("src/modules/reports/services/entregar-hc.ts", "utf8");
const CARD = readFileSync("src/modules/reports/components/report-card.tsx", "utf8");

describe("freno del empeoro en la entrega", () => {
  it("el SERVICIO lo impone, no solo la pantalla", () => {
    // Las server actions se invocan sin pasar por la UI: un freno solo visual no es un freno.
    expect(FRENO).toContain('fila.band !== "empeoro"');
    expect(FRENO).toContain("fila.proxima_cita ? null : MENSAJE_FRENO");
  });

  it("lo aplican LAS DOS salidas hacia el paciente: el reporte y la historia clinica", () => {
    for (const [nombre, codigo] of [
      ["send-report", ENVIO],
      ["entregar-hc", HC],
    ] as const) {
      expect(codigo, `${nombre} debe consultar el freno`).toContain("frenoDeTrayectoria(");
      expect(codigo, `${nombre} debe cortar cuando frena`).toContain("if (freno) return err(");
    }
  });

  it("NO alcanza al plan ni a las rutas: dicen que hacer, no que le pasa a su cuerpo", () => {
    // Es la respuesta a la pregunta de Santiago (2026-09-18): un freno que impidiera imprimir el plan
    // dejaria al profesional sin poder entregarle al paciente lo que se lleva de la consulta, con el
    // paciente ahi delante. Eso estorba sin proteger.
    expect(FRENO).toContain('HOJAS_QUE_CUENTAN_EL_CAMBIO = new Set(["reporte", "hc"])');
    expect(FRENO).toContain("if (!HOJAS_QUE_CUENTAN_EL_CAMBIO.has(documento)) return null;");
    for (const hoja of ["plan", "rutas", "diagnostico"]) {
      expect(FRENO, `el freno no debe nombrar ${hoja} entre las hojas que frena`).not.toContain(
        `"${hoja}"`,
      );
    }
  });

  it("SOLO alcanza a 'empeoro': una trayectoria estable o mejor no pide nada", () => {
    // Si comparara solo contra la cita, atraparia a 'mejoro' y 'sin_cambio', que son la mayoria de los
    // seguimientos, y ninguno de esos dos debe notar este freno.
    for (const otra of ["mejoro", "sin_cambio"]) {
      expect(FRENO, `el freno no debe mencionar ${otra}`).not.toContain(otra);
    }
  });

  it("un reporte SIN banda (inicial, o seguimiento sin previa comparable) no lo ve", () => {
    // Sin fila de reporte o con band null, la condicion no se cumple y no frena.
    expect(FRENO).toContain("if (!fila || fila.band !== \"empeoro\") return null;");
  });

  it("el mensaje dice QUE falta hacer, no solo que no se puede", () => {
    expect(FRENO).toContain("Agéndala en Seguimiento");
  });

  it("la PANTALLA lo ADELANTA con la misma condicion, y el boton no queda mudo", () => {
    // Si divergieran, habria un boton activo que el servicio rechaza (o al reves, uno apagado sin motivo).
    expect(CARD).toContain('const frenado = t?.band === "empeoro" && !t.proximaCita;');
    expect(CARD).toContain("disabled={sending || frenado}");
    expect(CARD).toContain("Agéndala en Seguimiento");
  });

  it("la ceremonia retirada no vuelve por la pantalla", () => {
    // Aprobar y confirmar la comunicacion ya no existen: si reaparecieran aqui, volveria el tramite que
    // Santiago retiro y el reporte dejaria de ser una hoja mas.
    expect(CARD).not.toContain("approveReportAction");
    expect(CARD).not.toContain("confirmTrajectoryCommunicationAction");
    expect(CARD).not.toContain("sendMode");
  });
});
