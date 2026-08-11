import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { professionalProfiles } from "@/db/schema";

import type { TaxStatusInput } from "../validations";

// Guarda la PARTE DEL INTEGRANTE del estado tributario (lo que sabe: tipo de persona, documento, cuenta
// bancaria) + el RUT si lo subio. Drizzle (owner): escritura server-side de la propia fila (el
// professionalId lo resuelve la accion desde la sesion). Los campos CERTIFICADOS (declarante, IVA,
// obligado) NO se tocan aqui: los llena CNV al verificar (A2).

export async function saveTaxStatus(
  professionalId: string,
  input: TaxStatusInput,
  rutPath: string | null,
): Promise<void> {
  const base = {
    taxPersonType: input.personType,
    taxHasRut: input.hasRut,
    taxIdType: input.idType,
    taxIdNumber: input.idNumber,
    // El DV solo aplica al NIT (juridica); en natural se limpia por si venia de una edicion anterior.
    taxIdDv: input.personType === "juridica" ? (input.idDv ?? null) : null,
    bankName: input.bankName,
    bankAccountType: input.bankAccountType,
    bankAccountNumber: input.bankAccountNumber,
    bankAccountHolderName: input.bankAccountHolderName,
    bankAccountHolderDocument: input.bankAccountHolderDocument,
    taxStatusCompletedAt: new Date(), // el integrante dio su parte
    updatedAt: new Date(),
  };

  // RUT nuevo: la clasificacion vieja ya no vale (se hizo sobre otro documento). Se limpian los campos
  // certificados y la verificacion para que CNV re-verifique sobre el documento nuevo. Sin RUT nuevo (una
  // edicion de la cuenta, p. ej.) NO se toca la verificacion ya hecha.
  const values =
    rutPath != null
      ? {
          ...base,
          rutPath,
          taxIsIncomeDeclarant: null,
          taxIsVatResponsible: null,
          taxMustInvoice: null,
          rutDocumentDate: null,
          rutVerifiedBy: null,
          rutVerifiedAt: null,
        }
      : base;

  await db.update(professionalProfiles).set(values).where(eq(professionalProfiles.id, professionalId));
}
