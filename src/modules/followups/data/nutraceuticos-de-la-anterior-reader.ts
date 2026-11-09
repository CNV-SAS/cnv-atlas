import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  diagnoses,
  nutraceuticals,
  treatmentNutraceuticals,
  treatments,
} from "@/db/schema";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS NUTRACEUTICOS DE LA CONSULTA ANTERIOR  ·  EL INSUMO DEL S1  ·  v15 §2.3, 2026-11-07
//
// ═══ QUE PIDE ═══
//
// Su S1 se presenta *"una vez por cada nutracéutico"*, y dice de donde sale: *"S1 es dinámico: sale de
// los nutracéuticos registrados en Rutas de atención para el paciente... En ATLAS CNV deben salir de la
// tabla donde guardas las indicaciones o despachos de la consulta anterior."*
//
// ═══ DE LAS INDICACIONES, NO DE LOS DESPACHOS ═══
//
// Su frase deja las dos abiertas y en Atlas no son lo mismo, asi que hay que elegir y decirlo. Se leen
// las INDICACIONES (`treatment_nutraceuticals`), no lo que salio de la bodega, por dos razones:
//
//   · su pregunta es *"¿con qué frecuencia LO TOMÓ?"*, y lo que se le pidio tomar es lo indicado. Un
//     producto que se le indico y NO se le despacho es justamente el caso en que la respuesta importa
//     (se lo compro por fuera, o no se lo compro);
//   · y al reves: un despacho sin indicacion es una venta, no una prescripcion, y preguntar por su
//     adherencia atribuiria al tratamiento algo que el tratamiento no dijo.
//
// ═══ LA CONSULTA ANTERIOR ES LA ANTERIOR **VIGENTE**, no la anterior en el tiempo ═══
//
// Una evaluacion reemplazada por una correccion (`superseded_at`) o retirada (`retirada_at`) no es una
// consulta del paciente: preguntarle por los nutraceuticos de una consulta que se deshizo es pedirle que
// recuerde algo que no paso. Es la misma regla que ya usan la serie de seguimiento y la cronologia.
//
// ═══ Y SI NO HAY NINGUNO, SE DEVUELVE UNA LISTA VACIA, QUE NO ES LO MISMO QUE UN ERROR ═══
//
// Medido el 2026-11-06: de los 30 pacientes con dos o mas consultas, **18 no tienen ningun nutraceutico
// en la anterior**. Es el caso NORMAL, no el borde. La pregunta 34 lo resolvio (decision A): con la
// lista vacia, el S1 y el S2 no se presentan y la adherencia se calcula con el S3 solo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type NutraceuticoIndicado = {
  /** El id del producto, que es la clave con que se guarda su respuesta del S1. */
  id: string;
  /** Su nombre comercial, que es lo que el paciente reconoce. */
  nombre: string;
  /** La posologia indicada, para poder recordarsela al lado de la pregunta. null = no se registro. */
  dosis: string | null;
};

/**
 * Los nutraceuticos indicados EN esa consulta. Lista vacia = no se le indico ninguno (el caso normal).
 *
 * ═══ ES EL PRIMITIVO, Y NO RESUELVE "LA ANTERIOR" ═══
 *
 * Nacio llamandose `nutraceuticosDeLaAnterior` y buscando el mismo la consulta previa del paciente. Al
 * conectarlo (2026-11-08) resulto que quien lo llama YA tiene esa consulta resuelta, porque necesita de
 * ella tambien las respuestas de la encuesta: dos resoluciones de "la anterior" es como se consigue que
 * la precarga del bloque de confirmacion y la lista del S1 acaben hablando de consultas distintas.
 *
 * Asi que quien resuelve cual es la anterior es `insumos-de-la-cnvs`, en un sitio, y esto responde por
 * la consulta que le den.
 */
export async function nutraceuticosIndicadosEn(
  evaluationId: string,
): Promise<NutraceuticoIndicado[]> {
  const anterior = { id: evaluationId };

  // EL TRATAMIENTO VIGENTE de esa consulta: el ultimo, que es la regla de la casa para todo lo que
  // cuelga de un diagnostico. Un tratamiento anterior es historia sellada, no la indicacion que rige.
  const filas = await db
    .select({
      id: nutraceuticals.id,
      nombre: nutraceuticals.name,
      dosis: treatmentNutraceuticals.dosage,
      treatmentId: treatments.id,
      treatmentCreatedAt: treatments.createdAt,
    })
    .from(treatmentNutraceuticals)
    .innerJoin(treatments, eq(treatments.id, treatmentNutraceuticals.treatmentId))
    .innerJoin(diagnoses, eq(diagnoses.id, treatments.diagnosisId))
    .innerJoin(nutraceuticals, eq(nutraceuticals.id, treatmentNutraceuticals.nutraceuticalId))
    .where(eq(diagnoses.evaluationId, anterior.id))
    .orderBy(desc(treatments.createdAt));
  if (filas.length === 0) return [];

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // EL TRATAMIENTO VIGENTE SE FILTRA POR SU **ID**, NO POR SU FECHA  ·  defecto del smoke, 2026-11-09
  //
  // AQUI DECIA `f.treatmentCreatedAt === masReciente`, y `===` entre dos `Date` compara LA REFERENCIA, no
  // el instante: dos filas del MISMO tratamiento llegan con dos objetos `Date` distintos que valen lo
  // mismo, asi que solo la fila 0 (de donde salio `masReciente`) pasaba el filtro.
  //
  // O SEA QUE EL S1 PRESENTABA SIEMPRE UN SOLO PRODUCTO, el primero, aunque la consulta anterior tuviera
  // varios indicados. MEDIDO EN EL SMOKE del 9 de noviembre: la anterior indicaba DOS (MULTI-CELL BASE y
  // OMEGA COMPLEX) y al paciente se le pregunto por uno. Y no falla en voz alta: la pregunta se presenta
  // igual, con un producto menos, asi que la respuesta parece completa y la adherencia se habria calculado
  // sobre la mitad de lo que se le indico.
  //
  // SE FILTRA POR EL ID DEL TRATAMIENTO, que es la definicion exacta de "el tratamiento vigente" y no
  // depende de como se comparen dos marcas de tiempo. Comparar por `getTime()` arreglaria el sintoma, pero
  // dejaria mezclados dos tratamientos sellados en el mismo milisegundo.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const delVigente = filas.filter((f) => f.treatmentId === filas[0].treatmentId);

  // SIN REPETIDOS: el mismo producto indicado dos veces en el mismo tratamiento daria dos filas del S1
  // con la misma clave, y la segunda pisaria a la primera al guardar.
  const vistos = new Set<string>();
  const salida: NutraceuticoIndicado[] = [];
  for (const f of delVigente) {
    if (vistos.has(f.id)) continue;
    vistos.add(f.id);
    salida.push({ id: f.id, nombre: f.nombre, dosis: f.dosis });
  }
  return salida;
}
