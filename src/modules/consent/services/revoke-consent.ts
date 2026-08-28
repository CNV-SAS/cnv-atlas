import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/modules/auth/roles";

import { revokeConsents } from "../data/consent-revocation-writer";
import { canRevokeConsent } from "../policies/can-revoke-consent";
import { revokeConsentSchema, type ConsentType } from "../validations";

// Servicio de revocacion: aqui viven los GATES; el writer solo escribe y la action solo resuelve el actor.
//
// DOS MUROS, y el segundo no es redundante:
//   1. La POLICY dice si este rol puede revocar (profesional o admin; ver `can-revoke-consent`).
//   2. LEER AL PACIENTE BAJO RLS dice si ESTE usuario puede tocar a ESTE paciente. El writer va por Drizzle
//      (owner) para dejar el audit inline, y owner NO pasa por RLS: sin este muro, un profesional podria
//      revocar las autorizaciones de un paciente ajeno. Es el mismo patron del writer de identidad.

export type RevokeConsentServiceInput = {
  patientId: string;
  types: string[];
  motivo: string;
  canal: string;
};

export async function revokeConsentForPatient(
  input: RevokeConsentServiceInput,
  actor: { user: CurrentUser; ip: string | null },
): Promise<Result<{ revocados: ConsentType[] }>> {
  if (!canRevokeConsent(actor.user)) {
    return err(appError("forbidden", "No tienes permiso para registrar una revocación."));
  }

  const parsed = revokeConsentSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const campo = issue.path[0];
      if (typeof campo === "string" && !fields[campo]) fields[campo] = issue.message;
    }
    return err(appError("validation", "Revisa los datos de la revocación.", fields));
  }

  // Segundo muro: bajo RLS. Si el paciente no es de este profesional, la consulta no lo devuelve.
  const supabase = await createSupabaseServerClient();
  const { data: paciente, error } = await supabase
    .from("patients")
    .select("id")
    .eq("id", parsed.data.patientId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    return err(appError("internal", "No se pudo verificar el paciente."));
  }
  if (!paciente) {
    return err(appError("not_found", "El paciente no existe o no está asignado a ti."));
  }

  const { revocados } = await revokeConsents({
    patientId: parsed.data.patientId,
    types: parsed.data.types,
    motivo: parsed.data.motivo,
    canal: parsed.data.canal,
    actorId: actor.user.id,
    actorEmail: actor.user.email ?? null,
    ip: actor.ip,
  });

  // NADA QUE REVOCAR NO ES EXITO: si las autorizaciones ya estaban revocadas, decir "queda registrado"
  // le hace creer al profesional que dejo un rastro nuevo que no existe (y ante un reclamo, la fecha que
  // vale sigue siendo la de la primera revocacion).
  if (revocados.length === 0) {
    return err(
      appError("conflict", "Esas autorizaciones ya estaban revocadas. No se registró nada nuevo."),
    );
  }

  return ok({ revocados });
}
