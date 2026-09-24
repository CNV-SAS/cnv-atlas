// ═══ LA LIQUIDACION DE LA COMISION DEL INTEGRANTE (Bloque 4, 2026-09-24) ═══
//
// MODULO PURO: no habla con nadie, asi que la aritmetica que decide cuanto se le gira a una persona se puede
// probar entera sin base y sin red. Igual que `reparto.ts`, que reparte la venta.
//
// LAS CIFRAS SALEN DEL MODELO (MODELO_COMERCIAL_NUTRACEUTICOS_ATLAS.md §3), no de nosotros:
//
//   · La comision es un SERVICIO GRAVADO: si el Integrante es responsable de IVA, su comision lleva IVA del
//     19 %. Ese IVA es descontable para CNV, asi que el costo real de la comision no sube.
//   · CNV PRACTICA RETENCION EN LA FUENTE por honorarios y comisiones: 10 % a persona natural con pagos
//     anuales acumulados hasta 3.300 UVT, 11 % por encima de ese umbral y 11 % a persona juridica.
//   · La retencion se calcula SOBRE LA COMISION, NUNCA SOBRE EL IVA. Es el error clasico de esta cuenta.
//   · El acumulado se reinicia por año calendario, y el cambio de tarifa aplica DESDE EL PAGO EN QUE SE
//     SUPERA el umbral, no desde el siguiente.
//
// LO QUE ESTE MODULO NO DECIDE: quien emite el documento del pago es una consecuencia del perfil (obligado a
// facturar -> lo emite el Integrante; no obligado -> CNV emite documento soporte electronico), y se devuelve
// para que la pantalla lo diga, pero emitirlo es del Bloque 2b/Alegra, no de aqui.

/** UVT 2026. Al cambiar de año hay que actualizarla, y por eso esta aqui sola y con su año en el nombre. */
export const UVT_2026 = 52_374;

/** El umbral de la tarifa: 3.300 UVT. Con la UVT de 2026, 172.834.200 al año. */
export const UMBRAL_UVT = 3_300;

export const IVA_COMISION = 0.19;
export const RETENCION_BASE = 0.1;
export const RETENCION_ALTA = 0.11;

export type PerfilTributario = {
  /** natural | juridica. Una juridica retiene al 11 % sin importar el acumulado. */
  tipoDePersona: "natural" | "juridica" | null;
  /** Si su comision lleva IVA. */
  responsableDeIva: boolean | null;
  /** Si esta obligado a facturar (RUT con codigo 52 o equivalente). */
  obligadoAFacturar: boolean | null;
};

export type LiquidacionDeComision = {
  /** La comision causada en el periodo, sin IVA. Puede venir neteada por reversiones. */
  base: number;
  iva: number;
  /** La tarifa aplicada (0.10 o 0.11), para que la liquidacion explique su propia cuenta. */
  tarifaDeRetencion: number;
  retencion: number;
  /** Lo que se le gira: base + IVA - retencion. */
  neto: number;
  /** El acumulado del año DESPUES de este pago, para llevarlo a la siguiente liquidacion. */
  acumuladoDelAno: number;
  /** Si este pago es el que cruza el umbral (informacion para la pantalla, no cambia la cuenta). */
  cruzaElUmbral: boolean;
  documento: "factura_del_integrante" | "documento_soporte";
  /** Lo que falta para poder liquidarle. Vacio = se puede. */
  faltantes: string[];
};

const alPeso = (n: number) => Math.round(n);

/**
 * La cuenta de una liquidacion.
 *
 * `acumuladoPrevio` es la suma de las comisiones (base, sin IVA) YA PAGADAS al Integrante en el mismo año
 * calendario. Es lo que decide la tarifa, y por eso se recibe en vez de deducirse: quien llama sabe de que
 * año habla.
 */
export function liquidarComision(input: {
  base: number;
  perfil: PerfilTributario;
  acumuladoPrevio: number;
  uvt?: number;
}): LiquidacionDeComision {
  const uvt = input.uvt ?? UVT_2026;
  const umbral = uvt * UMBRAL_UVT;
  const base = alPeso(input.base);
  const acumuladoDelAno = alPeso(input.acumuladoPrevio + base);

  // SIN LOS DATOS TRIBUTARIOS NO SE LIQUIDA, y se dice cuales faltan en vez de asumir un valor. Asumir aqui
  // es girar de menos o de mas, y las dos se arreglan con plata de por medio.
  const faltantes: string[] = [];
  if (input.perfil.tipoDePersona == null) faltantes.push("si es persona natural o jurídica");
  if (input.perfil.responsableDeIva == null) faltantes.push("si es responsable de IVA");
  if (input.perfil.obligadoAFacturar == null) faltantes.push("si está obligado a facturar");

  const juridica = input.perfil.tipoDePersona === "juridica";
  // El cambio de tarifa aplica DESDE el pago en que se supera el umbral (modelo §3), no desde el siguiente.
  const cruzaElUmbral = !juridica && input.acumuladoPrevio <= umbral && acumuladoDelAno > umbral;
  const tarifaDeRetencion = juridica || acumuladoDelAno > umbral ? RETENCION_ALTA : RETENCION_BASE;

  // UNA BASE NEGATIVA NO SE RETIENE NI LLEVA IVA A FAVOR: pasa cuando las reversiones del periodo superan lo
  // causado (D-3b-2: la comision ya liquidada se descuenta en la liquidacion siguiente). El neto queda
  // negativo y eso es lo correcto: es una deuda que arrastra al periodo que viene, no un giro.
  const iva = base > 0 && input.perfil.responsableDeIva === true ? alPeso(base * IVA_COMISION) : 0;
  const retencion = base > 0 ? alPeso(base * tarifaDeRetencion) : 0;

  return {
    base,
    iva,
    tarifaDeRetencion,
    retencion,
    neto: base + iva - retencion,
    acumuladoDelAno,
    cruzaElUmbral,
    documento: input.perfil.obligadoAFacturar ? "factura_del_integrante" : "documento_soporte",
    faltantes,
  };
}
