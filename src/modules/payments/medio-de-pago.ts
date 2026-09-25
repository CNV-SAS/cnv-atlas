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
 * COMO LLEGO LA PLATA A CNV. No es el instrumento (eso lo dice `payment_method_type`), es el camino:
 *
 *   · `wompi`         la pasarela;
 *   · `efectivo`      billetes, que quedan en poder del Integrante hasta que consigne;
 *   · `transferencia` el paciente consigno a una cuenta (2026-09-25).
 *
 * La transferencia existia en la practica desde antes de Atlas y solo se podia anotar como efectivo. No es
 * un matiz: el medio viaja a la factura electronica (la DIAN los separa) y decide la cuenta del pago.
 */
export type CanalDePago = "wompi" | "efectivo" | "transferencia";

/**
 * De Wompi a DIAN. Es la tabla de contabilidad del 2026-09-13, literal.
 *
 * LA REGLA PARA LO QUE VENGA, de contabilidad: si la plata sale de una cuenta o deposito, es transferencia
 * debito; si es plastico, la tarjeta que corresponda; si son billetes, efectivo.
 *
 * Lo que no esta aqui devuelve null y la factura sale sin medio, que es lo seguro: un instrumento nuevo de
 * Wompi no puede heredar por parecido el medio de otro. Se agrega aplicando esa regla, a proposito.
 */
export function medioDianDelPago(pago: {
  canal: CanalDePago;
  tipo: string | null;
  tipoTarjeta: string | null;
}): MedioDian | null {
  if (pago.canal === "efectivo") return "efectivo";
  // La regla de contabilidad, literal: si la plata sale de una cuenta o deposito, es transferencia debito.
  if (pago.canal === "transferencia") return "transferencia_debito";

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
export const CODIGO_ALEGRA: Record<
  MedioDian,
  { codigo: string; dian: string | null; evidencia: string } | null
> = {
  // ── LOS CUATRO, VERIFICADOS EN EL SANDBOX EL 2026-09-13 ──────────────────────────────────────
  //
  // El metodo, para quien tenga que repetirlo: Santiago elige el medio en una factura en BORRADOR desde la
  // pantalla de Alegra, y se lee por API que guardo. Nada de aqui salio de adivinar un nombre.
  //
  // UNA CORRECCION QUE VALE REGISTRAR: primero se escribio que las tarjetas "no existen en Alegra", porque
  // no aparecian en el desplegable. Existian: el listado expone el catalogo completo de la DIAN y estaban mas
  // abajo. Que no se vieran no significaba que no estuvieran, y la afirmacion se cayo en cuanto contabilidad
  // la corrigio. Es la misma leccion que la opinion del asesor legal: una ausencia no se afirma por no haber
  // mirado el sitio entero.
  tarjeta_credito: {
    codigo: "CREDIT_CARD",
    dian: "48",
    evidencia:
      "Factura SETP990214703 del sandbox: Santiago eligio 'Tarjeta credito' en la pantalla y la API devolvio CREDIT_CARD.",
  },
  tarjeta_debito: {
    codigo: "DEBIT_CARD",
    dian: "49",
    evidencia:
      "Factura SETP990214702 del sandbox: Santiago eligio 'Tarjeta debito' en la pantalla y la API devolvio DEBIT_CARD.",
  },
  transferencia_debito: {
    codigo: "DEBIT_TRANSFER",
    // 46, CONFIRMADO POR CONTABILIDAD EL 2026-09-13. Estuvo en null mientras tanto: el catalogo de la DIAN
    // tiene 46 ("Transferencia Debito Interbancario") y 47 ("Transferencia Debito Bancaria"), y el rotulo de
    // Alegra no decia cual. Contabilidad: "Transferencia debito" es el nombre abreviado del 46; el 47 es una
    // variante mas especifica que Alegra expone aparte como "Transferencia debito bancaria", y no se usa.
    dian: "46",
    evidencia:
      "Factura SETP990214702 del sandbox, en su PRIMERA lectura: Santiago eligio 'Transferencia debito' y la API devolvio DEBIT_TRANSFER. Despues esa misma factura se cambio a tarjeta debito para verificar ese codigo.",
  },
  efectivo: {
    codigo: "CASH",
    dian: "10",
    evidencia:
      "Factura SETP990214701 del sandbox: Santiago eligio 'Efectivo' en la pantalla y la API devolvio CASH.",
  },
};

// ── POR QUE SE MANDA EL CODIGO DE ALEGRA Y NO EL NUMERO DE LA DIAN ────────────────────────────
//
// Contabilidad pidio guardar el CODIGO NUMERICO y no la etiqueta, para que un cambio de redaccion en Alegra
// no rompa el envio. La preocupacion es correcta, y resulta que ya esta cubierta, aunque no por el numero:
//
//   · "CASH" NO ES LA ETIQUETA. La etiqueta es "Efectivo", la que ve la pantalla. "CASH" es el
//     identificador que usa la API, y no cambia si Alegra redacta distinto el rotulo.
//   · Y LA API NO MUESTRA EL NUMERO DE LA DIAN en lo que se leyo: los campos de medio y pago de la factura,
//     y el contenido del codigo QR de una factura sellada. El medio aparece solo como "CASH",
//     "CREDIT_CARD"... Donde queda el 10, el 48 o el 49 no se ha visto; lo razonable es que Alegra lo ponga
//     en el XML que manda a la DIAN, pero eso es inferencia, no algo leido.
//
// Asi que se ENVIA el codigo de Alegra (es el que su API devuelve y guarda) y se GUARDA al lado el numero de
// la DIAN que dio contabilidad, para trazabilidad y para que puedan cotejar sin traducir. Si algun dia hace
// falta mandar el numero, primero hay que ver que la API lo acepte.

// VISTO Y NO USADO: "Consignacion bancaria" guarda BANK_DEPOSIT (factura SETP990214703, antes de cambiarla a
// tarjeta credito). Contabilidad penso primero en ella (codigo DIAN 42) para PSE y Nequi, y luego los paso a
// transferencia debito. Queda anotado para que nadie tenga que volver a averiguarlo si esa decision cambia.

/** Lo que viaja a Alegra: el codigo si esta verificado, nada si no. */
export function codigoAlegraDelPago(pago: {
  canal: CanalDePago;
  tipo: string | null;
  tipoTarjeta: string | null;
}): string | null {
  const medio = medioDianDelPago(pago);
  return medio ? (CODIGO_ALEGRA[medio]?.codigo ?? null) : null;
}
