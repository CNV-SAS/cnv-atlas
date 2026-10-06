import { addBusinessDays } from "@/core/dates/colombia-business-days";
import { IVA_RATE, baseFromTotal } from "@/core/iva";

// ═══ EL RECAUDO DE LA MODALIDAD DISTRIBUCION (2026-09-29) ═══
//
// MODULO PURO: la aritmetica y el calendario de la cuenta quincenal que CNV le cobra al Integrante, sin base
// y sin reloj propio. Igual que `liquidacion.ts` y `reparto.ts`, y por la misma razon: son las cifras que
// deciden cuanta plata cambia de manos entre dos personas, y tienen que poder probarse enteras.
//
// ── LA DIFERENCIA CON LA MODALIDAD COMISION, en una linea ──
//
// Bajo Comision el paciente le paga a CNV y CNV le liquida su comision al Integrante (`liquidacion.ts`).
// Bajo Distribucion la propiedad pasa de CNV al Integrante y de este al paciente EN UN MISMO ACTO: el
// paciente le paga AL INTEGRANTE, el le factura al paciente con su propia numeracion, y CNV le factura a EL
// cada quincena. O sea que el dinero corre al reves, y por eso esto no es una variante de la liquidacion
// sino otra cuenta.
//
// TODAS LAS CIFRAS Y PLAZOS SALEN DEL MODELO COMERCIAL §4 Y §5, no de nosotros. Cada uno lleva su cita.

/** Descuento comercial del Integrante bajo Distribucion (modelo §4: 20% sobre la base sin IVA). */
export const DESCUENTO_DISTRIBUCION = 0.2;

/** Retefuente por compra de bienes que el Integrante agente retenedor le practica a CNV (§4.1: 2,5%). */
export const RETEFUENTE_COMPRA = 0.025;

/** Base minima para esa retencion (§4.1: 27 UVT). */
export const UVT_MINIMA_RETEFUENTE = 27;

const alPeso = (n: number) => Math.round(n);

export type PrecioDeFacturacion = {
  /** La base sin IVA del PVP, antes del descuento. */
  base: number;
  /** La base ya descontada: es la que va en la factura. */
  baseDescontada: number;
  /** IVA del 19% RECALCULADO sobre la base descontada, no el del PVP. */
  iva: number;
  total: number;
};

/**
 * El precio al que CNV le factura una unidad al Integrante.
 *
 * EL MODELO LO FIJA CON SU EJEMPLO (§4): "producto de base 100.000 y PVP 119.000: base descontada 80.000,
 * IVA 15.200, total 95.200 por unidad". Y añade la comprobacion rapida: equivale a multiplicar el PVP con
 * IVA por 0,80.
 *
 * LA FACTURA DISCRIMINA BASE E IVA, y por eso esta funcion devuelve las dos. Textual del modelo: "la factura
 * debe discriminar base descontada e IVA por separado, no presentar un total con IVA incluido". No es
 * formato: el descuento tiene que verse como descuento comercial efectivo al momento de la venta para que
 * reduzca validamente la base gravable del IVA.
 */
export function precioDeFacturacion(pvpConIva: number, descuento = DESCUENTO_DISTRIBUCION): PrecioDeFacturacion {
  const base = baseFromTotal(pvpConIva);
  const baseDescontada = alPeso(base * (1 - descuento));
  const iva = alPeso(baseDescontada * IVA_RATE);
  return { base, baseDescontada, iva, total: baseDescontada + iva };
}

// ── EL FLETE SALIO DE ESTA CUENTA (2026-10-05) ──────────────────────────────────────────────────────
//
// AQUI VIVIA `fleteFacturado`, y la cuenta quincenal sumaba los fletes de los envios del periodo, porque el
// modelo §5.3 los ponia en la factura del Integrante. La decision contable del 2026-10-05 saco el flete de
// CNV: el paciente le paga el envio al mensajero, asi que no hay flete que facturarle a nadie.
//
// SE RETIRA EN VEZ DE DEJARSE EN CERO, y es la diferencia que importa: una funcion viva que nadie llama
// invita a volver a llamarla, y la cuenta quincenal es el documento con el que CNV le cobra a una persona.
// Nunca llego a sumar un flete real (la lista entraba vacia desde los dos sitios que la armaban), asi que
// no hay cuenta vieja que necesite reproducir esta aritmetica.

export type Corte = {
  /** Primer dia del periodo (AAAA-MM-DD). */
  desde: string;
  /** Ultimo dia del periodo (AAAA-MM-DD), que es el dia del corte. */
  hasta: string;
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const aMediodia = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

/** El ultimo dia del mes de esa fecha. */
function finDeMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
}

