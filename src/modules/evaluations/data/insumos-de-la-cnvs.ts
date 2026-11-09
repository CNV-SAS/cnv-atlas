import "server-only";

import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  diagnoses,
  evaluations,
  surveyAnswers,
  surveyQuestions,
  surveyResponses,
  treatments,
} from "@/db/schema";
import { nutraceuticosIndicadosEn } from "@/modules/followups/data/nutraceuticos-de-la-anterior-reader";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE LA CNV-S NECESITA DE LA CONSULTA ANTERIOR  ·  v15 §2.3 y §2.4  ·  2026-11-08
//
// ═══ DOS COSAS, Y LAS DOS SON DE LA CONSULTA ANTERIOR ═══
//
//   · LAS RESPUESTAS, por `field_key`: es la precarga del bloque de confirmacion (*"La vez pasada
//     respondiste: X"*) y lo que decide la regla de salto digestivo (su §7.2 exige que los siete se
//     hayan registrado como "Nunca" la vez pasada).
//   · LOS NUTRACEUTICOS INDICADOS: la lista del S1 y del S2.
//
// ═══ SE BUSCA POR PACIENTE, NO POR CONSULTA, Y ESA ES LA PARTE QUE IMPORTA ═══
//
// Porque en el camino publico LA CONSULTA TODAVIA NO EXISTE: el paciente abre su enlace de seguimiento
// y la pagina tiene que pintar el formulario ANTES de que se cree el shell (la encuesta se sirve en una
// sola carga). Lo unico que hay en ese momento es el paciente del enlace.
//
// Con la consulta ya creada (la pantalla de la profesional, la reanudacion) se pasa su id para
// EXCLUIRLA: sin eso, "la ultima consulta del paciente" seria ella misma y el bloque de confirmacion
// precargaria las respuestas que se estan contestando.
//
// ═══ Y "LA ANTERIOR" ES LA ANTERIOR **VIGENTE** ═══
//
// Una evaluacion reemplazada por una correccion o retirada no es una consulta del paciente, y
// precargarla seria pedirle que confirme lo que respondio en una consulta que se deshizo. Es la misma
// regla que ya usan la serie de seguimiento y la cronologia.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type InsumosDeLaCnvs = {
  /** Las respuestas de la consulta anterior, por `field_key`. `{}` si no hay anterior. */
  anteriores: Record<string, string | null>;
  /** Los nutraceuticos indicados en la anterior. Vacio = no se le indico ninguno (el caso normal). */
  productos: { id: string; nombre: string; dosis: string | null }[];
};

const VACIO: InsumosDeLaCnvs = { anteriores: {}, productos: [] };

/**
 * LOS INSUMOS DE UNA CONSULTA YA CREADA, por su id. Resuelve el paciente y excluye la consulta.
 *
 * Lo usan los lectores que solo tienen la consulta delante (la vista de la encuesta del profesional y
 * la pantalla de completarla): necesitan los NOMBRES de los productos del S1, que la respuesta guarda
 * por id. Va aqui, al lado de la resolucion de "la anterior", para no tener dos.
 */
export async function insumosDeLaCnvsDeLaConsulta(evaluationId: string): Promise<InsumosDeLaCnvs> {
  const [ev] = await db
    .select({ patientId: evaluations.patientId })
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId))
    .limit(1);
  if (!ev) return VACIO;
  return insumosDeLaCnvs({ patientId: ev.patientId, excluyendo: evaluationId });
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// "LA ANTERIOR" ES LA ULTIMA QUE **OCURRIO**, NO LA ULTIMA CREADA  ·  Santiago, 2026-11-09
//
// ═══ EL CASO QUE LO FIJA ═══
//
// Santiago CERRO una consulta de seguimiento porque el paciente no vino, y emitio otro enlace de
// seguimiento: el S1 ya no aparecio. La consulta cerrada era la ultima creada, asi que se leia como
// "la anterior", y una consulta a la que el paciente no vino no tiene respuestas ni tratamiento: ni la
// precarga del bloque de confirmacion ni la lista del S1 tenian de donde salir.
//
// ═══ LOS DOS ESTADOS QUE NO CUENTAN, Y POR QUE ESTAN FUERA ═══
//
//   · `abandoned`: el shell que se CIERRA porque el paciente no vino o no respondio. El profesional lo
//     aplica a mano desde la ficha, y lo que afirma es justamente que esa consulta no ocurrio.
//   · `awaiting_survey`: firmado y sin responder. Todavia no ha pasado nada que se le pueda recordar.
//
// Y las retiradas y las reemplazadas ya estaban fuera desde el 2026-11-08, por la misma razon.
//
// ═══ Y SON **DOS** ANTERIORES, PORQUE SON DOS PREGUNTAS DISTINTAS ═══
//
// Su peticion es *"la ultima consulta que OCURRIO y tiene tratamiento"*, y las dos mitades no siempre
// caen en la misma consulta:
//
//   · LAS RESPUESTAS (la precarga de la confirmacion y el salto digestivo de su §7.2) salen de la
//     ultima que OCURRIO, tenga ruta o no: son lo que el paciente contesto la vez pasada.
//   · LOS PRODUCTOS (el S1 y el S2) salen de la ultima que ocurrio Y TIENE TRATAMIENTO, porque la
//     pregunta es por la adherencia a una INDICACION, y una consulta sin ruta no indico nada.
//
// MEDIDO EN LA NUBE (2026-11-09), sobre los 31 pacientes con dos o mas consultas vigentes y sus 37
// pares (consulta, su anterior):
//   · la regla de ayer elegia una consulta que NO ocurrio en 10 de los 37;
//   · exigir tratamiento cambia la eleccion en 6 de los 37, y en esos 6 la que se descarta SI tiene
//     respuestas. Si se exigiera tratamiento tambien para las respuestas, esos seis pacientes
//     perderian la precarga entera: es la medicion por la que son dos picks y no uno.
//
// SIGUE SIENDO UNA SOLA DEFINICION, que es lo que pidio: una funcion ordena las candidatas y
// `elegirLasAnteriores` hace las dos elecciones sobre esa misma lista. Dos RESOLUCIONES separadas de
// "la anterior" es como se consigue que la precarga y el S1 acaben hablando de consultas distintas sin
// que nadie lo haya decidido (ver la nota de `nutraceuticos-de-la-anterior-reader`).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * LOS ESTADOS EN QUE UNA CONSULTA OCURRIO. Los otros dos (`awaiting_survey`, `abandoned`) no son
 * consultas del paciente: son un shell que espera y un shell que se cerro.
 */
