// ═══ CUANDO TOCA EL CONTEO FISICO (Santiago, 2026-10-06) ═══
//
// MODULO PURO: decide si un Integrante puede registrar un conteo hoy, y si no, cuando le toca. Sin base y sin
// reloj propio, como `modalidad.ts` y `distribucion.ts`, y por la misma razon: es la regla que habilita o
// niega una accion a una persona, y tiene que poder probarse entera.
//
// ── EL PROBLEMA QUE RESUELVE, Y NO ES EL QUE PARECIA ────────────────────────────────────────────────
//
// La seccion de conteo de `/mi-inventario` estaba SIEMPRE abierta, y los Integrantes entendian que tocaba
// contar cada vez que recibian algo. El arreglo no es un interruptor: es que una seccion siempre abierta NO
// DICE CUANDO TOCA. Un bloque que dice "el conteo de este mes se abre el 1 y tienes hasta el 5" contesta la
// pregunta que la gente se estaba haciendo; el resto del mes la seccion queda cerrada con esa frase en vez de
// con un formulario.
//
// ── LA CADENCIA ES NUESTRA, NO DEL MODELO, y conviene saberlo ───────────────────────────────────────
//
// Verificado el 2026-10-05: el modelo comercial solo dice que "el conteo fisico y la conciliacion se
// mantienen en ambas modalidades" y que el faltante se detecta ahi. El "SEMANAL" que estaba escrito salia de
// nuestra propia planeacion de T3b-3, no de un contrato ni del contable. Asi que elegir mensual es una
// decision de Santiago que solo obliga a actualizar nuestro doc.
//
// LO QUE SI DICE EL MODELO, y por eso nada de esto esta en el codigo: "nada de valores fijos en el codigo".
// El dia de apertura y el largo de la ventana viven en `commercial_config`.
//
// ── Y UNA CONSECUENCIA DE LA CADENCIA, dicha porque es el costo de la decision ──────────────────────
//
// El conteo es "el unico control que detecta ventas no registradas" (modelo §6), asi que mensual detecta mas
// tarde que semanal. Bajo Comision pesa menos (CNV recauda); bajo DISTRIBUCION pesa mas, porque una venta no
// registrada es producto de CNV que salio sin factura.

/** Dia del mes en que se abre la ventana, por defecto. El vigente vive en `commercial_config`. */
export const DIA_DE_APERTURA_POR_DEFECTO = 1;

/** Cuantos dias dura la ventana, por defecto. El vigente vive en `commercial_config`. */
export const DIAS_DE_VENTANA_POR_DEFECTO = 5;

export type Ventana = {
  /** Primer dia en que se puede contar (AAAA-MM-DD). */
  desde: string;
  /** Ultimo dia en que se puede contar (AAAA-MM-DD), inclusive. */
  hasta: string;
};

export type AperturaManual = {
  /**
   * ¿YA CONTO DESPUES DE QUE SE LE PIDIO?
   *
   * ── POR QUE ES UN BOOLEANO Y NO UNA FECHA, y la distincion importa ────────────────────────────────
   *
   * Primero lo escribi como la fecha en que se concedio, y el candado de base lo tumbo: el caso real es el
   * MISMO DIA ("contaste esta mañana, no cuadra, cuenta otra vez"), y a resolucion de DIA no se distingue un
   * conteo anterior a la peticion de uno posterior. Los dos caen en la misma fecha.
   *
   * ASI QUE LA PREGUNTA SE PARTE EN DOS, cada una donde se puede contestar bien: el CALENDARIO es una
   * cuestion de fechas y vive en este modulo; "¿conto despues de que se le pidio?" es una cuestion de
   * INSTANTES y la contesta el lector comparando `timestamptz`. Forzar lo segundo a fechas es como se pierde
   * una peticion del mismo dia.
   */
  yaRespondida: boolean;
  /** Hasta cuando vale esta apertura (AAAA-MM-DD), inclusive. */
  hasta: string;
  /** Por que se abrio. Va a la pantalla del Integrante: si le abren el conteo, tiene derecho a saber por que. */
  motivo: string | null;
};

export type EstadoDelConteo =
  | { abierto: true; porQue: "ventana" | "apertura_manual"; ventana: Ventana; motivo: string | null }
  | { abierto: false; porQue: "ya_conto"; ventana: Ventana; contadoEl: string }
  | { abierto: false; porQue: "fuera_de_ventana"; proxima: Ventana };

