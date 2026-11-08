import "server-only";

import { and, desc, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  diagnoses,
  evaluations,
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
 * Los nutraceuticos indicados en la consulta VIGENTE anterior a `evaluationId`, del mismo paciente.
 *
 * Lista vacia = no se le indico ninguno (el caso normal) o no hay consulta anterior.
 */
export async function nutraceuticosDeLaAnterior(
  evaluationId: string,
): Promise<NutraceuticoIndicado[]> {
  const [actual] = await db
    .select({ patientId: evaluations.patientId, createdAt: evaluations.createdAt })
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId))
    .limit(1);
  if (!actual) return [];

  // LA ANTERIOR SE BUSCA POR `created_at` DE LA EVALUACION y no por la fecha de la medicion: la medicion
  // puede faltar (una consulta en curso) y entonces no habria con que ordenar. Lo que se quiere es la
  // consulta previa del paciente, que es un hecho de la agenda.
  const [anterior] = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.patientId, actual.patientId),
        ne(evaluations.id, evaluationId),
        isNull(evaluations.supersededAt),
        isNull(evaluations.retiradaAt),
      ),
    )
    .orderBy(desc(evaluations.createdAt), desc(evaluations.id))
    .limit(1);
  if (!anterior) return [];

  // EL TRATAMIENTO VIGENTE de esa consulta: el ultimo, que es la regla de la casa para todo lo que
  // cuelga de un diagnostico. Un tratamiento anterior es historia sellada, no la indicacion que rige.
  const filas = await db
    .select({
      id: nutraceuticals.id,
      nombre: nutraceuticals.name,
      dosis: treatmentNutraceuticals.dosage,
      treatmentCreatedAt: treatments.createdAt,
    })
    .from(treatmentNutraceuticals)
    .innerJoin(treatments, eq(treatments.id, treatmentNutraceuticals.treatmentId))
    .innerJoin(diagnoses, eq(diagnoses.id, treatments.diagnosisId))
    .innerJoin(nutraceuticals, eq(nutraceuticals.id, treatmentNutraceuticals.nutraceuticalId))
    .where(eq(diagnoses.evaluationId, anterior.id))
    .orderBy(desc(treatments.createdAt));
  if (filas.length === 0) return [];

  const masReciente = filas[0].treatmentCreatedAt;
  const delVigente = filas.filter((f) => f.treatmentCreatedAt === masReciente);

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
