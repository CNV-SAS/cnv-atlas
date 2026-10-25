import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { historicoDelProfesional } from "@/modules/payments/data/historico-del-profesional";

// ═══ LO QUE QUEDA ABIERTO CUANDO SE LE QUITA EL ACCESO A ALGUIEN (Gildardo, 2026-10-25) ═══
//
// DE DONDE SALE. Pidió inactivar a un profesional "sin borrar su cuenta", y con la pregunta que importa
// pegada: *"Resuelve y dime qué pasa con sus pacientes, sus enlaces, sus comisiones, su vitrina y sus
// remesas por confirmar."* La respuesta a todas es la misma: NO SE TOCA NADA DE ESO. Quitar el acceso es
// quitar el acceso, no cerrar una cuenta corriente.
//
// Y POR ESO ESTO EXISTE: si inactivar no mueve nada, lo que queda abierto queda abierto EN SILENCIO. El
// paciente sigue asignado a quien ya no puede abrirlo, la remesa sigue esperando una confirmación que nadie
// va a dar, y el margen sigue debiéndose sin que aparezca en ninguna pantalla. Esto lo pone a la vista ANTES
// de pulsar, y lo deja escrito en el asiento de auditoría DESPUÉS.
//
// UNA SOLA DEFINICIÓN para las dos cosas, y es el punto: el aviso de la pantalla y el rastro salen de la
// misma consulta. Dos copias divergen la primera vez que una cambie, y entonces el asiento afirmaría un
// estado que la pantalla nunca mostró.
//
// SERVICE ROLE (drizzle) A PROPÓSITO: son conteos sobre las filas de OTRA persona, así que la RLS del
// profesional no aplica. Lo que autoriza es la policy del lado del servidor. No devuelve ni un dato de
// paciente: solo cuántos.

export type LoQueQuedaAbierto = {
  /** Pacientes todavía asignados. Siguen siendo suyos: la regla dura 14 es desactivar Y REASIGNAR. */
  pacientesActivos: number;
  /**
   * Los que llegaron DESPUÉS de inactivarlo, por su enlace o su QR. Es la cifra que nadie mira: sus enlaces
   * siguen sirviendo a propósito (un paciente a medio llenar la encuesta no se puede quedar sin camino), así
   * que el consultorio puede seguir produciendo pacientes que él no ve. `null` si está activo.
   */
  llegadosDespues: number | null;
  /** Margen causado y no liquidado. Se le sigue debiendo: el trabajo ya ocurrió. */
  margenPendiente: number;
  /** Unidades reales en su vitrina. Siguen siendo de CNV y están en su custodia. */
  unidadesEnCustodia: number;
  /** Remesas que CNV le declaró y él no ha confirmado. Sin acceso no las puede confirmar nunca. */
  remesasPorConfirmar: number;
  /** Faltantes suyos sin cerrar. */
  faltantesAbiertos: number;
  /** Enlaces y QR de encuesta que siguen sirviendo hoy (sin consumir y sin vencer). */
  enlacesVigentes: number;
};

/**
 * @param professionalId `professional_profiles.id` (el perfil profesional, no el usuario).
 * @param inactivoDesde  cuándo se le quitó el acceso, para contar lo que llegó después. `null` si está activo.
 */
export async function loQueQuedaAbierto(
  professionalId: string,
  inactivoDesde: string | null,
): Promise<LoQueQuedaAbierto> {
  // EL MARGEN PENDIENTE NO SE CALCULA AQUI, se le pregunta al lector que ya lo define. Escribir la suma otra
  // vez seria una SEGUNDA definicion del dinero que se le debe, y la primera arrastra un predicado que no es
  // obvio (`SOLO_DINERO_REAL`: una venta pagada cuyo efectivo nunca llego no es dinero). Dos sumas del mismo
  // dinero divergen la primera vez que ese predicado cambie, y la que se veria aqui es la de un aviso que
  // dice cuanto se le queda debiendo.
  const [fila, historico] = await Promise.all([
    unaFila(professionalId, inactivoDesde),
    historicoDelProfesional(professionalId),
  ]);

  return {
    pacientesActivos: Number(fila?.pacientes_activos ?? 0),
    llegadosDespues: inactivoDesde === null ? null : Number(fila?.llegados_despues ?? 0),
    margenPendiente: historico.comision.pendiente,
    unidadesEnCustodia: Number(fila?.unidades ?? 0),
    remesasPorConfirmar: Number(fila?.remesas_por_confirmar ?? 0),
    faltantesAbiertos: Number(fila?.faltantes_abiertos ?? 0),
    enlacesVigentes: Number(fila?.enlaces_vigentes ?? 0),
  };
}

async function unaFila(professionalId: string, inactivoDesde: string | null) {
  const [fila] = await db.execute<{
    pacientes_activos: number;
    llegados_despues: number;
    unidades: number;
    remesas_por_confirmar: number;
    faltantes_abiertos: number;
    enlaces_vigentes: number;
  }>(sql`
    select
      (select count(*)::int
         from patient_professional_relationships r
         join patients p on p.id = r.patient_id
        where r.professional_id = ${professionalId}::uuid
          and r.status = 'active' and p.deleted_at is null) as pacientes_activos,

      -- LO QUE LLEGO DESPUES. Se cuenta por assigned_at, que es cuando el paciente paso a ser suyo, y no
      -- por la fecha del paciente: un paciente viejo reasignado a el despues de inactivarlo tambien es un
      -- paciente que nadie esta atendiendo.
      (select case when ${inactivoDesde}::timestamptz is null then 0 else count(*)::int end
         from patient_professional_relationships r
         join patients p on p.id = r.patient_id
        where r.professional_id = ${professionalId}::uuid
          and r.status = 'active' and p.deleted_at is null
          and r.assigned_at > ${inactivoDesde}::timestamptz) as llegados_despues,

      -- SU VITRINA: unidades reales, con los productos de prueba incluidos a proposito. Esto no es una cifra
      -- de la organizacion, es "que hay que recoger".
      (select coalesce(sum(m.delta), 0)::int
         from nutraceutical_stock_movements m
        where m.professional_id = ${professionalId}::uuid) as unidades,

      -- REMESAS POR CONFIRMAR: una remesa declarada sin ninguna recepcion que la respalde. Misma definicion
      -- que usa la central para saber que puede despachar.
      (select count(*)::int
         from nutraceutical_stock_movements m
        where m.professional_id = ${professionalId}::uuid
          and m.type = 'remesa'
          and not exists (select 1 from nutraceutical_stock_movements c
                           where c.remesa_id = m.id)) as remesas_por_confirmar,

      (select count(*)::int
         from nutraceutical_faltante_cases f
        where f.professional_id = ${professionalId}::uuid
          and f.status in ('reportado', 'en_revision', 'injustificado_pendiente')) as faltantes_abiertos,

      -- ENLACES QUE SIGUEN SIRVIENDO. El inicial es REUSABLE y nunca se consume (es el QR del consultorio),
      -- asi que cuenta mientras exista; el de seguimiento, mientras no se haya usado ni vencido.
      (select count(*)::int
         from survey_links l
        where l.professional_id = ${professionalId}::uuid
          and l.consumed_at is null
          and (l.expires_at is null or l.expires_at > now())) as enlaces_vigentes`);
  return fila;
}
