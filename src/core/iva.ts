// IVA general de Colombia (19%). En Atlas, nutraceuticals.unit_price es el PVP:
// precio final con IVA incluido. Estos helpers derivan la base sin IVA y el IVA
// contenido, y los usan tres lugares: Alegra (envia el precio base), la comision e
// ingreso (se calculan sobre la base) y el desglose informativo de la UI. El IVA es
// recaudo (va a la factura y a la DIAN), no es ingreso.
export const IVA_RATE = 0.19;

// Base sin IVA a partir de un precio final (PVP). Redondeada a 2 decimales.
export function baseFromTotal(total: number): number {
  return Math.round((total / (1 + IVA_RATE)) * 100) / 100;
}

// IVA contenido en un precio final (PVP). Redondeado a 2 decimales. Por construccion,
// baseFromTotal(t) + ivaFromTotal(t) === t.
export function ivaFromTotal(total: number): number {
  return Math.round((total - baseFromTotal(total)) * 100) / 100;
}
