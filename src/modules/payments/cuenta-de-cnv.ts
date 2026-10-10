// ═══ A DONDE TRANSFIERE EL PACIENTE (Santiago, 2026-10-10) ═══
//
// ── POR QUE ESTO ESTABA FALTANDO ──────────────────────────────────────────────────────────────────
//
// /pagos ofrecia "transferencia" como medio desde el 2026-09-25, pero NO DECIA A DONDE. O sea que el medio
// existia y el integrante tenia que saberse la cuenta de memoria o preguntar por interno, con el paciente
// delante. Un medio sin su destino no es un medio: es una etiqueta.
//
// ── POR QUE AQUI Y NO EN LA PANTALLA ──────────────────────────────────────────────────────────────
//
// Porque el mismo dato va a hacer falta en la venta en consulta (el paso 2 de la unificacion), y una cuenta
// bancaria copiada en dos pantallas es una cuenta que el dia que cambie quedara bien en una y mal en la
// otra. El dinero iria a una cuenta que ya no es.
//
// MODULO NEUTRO a proposito (sin `"use client"` ni `server-only`): lo lee la tarjeta de cobro, que es un
// componente de cliente, y manana lo leera la de consulta. Ver la regla de fronteras RSC en CLAUDE.md.
//
// ── DE DONDE SALEN LOS NUMEROS ────────────────────────────────────────────────────────────────────
//
// Los dio Santiago el 2026-10-10. No son un dato clinico ni derivado de nada: son las cuentas de CNV, y la
// unica fuente posible es quien las administra. Si cambian, se cambian aqui.
export const CUENTA_DE_CNV = {
  titular: "Connected Nutrition Ventures",
  llaveBreb: "0091434451",
  banco: "Bancolombia",
  tipoDeCuenta: "ahorros",
  numeroDeCuenta: "00200026997",
} as const;

/**
 * QUE HACE EL INTEGRANTE DESPUES DE QUE EL PACIENTE TRANSFIERE.
 *
 * Va aqui y no suelto en la pantalla porque es la mitad que se olvida: sin el comprobante, admin no puede
 * cotejar la transferencia contra el extracto, y la venta queda registrada sin forma de confirmar que el
 * dinero llego. Lo automatico vendra despues (Santiago: *"despues automatizamos mejor"*); hoy es un paso
 * manual, y un paso manual que no esta escrito en la pantalla es un paso que no se hace.
 */
export const QUE_HACER_CON_EL_COMPROBANTE =
  "Pídele la captura de la transferencia y mándasela a admin por interno.";
