import { addBusinessDays } from "@/core/dates/colombia-business-days";

// ═══ LA REVERSA DE UNA VENTA: QUE PASA EN CADA ESTADO (Bloque 3b, sesion 1) ═══
//
// Modulo PURO. Las reglas son de contabilidad (2026-09-16) y la idea central es una: SE SEPARA EL EFECTO DE CAJA
// DEL DE RESULTADO. El banco debita al abrirse la disputa, y eso es un hecho; pero el ingreso no se toca hasta
// perderla, porque la factura sigue siendo valida mientras la disputa viva.

// LA DEVOLUCION ES UNA CLASE MAS, y se agrega aqui y no aparte (2026-09-25). Nace resuelta ('devuelta': el
// producto ya volvio, no hay disputa que esperar) y revierte SOLO LA PARTE devuelta, no la venta entera.
//
// SE AGREGO AL TIPO PORQUE NO ESTABA, y faltar aqui no daba error, daba SILENCIO: el lector casteaba
// 'devuelta' a este tipo, la etiqueta del panel salia vacia, `loQuePideLaReversa` no reclamaba nada y el campo
// para escribir el numero de la nota credito no se mostraba. O sea: la devolucion movia el dinero y AVISABA
// que hacia falta una nota credito que no habia forma de registrar.
export type EstadoDeReversa = "abierta" | "ganada" | "perdida" | "devuelta";
export type TipoDeReversa = "contracargo" | "anulacion_wompi" | "devolucion";
export type Propiedad = "propio" | "tercero" | "mixto" | "desconocido";

/** Dias habiles para responderle al banco antes de que el aviso escale. Una disputa sin respuesta SE PIERDE. */
export const DIAS_PARA_RESPONDER_LA_DISPUTA = 3;
/** Dias habiles para la nota credito manual, contados desde la RESOLUCION en contra (contabilidad, D-3b-4). */
export const DIAS_PARA_LA_NOTA_CREDITO = 5;

export type Reversa = {
  id: string;
  transactionId: string;
  tipo: TipoDeReversa;
  estado: EstadoDeReversa;
  /** El monto de la VENTA, en pesos. */
  montoDeLaVenta: string;
  /** Lo que el banco debito de verdad; null si todavia no se sabe. */
  montoDebitado: string | null;
  propiedad: Propiedad;
  abiertaEn: string;
  resueltaEn: string | null;
  notaCredito: string | null;
};

const aNumero = (v: string | null): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * LA DIFERENCIA ENTRE LO DEBITADO Y LA VENTA ES LO ESPERADO, NO LA EXCEPCION (contabilidad, 2026-09-16): la
 * franquicia suele cobrar una cuota de manejo de la disputa y la comision de Wompi no se devuelve. Por eso esto
 * NO es un error: es un aviso de que hay algo que conciliar. Y la nota credito se emite SOLO por el valor de la
 * venta; esos cargos son gasto de CNV, no menor ingreso.
 */
export function diferenciaDelDebito(r: Pick<Reversa, "montoDeLaVenta" | "montoDebitado">): {
  hayDiferencia: boolean;
  diferencia: number | null;
  aviso: string | null;
} {
  const venta = aNumero(r.montoDeLaVenta);
  const debitado = aNumero(r.montoDebitado);
  if (venta === null || debitado === null) return { hayDiferencia: false, diferencia: null, aviso: null };
  const diferencia = Math.round((debitado - venta) * 100) / 100;
  if (diferencia === 0) return { hayDiferencia: false, diferencia: 0, aviso: null };
  const masOMenos = diferencia > 0 ? "más" : "menos";
  return {
    hayDiferencia: true,
    diferencia,
    aviso: `El débito difiere del valor de la venta en ${Math.abs(diferencia).toLocaleString("es-CO")} COP ${masOMenos}. La diferencia se concilia con contabilidad: la nota crédito va solo por el valor de la venta.`,
  };
}

export type EfectosDeResolver = {
  /** Revertir ingreso y comision con filas negativas. Solo al PERDER. */
  revierteElIngreso: boolean;
  /** Queda pendiente la nota credito manual en Alegra. Solo al PERDER. */
  pideNotaCredito: boolean;
};

export function efectosDe(estado: EstadoDeReversa): EfectosDeResolver {
  // GANADA: el banco repone y el ingreso nunca se movio. ABIERTA: el debito ya ocurrio, pero el ingreso tampoco
  // se toca. PERDIDA mueve el resultado, y DEVUELTA tambien: la factura emitida cobra un producto que el
  // paciente ya no tiene, asi que hay que corregirla. La diferencia entre las dos no es el efecto, es el ALCANCE
  // (la perdida se lleva la venta entera; la devuelta, solo la parte devuelta).
  const revierte = estado === "perdida" || estado === "devuelta";
  return { revierteElIngreso: revierte, pideNotaCredito: revierte };
}

const aMediodia = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

const comoDia = (f: Date): string =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;

/**
 * Hasta cuando hay para atender la reversa, y por que. Devuelve null cuando ya no pide nada (ganada, o perdida
 * con su nota credito escrita).
 */
export function loQuePideLaReversa(r: Reversa): { causa: string; limite: string; desde: string } | null {
  if (r.estado === "abierta") {
    return {
      causa: "Disputa abierta: hay que responderle al banco con los soportes. Sin respuesta a tiempo se pierde.",
      desde: r.abiertaEn,
      limite: comoDia(addBusinessDays(aMediodia(r.abiertaEn.slice(0, 10)), DIAS_PARA_RESPONDER_LA_DISPUTA)),
    };
  }
  if ((r.estado === "perdida" || r.estado === "devuelta") && !r.notaCredito) {
    const desde = r.resueltaEn ?? r.abiertaEn;
    // LA CAUSA Y EL VALOR SON DISTINTOS EN CADA UNA, y decirlo mal manda a emitir la nota crédito equivocada:
    // la disputa perdida se lleva la venta entera; la devolución, solo lo devuelto (`montoDebitado`, que en una
    // devolución guarda lo que hay que devolverle al paciente).
    const devuelto = aNumero(r.montoDebitado);
    const causa =
      r.estado === "devuelta"
        ? `Devolución registrada: falta la nota crédito manual en Alegra${devuelto != null ? `, por ${devuelto.toLocaleString("es-CO")} COP` : ""}, que es la parte devuelta y no la venta entera.`
        : "Disputa perdida: falta la nota crédito manual en Alegra, por el valor de la venta.";
    return {
      causa,
      desde,
      limite: comoDia(addBusinessDays(aMediodia(desde.slice(0, 10)), DIAS_PARA_LA_NOTA_CREDITO)),
    };
  }
  return null;
}

/**
 * Lo que hay que decirle a quien la mira, cuando el producto era de tercero: CNV devuelve el total al paciente y
 * ya le pago su parte al proveedor, sobre un margen mucho menor. No lo resuelve el codigo (la clausula es del
 * acuerdo comercial), pero queda registrado para poder reclamarlo.
 */
export function avisoDeTercero(r: Pick<Reversa, "propiedad" | "estado">): string | null {
  if (r.propiedad !== "tercero" && r.propiedad !== "mixto") return null;
  if (r.estado === "ganada") return null;
  return "Producto de tercero: CNV ya le pagó su parte al proveedor. Si la disputa se pierde, hay que reclamársela.";
}
