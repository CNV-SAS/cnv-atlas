import { BIODY_COLUMNS, type EngineInput, type EngineModelContext, type Sex } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
// LA EDAD EN ANOS CUMPLIDOS SE LEE CON LA FUNCION QUE YA EXISTIA, la del consentimiento. Es pura (sin
// server-only, sin React) y ya era la ESTRICTA de la casa: exige `YYYY-MM-DD` y devuelve null ante
// cualquier otra cosa. Escribir aqui una segunda seria exactamente como se llega a que el mismo paciente
// tenga dos edades segun quien pregunte.
import { computeAgeYears } from "@/modules/consent/validations";

// Arma el EngineInput desde los datos persistidos de una evaluacion. PURO (sin BD).
//
// El motor real consume la fila CRUDA del Biody con los headers EXACTOS del contrato de
// 94 columnas (corre su puerta dura, fail-loud). B8 guarda los crudos con el header
// NORMALIZADO como nombre de variable (normalizeHeader: trim + tokens BiodyLife +
// colapsar espacios). Aqui se reconstruye la fila exacta aplicando la MISMA
// normalizacion al header del contrato: bisRaw[normalizeHeader(BIODY_COLUMNS[f].header)].
// Asi el mapeo es completo (los 94 campos, incluido FM y los secundarios) y no puede
// desincronizarse de B8: usa su misma funcion (fuente unica de la normalizacion).

// Respuesta de encuesta ya resuelta a la variable del motor (field_key: d5_39, d3_24...),
// con el tipo de la pregunta para decodificar los multi-select. Solo llegan aqui las
// preguntas con field_key (las que alimentan el motor); el resto del instrumento no.
export type SurveyFieldAnswer = { fieldKey: string; type: string; value: string };

export type RawEvaluationData = {
  sex: string | null;
  birthDate: string | null; // 'YYYY-MM-DD'
  /**
   * Fecha de la medicion BIS (`bis_measurements.measurement_date`, not null en el esquema). La edad se
   * calcula A ESTA FECHA y no a la de hoy (Gildardo, EB-BIS v7 §3.1): si no, el mismo registro da una
   * edad distinta segun el dia en que se diagnostique o se corrija. `null` solo si no hay medicion, y
   * entonces no hay diagnostico posible (el gate de `hasBis` corta antes).
   */
  measurementDate: string | null;
  surveyAnswers: SurveyFieldAnswer[];
  // field_key que DECLARA la version de la encuesta (todas las preguntas con field_key de esa
  // version, respondidas o no). Es la lista contra la cual el motor mide dfi.complete (regla 7).
  expectedFieldKeys: string[];
  bisRaw: Record<string, number>; // header normalizado (B8) -> valor
  // Fuerza prensil (Kgf) de las condiciones de la toma. Criterio PRIMARIO de fuerza del EWGSOP2; sin
  // ella `dxSarcopenia` corta pidiendo el dato, que es lo correcto. null = no se registro.
  gripStrengthKg: number | null;
};

// Decodifica el valor almacenado de una pregunta multi-select a array. El intake guarda
// los multi como JSON (["HTA","Prediabetes"]); si no parsea a array, cae a valor unico o
// vacio. El motor hace Array.isArray sobre estos campos (d2_21, d5_38, d5_39).
function decodeMulti(value: string): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
  } catch {
    // no era JSON; se trata como valor unico abajo
  }
  return [value];
}

