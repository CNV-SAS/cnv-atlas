import "server-only";

import { eq } from "drizzle-orm";

import { db, type DbTransaction } from "@/db";
import { evaluations } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL VISTO BUENO DEL CONTROL DE CALIDAD BIOLOGICO  ·  LECTURA Y ESCRITURA (regla dura 1)
//
// ═══ POR QUE ESTO VIVE APARTE DE LOS HALLAZGOS ═══
//
// Son dos cosas de naturaleza distinta y conviene que no se mezclen:
//
//   · LOS HALLAZGOS son dato clinico derivado de la medicion, se COMPUTAN al leer y nunca se guardan
//     (`qc-biologico-reader`, bajo RLS, porque toca los crudos del paciente).
//   · EL VISTO BUENO es un acto de una persona: quien, cuando, y de QUE se hizo cargo. No lleva ni un dato
//     de paciente, y se registra con su rastro INLINE como cualquier acto clinico (regla dura 8).
//
// Y HAY UNA RAZON MAS, practica: esto va por drizzle, cuyos tipos salen de `db/schema`, asi que no espera a
// que se regeneren los tipos de PostgREST despues de aplicar la migracion 0231. Un lector de PostgREST
// sobre una columna recien migrada no compila hasta que alguien corre `pnpm db:types`.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type VistoBuenoGuardado = {
  /** Cuando se dio, o null si nadie lo ha dado. */
  cuando: string | null;
  /** La huella de los hallazgos que esa persona vio. null si no hay visto bueno. */
  huella: string | null;
};

export async function leerVistoBueno(evaluationId: string): Promise<VistoBuenoGuardado> {
  const [fila] = await db
    .select({
      cuando: evaluations.qcBioVistoAt,
      huella: evaluations.qcBioVistoHallazgos,
    })
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId))
    .limit(1);
  return {
    cuando: fila?.cuando ? new Date(fila.cuando).toISOString() : null,
    huella: fila?.huella ?? null,
  };
}

export type DarVistoBuenoInput = {
  evaluationId: string;
  /** La huella de los hallazgos que la persona esta viendo AHORA. */
  huella: string;
  /** Los textos que vio, para que el rastro diga de que se hizo cargo y no solo un codigo. */
  textos: string[];
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

/**
 * Registra que un profesional revisó los hallazgos y decidió continuar.
 *
 * SE GUARDA LA HUELLA DE LO QUE VIO, no una bandera. Su regla: *"si despues cambia un dato y aparece un
 * hallazgo distinto, se pide de nuevo"*. Comparando huellas eso sale solo; con una bandera de "ya lo vi",
 * subir otro Excel igual de imposible pasaria sin preguntar.
 *
 * EL RASTRO VA INLINE EN LA MISMA TRANSACCION (regla dura 8) y nombra los hallazgos EN TEXTO: dentro de un
 * año, un codigo como `grasa_negativa` no dice que vio esa persona en pantalla, y lo que hay que poder
 * reconstruir es de que se hizo cargo.
 */
export async function darVistoBuenoAlQc(input: DarVistoBuenoInput): Promise<void> {
  await db.transaction(async (tx: DbTransaction) => {
    await tx
      .update(evaluations)
      .set({
        qcBioVistoAt: new Date(),
        qcBioVistoPor: input.actorId,
        qcBioVistoHallazgos: input.huella,
      })
      .where(eq(evaluations.id, input.evaluationId));

    await recordAudit(tx, {
      event: "qc_biologico.visto",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: {
        huella: input.huella,
        hallazgos: input.textos,
        // QUE NO SE TOCO, dicho explicitamente: el visto bueno no cambia la medicion ni el diagnostico.
        // Es una decision de seguir adelante, no una correccion del dato.
        medicion_no_modificada: true,
      },
      ip: input.ip,
    });
  });
}
