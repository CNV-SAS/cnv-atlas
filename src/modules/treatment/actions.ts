"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { limitAiMenuByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { generateMenu } from "./services/generate-menu";
import { canManageTreatment } from "./policies/can-manage-treatment";
import { addNote, saveProtocol } from "./services/treatment-service";
import { addNoteSchema, saveProtocolSchema } from "./validations";

// Actions del protocolo de tratamiento (B13). Thin (regla 2): autorizan por policy,
// parsean/validan con Zod y delegan en el service. Los arreglos (restricciones,
// nutraceuticos, guias) viajan como JSON en el formulario y se parsean aqui.

export type TreatmentActionState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

const fail = (error: string): TreatmentActionState => ({ error, success: null, warning: null });

function parseJsonArray(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return undefined; // fuerza el fallo de validacion aguas abajo
  }
}

function intOrNull(raw: FormDataEntryValue | null): number | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s === "" ? null : Number(s);
}

async function actor() {
  const ip = await getClientIp();
  return { ip: ip === "unknown" ? null : ip };
}

export async function saveProtocolAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = saveProtocolSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    kcalObjetivo: intOrNull(form.get("kcalObjetivo")),
    proteinaGramos: intOrNull(form.get("proteinaGramos")),
    restricciones: parseJsonArray(form.get("restricciones")),
    nutraceuticals: parseJsonArray(form.get("nutraceuticals")),
    guidelines: parseJsonArray(form.get("guidelines")),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos del protocolo invalidos.");
  }

  const result = await saveProtocol(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Protocolo guardado.", warning: null };
}

export async function addNoteAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = addNoteSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    note: (form.get("note") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Nota invalida.");
  }

  const result = await addNote(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Nota agregada.", warning: null };
}

// Genera el menu por IA desde los objetivos guardados del protocolo (barrera PII en el
// service). Rate limit por usuario: cada generacion es una llamada externa paga.
export async function generateMenuAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluacion invalida.");

  const rl = await limitAiMenuByUser(user.id);
  if (!rl.success) return fail("Has generado demasiados menus. Espera unos minutos.");

  const result = await generateMenu(evaluationId, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath(`/evaluaciones/${evaluationId}`);
  return { error: null, success: "Menu generado. Revisalo antes de usarlo.", warning: null };
}
