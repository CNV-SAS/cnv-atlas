// ═══ LOS VENCIMIENTOS DE LOTE: LA ALERTA Y QUIEN ASUME (2026-09-28) ═══
//
// MODULO PURO: recibe lotes, fechas y el registro de la alerta, y decide. Sin base y sin reloj propio, para
// que la regla que mueve plata se pueda probar con fechas fijas. Igual que `liquidacion.ts` y `reparto.ts`.
//
// ── LAS DOS FRASES DEL MODELO COMERCIAL, que son toda la regla ──
//
//   §"Vencidos": "El producto no vendido que se vence lo asume CNV, por conservar la propiedad, SALVO que
//   Atlas haya generado la alerta de vencimiento y el Integrante no haya actuado, caso en el cual lo asume
//   el al precio de facturacion, con el mismo tratamiento del faltante."
//
//   §"Alerta de vencimiento": "El sistema alerta con sesenta dias de anticipacion sobre el vencimiento de
//   cada lote en poder de un Integrante, y registra si la alerta fue vista y atendida. ESE REGISTRO ES LO
//   QUE DETERMINA QUIEN ASUME EL VENCIDO."
//
// De ahi salen tres decisiones de diseño que conviene dejar escritas, porque las tres se ven raras si no se
// sabe de donde vienen:
//
// 1. LA ALERTA ES UN REGISTRO, NO UN CORREO. El correo es como se entrega; lo que decide quien paga es la
//    FILA (cuando se genero, con cuantos dias de anticipacion, cuantas unidades habia, si la vio). Un aviso
//    que solo existe como correo enviado no sirve para sostener un cargo seis meses despues.
//
// 2. "ATENDIDA" NO SE DECLARA, SE DERIVA. No hay formulario de "ya lo atendi": el lote se atendio si sus
//    unidades en esa ubicacion llegaron a CERO antes de vencer (se vendio, o se devolvio a CNV). Pedirle
//    que lo declare seria pedirle que afirme algo que el inventario ya sabe, y abrir la puerta a que la
//    declaracion y el saldo digan cosas distintas (el defecto de "dos partes que leen fuentes distintas").
//    Lo que SI se registra por declaracion es "vista", porque eso el sistema no lo puede deducir.
//
// 3. ATLAS PROPONE, DOS PERSONAS COBRAN. `quienAsumeElVencido` devuelve una PROPUESTA con su razon, no un
//    cargo. Es la misma doctrina del faltante ("ni un solo administrativo cobra solo"), y aqui pesa mas:
//    la unica diferencia entre "lo asume CNV" y "lo asume el Integrante" es si la alerta le dio tiempo
//    real, y eso tiene casos de borde que una persona tiene que mirar (ver `alertaTardia`).

/** Los dias de anticipacion del modelo. Es el DEFECTO: el valor vigente vive en `commercial_config`. */
export const DIAS_DE_ALERTA_POR_DEFECTO = 60;

export type EstadoDeVencimiento = "vigente" | "por_vencer" | "vencido";

export type LoteEnCustodia = {
  lotId: string;
  /** El codigo del lote, para que la pantalla y el correo digan de cual se habla. */
  codigo: string;
  nutraceuticalId: string;
  producto: string;
  /** AAAA-MM-DD. */
  vence: string;
  unidades: number;
};

export type Clasificacion = {
  estado: EstadoDeVencimiento;
  /** Dias hasta el vencimiento. Negativo = ya vencio (hace tantos dias). */
  diasRestantes: number;
};

const DIA = 86_400_000;

/** El dia de hoy en Colombia, en AAAA-MM-DD. Lo mismo que hace el resumen de avisos. */
export function diaEnColombia(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
}

function aMediodia(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Dias calendario entre dos AAAA-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((aMediodia(b).getTime() - aMediodia(a).getTime()) / DIA);
}

/**
 * Vigente, por vencer o vencido, contra el dia de hoy y la ventana de alerta.
 *
 * EL DIA DEL VENCIMIENTO TODAVIA NO ESTA VENCIDO: un lote que vence el 30 se puede vender el 30. Vencido es
 * a partir del 31. Es la lectura literal de una fecha de vencimiento en un envase, y la que el paciente
 * espera; tomar el mismo dia como vencido le quitaria a CNV un dia de venta por una convencion nuestra.
 */
export function clasificar(vence: string, hoy: string, diasDeAlerta: number): Clasificacion {
  const diasRestantes = diasEntre(hoy, vence);
  if (diasRestantes < 0) return { estado: "vencido", diasRestantes };
  if (diasRestantes <= diasDeAlerta) return { estado: "por_vencer", diasRestantes };
  return { estado: "vigente", diasRestantes };
}

