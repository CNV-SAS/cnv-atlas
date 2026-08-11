import { z } from "zod";

// Valores actuales del estado tributario, para prefill del formulario. Vive AQUI (modulo neutro), no en
// el reader (server-only): un componente cliente que importe este tipo de un modulo server-only es un
// hazard latente (CLAUDE.md). El reader lo re-exporta para el servidor.
//
// A2 (revision contable): el integrante YA NO responde los campos certificados (declarante, responsable de
// IVA, obligado a facturar); esos los llena CNV al verificar el RUT. Su formulario es solo lo que sabe.
export type TaxStatusFields = {
  personType: "natural" | "juridica" | null;
  hasRut: boolean | null;
  idType: "CC" | "CE" | "TI" | "PA" | "NIT" | null; // natural: CC/CE; juridica: NIT
  idNumber: string | null;
  idDv: string | null; // digito de verificacion (cuando es NIT)
  rutUploaded: boolean; // ya subio un RUT (rut_path presente): no lo obliga a re-subir al editar
  bankName: string | null;
  bankAccountType: "ahorros" | "corriente" | null;
  bankAccountNumber: string | null;
  bankAccountHolderName: string | null;
  bankAccountHolderDocument: string | null;
};

// Lo que el integrante envia (sin el archivo del RUT, que va aparte en el FormData; sin los certificados).
export const taxStatusSchema = z.object({
  personType: z.enum(["natural", "juridica"]),
  hasRut: z.boolean(),
  idType: z.enum(["CC", "CE", "TI", "PA", "NIT"]),
  idNumber: z.string().trim().min(3).max(30),
  idDv: z.string().trim().max(2).nullish().transform((v) => v ?? null),
  bankName: z.string().trim().min(2).max(80),
  bankAccountType: z.enum(["ahorros", "corriente"]),
  bankAccountNumber: z.string().trim().min(4).max(40),
  bankAccountHolderName: z.string().trim().min(2).max(120),
  bankAccountHolderDocument: z.string().trim().min(3).max(30),
});
export type TaxStatusInput = z.infer<typeof taxStatusSchema>;

// Estado del formulario del estado tributario (useActionState).
export type TaxStatusFormState = {
  error: string | null;
  success: boolean;
};

// Una verificacion pendiente (RUT subido, sin verificar), para la superficie de CNV. Vive AQUI (neutro),
// no en el reader (server-only): el componente cliente lo importa (hazard latente si viniera del reader).
export type PendingTaxVerification = {
  professionalId: string;
  fullName: string;
  personType: "natural" | "juridica" | null;
  idType: string | null;
  idNumber: string | null;
  idDv: string | null;
  submittedAt: string; // tax_status_completed_at
};

// Verificacion del RUT por CNV (A2): los campos certificados leidos del documento + su fecha.
export const taxVerifySchema = z.object({
  professionalId: z.guid(),
  isIncomeDeclarant: z.boolean(),
  isVatResponsible: z.boolean(),
  mustInvoice: z.boolean(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});
export type TaxVerificationFormState = {
  error: string | null;
  success: boolean;
};

// Rechazo del RUT por CNV: motivo OBLIGATORIO (el integrante lo ve para saber que corregir).
export const taxRejectSchema = z.object({
  professionalId: z.guid(),
  reason: z.string().trim().min(5).max(500),
});
