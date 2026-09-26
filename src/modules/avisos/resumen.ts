import { addBusinessDays } from "@/core/dates/colombia-business-days";
import { formatDate } from "@/lib/format/date";
import { plazoDeRevision } from "@/modules/payments/plazo-de-revision";

// ═══ EL RESUMEN DE LO QUE PIDE ACCION HUMANA (Bloque A) ═══
//
// Modulo PURO: recibe lo pendiente, lo que se aviso la vez anterior y la fecha, y decide si se envia y que dice.
// Sin base, sin correo, sin reloj propio: se prueba con fechas fijas.
//
// LAS REGLAS, TODAS DE SANTIAGO (2026-09-15), y la razon de cada una:
//
//   · SIN REINTENTO AUTOMATICO: ojo humano antes. Por eso el correo tiene que evitar repetir lo mismo cada dia,
//     que es lo que ensena a ignorarlo. Lo evitan las cuatro de abajo.
//   · LO NUEVO PRIMERO, y lo que sigue con los dias que lleva.
//   · LO VIEJO SUBE DE TONO AL VENCER SU PLAZO: la revision, 5 dias habiles (o el cierre del bimestre); la venta
//     sin documento, el cierre de su dia; la nota credito manual, 5 dias habiles. Lo vencido va tambien a
//     escalamiento.
//   · "EN GESTION HASTA": quien lo esta mirando lo saca del correo hasta esa fecha, o hasta su plazo, lo que
//     llegue primero. Un vencido vuelve aunque este en gestion.
//   · AGRUPADO POR CAUSA: doce fallos del mismo motivo se arreglan una vez, y son una linea.
//   · SIN NADA NUEVO, NADA VENCIDO Y LO DEMAS EN GESTION, NO LLEGA CORREO.

export type TipoDePendiente = "revision" | "sin_documento" | "nota_credito" | "reversa" | "por_despachar";
export type Franja = "am" | "pm";

export type Pendiente = {
  tipo: TipoDePendiente;
  /** Distingue dos momentos del mismo pendiente (el estado de la reversa). Ver `clave`. */
  subclave?: string | null;
  /**
   * Dias habiles de plazo desde `desde`, para los tipos cuyo plazo no se deduce del tipo. La reversa tiene dos:
   * 3 para responderle al banco (una disputa sin respuesta a tiempo se PIERDE por silencio) y 5 desde la
   * resolucion para la nota credito. Los demas lo dejan en null y su plazo sale del tipo.
   */
  diasHabilesDePlazo?: number | null;
  transactionId: string;
  /** Desde cuando esta pendiente: la venta (sin documento), la entrada en revision, o la marca del efectivo. */
  desde: string;
  monto: string;
  productos: string;
  /** Lo que agrupa: el motivo de la factura, "falta la version del Integrante", "falta la nota credito". */
  causa: string;
  enGestionHasta: string | null; // AAAA-MM-DD
  enGestionNota: string | null;
  enGestionPor: string | null;
};

/**
 * Lo que identifica un pendiente entre un envio y el siguiente. Lleva `subclave` cuando el MISMO pendiente puede
 * cambiar de significado sin dejar de existir: una reversa pasa de "responde al banco" a "falta la nota credito",
 * y eso es una novedad, no la misma linea de ayer (smoke del 2026-09-17: el cambio de estado no salia en el
 * correo, porque la clave era la misma y contaba como visto).
 */
export const clave = (p: Pick<Pendiente, "tipo" | "transactionId" | "subclave">) =>
  p.subclave ? `${p.tipo}:${p.transactionId}:${p.subclave}` : `${p.tipo}:${p.transactionId}`;

const TITULO: Record<TipoDePendiente, string> = {
  revision: "Pagos en revisión (pago sobre un link anulado)",
  nota_credito: "Efectivo que no se recibió: falta la nota crédito manual",
  sin_documento: "Ventas cobradas sin factura o sin pago registrado",
  reversa: "Contracargos y anulaciones (el banco devolvió el dinero)",
  // Va a ADMIN y no al profesional: el no puede despachar desde una bodega que no es suya.
  por_despachar: "Ventas pagadas cuyo producto sale de la bodega y falta despachar",
};

function diaEnColombia(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
}

