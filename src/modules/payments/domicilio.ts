import { addBusinessDays, businessDaysUntil } from "@/core/dates/colombia-business-days";

import type { Modalidad } from "./modalidad";

// ═══ EL ENVIO A DOMICILIO Y EL DERECHO DE RETRACTO ═══
//
// MODULO PURO: hasta cuando el paciente puede retractarse, y el aviso que se le da cuando la entrega es a
// domicilio. El plazo sale de la LEY 1480 DE 2011; el aviso, de la decision contable del 2026-10-05.
//
// ── EL FLETE SE RETIRO DE AQUI, Y NO ES UN RECORTE: ES LA DECISION (contabilidad, 2026-10-05) ──────
//
// Textual: "el flete queda completamente fuera de CNV. El paciente le paga el envio directamente al
// servicio de mensajeria, nunca a CNV ni al Integrante. Atlas no cobra flete, no lo factura y no registra
// ningun gasto de domicilio."
//
// POR QUE, con sus razones: CNV opera en varias zonas del pais y una tabla de tarifas por zona se vuelve
// inmanejable al expandirse; los domicilios son casos contados, no el canal principal; y montar la
// maquineria contable del flete (facturacion con IVA, documento soporte, retencion, conciliacion) para una
// operacion excepcional es desproporcionado.
//
// LA REGLA INNEGOCIABLE, textual: "el dinero del flete nunca entra a cuentas de CNV ni de un Integrante. Sin
// excepciones, ni por hacerle el favor a un paciente. Si entra una vez, aparece un ingreso sin factura y un
// gasto sin soporte, y se rompe la consistencia de todo el modelo."
//
// LO QUE VIVIA AQUI Y SE FUE: `fleteDelEnvio` (costo + margen + IVA), `MARGEN_DE_FLETE_POR_DEFECTO`, y
// `ofertaDeDomicilio` con su lista de ciudades habilitadas. La lista era un porton que existia por una sola
// razon ("es preferible NO ofrecer el domicilio a un destino que ofrecerlo y perder dinero en cada envio") y
// esa razon desaparecio con el flete: CNV ya no pone plata en ningun envio, asi que no hay destino que le
// cueste dinero. Se retira en vez de dejarse apagada: una lista que ya no decide nada solo le niega el
// envio a un paciente de una ciudad que nadie alcanzo a teclear.

/** Cinco dias habiles desde la entrega (Ley 1480 de 2011, articulo 47). */
export const DIAS_DE_RETRACTO = 5;

/**
 * EL AVISO QUE SE LE DA AL PACIENTE cuando la entrega es a domicilio. LITERAL de contabilidad (2026-10-05).
 *
 * VA COMO CONSTANTE Y NO ESCRITO EN LA PANTALLA, por la misma razon que `TEXTO_DE_RETRACTO`: su redaccion
 * hace trabajo juridico. Deja claro que el servicio lo presta UN TERCERO y que CNV solo coordina, y es eso
 * lo que protege en caso de reclamo por una entrega. Una copia suavizada en otra pantalla se lleva por
 * delante justo esa proteccion.
 *
 * LA HORQUILLA DE 10.000 A 20.000 ES ORIENTATIVA Y ASI ESTA DICHA ("generalmente", "el valor exacto" se
 * confirma al coordinar): no es una tarifa de CNV, porque CNV no cobra el envio.
 */
export const TEXTO_AVISO_DOMICILIO =
  "Envío a domicilio. El envío lo realiza un servicio de mensajería independiente y se paga directamente a " +
  "esa persona, aparte del valor del producto. El costo depende de la zona, generalmente entre 10.000 y " +
  "20.000 pesos. Nos comunicaremos contigo para coordinar la entrega y confirmarte el valor exacto.";

