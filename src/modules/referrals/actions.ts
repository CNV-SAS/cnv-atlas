"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getClientIp } from "@/core/http/client-ip";
import { reportServerError } from "@/lib/observability/report-error";
import { getCurrentUser } from "@/modules/auth/session";

import { getReferralOwnership, getTreatmentPatient } from "./data/referrals-reader";
import { writeCreateReferral, writeMarkReturn } from "./data/referrals-writer";
import { canRegisterReferral } from "./policies/can-register-referral";
import { createReferralSchema, markReturnSchema, type ReferralFormState } from "./validations";

function optStr(formData: FormData, k: string): string | undefined {
  const v = String(formData.get(k) ?? "").trim();
  return v === "" ? undefined : v;
}

async function auditContext() {
  const h = await headers();
  return { ip: await getClientIp(), userAgent: h.get("user-agent") };
}

// Registrar una remision (D-009). Anclada a un tratamiento; el destino puede venir prellenado de una ruta,
// pero la remision NO exige que exista una ruta que la respalde (el profesional remite por su criterio).
export async function createReferralFormAction(
  _prev: ReferralFormState,
  formData: FormData,
): Promise<ReferralFormState> {
  const user = await getCurrentUser();
  if (!user || !canRegisterReferral(user)) {
    return { error: "No tienes permiso para registrar remisiones.", success: null };
  }
  const parsed = createReferralSchema.safeParse({
    treatmentId: String(formData.get("treatmentId") ?? ""),
    referredTo: String(formData.get("referredTo") ?? ""),
    referredToOther: optStr(formData, "referredToOther"),
    reason: String(formData.get("reason") ?? ""),
    referredAt: String(formData.get("referredAt") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos de la remisión inválidos.", success: null };
  }

  // Pertenencia: el reader RLS resuelve el paciente del tratamiento; null = no es su paciente (o no existe).
  const ctx = await getTreatmentPatient(parsed.data.treatmentId);
  if (!ctx) {
    return { error: "No puedes registrar una remisión sobre este tratamiento.", success: null };
  }

  try {
    const { ip, userAgent } = await auditContext();
    await writeCreateReferral({
      treatmentId: parsed.data.treatmentId,
      patientId: ctx.patientId,
      organizationId: user.organizationId,
      referredTo: parsed.data.referredTo,
      referredToOther: parsed.data.referredToOther ?? null,
      reason: parsed.data.reason,
      referredAt: parsed.data.referredAt,
      actorId: user.id,
      actorEmail: user.email,
      ip,
      userAgent,
    });
  } catch (e) {
    reportServerError("referral.create", e);
    return { error: "No se pudo registrar la remisión.", success: null };
  }

  revalidatePath(`/pacientes/${ctx.patientId}`);
  return { error: null, success: "Remisión registrada." };
}

// "El paciente volvio": segundo acto. Lo puede marcar CUALQUIER profesional asignado al paciente ahora (no
// solo el que registro la remision): la RLS de referrals gatea "profesional del paciente", sin exigir el
// creador. Write-once: si ya se registro, se avisa (y el trigger lo bloquea de todos modos).
export async function markReturnFormAction(
  _prev: ReferralFormState,
  formData: FormData,
): Promise<ReferralFormState> {
  const user = await getCurrentUser();
  if (!user || !canRegisterReferral(user)) {
    return { error: "No tienes permiso para marcar el retorno.", success: null };
  }
  const parsed = markReturnSchema.safeParse({
    referralId: String(formData.get("referralId") ?? ""),
    returnedAt: String(formData.get("returnedAt") ?? ""),
    returnNotes: optStr(formData, "returnNotes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos del retorno inválidos.", success: null };
  }

  const own = await getReferralOwnership(parsed.data.referralId);
  if (!own) return { error: "No puedes marcar el retorno de esta remisión.", success: null };
  if (own.alreadyReturned) return { error: "El retorno de esta remisión ya se registró.", success: null };

  try {
    const { ip, userAgent } = await auditContext();
    await writeMarkReturn({
      referralId: parsed.data.referralId,
      returnedAt: parsed.data.returnedAt,
      returnNotes: parsed.data.returnNotes ?? null,
      actorId: user.id,
      actorEmail: user.email,
      ip,
      userAgent,
    });
  } catch (e) {
    reportServerError("referral.markReturn", e);
    return { error: "No se pudo registrar el retorno.", success: null };
  }

  const patientId = optStr(formData, "patientId");
  if (patientId) revalidatePath(`/pacientes/${patientId}`);
  return { error: null, success: "Retorno registrado." };
}
