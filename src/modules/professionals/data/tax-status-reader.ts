import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { TaxStatusFields } from "../validations";

// Estado tributario del integrante + su comision ACUMULADA pendiente, para el banner de retencion. Bajo
// RLS (cliente anon): el integrante lee su propio perfil y su propia comision (professional_revenue). El
// professionalId lo resuelve la accion desde la sesion, no se confia en el cliente.
// TaxStatusFields vive en validations (modulo neutro); se re-exporta para el servidor.
export type { TaxStatusFields } from "../validations";

export type TaxStatusView = {
  complete: boolean; // tax_status_completed_at != null; robusto a que un booleano sea false legitimamente
  fields: TaxStatusFields;
  // Comision acumulada SIN liquidar. Hoy no existe la liquidacion, asi que es la suma de TODA su comision:
  // es el monto que "espera sus datos". Cuando exista la liquidacion, se acotara a lo no liquidado.
  pendingCommission: number;
};

export async function getTaxStatusView(professionalId: string): Promise<TaxStatusView> {
  const supabase = await createSupabaseServerClient();
  const { data: prof, error } = await supabase
    .from("professional_profiles")
    .select(
      "tax_person_type, tax_has_rut, tax_is_income_declarant, tax_is_vat_responsible, tax_id_number, tax_must_invoice, tax_status_completed_at",
    )
    .eq("id", professionalId)
    .maybeSingle();
  if (error) throw new Error(`tax-status-reader: getTaxStatusView: ${error.message}`);

  const { data: rev, error: rErr } = await supabase
    .from("professional_revenue")
    .select("commission_amount")
    .eq("professional_id", professionalId);
  if (rErr) throw new Error(`tax-status-reader: revenue: ${rErr.message}`);
  const pendingCommission = (rev ?? []).reduce((s, r) => s + Number(r.commission_amount), 0);

  return {
    complete: prof?.tax_status_completed_at != null,
    fields: {
      personType: prof?.tax_person_type ?? null,
      hasRut: prof?.tax_has_rut ?? null,
      isIncomeDeclarant: prof?.tax_is_income_declarant ?? null,
      isVatResponsible: prof?.tax_is_vat_responsible ?? null,
      idNumber: prof?.tax_id_number ?? null,
      mustInvoice: prof?.tax_must_invoice ?? null,
    },
    pendingCommission,
  };
}
