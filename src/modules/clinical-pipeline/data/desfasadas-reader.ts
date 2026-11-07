import "server-only";

import { huellasRepetidasEnVigentes } from "@/modules/bis/data/huellas-repetidas-reader";
import {
  vigenciaEmision,
  type VigenciaEmision,
} from "@/modules/clinical-pipeline/emision-vigencia";
import { motivoParaNoReemitir } from "@/modules/clinical-pipeline/motivo-para-no-reemitir";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE EVALUACIONES ESTAN DESFASADAS DEL MOTOR DE HOY  ·  LECTURA (regla dura 1)
//
// Alimenta la pantalla de recalibracion. La pregunta es la misma que el reporte previo contestaba con un
// script, pero aqui va bajo RLS y SIN datos de paciente: la pantalla es una operacion sobre el historico,
// no una lista de personas.
//
// ═══ LO VIGENTE ES LA ULTIMA FILA ═══
//
// Es el mecanismo de la casa, y por eso esta lectura ORDENA y toma una por evaluacion. Si alguien quita el
// orden, la pantalla puede ofrecer reemitir algo que ya se reemitio.
//
// ═══ Y DICE CUALES NO SE PUEDEN REEMITIR, CON SU MOTIVO (Santiago, 2026-10-29) ═══
//
// *"Dice 392 desfasadas de pacientes reales; tu reporte decia que entran 360. Separa las que NO se pueden
// reemitir (huella repetida, sin fecha de nacimiento, menores de 18), con su motivo y sin poder
// seleccionarse."*
//
// LA DIFERENCIA ENTRE LAS DOS CIFRAS ERA REAL Y LA PANTALLA NO LA DECIA. El reporte previo contesta
// *"¿quien obtiene una EB-BIS v7 nueva?"*; la pantalla contestaba *"¿que diagnostico esta sellado con un
// mayor viejo?"*. Son dos preguntas distintas, las dos correctas, y mostrar solo la segunda hacia que el
// total no cuadrara con el informe que autoriza la operacion. Una pantalla que ofrece mas filas que las
// que el reporte autoriza invita a correr lo que nadie reviso.
//
// LOS TRES MOTIVOS SALEN DE DONDE YA VIVEN, no de una copia:
//   · la huella repetida, de `huellasRepetidasEnVigentes` (el MISMO conjunto que el aviso del profesional,
//     que es el que cuadra pieza por pieza con el anexo A de Gildardo);
//   · la edad y sus dos cortes, de `motivo-para-no-reemitir` (modulo NEUTRO), que lee la fecha con
//     `edadSiSePuede` (la misma del consentimiento y del motor) y los cortes 18 y 100 del FROZEN de la v7.
//
// Y ESA PUERTA SE SACO DE AQUI EL 2026-11-07, por una razon medida: la simulacion del recalculo tiene que
// decir cuantas consultas va a OFRECER esta pantalla, y escribirlo dos veces es como la simulacion acaba
// midiendo un conjunto distinto del que la pantalla ofrece.
//
// LO QUE ESTO NO DECIDE, y por eso va al documento de dudas: estas evaluaciones quedan marcadas como
// desfasadas PARA SIEMPRE, porque nadie las va a reemitir nunca. La alternativa seria sellarles la version
// nueva con la EB-BIS en "pendiente", que es lo que el motor haria. Es una pregunta suya.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type EvaluacionDesfasada = {
  evaluationId: string;
  /** La version del motor con la que esta sellado su diagnostico vigente. */
  selladaCon: string;
  /** Qué dimensiones se movieron desde que se emitió. Es lo que decide si la fila sale en la pantalla. */
  vigencia: VigenciaEmision;
  /** Fecha del diagnostico vigente, para ordenar y para que se vea de cuando es. */
  fecha: string;
  /** Si su paciente cuenta como de prueba: se muestran, plegadas en una linea, y NO se reemiten. */
  esDePrueba: boolean;
  /**
   * Por que NO se puede reemitir, en una frase para la pantalla. `null` = se puede.
   *
   * Es un motivo, no un codigo: quien mira la pantalla tiene que poder entender la exclusion sin
   * consultar una tabla aparte, que es lo que hacia que las 32 de diferencia fueran invisibles.
   */
  motivoSinReemitir: string | null;
};

