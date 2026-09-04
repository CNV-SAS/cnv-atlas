import "server-only";

import { asesoriaFuera, asesoriaMacro } from "@/clinical-engine/frozen/atlas-asesoria-macro.js";
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";
import { getCompositionForEvaluation } from "@/modules/diagnoses/data/composition-reader";
import { decodeSurveyValue } from "@/modules/clinical-pipeline/services/build-engine-input";
import { FREQ_OPC, FREQ_SUP } from "@/clinical-engine/frozen/engine.patron.js";
import { resumenDietaParrafo } from "@/clinical-engine/resumen-dieta";
import {
  resumenEjercicioParrafo,
  resumenMedicoParrafo,
  resumenPsicoParrafo,
} from "@/clinical-engine/resumen-profesion";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  AsesoriaMacro,
  AsesoriaMacroCruda,
  FilaPrescripcion,
  PrescripcionNutricional,
} from "./treatment-view-types";

// Parrafo de dieta del Resumen Clinico (pieza 1b). Reconstruye la encuesta (enc) de la evaluacion y corre
// resumenDietaParrafo. DISPLAY-ONLY: se computa al vuelo, no se sella (como el resto de la lectura del
// resumen). Todo por RLS (regla 3), como las demas lecturas del profesional.
//
// FORMA DEL enc: la funcion lee los campos de FRECUENCIA (d1_N_i, d1f_*) como INDICE 0-4, pero survey_answers
// guarda el TEXTO. Se convierte texto->ordinal con la MISMA TABLA del motor de patron (FREQ_OPC para los 15
// grupos, FREQ_SUP para los 3 horarios): una sola tabla de conversion, no dos que puedan divergir (su
// acoplamiento lo guarda patron-coupling, y por reusarla, un cambio de texto truena por AMBOS consumidores).
// Los campos de CONTEXTO (d8_*) quedan como TEXTO crudo; los contadores (d7_*) como el texto numerico (toNum).

// Tabla texto->ordinal por field_key de frecuencia (el orden ES el ordinal), identica a la CANON de patron.ts.
const FREQ_CANON: Record<string, string[]> = { ...Object.fromEntries(FREQ_SUP.map((s) => [s.key, s.opts])) };
for (let i = 1; i <= 15; i++) FREQ_CANON[`d1_${i}_i`] = FREQ_OPC;

// CONSTRUCTOR UNICO DEL `enc`, compartido por el parrafo de dieta y los tres por profesion. Dos
// constructores serian dos fuentes del mismo dato sin nada que las compare, que es como se cuelan las
// divergencias silenciosas. Devuelve null si la evaluacion no tiene respuestas.
async function buildEnc(
  evaluationId: string,
  sexo: string,
): Promise<Record<string, unknown> | null> {
  const supabase = await createSupabaseServerClient();

  const { data: response, error: rErr } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rErr) throw new Error(`dieta-resumen-reader: survey_responses: ${rErr.message}`);
  if (!response) return null;

  const { data: rows, error: aErr } = await supabase
    .from("survey_answers")
    .select("answer_value, survey_questions!inner(field_key, question_type)")
    .eq("response_id", response.id);
  if (aErr) throw new Error(`dieta-resumen-reader: survey_answers: ${aErr.message}`);

  const enc: Record<string, unknown> = { sexo };
  for (const r of rows ?? []) {
    const q = r.survey_questions as unknown as {
      field_key: string | null;
      question_type: string | null;
    } | null;
    const key = q?.field_key;
    if (!key) continue;
    const value = r.answer_value ?? "";
    const canon = FREQ_CANON[key];
    if (canon) {
      // Frecuencia: texto -> ordinal. -1 (no reconocido) se trata como AUSENTE (null), no como 0: un texto
      // no reconocido NO debe leerse como "Nunca". En la practica el candado de patron impide el -1.
      const ord = canon.indexOf(value);
      enc[key] = ord >= 0 ? ord : null;
      continue;
    }
    // LOS MULTI-SELECT ENTRAN COMO ARRAY, con el MISMO decodificador que usa el motor principal.
    //
    // AQUI ESTABA EL DEFECTO (smoke 2026-09-01). Este constructor dejaba el valor crudo, que para un
    // multi es el JSON `'["Cáncer"]'`. `motorTratNutri` hace `Array.isArray(e.d5_39)`, que sobre un
    // string da false, asi que `dx` quedaba VACIO y con el TODAS las comorbilidades: hasCancer, hasDM,
    // hasDislip y hasERC en falso para todos los pacientes. Al de ERC no le bajaba la proteina a 0,7; al
    // de cancer no le aplicaba la rama hipercalorica; al de dislipidemia no le ponia el limite de grasa
    // saturada. Y lo mismo viajaba al prompt del menu. Sin error y con el numero puesto.
    //
    // El sintoma que se vio en el smoke era la punta: "no aparece la alerta de antecedentes familiares".
    enc[key] = decodeSurveyValue(key, q?.question_type ?? "", value);
  }

  return enc;
}

