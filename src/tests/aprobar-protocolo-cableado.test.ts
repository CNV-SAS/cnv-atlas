import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL CABLE DE LA APROBACIÓN (barrido del 2026-09-01; alcance reescrito el 2026-09-09).
//
// EL DEFECTO QUE CERRÓ LA PRIMERA VEZ: `approveProtocolAction` existía con toda su vertical debajo
// (policy, servicio con cuatro gates, writer transaccional con audit inline, trigger 0026 de
// inmutabilidad, dos suites de tests) y NINGUNA PANTALLA LA INVOCABA. No había forma de aprobar.
//
// Y POR QUÉ EL CANDADO VA SOBRE EL SITIO DE LLAMADA y no sobre la acción: la acción estaba bien y estaba
// probada. Lo que faltaba era que alguien la llamara, así que un test de la acción seguía verde con el
// hueco abierto. Es la lección de que cuando el defecto es una OMISIÓN, se prueba el sitio de llamada.
//
// ═══ ALCANCE REESCRITO: EL BOTÓN DESAPARECIÓ, EL ACTO NO (2026-09-09) ═══
//
// Gildardo pidió retirar "Aprobar la prescripción", y Santiago propuso la vía: **emitir es aprobar**. Así
// que este candado dejó de poder mirar un botón, y lo que blinda ahora son las DOS vías que lo sustituyen:
// enviar el reporte al paciente, y declarar la entrega en consulta. Las dos sellan lo mismo y registran
// POR CUÁL se aprobó.
//
// LA REGLA NO CAMBIA, y es la que hizo falta la primera vez: el hueco de entonces era una acción que nadie
// invocaba; el hueco de ahora sería un acto clínico que ninguna vía dispara. Es el mismo, con otra forma.
//
// LO QUE LA APROBACIÓN DESBLOQUEA sigue abajo: el bloqueo de edición, el aviso de que reemplaza a otra, y
// la reapertura, que vive dentro del bloque de aprobado.

const PANEL_RAW = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const PANEL = sinComentarios(PANEL_RAW);
const ACTIONS = sinComentarios(readFileSync("src/modules/treatment/actions.ts", "utf8"));
const ENVIO = sinComentarios(readFileSync("src/modules/reports/services/send-report.ts", "utf8"));
const ENTREGA = sinComentarios(
  readFileSync("src/modules/reports/components/entregado-en-consulta.tsx", "utf8"),
);
const SERVICIO = sinComentarios(
  readFileSync("src/modules/treatment/services/treatment-service.ts", "utf8"),
);

describe("la aprobación tiene sus DOS cables, y solo esos dos", () => {
  it("VÍA 1 · enviar el reporte aprueba la prescripción", () => {
    expect(ENVIO).toContain("await approveProtocol(");
    expect(ENVIO).toContain('"envio",');
  });

  it("y aprueba ANTES de armar el plan, o viajaría el borrador", () => {
    // El plan se lee EN VIVO del protocolo, así que tiene que leerse del ya congelado. Si el orden se
    // invierte, el paciente recibe un plan armado de una prescripción todavía editable, que es
    // exactamente lo que este cambio vino a hacer imposible.
    const iAprueba = ENVIO.indexOf("await approveProtocol(");
    const iPlan = ENVIO.indexOf("await getPlanPaciente(");
    expect(iAprueba, "no se encontró la aprobación en el envío").toBeGreaterThan(-1);
    expect(iPlan, "no se encontró el armado del plan").toBeGreaterThan(-1);
    expect(iAprueba, "el plan se arma antes de sellar").toBeLessThan(iPlan);
  });

  it("VÍA 2 · la entrega en consulta, como acto explícito", () => {
    // EL HUECO QUE CIERRA, verificado antes de construirla: el plan imprimible se arma del protocolo
    // COMPUTADO, no del aprobado, así que se podía imprimir y entregar sin que nadie lo sellara. Si el
    // profesional nunca enviaba el reporte, el paciente se iba con un papel que nadie asumió.
    expect(ACTIONS).toContain("export async function marcarEntregadoEnConsultaAction");
    expect(ACTIONS).toContain('"entrega_en_consulta",');
    expect(ENTREGA).toContain("useActionState(marcarEntregadoEnConsultaAction");
    expect(ENTREGA).toContain("Entregado en consulta");
  });

  it("y NO hay una tercera: imprimir no aprueba", () => {
    // Imprimir es LEER: se imprime para revisar antes de decidir, y se imprime dos veces si salió torcida.
    // Convertir una lectura en firma es lo contrario de lo que un acto clínico debe ser.
    const BOTON = sinComentarios(
      readFileSync("src/modules/reports/components/plan-imprimir-boton.tsx", "utf8"),
    );
    expect(BOTON, "imprimir dejó de ser solo leer").not.toContain("approve");
    expect(BOTON).not.toContain("marcarEntregado");
  });

  it("el sello registra POR CUÁL vía se aprobó", () => {
    // Entregar en mano y enviar por correo no son lo mismo si alguien pregunta después. Va DENTRO de
    // `protocol_approved`, que es write-once: o se escribe en el acto, o ya no se puede añadir.
    expect(SERVICIO).toContain("aprobadoVia: via,");
    expect(SERVICIO).toContain('export type ViaDeAprobacion =');
  });

  it("y el botón suelto de aprobar ya no existe", () => {
    // No es cosmético: mientras exista, hay una tercera vía de sellar que no registra cómo se emitió.
    expect(PANEL, "volvió el botón de aprobar suelto").not.toContain("Aprobar la prescripción");
    expect(ACTIONS, "volvió la acción sin pantalla").not.toContain(
      "export async function approveProtocolAction",
    );
  });
});