export async function evaluacionesDesfasadas(): Promise<EvaluacionDesfasada[]> {
  const supabase = await createSupabaseServerClient();
  // Se piden los diagnosticos con su evaluacion, la marca de prueba del paciente, su fecha de nacimiento
  // y la fecha de la medicion (la edad se mide A LA FECHA DE LA TOMA, no a hoy: es la misma regla que
  // cerro "una fecha ilegible que se vuelve edad cero"). El tope alto y el orden estable son los de
  // siempre: PostgREST devuelve mil filas y no lo dice.
  const { data, error } = await supabase
    .from("diagnoses")
    // UN SOLO LITERAL, SIN CONCATENAR. PostgREST tipa el select a partir de la CADENA LITERAL, y un "+"
    // la vuelve un string cualquiera: entonces las filas pasan a GenericStringError y tsc se queja de
    // cada campo. Partirla para que quepa en la linea cuesta la verificacion de tipos entera.
    .select(
      "evaluation_id, engine_version, emission_versions, created_at, evaluations!inner(patients!inner(cuenta_como_de_prueba, patient_profiles(birth_date)), bis_measurements(measurement_date))",
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`desfasadas-reader: ${error.message}`);

  // Las huellas repetidas, en UNA ida a la base para todo el conjunto. No se consulta por fila: la
  // pantalla lista cientos y una consulta por fila la volveria inusable.
  const huellas = await huellasRepetidasEnVigentes();

  // UNA POR EVALUACION, LA MAS RECIENTE: el `order` de arriba ya las trae en ese orden, asi que la
  // primera que se ve de cada evaluacion es la vigente. Las demas son historia.
  const vigentePorEvaluacion = new Map<string, EvaluacionDesfasada>();
  for (const fila of data ?? []) {
    const id = fila.evaluation_id as string;
    if (vigentePorEvaluacion.has(id)) continue;
    const ev = fila.evaluations as {
      patients?: {
        cuenta_como_de_prueba?: boolean;
        patient_profiles?: { birth_date?: string | null } | { birth_date?: string | null }[] | null;
      };
      bis_measurements?: { measurement_date?: string | null }[] | { measurement_date?: string | null } | null;
    } | null;

    // Los embeds de PostgREST vuelven objeto o arreglo segun el shape; misma tolerancia que el resto de
    // la casa. Sin esto, un embed que llega como arreglo deja la fecha en undefined y la fila se
    // excluiria por "sin fecha de nacimiento" siendo mentira, que es el peor de los errores posibles
    // aqui: una exclusion inventada que nadie puede desmentir desde la pantalla.
    const uno = <T,>(x: T | T[] | null | undefined): T | null =>
      Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
    const nacimiento = uno(ev?.patients?.patient_profiles)?.birth_date ?? null;
    const fechaDeLaToma = uno(ev?.bis_measurements)?.measurement_date ?? null;

    vigentePorEvaluacion.set(id, {
      evaluationId: id,
      selladaCon: (fila.engine_version as string) ?? "(sin version)",
      vigencia: vigenciaEmision({
        engineVersion: (fila.engine_version as string) ?? null,
        emissionVersions: (fila.emission_versions as Record<string, unknown> | null) ?? null,
      }),
      fecha: String(fila.created_at).slice(0, 10),
      esDePrueba: ev?.patients?.cuenta_como_de_prueba === true,
      motivoSinReemitir: motivoParaNoReemitir({
        huellaRepetida: huellas.has(id),
        nacimiento,
        // Sin medicion no hay fecha de toma; se mide a la del diagnostico, que es lo mas cercano al acto.
        hasta: new Date(String(fechaDeLaToma ?? fila.created_at)),
      }),
    });
  }

  // ═══ DESFASADA = LO MISMO QUE DICE EL GUARD DE LA REEMISION, Y ANTES ERAN DOS COSAS  ·  2026-11-07 ═══
  //
  // Esto filtraba por MAYOR distinto, y `reemitirDiagnostico` decide con `vigenciaEmision` (la cadena
  // entera del motor mas las claves de `emission_versions`). Dos puertas para la misma pregunta, y ya
  // divergieron: en la nube hay una consulta sellada con **3.1.0** teniendo 3.2.0 vigente. Su mayor es el
  // mismo, asi que la pantalla NO la ofrecia; su version si cambio, asi que el aviso de "emitido con una
  // version anterior" se le queda para siempre y nadie puede quitarlo. El guard la habria aceptado.
  //
  // Ahora la pantalla ofrece exactamente lo que el guard acepta. El mayor sigue decidiendo la
  // COMPARABILIDAD (`docs/VERSIONES.md`, `sonComparables`), que es otra pregunta: si dos emisiones se
  // pueden poner una al lado de la otra. Reemitir no compara nada.
  return [...vigentePorEvaluacion.values()]
    .filter((e) => !e.vigencia.alDia)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