export async function getDietaResumenForEvaluation(
  evaluationId: string,
  sexo: string,
): Promise<string | null> {
  const enc = await buildEnc(evaluationId, sexo);
  if (!enc) return null;
  const parrafo = resumenDietaParrafo(enc);
  return parrafo === "" ? null : parrafo; // "" = nada legible: se omite (no se muestra un parrafo vacio)
}

// PARRAFO DEL RESUMEN CLINICO SEGUN LA PROFESION DE QUIEN MIRA (su §11c: el resumen del profesional es "el
// de todas las condiciones clinicas a las que se tiene acceso con la encuesta y la composicion corporal").
//
// Reusa el MISMO enc que el parrafo de dieta, con su misma conversion texto->ordinal, y por eso vive aqui y
// no en un reader nuevo: dos constructores del enc serian dos fuentes del mismo dato, y ya sabemos como
// termina eso. Se paga una consulta, no dos.
//
// El del NUTRICIONISTA es el de dieta y ya estaba portado; los otros tres se portaron el 2026-08-29.
export async function getResumenProfesionForEvaluation(
  evaluationId: string,
  sexo: string,
  profession: string | null,
  bis: Record<string, unknown>,
): Promise<string | null> {
  if (!profession) return null;
  if (profession === "nutricionista") return getDietaResumenForEvaluation(evaluationId, sexo);

  const fn =
    profession === "medico"
      ? resumenMedicoParrafo
      : profession === "entrenador"
        ? resumenEjercicioParrafo
        : profession === "psicologo"
          ? resumenPsicoParrafo
          : null;
  if (!fn) return null;

  const enc = await buildEnc(evaluationId, sexo);
  if (!enc) return null;
  const parrafo = fn(enc, bis);
  return parrafo === "" ? null : parrafo;
}

