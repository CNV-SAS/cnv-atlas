// Tipo NEUTRO (sin server-only) del contenido de referencia de un estado EFR. Vive aparte del reader
// server-only para que un componente cliente lo importe sin arrastrar el reader al boundary de cliente
// (hazard RSC latente; ver client-import-server-only-rompe-prod). El reader lo reexporta para el server.
export type EfrStateRef = {
  stateNumber: number;
  diagnosisName: string;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};
