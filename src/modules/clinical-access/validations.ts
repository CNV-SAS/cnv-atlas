import { z } from "zod";

// Validaciones del flujo de solicitud/aprobacion de grants. El Nivel identificado exige
// el documento del paciente (se resuelve server-side a patient_id; el cliente no manda
// uuids de paciente). El motivo es obligatorio (Clausula 17: acceso con causa).

export const ACCESS_GRANT_TYPES = ["notes_pseudonymous", "notes_identified"] as const;
export const ACCESS_REASON_CATEGORIES = ["auditoria_calidad", "soporte_tecnico"] as const;
export const PATIENT_DOCUMENT_TYPES = ["CC", "CE", "TI", "PA", "NIT"] as const;

export const requestAccessSchema = z
  .object({
    grantType: z.enum(ACCESS_GRANT_TYPES),
    reasonCategory: z.enum(ACCESS_REASON_CATEGORIES),
    reason: z
      .string()
      .trim()
      .min(10, "Explica el motivo del acceso (minimo 10 caracteres).")
      .max(1000, "El motivo es demasiado largo."),
    documentType: z.enum(PATIENT_DOCUMENT_TYPES).optional(),
    documentNumber: z.string().trim().min(3).max(50).optional(),
  })
  .refine(
    (v) => v.grantType !== "notes_identified" || (v.documentType && v.documentNumber),
    {
      message: "El acceso identificado requiere el documento del paciente.",
      path: ["documentNumber"],
    },
  );

export type RequestAccessInput = z.infer<typeof requestAccessSchema>;

export const decideAccessSchema = z
  .object({
    grantId: z.guid(),
    decision: z.enum(["approve", "deny"]),
    // Solo aplica al aprobar; el service la acota por el tope duro del nivel.
    durationHours: z.coerce.number().int().positive().optional(),
  });

export type DecideAccessInput = z.infer<typeof decideAccessSchema>;

export const revokeAccessSchema = z.object({ grantId: z.guid() });