// ─── LA PRESCRIPCIÓN NUTRICIONAL DEL MODELO (motorTratNutri) ────────────────────────────────────────
//
// SU DECISIÓN, textual (respuesta a la ronda del 2026-08-23, §1): *"`motorTratNutri` gobierna la
// prescripción nutricional. Es el que tiene la ciencia actualizada, y el sodio lo demuestra: 1.500 mg en
// hipertensión es lo que sostienen OMS, DASH/NHLBI y AHA/ACC 2025. Los 2.300 del otro motor son el corte
// viejo. Porten las nueve filas de `motorTratNutri`."*
//
// LO QUE ARREGLA, y llevaba ocho días en pantalla: el motor estaba PORTADO (con sus tres correcciones y su
// golden) y NADIE lo llamaba. Las restricciones que veía el nutricionista, y las que viajaban al generador
// de menús, salían de `atlas-protocolo`, el motor que NO gobierna: a un hipertenso le decían **2.300 mg de
// sodio**. Él mismo nos había señalado esa incoherencia en su carta.
//
// UNA SOLA FUENTE PARA LOS DOS CONSUMIDORES (la pantalla y el prompt del menú), a propósito: dos lecturas
// del mismo motor son dos sitios que pueden divergir, y esta pieza existe justamente porque había dos
// motores diciendo cosas distintas.
//
// LO QUE **NO** SE TOCA, Y ES DELIBERADO: las CIFRAS CALÓRICAS. `motorTratNutri` calcula su propio GEB
// (Mifflin siempre, sobre el peso meta) y la cadena que el profesional edita usa Cunningham cuando hay masa
// libre de grasa, que es siempre porque medimos bioimpedancia. Él lo nombró y dijo *"no lo cambien ahora"*.
// Cambiarlo movería el objetivo calórico de TODOS los pacientes, así que se pregunta antes. Aquí se leen
// solo las filas CUALITATIVAS de la prescripción, que son las que él mandó portar y las que estaban mal.
// El tipo vive en el modulo NEUTRO (treatment-view-types): lo consume tambien el panel, que es cliente.

/** Los cinco factores de su escala, al nombre que espera su `FA_MAP`. Un factor fuera de la escala no
 *  mapea a nada y el motor se queda con su propia recomendacion, que es el comportamiento correcto:
 *  inventarle un nombre seria decidir por el profesional. */
const FA_NIVEL_POR_FACTOR: Record<string, string> = {
  "1.2": "sedentario",
  "1.375": "ligera",
  "1.55": "moderada",
  "1.725": "alta",
  "1.9": "muy_alta",
};

/**
 * COMPLETA EL `bis` CON EL PESO Y LA TALLA, y devuelve null si no los hay.
 *
 * EL DEFECTO QUE CIERRA, encontrado en el smoke del 2026-09-03 y cometido por mi el mismo dia en que
 * registre la leccion: los callers pasan `snapshot.indicators`, que trae FMI y FFMI pero **NO trae peso
 * ni talla**. `motorTratNutri` no falla cuando le faltan: usa sus propios defaults (70 kg / 170 cm), o
 * sea IMC 24,2, y **contesta 1,0 g/kg**. Un numero plausible, en la unidad correcta, que se lee como
 * resultado.
 *
 * A QUIEN LE DOLIA: solo a las ramas que dependen del IMC. Obesidad se decide por FMI (que si llega) y
 * ERC por la encuesta, asi que esas dos salian bien. La que salia mal era la DESNUTRICION, o sea el
 * perfil donde una proteina equivocada hace mas dano: un paciente de 43,7 kg y 155 cm (IMC 18,2) recibia
 * 1,0 g/kg en vez de 1,5, y la pantalla mostraba tres cifras distintas del mismo concepto.
 *
 * POR QUE DEVUELVE NULL EN VEZ DE SEGUIR: porque la alternativa es exactamente el defecto. Sin peso el
 * motor igual contesta, y su respuesta no se distingue de una buena. Un null viaja hasta `protFuente`,
 * que lo DICE en pantalla; un 1,0 inventado no lo dice nadie.
 */
function conPesoYTalla(
  bis: Record<string, unknown>,
  comp: { peso: number | null; talla: number | null } | null,
): Record<string, unknown> | null {
  const peso = Number(bis.peso ?? comp?.peso ?? 0);
  const talla = Number(bis.talla ?? comp?.talla ?? 0);
  if (!(peso > 0) || !(talla > 0)) return null;
  return { ...bis, peso, talla };
}