export type RegistroDeAlerta = {
  /** AAAA-MM-DD en que Atlas genero la alerta. */
  generadaEl: string;
  /** Los dias de anticipacion VIGENTES cuando se genero, sellados en la fila. */
  diasDeAnticipacion: number;
  /** AAAA-MM-DD en que el Integrante la marco vista. null = nunca la vio en Atlas. */
  vistaEl: string | null;
};

export type PropuestaDeVencido = {
  /** Quien lo asume, PROPUESTO. Ninguna de las dos se cobra sola. */
  asume: "cnv" | "integrante";
  /** La razon, en el idioma del modelo, para que la pantalla no tenga que reconstruirla. */
  razon: string;
  /**
   * Dias que la alerta le dio para actuar (del aviso al vencimiento). null si no hubo alerta.
   *
   * POR QUE SE DEVUELVE Y NO SOLO SE USA: es el dato que una persona necesita para decidir el caso de
   * borde de abajo, y el que el Integrante puede discutir.
   */
  diasQueTuvo: number | null;
  /**
   * LA ALERTA LLEGO TARDE: existio, pero con MENOS anticipacion que la que el modelo promete (porque el
   * lote entro a su vitrina cuando ya le quedaba poco). El modelo no cubre este caso: dice "haya generado
   * la alerta", sin exigir que fueran los sesenta dias. Se marca en vez de resolverse solo, porque
   * cobrarle a alguien por no vender en once dias un lote que CNV le mando con once dias de vida no es lo
   * que la clausula quiso decir, y eso lo tiene que decidir una persona, no esta funcion.
   */
  alertaTardia: boolean;
};

/**
 * La PROPUESTA de quien asume un lote vencido con unidades en la vitrina de un Integrante.
 *
 * `alerta` null = Atlas nunca alerto de ese lote (llego y vencio sin pasar por la ventana, o la alerta no
 * se genero). Entonces lo asume CNV sin discusion: el "salvo" del modelo no se cumple.
 */
export function quienAsumeElVencido(e: {
  vence: string;
  alerta: RegistroDeAlerta | null;
}): PropuestaDeVencido {
  if (!e.alerta) {
    return {
      asume: "cnv",
      razon: "Atlas no alcanzó a generar la alerta de este lote, así que el vencido lo asume CNV, que conserva la propiedad.",
      diasQueTuvo: null,
      alertaTardia: false,
    };
  }
  const diasQueTuvo = diasEntre(e.alerta.generadaEl, e.vence);
  const alertaTardia = diasQueTuvo < e.alerta.diasDeAnticipacion;
  const vio = e.alerta.vistaEl != null;
  return {
    asume: "integrante",
    // LA RAZON NOMBRA LOS DOS HECHOS, y "vista" no es condicion: el modelo pide REGISTRAR si se vio, y el
    // registro es lo que sostiene el caso. Un integrante que nunca abrio Atlas no queda eximido por no
    // haber mirado; pero que no la vio se dice, porque es lo primero que va a alegar y porque es cierto.
    razon: vio
      ? `La alerta se generó el ${e.alerta.generadaEl}, le dio ${diasQueTuvo} días y la vio el ${e.alerta.vistaEl}. Quedaron unidades sin vender, así que el vencido lo asume el Integrante al precio de facturación.`
      : `La alerta se generó el ${e.alerta.generadaEl} y le dio ${diasQueTuvo} días, pero NO la marcó vista en Atlas. Quedaron unidades sin vender, así que la propuesta es que lo asuma el Integrante, con ese hecho a la vista.`,
    diasQueTuvo,
    alertaTardia,
  };
}

/**
 * Los lotes de una custodia que hay que alertar hoy: los que estan en la ventana o ya vencidos, con
 * unidades. Ordenados por vencimiento (lo mas urgente primero), que es el mismo orden del despacho (FEFO).
 */
export function lotesQueAlertar(
  lotes: LoteEnCustodia[],
  hoy: string,
  diasDeAlerta: number,
): (LoteEnCustodia & Clasificacion)[] {
  return lotes
    .filter((l) => l.unidades > 0)
    .map((l) => ({ ...l, ...clasificar(l.vence, hoy, diasDeAlerta) }))
    .filter((l) => l.estado !== "vigente")
    .sort((a, b) => a.vence.localeCompare(b.vence));
}

/** Como se le dice al Integrante cuanto le queda, sin obligarlo a restar fechas. */
export function textoDelPlazo(c: Clasificacion): string {
  if (c.estado === "vencido") {
    // Vencido es siempre al menos un dia (el dia del vencimiento todavia se puede vender, ver `clasificar`).
    const d = -c.diasRestantes;
    return `venció hace ${d} ${d === 1 ? "día" : "días"}`;
  }
  if (c.diasRestantes === 0) return "vence hoy";
  return `quedan ${c.diasRestantes} ${c.diasRestantes === 1 ? "día" : "días"}`;
}