// Arma el objeto survey que consume el motor, keyed por field_key (d-field). Los
// multi-select se expanden a array; el resto queda como string. Con al menos un d-field
// presente, el motor corre el DFI completo (hasSurveyData); sin encuesta, degradado.
// Nota (GILDARDO_QUERIES.md Q3): la encuesta no aporta d1_9/d1_10/d1_16, asi que los
// dominios Alimentacion e Hidratacion del LE8 quedan en su valor por defecto. No se
// inventa mapeo: los campos simplemente no estan en el objeto.
// Texto libre de la opcion "Otra"/"Otros": el intake lo guarda como un elemento "Otra: <texto>".
// DOS conductas, decididas por Gildardo (2026-08-13):
//   - d5_39 (diagnosticos personales), §4: el texto libre SI alimenta el motor (es una condicion real del
//     paciente). Se conserva el texto, SIN el prefijo "Otra:" (centinela de UI, no parte de la condicion),
//     para que el match por substring del motor (renal/cancer/diabet) lo lea. El filo conocido (un "sin
//     enfermedad renal" activa la restriccion renal por substring) es responsabilidad del profesional:
//     TODO lo que el motor produzca es editable por el (motor propone, profesional dispone).
//   - Las otras preguntas con "Otra" (§3, las 9 aprobadas): su texto libre es REGISTRO, NO alimenta el
//     motor. Se stripea aqui, en la GLUE, antes de que el frozen lea el campo.
// No toca las cadenas sembradas ni el candado de acoplamiento.
// Cubre las cuatro flexiones (otra/otro/otras/otros), en sync con survey-widgets y survey-completeness.
const isFreeTextOther = (el: string): boolean => /^otr[oa]s?\s*:/i.test(el.trim());
const stripOtherPrefix = (el: string): string => el.replace(/^otr[oa]s?\s*:\s*/i, "");
// Campos cuyo texto libre de "Otra" SI alimenta el motor. d5_39 (diagnosticos personales) desde el inicio;
// d5_38 y d6_44 se suman por RESPUESTA_GILDARDO 2026-08-15 §4 ("el mismo criterio que d5_39: el texto libre
// alimenta el motor, y todo lo que resulte lo puede cambiar el profesional"). Una sola regla para las tres;
// el resto de las "Otra" (§3, registro) se stripea. Inerte hasta que esas preguntas tengan la opcion "Otra"
// (bump de encuesta v5): sin texto "Otra:" que procesar, no cambia nada para las respuestas existentes.
// AMPLIADO 2026-08-26 tras barrer las DOCE preguntas con opcion "Otra". La lista nombraba tres campos
// (RESPUESTA_GILDARDO 2026-08-15 §4) y nunca se volvio a mirar; no es que las hermanas se excluyeran, es
// que se escribio una vez. El criterio, ahora explicito: el texto libre ALIMENTA al motor cuando el motor
// ACTUA sobre su contenido, y se stripea cuando la respuesta es solo REGISTRO.
//
// Lo que esto arregla es un fallo silencioso en el peor sitio: la lista cerrada cubre los casos COMUNES,
// asi que lo que se perdia eran los RAROS, que son los que el profesional no adivina. Un alergico al kiwi
// marcaba "Otra", escribia "kiwi", y llegaba al motor COMO SI NO TUVIERA ALERGIAS.
//
// DOS DE ESTOS YA ERAN DEFECTO VIVO, no futuro: d2_21 y d5_40 tienen field_key desde siempre, asi que su
// dato ya llegaba y su texto libre ya se estaba tirando. En d2_21 eso significa que un "Otra: me provoco
// vomito" NO encendia la deteccion de metodos (engine.dfi.js:264, atlas-tratamiento.js:88). Y como la
// HISTORIA CLINICA lee crudo (survey-answers-reader, sin pasar por esta glue), el documento mostraba el
// medicamento o el metodo que el motor no habia visto: dos superficies leyendo fuentes distintas.
//
// d8_59 ("¿Quien prepara sus alimentos?") se queda FUERA a proposito: resumen-dieta.ts documenta que su
// "Otra" no se lista por no tener frase canonica. Es exclusion decidida, no olvido.
// d5_42 (contaminantes) se queda fuera por el criterio: es registro, ningun motor actua sobre el.
const FREE_TEXT_TO_ENGINE = new Set([
  "d5_39", // diagnosticos personales (original)
  "d5_38", // antecedentes familiares (original)
  "d6_44", // intolerancias (original)
  "d6_43", // ALERGIAS: seguridad. El alergeno no listado es el que hay que ver.
  "d6_qx", // cirugia digestiva: cambia absorcion y requerimiento proteico
  "d4_34", // patron alimentario: condiciona TODAS las comidas del plan
  "d4_35", // suplementos: para no duplicar el que no esta en la lista
  "d2_21", // metodos para cambiar de peso: alimenta la deteccion de TCA
  "d5_40", // medicamentos actuales: motorTratMedico actua sobre ellos
  "d3_25", // tipo de actividad: la prescripcion de ejercicio actua sobre el
]);

