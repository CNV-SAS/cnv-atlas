import type { HeaderClassification, HeaderRole } from "../types";

// Mapeo de los encabezados ruidosos del export de Biody Manager a un rol y a un
// nombre de variable estable. El export mezcla espanol, ingles y frances, con
// tokens internos de BiodyLife, unidades incrustadas y espacios sobrantes.
//
// La parte CRITICA y definitiva es la exclusion de PII: el nombre y la fecha de
// nacimiento del paciente vienen en el archivo y NUNCA deben persistirse en
// bis_raw_values ni salir del servidor. La identidad ya se resolvio en la encuesta
// (B7); el import se ata a una evaluacion existente, no crea pacientes.
//
// El nombre canonico de cada variable es PROVISIONAL: es el encabezado normalizado.
// El mapeo clinico definitivo (Re, Ri, Rinf, C, FMI, FFMI, ...) se acopla al motor y
// llega en B11. Aqui solo garantizamos no perder datos y no filtrar PII.

// Tokens internos de BiodyLife: distinguen el valor medido de la referencia y de la
// desviacion teorica. Se traducen a sufijos legibles SIN colapsar columnas distintas
// (perder el token fusionaria mediciones diferentes y causaria perdida de datos).
const TOKEN_REPLACEMENTS: [RegExp, string][] = [
  [/measurementDetails\.VALEURCALCULEEEXPORT/g, "valor"],
  [/measurementDetails\.REFERENCEESTIMEEEXPORT/g, "referencia"],
  [/measurementDetails\.ECARTTHEORIQUEEXPORT/g, "desviacion"],
];

// Normaliza un encabezado: recorta, traduce los tokens y colapsa espacios. El
// resultado es estable y sirve tanto para clasificar como de nombre de variable.
export function normalizeHeader(raw: string): string {
  let s = (raw ?? "").trim();
  for (const [re, rep] of TOKEN_REPLACEMENTS) s = s.replace(re, rep);
  return s.replace(/\s+/g, " ").trim();
}

// PII dura: identifica a la persona. Exclusion explicita por encabezado normalizado.
const PII_HEADERS = new Set<string>(["Paciente", "Fecha de nacimiento"]);

// Metadata no clinica: ids tecnicos, categoricos, sellos de la app. Se ignora. Los
// categoricos (Genero, Cup Size, Deportista profesional, Flag) ademas no caben en el
// modelo numerico de bis_raw_values; el sexo y la edad ya vienen del perfil/encuesta.
const METADATA_HEADERS = new Set<string>([
  "#",
  "Identifiant de la mesure",
  "Género",
  "Cup Size",
  "Deportista profesional",
  "Flag",
  "De BiodyLife",
  "Fecha de la Interpretación",
  "Modificado el",
  "Creado el",
  "Estatus",
  "Nombre de la aplicación",
  "Version de la aplicación",
]);

// Fecha de la medicion: alimenta bis_measurements.measurement_date.
const MEASUREMENT_DATE_HEADERS = new Set<string>(["Measurement date"]);

function roleOf(normalized: string): HeaderRole {
  if (normalized === "") return "metadata"; // columna sin encabezado: se ignora
  if (PII_HEADERS.has(normalized)) return "pii";
  if (MEASUREMENT_DATE_HEADERS.has(normalized)) return "measurement_date";
  if (METADATA_HEADERS.has(normalized)) return "metadata";
  return "variable";
}

export function classifyHeader(raw: string): HeaderClassification {
  const normalized = normalizeHeader(raw);
  const role = roleOf(normalized);
  return {
    rawHeader: raw,
    normalized,
    role,
    variableName: role === "variable" ? normalized : null,
  };
}

export function classifyHeaders(headers: string[]): HeaderClassification[] {
  return headers.map(classifyHeader);
}