/**
 * El corte al que pertenece un dia. Modelo §4: "dias 15 y ultimo de cada mes".
 *
 * EL DIA 15 PERTENECE A LA PRIMERA QUINCENA y el ultimo del mes a la segunda: el corte es el dia en que se
 * cierra, no el primero del siguiente. Escrito asi porque es la clase de limite que se resuelve distinto en
 * dos sitios y descuadra una factura entera.
 */
export function corteDe(dia: string): Corte {
  const d = aMediodia(dia);
  if (d.getDate() <= 15) {
    return { desde: ymd(new Date(d.getFullYear(), d.getMonth(), 1, 12)), hasta: ymd(new Date(d.getFullYear(), d.getMonth(), 15, 12)) };
  }
  return { desde: ymd(new Date(d.getFullYear(), d.getMonth(), 16, 12)), hasta: ymd(finDeMes(d)) };
}

export type PlazosDelCorte = {
  /** Hasta cuando CNV tiene para emitir: dos dias habiles siguientes al corte (§4). */
  emitirHasta: string;
  /** Hasta cuando el Integrante puede objetar: dos dias habiles desde la factura (§4). */
  objetarHasta: string;
  /** Hasta cuando CNV corrige una objecion: tres dias habiles (§4). */
  corregirHasta: string;
  /** Hasta cuando tiene para pagar: tres dias habiles desde la recepcion de la factura (§4). */
  pagarHasta: string;
  /** Desde cuando hay mora: tres dias CALENDARIO pasado el plazo de pago (§4). */
  moraDesde: string;
  /** Desde cuando CNV puede revertir a Comision o terminar la consignacion: diez dias (§4). */
  reversionDesde: string;
};

