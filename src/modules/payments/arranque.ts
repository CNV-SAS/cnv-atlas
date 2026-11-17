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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ⟶ EL ARRANQUE TIENE TRES ESTADOS, NO DOS (Santiago, 2026-11-17)
//
// ═══ EL DEFECTO QUE CIERRA, Y ES DE SIGNIFICADO, NO DE ARITMETICA ═══
//
// /direccion decia, con la fecha puesta en 2026-10-15: *"Esto no es un error: esta contando desde el
// 2026-10-15, que es el dia del arranque"*. Y el arranque NO OCURRIO: la fecha se fijo el 11 de septiembre
// para un arranque que se aplazo tres veces. Textual de Santiago: *"Todavia no hemos arrancado... No
// entiendo por que"*. La pantalla no estaba contando mal: estaba AFIRMANDO UN HECHO FALSO, y encima el
// unico que podia desmentirlo era el que leia la pantalla.
//
// ── Y EL OTRO LADO ERA PEOR, PORQUE PARECIA EL ESTADO LIMPIO ──
//
// La 0198 escribio "NULL = no hay arranque todavia y se cuenta todo". O sea que al poner la fecha en nulo
// (el arreglo evidente para el defecto de arriba) las tarjetas pasarian a contar las 64 ventas de prueba
// COMO SI FUERAN LA OPERACION. El estado "todavia no arrancamos" no se podia expresar: solo se podia
// elegir entre afirmar un arranque que no hubo y contar las pruebas como operacion.
//
// ── LOS TRES ESTADOS, CON UN SOLO VALOR ──
//
// El valor sigue siendo UNO (`commercial_config.fecha_de_arranque`): lo que cambia es que ahora se lee
// contra el dia de hoy, y de ahi salen los tres estados que la operacion de verdad tiene:
//
//   · SIN FECHA        -> no se ha arrancado. No se cuenta nada, y la pantalla lo dice.
//   · FECHA EN EL FUTURO -> no se ha arrancado TODAVIA, y ya se sabe cuando. Tampoco se cuenta nada, y la
//     pantalla dice el dia. Este estado es lo que permite FIJAR la fecha con antelacion sin que las cifras
//     mientan mientras llega, que es justo lo que no se pudo hacer en octubre.
//   · FECHA DE HOY O ANTERIOR -> arrancado. Se cuenta desde ahi, como hasta ahora.
//
// "SIN CONTAR NADA" ES LITERAL, Y NO ES LO MISMO QUE CONTAR CERO POR CASUALIDAD. Hoy las tarjetas de dinero
// salen en cero porque las 64 ventas estan marcadas de prueba; eso es una coincidencia de los datos, no una
// garantia. Lo que esta funcion deja garantizado es que antes del arranque la VENTANA ESTA VACIA, asi que
// ninguna venta de prueba puede colarse en una cifra de operacion por haberse quedado sin marcar.
//
// LO QUE SIGUE SIN LLEVAR CORTE ES LO MISMO QUE ANTES: el inventario (es un saldo, no un flujo) y lo que se
// le DEBE a alguien (una comision anterior se liquida igual). Esta funcion no los toca, y su candado
// tampoco cambia.
//
// ES TYPESCRIPT PURO Y VIVE AQUI por la razon del encabezado de este archivo: hay que poder probar los tres
// estados sin base, y el reloj entra por parametro.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type ElArranque =
  | {
      arrancado: false;
      /** El dia fijado, si ya se eligio uno futuro. `null` = no hay fecha todavia. */
      fijadoPara: string | null;
    }
  | {
      arrancado: true;
      /** El dia (YYYY-MM-DD), para decirlo en pantalla. */
      fecha: string;
      /** El instante para un `gte` de PostgREST, anclado a la medianoche de Bogota. */
      desde: string;
    };

/**
 * El estado del arranque, del unico valor que lo decide y del dia de hoy en Colombia.
 *
 * SE COMPARAN LAS FECHAS COMO TEXTO Y AQUI SI ES CORRECTO, al contrario que en `elMasTardio`: las dos son
 * 'YYYY-MM-DD', mismo formato y misma zona, y en ese formato el orden alfabetico ES el cronologico. Lo que
 * no se puede comparar como texto son dos INSTANTES con desplazamientos distintos, que es el caso de al
 * lado y por eso lleva su propia nota.
 */
export function elArranque(fecha: string | null, hoy: string): ElArranque {
  if (fecha == null) return { arrancado: false, fijadoPara: null };
  const dia = fecha.slice(0, 10);
  if (dia > hoy) return { arrancado: false, fijadoPara: dia };
  return { arrancado: true, fecha: dia, desde: `${dia}T00:00:00-05:00` };
}

/**
 * LA FRASE QUE DICE QUE TODAVIA NO SE HA ARRANCADO, en un solo sitio.
 *
 * Son CUATRO pantallas las que la necesitan (Direccion, Inicio, los insights y lo deshecho), y la version
 * anterior de este aviso se escribio cuatro veces: por eso las cuatro afirmaban *"es el dia del arranque"*
 * sobre una fecha que nadie habia arrancado, y corregir una habria dejado tres mintiendo. Es el mismo
 * motivo por el que la fecha vive en un solo valor.
 *
 * Devuelve `null` cuando ya se arranco, porque entonces la pantalla no tiene que avisar nada: cada tarjeta
 * dice su propia ventana.
 */
export function avisoDeQueNoSeHaArrancado(arranque: ElArranque): string | null {
  if (arranque.arrancado) return null;
  return arranque.fijadoPara == null
    ? "Todavía no se ha arrancado la operación, así que estas cifras no cuentan nada. Lo que hay en el sistema es de las pruebas, y sigue entero: no se borró nada, y lo que se le debe a alguien se liquida igual."
    : `El arranque está fijado para el ${arranque.fijadoPara}, así que hasta ese día estas cifras no cuentan nada. Lo que hay en el sistema es de las pruebas, y sigue entero: no se borró nada, y lo que se le debe a alguien se liquida igual.`;
}
