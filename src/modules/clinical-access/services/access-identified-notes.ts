import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";

import { recordAccessUsed } from "../data/access-log-writer";
import { getActiveGrant } from "../data/grants-reader";
import { getIdentifiedNotes, type IdentifiedNotesView } from "../data/identified-notes-reader";

// Acceso IDENTIFICADO a las notas de un paciente (Nivel c) como una sola operacion de
// servidor auditada. No es RLS relajada: el acceso identificado nunca pasa por las
// policies de notas (que solo abren el Nivel b). El orden importa: primero se exige un
// grant notes_identified activo y con scope a ESE paciente; si existe, se registra el
// uso efectivo (access.used, tercer evento) ANTES de leer, para que ninguna lectura
// identificada quede sin rastro; recien despues se lee la PII. Sin grant no se lee ni se
// audita. El userId viene de requireUser, jamas del cliente.

export type AccessIdentifiedInput = {
  userId: string;
  actorEmail: string;
  patientId: string;
  ip: string | null;
};

export type IdentifiedAccessResult = {
  view: IdentifiedNotesView;
  expiresAt: Date;
};

export async function accessIdentifiedNotes(
  input: AccessIdentifiedInput,
): Promise<Result<IdentifiedAccessResult>> {
  const grant = await getActiveGrant(input.userId, "notes_identified", input.patientId);
  if (!grant) {
    return err(
      appError(
        "forbidden",
        "No tienes un permiso de acceso identificado vigente para este paciente.",
      ),
    );
  }

  await recordAccessUsed({
    grantId: grant.id,
    grantType: "notes_identified",
    actorId: input.userId,
    actorEmail: input.actorEmail,
    resourceId: input.patientId,
    ip: input.ip,
  });

  const view = await getIdentifiedNotes(input.patientId);
  if (!view) {
    return err(appError("not_found", "No se encontro el paciente."));
  }

  return ok({ view, expiresAt: grant.expiresAt });
}
