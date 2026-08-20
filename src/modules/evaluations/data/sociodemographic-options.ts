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

// PERTENENCIA etnica CONDICIONADA POR PAIS (RESPUESTA_GILDARDO 2026-08-20 §4): la lista DANE es COLOMBIANA
// (Raizal, Palenquero, Gitano o Rrom son categorias del ordenamiento colombiano; a un paciente en Lima o Sao
// Paulo no le ofrecen casilla donde reconocerse). En otros paises hay que traer su clasificacion oficial
// (INEGI en Mexico, IBGE en Brasil con sus cinco categorias, ...) o dejar la pregunta OCULTA ("oculta antes
// que mal preguntada"). ESTRUCTURA condicionable DESDE YA aunque hoy solo Colombia tenga contenido: agregar
// un pais = agregar una entrada al mapa, sin rehacer la UI (Gildardo: "si se cablea como lista fija, despues
// habra que rehacerla"). La ASCENDENCIA NO se condiciona: sus cuatro opciones no dependen de ningun censo, se
// queda global e igual en los trece paises.
export const ETNIA_BY_COUNTRY: Record<string, readonly EtniaOption[]> = {
  Colombia: ETNIA_OPTIONS,
};

// Lista de pertenencia etnica del pais, o null si no hay (la pregunta se OCULTA). Sin pais conocido -> Colombia
// (el caso comun en el lanzamiento; hoy es el unico pais con contenido).
export function etniaOptionsForCountry(country: string | null | undefined): readonly EtniaOption[] | null {
  return ETNIA_BY_COUNTRY[country ?? "Colombia"] ?? null;
}

// Ascendencia (RESPUESTA_GILDARDO 2026-08-15 §3): SEGUNDA pregunta de etnia, separada de la pertenencia
// (DANE) porque una sola casilla respondia dos preguntas distintas (por eso "mestizo" no cabia en el DANE).
// Va JUNTO a la pertenencia y gateada a la misma autorizacion de investigacion. El texto ANTECEDE la pregunta
// (deliberado): "Independientemente de lo anterior". Caracterizacion/exploracion, NUNCA coeficiente de
// correccion (misma regla que la nefrologia retiro en 2021; ver DATA_GOVERNANCE).
export const ASCENDENCIA_PROMPT = "Independientemente de lo anterior";
export const ASCENDENCIA_OPTIONS = [
  "Predominantemente indígena",
  "Predominantemente europea",
  "Predominantemente africana",
  "Mezcla de dos o más de las anteriores",
  "No sé",
  "Prefiero no responder",
] as const;
export type AscendenciaOption = (typeof ASCENDENCIA_OPTIONS)[number];

// Descripcion breve de autorreconocimiento por categoria. El dictamen legal exige que el paciente PUEDA
// reconocerse: las categorias DANE (Raizal, Palenquero, Rrom) son precisas y poco conocidas, y sin
// entenderlas no hay autorreconocimiento real. Redactadas simples, en segunda persona.
// PENDIENTE: confirmacion del asesor legal (se le pasan para validar; no bloquea el uso interino).
export const ETNIA_DESCRIPTIONS: Record<EtniaOption, string> = {
  "Indígena": "Perteneces a un pueblo o comunidad indígena.",
  "Gitano o Rrom": "Perteneces al pueblo gitano (Rrom).",
  "Raizal": "Eres nativo del archipiélago de San Andrés, Providencia y Santa Catalina, de raíces afroanglocaribeñas.",
  "Palenquero": "Desciendes de San Basilio de Palenque (Bolívar).",
  "Negro, mulato, afrodescendiente o afrocolombiano": "Tienes ascendencia africana.",
  "Ninguno de los anteriores": "No te reconoces en ninguna de las categorías anteriores.",
  "Prefiero no responder": "Eliges no informar tu pertenencia étnica.",
};

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