const masHabiles = (dia: string, n: number) => ymd(addBusinessDays(aMediodia(dia), n));
const masCalendario = (dia: string, n: number) => {
  const d = aMediodia(dia);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/**
 * El calendario del corte. `emitidaEl` es cuando la factura llega de verdad: los plazos del Integrante
 * cuelgan de la RECEPCION, no del corte, asi que una factura tardia no le come el plazo de pago.
 */
export function plazosDelCorte(corte: Corte, emitidaEl?: string): PlazosDelCorte {
  const emitirHasta = masHabiles(corte.hasta, 2);
  const recibida = emitidaEl ?? emitirHasta;
  const pagarHasta = masHabiles(recibida, 3);
  return {
    emitirHasta,
    objetarHasta: masHabiles(recibida, 2),
    corregirHasta: masHabiles(recibida, 3),
    pagarHasta,
    // MORA EN DIAS CALENDARIO, no habiles: el modelo dice "tres dias calendario del plazo" y diez para la
    // reversion. Mezclar las dos unidades en la misma cuenta es como se descuadra un plazo sin que nadie lo note.
    moraDesde: masCalendario(pagarHasta, 3),
    reversionDesde: masCalendario(pagarHasta, 10),
  };
}

/**
 * El precio de facturacion de UNA LINEA YA VENDIDA, a partir de lo que se SELLO en ella.
 *
 * POR QUE NO SE RECALCULA DESDE EL PVP: la venta sello su base y el descuento del Integrante en el momento
 * (`base_amount` y `commission_amount`, migracion 0143). Volver a calcularlos con el precio y la tasa de HOY
 * produciria una factura que no coincide con la venta que la origina, y es justo lo que el sellado existe
 * para impedir. Es la misma disciplina del reparto y del precio del faltante.
 *
 * Y SIRVE IGUAL PARA PRODUCTO DE TERCERO: el descuento del Integrante es su `commission_amount`, y lo que CNV
 * le factura es la base menos ESE descuento, no el residuo de CNV. En un producto de tercero el residuo es
 * mas chico (el proveedor se lleva su parte), y facturar por el residuo cobraria de menos.
 */
export function precioDeFacturacionSellado(baseSellada: number, descuentoSellado: number): PrecioDeFacturacion {
  const base = alPeso(baseSellada);
  const baseDescontada = base - alPeso(descuentoSellado);
  const iva = alPeso(baseDescontada * IVA_RATE);
  return { base, baseDescontada, iva, total: baseDescontada + iva };
}

export type LineaDeLaCuenta = {
  transactionId: string;
  /** El dia de la venta, para que el Integrante pueda cotejarla con su propia facturacion. */
  dia: string;
  producto: string;
  cantidad: number;
  /** `base_amount` de la linea: la base sin IVA de TODA la linea, sellada en la venta. */
  baseSellada: number;
  /** `commission_amount` de la linea: el descuento comercial del Integrante, sellado en la venta. */
  descuentoSellado: number;
};

export type CuentaQuincenal = {
  corte: Corte;
  /** Suma de las bases descontadas de los productos. */
  baseProductos: number;
  /** Base gravada total. Son solo los productos: el flete salio de CNV el 2026-10-05. */
  base: number;
  iva: number;
  total: number;
  /** Lo que el Integrante le retiene a CNV, si es agente retenedor y la base supera el minimo (§4.1). */
  retencionDelIntegrante: number;
  /** Lo que CNV espera recibir: total menos la retencion. Alimenta la proyeccion de caja (§4.1). */
  netoEsperado: number;
  /** Cuantas ventas la componen. Cero = NO SE EMITE FACTURA (§4, textual). */
  ventas: number;
  detalle: (LineaDeLaCuenta & PrecioDeFacturacion)[];
};

/**
 * LA CUENTA DE UN CORTE.
 *
 * `esAgenteRetenedor` sale del RUT del Integrante (codigo 07). La retencion REDUCE EL NETO PERO NO EL
 * INGRESO: CNV reconoce el ingreso completo y la retencion es un anticipo de renta a su favor, soportado en
 * el certificado que expide el Integrante (§4.1). Por eso va como campo aparte y no restada del total.
 */
export function armarCuentaQuincenal(e: {
  corte: Corte;
  lineas: LineaDeLaCuenta[];
  esAgenteRetenedor: boolean;
  uvt: number;
}): CuentaQuincenal {
  const detalle = e.lineas.map((l) => ({ ...l, ...precioDeFacturacionSellado(l.baseSellada, l.descuentoSellado) }));

  // LA BASE Y EL IVA SE SUMAN POR LINEA, cada uno ya redondeado al peso. Sumar primero y redondear despues
  // daria otra cifra, y la que tiene que cuadrar es la que el Integrante ve linea por linea en el detalle:
  // una factura cuyo total no es la suma de sus renglones es una factura que nadie puede objetar.
  const baseProductos = detalle.reduce((s, l) => s + l.baseDescontada, 0);
  const ivaProductos = detalle.reduce((s, l) => s + l.iva, 0);

  const base = baseProductos;
  const iva = ivaProductos;
  const total = base + iva;

  // LA RETENCION VA SOBRE LA BASE, NUNCA SOBRE EL IVA. Es el mismo error clasico que ya esta evitado en la
  // liquidacion de la comision, y aqui vale igual.
  const minimo = e.uvt * UVT_MINIMA_RETEFUENTE;
  const retencionDelIntegrante = e.esAgenteRetenedor && base > minimo ? alPeso(base * RETEFUENTE_COMPRA) : 0;

  return {
    corte: e.corte,
    baseProductos,
    base,
    iva,
    total,
    retencionDelIntegrante,
    netoEsperado: total - retencionDelIntegrante,
    ventas: e.lineas.length,
    detalle,
  };
}

/**
 * ¿Se le puede despachar mas inventario?
 *
 * Modelo §4: "Cupo de credito. Tope de saldo pendiente por Integrante. Al alcanzarlo, el sistema SUSPENDE EL
 * DESPACHO de nuevo inventario hasta que se ponga al dia". Y la mora lo suspende tambien, pasados tres dias
 * calendario del plazo.
 *
 * SIN CUPO CONFIGURADO NO SE SUSPENDE. Un cupo nulo significa "no se ha fijado", no "cero": tratarlo como
 * cero bloquearia a todos los Integrantes el dia que se despliegue, que es peor que no tener el control.
 */
export function puedeDespacharse(e: {
  saldoPendiente: number;
  cupo: number | null;
  /** La factura mas vieja sin pagar, si esta en mora (dia en que empezo la mora). null = no hay mora. */
  enMoraDesde: string | null;
}): { puede: boolean; motivo: string | null } {
  if (e.enMoraDesde) {
    return {
      puede: false,
      motivo: `Tiene una factura en mora desde el ${e.enMoraDesde}. Los despachos se reanudan cuando se ponga al día.`,
    };
  }
  if (e.cupo != null && e.saldoPendiente >= e.cupo) {
    return {
      puede: false,
      motivo: `Alcanzó su cupo de crédito (${e.saldoPendiente.toLocaleString("es-CO")} de ${e.cupo.toLocaleString("es-CO")}). Los despachos se reanudan cuando pague.`,
    };
  }
  return { puede: true, motivo: null };
}
