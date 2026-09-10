import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { patients } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// ARCHIVAR Y DESARCHIVAR UN PACIENTE (Santiago, 2026-09-10).
//
// ── LO QUE HACE, Y SOBRE TODO LO QUE NO ────────────────────────────────────────────────────────────
//
// Mueve `patients.status` entre `active` e `inactive`. NO borra nada, no toca evaluaciones, no toca
// consentimientos y no revoca autorizaciones: el paciente queda completo y su historia entera sigue ahi.
// Es una decision de ORGANIZACION de la lista, no un acto clinico sobre la persona.
//
// Y ES REVERSIBLE A PROPOSITO. Una accion de un clic que no se puede deshacer es la que se pulsa por error
// y no tiene arreglo; con `desarchivar` al lado, archivar deja de dar miedo y por eso se usa.
//
// ── POR QUE LLEVA AUDITORIA SI NO ES CLINICO ───────────────────────────────────────────────────────
//
// Porque cambia QUIEN APARECE en la lista de trabajo, y eso se convierte en clinico por omision: un
// paciente archivado por error deja de verse, y lo que deja de verse deja de atenderse. El evento dice
// quien lo saco y cuando, que es lo unico que permite deshacer un error del que nadie se acuerda.
//
// VA INLINE EN LA TRANSACCION (regla dura 8), nunca por el bus: si la escritura se revierte, el evento
// tambien. Si no, quedaria registrado un archivado que no ocurrio.

export type CambioDeArchivo = { patientId: string; archivar: boolean };

export type ActorDelCambio = {
  actorId: string;
  actorEmail: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Archiva o desarchiva un paciente. Devuelve `false` si la fila no existe o la RLS no la alcanza (que
 * para quien llama es lo mismo: no es suyo).
 */
export async function setPatientArchivado(
  { patientId, archivar }: CambioDeArchivo,
  actor: ActorDelCambio,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const filas = await tx
      .update(patients)
      .set({ status: archivar ? "inactive" : "active" })
      .where(eq(patients.id, patientId))
      .returning({ id: patients.id });
    if (filas.length === 0) return false;

    await recordAudit(tx, {
      // DOS EVENTOS Y NO UNO CON UNA BANDERA: al leer el historial, "patient.archived" se entiende sin
      // abrir el payload, y un `{archivado: false}` dentro de un evento llamado "archivado" es justo la
      // clase de registro que se lee al reves con prisa.
      event: archivar ? "patient.archived" : "patient.unarchived",
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      entityType: "patient",
      entityId: patientId,
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    return true;
  });
}
