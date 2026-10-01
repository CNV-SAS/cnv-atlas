// ═══ LA VENTANA DEL ARRANQUE, EN TYPESCRIPT PURO (0198) ═══
//
// VIVE APARTE DEL LECTOR A PROPOSITO. El lector es `server-only` (habla con la base) y estas dos funciones
// no tocan nada: son aritmetica de fechas, y son justo lo que hay que poder probar sin base. Dejarlas dentro
// del modulo server-only obligaba al candado a importar `server-only` para comprobar una resta de horas.
//
// Es el mismo patron que ya usa el proyecto para las fronteras RSC: lo que comparten dos lados vive en un
// modulo NEUTRO, sin "use client" ni `server-only`.

/**
 * La fecha en el formato que quiere un filtro `gte` de PostgREST: el instante inicial de ese dia.
 *
 * LA HORA IMPORTA Y POR ESO NO SE PASA LA FECHA PELADA. `created_at` es un timestamp, y comparar contra
 * "2026-10-15" lo interpreta como medianoche UTC, que en Bogota son las 7 de la tarde del 14: se colarian
 * las ventas de esa tarde. Se ancla a la medianoche de Bogota, que es cuando empieza el dia para quien
 * lee la pantalla.
 */
export function desdeElArranque(fecha: string | null): string | null {
  return fecha == null ? null : `${fecha}T00:00:00-05:00`;
}

/**
 * De dos comienzos, el mas tardio.
 *
 * Lo usa la tarjeta DEL MES: el mes en curso empieza el dia 1, pero si el arranque cae a mitad de mes, lo
 * que hay que contar empieza en el arranque. Sin esto, la primera tarjeta del mes del arranque sumaria las
 * pruebas de los dias anteriores, que es exactamente lo que la fecha viene a evitar.
 */
export function elMasTardio(a: string, b: string | null): string {
  if (b == null) return a;
  // SE COMPARAN INSTANTES, NO TEXTOS, y no es un detalle de estilo: los dos vienen con formatos distintos
  // (uno termina en ".000Z" y el otro en "-05:00"), asi que compararlos como cadenas da el resultado
  // CONTRARIO en el caso limite. El 1 de octubre a medianoche UTC es el 30 de septiembre a las 7 de la
  // tarde en Bogota, y el texto lo declararia el mas tardio: entrarian las ventas de esa tarde, que son
  // justo las del dia anterior al arranque.
  return Date.parse(b) > Date.parse(a) ? b : a;
}

/**
 * El primer instante del mes EN HORA DE COLOMBIA.
 *
 * ═══ EL MES SE REINICIABA A LAS 7 DE LA TARDE (Santiago, 2026-09-30) ═══
 *
 * La version anterior armaba el corte con `Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)`. El 30 de
 * septiembre a las 7 p. m. de Bogota ya es el 1 de octubre en UTC, asi que `getUTCMonth()` devolvia OCTUBRE y
 * la ventana saltaba al mes siguiente CINCO HORAS ANTES: el profesional veia "Tu comisión $0" y "Ventas $0"
 * con el mes entero todavia por delante.
 *
 * Y NO ES UN CASO RARO: pasa TODOS los meses, entre las 7 p. m. y la medianoche del ultimo dia, que es
 * justamente cuando alguien mira como le fue el mes. Santiago lo intuyo antes que yo ("en Colombia apenas
 * son las 7 p. m., no se tenian por que haber reseteado").
 *
 * Se arma con `Intl` y no restando cinco horas a mano porque la zona la decide la zona, no una constante.
 */
export function inicioDelMesEnBogota(ahora: Date): string {
  const [anio, mes] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  })
    .format(ahora)
    .split("-");
  return `${anio}-${mes}-01T00:00:00-05:00`;
}

/**
 * El dia de HOY en Colombia (YYYY-MM-DD).
 *
 * Existe por la misma razon que `inicioDelMesEnBogota`, y el caso es el de al lado: `toISOString()` despues
 * de las 7 de la tarde ya devuelve el dia SIGUIENTE, asi que una comparacion "de hoy en adelante" se come el
 * dia en curso. Paso con las proximas consultas del tablero, y la misma leccion ya estaba escrita en
 * `facturacion.ts` para la fecha de una venta.
 *
 * HAY OTRO HELPER PARA LO MISMO Y ES A PROPOSITO: `hoyEnBogota()` (en `liquidacion-writer`) lo pregunta A LA
 * BASE, y por eso lo usa /comercial, donde el corte decide dinero y conviene que la fecha salga del mismo
 * reloj que las filas. Este es puro y sirve donde no hay base (modulos neutros y tests con reloj fijo). Si
 * hace falta un tercero, no: se usa uno de estos dos.
 */
export function hoyEnColombia(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}
