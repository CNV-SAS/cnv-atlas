// ═══ COMO PAGA EL PACIENTE, DICHO UNA SOLA VEZ (Santiago, 2026-10-12) ═══
//
// ── POR QUE SALEN DE LA PANTALLA ──────────────────────────────────────────────────────────────────
//
// Los textos los escribio Santiago para /pagos el 2026-10-10, y al dia siguiente pidio que la venta en
// consulta dijera lo mismo: *"Que quede igual que /pagos."* Copiarlos a la segunda pantalla es como
// empiezan a divergir: se corrige una frase donde se vio el problema y la otra sigue diciendo lo de antes,
// y entonces el mismo medio se explica de dos maneras segun por donde se cobre. Es la misma razon por la
// que la cuenta de CNV vive en `cuenta-de-cnv.ts` y no en el JSX.
//
// MODULO NEUTRO (sin `"use client"` ni `server-only`): lo leen dos componentes de cliente. Ver la regla de
// fronteras RSC en CLAUDE.md.
//
// ── POR QUE WOMPI APARECE DOS VECES, Y NO ES UN DUPLICADO ─────────────────────────────────────────
//
// El medio en linea es UNO (Wompi). Lo que hay son dos PRESENTACIONES, y las dos existen porque el momento
// es distinto: en /pagos el cobro puede no ser presencial, asi que se manda un link; en la consulta el
// paciente esta delante, asi que se le muestra un QR. La parte que describe el medio es la misma frase
// compartida; lo que cambia es que se le entrega. Unificar las dos presentaciones en un solo bloque es el
// paso 2 de la unificacion de /pagos y Tratamiento, y entonces esto se reduce a una entrada.
//
// Las 24 horas son la vigencia del checkout de Wompi (la misma que ya citan `payments-service` y la
// conciliacion). Si Wompi la cambia, se cambia aqui y las dos pantallas lo dicen igual.

const EN_LINEA = "El paciente paga en línea (tarjeta de crédito, débito, PSE).";

export const MEDIOS_DE_PAGO = {
  efectivo: "El paciente te paga en efectivo. El dinero es de CNV y lo custodias hasta consignar.",
  transferencia: "El paciente transfiere directamente a la cuenta de CNV.",
  wompiLink: `${EN_LINEA} Link válido por 24 horas.`,
  wompiQr: `${EN_LINEA} El QR vale 24 horas.`,
  // BAJO DISTRIBUCION NO SE COBRA: el paciente le paga al integrante y el dinero no es de CNV, asi que el
  // boton que queda no dice "cobrar" y su nota tampoco puede hablar de custodiar nada.
  distribucion: "El paciente te paga a ti; esto suma a tu cuenta quincenal con CNV.",
} as const;
