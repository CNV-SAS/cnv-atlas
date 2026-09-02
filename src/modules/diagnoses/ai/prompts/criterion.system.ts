import promptV2 from "./criterion.system.v2.json";

// Texto CANONICO de las instrucciones de sistema del borrador de criterio (criterio.generate v1). La
// fuente unica es el JSON committeado: lo importa el builder (via este modulo) y el seed lo lee por fs
// (el seed no puede importar TS con alias @/). El admin lo edita creando versiones nuevas en BD desde
// /admin/ia; desde la v1 sembrada, la BD manda.
//
// Diseño (aprobado 2026-08-14): el texto NO diagnostica (el motor ya lo hizo, es inmutable); INTERPRETA
// la evidencia en prosa para que el profesional PARTA de ahi y escriba SU criterio. Abre en "los
// indicadores son compatibles con...", NO en "el paciente presenta...", que se leeria como re-diagnostico.
//
// BARRERA PII (regla dura 15): esto es SOLO el bloque de instrucciones. El mensaje de usuario con las
// variables clinicas se arma en codigo (criterion.v1.ts) y NO es editable, para que sea imposible por
// construccion inyectar PII al LLM desde la edicion del prompt.
// V2 (2026-09-01): se le anade un BLOQUE DE FORMATO, por su §8. El modelo que usamos (gpt-oss) escribe
// en markdown por defecto, y el criterio se pinta como texto PLANO: los asteriscos se ven crudos.
//
// LA V1 SE CONSERVA en su JSON y no se toca: los borradores ya generados se hicieron con ella, y un
// prompt versionado que se edita en su sitio borra con que se genero cada texto. Es la misma disciplina
// que las versiones de motor.
//
// Y ESTE ES SOLO UNO DE LOS DOS LADOS. El otro es el filtro de salida (`limpiarMarcadores`), y hacen
// falta los dos: un prompt baja la frecuencia con la que el modelo mete markdown, no la lleva a cero.
// Textual suyo: "por si el modelo desobedece, que es lo que hacen".
export const CRITERION_SYSTEM_PROMPT: string = promptV2.system;