/**
 * El valor de UNA respuesta con la forma que el motor congelado espera: array para los multi-select,
 * string para el resto.
 *
 * EXPORTADA a proposito, y esa es la leccion: habia DOS constructores del `enc` y solo este decodificaba.
 * `dieta-resumen-reader` armaba el suyo dejando los multi como el JSON crudo, asi que el
 * `Array.isArray(e.d5_39)` de `motorTratNutri` daba false y TODAS las comorbilidades del multi-select
 * quedaban en falso: al de ERC no le bajaba la proteina, al de cancer no le subia las calorias, al de
 * dislipidemia no le ponia el limite de grasa saturada. Sin error, sin pantalla rota, con el numero
 * puesto. Quien arme un `enc` para un motor congelado usa ESTA funcion; no escribe la suya.
 */
export function decodeSurveyValue(fieldKey: string, type: string, value: string): unknown {
  if (type !== "opcion_multiple") return value;
  const els = decodeMulti(value);
  return FREE_TEXT_TO_ENGINE.has(fieldKey)
    ? els.map(stripOtherPrefix) // d5_39: conserva el texto libre (sin el centinela "Otra:")
    : els.filter((el) => !isFreeTextOther(el)); // resto: registro, no alimenta el motor
}

function buildSurvey(answers: SurveyFieldAnswer[]): Record<string, unknown> {
  const survey: Record<string, unknown> = {};
  for (const a of answers) survey[a.fieldKey] = decodeSurveyValue(a.fieldKey, a.type, a.value);
  return survey;
}

// ═══ LA EDAD NO SE ADIVINA, Y SE MIDE A LA FECHA DE LA MEDICION ═══
//
// ── QUE HACIA ANTES, Y POR QUE NO ERA UN DETALLE ──────────────────────────────────────────────────
//
// `computeAge` devolvia **0** ante una fecha ausente o ilegible, y ese 0 no se quedaba quieto. Medido el
// 2026-10-22 sobre la cohorte real: TRES evaluaciones selladas lo arrastran, y la edad entra al motor por
// CUATRO puertas distintas, cada una con su propio destrozo:
//
//   · `computeIAE`                   -> IAE = EB - 0 = EB. Una "aceleracion del envejecimiento" de +28,1
//                                       anos que se lee perfectamente plausible y es invencion.
//   · `capRef` (capacitancia)        -> devuelve null: la clasificacion SE PIERDE.
//   · `atlas-tratamiento-nutri.js:97`-> `Number(e.edad)||30`: la edad 0 se vuelve 30 en el GEB de Mifflin
//                                       sobre el peso meta. Para una paciente de 46, 80 kcal de mas.
//   · `atlas-asesoria-macro.js:101`  -> `||0`: el aviso de resistencia anabolica de los 65+ nunca sale.
//
// Lo que se salvo fue por suerte y no por diseno: `ATLAS_GEB_HB` si guarda (`e > 0`) y `ATLAS_GEB`
// prefiere el GEB medido por el equipo, que venia en las tres.
//
// ── AHORA FALLA EN VOZ ALTA, COMO SUS DOS VECINOS DE ESTE MISMO ARCHIVO ───────────────────────────
//
// `normalizeSex` (veinte lineas abajo) no adivina, y `computeAgeYears` del consentimiento tampoco: ante
// una fecha que no es `YYYY-MM-DD` devuelve null, y por eso la rama de menor de edad nunca se calculo con
// un ano de cinco digitos. O sea que la conducta correcta YA estaba escrita en la casa, sobre el MISMO
// dato, y el pipeline clinico era el unico que la convertia en un numero.
//
// ── Y A LA FECHA DE LA MEDICION, NO A LA DE HOY (Gildardo, EB-BIS v7, tabla 1 error 6) ────────────
//
// Su especificacion lo dice en la tabla de entradas: "edad: anos cumplidos (entero). Fuente: fecha de
// nacimiento y FECHA DE MEDICION". Antes se media contra `new Date()`, asi que un diagnostico generado
// semanas despues de la toma podia usar un ano mas que el que tenia el paciente cuando se midio, y una
// correccion del mismo registro meses mas tarde daba OTRA edad sobre los mismos datos crudos. La
// medicion tiene su fecha (`bis_measurements.measurement_date`, not null) y es la que manda.
//
// EL REDONDEO: se truncan los anos cumplidos, que es lo que esta funcion ya hacia y lo que el pide. El
// 30,95 que pasa a 31 de su error 6 NO es de aqui: es la columna `Edad` del equipo, que es decimal (156
// de 361 filas de la cohorte difieren por exactamente eso). Verificado, nada que cambiar.

