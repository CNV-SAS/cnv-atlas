import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL ÚLTIMO CABLE DE LA APROBACIÓN (barrido del 2026-09-01).
//
// EL DEFECTO QUE CIERRA: `approveProtocolAction` existía con toda su vertical debajo (policy, servicio con
// cuatro gates, writer transaccional con audit inline, trigger 0026 de inmutabilidad, dos suites de tests)
// y NINGUNA PANTALLA LA INVOCABA. No había forma de aprobar un tratamiento.
//
// Y POR QUÉ EL CANDADO VA SOBRE EL SITIO DE LLAMADA y no sobre la acción: la acción estaba bien y estaba
// probada. Lo que faltaba era que alguien la llamara, así que un test de la acción seguía verde con el
// hueco abierto. Es la lección de que cuando el defecto es una OMISIÓN, se prueba el sitio de llamada.
//
// LO QUE ARRASTRABA, y es la razón de las tres aserciones de abajo: con `approved` clavado en false nunca
// se activaba el bloqueo de edición, nunca aparecía el aviso de que la prescripción reemplaza a otra, y la
// REAPERTURA era inalcanzable porque vive dentro del bloque de aprobado.

const PANEL_RAW = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const PANEL = sinComentarios(PANEL_RAW);
const ACTIONS = sinComentarios(readFileSync("src/modules/treatment/actions.ts", "utf8"));

describe("la aprobación tiene su cable", () => {
  it("el panel invoca `approveProtocolAction`", () => {
    expect(ACTIONS).toContain("export async function approveProtocolAction");
    expect(PANEL).toContain("approveProtocolAction");
    expect(PANEL).toContain("useActionState(approveProtocolAction");
  });

  it("y el botón existe con un texto que dice qué hace", () => {
    expect(PANEL).toContain("Aprobar la prescripción");
  });

  it("se envía con `enviarSinReset`, no con la prop `action`", () => {
    // El auto-reset de React 19: la prop `action` dispara un form.reset() nativo. Aquí el formulario solo
    // lleva un hidden, pero la regla es del módulo entero y el día que alguien agregue un campo, vuelve.
    const i = PANEL.indexOf("function AprobarProtocolo(");
    expect(i).toBeGreaterThan(-1);
    const bloque = PANEL.slice(i, i + 2000);
    expect(bloque).toContain("enviarSinReset(formAction)");
    expect(bloque).not.toMatch(/<form[^>]*\saction=\{/);
  });
});

describe("lo que la aprobación desbloquea, que era lo que estaba muerto", () => {
  it("(a) el bloqueo de edición depende de `protocol.approved`", () => {
    expect(PANEL).toContain("const locked = diagnosisPending || protocol.approved;");
  });

  it("(b) el aviso de que reemplaza a otra depende de las aprobaciones previas", () => {
    expect(PANEL).toContain("protocol.aprobacionesPrevias > 0");
  });

  it("(c) la reapertura vive dentro del bloque de aprobado, así que se alcanza al aprobar", () => {
    expect(PANEL).toContain("<ProtocoloAprobado");
    const i = PANEL.indexOf("function ProtocoloAprobado(");
    expect(PANEL.slice(i, i + 800)).toContain("useActionState(reopenProtocolAction");
  });

  it("y el bloque de aprobar NO se ofrece cuando ya está aprobado ni sin diagnóstico confirmado", () => {
    // Sin esto el profesional vería el botón de sellar algo que no puede sellarse, y descubriría el gate
    // con un error del servidor en vez de con la pantalla.
    expect(PANEL).toContain("{!protocol.approved && !diagnosisPending ? (");
  });
});

describe("y el texto no promete un aviso que el sistema no manda", () => {
  it("ninguna cadena dice que al aprobar se le avisa al paciente", () => {
    // APROBAR NO NOTIFICA. Escribe el evento `protocol.approved` en la auditoría y nada más: el paciente
    // se entera cuando el profesional le ENVÍA el reporte, que es otro acto. Mientras aprobar fue
    // inalcanzable la promesa era inofensiva; al conectar el botón se vuelve viva y falsa, y un texto que
    // le dice al profesional que el sistema avisa por él hace que no avise.
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
