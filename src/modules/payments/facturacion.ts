import { baseFromTotal, ivaFromTotal } from "@/core/iva";

// ═══ LO QUE VIAJA A LA FACTURA, Y LO QUE IMPIDE QUE VIAJE MAL ═══
//
// Modulo PURO y NEUTRO (ni `server-only` ni `"use client"`): decide la forma del documento y no habla con
// nadie. Se puede probar entero sin base de datos y sin red, que es lo que hace que estas reglas se
// puedan verificar de verdad en vez de confiarlas a un smoke.
//
// ── EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR ─────────────────────────────────────────────
//
// UNA FACTURA SIN IVA NO FALLA. Si una linea viaja sin `tax`, Alegra factura al 0% aunque el item lo
// tenga configurado, LA DIAN LA VALIDA, y sale un documento legalmente emitido al que le falta el IVA.
// Nadie se entera: no hay error, no hay reintento, no hay alerta. En produccion eso es IVA no cobrado que
// CNV asume de su margen, y se descubre en la declaracion bimestral.
//
// Por eso la validacion es PREVIA y no una revision posterior: despues de emitir, corregirlo es una nota
// credito y otra factura.
//
// ── Y EL OTRO, que cuadra en el total y por eso es peor ─────────────────────────────────────────
//
// Hasta hoy toda factura llevaba UN item generico con cantidad 1 y el total de la venta como precio. El
// total cuadraba y el documento no decia que se habia vendido. Una venta de tres productos son TRES
// lineas, cada una con su item, su cantidad y su precio.

/** Una linea tal como sale de `transaction_items`, ya resuelta contra el catalogo. */
export type LineaDeVenta = {
  nutraceuticalId: string;
  nombre: string;
  cantidad: number;
  /** PVP unitario CON IVA, sellado al crear el checkout. */
  precioUnitario: number;
  /** Item en el catalogo de Alegra. Nulo si el producto no esta mapeado: eso bloquea la emision. */
  alegraItemId: string | null;
  /** Ambiente del que es ese id. Un item de sandbox no existe en produccion. */
  alegraEnv: string | null;
  /** `propio` | `tercero`. Decide el centro de costo. */
  ownership: string | null;
};

export type MapaDeAlegra = {
  env: string;
  ivaTaxId: string;
  invoiceTemplateId: string;
  creditNoteTemplateId: string | null;
  costCenterPropioId: string;
  costCenterTerceroId: string;
  bankAccountEfectivoId: string;
  bankAccountPasarelaId: string;
};

export type LineaDeFactura = {
  id: number;
  price: number;
  quantity: number;
  tax: { id: number }[];
};

export type ArmadoDeFactura =
  | { ok: true; lineas: LineaDeFactura[]; costCenterId: number | null; totalConIva: number }
  | { ok: false; motivo: string };

/**
 * El centro de costo de la factura, derivado de la PROPIEDAD de lo que se vende.
 *
 * NO SE HEREDA DEL ITEM: se verifico contra el sandbox y los cinco items lo tienen vacio; la factura lo
 * trae como campo propio. Sin el no se puede medir rentabilidad por linea, que es justo la pregunta
 * abierta del margen del 10% de LUVIA.
 *
 * Devuelve null cuando la venta MEZCLA propio y tercero, y eso es deliberado: el centro de costo es del
 * documento, no de la linea, asi que una venta mixta no se puede clasificar sin mentir. Que quede sin
 * centro es visible y corregible; repartirlo por mayoria seria inventar un dato contable.
 */
export function centroDeCosto(lineas: LineaDeVenta[], mapa: MapaDeAlegra): number | null {
  const propiedades = new Set(lineas.map((l) => l.ownership ?? "propio"));
  if (propiedades.size !== 1) return null;
  const unica = [...propiedades][0];
  return Number(unica === "tercero" ? mapa.costCenterTerceroId : mapa.costCenterPropioId);
}

/**
 * Arma las lineas y RECHAZA antes de llamar a Alegra si algo no cumple.
 *
 * Todo lo que rechaza tiene la misma forma: son cosas que Alegra ACEPTARIA, produciendo un documento
 * valido y equivocado. Lo que falla en voz alta no necesita validacion previa.
 */
