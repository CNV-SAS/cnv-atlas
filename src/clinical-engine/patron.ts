import { calcPatron, FREQ_OPC, FREQ_SUP, type PatronResult } from "./frozen/engine.patron.js";

// READER DEL PATRON ALIMENTARIO (C9) — compute-at-view-time, NO se sella.
//
// Resuelve las respuestas de encuesta de un paciente al `enc` que consume calcPatron, y devuelve un
// ESTADO discriminado (no una excepcion) para que una respuesta ilegible no tumbe la vista de
// evaluacion entera (lanzar dejaria al profesional sin diagnostico/composicion/tratamiento por una
// opcion mal escrita en una pregunta de frecuencia; el dano seria desproporcionado).
//
// El acoplamiento es DOBLE: por POSICION (el orden de la opcion define el valor 0-4) y por TEXTO (hay
// que reconocer la opcion exacta para saber su posicion). Se resuelve contra los textos CANONICOS del
// frozen (FREQ_OPC / FREQ_SUP), no contra lo que tenga la BD, para no confiar ciegamente en el orden de
// la base. El candado (patron-coupling.test.ts) verifica que la semilla == frozen byte a byte, y el
// DIFF que el frozen == v8; asi, reordenar O reescribir truena en algun lado.
//
// Mientras LE8_MAPEO_CORREGIDO siga en false (C1), esto es SOLO display: no alimenta el diagnostico ni
// se sella en el snapshot. Cuando C1 se active, calcPatron entrara al diagnostico por el interruptor del
// frozen; este reader de display se sigue computando en vista, sin resellar.
//
// El estado `ilegible` es un DEFECTO del sistema (no un dato faltante): el llamador (server) debe
// registrarlo en monitoreo (Sentry) ademas de mostrarlo, para que alguien lo arregle.

// Los 15 grupos (d1_1_i..d1_15_i) comparten FREQ_OPC; los 3 horarios (d1f_*) tienen su set en FREQ_SUP.
const GROUP_KEYS: string[] = Array.from({ length: 15 }, (_, i) => `d1_${i + 1}_i`);
const GROUP_SET = new Set(GROUP_KEYS);

// Mapa fieldKey -> conjunto de opciones canonico (el orden ES el ordinal).
const CANON: Record<string, readonly string[]> = {};
for (const k of GROUP_KEYS) CANON[k] = FREQ_OPC;
for (const s of FREQ_SUP) CANON[s.key] = s.opts;
const PATRON_KEYS = Object.keys(CANON); // 15 grupos + 3 horarios

export type PatronAnswer = { fieldKey: string; answerValue: string | null };

export type PatronResolution =
  // La version de la encuesta no captura el patron (evaluacion ANTERIOR a C9).
  | { status: "no_capturado" }
  // Los campos existen pero el paciente no respondio NINGUN grupo. Se separa de calcPatron para no
  // mostrar "Deficiente" (el enc vacio da score 10): sin datos no es lo mismo que datos en cero.
  | { status: "sin_respuestas" }
  // Al menos una respuesta contestada no coincide con ninguna opcion canonica: DEFECTO del sistema. NO
  // se calcula el score (seria un numero sobre menos de 15 grupos, sin forma de saber que esta
  // incompleto). offenders = las que no se pudieron leer; leidos = los grupos que si (el render puede
  // mostrarlos, pero sin puntaje).
  | { status: "ilegible"; offenders: { fieldKey: string; value: string }[]; leidos: { fieldKey: string; ordinal: number }[] }
  // Respondio al menos un grupo: el patron calculado (grupos sin responder -> -1, diseno de Gildardo).
  | { status: "ok"; patron: PatronResult; respondidos: number };

// declaredPatronKeys: los field_key de patron que DECLARA la version de la encuesta de esta evaluacion
// (para distinguir "anterior a C9" de "no respondio"). answers: respuestas con field_key de patron.
export function resolvePatron(
  declaredPatronKeys: string[],
  answers: PatronAnswer[],
): PatronResolution {
  const declara = declaredPatronKeys.some((k) => CANON[k] !== undefined);
  if (!declara) return { status: "no_capturado" };

  const byKey = new Map(answers.map((a) => [a.fieldKey, a.answerValue]));
  const enc: Record<string, number> = {};
  const offenders: { fieldKey: string; value: string }[] = [];
  const leidos: { fieldKey: string; ordinal: number }[] = [];
  let respondidos = 0;

  for (const k of PATRON_KEYS) {
    const v = byKey.get(k);
    if (v == null || v === "") continue; // no respondio: enc sin la clave -> calcPatron lo lee como -1
    const ordinal = CANON[k].indexOf(v);
    if (ordinal === -1) {
      offenders.push({ fieldKey: k, value: v }); // respondio algo que el reader no reconoce (defecto)
      continue;
    }
    enc[k] = ordinal;
    if (GROUP_SET.has(k)) {
      respondidos++; // solo los 15 grupos cuentan como "respondidos"; los horarios no
      leidos.push({ fieldKey: k, ordinal });
    }
  }

  if (offenders.length > 0) return { status: "ilegible", offenders, leidos };
  if (respondidos === 0) return { status: "sin_respuestas" };
  return { status: "ok", patron: calcPatron(enc), respondidos };
}
