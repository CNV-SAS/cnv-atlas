import { addBusinessDays, businessDaysUntil } from "@/core/dates/colombia-business-days";

// ═══ EL PLAZO PARA RESOLVER UN PAGO EN REVISION (contabilidad, 2026-09-14) ═══
//
// Cinco dias habiles desde que el pago entro en revision, y ANTES DEL CORTE si se acerca el fin del bimestre: si
// se factura, el IVA de esa venta no puede correrse al bimestre siguiente. No es un plazo legal, es operativo.
//
// Modulo NEUTRO y puro: lo usa el panel y lo prueban sus tests con fechas fijas.
//
// LOS DIAS SON CIVILES DE COLOMBIA. Los ayudantes de dias habiles leen el dia de la semana en la zona del
// proceso, que en el servidor es UTC: un pago de las 8 p. m. de Bogota ya es el dia siguiente en UTC. Por eso
// cada fecha se lleva primero a su dia en Bogota, a mediodia.

export const PLAZO_DIAS_HABILES = 5;

function diaEnColombia(fecha: Date): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" })
    .format(fecha)
    .split("-")
    .map(Number);
  return new Date(y, m - 1, d, 12);
}

/** El ultimo dia del bimestre de IVA (ene-feb, mar-abr, ...) al que pertenece la fecha. */
export function cierreDelBimestre(dia: Date): Date {
  const mesDeCierre = dia.getMonth() % 2 === 0 ? dia.getMonth() + 1 : dia.getMonth();
  return new Date(dia.getFullYear(), mesDeCierre + 1, 0, 12);
}

export type PlazoDeRevision = {
  /** El ultimo dia para resolver. */
  limite: Date;
  /** Si el limite lo pone el cierre del bimestre y no los cinco dias habiles. */
  porCierreDeBimestre: boolean;
  diasHabilesRestantes: number;
  estado: "a_tiempo" | "por_vencer" | "vencido";
};

export function plazoDeRevision(abiertaEn: Date, ahora: Date): PlazoDeRevision {
  const inicio = diaEnColombia(abiertaEn);
  const hoy = diaEnColombia(ahora);
  const porDias = addBusinessDays(inicio, PLAZO_DIAS_HABILES);
  const cierre = cierreDelBimestre(inicio);
  const porCierreDeBimestre = cierre < porDias;
  const limite = porCierreDeBimestre ? cierre : porDias;
  const diasHabilesRestantes = businessDaysUntil(hoy, limite);
  const estado = hoy > limite ? "vencido" : diasHabilesRestantes <= 1 ? "por_vencer" : "a_tiempo";
  return { limite, porCierreDeBimestre, diasHabilesRestantes, estado };
}
