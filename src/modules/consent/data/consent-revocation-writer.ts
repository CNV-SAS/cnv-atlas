import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { patientConsents } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import type { ConsentType } from "../validations";

// REVOCACION DE AUTORIZACIONES DEL PACIENTE (`CONSENT_ATLAS.md` seccion 10, `DATA_GOVERNANCE.md` (c)).
//
// POR QUE EXISTE ESTE ARCHIVO. `revoked_at` ya se escribia, pero SOLO PARA REEMPLAZAR: el re-consentimiento
// (`intake-writer`) revoca la autorizacion vigente del mismo tipo y en la misma transaccion inserta la
// nueva. No habia ningun camino donde se revocara SIN reemplazar, que es justo lo que el documento firmado
// promete. Hasta hoy, la unica forma de ejercer ese derecho era un UPDATE a mano en la base: sin actor, sin
// motivo y sin traza, en un sistema donde la regla dura 8 la exige para todo evento clinico critico.
//
// DRIZZLE (owner) Y NO EL CLIENTE CON RLS, por la razon de siempre: para dejar el audit INLINE en la misma
// transaccion (regla dura 8). La autorizacion se resuelve antes, en el servicio (policy + que el paciente
// sea del profesional); aqui solo se escribe.
//
// LO QUE NO HACE, Y ES DELIBERADO:
//   - NO borra ni toca la historia clinica. La revocacion opera HACIA ADELANTE: bloquea evaluaciones
//     nuevas (regla dura 15, via `canCreateEvaluation`) y no reescribe la base legal de lo ya capturado.
//     Eso ya esta garantizado aparte: `evaluations.consent_version` sella con que version se capturo cada
//     evaluacion ("un puntero, no una copia", dictamen legal 2026-08-20 seccion 4). La obligacion de
//     conservar 15 años manda sobre la revocacion.
//   - NO ofrece des-revocar. Volver a autorizar es FIRMAR de nuevo (el intake por excepcion, que ya
//     existe); un boton de "deshacer" borraria que el paciente ejercio un derecho.

export type RevokeConsentWrite = {
  patientId: string;
  types: readonly ConsentType[];
  motivo: string;
  canal: "profesional" | "proteccion_datos";
  actorId: string;
  actorEmail: string | null;
  ip: string | null;
};

export type RevokeConsentResult = {
  /** Los que de verdad se revocaron. Puede ser MENOS que los pedidos: ver abajo. */
  revocados: ConsentType[];
};

export async function revokeConsents(input: RevokeConsentWrite): Promise<RevokeConsentResult> {
  return db.transaction(async (tx) => {
    // `revoked_at IS NULL` en el WHERE hace la operacion idempotente: revocar dos veces lo mismo no
    // reescribe la marca de tiempo de la primera (que es la que vale ante un reclamo) ni audita de nuevo.
    const filas = await tx
      .update(patientConsents)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(patientConsents.patientId, input.patientId),
          isNull(patientConsents.revokedAt),
          inArray(patientConsents.consentType, [...input.types]),
        ),
      )
      .returning({ tipo: patientConsents.consentType });

    const revocados = filas.map((f) => f.tipo as ConsentType);

    // EL RESULTADO SE DEVUELVE, no se asume. Quien avisa en pantalla tiene que decir QUE se revoco, no
    // que se intento: si el paciente ya habia revocado 'servicio', decirle al profesional "queda
    // registrado" sobre algo que no se escribio le hace creer que dejo un rastro que no existe.
    if (revocados.length === 0) return { revocados };

    await recordAudit(tx, {
      event: "consent.revoked",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "patient",
      entityId: input.patientId,
      // El MOTIVO vive aqui y no en una columna: es un hecho sobre el acto, y este registro es inmutable.
      payload: { types: revocados, motivo: input.motivo, canal: input.canal },
      ip: input.ip,
    });

    return { revocados };
  });
}
