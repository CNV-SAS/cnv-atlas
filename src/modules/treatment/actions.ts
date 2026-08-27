"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getClientIp } from "@/core/http/client-ip";
import { limitAiMenuByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";
import { dismissMenuAllergenAlert } from "./data/menu-writer";
import { requireNutricionista } from "./services/require-profession";

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
  saveGuidelines,
  saveNutraceuticals,
  saveObjetivo,
  saveIntercambio,
  saveMenuSemanal,
  saveNutraDecision,
  saveTiempos,
  saveTiemposActivos,
  saveRestricciones,
} from "./services/treatment-service";
import {
  acknowledgeRestrictionsSchema,
  addNoteSchema,
  approveProtocolSchema,
  saveAdjustmentsSchema,
  saveGuidelinesSchema,
  saveNutraceuticalsSchema,
  saveObjetivoSchema,
  saveIntercambioSchema,
  saveMenuSemanalSchema,
  saveNutraDecisionSchema,
  saveTiemposActivosSchema,
  saveTiemposSchema,
  saveRestriccionesSchema,
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

// Vacio -> null (para que Zod no coaccione "" a 0); string -> lo coacciona Zod a numero.
function strOrNull(raw: FormDataEntryValue | null): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s === "" ? null : s;
}

async function actor() {
  const ip = await getClientIp();
  return { ip: ip === "unknown" ? null : ip };
}

// Checkpoint 2.4: restricciones alimentarias, su propia accion (partida de saveProtocolAction, que se
// retiro). Mismo patron que los ajustes/nutraceuticos: candado, firma de remonte, stale_write como aviso.
export async function saveRestriccionesAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = saveRestriccionesSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    restricciones: parseJsonArray(form.get("restricciones")),
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Restricciones inválidas.");
  }

  const result = await saveRestricciones(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  // NO se revalida: la seccion se remonta por su `key` (restriccionesSignature); el refresh lo dispara el
  // hook useFormToastRefreshOnSuccess DESPUES del toast (mismo motivo que en la cadena/nutraceuticos).
  return { error: null, success: "Restricciones guardadas.", warning: null };
}

// Checkpoint 2.4 (pieza 1): objetivo del tratamiento nutricional, su propia accion.
export async function saveObjetivoAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = saveObjetivoSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    objetivo: strOrNull(form.get("objetivo")),
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Objetivo inválido.");
  }

  const result = await saveObjetivo(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  return { error: null, success: "Objetivo del tratamiento guardado.", warning: null };
}

// CP1.2: guarda la lista de intercambio. Primer campo ESTRUCTURADO: llega como JSON en el FormData, se parsea y
// pasa por saveIntercambioSchema (rechaza forma incorrecta). El resto del patron es identico a las demas.
export async function saveIntercambioAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  let intercambio: unknown;
  try {
    intercambio = JSON.parse((form.get("intercambio") as string | null) ?? "");
  } catch {
    return fail("Lista de intercambio inválida.");
  }
  const parsed = saveIntercambioSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    intercambio,
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Lista de intercambio inválida.");
  }

  const result = await saveIntercambio(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  return { error: null, success: "Lista de intercambio guardada.", warning: null };
}

// CP2.2: guarda la distribucion por tiempos. jsonb estructurado (activos + celdas + base) via JSON, validado
// por saveTiemposSchema (rechaza forma incorrecta, exige al menos un tiempo activo).
export async function saveTiemposAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  let tiempos: unknown;
  try {
    tiempos = JSON.parse((form.get("tiempos") as string | null) ?? "");
  } catch {
    return fail("Distribución por tiempos inválida.");
  }
  const parsed = saveTiemposSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    tiempos,
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Distribución por tiempos inválida.");
  }

  const result = await saveTiempos(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  return { error: null, success: "Distribución por tiempos guardada.", warning: null };
}

// CP-N1: la decision sobre los nutraceuticos, su propia accion.
export async function saveNutraDecisionAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = saveNutraDecisionSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    decision: (form.get("decision") as string | null) ?? "",
    reason: (form.get("reason") as string | null) || null,
    note: (form.get("note") as string | null) || null,
    contraindicationFor: (form.get("contraindicationFor") as string | null) || null,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Decisión inválida.");
  }

  const result = await saveNutraDecision(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);
  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Decisión registrada.", warning: null };
}

