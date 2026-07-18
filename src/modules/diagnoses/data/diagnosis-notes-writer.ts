import "server-only";

import { db } from "@/db";
import { diagnosisNotes } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Escritura de una nota de criterio del profesional (append-only) con audit INLINE (regla 8):
// la nota y su evento van en la misma transaccion. Owner db (BYPASSRLS) porque el audit se
// escribe inline; el ownership se verifico ANTES en el service leyendo el diagnostico por RLS,
// asi que el diagnosisId ya llega autorizado. Las notas no se editan ni borran (la tabla no
// tiene policy de UPDATE/DELETE): el criterio se agrega, no se reescribe (disciplina de audit).

export type AddDiagnosisNoteWrite = {
  diagnosisId: string;
  note: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function addDiagnosisNote(input: AddDiagnosisNoteWrite): Promise<void> {
  await db.transaction(async (tx) => {
    const [note] = await tx
      .insert(diagnosisNotes)
      .values({ diagnosisId: input.diagnosisId, note: input.note })
      .returning({ id: diagnosisNotes.id });
    await recordAudit(tx, {
      event: "diagnosis.note_added",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "diagnosis",
      entityId: input.diagnosisId,
      payload: { note_id: note.id },
      ip: input.ip,
    });
  });
}
