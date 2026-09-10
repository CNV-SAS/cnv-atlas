import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL CABLE DE LA EMISION (sucede a `aprobar-protocolo-cableado`, 2026-09-09).
//
// EL DEFECTO QUE CERRO LA PRIMERA VEZ, y por eso el candado existe: `approveProtocolAction` tenia toda su
// vertical debajo (policy, servicio con cuatro gates, writer transaccional con audit inline, trigger de
// inmutabilidad, dos suites de tests) y NINGUNA PANTALLA LA INVOCABA. No habia forma de sellar nada, y
// todo plan que le llegaba a un paciente salia de una prescripcion en borrador.
//
// Y POR QUE EL CANDADO VA SOBRE EL SITIO DE LLAMADA y no sobre la accion: la accion estaba bien y estaba
// probada. Lo que faltaba era que alguien la llamara, asi que un test de la accion seguia verde con el
// hueco abierto. Cuando el defecto es una OMISION, se prueba el sitio de llamada.
//
// ═══ EL ACTO CAMBIO DE FORMA, EL HUECO ES EL MISMO (2026-09-09) ═══
//
// Santiago reporto que el acto de sellar CONFUNDE, y el hallazgo le dio la razon: el plan impreso, el del
// correo y la historia clinica se arman los tres del protocolo VIVO, asi que aprobar los protegia por
// EFECTO LATERAL (congelaba los `adj_*`), no por diseño. Se separo sellar de cerrar: la prescripcion queda
// siempre abierta y cada salida deja una copia inmutable.
//
// LA REGLA NO CAMBIA: el hueco de entonces era una accion que nadie invocaba; el hueco de ahora seria una
// salida hacia el paciente que no deja constancia. Es el mismo, con otra forma. Lo que este candado blinda
// son las DOS vias por las que un plan sale de la clinica: IMPRIMIRLO y ENVIARLO.