// CP2.3: tiempos de comida activos, su propia accion.
export async function saveTiemposActivosAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  let activos: unknown;
  try {
    activos = JSON.parse((form.get("activos") as string | null) ?? "");
  } catch {
    return fail("Tiempos de comida inválidos.");
  }
  const parsed = saveTiemposActivosSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    activos,
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Tiempos de comida inválidos.");
  }

  const result = await saveTiemposActivos(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  return { error: null, success: "Tiempos de comida aplicados.", warning: null };
}

// CP4: menu semanal, su propia accion.
export async function saveMenuSemanalAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  let menu: unknown;
  try {
    menu = JSON.parse((form.get("menu") as string | null) ?? "");
  } catch {
    return fail("Menú semanal inválido.");
  }
  const parsed = saveMenuSemanalSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    menu,
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Menú semanal inválido.");
  }

  const result = await saveMenuSemanal(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  return { error: null, success: "Menú semanal guardado.", warning: null };
}

// Checkpoint 2.4: guias dietarias, su propia accion.
export async function saveGuidelinesAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = saveGuidelinesSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    guidelines: parseJsonArray(form.get("guidelines")),
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Guías inválidas.");
  }

  const result = await saveGuidelines(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  return { error: null, success: "Guías guardadas.", warning: null };
}

// Checkpoint 2.3: prescripcion de nutraceuticos, su propia accion (partida de saveProtocolAction). Mismo
// patron que saveAdjustmentsAction: candado, firma de remonte, y stale_write como aviso que preserva la edicion.
export async function saveNutraceuticalsAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = saveNutraceuticalsSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    nutraceuticals: parseJsonArray(form.get("nutraceuticals")),
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Prescripción inválida.");
  }

  const result = await saveNutraceuticals(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }

  // NO se revalida aqui: la seccion se remonta por su `key` (nutraceuticalsSignature) y el refresh lo dispara
  // el hook useFormToastRefreshOnSuccess DESPUES del toast (mismo motivo que en la cadena/el protocolo).
  return { error: null, success: "Prescripción guardada.", warning: null };
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
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Ajustes inválidos.");
  }

  const result = await saveAdjustments(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    // Rechazo por concurrencia: aviso (amber), no error. Igual que saveProtocolAction. NO se revalida (el
    // dato no cambio) y el estado del formulario se preserva, asi que el profesional no pierde lo que escribio.
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }

  // NO se revalida aqui: el form se remonta por su `key` (adjustmentSignature) y el refresh lo dispara el
  // hook useFormToastRefreshOnSuccess DESPUES del toast, para que el aviso de exito no se pierda en la carrera.
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

// Motivo del descarte del aviso de alergeno: obligatorio y corto, como el del reenvio de un reporte.
// Obligatorio porque alguien esta decidiendo que un menu con un alergeno detectado se puede usar, y esa
// decision tiene dueno. Corto porque no es una nota clinica, es una razon ("la coincidencia es del
// nombre, el plato no lleva leche"). Tope de tamano como toda entrada externa.
const dismissAllergenReasonSchema = z
  .string()
  .trim()
  .min(10, "Explica por qué el alérgeno detectado no aplica.")
  .max(300, "El motivo es demasiado largo.");

export async function dismissMenuAllergenAlertAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const suggestionId = (form.get("suggestionId") as string | null)?.trim() ?? "";
  const parsedId = z.guid().safeParse(suggestionId);
  if (!parsedId.success) return fail("Sugerencia inválida.");

  const parsedReason = dismissAllergenReasonSchema.safeParse(form.get("reason") ?? "");
  if (!parsedReason.success) {
    return fail(parsedReason.error.issues[0]?.message ?? "Motivo inválido.");
  }

  // Solo el nutricionista: es una decision de ambito nutricional, la misma guarda que generar el menu.
  const prof = await requireNutricionista(user.id);
  if (!prof.ok) return fail(prof.error.message);

  await dismissMenuAllergenAlert({
    suggestionId: parsedId.data,
    reason: parsedReason.data,
    actorId: user.id,
    actorEmail: user.email,
    ip: await getClientIp(),
  });
  // NO se revalida aqui, igual que sus vecinas del panel: la accion no revalida y el refresco lo dispara
  // el hook DESPUES del toast (si revalidara, el remonte correria contra el efecto y el toast se perderia).
  return { error: null, success: "Aviso de alérgeno descartado. Queda registrado.", warning: null };
}
