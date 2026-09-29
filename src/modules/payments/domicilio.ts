import { addBusinessDays, businessDaysUntil } from "@/core/dates/colombia-business-days";

import type { Modalidad } from "./modalidad";

// ═══ EL ENVIO A DOMICILIO Y EL DERECHO DE RETRACTO (2026-09-29) ═══
//
// MODULO PURO. Dos cosas que no se pueden inventar en una pantalla: si se puede ofrecer domicilio a un
// destino, y hasta cuando el paciente puede retractarse.
//
// TODO SALE DEL MODELO COMERCIAL §5 Y DE LA LEY 1480 DE 2011. Cada regla lleva su cita.

/** Cinco dias habiles desde la entrega (Ley 1480 de 2011, articulo 47). */
export const DIAS_DE_RETRACTO = 5;

export type CiudadHabilitada = { city: string; department: string; daneCode: string | null };

export type OfertaDeDomicilio =
  | { ofrece: true; tarifa: number }
  | { ofrece: false; motivo: string };

/**
 * ¿Se le puede ofrecer domicilio a este destino?
 *
 * EL CRITERIO ES DEL MODELO §5.5, textual: "es preferible NO ofrecer el domicilio a un destino que ofrecerlo
 * y perder dinero en cada envio". Por eso la ausencia de datos NIEGA en vez de permitir: sin tarifa
 * configurada o sin la ciudad en la lista, no se ofrece.
 *
 * `ciudad` vacia = todavia no eligio destino; entonces solo se comprueba que el servicio exista.
 */
export function ofertaDeDomicilio(e: {
  tarifa: number | null;
  ciudades: CiudadHabilitada[];
  ciudad?: string | null;
  departamento?: string | null;
}): OfertaDeDomicilio {
  if (e.tarifa == null || e.tarifa <= 0) {
    return { ofrece: false, motivo: "El envío a domicilio no está habilitado: falta la tarifa de flete." };
  }
  if (e.ciudades.length === 0) {
    return { ofrece: false, motivo: "El envío a domicilio no está habilitado: no hay ciudades con cobertura." };
  }
  if (e.ciudad) {
    const igual = (a: string, b: string) => a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");
    const hay = e.ciudades.some(
      (c) => igual(c.city, e.ciudad as string) && (!e.departamento || igual(c.department, e.departamento)),
    );
    if (!hay) {
      return {
        ofrece: false,
        // SE DICE QUE SE PUEDE COTIZAR, no solo que no se puede: §5.5 admite "o la ofrece con cotizacion caso
        // a caso", y un "no" seco manda al paciente a otro lado cuando el envio si era posible.
        motivo: `Todavía no hay cobertura de domicilio en ${e.ciudad}. Escríbele a CNV si necesitas una cotización para ese destino.`,
      };
    }
  }
  return { ofrece: true, tarifa: e.tarifa };
}

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
  return { procede: true, motivo: "Procede: producto sellado y dentro del plazo. Se reintegra todo lo pagado, incluido el envío." };
}

/**
 * EL TEXTO QUE SE PUBLICA, tal como el modelo pide publicarlo "en Atlas y en el reporte del paciente".
 *
 * VA COMO CONSTANTE Y NO ESCRITO EN CADA PANTALLA porque es texto legal: dos copias se separan, y una version
 * suavizada del derecho de retracto es una infraccion, no un matiz de redaccion.
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
 * Lo que se le reintegra al paciente que se retracta: TODO, incluido el flete.
 *
 * El articulo exige devolver "todas las sumas pagadas SIN DESCUENTOS NI RETENCIONES POR CONCEPTO ALGUNO", y el
 * modelo lo remata: "CNV asume el costo del envio de ida y no lo recupera".
 */
export function reintegroPorRetracto(e: { montoDelProducto: number; flete: number }): number {
  return e.montoDelProducto + e.flete;
}
