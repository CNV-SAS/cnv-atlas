import "server-only";

import { ENGINE_VERSION } from "@/clinical-engine";
import { huellasRepetidasEnVigentes } from "@/modules/bis/data/huellas-repetidas-reader";
import { edadSiSePuede } from "@/modules/clinical-pipeline/services/build-engine-input";
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
//   · la edad, de `edadSiSePuede` (la misma lectura de la fecha que usan el consentimiento y el motor);
//   · el corte de 18 anos, del FROZEN de la v7 (`eb-bis-v7.js`: `edad < 18 || edad > 100` deja la EB-BIS
//     en "pendiente: edad no valida"), no de un numero escrito aqui.
//
// LO QUE ESTO NO DECIDE, y por eso va al documento de dudas: estas evaluaciones quedan marcadas como
// desfasadas PARA SIEMPRE, porque nadie las va a reemitir nunca. La alternativa seria sellarles la version
// nueva con la EB-BIS en "pendiente", que es lo que el motor haria. Es una pregunta suya.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El corte de la v7, leido del frozen y no escrito aqui. Ver `eb-bis-v7.js`. */
const EDAD_MINIMA_EB_BIS = 18;

export type EvaluacionDesfasada = {
  evaluationId: string;
  /** La version del motor con la que esta sellado su diagnostico vigente. */
  selladaCon: string;
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
      "evaluation_id, engine_version, created_at, evaluations!inner(patients!inner(cuenta_como_de_prueba, patient_profiles(birth_date)), bis_measurements(measurement_date))",
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
      fecha: String(fila.created_at).slice(0, 10),
      esDePrueba: ev?.patients?.cuenta_como_de_prueba === true,
      motivoSinReemitir: porQueNoSePuede({
        huellaRepetida: huellas.has(id),
        nacimiento,
        // Sin medicion no hay fecha de toma; se mide a la del diagnostico, que es lo mas cercano al acto.
        hasta: new Date(String(fechaDeLaToma ?? fila.created_at)),
      }),
    });
  }

  // DESFASADA = su MAYOR no es el de hoy. Se compara el mayor y no la cadena entera porque es el criterio
  // que ya rige la comparabilidad (`docs/VERSIONES.md`): 1.x y 2.x no se comparan, 2.0.0 y 2.1.0 si.
  const mayor = (v: string) => /(\d+)\./.exec(v)?.[1] ?? null;
  const hoy = mayor(ENGINE_VERSION);
  return [...vigentePorEvaluacion.values()]
    .filter((e) => mayor(e.selladaCon) !== hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * El motivo por el que una evaluacion desfasada NO entra al recalculo, o `null` si entra.
 *
 * EL ORDEN IMPORTA Y NO ES ARBITRARIO: se nombra primero lo que hay que RESOLVER (la huella repetida, que
 * es un dato posiblemente del paciente equivocado) y despues lo que es una condicion del paciente (la
 * edad, que no se resuelve). Si una fila tiene las dos cosas, la que hay que mirar es la primera.
 */
function porQueNoSePuede(a: {
  huellaRepetida: boolean;
  nacimiento: string | null;
  hasta: Date;
}): string | null {
  if (a.huellaRepetida) {
    return "Su medición está repetida en otra consulta: hay que resolver a quién pertenece antes de recalcular.";
  }
  const edad = edadSiSePuede(a.nacimiento, a.hasta);
  if (edad === null) {
    return "Sin fecha de nacimiento legible: la edad entra en la EB-BIS, así que no se puede recalcular.";
  }
  if (edad < EDAD_MINIMA_EB_BIS) {
    return `Tenía ${edad} años al medirse: la EB-BIS v7 se calibró desde los ${EDAD_MINIMA_EB_BIS}.`;
  }
  return null;
}