export function armarFactura(lineas: LineaDeVenta[], mapa: MapaDeAlegra): ArmadoDeFactura {
  if (lineas.length === 0) return { ok: false, motivo: "La venta no tiene líneas." };

  const ivaTaxId = Number(mapa.ivaTaxId);
  if (!Number.isFinite(ivaTaxId) || ivaTaxId <= 0) {
    return { ok: false, motivo: "El mapa de Alegra no trae el id del IVA." };
  }

  const sinMapear = lineas.filter((l) => !l.alegraItemId);
  if (sinMapear.length > 0) {
    return {
      ok: false,
      motivo: `Sin ítem en Alegra: ${sinMapear.map((l) => l.nombre).join(", ")}. La factura diría un producto que no es.`,
    };
  }

  // El ambiente, que es lo que impide facturar en produccion contra items de sandbox. Es el error que el
  // modelo llama la causa numero uno de facturas mal emitidas, y aqui no depende de que alguien recuerde.
  const otroAmbiente = lineas.filter((l) => l.alegraEnv !== mapa.env);
  if (otroAmbiente.length > 0) {
    return {
      ok: false,
      motivo: `Ítems de otro ambiente (${otroAmbiente.map((l) => `${l.nombre}: ${l.alegraEnv ?? "sin ambiente"}`).join(", ")}) y se está facturando en ${mapa.env}.`,
    };
  }

  const cantidadMala = lineas.filter((l) => !Number.isInteger(l.cantidad) || l.cantidad <= 0);
  if (cantidadMala.length > 0) {
    return { ok: false, motivo: `Cantidad inválida en: ${cantidadMala.map((l) => l.nombre).join(", ")}.` };
  }

  const armadas: LineaDeFactura[] = lineas.map((l) => ({
    id: Number(l.alegraItemId),
    // La BASE unitaria sin IVA, en pesos enteros. Alegra multiplica por la cantidad y aplica el impuesto.
    price: baseFromTotal(l.precioUnitario),
    quantity: l.cantidad,
    tax: [{ id: ivaTaxId }],
  }));

  // LA VALIDACION QUE DA NOMBRE A ESTE ARCHIVO. Es redundante con el `map` de arriba a proposito: lo que
  // se vigila no es este codigo, es el de mañana. El dia que alguien arme las lineas de otra forma (una
  // exenta, un descuento, un producto sin IVA), esta comprobacion sigue en medio.
  const sinImpuesto = armadas.filter((l) => !Array.isArray(l.tax) || l.tax.length === 0);
  if (sinImpuesto.length > 0) {
    return {
      ok: false,
      motivo:
        "Hay líneas sin impuesto. No se emite: Alegra facturaría al 0%, la DIAN lo validaría, y el IVA no cobrado lo asumiría CNV.",
    };
  }

  const sinPrecio = armadas.filter((l) => !Number.isFinite(l.price) || l.price <= 0);
  if (sinPrecio.length > 0) return { ok: false, motivo: "Hay líneas sin precio." };

  const totalConIva = lineas.reduce((suma, l) => suma + l.precioUnitario * l.cantidad, 0);
  return { ok: true, lineas: armadas, costCenterId: centroDeCosto(lineas, mapa), totalConIva };
}

/**
 * Cuenta PUENTE donde se registra el pago, segun el canal.
 *
 * NUNCA EL BANCO: cuando Atlas registra el pago la plata esta en el bolsillo del Integrante o retenida en
 * Wompi. Decir que llego al banco haria que el banco dejara de cuadrar contra su extracto.
 *
 * Devuelve null para lo que de verdad queda POR COBRAR, que hoy es solo la quincenal al Integrante bajo
 * modalidad Distribucion. Un null aqui significa "no se registra pago", no "no se sabe".
 */
export function cuentaDelPago(
  canal: "wompi" | "efectivo" | "quincenal_integrante",
  mapa: MapaDeAlegra,
): number | null {
  if (canal === "efectivo") return Number(mapa.bankAccountEfectivoId);
  if (canal === "wompi") return Number(mapa.bankAccountPasarelaId);
  return null;
}

/**
 * Lo que se le cobra al paciente, desglosado.
 *
 * Existe para poder COTEJAR lo que Atlas cobro contra lo que Alegra facturo. Si no coinciden, el pago
 * registrado no cuadra con el documento y la diferencia hay que verla el mismo dia, no en el cierre.
 */
export function desgloseDeLaVenta(lineas: LineaDeVenta[]): {
  base: number;
  iva: number;
  total: number;
} {
  let base = 0;
  let iva = 0;
  for (const l of lineas) {
    base += baseFromTotal(l.precioUnitario) * l.cantidad;
    iva += ivaFromTotal(l.precioUnitario) * l.cantidad;
  }
  return { base, iva, total: base + iva };
}
