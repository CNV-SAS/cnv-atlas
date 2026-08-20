// Opciones sociodemograficas portadas VERBATIM del archivo de Gildardo (`reference/ATLAS-Patients_v7.html`,
// constantes EDUCACION/ESTADO_CIVIL/OCUPACIONES/MOTIVOS y el estrato inline). Caracterizacion opcional: no
// alimentan ningun motor (sin field_key, used_in_diagnosis=false). Etnia y ascendencia SI viven aqui (con
// consent v1.0 ya en produccion): son datos sensibles (Ley 1581 art. 5) y por eso solo se muestran/capturan
// si el paciente otorgo la autorizacion de investigacion; el servidor lo re-gatea. NUNCA como coeficiente de
// correccion de ningun indice, solo caracterizacion y exploracion (DATA_GOVERNANCE, RESPUESTA_GILDARDO §3).
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

// Etnia / grupo poblacional: UNA sola pregunta (RESPUESTA_GILDARDO 2026-08-20 v2 §3), lista UNIFICADA para los
// quince paises. Reemplaza el desdoble anterior (pertenencia DANE + ascendencia): la lista DANE es colombiana e
// inaplicable en operacion regional (cada pais tiene su marco oficial y no son compatibles; dictamen legal del
// 20). Dato sensible: solo se muestra/captura si el paciente autorizo investigacion; el servidor lo re-gatea.
// "Otro" abre un campo "cual" (texto libre, 50 chars, con precauciones; ver about-you-section y DATA_GOVERNANCE).
// NOTA (ronda pendiente): el asesor legal objeta "Mulato/a" (etimologia, carga variable por pais, incoherencia y
// redundancia con Afrodescendiente); se conserva por instruccion de la direccion cientifica, la objecion va en
// la ronda. Riesgo reputacional/calidad del dato, NO de legalidad.
export const ETNIA_LABEL = "Etnia / grupo poblacional";
export const ETNIA_OTHER = "Otro"; // dispara el campo "cual" (texto libre)
export const ETNIA_OPTIONS = [
  "Mestizo/a",
  "Blanco/a",
  "Afrodescendiente",
  "Indígena",
  "Mulato/a",
  "Otro",
  "Prefiero no indicar",
] as const;
export type EtniaOption = (typeof ETNIA_OPTIONS)[number];

// ASCENDENCIA: RETIRADA del intake (RESPUESTA_GILDARDO 2026-08-20 v2 §3). No esta parametrizada en el HTML de
// Gildardo (no hay campo que la reciba), asi que producia un dato sin destino. Se DEJA DE CAPTURAR (el form ya
// no la envia); la columna patient_profiles.ancestry se conserva (tiene datos de prueba), sin uso. La constante
// queda referenciada solo por la validacion, que ahora siempre resuelve a null porque el form no la manda. Su
// retiro/parametrizacion definitiva va en la ronda (Gildardo la pidio el 17, su carta del 20 no la menciona).
export const ASCENDENCIA_OPTIONS = [
  "Predominantemente indígena",
  "Predominantemente europea",
  "Predominantemente africana",
  "Mezcla de dos o más de las anteriores",
  "No sé",
  "Prefiero no responder",
] as const;
export type AscendenciaOption = (typeof ASCENDENCIA_OPTIONS)[number];

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