// Techo y piso de lo HUMANAMENTE POSIBLE. NO es un criterio clinico: Regla 0 dice que ningun umbral que
// decida sobre un dato clinico se escribe sin su fuente al lado, y que si no hay fuente el cinturon va
// tan ancho que solo atrape lo IMPOSIBLE. 0 a 130 anos es el rango de lo que puede ser una persona viva:
// atrapa el ano de cinco digitos del tecleo (daba edad 0) y el 1795 del import (daba 231), y no toca a
// nadie mas. Medido en produccion el 2026-10-24: de 527 perfiles reales, 512 caen dentro, 15 no tienen
// fecha, y CERO tienen una fecha imposible (el script del 9 de octubre las corrigio).
//
// EL 18 A 100 DE LA EB-BIS v7 ES OTRA COSA Y NO VA AQUI. Ahi la edad fuera de rango deja la EB-BIS en
// "pendiente: edad no valida" (su seccion 3.1), que es un estado de UN indicador, no un freno al
// diagnostico. Hay 6 menores de 18 en la base con medicion vigente: frenarles el diagnostico entero
// seria ir mas lejos de lo que el pidio.
//
// (Este comentario decia "16 a 100" y los "6 menores de 16". El frozen dice `edad < 18 || edad > 100`
// y la cohorte de su entrega es de 18 anos o mas, asi que el 16 era un error de transcripcion mio.
// Corregido el 2026-10-29 al construir la exclusion de la pantalla de recalibracion, que lee el corte
// del frozen y no de aqui: un comentario con una cifra equivocada es un candado que nadie corre.)
export const EDAD_MAXIMA_POSIBLE = 130;

/** La edad en anos cumplidos a la fecha dada, o `null` si la fecha no se puede leer o es imposible. */
export function edadSiSePuede(birthDate: string | null, hasta: Date): number | null {
  if (!birthDate) return null;
  // LA MISMA LECTURA QUE EL CONSENTIMIENTO, no una copia: exige `YYYY-MM-DD` exacto (por eso rechaza el
  // ano de cinco digitos) y trunca a anos cumplidos. Una segunda definicion de "edad" en la casa
  // acabaria diciendo que el mismo paciente tiene dos edades.
  const edad = computeAgeYears(birthDate, hasta);
  if (edad == null || !Number.isFinite(edad)) return null;
  if (edad < 0 || edad > EDAD_MAXIMA_POSIBLE) return null;
  return edad;
}

/**
 * Edad en anos cumplidos a la fecha de la medicion. NO ADIVINA: una fecha ausente, ilegible o imposible
 * LANZA, igual que `normalizeSex`. La puerta (`edadParaDiagnosticar`) lo atrapa antes para que esto no
 * llegue nunca a la pantalla como un 500.
 */
export function computeAge(birthDate: string | null, hasta: Date): number {
  const edad = edadSiSePuede(birthDate, hasta);
  if (edad === null) {
    throw new Error(
      `computeAge: fecha de nacimiento invalida, llego: ${JSON.stringify(birthDate)}`,
    );
  }
  return edad;
}

