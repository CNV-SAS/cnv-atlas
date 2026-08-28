import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CONSENT_TYPES, NECESSARY_CONSENT_TYPES, type ConsentType } from "../validations";

// Autorizaciones del paciente para la ficha (`/pacientes/[patientId]`): que firmo, cuando, con que version
// y cuales siguen vigentes. Cliente anon + RLS (`patient_consents_select`): el profesional del paciente y
// admin. Solo lee; revocar es otro camino (ver `consent-revocation-writer`).
//
// SOLO LAS CASILLAS que el titular marca (`CONSENT_TYPES`). Los tipos DERIVADOS de la rama menor
// (representante_legal, asentimiento_menor) los genera el escritor y no son autorizaciones revocables por
// separado: revocar el "representante legal" de un menor no significa nada por si solo.

export type AutorizacionPaciente = {
  tipo: ConsentType;
  necesaria: boolean; // del gate clinico (regla dura 15)
  vigente: boolean;
  firmadaEl: string | null;
  version: string | null;
  revocadaEl: string | null;
};

export async function getPatientConsents(patientId: string): Promise<AutorizacionPaciente[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_consents")
    .select("consent_type, consent_version, signed_at, revoked_at")
    .eq("patient_id", patientId);
  if (error) throw new Error(`consent-reader: getPatientConsents: ${error.message}`);

  const rows = data ?? [];
  const necesarias = new Set<string>(NECESSARY_CONSENT_TYPES);

  return CONSENT_TYPES.flatMap((tipo) => {
    // Una VIGENTE (el indice parcial unico garantiza que no hay dos), o la ultima revocada si ya no la hay.
    const propias = rows.filter((r) => r.consent_type === tipo);
    if (propias.length === 0) return []; // nunca la otorgo: no es lo mismo que revocada, y no se lista
    const vigente = propias.find((r) => r.revoked_at === null);
    const ultima =
      vigente ??
      [...propias].sort((a, b) => (a.revoked_at ?? "").localeCompare(b.revoked_at ?? "")).at(-1)!;
    return [
      {
        tipo,
        necesaria: necesarias.has(tipo),
        vigente: Boolean(vigente),
        firmadaEl: ultima.signed_at,
        version: ultima.consent_version,
        revocadaEl: vigente ? null : ultima.revoked_at,
      },
    ];
  });
}
