import { z } from "zod";

// D-009. Registrar una remision (acto): a quien, por que, cuando. El destino es estructurado (4
// profesiones + "otro" con texto) para poder contar; z.guid() (no z.uuid()) por Zod 4.
export const referralTargetEnum = z.enum([
  "medico",
  "psicologo",
  "deportologo",
  "nutricionista",
  "otro",
]);
export type ReferralTargetValue = z.infer<typeof referralTargetEnum>;

export const createReferralSchema = z
  .object({
    treatmentId: z.guid(),
    referredTo: referralTargetEnum,
    // Solo cuando referredTo === "otro". El refine la exige para ese caso y la ignora para los demas
    // (una remision a una de las cuatro profesiones no lleva texto libre). El CHECK de la BD lo respalda.
    referredToOther: z.string().trim().min(1).max(200).optional(),
    reason: z.string().trim().min(1, "Escribe el motivo de la remisión.").max(2000),
    referredAt: z.string().min(1), // fecha ISO (yyyy-mm-dd) del acto
  })
  .superRefine((val, ctx) => {
    if (val.referredTo === "otro" && !val.referredToOther) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referredToOther"],
        message: "Especifica el destino cuando la remisión es a 'otro'.",
      });
    }
  });
export type CreateReferralInput = z.infer<typeof createReferralSchema>;

// "El paciente volvio": segundo acto. Solo la fecha (+ nota opcional); el trigger de la BD garantiza
// que sea write-once (no se edita una vez puesto).
export const markReturnSchema = z.object({
  referralId: z.guid(),
  returnedAt: z.string().min(1),
  returnNotes: z.string().trim().max(2000).optional(),
});
export type MarkReturnInput = z.infer<typeof markReturnSchema>;

export type ReferralFormState = { error: string | null; success: string | null };

// Tipos de datos de remisiones. Viven AQUI (modulo neutro, sin `server-only`) y NO en el reader,
// porque componentes CLIENTE los importan (register-referral-form usa PendingReferralHint). Un tipo
// que cruza la frontera cliente/servidor no puede vivir en un modulo `server-only`: aunque `import type`
// se borra en compilacion, la arista deja el reader al alcance del boundary de cliente y el bundler de
// produccion puede convertirlo en referencia-cliente, dejando sus funciones (getPendingReferralHints,
// listPatientReferrals) undefined en el server. El reader los RE-EXPORTA para el codigo de servidor.
export type PatientReferral = {
  id: string;
  referredTo: ReferralTargetValue;
  referredToOther: string | null;
  reason: string;
  referredAt: string;
  returnedAt: string | null;
  returnNotes: string | null;
  // De QUE consulta salio la remision (via treatment -> diagnosis -> evaluation).
  sourceEvaluationType: "inicial" | "seguimiento" | null;
  sourceEvaluationDate: string | null;
};

export type PendingReferralHint = {
  referredTo: ReferralTargetValue;
  referredToOther: string | null;
  referredAt: string;
};

// El acto que se registra es HABER remitido (o que el paciente HAYA vuelto): un acto no ocurre en el futuro.
// La fecha puede ser hoy o anterior (registrar despues algo que se hizo antes), nunca posterior a hoy. Se
// valida en el server (fuente de verdad); el input tiene `max` como primer filtro de UX. Comparacion lexica
// de "yyyy-mm-dd", que ordena como fecha. Sin arg, `todayIso` es hoy en base UTC (la misma que usa el default
// del formulario); se acepta el parametro para poder testear determinista.
export function isFutureDate(dateStr: string, todayIso?: string): boolean {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  return dateStr > today;
}
