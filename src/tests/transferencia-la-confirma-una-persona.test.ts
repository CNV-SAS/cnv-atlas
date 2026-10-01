import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO: LA AUTOMATIZACION NO AFIRMA EL PAGO DE UNA TRANSFERENCIA ═══
//
// EL CRITERIO ES DE SANTIAGO (2026-10-01): "la unica forma de verificar una transferencia es que alguien se
// meta a ver la cuenta bancaria y compruebe el pago". El efectivo lo tiene el Integrante en la mano y Wompi
// lo confirma la pasarela; una transferencia solo la confirma el extracto.
//
// LO QUE PROTEGE, y es una sola cosa con dos caras:
//
//   1 · Que la cola NO apunte sola el pago de una transferencia. Mapear esa cuenta en la configuracion
//       volveria a registrarlo automaticamente, y entonces Atlas afirmaria un pago que nadie comprobo. El
//       mecanismo quedaria desactivado SIN QUE NADIE TOCARA ESTE CODIGO, que es la unica forma en que estos
//       defectos vuelven.
//   2 · Y que, cuando una persona lo confirma, quede ESCRITO quien y cuando. Esto registra un pago en un
//       documento fiscal: tiene que poder responder "¿quien dijo que entro?" seis meses despues.
//
// ── POR QUE MIRA EL CODIGO FUENTE ──
//
// Lo que hay que vigilar es una AUSENCIA (que nadie mapee la cuenta para la cola) y una PRESENCIA en un
// camino que mueve dinero de verdad. Un test de comportamiento necesitaria llamar a Alegra.

const SERVICIO = sinComentarios(readFileSync("src/modules/payments/services/facturacion-service.ts", "utf8"));
const REPO = sinComentarios(readFileSync("src/modules/payments/data/facturacion-repository.ts", "utf8"));
const PURO = sinComentarios(readFileSync("src/modules/payments/facturacion.ts", "utf8"));
const ACCION = sinComentarios(readFileSync("src/modules/payments/actions.ts", "utf8"));

describe("la cola no apunta sola el pago de una transferencia", () => {
  // LA REGLA VIVE EN EL MODULO PURO, y por eso se comprueba ahi: `cuentaDelPago` devuelve null para una
  // transferencia sin su cuenta configurada, y quien llama decide. Lo que NO puede es heredar la del
  // efectivo, porque esa cuenta dice "la plata esta en el bolsillo de alguien".
  it("la transferencia no hereda la cuenta del efectivo", () => {
    expect(PURO).toContain("bankAccountTransferenciaId");
    // ── SE MIRA SU RAMA, NO EL ARCHIVO ──
    //
    // La primera version buscaba "transferencia" y, 200 caracteres despues, "bankAccountEfectivoId": casaba
    // con la declaracion del tipo (donde los cuatro canales van seguidos) y con la rama LEGITIMA del
    // efectivo. Fallaba contra el codigo correcto. Lo que hay que mirar es la rama de la transferencia.
    const i = PURO.indexOf('if (canal === "transferencia")');
    expect(i, "desaparecio la rama de la transferencia en cuentaDelPago").toBeGreaterThan(-1);
    const rama = PURO.slice(i, PURO.indexOf("}", i));
    // El fallback prohibido: con `?? mapa.bankAccountEfectivoId`, el pago se apuntaria a la cuenta que dice
    // "la plata esta en el bolsillo de alguien", y la cifra de efectivo por recoger subiria sola.
    expect(rama).not.toContain("bankAccountEfectivoId");
    expect(rama).toContain("bankAccountTransferenciaId");
  });

  // Y EL CAMINO AUTOMATICO TIENE QUE SEGUIR DICIENDO QUE NO LO REGISTRA. Si alguien quita esta rama, la cola
  // empezaria a intentarlo, y el unico sintoma seria un pago afirmado por nadie.
  it("el flujo automatico deja el pago en espera y dice por que", () => {
    expect(SERVICIO).toMatch(/canal === "transferencia"/);
    expect(SERVICIO).toContain("bank_account_transferencia_id");
  });
});

describe("cuando una persona la confirma, queda escrito quien y cuando", () => {
  it("el servicio existe y exige que sea transferencia, facturada y sin pago", () => {
    expect(SERVICIO).toContain("confirmarPagoDeTransferencia");
    // Las tres comprobaciones no son defensa de formulario: cada una evita un apunte contable falso.
    expect(SERVICIO).toMatch(/canal !== "transferencia"/);
    expect(SERVICIO).toMatch(/estadoDeFactura !== "emitida"/);
    expect(SERVICIO).toMatch(/venta\.pagoDeAlegra/);
  });

  it("escribe el responsable y la fecha EN LA MISMA sentencia que el id del pago", () => {
    // SI FUERAN DOS ESCRITURAS, un fallo entre ellas dejaria un pago registrado sin responsable, que es
    // exactamente lo que estas columnas vienen a evitar.
    const i = REPO.indexOf("marcarTransferenciaVerificada");
    expect(i, "desaparecio la escritura de la confirmacion").toBeGreaterThan(-1);
    const cuerpo = REPO.slice(i, i + 900);
    expect(cuerpo).toContain("alegra_payment_id = ");
    expect(cuerpo).toContain("transferencia_verificada_at = now()");
    expect(cuerpo).toContain("transferencia_verificada_by");
    // Y LA CONDICION IMPIDE EL DOBLE APUNTE: dos administradores mirando el mismo extracto es el caso
    // normal, no el raro.
    expect(cuerpo).toContain("alegra_payment_id is null");
  });

  it("y solo lo puede hacer quien ve el extracto, no el profesional", () => {
    const i = ACCION.indexOf("confirmarTransferenciaAction");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = ACCION.slice(i, i + 1200);
    // `canViewRevenue` es admin y direccion. El Integrante no ve la cuenta bancaria de CNV, asi que pedirle
    // que afirme el pago seria pedirle que afirme algo que no puede comprobar.
    expect(cuerpo).toContain("canViewRevenue");
  });
});
