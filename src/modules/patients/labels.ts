// Etiquetas de presentacion (SOLO display) para valores enum que se guardan en clave tecnica. No
// cambian el valor persistido ni lo que entra al motor. El sexo se persiste como "F"/"M" (valor
// canonico de FRONTERA, estricto: normalizeSex falla en voz alta ante cualquier otra cosa). Aqui solo
// se traduce para mostrar; el fallback tolera datos viejos ("Male"/"Female") por si quedara alguno.

// Sexo -> etiqueta. Desconocido: se muestra tal cual (no se inventa una traduccion).
export function sexoLabel(sex: string | null): string {
  if (sex == null || sex.trim() === "") return "-";
  const v = sex.trim().toLowerCase();
  if (v.startsWith("m")) return "Masculino"; // "M" (o "Male" viejo)
  if (v.startsWith("f")) return "Femenino"; // "F" (o "Female" viejo)
  return sex;
}

// Estado del paciente (enum patient_status). Fallback: la clave cruda si aparece un valor nuevo.
const ESTADO_PACIENTE: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
};
export function estadoPacienteLabel(status: string): string {
  return ESTADO_PACIENTE[status] ?? status;
}

// Estado de la evaluacion (enum evaluation_status). Fallback: la clave cruda.
const ESTADO_EVALUACION: Record<string, string> = {
  // Reorganizacion del intake: el shell firmado sin responder se lee como ESTADO, no como error. El
  // profesional que abra la ficha entiende por que la evaluacion existe pero no tiene respuestas.
  awaiting_survey: "Firmada, esperando la encuesta",
  draft: "Borrador",
  in_progress: "En progreso",
  completed: "Completada",
  abandoned: "Abandonada",
};
export function estadoEvaluacionLabel(status: string): string {
  return ESTADO_EVALUACION[status] ?? status;
}

// Estados de evaluacion que NO cuentan como una evaluacion "real" en el roster: el shell firmado sin
// responder y el abandonado. Existen (el consentimiento firmado es un acto real) pero no inflan el
// conteo del paciente ni ocupan una cola de accion.
export const NON_COUNTING_EVALUATION_STATUSES = new Set(["awaiting_survey", "abandoned"]);
