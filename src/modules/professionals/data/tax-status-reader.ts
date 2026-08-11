import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { TaxStatusFields } from "../validations";

// Estado tributario del integrante + su comision ACUMULADA pendiente, para el banner y el formulario. Bajo
// RLS: el integrante lee su propio perfil y su propia comision. El professionalId lo resuelve la accion.
// TaxStatusFields vive en validations (modulo neutro); se re-exporta para el servidor.
export type { TaxStatusFields } from "../validations";

export type TaxStatusView = {
  // El integrante dio SU parte (documento + cuenta + RUT si aplica). NO implica que este verificado.
  submitted: boolean;
  // CNV verifico el RUT y lleno los campos certificados (A2). rut_verified_at != null.
  verified: boolean;
  fields: TaxStatusFields;
  // Comision acumulada sin liquidar (hoy: toda su comision). Es lo que "espera sus datos".
  pendingCommission: number;
};

export async function getTaxStatusView(professionalId: string): Promise<TaxStatusView> {
  const supabase = await createSupabaseServerClient();
  const { data: p, error } = await supabase
    .from("professional_profiles")
    .select(
      "tax_person_type, tax_has_rut, tax_id_type, tax_id_number, tax_id_dv, rut_path, rut_verified_at, bank_name, bank_account_type, bank_account_number, bank_account_holder_name, bank_account_holder_document",
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

  const fields: TaxStatusFields = {
    personType: p?.tax_person_type ?? null,
    hasRut: p?.tax_has_rut ?? null,
    idType: p?.tax_id_type ?? null,
    idNumber: p?.tax_id_number ?? null,
    idDv: p?.tax_id_dv ?? null,
    rutUploaded: p?.rut_path != null,
    bankName: p?.bank_name ?? null,
    bankAccountType: p?.bank_account_type ?? null,
    bankAccountNumber: p?.bank_account_number ?? null,
    bankAccountHolderName: p?.bank_account_holder_name ?? null,
    bankAccountHolderDocument: p?.bank_account_holder_document ?? null,
  };

  // "Dio su parte": tipo + documento + cuenta, y el RUT subido si dijo que tiene. Se computa de los campos
  // reales (no de una marca): asi un perfil del formulario VIEJO (0060, sin cuenta ni RUT) sale INCOMPLETO
  // y el banner reaparece, en vez de quedar a medias entre los dos disenos.
  const submitted =
    fields.personType != null &&
    (fields.idNumber ?? "").length > 0 &&
    (fields.bankAccountNumber ?? "").length > 0 &&
    (fields.hasRut !== true || fields.rutUploaded);

  return {
    submitted,
    verified: p?.rut_verified_at != null,
    fields,
    pendingCommission,
  };
}
