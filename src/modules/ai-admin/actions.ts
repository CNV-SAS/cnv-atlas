"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";

import { canManageAi } from "./policies/can-manage-ai";
import { saveAiConfig } from "./services/ai-config-service";
import { createPromptVersion } from "./services/ai-prompt-service";
import { saveAiConfigSchema, savePromptSchema } from "./validations";

// Actions del panel de IA (B14). Thin (regla 2): autorizan por policy, validan con Zod y
// delegan en el service.

export type AiAdminActionState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

const fail = (error: string): AiAdminActionState => ({ error, success: null, warning: null });

async function actorIp(): Promise<string | null> {
  const ip = await getClientIp();
  return ip === "unknown" ? null : ip;
}

export async function saveAiConfigAction(
  _prev: AiAdminActionState,
  form: FormData,
): Promise<AiAdminActionState> {
  const user = await requireUser();
  if (!canManageAi(user)) return fail("No autorizado.");

  const parsed = saveAiConfigSchema.safeParse({
    activeProvider: (form.get("activeProvider") as string | null)?.trim() ?? "",
    activeModel: (form.get("activeModel") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Configuracion de IA invalida.");
  }

  const result = await saveAiConfig(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ip: await actorIp(),
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/admin/ia");
  return { error: null, success: "Configuracion de IA guardada.", warning: null };
}

export async function savePromptAction(
  _prev: AiAdminActionState,
  form: FormData,
): Promise<AiAdminActionState> {
  const user = await requireUser();
  if (!canManageAi(user)) return fail("No autorizado.");

  const parsed = savePromptSchema.safeParse({
    promptKey: (form.get("promptKey") as string | null)?.trim() ?? "",
    content: (form.get("content") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Prompt invalido.");
  }

  const result = await createPromptVersion(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ip: await actorIp(),
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/admin/ia");
  if (result.value.unchanged) {
    return { error: null, success: null, warning: "Sin cambios que guardar." };
  }
  return {
    error: null,
    success: `Prompt guardado como version ${result.value.version}.`,
    warning: null,
  };
}