export const ESTADOS_QUE_OCURRIERON = ["draft", "in_progress", "completed"] as const;

export type CandidataAAnterior = {
  id: string;
  /** Si esa consulta llego a tener ruta de atencion. Sin ruta no hay indicacion por la que preguntar. */
  tieneTratamiento: boolean;
};

export type ConsultasAnteriores = {
  /** La ultima que OCURRIO: de ella salen las respuestas (confirmacion y salto digestivo). */
  paraLasRespuestas: { id: string } | null;
  /** La ultima que ocurrio Y TIENE TRATAMIENTO: de ella sale la lista del S1 y del S2. */
  paraLosProductos: { id: string } | null;
};

/**
 * LAS DOS ELECCIONES, sobre las candidatas YA ORDENADAS de mas reciente a mas vieja.
 *
 * SEPARADA Y PURA PARA PODER COMPROBARLA sin base: la regla es lo que hay que fijar, y un candado que
 * solo mire el resultado de la consulta no distingue una regla correcta de unos datos que la cumplen.
 */
export function elegirLasAnteriores(candidatas: CandidataAAnterior[]): ConsultasAnteriores {
  const respuestas = candidatas[0] ?? null;
  const productos = candidatas.find((c) => c.tieneTratamiento) ?? null;
  return {
    paraLasRespuestas: respuestas ? { id: respuestas.id } : null,
    paraLosProductos: productos ? { id: productos.id } : null,
  };
}

/**
 * LAS CONSULTAS ANTERIORES VIGENTES de un paciente: la de las respuestas y la de los productos.
 *
 * EXPORTADA PARA PODER COMPROBARLA: desde fuera de `insumosDeLaCnvs` solo se ven sus respuestas, y un
 * candado que mire el resultado no distingue "eligio la anterior" de "eligio otra parecida".
 */
