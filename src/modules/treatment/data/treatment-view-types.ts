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

// Lista de intercambio guardada (CP1.2, columna treatments.intercambio_porciones, jsonb). `objetivoBase` es el
// objetivo calorico efectivo con el que se calcularon las porciones: se guarda para COMPARAR contra el objetivo
// actual y avisar de desfase sin recalcular (opcion 3, DIV-11). `grupos` va keyed por id de grupo (G1..G12),
// cada uno con las porciones editadas y el alimento (`sub`) elegido del desplegable.
export type IntercambioGrupoSaved = { porciones: number; sub: string };
export type IntercambioSaved = { objetivoBase: number; grupos: Record<string, IntercambioGrupoSaved> };

// Distribucion por tiempos guardada (CP2.2, columna treatments.tiempos, jsonb). Los TRES campos cambian
// juntos (apagar una comida cambia el reparto y desfasa los overrides), por eso un solo jsonb con un candado:
// `activos` (que comidas hace el paciente, 6 toggles, parte del plan), `celdas` (overrides manuales por
// grupo->tiempo sobre el reparto auto; puede estar vacio), y `base` (las porciones de CP1 Y los activos con
// los que se hicieron los overrides, para avisar de desfase DOBLE sin borrar: DIV-11). El auto no se guarda:
// se recomputa en vivo con computeTiempos(porciones de CP1, activos); solo los overrides se persisten.
export type TiemposSaved = {
  activos: Record<string, boolean>;
  celdas: Record<string, Record<string, number>>;
  base: { porciones: Record<string, number>; activos: Record<string, boolean> };
};
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
  // Lista de intercambio guardada (CP1.2). null = nunca guardada -> el panel usa los defaults de
  // computeIntercambio(objetivo actual), siempre frescos.
  intercambioPorciones: IntercambioSaved | null;
  // Distribucion por tiempos guardada (CP2.2). null = nunca guardada -> el panel usa el reparto auto de
  // computeTiempos con los tiempos activos por defecto.
  tiempos: TiemposSaved | null;
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