function aMediodia(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** El ultimo dia (AAAA-MM-DD, de Colombia) para resolver cada pendiente. */
export function limiteDe(p: Pendiente): string {
  const desde = new Date(p.desde);
  if (p.diasHabilesDePlazo != null) {
    const l = addBusinessDays(aMediodia(diaEnColombia(desde)), p.diasHabilesDePlazo);
    return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, "0")}-${String(l.getDate()).padStart(2, "0")}`;
  }
  if (p.tipo === "revision") {
    const l = plazoDeRevision(desde, desde).limite;
    return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, "0")}-${String(l.getDate()).padStart(2, "0")}`;
  }
  if (p.tipo === "nota_credito") {
    const l = addBusinessDays(aMediodia(diaEnColombia(desde)), 5);
    return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, "0")}-${String(l.getDate()).padStart(2, "0")}`;
  }
  // Sin documento: contabilidad la quiere en cero AL CIERRE DE SU DIA.
  return diaEnColombia(desde);
}

type Clasificado = Pendiente & { limite: string; vencido: boolean; enGestion: boolean; dias: number };

function diasDesde(desde: string, hoy: string): number {
  return Math.max(0, Math.round((aMediodia(hoy).getTime() - aMediodia(diaEnColombia(new Date(desde))).getTime()) / 86_400_000));
}

export type Resumen = {
  enviar: boolean;
  /** Por que no se envia, para dejarlo escrito en el registro del envio. */
  motivoSiNo: string | null;
  asunto: string;
  cuerpo: string;
  escalamiento: { enviar: boolean; asunto: string; cuerpo: string };
  /** TODO lo pendiente ahora, tambien lo que esta en gestion: es contra lo que se mide lo nuevo la proxima vez. */
  claves: string[];
  conteo: { nuevos: number; siguen: number; vencidos: number; enGestion: number };
};

export function armarResumen(e: {
  pendientes: Pendiente[];
  /** Las claves del envio anterior; null si nunca hubo uno (todo es nuevo). */
  anteriores: string[] | null;
  ahora: Date;
  franja: Franja;
  enlace: string;
}): Resumen {
  const hoy = diaEnColombia(e.ahora);
  const anteriores = e.anteriores ? new Set(e.anteriores) : null;
  const todos: Clasificado[] = e.pendientes.map((p) => {
    const limite = limiteDe(p);
    const vencido = hoy > limite;
    const enGestion = !vencido && p.enGestionHasta != null && hoy <= p.enGestionHasta;
    return { ...p, limite, vencido, enGestion, dias: diasDesde(p.desde, hoy) };
  });

  const visibles = todos.filter((p) => !p.enGestion);
  const esNuevo = (p: Clasificado) => !anteriores || !anteriores.has(clave(p));
  const vencidos = visibles.filter((p) => p.vencido);
  const nuevos = visibles.filter((p) => !p.vencido && esNuevo(p));
  const siguen = visibles.filter((p) => !p.vencido && !esNuevo(p));
  const enGestion = todos.filter((p) => p.enGestion);
  const conteo = { nuevos: nuevos.length, siguen: siguen.length, vencidos: vencidos.length, enGestion: enGestion.length };
  const claves = todos.map(clave);

  // LA MANANA manda si hay algo nuevo, vencido, o que sigue sin que nadie lo tome. LA TARDE es para el cierre
  // contable: solo lo nuevo desde la manana y las ventas sin documento de HOY, que vencen al cierre.
  const deHoySinDocumento = siguen.filter((p) => p.tipo === "sin_documento" && p.limite === hoy);
  const disparan = e.franja === "am" ? nuevos.length + vencidos.length + siguen.length : nuevos.length + deHoySinDocumento.length;
  const enviar = disparan > 0;
  const motivoSiNo = enviar
    ? null
    : todos.length === 0
      ? "Nada pendiente."
      : e.franja === "pm"
        ? "Nada nuevo desde la mañana y ninguna venta de hoy sin documento."
        : "Nada nuevo ni vencido: lo pendiente está en gestión.";

  // El asunto y el cuerpo dicen lo mismo que dispara el envio. En la tarde lo vencido no se repite: ya salio en la
  // manana y ya fue a escalamiento; queda una linea con su numero para no esconderlo.
  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  const partes =
    e.franja === "am"
      ? [
          nuevos.length ? plural(nuevos.length, "nueva", "nuevas") : null,
          vencidos.length ? plural(vencidos.length, "vencida", "vencidas") : null,
          siguen.length ? plural(siguen.length, "pendiente", "pendientes") : null,
        ]
      : [
          nuevos.length ? plural(nuevos.length, "nueva", "nuevas") : null,
          deHoySinDocumento.length ? `${plural(deHoySinDocumento.length, "vence", "vencen")} hoy` : null,
        ];
  const asunto = `Atlas · ventas por resolver: ${partes.filter(Boolean).join(", ") || "sin novedades"}${e.franja === "pm" ? " (cierre del día)" : ""}`;

  // LO NUEVO PRIMERO (decision 1 de 3.7), luego lo vencido, luego lo que sigue con sus dias.
  const cuerpo = [
    "Esto necesita a alguien de CNV. Atlas no lo reintenta solo.",
    "",
    seccion("NUEVO", nuevos, hoy),
    e.franja === "am" ? seccion("VENCIDO", vencidos, hoy) : null,
    seccion(e.franja === "pm" ? "SIGUE PENDIENTE (vence al cierre de hoy)" : "SIGUE PENDIENTE", e.franja === "pm" ? deHoySinDocumento : siguen, hoy),
    e.franja === "pm" && vencidos.length
      ? `Además: ${plural(vencidos.length, "vencido sin resolver, que ya salió", "vencidos sin resolver, que ya salieron")} en el correo de la mañana.`
      : null,
    enGestion.length
      ? `En gestión (no se repite hasta su fecha): ${enGestion.length}.`
      : null,
    "",
    `Resuélvelo en Atlas: ${e.enlace}`,
    "Si ya lo estás mirando, márcalo \"en gestión\" con una fecha y deja de llegar hasta entonces.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const escalamiento = {
    enviar: e.franja === "am" && vencidos.length > 0,
    asunto: `Atlas · ESCALAMIENTO: ${vencidos.length} pendiente${vencidos.length === 1 ? "" : "s"} de ventas vencido${vencidos.length === 1 ? "" : "s"}`,
    cuerpo: [
      "Estos pendientes de ventas pasaron su plazo sin resolverse. Te llegan por tener la marca de escalamiento.",
      "",
      seccion("VENCIDO", vencidos, hoy),
      "",
      `En Atlas: ${e.enlace}`,
    ].join("\n"),
  };

  return { enviar, motivoSiNo, asunto, cuerpo, escalamiento, claves, conteo };
}

/**
 * Lo que HOY pide accion, para la franja de la pantalla: lo que no esta en gestion, mas lo vencido aunque lo este.
 * La misma clasificacion que el correo, para que la pantalla y el correo no digan cosas distintas.
 */
export function pendientesVisibles(pendientes: Pendiente[], ahora: Date): { total: number; vencidos: number } {
  const hoy = diaEnColombia(ahora);
  let total = 0;
  let vencidos = 0;
  for (const p of pendientes) {
    const vencido = hoy > limiteDe(p);
    const enGestion = !vencido && p.enGestionHasta != null && hoy <= p.enGestionHasta;
    if (enGestion) continue;
    total++;
    if (vencido) vencidos++;
  }
  return { total, vencidos };
}

/** Una seccion del correo, agrupada por tipo y causa. Vacia, no aparece. */
function seccion(titulo: string, items: Clasificado[], hoy: string): string | null {
  if (items.length === 0) return null;
  const grupos = new Map<string, Clasificado[]>();
  for (const p of items) {
    const k = `${p.tipo}|${p.causa}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  const lineas: string[] = [`── ${titulo} ──`];
  for (const [k, g] of grupos) {
    const tipo = k.split("|")[0] as TipoDePendiente;
    lineas.push(`${TITULO[tipo]} · ${g.length === 1 ? "1 venta" : `${g.length} ventas`}: ${g[0].causa}`);
    for (const p of g.slice(0, 5)) {
      const lleva = p.dias === 0 ? "de hoy" : `lleva ${p.dias} día${p.dias === 1 ? "" : "s"}`;
      const plazo = p.vencido ? `venció el ${formatDate(aMediodia(p.limite))}` : p.limite === hoy ? "vence hoy" : `plazo: ${formatDate(aMediodia(p.limite))}`;
      lineas.push(`  · ${Number(p.monto).toLocaleString("es-CO")} COP, ${p.productos} · ${lleva} · ${plazo}`);
    }
    if (g.length > 5) lineas.push(`  · y ${g.length - 5} más con la misma causa`);
  }
  lineas.push("");
  return lineas.join("\n");
}