// ═══ Y QUE FALTE LA EDAD ES UNA PUERTA, NO UN 500 ═══
//
// Misma estructura que el sexo, por la misma razon y con la misma pareja: el freno que LANZA vive al lado
// de la puerta que lo traduce, para que el dia que uno cambie no quede el otro admitiendo lo que el
// siguiente rechaza. Ver el bloque de `sexoParaDiagnosticar` abajo, que lo explica entero.
//
// DOS RECHAZOS, PORQUE EL REMEDIO ES DISTINTO:
//
//   · SIN FECHA: lo completa el profesional en la ficha, y ahi mismo se lo decimos. Son 15 pacientes
//     reales hoy, todos del lote del HTML, y por eso este cambio llega CON su salida
//     (`CompletarFechaDeNacimiento`): un freno sin salida no es un guard, detiene a una persona.
//   · PRESENTE PERO IMPOSIBLE: la ficha solo rellena huecos y nunca pisa un valor, asi que mandar ese
//     caso ahi seria mandarlo a una puerta cerrada. Hoy no existe ninguno en produccion (medido); el dia
//     que aparezca por un tecleo del intake, el camino es el mismo que el del sexo corregido, que
//     todavia no esta construido para la fecha. Queda dicho en el mensaje.
export type PuertaDeLaEdad =
  | { allowed: true }
  | { allowed: false; message: string; /** Si lo completa el profesional en la ficha. */ enLaFicha: boolean };

export function edadParaDiagnosticar(birthDate: string | null, hasta: Date): PuertaDeLaEdad {
  if (edadSiSePuede(birthDate, hasta) !== null) return { allowed: true };
  if (!birthDate || birthDate.trim() === "") {
    return {
      allowed: false,
      enLaFicha: true,
      message:
        "Falta la fecha de nacimiento del paciente, y sin ella no se puede generar el diagnóstico: la edad entra en el índice de aceleración del envejecimiento, en la clasificación de capacitancia y en el gasto calórico. Complétala en la ficha del paciente y vuelve a intentarlo.",
    };
  }
  return {
    allowed: false,
    enLaFicha: false,
    message:
      "La fecha de nacimiento registrada de este paciente no corresponde a una persona viva, así que el modelo no puede calcular su edad. No se corrige desde la ficha: avísale a quien administra Atlas para que la revise.",
  };
}

// Sexo a 'M' | 'F', ESTRICTO (decision A, 2026-08-10). El intake guarda exactamente "F"/"M" (select con
// esos valores). Antes esta funcion adivinaba ("empieza por f -> F, el resto -> M"), y "mujer" caia en M
// en silencio: como todos los clasificadores del motor son sexo-especificos (FFMI, ASMI, umbrales), un
// sexo mal asignado corrompe el diagnostico ENTERO. Ahora NO adivina: acepta F/M (indiferente a
// mayusculas) y ante cualquier otra cosa FALLA EN VOZ ALTA, diciendo QUE valor llego (para no perder una
// hora buscandolo). El frozen (normalizeSexo) valida despues; esta es la barrera que impide que algo que
// no sea F/M exacto llegue al motor.
export function normalizeSex(sex: string | null): Sex {
  const v = (sex ?? "").trim().toUpperCase();
  if (v === "F" || v === "M") return v;
  throw new Error(`normalizeSex: sexo invalido, esperado "F" o "M", llego: ${JSON.stringify(sex)}`);
}

