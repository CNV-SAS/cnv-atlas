import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { PendingTaxVerification } from "../validations";

// Lista de RUTs SUBIDOS pendientes de verificar (A2): tienen rut_path y aun no estan verificados. Para la
// superficie de CNV. El acceso lo gobierna la policy canVerifyTaxStatus; aqui la RLS deja al admin ver los
// perfiles. Orden ASCENDENTE por cuando el integrante subio su parte: el que lleva mas esperando primero
// (un integrante con el RUT sin verificar no puede cobrar, y eso es culpa de CNV; mismo criterio que las
// remesas sin confirmar). PendingTaxVerification vive en validations (neutro); se re-exporta.
export type { PendingTaxVerification } from "../validations";

export async function listPendingTaxVerifications(): Promise<PendingTaxVerification[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select(
      "id, tax_person_type, tax_id_type, tax_id_number, tax_id_dv, tax_status_completed_at, profiles!profile_id(full_name)",
    )
    .not("rut_path", "is", null)
    .is("rut_verified_at", null)
    .not("tax_status_completed_at", "is", null)
    .order("tax_status_completed_at", { ascending: true });
  if (error) throw new Error(`tax-verification-reader: listPendingTaxVerifications: ${error.message}`);

  return (data ?? []).map((row) => {
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      professionalId: row.id,
      fullName: prof?.full_name ?? "(sin nombre)",
      personType: row.tax_person_type,
      idType: row.tax_id_type,
      idNumber: row.tax_id_number,
      idDv: row.tax_id_dv,
      submittedAt: row.tax_status_completed_at as string,
    };
  });
}