export async function consultasAnterioresVigentes(input: {
  patientId: string;
  /** La consulta de HOY, para excluirla y para poner el techo. `null` cuando todavia no existe. */
  excluyendo: string | null;
}): Promise<ConsultasAnteriores> {
  const condiciones = [
    eq(evaluations.patientId, input.patientId),
    isNull(evaluations.supersededAt),
    isNull(evaluations.retiradaAt),
    // La mitad de hoy: una consulta cerrada o sin responder no ocurrio (ver la nota de arriba).
    inArray(evaluations.status, [...ESTADOS_QUE_OCURRIERON]),
  ];
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // "LA ANTERIOR" ES ANTERIOR **EN EL TIEMPO**, NO SOLO DISTINTA  ·  medido el 2026-11-09
  //
  // ═══ QUE PASABA CON SOLO EXCLUIRLA ═══
  //
  // Esto era `id <> la de hoy` y nada mas, o sea "la ultima consulta vigente del paciente que no sea
  // esta". Mientras lo llamaba solo el momento de CREAR el shell daba lo correcto, porque entonces la de
  // hoy ES la ultima y no hay ninguna despues.
  //
  // PERO AHORA LO LLAMAN TAMBIEN LAS PANTALLAS DEL PROFESIONAL sobre una consulta YA GUARDADA (la vista
  // de la encuesta, la de completarla y la tarjeta de seguimiento, para resolver el nombre de los
  // productos del S1). Abrir una consulta de la semana pasada leia como "anterior" la de ayer, que es
  // POSTERIOR. Medido en la nube con el paciente del smoke: la consulta de las 10:43 tenia como
  // "anterior" la de las 11:54 del dia siguiente.
  //
  // Y FALLA EN SILENCIO: el S1 resolveria sus nombres contra el tratamiento de una consulta que ese dia
  // no existia, asi que los productos saldrian sin nombre, y el bloque de confirmacion precargaria
  // respuestas del futuro.
  //
  // ES LA MISMA REGLA QUE `corte-de-la-serie` ya aplica a los graficos de seguimiento, y por la misma
  // razon: lo posterior a una consulta no es parte de lo que esa consulta sabia.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  if (input.excluyendo) {
    condiciones.push(ne(evaluations.id, input.excluyendo));
    const [deHoy] = await db
      .select({ creadaEn: evaluations.createdAt })
      .from(evaluations)
      .where(eq(evaluations.id, input.excluyendo))
      .limit(1);
    // SIN LA FECHA NO SE PONE TECHO: la consulta no existe (o no se pudo leer), y el peor caso tiene que
    // ser el de antes, no quedarse sin insumos.
    if (deHoy?.creadaEn) condiciones.push(lt(evaluations.createdAt, deHoy.creadaEn));
  }

  // TODAS LAS CANDIDATAS EN ORDEN, no solo la primera: la de los productos puede no ser la primera.
  // Son las consultas de UN paciente, asi que la lista es de unas pocas filas.
  const candidatas = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .where(and(...condiciones))
    .orderBy(desc(evaluations.createdAt), desc(evaluations.id));
  if (candidatas.length === 0) return { paraLasRespuestas: null, paraLosProductos: null };

  // CUALES TIENEN RUTA. Va en una consulta aparte y por columnas propias e indexadas, no en un
  // `exists` pegado al select de arriba: es la leccion del apagon del 2026-11-09 (una consulta
  // filtrada solo por un embebido hace que la RLS se evalue sobre la tabla entera).
  const conRuta = await db
    .selectDistinct({ evaluationId: diagnoses.evaluationId })
    .from(treatments)
    .innerJoin(diagnoses, eq(diagnoses.id, treatments.diagnosisId))
    .where(
      inArray(
        diagnoses.evaluationId,
        candidatas.map((c) => c.id),
      ),
    );
  const tienenRuta = new Set(conRuta.map((r) => r.evaluationId));
  return elegirLasAnteriores(candidatas.map((c) => ({ id: c.id, tieneTratamiento: tienenRuta.has(c.id) })));
}

/**
 * LA ANTERIOR DE LAS RESPUESTAS, que es la que casi todo el mundo quiere decir con *"la anterior"*.
 *
 * Se conserva como funcion propia porque es la que leen los candados y porque nombrarla asi evita que
 * un llamador nuevo tenga que acordarse de cual de las dos le toca.
 */
export async function consultaAnteriorVigente(input: {
  patientId: string;
  excluyendo: string | null;
}): Promise<{ id: string } | null> {
  return (await consultasAnterioresVigentes(input)).paraLasRespuestas;
}

export async function insumosDeLaCnvs(input: {
  patientId: string;
  /** La consulta de HOY, para excluirla. `null` cuando todavia no existe (el camino publico). */
  excluyendo: string | null;
}): Promise<InsumosDeLaCnvs> {
  const { paraLasRespuestas, paraLosProductos } = await consultasAnterioresVigentes(input);
  // Sin ninguna anterior que haya ocurrido no hay nada que recordar NI por que preguntar.
  if (!paraLasRespuestas && !paraLosProductos) return VACIO;

  // LA RESPUESTA VIGENTE de esa consulta: la ultima fila, que es la regla de la casa. Una correccion
  // escribe un `survey_responses` nuevo, y precargar el viejo mostraria el dato PRE-correccion.
  const [respuesta] = paraLasRespuestas
    ? await db
        .select({ id: surveyResponses.id })
        .from(surveyResponses)
        .where(eq(surveyResponses.evaluationId, paraLasRespuestas.id))
        .orderBy(desc(surveyResponses.createdAt), desc(surveyResponses.id))
        .limit(1)
    : [];

  const anteriores: Record<string, string | null> = {};
  if (respuesta) {
    const filas = await db
      .select({ clave: surveyQuestions.fieldKey, valor: surveyAnswers.answerValue })
      .from(surveyAnswers)
      .innerJoin(surveyQuestions, eq(surveyQuestions.id, surveyAnswers.questionId))
      .where(and(eq(surveyAnswers.responseId, respuesta.id), sql`${surveyQuestions.fieldKey} is not null`));
    for (const f of filas) if (f.clave) anteriores[f.clave] = f.valor;
  }

  return {
    anteriores,
    productos: paraLosProductos ? await nutraceuticosIndicadosEn(paraLosProductos.id) : [],
  };
}
