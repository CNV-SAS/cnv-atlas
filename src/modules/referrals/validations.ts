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
