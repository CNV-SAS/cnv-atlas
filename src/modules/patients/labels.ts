// Etiquetas de presentacion (SOLO display) para valores enum que se guardan en ingles o en
// clave tecnica. No cambian el valor persistido ni lo que entra al motor. En particular, el
// sexo se persiste como "Male"/"Female": es el valor canonico de FRONTERA que protege la regla
// de normalizacion del sexo (normalizeSexo, fail-loud). Aqui solo se traduce para mostrar.

// Sexo -> etiqueta. Desconocido: se muestra tal cual (no se inventa una traduccion).
export function sexoLabel(sex: string | null): string {
  if (sex == null || sex.trim() === "") return "-";
  const v = sex.trim().toLowerCase();
  if (v.startsWith("m")) return "Masculino"; // "Male" | "Masculino"
  if (v.startsWith("f")) return "Femenino"; // "Female" | "Femenino"
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
  draft: "Borrador",
  in_progress: "En progreso",
  completed: "Completada",
};
export function estadoEvaluacionLabel(status: string): string {
  return ESTADO_EVALUACION[status] ?? status;
}
