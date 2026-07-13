import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import type { CurrentUser } from "@/modules/auth/roles";

import { createGrantRequest } from "../data/grant-writer";
import { resolvePatientIdByDocument } from "../data/patient-lookup";
import { computeApproverRole } from "../grant-rules";
import type { RequestAccessInput } from "../validations";

// Crea una solicitud de grant (estado pending). Calcula el rol aprobador desde el rol
// REAL del solicitante (no del cliente), asi la matriz de aprobacion no se puede forjar.
// Para el Nivel c resuelve el documento a patient_id dentro de la organizacion del
// solicitante. Emite access.requested inline (lo hace el writer).
export async function requestAccess(
  user: CurrentUser,
  input: RequestAccessInput,
  ip: string | null,
): Promise<Result<{ grantId: string }>> {
  const approverRole = computeApproverRole(user);
  if (!approverRole) {
    return err(appError("forbidden", "Tu rol no puede solicitar acceso a las notas."));
  }

  let resourceId: string | null = null;
  if (input.grantType === "notes_identified") {
    if (!input.documentType || !input.documentNumber) {
      return err(appError("validation", "El acceso identificado requiere el documento del paciente."));
    }
    resourceId = await resolvePatientIdByDocument({
      organizationId: user.organizationId,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
    });
    if (!resourceId) {
      return err(appError("not_found", "No se encontro un paciente con ese documento."));
    }
  }

  const grantId = await createGrantRequest({
    grantType: input.grantType,
    reasonCategory: input.reasonCategory,
    reason: input.reason,
    requesterId: user.id,
    requesterEmail: user.email,
    approverRole,
    resourceId,
    ip,
  });

  return ok({ grantId });
}
