import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { professionalProfiles } from "@/db/schema";

import type { BankAccountInput, TaxIdentityInput } from "../validations";

// Guarda la PARTE DEL INTEGRANTE del estado tributario (lo que sabe: tipo de persona, documento, cuenta
// bancaria) + el RUT si lo subio. Drizzle (owner): escritura server-side de la propia fila (el
// professionalId lo resuelve la accion desde la sesion). Los campos CERTIFICADOS (declarante, IVA,
// obligado) NO se tocan aqui: los llena CNV al verificar (A2).
//
// ── SON DOS ESCRITORES DESDE QUE EL PERFIL TIENE PESTAÑAS (2026-09-25) ──
//
// Y LA MARCA DE "COMPLETO" NO LA PONE NINGUNO DE LOS DOS: la calcula `marcarCompletoSiLasDosMitades` leyendo
// la fila. Es la parte que habia que cuidar al partir el formulario, porque esa marca es el gate que deja
// LIQUIDAR la comision: si el envio tributario la pusiera por su cuenta, un integrante quedaria "completo"
// sin cuenta bancaria y la liquidacion dejaria pasar un giro sin destino.

/** Lo tributario que el integrante declara. `rutPath` no nulo = subio uno NUEVO. */
export async function saveTaxIdentity(
  professionalId: string,
  input: TaxIdentityInput,
  rutPath: string | null,
): Promise<void> {
  const base = {
    taxPersonType: input.personType,
    taxHasRut: input.hasRut,
    taxIdType: input.idType,
    taxIdNumber: input.idNumber,
    // El DV solo aplica al NIT (juridica); en natural se limpia por si venia de una edicion anterior.
    taxIdDv: input.personType === "juridica" ? (input.idDv ?? null) : null,
    updatedAt: new Date(),
  };

  // RUT nuevo: la clasificacion vieja ya no vale (se hizo sobre otro documento). Se limpian los campos
  // certificados y la verificacion para que CNV re-verifique sobre el documento nuevo. Sin RUT nuevo (una
  // edicion del documento, p. ej.) NO se toca la verificacion ya hecha.
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
          // Un RUT nuevo supera un rechazo anterior: se limpia para que vuelva a la cola de verificacion.
          rutRejectedReason: null,
          rutRejectedBy: null,
          rutRejectedAt: null,
        }
      : base;

  await db.update(professionalProfiles).set(values).where(eq(professionalProfiles.id, professionalId));
  await marcarCompletoSiLasDosMitades(professionalId);
}

/** La cuenta a donde se gira el margen. */
export async function saveBankAccount(professionalId: string, input: BankAccountInput): Promise<void> {
  await db
    .update(professionalProfiles)
    .set({
      bankName: input.bankName,
      bankAccountType: input.bankAccountType,
      bankAccountNumber: input.bankAccountNumber,
      bankAccountHolderName: input.bankAccountHolderName,
      bankAccountHolderDocument: input.bankAccountHolderDocument,
      updatedAt: new Date(),
    })
    .where(eq(professionalProfiles.id, professionalId));
  await marcarCompletoSiLasDosMitades(professionalId);
}

/**
 * EL DOCUMENTO TRIBUTARIO YA GUARDADO, para validar contra el el titular de la cuenta.
 *
 * Existe por el corte del formulario: el envio bancario no trae ese numero, asi que hay que leerlo. Null =
 * el integrante no ha completado la pestaña tributaria, y entonces no hay contra que validar.
 */
export async function documentoTributarioGuardado(professionalId: string): Promise<string | null> {
  const fila = await db.query.professionalProfiles.findFirst({
    where: eq(professionalProfiles.id, professionalId),
    columns: { taxIdNumber: true },
  });
  return fila?.taxIdNumber ?? null;
}

/**
 * "El integrante dio su parte" = LAS DOS MITADES. Se calcula desde la fila y no desde el envio, porque cada
 * mitad se guarda por su lado y ninguna de las dos sabe si la otra ya esta.
 *
 * NO LA LIMPIA NUNCA, solo la pone: los dos schemas exigen todos sus campos, asi que una mitad guardada no
 * puede volver a estar incompleta. Y quitar la marca reabriria una comision ya habilitada.
 */
async function marcarCompletoSiLasDosMitades(professionalId: string): Promise<void> {
  const fila = await db.query.professionalProfiles.findFirst({
    where: eq(professionalProfiles.id, professionalId),
    columns: {
      taxPersonType: true,
      taxIdNumber: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolderDocument: true,
      taxStatusCompletedAt: true,
    },
  });
  if (!fila || fila.taxStatusCompletedAt != null) return;
  const tributaria = fila.taxPersonType != null && fila.taxIdNumber != null;
  const bancaria =
    fila.bankName != null && fila.bankAccountNumber != null && fila.bankAccountHolderDocument != null;
  if (!tributaria || !bancaria) return;
  await db
    .update(professionalProfiles)
    .set({ taxStatusCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(professionalProfiles.id, professionalId));
}