// ═══ QUE FALTE EL SEXO ES UNA PUERTA, NO UN 500 (Sentry, 2026-10-10) ═══
//
// ── EL CASO ──────────────────────────────────────────────────────────────────────────────────────
//
// Una integrante abrio la pestaña Diagnostico de una paciente sin sexo registrado y `normalizeSex`
// lanzo. La excepcion salio de la accion, la peticion murio con un 500, el panel quedo en "Esta pestaña
// no se pudo mostrar" y "Volver a intentarlo" llevaba a "This page couldn't load". Siete eventos en
// Sentry: lo intento siete veces sin que nada le dijera que faltaba un dato ni como ponerlo.
//
// ── EL FRENO ES CORRECTO. LA FORMA DEL RECHAZO NO ──────────────────────────────────────────────────
//
// Es la MISMA leccion de la capacitancia de 16,22 nF: sin sexo no hay diagnostico posible, porque todos
// los clasificadores del motor son sexo-especificos (FFMI, ASMI, umbrales), asi que `normalizeSex` tiene
// que seguir siendo estricta y no se toca. Lo que estaba mal es que un dato que FALTA se tratara como un
// fallo del sistema. Esta funcion es la traduccion: la misma regla, dicha como una frase con salida.
//
// ── Y POR QUE VIVE AQUI, AL LADO DEL QUE LANZA ────────────────────────────────────────────────────
//
// Porque una puerta y el freno que protege tienen que mirar lo MISMO. Separadas, el dia que una cambie
// la otra queda admitiendo lo que la siguiente rechaza, y vuelve el 500. Las dos leen el mismo valor con
// la misma normalizacion, y estan a la vista una de la otra.
//
// ── DOS RECHAZOS DISTINTOS, PORQUE EL REMEDIO ES DISTINTO ─────────────────────────────────────────
//
//   · VACIO: el profesional lo completa en la ficha del paciente, y ahi mismo se lo decimos.
//   · PRESENTE PERO NO F/M (un "mujer" de los perfiles viejos de texto libre): eso NO lo arregla la
//     ficha, que solo rellena huecos y nunca pisa un valor. Lo canoniza `normalize-patient-sex.mjs`.
//     Mandar ese caso a la ficha seria mandarlo a una puerta cerrada, que es el defecto que acabamos de
//     corregir en la prescripcion.
export type PuertaDelSexo =
  | { allowed: true }
  | { allowed: false; message: string; /** Si lo arregla el profesional en la ficha. */ enLaFicha: boolean };

export function sexoParaDiagnosticar(sex: string | null): PuertaDelSexo {
  const v = (sex ?? "").trim().toUpperCase();
  if (v === "F" || v === "M") return { allowed: true };
  if (v === "") {
    return {
      allowed: false,
      enLaFicha: true,
      message:
        "Falta registrar el sexo del paciente, y sin ese dato no se puede generar el diagnóstico: todas las clasificaciones del modelo son distintas para mujer y para hombre. Complétalo en la ficha del paciente y vuelve a intentarlo.",
    };
  }
  return {
    allowed: false,
    enLaFicha: false,
    message:
      "El sexo registrado de este paciente no es válido, así que el modelo no puede clasificarlo. No se corrige desde la ficha: avísale a quien administra Atlas para que lo revise.",
  };
}

// Reconstruye la fila cruda con headers EXACTOS del Biody desde los crudos normalizados
// de B8, aplicando la misma normalizacion a cada header del contrato de columnas.
export function buildBisRow(bisRaw: Record<string, number>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of Object.values(BIODY_COLUMNS)) {
    const v = bisRaw[normalizeHeader(col.header)];
    if (typeof v === "number" && Number.isFinite(v)) {
      row[col.header] = v;
    }
  }
  return row;
}

export function buildEngineInput(
  raw: RawEvaluationData,
  model: EngineModelContext,
  now: Date,
): EngineInput {
  return {
    sexo: normalizeSex(raw.sex),
    // A LA FECHA DE LA MEDICION. `now` queda solo como reserva para el caso sin medicion, que el gate
    // del diagnostico ya impide: asi la edad de un registro no depende del dia en que se mire.
    edad: computeAge(raw.birthDate, raw.measurementDate ? new Date(raw.measurementDate) : now),
    bisRow: buildBisRow(raw.bisRaw),
    // La encuesta llega keyed por field_key (d-field) con los multi ya decodificados a array.
    survey: buildSurvey(raw.surveyAnswers),
    // Lista declarada por la version (regla 7): el motor mide dfi.complete contra ella. Viene
    // del reader; si esta vacia, run-pipeline ya fallo antes (no se llega aqui con lista vacia).
    expectedFieldKeys: raw.expectedFieldKeys,
    fuerzaPrensil: raw.gripStrengthKg,
    model,
  };
}
