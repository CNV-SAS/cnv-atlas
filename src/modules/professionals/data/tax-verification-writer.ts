import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import { professionalProfiles } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// CNV verifica el RUT (A2): llena los campos CERTIFICADOS leidos del documento + la fecha del RUT + marca
// quien verifico y cuando. Guard: solo si hay RUT subido y aun no esta verificado (idempotente). Audita
// inline: clasificar a alguien para retencion es un acto con consecuencias (regla 8).

export type VerifyTaxStatusInput = {
  isIncomeDeclarant: boolean;
  isVatResponsible: boolean;
  mustInvoice: boolean;
  documentDate: string; // yyyy-MM-dd, la fecha que trae el propio RUT
};

export async function verifyTaxStatus(
  professionalId: string,
  verifier: { id: string; email: string },
  input: VerifyTaxStatusInput,
): Promise<{ verified: boolean }> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(professionalProfiles)
      .set({
        taxIsIncomeDeclarant: input.isIncomeDeclarant,
        taxIsVatResponsible: input.isVatResponsible,
        taxMustInvoice: input.mustInvoice,
        rutDocumentDate: input.documentDate,
        rutVerifiedBy: verifier.id,
        rutVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(professionalProfiles.id, professionalId),
          isNotNull(professionalProfiles.rutPath),
          isNull(professionalProfiles.rutVerifiedAt),
        ),
      )
      .returning({ id: professionalProfiles.id });
    if (updated.length === 0) return { verified: false };

    await recordAudit(tx, {
      event: "professional.tax_verified",
      actorId: verifier.id,
      actorEmail: verifier.email,
      entityType: "professional_profile",
      entityId: professionalId,
      payload: {
        income_declarant: input.isIncomeDeclarant,
        vat_responsible: input.isVatResponsible,
        must_invoice: input.mustInvoice,
        rut_document_date: input.documentDate,
      },
      ip: null,
    });
    return { verified: true };
  });
}
