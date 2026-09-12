// IVA general de Colombia (19%).
//
// ── LA POLITICA DE REDONDEO, DEFINIDA EL 2026-09-12 ANTES DE QUE HAYA VOLUMEN ────────────────────
//
// TODO EN PESOS ENTEROS. En Colombia no circulan centavos, Alegra lleva las facturas con
// `decimalPrecision: "0"` y una diferencia de centavos que nadie sabe explicar rompe una conciliacion
// entera. Estos helpers redondeaban a DOS decimales, y eso producia lo siguiente:
//
//   LUVIA, PVP 90.000 -> base 75.630,25 (Atlas) contra 75.630 (item de Alegra)
//
// Veinticinco centavos por unidad que no significan nada y que, multiplicados por el volumen, aparecen
// como un descuadre sin causa entre dos sistemas que en realidad dicen lo mismo.
//
// ── QUE SE REDONDEA, Y ESTE ES EL ORDEN QUE IMPORTA ──────────────────────────────────────────────
//
// Se redondean la BASE y el IVA, cada uno al peso, y el total es su SUMA. No al reves. Redondear el total
// y repartirlo dejaria la base o el IVA con centavos, y el IVA es justo la cifra que la DIAN concilia.
//
//   base = redondeo(PVP / 1,19)          IVA = redondeo(base * 0,19)          total = base + IVA
//
// Con los cinco productos del catalogo, esa cadena devuelve EXACTAMENTE los PVP publicados:
//
//   107.100 ->  90.000 + 17.100   (19% exacto)
//   166.600 -> 140.000 + 26.600   (19% exacto)
//    90.000 ->  75.630 + 14.370   (19% de 75.630 son 14.369,70; el redondeo al peso da 14.370)
//
// LUVIA es el unico donde el IVA no es el 19% exacto de su base, y esa diferencia de 0,30 tiene que caer
// en algun sitio: cae en el IVA, que se redondea al peso, y NO en el total, para que el paciente pague un
// numero redondo y la factura diga ese mismo numero. Contabilidad ya lo habia escrito asi para LUVIA
// ("base 75.630, IVA 14.370", migracion 0124): esto es la misma regla, generalizada.
//
// ── Y LA REGLA QUE NO SE PUEDE ROMPER ────────────────────────────────────────────────────────────
//
// `baseDe(t) + ivaDe(t) === t` para todo PVP. Si algun dia deja de cumplirse, Atlas cobraria una cifra y
// facturaria otra, y el pago registrado no cuadraria con la factura. Hay un candado que lo barre sobre un
// rango grande, no sobre tres ejemplos.
export const IVA_RATE = 0.19;

/** Redondeo al peso. Los importes en COP no llevan centavos y Alegra los lleva sin decimales. */
function alPeso(n: number): number {
  return Math.round(n);
}

/** Base sin IVA a partir de un precio final (PVP), en pesos enteros. */
export function baseFromTotal(total: number): number {
  return alPeso(total / (1 + IVA_RATE));
}

/**
 * IVA contenido en un precio final (PVP), en pesos enteros.
 *
 * Se calcula como EL RESTO (total menos base) y no como `base * 0,19`, y la diferencia importa: asi
 * `base + IVA === total` siempre, por construccion y no por suerte. Con `base * 0,19` el LUVIA daria
 * 14.369,70 y la suma no llegaria al PVP.
 */
export function ivaFromTotal(total: number): number {
  return alPeso(total) - baseFromTotal(total);
}

/**
 * El camino inverso: el PVP que corresponde a una base sin IVA.
 *
 * Sirve para el sentido que va de Alegra hacia Atlas (el item guarda la base) y para verificar que los
 * dos catalogos dicen lo mismo. Redondea el IVA al peso, no el total.
 */
export function totalFromBase(base: number): number {
  return alPeso(base) + alPeso(alPeso(base) * IVA_RATE);
}
