"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { limitAiMenuByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { generateMenu } from "./services/generate-menu";
import {
  canAcknowledgeRestrictions,
  canApproveProtocol,
  canEditProtocolDraft,
} from "./policies/can-edit-protocol";
import { canManageTreatment } from "./policies/can-manage-treatment";
import {
  acknowledgeRestrictions,
  addNote,
  approveProtocol,
  saveAdjustments,
  saveProtocol,
} from "./services/treatment-service";
import {
  acknowledgeRestrictionsSchema,
  addNoteSchema,
  approveProtocolSchema,
  saveAdjustmentsSchema,
  saveProtocolSchema,
} from "./validations";

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

// Objeto JSON (firma base del candado de concurrencia): vacio/invalido -> undefined, para que la
// validacion aguas abajo falle (baseSignatures es requerido).
function parseJsonObject(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function intOrNull(raw: FormDataEntryValue | null): number | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s === "" ? null : Number(s);
}

// Vacio -> null (para que Zod no coaccione "" a 0); string -> lo coacciona Zod a numero.
function strOrNull(raw: FormDataEntryValue | null): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s === "" ? null : s;
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
    baseSignatures: parseJsonObject(form.get("baseSignatures")),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos del protocolo inválidos.");
  }

  const result = await saveProtocol(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    // Rechazo por concurrencia: aviso (amber), no error. NO se revalida (el dato no cambio) y el estado del
    // formulario se preserva, asi que el profesional no pierde lo que escribio.
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }

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
    return fail(parsed.error.issues[0]?.message ?? "Nota inválida.");
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

// T2 A2: guarda los ajustes del profesional sobre el sugerido. PROFESIONAL-SOLO (admin no):
// los adj_* son inputs clinicos de la prescripcion (ver can-edit-protocol).
export async function saveAdjustmentsAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canEditProtocolDraft(user)) return fail("No autorizado.");

  const parsed = saveAdjustmentsSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    adjGeb: strOrNull(form.get("adjGeb")),
    adjPal: strOrNull(form.get("adjPal")),
    adjKcalObj: strOrNull(form.get("adjKcalObj")),
    adjProtGkg: strOrNull(form.get("adjProtGkg")),
    adjFatPct: strOrNull(form.get("adjFatPct")),
    adjPesoMeta: strOrNull(form.get("adjPesoMeta")),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Ajustes inválidos.");
  }

  const result = await saveAdjustments(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Ajustes guardados.", warning: null };
}

// T2 A2: reconocimiento de las restricciones del modelo. PROFESIONAL-SOLO (acto clinico).
export async function acknowledgeRestrictionsAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canAcknowledgeRestrictions(user)) return fail("No autorizado.");

  const parsed = acknowledgeRestrictionsSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Evaluación inválida.");
  }

  const result = await acknowledgeRestrictions(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Restricciones reconocidas.", warning: null };
}

// T2 A3: aprueba el protocolo (sella la prescripcion efectiva). PROFESIONAL-SOLO (admin no); la
// asignacion explicita y los gates de estado los verifica el service.
export async function approveProtocolAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canApproveProtocol(user)) return fail("No autorizado.");

  const parsed = approveProtocolSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Evaluación inválida.");
  }

  const result = await approveProtocol(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Protocolo aprobado.", warning: null };
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
  if (!evaluationId) return fail("Evaluación inválida.");

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
