// ═══ LA MODALIDAD DEL INTEGRANTE Y CUANDO ENTRA UN CAMBIO (2026-09-25) ═══
//
// MODULO PURO. La regla es del modelo comercial §2 ("Cambio de modalidad") y es una sola frase, pero decide
// toda la forma de la tabla:
//
//   "El cambio surte efecto al inicio del siguiente periodo de corte. El periodo en curso se cierra bajo la
//    modalidad anterior, para no partir una liquidacion en dos regimenes."
//
// Y EL CORTE NO ES EL MISMO EN LAS DOS MODALIDADES, que es lo que hace que esto no sea una suma de un mes:
//
//   · COMISION: liquidacion MENSUAL (§3: "dentro de los cinco dias habiles del mes siguiente"). Su corte es
//     el mes calendario, asi que el cambio entra el dia 1 del mes que viene.
//   · DISTRIBUCION: corte QUINCENAL (§4, y §3 usa la misma cadencia para el efectivo: "los dias 15 y ultimo
//     de cada mes"). Asi que el cambio entra el dia 16, o el 1 del mes siguiente.
//
// ── CUAL CORTE MANDA: EL DE LA MODALIDAD QUE SE VA, NO EL DE LA QUE LLEGA ──
//
// Es la parte que se puede equivocar sin que se note. El periodo que hay que cerrar entero es el que esta
// CORRIENDO, y ese corre bajo la modalidad ACTUAL. Si un integrante en Comision (corte mensual) pasa a
// Distribucion el 8 de septiembre, su periodo en curso es septiembre completo y el cambio entra el 1 de
// octubre. Tomar el corte de la modalidad NUEVA daria el 16 de septiembre y partiria la liquidacion mensual
// de septiembre en dos regimenes, que es exactamente lo que la frase prohibe.

export type Modalidad = "comision" | "distribucion";

/** Sin fila de modalidad = comision. Es lo que todos son hoy y lo que el sellado escribia a mano. */
export const MODALIDAD_POR_DEFECTO: Modalidad = "comision";

export const MODALIDAD_LABEL: Record<Modalidad, string> = {
  comision: "Comisión",
  distribucion: "Distribución",
};

/** La cadencia del corte de cada modalidad, que es lo que decide cuando entra un cambio. */
export const CORTE_DE_LA_MODALIDAD: Record<Modalidad, "mensual" | "quincenal"> = {
  comision: "mensual",
  distribucion: "quincenal",
};

/**
 * EL INICIO DEL SIGUIENTE CORTE, contado desde `hoy` y con la cadencia de la modalidad que TODAVIA rige.
 *
 * `hoy` y el resultado van como 'YYYY-MM-DD'. Se trabaja con las partes de la fecha y no con un `Date` en
 * UTC a proposito: el servidor corre en UTC y a las 19:00 de Bogota alla ya es el dia siguiente, asi que un
 * cambio pedido un 31 por la noche saltaria un corte entero.
 */
export function inicioDelSiguienteCorte(hoy: string, modalidadActual: Modalidad): string {
  const [anio, mes, dia] = hoy.split("-").map(Number);
  if (!anio || !mes || !dia) throw new Error(`inicioDelSiguienteCorte: fecha invalida "${hoy}"`);

  if (CORTE_DE_LA_MODALIDAD[modalidadActual] === "quincenal" && dia < 16) {
    // Primera quincena en curso: cierra el 15, asi que lo siguiente empieza el 16 del MISMO mes.
    return ymd(anio, mes, 16);
  }
  // Mensual siempre, y quincenal en la segunda mitad: el corte que sigue es el dia 1 del mes que viene.
  return mes === 12 ? ymd(anio + 1, 1, 1) : ymd(anio, mes + 1, 1);
}

const ymd = (a: number, m: number, d: number): string =>
  `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Lo que hay que decirle a quien hace el cambio: desde cuando rige y que pasa con lo que ya se vendio.
 *
 * Es texto y no solo una fecha porque el cambio es CONTRAINTUITIVO: admin pulsa hoy y no pasa nada hoy, y sin
 * explicacion eso se lee como que el boton no funciono.
 */
export function avisoDelCambioDeModalidad(
  hoy: string,
  desde: Modalidad,
  hacia: Modalidad,
): { rigeDesde: string; aviso: string } {
  const rigeDesde = inicioDelSiguienteCorte(hoy, desde);
  return {
    rigeDesde,
    aviso: `El cambio a ${MODALIDAD_LABEL[hacia]} rige desde el ${rigeDesde}. Lo que se venda hasta ese día se liquida bajo ${MODALIDAD_LABEL[desde]}, porque el período en curso se cierra completo en un solo régimen.`,
  };
}

/**
 * La modalidad que regia en una FECHA, dada la lista de vigencias del integrante.
 *
 * Es lo que hace que el cambio no reescriba el pasado: el sellado de una venta pregunta por la fecha de LA
 * VENTA, no por "la modalidad de hoy". Una lista vacia devuelve comision, que es el defecto.
 */
export function modalidadEnLaFecha(
  vigencias: { modality: Modalidad; validFrom: string; validTo: string | null }[],
  fecha: string,
): Modalidad {
  // La que empezo mas tarde entre las que ya habian empezado y no habian terminado. Se recorre en vez de
  // confiar en el orden de la consulta: un lector que olvide el ORDER BY no puede cambiar la respuesta.
  let elegida: { modality: Modalidad; validFrom: string } | null = null;
  for (const v of vigencias) {
    if (v.validFrom > fecha) continue;
    if (v.validTo != null && v.validTo < fecha) continue;
    if (elegida == null || v.validFrom > elegida.validFrom) elegida = v;
  }
  return elegida?.modality ?? MODALIDAD_POR_DEFECTO;
}
