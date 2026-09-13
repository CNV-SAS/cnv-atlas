// ═══ EL MEDIO DE PAGO DE LA FACTURA ═══
//
// Modulo PURO. Traduce "con que pago el paciente" (lo que dice Wompi) a "que medio de pago lleva la factura"
// (lo que pide la DIAN) y de ahi al CODIGO que espera la API de Alegra.
//
// ── TRES VOCABULARIOS DISTINTOS, y confundirlos es el defecto que este archivo evita ─────────────
//
//   1. WOMPI:  CARD, PSE, NEQUI, BANCOLOMBIA_TRANSFER...   (y "CARD" no dice si es credito o debito)
//   2. DIAN:   la tabla de contabilidad, del 2026-09-13
//   3. ALEGRA: un CODIGO en mayusculas, NO el rotulo que muestra su pantalla
//
// El tercero se verifico antes de escribir nada: la unica factura del sandbox hecha a mano guarda
// `paymentMethod: "INSTRUMENT_NOT_DEFINED"` para lo que la pantalla muestra como "Instrumento no definido".
// Mandar el rotulo "Transferencia debito" habria sido mandar un valor que Alegra no reconoce.
//
// ── LA REGLA QUE HACE ESTO SEGURO: UN CODIGO NO VERIFICADO NO SE ENVIA ──────────────────────────
//
// El campo es INFORMATIVO (no cambia impuestos ni valores, confirmado por contabilidad), asi que dejarlo
// "no definido" no tiene efecto fiscal. Mandar un codigo que Alegra no reconozca, en cambio, puede rechazar
// la factura ENTERA. Asi que cada codigo de Alegra entra a la tabla solo con su evidencia, y mientras no
// este, el medio se resuelve pero no viaja: la factura sale como hoy, y nada se rompe.

/** Los medios de pago DIAN que usa CNV, tal como los nombro contabilidad. */
export type MedioDian = "tarjeta_credito" | "tarjeta_debito" | "transferencia_debito" | "efectivo";

/**
 * De Wompi a DIAN. Es la tabla de contabilidad del 2026-09-13, literal.
 *
 * Lo que no esta aqui devuelve null y la factura sale sin medio, que es lo seguro: un instrumento nuevo de
 * Wompi no puede heredar por parecido el medio de otro.
 */
export function medioDianDelPago(pago: {
  canal: "wompi" | "efectivo";
  tipo: string | null;
  tipoTarjeta: string | null;
}): MedioDian | null {
  if (pago.canal === "efectivo") return "efectivo";

  switch ((pago.tipo ?? "").toUpperCase()) {
    case "CARD":
      // "CARD" NO DICE SI ES CREDITO O DEBITO, y la tabla de contabilidad los separa. La diferencia viaja en
      // `payment_method.extra.card_type`. Sin ese dato no se adivina: una tarjeta sin tipo no es "credito
      // por defecto", es un medio que no se conoce.
      switch ((pago.tipoTarjeta ?? "").toUpperCase()) {
        case "CREDIT":
          return "tarjeta_credito";
        case "DEBIT":
          return "tarjeta_debito";
        default:
          return null;
      }
    case "PSE":
    case "NEQUI":
    case "BANCOLOMBIA_TRANSFER":
    // Bre-B. Contabilidad lo pone con las transferencias; el nombre exacto que usa Wompi para Bre-B no se
    // ha visto todavia en un evento real, asi que se aceptan los dos que razonablemente puede tener.
    case "BREB":
    case "BRE_B":
      return "transferencia_debito";
    default:
      return null;
  }
}

/**
 * De DIAN al CODIGO de Alegra, SOLO CON LOS VERIFICADOS.
 *
 * Un `null` no es un olvido: es un codigo cuyo valor exacto en la API todavia no se ha visto en una factura
 * real. Verificar uno es poner ese medio en una factura del sandbox desde la pantalla de Alegra y leer por
 * API que guardo; entonces se escribe aqui con su evidencia al lado.
 */
export const CODIGO_ALEGRA: Record<MedioDian, { codigo: string; evidencia: string } | null> = {
  tarjeta_credito: null,
  tarjeta_debito: null,
  transferencia_debito: null,
  efectivo: null,
};

/** Lo que viaja a Alegra: el codigo si esta verificado, nada si no. */
export function codigoAlegraDelPago(pago: {
  canal: "wompi" | "efectivo";
  tipo: string | null;
  tipoTarjeta: string | null;
}): string | null {
  const medio = medioDianDelPago(pago);
  return medio ? (CODIGO_ALEGRA[medio]?.codigo ?? null) : null;
}
