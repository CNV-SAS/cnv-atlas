import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import type { CurrentUser } from "@/modules/auth/roles";

import { revokeGrant } from "../data/grant-writer";
import { getGrantById } from "../data/grants-reader";

// El solicitante revoca su propio grant (cancelar una solicitud pendiente o cortar un
// acceso ya aprobado antes de que venza). Solo el dueno lo revoca; un grant ya denegado o
// revocado no se toca. Emite access.revoked inline (lo hace el writer).
export async function revokeAccess(
  user: CurrentUser,
  grantId: string,
  ip: string | null,
): Promise<Result<null>> {
  const grant = await getGrantById(grantId);
  if (!grant) {
    return err(appError("not_found", "La solicitud no existe."));
  }
  if (grant.requesterId !== user.id) {
    return err(appError("forbidden", "Solo el solicitante puede revocar su acceso."));
  }
  if (grant.status !== "pending" && grant.status !== "approved") {
    return err(appError("conflict", "Esta solicitud no se puede revocar."));
  }

  await revokeGrant({ grantId, actorId: user.id, actorEmail: user.email, ip });
  return ok(null);
}
