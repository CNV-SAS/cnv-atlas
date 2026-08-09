// Tipos NEUTROS (sin server-only) de las notas de criterio del profesional. Viven aparte del reader
// server-only para que un componente cliente los importe sin arrastrar el reader al boundary de cliente
// (hazard RSC latente; ver client-import-server-only-rompe-prod). El reader los reexporta para el server.
export type DiagnosisNote = { id: string; note: string; createdAt: string };
export type DiagnosisCriterion = { diagnosisId: string; notes: DiagnosisNote[] };
