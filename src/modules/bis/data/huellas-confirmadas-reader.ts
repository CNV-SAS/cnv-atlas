import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { clinicalAuditLog } from "@/db/schema";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS MEDICIONES QUE SE IMPORTARON SOBRE OTRA HISTORIA, CONFIRMADAS  ·  2026-11-05
//
// ═══ POR QUE EXISTE ═══
//
// El freno de la huella dejo de bloquear (Santiago, 2026-11-05): con un paciente real se avisa, se pide
// confirmacion con motivo y se deja seguir. La mitad que hace aceptable ese cambio es que **la
// administracion se entere sin que nadie se lo cuente**: un freno que se abre con confirmacion y sin aviso
// es un freno que no existe.
//
// Y ES LA LECCION DE LA "pieza terminada sin el ultimo cable": si el acto se registra y ninguna pantalla lo
// lee, el registro no avisa a nadie. Por eso esta lectura nace el mismo dia que el acto.
//
// ═══ SE LEE DEL RASTRO CLINICO, SIN TABLA NUEVA ═══
//
// El acto ya queda en `clinical_audit_log` con su propio evento (`bis.huella_repetida_confirmada`),
// escrito INLINE en la transaccion del import (regla dura 8). Una tabla aparte seria un segundo registro
// del mismo hecho, capaz de divergir del rastro.
//
// ═══ QUE NO SALE DE AQUI ═══
//
// NI UN NOMBRE DE PACIENTE. El payload del rastro no los lleva (ids, fechas y el motivo), y esta lectura
// no los va a buscar. Quien administra puede abrir las dos consultas con sus enlaces, donde la RLS y la
// pantalla ya deciden que puede ver; el aviso no es el sitio para repartir PII.
//
// SI SALE EL CORREO DE QUIEN IMPORTO, que es el dato del acto: sin el, "alguien confirmo" no se puede
// revisar con nadie.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export const EVENTO_HUELLA_CONFIRMADA = "bis.huella_repetida_confirmada";

export type HuellaConfirmada = {
  id: string;
  cuando: string;
  /** Quien importo. Es el dato del acto; no es PII de paciente. */
  quien: string;
  evaluationId: string;
  otraEvaluacionId: string | null;
  otraFecha: string | null;
  delMismoPaciente: boolean;
  /** `true` cuando la otra consulta era de un paciente de prueba: entonces no se pidio motivo. */
  otroEsDePrueba: boolean;
  /** Texto libre de quien importo. Puede venir vacio solo en el caso de prueba. */
  motivo: string | null;
};

/**
 * Las confirmaciones, de la mas reciente a la mas vieja.
 *
 * SE LEE COMO DUEÑO (Drizzle) y la autorizacion la pone la pantalla (`/admin`, regla dura 3), igual que
 * las otras bandejas de esa pagina: el rastro clinico no es una superficie de RLS.
 *
 * SOLO LAS QUE PIDIERON CONFIRMACION (o sea, las de un paciente REAL): las de prueba se registran para que
 * el rastro este completo, pero no son un aviso para nadie, y meterlas en la bandeja la llenaria de los
 * smokes del propio equipo hasta volverla ilegible.
 */
export async function leerHuellasConfirmadas(limite = 50): Promise<HuellaConfirmada[]> {
  const filas = await db
    .select({
      id: clinicalAuditLog.id,
      createdAt: clinicalAuditLog.createdAt,
      actorEmail: clinicalAuditLog.actorEmail,
      payload: clinicalAuditLog.payload,
    })
    .from(clinicalAuditLog)
    .where(
      and(
        eq(clinicalAuditLog.event, EVENTO_HUELLA_CONFIRMADA),
        sql`coalesce((${clinicalAuditLog.payload} ->> 'confirmacion_requerida')::boolean, true)`,
      ),
    )
    .orderBy(desc(clinicalAuditLog.createdAt))
    .limit(limite);

  return filas.map((f) => {
    const p = (f.payload ?? {}) as Record<string, unknown>;
    return {
      id: f.id,
      cuando: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
      quien: f.actorEmail ?? "",
      evaluationId: String(p.evaluation_id ?? ""),
      otraEvaluacionId: p.otra_evaluacion_id ? String(p.otra_evaluacion_id) : null,
      otraFecha: p.otra_fecha ? String(p.otra_fecha) : null,
      delMismoPaciente: p.del_mismo_paciente === true,
      otroEsDePrueba: p.otro_paciente_es_de_prueba === true,
      motivo: p.motivo ? String(p.motivo) : null,
    };
  });
}
