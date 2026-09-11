// ═══ EL REPARTO DEL PRECIO: MODULO PURO ═══
//
// NEUTRO A PROPOSITO (sin "use client" ni `server-only`): lo usan el sellado de la venta, la pantalla de
// configuracion comercial y los tests. Es aritmetica, no acceso a datos.
//
// ── EL CRITERIO (Santiago, 2026-09-11) ──────────────────────────────────────────────────────────────
//
// La comision del Integrante es SUYA y aplica a todos los productos por igual. Asi que el reparto NO es
// una cifra por producto:
//
//   · la participacion del INTEGRANTE sale de SU tasa,
//   · la del PROVEEDOR sale del producto (solo en producto de tercero),
//   · y la de CNV es EL RESIDUO.
//
// El modelo comercial no solo lo admite, lo AFIRMA (§7.2): "El Integrante recibe la misma participacion
// que en los productos propios, de modo que para el la operacion es indistinta. La diferencia la absorbe
// CNV, que pasa de su margen habitual a un 10%."
//
// ── TODO SOBRE LA BASE SIN IVA (principio 1) ───────────────────────────────────────────────────────
//
// El IVA no es de ninguna de las partes: es recaudo en transito hacia la DIAN. Aplicar los porcentajes
// sobre el PVP repartiria entre las partes un dinero que no es suyo. Por eso este modulo NO conoce el
// PVP: recibe la base y solo la base. Si alguien le pasa el total con IVA, el resultado sera
// aritmeticamente coherente y comercialmente falso, y eso no se ve mirando los numeros.

/** Fraccion en 0..1. 0,20 = 20%. */
export type Fraccion = number;

export type EntradaDelReparto = {
  /** Base SIN IVA de la linea (precio unitario base x cantidad). */
  base: number;
  /** Tasa VIGENTE del Integrante en el momento de la venta. */
  tasaIntegrante: Fraccion;
  /** Participacion VIGENTE del proveedor externo. 0 en producto propio. */
  participacionProveedor: Fraccion;
};

/**
 * LO QUE SE SELLA EN LA LINEA DE VENTA.
 *
 * SE SELLAN LOS TRES IMPORTES, no dos y el tercero derivado. Sellar dos y calcular el otro al leer hace
 * que la cifra cambie si algun dia cambia la formula; sellar los tres con la suma comprobada hace la fila
 * AUTO-VERIFICABLE: quien la lea puede confirmar que cuadra sin conocer la regla que la produjo.
 *
 * Y SE SELLAN TAMBIEN LAS DOS TASAS de entrada, porque son las que explican los importes. Un importe sin
 * su tasa obliga a dividir para reconstruirla, y una division con redondeo no devuelve la tasa original.
 */
export type RepartoSellado = {
  base: number;
  tasaIntegrante: Fraccion;
  participacionProveedor: Fraccion;
  montoIntegrante: number;
  montoProveedor: number;
  /** El residuo. Absorbe el redondeo, por lo mismo que absorbe todo lo demas. */
  montoCnv: number;
};

export class RepartoInvalidoError extends Error {}

const aCentavos = (n: number) => Math.round(n * 100) / 100;

/**
 * CNV ES EL RESIDUO, y por eso puede ser negativo.
 *
 * Si el Integrante sube al 30%, en un producto de tercero al 70% a CNV le queda 0%. Por encima, CNV PAGA
 * por vender. No es que se reparta distinto: es que el margen de CNV es lo que sobra, y lo que sobra
 * puede ser negativo.
 */
export function residuoDeCnv(tasaIntegrante: Fraccion, participacionProveedor: Fraccion): Fraccion {
  // ═══ SE REDONDEA, Y NO ES COSMETICO ═══
  //
  // En coma flotante, `1 - 0.8 - 0.2` da -5,5e-17: NEGATIVO. O sea que un reparto 80/20 perfectamente
  // legitimo (el producto propio de todos los dias) habria disparado el bloqueo de "CNV no puede pagar
  // por vender" por un error de representacion de la decimosexta cifra. Y `1 - 0.7 - 0.2` da 0,10000...3,
  // que es MAYOR que 0,1, asi que un umbral de aviso del 10% no se habria disparado nunca justo en el
  // caso para el que se escribio.
  //
  // Lo encontro el candado del umbral, no una revision. Seis decimales sobran para una fraccion que en la
  // practica tiene cuatro (los puntos basicos), y dejan la comparacion alineada con la de la base de
  // datos, donde `numeric` es decimal exacto y este problema no existe. Las dos capas tienen que decir lo
  // mismo, y sin esto no lo dirian.
  const r = Math.round((1 - participacionProveedor - tasaIntegrante) * 1e6) / 1e6;
  // `-0` SE NORMALIZA A `0`. Redondear un residuo negativo minusculo da `-0`, que es igual a cero en
  // aritmetica y NO lo es al compararlo ni al mostrarlo: una pantalla escribiria "-0%" y quien lo lea
  // pensara, con razon, que algo esta mal.
  return r === 0 ? 0 : r;
}

