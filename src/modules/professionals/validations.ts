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

// ═══ DOS ENVIOS, NO UNO (2026-09-25) ═══
//
// Eran un solo schema y un solo formulario porque nacieron juntos, y al pasar el perfil a pestañas hay que
// partirlos: lo tributario y lo bancario son asuntos distintos y quien viene a cambiar su banco no tiene por
// que atravesar su clasificacion tributaria.
//
// PERO EL CORTE NO ES LIMPIO, Y ESO ES LO QUE HAY QUE CUIDAR. Dos cosas ataban las mitades:
//
//   1 · EL TITULAR DE LA CUENTA SE VALIDA CONTRA EL DOCUMENTO DEL INTEGRANTE. Con un solo envio los dos
//       numeros venian en el mismo FormData. Partido, el envio bancario NO trae el documento tributario, asi
//       que tiene que LEERLO de la fila; y si todavia no existe, no hay contra que validar y se dice que
//       primero va la pestaña tributaria. El orden no es capricho: sin saber quien es el integrante, la
//       comprobacion de "el titular eres tu" no se puede hacer.
//   2 · `tax_status_completed_at` (el gate que deja LIQUIDAR la comision) lo ponia ese envio unico. Partido,
//       guardar solo lo tributario dejaria el perfil "completo" sin cuenta bancaria, y la liquidacion
//       dejaria pasar un giro que no tiene a donde ir. La marca se calcula desde la fila, exigiendo LAS DOS
//       mitades (ver `marcarCompletoSiLasDosMitades` en el escritor).

/** Lo tributario que el integrante SABE (sin el archivo del RUT, que va aparte en el FormData). */
export const taxIdentitySchema = z.object({
  personType: z.enum(["natural", "juridica"]),
  hasRut: z.boolean(),
  idType: z.enum(["CC", "CE", "TI", "PA", "NIT"]),
  idNumber: z.string().trim().min(3).max(30),
  idDv: z.string().trim().max(2).nullish().transform((v) => v ?? null),
});
export type TaxIdentityInput = z.infer<typeof taxIdentitySchema>;

/** La cuenta a donde se gira el margen. */
export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(80),
  bankAccountType: z.enum(["ahorros", "corriente"]),
  bankAccountNumber: z.string().trim().min(4).max(40),
  bankAccountHolderName: z.string().trim().min(2).max(120),
  bankAccountHolderDocument: z.string().trim().min(3).max(30),
});
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

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
