import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { professionalProfiles } from "@/db/schema";

// Guarda el estado tributario del integrante en su perfil. Drizzle (owner): escritura server-side de un
// solo campo del propio profesional (el professionalId lo resuelve la accion desde la sesion, no el
// cliente). Marca tax_status_completed_at = ahora, que es la fuente de verdad de "completo".

export type TaxStatusInput = {
  personType: "natural" | "juridica";
  hasRut: boolean;
  isIncomeDeclarant: boolean;
  isVatResponsible: boolean;
  idNumber: string;
  mustInvoice: boolean;
};

export async function saveTaxStatus(professionalId: string, input: TaxStatusInput): Promise<void> {
  await db
    .update(professionalProfiles)
    .set({
      taxPersonType: input.personType,
      taxHasRut: input.hasRut,
      taxIsIncomeDeclarant: input.isIncomeDeclarant,
      taxIsVatResponsible: input.isVatResponsible,
      taxIdNumber: input.idNumber,
      taxMustInvoice: input.mustInvoice,
      taxStatusCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(professionalProfiles.id, professionalId));
}
