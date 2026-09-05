import { calcPatron, FREQ_GROUPS, FREQ_OPC, FREQ_SUP, type PatronCat, type PatronResult } from "./frozen/engine.patron.js";

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

// Los field_key que el patron consume (15 grupos + 3 horarios); el llamador filtra las respuestas por
// esta lista y detecta "anterior a C9" (ninguno declarado en la version).
export const PATRON_FIELD_KEYS: string[] = PATRON_KEYS;

export type PatronAnswer = { fieldKey: string; answerValue: string | null };

// Un grupo para la grilla del render (los 15, en el orden de FREQ_GROUPS): su ordinal (0-4) o null si
// no se respondio o no se pudo leer. El render mapea el ordinal a la etiqueta abreviada.
export type PatronGrupoView = { n: number; cat: PatronCat; label: string; ordinal: number | null };

export type PatronResolution =
  // La version de la encuesta no captura el patron (evaluacion ANTERIOR a C9).
  | { status: "no_capturado" }
  // Los campos existen pero el paciente no respondio NINGUN grupo. Se separa de calcPatron para no
  // mostrar "Deficiente" (el enc vacio da score 10): sin datos no es lo mismo que datos en cero.
  | { status: "sin_respuestas" }
  // Al menos una respuesta contestada no coincide con ninguna opcion canonica: DEFECTO del sistema. NO
  // se calcula el score (seria un numero sobre menos de 15 grupos, sin forma de saber que esta
  // incompleto). offenders = las que no se pudieron leer; grupos = los 15 con su ordinal (null = no
  // leido) para que el render muestre lo que si se leyo, sin puntaje.
  | { status: "ilegible"; offenders: { fieldKey: string; value: string }[]; grupos: PatronGrupoView[] }
  // Respondio al menos un grupo: el patron calculado (grupos sin responder -> -1, diseno de Gildardo).
  | { status: "ok"; patron: PatronResult; respondidos: number; grupos: PatronGrupoView[] };

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
    if (GROUP_SET.has(k)) respondidos++; // solo los 15 grupos cuentan; los horarios no
  }

  // Los 15 grupos, en el orden de FREQ_GROUPS, con su ordinal o null: la grilla que muestra el render.
  const grupos: PatronGrupoView[] = FREQ_GROUPS.map((g) => ({
    n: g.n,
    cat: g.cat,
    label: g.label,
    ordinal: enc[`d1_${g.n}_i`] ?? null,
  }));

  if (offenders.length > 0) return { status: "ilegible", offenders, grupos };
  if (respondidos === 0) return { status: "sin_respuestas" };
  return { status: "ok", patron: calcPatron(enc), respondidos, grupos };
}

/**
 * Los campos del patrón resueltos a su ORDINAL, para el `enc` que consume `calcPatron`.
 *
 * POR QUE EXISTE, y es el defecto que cierra: al encender `LE8_MAPEO_CORREGIDO`, el dominio de
 * Alimentación del LE8 pasa a leer `calcPatron(enc).score`. Y `calcPatron` espera el ordinal 0-4 de cada
 * grupo, mientras Atlas guarda el TEXTO de la opción. Pasarle el enc crudo NO da error: ninguna
 * comparación `v >= 3` se cumple, el score sale 10 para todo el mundo, y un 10 se lee en pantalla como
 * "dieta deficiente" y no como "el porte está mal". Ver `docs/PLAN_LE8_ENCENDIDO.md` §1 (estado C).
 *
 * La resolución es la MISMA que la del reader de display: contra los textos canónicos del frozen
 * (`CANON`, derivado de `FREQ_OPC`/`FREQ_SUP`), no contra el orden de la base.
 *
 * UN VALOR QUE NO SE RECONOCE SE OMITE, no se inventa: `calcPatron` lee la ausencia como -1, que no
 * puntúa. Quien lo REPORTA como defecto es `resolvePatron` (estado `ilegible`), que corre sobre la misma
 * evaluación. Así una respuesta ilegible se ve en el panel del patrón y no fabrica un ICEC en silencio,
 * que es lo que su CA-3 mandó evitar.
 *
 * Cubre los 18 campos que `calcPatron` lee (15 grupos + 3 horarios), no solo los que hoy puntúan: si
 * algún día los horarios entran al score, ya llegan en la forma correcta.
 */
export function ordinalesPatron(enc: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of PATRON_KEYS) {
    const v = enc[k];
    if (typeof v !== "string" || v === "") continue;
    const ordinal = CANON[k].indexOf(v);
    if (ordinal !== -1) out[k] = ordinal;
  }
  return out;
}
