import { z } from "zod";

// Valores actuales del estado tributario (para prefill del formulario). Vive AQUI, en el modulo neutro,
// no en el reader (server-only): un componente cliente que importe este tipo desde un modulo server-only
// es un hazard latente (CLAUDE.md). El reader lo re-exporta para el servidor.
export type TaxStatusFields = {
  personType: "natural" | "juridica" | null;
  hasRut: boolean | null;
  isIncomeDeclarant: boolean | null;
  isVatResponsible: boolean | null;
  idNumber: string | null;
  mustInvoice: boolean | null;
};

// Estado tributario del integrante (dictamen contable 2026-08-11). Solo son los datos de ENTRADA; las
// tarifas de retencion NO se calculan aqui (esperan a la contadora).
export const taxStatusSchema = z.object({
  personType: z.enum(["natural", "juridica"]),
  hasRut: z.boolean(),
  isIncomeDeclarant: z.boolean(),
  isVatResponsible: z.boolean(),
  idNumber: z.string().trim().min(3).max(30),
  mustInvoice: z.boolean(),
});
export type TaxStatusInput = z.infer<typeof taxStatusSchema>;

// Estado del formulario del estado tributario (useActionState).
export type TaxStatusFormState = {
  error: string | null;
  success: boolean;
};
