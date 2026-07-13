import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import type { CurrentUser } from "@/modules/auth/roles";

import { decideGrant } from "../data/grant-writer";
import { getGrantById } from "../data/grants-reader";
import { canDecideGrant, resolveExpiryHours } from "../grant-rules";
import type { DecideAccessInput } from "../validations";

// Aprueba o niega una solicitud. Reglas: solo un grant pending se decide; el aprobador no
// puede ser el solicitante (nadie se autoaprueba) y debe tener el rol que el grant
// designo (canDecideGrant); al aprobar, la duracion se acota por el tope duro del nivel
// (resolveExpiryHours). Emite access.approved / access.denied inline (lo hace el writer).
export async function decideAccess(
  user: CurrentUser,
  input: DecideAccessInput,
  ip: string | null,
): Promise<Result<{ decision: "approve" | "deny" }>> {
  const grant = await getGrantById(input.grantId);
  if (!grant) {
    return err(appError("not_found", "La solicitud no existe."));
  }
  if (grant.status !== "pending") {
    return err(appError("conflict", "La solicitud ya fue decidida."));
  }
  if (!canDecideGrant(user, grant)) {
    return err(appError("forbidden", "No puedes decidir esta solicitud."));
  }

  let expiresAt: Date | null = null;
  if (input.decision === "approve") {
    const hours = resolveExpiryHours(grant.grantType, input.durationHours);
    if (!hours.ok) {
      return err(appError("validation", hours.error));
    }
    expiresAt = new Date(Date.now() + hours.value * 60 * 60 * 1000);
  }

  await decideGrant({
    grantId: grant.id,
    decision: input.decision,
    approverId: user.id,
    approverEmail: user.email,
    expiresAt,
    ip,
  });

  return ok({ decision: input.decision });
}
