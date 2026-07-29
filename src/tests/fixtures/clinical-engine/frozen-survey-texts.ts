// Textos de opcion de encuesta que la CIENCIA CONGELADA matchea por substring o igualdad, con el
// efecto clinico que disparan. La ciencia lee TEXTO MUTABLE de la BD (survey_options.option_text);
// si alguien edita una de estas cadenas (semilla o script de contenido), el efecto deja de
// dispararse SIN ERROR. Es la familia del bug de cintura, pero peor: depende de contenido que un
// humano puede editar sin tocar codigo.
//
// FUENTE UNICA para dos candados que no pueden desalinearse:
//   (A) el golden del orquestador: alimenta estos textos y verifica que el flag se enciende (prueba
//       que el frozen matchea la cadena EXACTA de la semilla), positivo y negativo;
//   (B) el candado de semilla (survey-engine-coupling.test.ts, bloque BD): verifica que la BD
//       contiene estas cadenas char-by-char.
// Si el frozen deja de reconocer una cadena, (A) truena; si la semilla la cambia, (B) truena.
//
// ALCANCE: cubre los flags de PROTOCOLO (motorProtocolo), que son los que voltean una prescripcion
// (IRC: proteina 1.2 -> 0.6). El resto de lecturas por texto del frozen (calcLE8/computeDFI:
// d2_19/d2_20/d3_24/d3_26/d3_30/d5_38...) esta cubierto parcialmente por el camino feliz de
// survey-engine-coupling.test.ts; ampliar el candado a TODAS las ramas es deuda de BACKLOG
// (acoplamiento ciencia-congelada <-> texto de encuesta mutable).

export type FrozenSurveyMatch = {
  fieldKey: string;
  optionText: string; // el texto EXACTO como vive en la semilla
  match: { type: "substring"; needle: string } | { type: "exact" };
  flag: "tieneIRC" | "tieneCancer" | "tieneDM" | "tieneHTA";
  effect: string; // consecuencia clinica si se enciende
};

// motorProtocolo (atlas-protocolo.js:46-49): d5_39 por substring en minuscula; d5_36 por igualdad.
export const PROTOCOL_FLAG_TEXTS: FrozenSurveyMatch[] = [
  { fieldKey: "d5_39", optionText: "Insuficiencia renal", match: { type: "substring", needle: "renal" }, flag: "tieneIRC", effect: "protMin 0.6-0.8 (KDIGO), estrategia peso actual" },
  { fieldKey: "d5_39", optionText: "Cáncer (activo)", match: { type: "substring", needle: "cáncer" }, flag: "tieneCancer", effect: "hipercalorico +300, protMin 1.5" },
  { fieldKey: "d5_39", optionText: "Cáncer (en remisión)", match: { type: "substring", needle: "cáncer" }, flag: "tieneCancer", effect: "hipercalorico +300 (ver consulta: mismo que activo)" },
  { fieldKey: "d5_39", optionText: "Diabetes tipo 2", match: { type: "substring", needle: "diabet" }, flag: "tieneDM", effect: "restriccion CHO simples < 10% GET" },
  { fieldKey: "d5_36", optionText: "Sí", match: { type: "exact" }, flag: "tieneHTA", effect: "restriccion Sodio < 2300 mg/dia" },
];
