"use server";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";

import { canAddDiagnosisNote } from "./policies/can-add-diagnosis-note";
import { generateCriterion } from "./services/generate-criterion";
import {
  generateCriterionSchema,
} from "./validations";

// Action de la nota de criterio del profesional (thin, regla 2): autoriza por policy, valida
// con Zod y delega en el service. El estado sigue el shape generico de useFormToast.
export type DiagnosisActionState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

// AQUI VIVIO TAMBIEN `confirmDiagnosisAction`, retirada el 2026-09-10 con toda su vertical (policy,
// servicio, writer y lector). Confirmar habia dejado de habilitar nada, y ademas no debia: el diagnostico
// es del MODELO. La firma clinica se sella al aprobar el reporte. Ver `confirm-diagnosis-panel.tsx`.
//
// AQUI VIVIA `addDiagnosisNoteAction`, retirada el 2026-09-08 al separar el resumen del criterio.
//
// POR QUE SE BORRA Y NO SE DECLARA "sin pantalla a proposito": era el UNICO writer de `diagnosis_notes`,
// y el profesional ya no escribe criterios en Diagnostico (lo suyo son las Observaciones de Seguimiento).
// Una server action es un endpoint POST: dejarla viva sin boton no la vuelve inofensiva, la vuelve una
// via de escritura que nadie ve. Y guardarla "por si vuelve" es justo el codigo muerto esperando un
// futuro que llevamos dias señalando en el archivo de Gildardo.
//
// LAS FILAS NO SE TOCAN. Las tres de produccion (y las siete de local) siguen ahi y se muestran en la
// cuarta subpestaña, en solo lectura: las escribio y las asumio un profesional. Lo que desaparece es la
// capacidad de escribir MAS, que es lo que la separacion decidio.
//
// Lo encontro `pnpm check:cables`, que para esto existe.

// Genera el BORRADOR de criterio por IA (h). Thin (regla 2): autoriza por la MISMA policy que agregar
// criterio, valida y delega en el service. Devuelve el TEXTO para que el cliente lo ponga en el campo
// editable; no persiste el criterio (eso lo hace el profesional al guardar), pero el service SI deja la
// procedencia de la generacion. En error, mensaje sin bloquear: el profesional escribe a mano.
export type GenerateCriterionState = { error: string | null; text: string | null };

export async function generateCriterionAction(
  _prev: GenerateCriterionState,
  form: FormData,
): Promise<GenerateCriterionState> {
  const user = await requireUser();
  if (!canAddDiagnosisNote(user)) return { error: "No autorizado.", text: null };

  const parsed = generateCriterionSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Evaluación inválida.", text: null };
  }

  const ip = await getClientIp();
  const result = await generateCriterion(parsed.data.evaluationId, {
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return { error: result.error.message, text: null };
  return { error: null, text: result.value.text };
}
