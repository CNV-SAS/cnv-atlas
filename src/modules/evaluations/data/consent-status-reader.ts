import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NECESSARY_CONSENT_TYPES } from "@/modules/consent/validations";

// Estado del consentimiento del paciente de una evaluacion, para mostrarlo al profesional en la
// pestana Evaluacion (firmado + fecha + version). El dato ya existe (patient_consents); esto es
// solo lectura de estado. Va por el cliente con sesion: la RLS (patient_consents_select) deja al
// profesional del paciente (o admin) leerlo. No revoca ni firma nada aqui.

export type NecessaryConsent = {
  type: string; // servicio | datos_sensibles | internacional_ia
  signedAt: string | null;
  version: string | null;
  active: boolean; // revoked_at null
};

export type ConsentStatus = {
  allNecessaryActive: boolean; // las 3 necesarias vigentes (regla dura 15)
  necessary: NecessaryConsent[];
  representative: { name: string | null; relationship: string | null } | null; // rama menor
};

type ConsentRow = {
  consent_type: string;
  consent_version: string | null;
  signed_at: string | null;
  revoked_at: string | null;
  legal_representative_name: string | null;
  legal_representative_relationship: string | null;
};

// Ensambla el estado de consentimiento desde las filas crudas. Puro (sin BD): testeable.
export function buildConsentStatus(rows: ConsentRow[]): ConsentStatus {
  const necessary: NecessaryConsent[] = NECESSARY_CONSENT_TYPES.map((t) => {
    const active = rows.find((r) => r.consent_type === t && r.revoked_at === null);
    const any = active ?? rows.find((r) => r.consent_type === t);
    return {
      type: t,
      signedAt: any?.signed_at ?? null,
      version: any?.consent_version ?? null,
      active: Boolean(active),
    };
  });

  const rep = rows.find((r) => r.consent_type === "representante_legal" && r.revoked_at === null);

  return {
    allNecessaryActive: necessary.every((n) => n.active),
    necessary,
    representative: rep
      ? {
          name: rep.legal_representative_name ?? null,
          relationship: rep.legal_representative_relationship ?? null,
        }
      : null,
  };
}

export async function getConsentStatusForEvaluation(
  evaluationId: string,
): Promise<ConsentStatus | null> {
  const supabase = await createSupabaseServerClient();

  const { data: evalRow, error: eErr } = await supabase
    .from("evaluations")
    .select("patient_id")
    .eq("id", evaluationId)
    .maybeSingle();
  if (eErr) throw new Error(`consent-status-reader: evaluations: ${eErr.message}`);
  if (!evalRow) return null; // no existe o no es del profesional (RLS)

  const { data: consents, error: cErr } = await supabase
    .from("patient_consents")
    .select(
      "consent_type, consent_version, signed_at, revoked_at, legal_representative_name, legal_representative_relationship",
    )
    .eq("patient_id", evalRow.patient_id);
  if (cErr) throw new Error(`consent-status-reader: patient_consents: ${cErr.message}`);

  return buildConsentStatus(consents ?? []);
}