const aMediodia = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const sumarDias = (s: string, n: number) => {
  const d = aMediodia(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/**
 * La ventana del mes al que pertenece `dia`, o la del mes anterior si `dia` cae antes de la apertura.
 *
 * POR QUE MIRA TAMBIEN EL MES ANTERIOR: con apertura el dia 28 y cinco dias de ventana, la ventana de
 * septiembre llega hasta el 2 de octubre. Un Integrante que entre el 1 de octubre esta DENTRO de la ventana de
 * septiembre, no fuera de la de octubre. Calcular solo la del mes en curso lo dejaria fuera de una ventana
 * abierta, que es el peor fallo posible de esta funcion: le niega una obligacion que si le toca.
 */
function ventanaVigente(dia: string, diaDeApertura: number, diasDeVentana: number): Ventana {
  const hoy = aMediodia(dia);
  const deEseMes = (anio: number, mes: number): Ventana => {
    // El dia de apertura se recorta al ultimo dia del mes: con apertura el 31, febrero abre el 28.
    const ultimo = new Date(anio, mes + 1, 0, 12).getDate();
    const desde = ymd(new Date(anio, mes, Math.min(diaDeApertura, ultimo), 12));
    return { desde, hasta: sumarDias(desde, Math.max(1, diasDeVentana) - 1) };
  };

  const deEsteMes = deEseMes(hoy.getFullYear(), hoy.getMonth());
  if (dia >= deEsteMes.desde) return deEsteMes;

  // Antes de la apertura de este mes: la que puede estar viva es la del mes pasado.
  const anterior = deEseMes(hoy.getFullYear(), hoy.getMonth() - 1);
  return dia <= anterior.hasta ? anterior : deEsteMes;
}

/**
 * ¿Puede este Integrante registrar un conteo hoy?
 *
 * ── LAS TRES RAZONES POR LAS QUE PUEDE O NO, EN ESTE ORDEN Y NO EN OTRO ─────────────────────────────
 *
 * 1. UNA PETICION DE ADMIN SIN RESPONDER -> ABIERTO. Va PRIMERO, y el orden es la correccion: lo escribi al
 *    reves (el conteo ya hecho primero) y el candado lo atrapo. Si admin pide un conteo el 4 porque el del 2
 *    no explico la diferencia, ese conteo del 2 NO puede cerrarle la puerta: la peticion existe justamente
 *    porque no sirvio. "Sin responder" = no ha contado desde que se le pidio.
 * 2. YA CONTO EN ESTA VENTANA -> CERRADO. Es la mitad que vuelve coherente a la ventana (la añadio Santiago):
 *    si despues de contar siguiera abierta, la ventana no significaria nada y volveriamos a la seccion
 *    siempre encendida, solo que con un texto nuevo.
 * 3. LA VENTANA DEL CALENDARIO -> ABIERTO si hoy cae dentro.
 *
 * POR QUE LA OBLIGACION TIENE FECHA PROPIA Y NO SOLO UN INTERRUPTOR DE ADMIN: con solo el interruptor, los
 * Integrantes quedan esperando que alguien les abra la puerta, y el dia que nadie la abra no hay conteo y
 * nadie lo nota. Las dos cosas, no una.
 */
export function estadoDelConteo(e: {
  hoy: string;
  diaDeApertura?: number;
  diasDeVentana?: number;
  /** El ultimo conteo registrado por este Integrante (AAAA-MM-DD), o null si nunca conto. */
  ultimoConteo: string | null;
  /** Apertura concedida por admin, si hay una vigente. */
  aperturaManual?: AperturaManual | null;
}): EstadoDelConteo {
  const ventana = ventanaVigente(
    e.hoy,
    e.diaDeApertura ?? DIA_DE_APERTURA_POR_DEFECTO,
    e.diasDeVentana ?? DIAS_DE_VENTANA_POR_DEFECTO,
  );

  // 1. UNA PETICION DE ADMIN SIN RESPONDER. "Sin responder" lo contesta el lector comparando instantes (ver
  // `AperturaManual`): a resolucion de dia no se distingue un conteo anterior a la peticion de uno posterior,
  // y el caso real es el del mismo dia.
  const manual = e.aperturaManual;
  if (manual && e.hoy <= manual.hasta && !manual.yaRespondida) {
    return { abierto: true, porQue: "apertura_manual", ventana, motivo: manual.motivo };
  }

  // 2. YA CONTO EN ESTA VENTANA.
  if (e.ultimoConteo != null && e.ultimoConteo >= ventana.desde && e.ultimoConteo <= ventana.hasta) {
    return { abierto: false, porQue: "ya_conto", ventana, contadoEl: e.ultimoConteo };
  }

  // 3. LA VENTANA DEL CALENDARIO.
  if (e.hoy >= ventana.desde && e.hoy <= ventana.hasta) {
    return { abierto: true, porQue: "ventana", ventana, motivo: null };
  }

  // FUERA: se dice CUANDO le toca, no solo que no puede. "No disponible" sin fecha deja al Integrante sin
  // nada que hacer con la informacion, que es el problema con el que empezo todo esto.
  const hoy = aMediodia(e.hoy);
  const siguiente =
    e.hoy > ventana.hasta
      ? ventanaVigente(ymd(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 15, 12)), e.diaDeApertura ?? DIA_DE_APERTURA_POR_DEFECTO, e.diasDeVentana ?? DIAS_DE_VENTANA_POR_DEFECTO)
      : ventana;
  return { abierto: false, porQue: "fuera_de_ventana", proxima: siguiente };
}

/** Lo que la pantalla del Integrante dice, en una frase. Vive aqui para que las dos pantallas no divergan. */
export function fraseDelConteo(estado: EstadoDelConteo): string {
  if (estado.abierto) {
    if (estado.porQue === "apertura_manual") {
      return estado.motivo
        ? `CNV te pidió un conteo: ${estado.motivo}`
        : "CNV te pidió un conteo fuera del calendario.";
    }
    return `El conteo de este período está abierto hasta el ${estado.ventana.hasta}.`;
  }
  if (estado.porQue === "ya_conto") {
    return `Ya contaste en este período, el ${estado.contadoEl}. El próximo conteo se abre el mes entrante.`;
  }
  return `El conteo se abre el ${estado.proxima.desde} y tienes hasta el ${estado.proxima.hasta}.`;
}
