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
  // true si el protocolo ya se aprobó (status='approved'): la prescripción es INMUTABLE (el trigger
  // de BD la congela). La UI lo usa para bloquear la edición y no dejar que un guardado choque contra
  // el trigger (se veria editable pero fallaria). Se corrige por versión nueva, no editando.
  approved: boolean;
  kcalObjetivo: number | null;
  proteinaGramos: number | null;
  // Peso meta (cadena calórica, pieza 1 — HECHO VISIBLE, nota 3 de Gildardo). pesoCalculo es el peso
  // sobre el que se calcula la prescripción (del snapshot sugerido); pesoCalculoLabel dice QUÉ fórmula lo
  // produjo ("Peso ajustado (obesidad)" / "Peso actual..."). adjPesoMeta es el peso meta FIJADO por el
  // profesional (override); null = se usa el calculado. Todos null si el tratamiento no selló snapshot.
  pesoCalculo: number | null;
  pesoCalculoLabel: string | null;
  adjPesoMeta: number | null;
  // Ajustes del profesional sobre la cadena calorica (pieza 2, columnas adj_*). null = usar el sugerido
  // sellado (protocolSuggested.calorico). Los cinco cascadean al recomputar con computeProtocoloEfectivo:
  // geb/pal cambian el GET; kcalObj lo fija a mano; protGkg/fatPct reparten macros. Entran a la firma de
  // ajustes junto con adjPesoMeta (candado de concurrencia + remonte). Todos null si no selló snapshot.
  adjGeb: number | null;
  adjPal: number | null;
  adjKcalObj: number | null;
  adjProtGkg: number | null;
  adjFatPct: number | null;
  restricciones: string[];
  // Objetivo del tratamiento nutricional (pieza 1): texto libre del profesional; null si no lo ha escrito.
  objetivoTexto: string | null;
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