describe("lo que la aprobación desbloquea, que era lo que estaba muerto", () => {
  it("(a) el bloqueo de edición depende SOLO de `protocol.approved`", () => {
    // Era `diagnosisPending || protocol.approved`. Al mover la confirmación al momento de emitir, ese OR
    // se habría vuelto SIEMPRE cierto (la ventana entre confirmar y aprobar pasa a durar cero) y el
    // protocolo habría quedado bloqueado para siempre sin dar ningún error.
    expect(PANEL).toContain("const locked = protocol.approved;");
  });

  it("(b) el aviso de que reemplaza a otra depende de las aprobaciones previas", () => {
    expect(PANEL).toContain("protocol.aprobacionesPrevias > 0");
  });

  it("(c) la reapertura vive dentro del bloque de aprobado, así que se alcanza al aprobar", () => {
    // LA REAPERTURA CON MOTIVO SE CONSERVA INTACTA tras el cambio, y es lo que hace que emitir pueda ser
    // el sello: una vez el paciente tiene el documento, cambiar la prescripción tiene que dejar rastro.
    expect(PANEL).toContain("<ProtocoloAprobado");
    const i = PANEL.indexOf("function ProtocoloAprobado(");
    expect(PANEL.slice(i, i + 800)).toContain("useActionState(reopenProtocolAction");
  });

  it("y mientras no se emite, el panel DICE que está en borrador", () => {
    // Sin botón, el estado tiene que decirse: una prescripción editable que no anuncia que lo es se lee
    // como definitiva. Es información, no un mando.
    expect(PANEL).toContain("La prescripción está en borrador.");
  });
});

describe("y el texto no promete un aviso que el sistema no manda", () => {
  it("ninguna cadena dice que al aprobar se le avisa al paciente", () => {
    // APROBAR NO NOTIFICA por sí mismo. Con el cambio del 2026-09-09 una de las dos vías SÍ es el envío,
    // pero la otra (entrega en consulta) no manda nada, así que la promesa seguiría siendo falsa la mitad
    // de las veces. Un texto que le dice al profesional que el sistema avisa por él hace que no avise.
    expect(PANEL).not.toMatch(/se le avisar[aá]/);
    expect(PANEL).not.toMatch(/al aprobar la nueva se le avisa/i);
  });

  it("y en su lugar dice lo que el profesional tiene que hacer", () => {
    // CONTROL de la aserción negativa de arriba: sin esto, borrar el párrafo entero también pasaría verde,
    // y borrarlo perdería el requisito de su §12c en vez de decirlo bien.
    expect(PANEL).toContain("envíale el reporte");
    expect(PANEL).toMatch(/no se lo avisa solo/);
  });
});
