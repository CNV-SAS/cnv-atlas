// Opciones sociodemograficas portadas VERBATIM del archivo de Gildardo (`reference/ATLAS-Patients_v7.html`,
// constantes EDUCACION/ESTADO_CIVIL/OCUPACIONES/MOTIVOS y el estrato inline). Caracterizacion opcional: no
// alimentan ningun motor (sin field_key, used_in_diagnosis=false). Etnia NO va aqui: es dato sensible (Ley
// 1581 art. 5) y espera el bump de consentimiento a v1.0 (ver BACKLOG.md).
//
// Modulo NEUTRO (sin "server-only"): lo importan el componente cliente del intake y la validacion del
// servidor; un tipo/constante compartido no puede vivir en un reader server-only (hazard de frontera RSC).

export const EDUCACION_OPTIONS = [
  "Primaria incompleta",
  "Primaria completa",
  "Secundaria incompleta",
  "Secundaria completa",
  "Técnico / Tecnólogo",
  "Universitario incompleto",
  "Universitario completo",
  "Posgrado",
] as const;

// Ocupacion: lista con "Otra" al final; "Otra" habilita un texto libre y se guarda el texto que escriba el
// paciente (no la palabra "Otra"). Por eso la validacion del servidor no exige pertenencia a la lista.
export const OCUPACION_OPTIONS = [
  "Docente / Profesor(a)",
  "Profesional de la salud",
  "Ingeniero(a)",
  "Abogado(a)",
  "Empleado(a) administrativo(a)",
  "Empleado(a) doméstico(a)",
  "Desempleado(a)",
  "Jubilado(a) / Pensionado(a)",
  "Independiente / Freelance",
  "Empresario(a) / Emprendedor(a)",
  "Militar",
  "Deportista",
  "Entrenador(a)",
  "Arte y cultura",
  "Otra",
] as const;

export const ESTADO_CIVIL_OPTIONS = [
  "Soltero/a",
  "Casado/a",
  "Unión libre",
  "Divorciado/a",
  "Viudo/a",
] as const;

export const ESTRATO_OPTIONS = ["1", "2", "3", "4", "5", "6", "No aplica"] as const;

// Pertenencia etnica: categorias del autorreconocimiento DANE + "Prefiero no responder" (valor EXPLICITO,
// distinto de dejar en blanco: el dictamen lo exige, dejar vacio puede ser un olvido, elegir no responder es
// una decision registrable). Dato sensible: solo se muestra/captura si el paciente autorizo investigacion.
export const ETNIA_OPTIONS = [
  "Indígena",
  "Gitano o Rrom",
  "Raizal",
  "Palenquero",
  "Negro, mulato, afrodescendiente o afrocolombiano",
  "Ninguno de los anteriores",
  "Prefiero no responder",
] as const;
export type EtniaOption = (typeof ETNIA_OPTIONS)[number];

// Motivo de consulta: MULTI-select en su archivo ("Puede seleccionar varios"). Se guarda como arreglo JSON
// de strings en evaluations.reason_for_visit (mismo patron que las respuestas opcion_multiple del intake).
export const MOTIVO_OPTIONS = [
  "Control de peso / composición corporal",
  "Evaluación nutricional de rutina",
  "Manejo de enfermedad crónica",
  "Detección de sarcopenia",
  "Rendimiento deportivo",
  "Envejecimiento saludable / longevidad",
  "Seguimiento (consulta previa en CNV)",
  "Otro",
] as const;

export type EducacionOption = (typeof EDUCACION_OPTIONS)[number];
export type EstadoCivilOption = (typeof ESTADO_CIVIL_OPTIONS)[number];
export type EstratoOption = (typeof ESTRATO_OPTIONS)[number];
export type MotivoOption = (typeof MOTIVO_OPTIONS)[number];
