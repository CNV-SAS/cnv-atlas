"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";

import { canApproveAccess } from "./policies/can-approve-access";
import { canRequestAccess } from "./policies/can-request-access";
import { decideAccess } from "./services/decide-access";
import { requestAccess } from "./services/request-access";
import { revokeAccess } from "./services/revoke-access";
import { decideAccessSchema, requestAccessSchema, revokeAccessSchema } from "./validations";

// Actions del flujo de grants (regla 2, thin): autorizan por policy, validan con Zod y
// delegan en el service. Los tres eventos de audit (requested/approved-denied/used) los
// escriben los writers/services inline.

export type AccessActionState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

const fail = (error: string): AccessActionState => ({ error, success: null, warning: null });

async function actorIp(): Promise<string | null> {
  const ip = await getClientIp();
  return ip === "unknown" ? null : ip;
}

export async function requestAccessAction(
  _prev: AccessActionState,
  form: FormData,
): Promise<AccessActionState> {
  const user = await requireUser();
  if (!canRequestAccess(user)) return fail("No autorizado.");

  const parsed = requestAccessSchema.safeParse({
    grantType: form.get("grantType"),
    reasonCategory: form.get("reasonCategory"),
    reason: (form.get("reason") as string | null)?.trim() ?? "",
    documentType: (form.get("documentType") as string | null) || undefined,
    documentNumber: (form.get("documentNumber") as string | null)?.trim() || undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Solicitud invalida.");
  }

  const result = await requestAccess(user, parsed.data, await actorIp());
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/auditoria/solicitar");
  return { error: null, success: "Solicitud enviada. Queda pendiente de aprobacion.", warning: null };
}

export async function decideAccessAction(
  _prev: AccessActionState,
  form: FormData,
): Promise<AccessActionState> {
  const user = await requireUser();
  if (!canApproveAccess(user)) return fail("No autorizado.");

  const parsed = decideAccessSchema.safeParse({
    grantId: (form.get("grantId") as string | null)?.trim() ?? "",
    decision: form.get("decision"),
    durationHours: (form.get("durationHours") as string | null) || undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Decision invalida.");
  }

  const result = await decideAccess(user, parsed.data, await actorIp());
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/auditoria/aprobaciones");
  return {
    error: null,
    success: result.value.decision === "approve" ? "Solicitud aprobada." : "Solicitud negada.",
    warning: null,
  };
}

export async function revokeAccessAction(
  _prev: AccessActionState,
  form: FormData,
): Promise<AccessActionState> {
  const user = await requireUser();
  if (!canRequestAccess(user)) return fail("No autorizado.");

  const parsed = revokeAccessSchema.safeParse({
    grantId: (form.get("grantId") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Solicitud invalida.");
  }

  const result = await revokeAccess(user, parsed.data.grantId, await actorIp());
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/auditoria/solicitar");
  return { error: null, success: "Acceso revocado.", warning: null };
}