/**
 * Reparte la base y devuelve lo que se sella.
 *
 * FALLA SI EL RESIDUO ES NEGATIVO, y no es una validacion de formulario: es la misma invariante que el
 * trigger de la base de datos. Vive en los dos sitios a proposito. El trigger impide que una combinacion
 * asi se GUARDE; esto impide que, si alguna se colara, se llegue a SELLAR una venta con ella.
 *
 * EL REDONDEO LO ABSORBE CNV. Es coherente con ser el residuo: el Integrante y el proveedor cobran su
 * fraccion exacta de la base, y la diferencia de centavos queda del lado del que ya absorbe todo lo
 * demas. La alternativa (repartir el centavo) haria que la suma de los tres no diera la base.
 */
export function repartir(e: EntradaDelReparto): RepartoSellado {
  if (!(e.base > 0)) {
    throw new RepartoInvalidoError("La base de la venta debe ser mayor que cero.");
  }
  for (const [nombre, v] of [
    ["la tasa del Integrante", e.tasaIntegrante],
    ["la participación del proveedor", e.participacionProveedor],
  ] as const) {
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new RepartoInvalidoError(`${nombre} tiene que estar entre 0 y 1.`);
    }
  }

  const residuo = residuoDeCnv(e.tasaIntegrante, e.participacionProveedor);
  if (residuo < 0) {
    throw new RepartoInvalidoError(
      `CNV no puede pagar por vender: con el proveedor al ${pct(e.participacionProveedor)} y el Integrante al ${pct(e.tasaIntegrante)}, a CNV le queda ${pct(residuo)}.`,
    );
  }

  const montoIntegrante = aCentavos(e.base * e.tasaIntegrante);
  const montoProveedor = aCentavos(e.base * e.participacionProveedor);
  const montoCnv = aCentavos(e.base - montoIntegrante - montoProveedor);

  return {
    base: aCentavos(e.base),
    tasaIntegrante: e.tasaIntegrante,
    participacionProveedor: e.participacionProveedor,
    montoIntegrante,
    montoProveedor,
    montoCnv,
  };
}

/**
 * LA INVARIANTE DE LA FILA SELLADA: los tres importes suman la base.
 *
 * Existe separada de `repartir` porque su trabajo es OTRO: `repartir` produce la fila, esto VERIFICA una
 * que ya esta guardada. Es lo que hace auto-verificable el sellado de los tres importes, y lo que puede
 * correr sobre la base entera en una conciliacion sin volver a aplicar la formula.
 */
export function selladoCuadra(r: RepartoSellado): boolean {
  return Math.abs(r.montoIntegrante + r.montoProveedor + r.montoCnv - r.base) < 0.005;
}

/**
 * SI ESTA COMBINACION MERECE AVISO, que es distinto de si se puede guardar.
 *
 * EL BLOQUEO DEL NEGATIVO es invariante del sistema y no se configura. EL AVISO es politica comercial y
 * es POR PRODUCTO: un producto propio deja a CNV el 80% y uno de tercero el 10%, asi que un umbral unico
 * haria que el propio no avisara nunca y el de tercero avisara siempre.
 */
export function mereceAviso(
  tasaIntegrante: Fraccion,
  participacionProveedor: Fraccion,
  umbralDelProducto: Fraccion | null,
  umbralGlobal: Fraccion,
): boolean {
  return residuoDeCnv(tasaIntegrante, participacionProveedor) <= (umbralDelProducto ?? umbralGlobal);
}

/** Porcentaje legible para los mensajes. Solo presentacion. */
function pct(f: Fraccion): string {
  return `${(Math.round(f * 10000) / 100).toString().replace(".", ",")}%`;
}