/**
 * LA PROTEINA QUE PRESCRIBE EL MOTOR, sola, para los snapshots ANTERIORES al sellado (2026-09-03).
 *
 * Existe por una razon de orden y no de calculo: en la pagina, `getPrescripcionNutricional` se llama
 * DESPUES de la cadena, porque necesita su objetivo calorico y su PAL. Pero la cadena necesita la
 * proteina ANTES. La circularidad es solo aparente: `protKg` NO depende de `edit` (ni del objetivo, ni
 * del PAL, ni del peso meta), solo del fenotipo, las comorbilidades y la composicion. Asi que se puede
 * resolver primero, con `edit` vacio, y el resultado es el mismo que devolvera la llamada completa.
 *
 * Devuelve null si la evaluacion no tiene encuesta. Ahi la cascada cae a `protMin`, que es lo que habia.
 */
export async function getProtKgPrescrito(
  evaluationId: string,
  sexo: string,
  bis: Record<string, unknown>,
): Promise<number | null> {
  const enc = await buildEnc(evaluationId, sexo);
  if (!enc) return null;
  // El peso y la talla NO vienen en `indicators`; se leen de la composicion. Sin ellos no se corre el
  // motor (ver `conPesoYTalla`): contestaria con sus defaults y nadie podria notarlo.
  const completo = conPesoYTalla(bis, await getCompositionForEvaluation(evaluationId));
  if (!completo) return null;
  const m = motorTratNutri(enc, completo, {}) as { protKg: number };
  const v = Number(m?.protKg);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// LOS TRES ARGUMENTOS DE LA CADENA SON OBLIGATORIOS, y no es rigor de estilo: es el candado que faltaba.
//
// El 2026-08-31 se agrego `pesoMeta` como OPCIONAL y ningun caller lo paso. El motor cayo a su peso por
// defecto (Lorentz) y los gramos de proteina que imprimia no eran los de la cadena que el profesional
// tenia delante. Nada truena cuando se omite un parametro opcional: eso es lo que significa opcional.
//
// LA REGLA QUE SALE DE AHI: un parametro nuevo que cambia una salida CLINICA se declara obligatorio,
// aunque su tipo admita null. Obligatorio-y-nullable obliga a ESCRIBIR la decision ("aqui no hay peso",
// `null`) en vez de dejarla caer por omision, y tsc marca en rojo a todos los callers el dia que se
// agrega. Es la unica forma barata de que una pieza no se quede sin su ultimo cable.
export async function getPrescripcionNutricional(
  evaluationId: string,
  sexo: string,
  bis: Record<string, unknown>,
  /**
   * Peso EFECTIVO de la cadena (`adj_peso_meta ?? pesoCalculo`). Se le pasa al motor como su `peso_meta`
   * para que los gramos de proteína que imprime sean LOS MISMOS que muestra la cadena. Sin esto el motor
   * usaría su propio default (Lorentz) e ignoraría el peso meta que fijó el profesional: dos gramajes del
   * mismo concepto en dos pantallas, que es el defecto que esta pieza vino a cerrar.
   */
  pesoMeta: number | null,
  /**
   * Objetivo calorico EFECTIVO de la cadena (el que el profesional fijo, o el del modelo). Entra como su
   * `edit.kcal_obj`, que es la entrada que SU PROPIO motor tiene para esto.
   *
   * SIN ESTO EL TITULO MENTIA (smoke 2026-09-01). `tipoEnergia` sale de comparar el objetivo contra el
   * GET, y su motor lo RECALCULA despues de aplicar `edit.kcal_obj`. Al no pasarselo, el tipo se computaba
   * con el objetivo INTERNO del motor y quedaba clavado: el titulo decia "hipocalorica" con 500 kcal y con
   * 5.000. Su pantalla cambia a "hipercalorica" porque a la suya si le llega el numero.
   *
   * No hay ciencia nuestra aqui: la precedencia de cancer y desnutricion (que NO recalculan el tipo) la
   * sigue resolviendo su propia linea, dentro del motor.
   */
  kcalObjetivo: number | null,
  /**
   * PAL efectivo de la cadena. Entra como su `edit.fa_nivel`, la otra entrada que su motor ya tiene.
   *
   * Alinea el FACTOR de actividad de los dos calculos. Lo que NO alinea, porque su motor no acepta un GEB
   * de entrada, es la FORMULA del gasto: el suyo usa Mifflin sobre el peso meta y la cadena usa Cunningham
   * sobre masa libre de grasa. Esa es la pregunta abierta P-32/P-35 y NO se decide aqui.
   */
  palEfectivo: number | null,
): Promise<PrescripcionNutricional | null> {
  const enc = await buildEnc(evaluationId, sexo);
  if (!enc) return null;
  // MISMA GUARDA que en `getProtKgPrescrito`, y por la misma razon: este chip llevaba diciendo
  // "Proteína 1 g/kg" desde que el motor se conecto (2026-08-31) para los pacientes cuyo IMC decide la
  // rama, porque el bis llegaba sin peso ni talla. No es un defecto que introdujo el sellado; es el que
  // el sellado hizo visible al poner la misma cifra en dos sitios.
  const bisCompleto = conPesoYTalla(bis, await getCompositionForEvaluation(evaluationId));
  if (!bisCompleto) return null;

  const edit: Record<string, number> = {};
  if (pesoMeta != null && pesoMeta > 0) edit.peso_meta = pesoMeta;
  if (kcalObjetivo != null && kcalObjetivo > 0) edit.kcal_obj = kcalObjetivo;
  const faNivel = palEfectivo != null ? FA_NIVEL_POR_FACTOR[String(palEfectivo)] : undefined;
  if (faNivel) (edit as Record<string, unknown>).fa_nivel = faNivel;

  const m = motorTratNutri(enc, bisCompleto, edit) as {
    tipoEnergia: string;
    protKg: number;
    protG: number;
    sodioMax: number | null;
    grasaSatMax: number | null;
    attrs: string[];
    alertaFam: string[];
    notas: string[];
    refs: string[];
  };

  // Las filas con cifra, en el mismo formato que ya lee la pantalla y el prompt. `fmtDec` no se usa aquí
  // porque los valores llevan separador de miles y unidad; se escriben como su archivo los imprime.
  // LOS LIMITES van aparte de la proteina objetivo, y no es cosmetico: el motor SIEMPRE devuelve una
  // proteina, asi que meterla entre las restricciones abriria el gate de la IA para todos los pacientes y
  // romperia su §13. Un limite restringe lo que se puede comer; una meta no.
  const limites: FilaPrescripcion[] = [];
  if (m.sodioMax != null) {
    limites.push({
      nombre: "Sodio",
      valor: `< ${m.sodioMax.toLocaleString("es-CO")} mg/día`,
      ref: "OMS; DASH/NHLBI; AHA/ACC 2025",
    });
  }
  if (m.grasaSatMax != null) {
    limites.push({ nombre: "Grasa saturada", valor: `< ${m.grasaSatMax} % del total`, ref: "AHA; ESC/EAS; NLA" });
  }
  const filas: FilaPrescripcion[] = [
    // La referencia de la proteina es ESPEN, la que su formula sintetica pone al lado del campo. Antes se
    // tomaba `refs[0]`, que en un paciente sin comorbilidad es la de ACTIVIDAD: la pantalla decia
    // "Proteína 1 g/kg (Actividad: OMS 2020...)" y repetia esa misma linea abajo. Una referencia que no
    // corresponde al dato es peor que ninguna: dice que ese numero sale de donde no sale.
    { nombre: "Proteína", valor: `${String(m.protKg).replace(".", ",")} g/kg`, ref: "ESPEN 2023" },
    ...limites,
  ];

  return {
    tipoEnergia: m.tipoEnergia,
    alertaFam: m.alertaFam,
    protKg: m.protKg,
    protG: m.protG,
    sodioMax: m.sodioMax,
    filas,
    limites,
    atributos: m.attrs,
    notas: m.notas,
    referencias: m.refs,
  };
}

/**
 * EL PANEL DE REFERENCIA POR DIAGNOSTICO para proteina y grasa (su punto 3 del 2026-09-04).
 *
 * ES LA OTRA MITAD de la decision del 3 de septiembre. Su entrega retira la proteina por patologia de los
 * cuatro modulos congelados y la deja en 0,8 editable; esto es lo que la sustituye. Textual suyo: "si
 * portaron la retirada sin portar el panel, lo que quedo en Atlas es media instruccion, y es la mitad
 * peor". El criterio clinico que el motor imponia ahora se le MUESTRA a quien decide, en el momento de
 * decidir, con el mecanismo y la fuente de cada rango.
 *
 * NO PRESCRIBE NADA. Devuelve rangos, no valores. Y `fuera` no es una validacion: dice que la cifra que
 * el profesional escribio quedo fuera del rango sugerido, sin bloquear ni corregir, que es lo unico
 * compatible con su §5 del 2026-08-27 ("ninguna cifra de la prescripcion lleva techo, piso, validacion
 * ni advertencia").
 *
 * USA EL MISMO `enc` Y EL MISMO `bis` QUE `motorTratNutri`, por `buildEnc` y `conPesoYTalla`. No se
 * construye un segundo insumo: dos constructores del mismo dato es como el motor de nutricion termino
 * viendo cero comorbilidades en todos los pacientes (2026-09-01).
 */
export async function getAsesoriaMacros(
  evaluationId: string,
  sexo: string,
  bis: Record<string, unknown>,
  /**
   * LA EDAD, EXPLICITA, y no es un parametro de adorno: sin ella una rama entera de su asesoria queda
   * MUERTA y en silencio.
   *
   * Su `asesoriaMacro` lee `e.edad || b.edad` y con edad >= 65 agrega "65 años o más" (1,0-1,2 g/kg,
   * resistencia anabolica de la edad). Pero `buildEnc` arma el `enc` SOLO con las respuestas de la
   * encuesta mas `sexo`, y `bis` son los indicadores del snapshot, que tampoco la traen. Medido: un
   * paciente de 70 con ERC salia con UN solo item y sin conflicto; con la edad salen DOS y el conflicto
   * aparece. O sea que al profesional se le ocultaba justo la mitad que tira en sentido contrario.
   *
   * Es la familia de "un porte que lee la encuesta falla en silencio por la FORMA del enc": nada da
   * error, la rama simplemente no se alcanza. Va explicita y no metida dentro de `bis` para que se vea
   * en la firma que este panel la necesita.
   *
   * `null` cuando la evaluacion no tiene fecha de nacimiento: ahi la rama no debe correr (no se supone
   * una edad), y el resto de la asesoria sigue funcionando.
   */
  edad: number | null,
  /** Lo que el profesional tiene escrito hoy, para decir si quedo fuera. `null` = sin escribir. */
  protGKg: number | null,
  fatPct: number | null,
): Promise<{ prot: AsesoriaMacro; grasa: AsesoriaMacro } | null> {
  const enc = await buildEnc(evaluationId, sexo);
  if (!enc) return null;
  const base = conPesoYTalla(bis, await getCompositionForEvaluation(evaluationId));
  if (!base) return null;
  const bisCompleto = edad != null && edad > 0 ? { ...base, edad } : base;

  const arma = (macro: "prot" | "grasa", valor: number | null): AsesoriaMacro => {
    const a = asesoriaMacro(enc, bisCompleto, macro) as AsesoriaMacroCruda;
    return {
      unidad: a.unidad,
      items: a.items,
      conflicto: a.conflicto,
      rango: a.rango,
      nota: a.nota,
      fuera: valor == null ? null : (asesoriaFuera(valor, a) as string | null),
    };
  };
  return { prot: arma("prot", protGKg), grasa: arma("grasa", fatPct) };
}
