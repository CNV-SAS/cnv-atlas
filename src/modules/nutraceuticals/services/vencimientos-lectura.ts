import "server-only";

import * as repo from "../data/vencimientos-repository";
import {
  clasificar,
  quienAsumeElVencido,
  textoDelPlazo,
  diaEnColombia,
  type PropuestaDeVencido,
} from "../vencimientos";

// ═══ LO QUE LAS PANTALLAS VEN DE LOS VENCIMIENTOS (0186) ═══
//
// Dos lecturas: la del Integrante (sus lotes, con lo que le puede costar) y la de CNV (todos, con la PROPUESTA
// de quien asume cada vencido). Las dos clasifican con el MISMO modulo puro, para que la pantalla del
// Integrante y la de CNV no puedan decir cosas distintas del mismo lote.

export type LoteAlertado = {
  alertaId: string;
  producto: string;
  codigo: string;
  vence: string;
  unidades: number;
  /** "quedan 12 días" / "venció hace 3 días". */
  plazo: string;
  vencido: boolean;
  vistaEl: string | null;
};

/** Lo que el Integrante ve en Mi inventario. Vacio = no tiene nada por vencer. */
export async function misLotesPorVencer(userId: string, ahora: Date = new Date()): Promise<LoteAlertado[]> {
  const professionalId = await repo.profesionalDelUsuario(userId);
  if (!professionalId) return [];
  const dias = await repo.diasDeAlerta();
  const hoy = diaEnColombia(ahora);
  const abiertas = await repo.alertasAbiertasDelProfesional(professionalId);
  return abiertas.map((a) => {
    const c = clasificar(a.expiresOn, hoy, dias);
    return {
      alertaId: a.id,
      producto: a.producto,
      codigo: a.codigo,
      vence: a.expiresOn,
      // LAS UNIDADES SON LAS DE HOY, no las que habia al alertar: la pantalla dice lo que le queda por
      // vender, no lo que tenia. Las de la alerta se quedan en la fila, que es la prueba.
      unidades: a.unidadesHoy,
      plazo: textoDelPlazo(c),
      vencido: c.estado === "vencido",
      vistaEl: a.vistaEl,
    };
  });
}

export type VencimientoParaCnv = LoteAlertado & {
  professionalId: string | null;
  /** Nombre del Integrante, o null si es la bodega central. */
  quien: string | null;
  /** Solo en los ya vencidos: la propuesta de quien lo asume. */
  propuesta: PropuestaDeVencido | null;
};

/**
 * Lo que CNV ve. En los VENCIDOS trae la propuesta de quien asume; en los que todavia no vencen, no: proponer
 * un cargo sobre algo que el Integrante aun puede vender seria adelantarse a un hecho que no ocurrio.
 */
export async function vencimientosParaCnv(ahora: Date = new Date()): Promise<VencimientoParaCnv[]> {
  const dias = await repo.diasDeAlerta();
  const hoy = diaEnColombia(ahora);
  const abiertas = await repo.alertasAbiertas();
  return abiertas.map((a) => {
    const c = clasificar(a.expiresOn, hoy, dias);
    const vencido = c.estado === "vencido";
    return {
      alertaId: a.id,
      producto: a.producto,
      codigo: a.codigo,
      vence: a.expiresOn,
      unidades: a.unidadesHoy,
      plazo: textoDelPlazo(c),
      vencido,
      vistaEl: a.vistaEl,
      professionalId: a.professionalId,
      quien: a.professionalName,
      // La bodega central no desplaza el vencido a nadie: es de CNV y no hay nada que proponer.
      propuesta:
        vencido && a.professionalId != null
          ? quienAsumeElVencido({
              vence: a.expiresOn,
              alerta: { generadaEl: a.generadaEl, diasDeAnticipacion: a.daysAhead, vistaEl: a.vistaEl },
            })
          : null,
    };
  });
}

/** El Integrante marca que vio la alerta. Devuelve false si no era suya o ya estaba marcada. */
export async function marcarAlertaVista(userId: string, alertaId: string): Promise<boolean> {
  const professionalId = await repo.profesionalDelUsuario(userId);
  if (!professionalId) return false;
  return repo.marcarVista(alertaId, professionalId, userId);
}
