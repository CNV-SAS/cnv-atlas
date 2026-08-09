import type { ProtocoloSnapshot } from "@/clinical-engine";

// Tipos NEUTROS (sin server-only) de la vista del protocolo de tratamiento. Viven aparte del reader
// server-only para que el panel cliente los importe sin arrastrar el reader al boundary de cliente
// (hazard RSC latente; ver client-import-server-only-rompe-prod). El reader los reexporta para el server.
// ProtocoloSnapshot viene de clinical-engine (TS puro, neutro).

export type PrescribedNutraceutical = {
  id: string;
  nutraceuticalId: string;
  name: string;
  dosage: string | null;
  durationDays: number | null;
};

export type DietGuideline = { id: string; text: string };
export type TreatmentNote = { id: string; note: string; createdAt: string };
export type CatalogItem = {
  id: string;
  name: string;
  unit: string | null;
  indication: string | null;
  commercialAvailability: string; // en_consultorio | solo_tienda | no_disponible
};

export type MenuSuggestion = {
  id: string;
  provider: string;
  model: string;
  promptVersion: string;
  generatedText: string | null;
  status: string; // success, timeout, parse_failed, provider_error
  latencyMs: number | null;
  generatedAt: string;
};

export type TreatmentProtocol = {
  treatmentId: string;
  diagnosisConfirmed: boolean;
  kcalObjetivo: number | null;
  proteinaGramos: number | null;
  restricciones: string[];
  kcalSugerido: number | null; // GET medido por el Biody, si existe
  nutraceuticals: PrescribedNutraceutical[]; // los que AGREGA el profesional
  recommendedNutraceuticals: string | null; // los que RECOMIENDA el modelo (string del snapshot)
  guidelines: DietGuideline[];
  notes: TreatmentNote[];
  catalog: CatalogItem[];
  menuSuggestions: MenuSuggestion[]; // sugerencias de IA (B13), la mas reciente primero
  // Snapshot del protocolo sugerido (write-once, sellado al crear el tratamiento). Solo lectura; lo
  // usa el panel de consulta medica para mostrar examenes y suplementacion sugeridos. null si el
  // tratamiento se creo antes de sellar protocol_suggested.
  protocolSuggested: ProtocoloSnapshot | null;
};