export type EstadoDelRetracto = {
  /** Si esta venta tiene derecho de retracto en absoluto. */
  aplica: boolean;
  /** Por que no aplica, cuando no aplica. */
  motivo: string | null;
  /** Ultimo dia para ejercerlo (AAAA-MM-DD). null si no aplica o si todavia no se ha entregado. */
  limite: string | null;
  /** Dias habiles que quedan. null cuando no corre. */
  diasHabilesRestantes: number | null;
  vencido: boolean;
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const aMediodia = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

/**
 * El estado del derecho de retracto de una venta.
 *
 * LAS DOS CONDICIONES PARA QUE APLIQUE (§5.7):
 *
 *   1. QUE SEA VENTA A DISTANCIA. El envio a domicilio es lo que la convierte en eso; una venta entregada en
 *      consulta no activa el retracto.
 *   2. QUE SEA MODALIDAD COMISION. Bajo Distribucion el expendedor frente al paciente es el INTEGRANTE, asi
 *      que ese frente lo asume el, no CNV. Decirle al paciente que CNV lo honra seria prometer por otro.
 *
 * Y EL PLAZO CORRE DESDE LA ENTREGA, no desde el pago: el articulo 47 cuenta cinco dias habiles "siguientes a
 * la entrega". Una venta pagada y no entregada todavia no tiene reloj corriendo.
 */
export function estadoDelRetracto(e: {
  deliveryMode: string | null;
  modalidad: Modalidad;
  /** AAAA-MM-DD de la entrega, o null si no se ha entregado. */
  entregadaEl: string | null;
  hoy: string;
}): EstadoDelRetracto {
  if (e.deliveryMode !== "domicilio") {
    return {
      aplica: false,
      motivo: "El retracto aplica a las ventas a distancia; esta se entregó en consulta.",
      limite: null,
      diasHabilesRestantes: null,
      vencido: false,
    };
  }
  if (e.modalidad === "distribucion") {
    return {
      aplica: false,
      motivo:
        "Bajo modalidad Distribución el expendedor frente al paciente es el Integrante, así que el retracto se atiende con él.",
      limite: null,
      diasHabilesRestantes: null,
      vencido: false,
    };
  }
  if (!e.entregadaEl) {
    return {
      aplica: true,
      motivo: null,
      // EL RELOJ NO HA ARRANCADO: se dice que aplica, pero sin fecha. Poner una fecha desde el pago le
      // comeria dias al paciente por un envio que todavia no llego.
      limite: null,
      diasHabilesRestantes: null,
      vencido: false,
    };
  }
  const limite = ymd(addBusinessDays(aMediodia(e.entregadaEl), DIAS_DE_RETRACTO));
  const vencido = e.hoy > limite;
  return {
    aplica: true,
    motivo: null,
    limite,
    diasHabilesRestantes: vencido ? 0 : businessDaysUntil(aMediodia(e.hoy), aMediodia(limite)),
    vencido,
  };
}

/**
 * ¿Procede el retracto que el paciente pide?
 *
 * LA REGLA OPERATIVA DEL MODELO, tal cual su tabla: dentro de los cinco dias habiles, con el producto SELLADO
 * y sin abrir, PROCEDE y CNV lo honra; con el sello roto o el envase abierto NO PROCEDE, por bien de uso
 * personal (numeral 7 del articulo 47).
 *
 * Y LAS EXCEPCIONES QUE NO APLICAN, escritas para que nadie las vuelva a invocar: "perecederos" y "bienes que
 * caducan con rapidez" NO valen, porque el producto tiene dos años de vida util.
 */
export function procedeElRetracto(e: {
  estado: EstadoDelRetracto;
  selloIntacto: boolean;
}): { procede: boolean; motivo: string } {
  if (!e.estado.aplica) {
    return { procede: false, motivo: e.estado.motivo ?? "El retracto no aplica a esta venta." };
  }
  if (e.estado.limite == null) {
    return { procede: false, motivo: "Esa venta todavía no se ha entregado: el plazo de retracto no ha empezado." };
  }
  if (e.estado.vencido) {
    return { procede: false, motivo: `El plazo de retracto venció el ${e.estado.limite}.` };
  }
  if (!e.selloIntacto) {
    return {
      procede: false,
      motivo:
        "El producto llegó con el sello roto o el envase abierto: por tratarse de un bien de uso personal, el retracto no procede (artículo 47, numeral 7).",
    };
  }
  // LA FRASE YA NO PROMETE EL ENVIO (2026-10-05): desde que el flete salio de CNV, lo que el paciente le
  // pago a CNV es el producto, y el envio se lo pago al mensajero. Prometer aqui un reintegro del envio
  // seria ofrecer plata que CNV nunca recibio, y lo diria la pantalla de quien tiene que cumplirlo.
  return { procede: true, motivo: "Procede: producto sellado y dentro del plazo. Se reintegra todo lo que el paciente le pagó a CNV." };
}

/**
 * EL TEXTO QUE SE PUBLICA, tal como el modelo pide publicarlo "en Atlas y en el reporte del paciente".
 *
 * VA COMO CONSTANTE Y NO ESCRITO EN CADA PANTALLA porque es texto legal: dos copias se separan, y una version
 * suavizada del derecho de retracto es una infraccion, no un matiz de redaccion.
 *
 * ── ATENCION: UNA FRASE DE AQUI QUEDO PENDIENTE DE RATIFICAR (2026-10-05) ──────────────────────────
 *
 * Dice "se te reintegrara la totalidad de lo pagado, INCLUIDO EL VALOR DEL ENVIO". Esa frase se escribio
 * cuando CNV cobraba el flete. Desde la decision contable del 2026-10-05 el paciente le paga el envio al
 * mensajero, asi que CNV no recibe ese dinero y no lo puede reintegrar.
 *
 * NO SE TOCA POR CUENTA PROPIA, y esa es la razon de esta nota: es texto legal publicado al paciente, y
 * recortarle un derecho sin que lo ratifique quien lo redacto es exactamente lo que el parrafo de arriba
 * prohibe. La decision contable trajo el aviso nuevo (`TEXTO_AVISO_DOMICILIO`) pero no toco este. La
 * pregunta esta planteada en `BACKLOG.md`; mientras no se responda, la frase se queda como esta: promete de
 * mas en contra de CNV, que es el lado seguro de equivocarse.
 */
export const TEXTO_DE_RETRACTO =
  "Derecho de retracto. Si tu compra fue entregada a domicilio, puedes retractarte dentro de los cinco (5) " +
  "días hábiles siguientes a la entrega, conforme al artículo 47 de la Ley 1480 de 2011, siempre que el " +
  "producto se encuentre sin abrir y con su sello original intacto. En ese caso se te reintegrará la " +
  "totalidad de lo pagado, incluido el valor del envío. Los productos con el sello roto o el envase abierto " +
  "se encuentran exceptuados del retracto por tratarse de bienes de uso personal, conforme al numeral 7 del " +
  "mismo artículo. La devolución del producto corre por cuenta del consumidor, en las mismas condiciones en " +
  "que lo recibió.";

/**
 * Lo que se le reintegra al paciente que se retracta.
 *
 * El articulo exige devolver "todas las sumas pagadas SIN DESCUENTOS NI RETENCIONES POR CONCEPTO ALGUNO".
 *
 * EL PARAMETRO `flete` SE QUEDA, Y VALE 0 EN TODA VENTA NUEVA (2026-10-05): el paciente le paga el envio al
 * mensajero, asi que ninguna venta posterior a esa fecha sella un flete. Se conserva porque las ventas
 * ANTERIORES si lo tienen sellado, y una de ellas todavia puede retractarse: en esas, CNV si cobro el envio
 * y si lo debe. Borrar el parametro haria que esas devolvieran de menos.
 */
export function reintegroPorRetracto(e: { montoDelProducto: number; flete: number }): number {
  return e.montoDelProducto + e.flete;
}