const PANEL = sinComentarios(readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8"));
const ACTIONS = sinComentarios(readFileSync("src/modules/treatment/actions.ts", "utf8"));
const ENVIO = sinComentarios(readFileSync("src/modules/reports/services/send-report.ts", "utf8"));
const BOTON = sinComentarios(
  readFileSync("src/modules/reports/components/plan-imprimir-boton.tsx", "utf8"),
);
const SERVICIO = sinComentarios(
  readFileSync("src/modules/treatment/services/treatment-service.ts", "utf8"),
);

describe("un plan no sale hacia el paciente sin dejar constancia", () => {
  it("VIA 1 · enviar el reporte emite la prescripcion", () => {
    expect(ENVIO).toContain("await emitirPrescripcion(");
    expect(ENVIO).toContain('"correo",');
  });

  it("y emite ANTES de armar el plan: si el sello falla, no se envia nada", () => {
    // El plan se lee EN VIVO del protocolo. Si el orden se invierte, un fallo al registrar dejaria un
    // correo enviado sin constancia de que salio, que es justo lo que esta pieza existe para impedir.
    const iEmite = ENVIO.indexOf("await emitirPrescripcion(");
    const iPlan = ENVIO.indexOf("await getPlanPaciente(");
    expect(iEmite, "no se encontro la emision en el envio").toBeGreaterThan(-1);
    expect(iPlan, "no se encontro el armado del plan").toBeGreaterThan(-1);
    expect(iEmite, "el plan se arma antes de registrar la entrega").toBeLessThan(iPlan);
  });

  it("VIA 2 · imprimir el plan registra la entrega", () => {
    // AQUI SE INVIERTE UN ARGUMENTO ANTERIOR, y se deja escrito para que nadie lo revierta creyendo que
    // fue un descuido. Hasta hoy imprimir NO sellaba, con esta razon: "imprimir es LEER; se imprime para
    // revisar, y dos veces si salio torcida; convertir una lectura en una firma es lo contrario de lo que
    // un acto clinico debe ser". Ese argumento era correcto MIENTRAS emitir CERRARA la prescripcion.
    // Ahora emitir solo REGISTRA: dos impresiones dejan dos lineas que dicen la verdad. La objecion se
    // disuelve porque la pieza que la causaba ya no esta.
    expect(ACTIONS).toContain("export async function registrarPlanImpresoAction");
    expect(ACTIONS).toContain('"impresa",');
    expect(BOTON).toContain("useActionState(registrarPlanImpresoAction");
    expect(BOTON).toContain("window.print()");
  });

  it("y el boton imprime YA, sin esperar al registro", () => {
    // Al reves, el profesional esperaria a la nube para ver el dialogo de impresion, que es la peor forma
    // de pagar una constancia. El registro viaja en paralelo.
    // EL ANCLA SE MUEVE, NO LA ASERCION (2026-09-10): la invocacion pasó por `ejecutarAccion`, que hace el
    // `startTransition` ademas de armar el guard del scroll. Lo que se afirma sigue siendo lo mismo: que
    // la accion se lanza en una transicion y no bloquea.
    expect(BOTON).toContain("ejecutarAccion(");
    expect(BOTON, "el registro dejo de ir en paralelo con la impresion").toMatch(
      /ejecutarAccion\([\s\S]{0,80}\);\s*window\.print\(\);/,
    );
  });

  it("la emision registra POR CUAL via salio", () => {
    // Entregar en mano y enviar por correo no son lo mismo si alguien pregunta despues. Va DENTRO de la
    // copia, que es inmutable: o se escribe en el acto, o ya no se puede añadir.
    expect(SERVICIO).toContain("prescripcion: { ...sellada.payload, via }");
    expect(SERVICIO).toContain('via: "impresa" | "correo"');
  });

  it("y NO hay un acto suelto de sellar: ni boton, ni aprobacion, ni reapertura", () => {
    // Mientras exista uno, vuelve el tramite que Santiago reporto. Las tres piezas se retiraron juntas
    // porque las tres pertenecian al mismo mecanismo: sellar CERRANDO.
    expect(PANEL, "volvio el boton de aprobar suelto").not.toContain("Aprobar la prescripción");
    expect(PANEL, "volvio el boton de reabrir").not.toContain("Reabrir la prescripción");
    expect(ACTIONS, "volvio la accion de aprobar").not.toContain(
      "export async function approveProtocolAction",
    );
    expect(ACTIONS, "volvio la accion de reabrir").not.toContain(
      "export async function reopenProtocolAction",
    );
    expect(SERVICIO, "volvio el servicio de aprobar").not.toContain(
      "export async function approveProtocol(",
    );
  });
});

describe("la prescripcion queda abierta, y eso se dice", () => {
  it("nada la bloquea: no hay `locked` en el panel", () => {
    // Era `const locked = protocol.approved`, y de ahi colgaban veinte `fieldset disabled`. Si vuelve,
    // vuelve el bloqueo que Santiago pidio quitar.
    expect(PANEL, "volvio el bloqueo de edicion del panel").not.toContain("locked");
  });

  it("mientras no se ha entregado nada, el panel LO DICE", () => {
    // Sin boton, el estado tiene que decirse: una prescripcion que nadie ha entregado se lee igual que una
    // entregada si nada la distingue. Es informacion, no un mando.
    expect(PANEL).toContain("protocol.emisiones.length === 0");
    expect(PANEL).toContain("Todavía no le has entregado este plan al paciente.");
  });

  it("y cuando ya se entrego, avisa de lo que eso obliga (§12c)", () => {
    // LA GARANTIA CLINICA QUE SOBREVIVE AL CANDADO. Si el paciente ya tiene una version y el profesional
    // cambia lo que come, hay que decirselo. Ese requisito no dependia del bloqueo; dependia de que
    // alguien hubiera recibido algo.
    expect(PANEL).toContain("function EntregasRegistradas(");
    expect(PANEL).toMatch(/vuelve a entregársela/);
  });
});

describe("y el texto no promete un aviso que el sistema no manda", () => {
  it("ninguna cadena dice que el sistema le avisa al paciente", () => {
    // Emitir registra la salida y nada mas. Un texto que le diga al profesional que el sistema avisa por
    // el hace que NO avise. Su §12c exige que se le diga; lo que no existe es el automatismo.
    expect(PANEL).not.toMatch(/se le avisar[aá]/);
  });

  it("y en su lugar dice lo que el profesional tiene que hacer", () => {
    // CONTROL de la asercion negativa: sin esto, borrar el parrafo entero tambien pasaria verde, y
    // borrarlo perderia el requisito en vez de decirlo bien.
    expect(PANEL).toMatch(/no se lo avisa solo/);
  });
});
