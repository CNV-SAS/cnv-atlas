import "server-only";

import { ENGINE_VERSION } from "@/clinical-engine";
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
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type EvaluacionDesfasada = {
  evaluationId: string;
  /** La version del motor con la que esta sellado su diagnostico vigente. */
  selladaCon: string;
  /** Fecha del diagnostico vigente, para ordenar y para que se vea de cuando es. */
  fecha: string;
  /** Si su paciente cuenta como de prueba: se muestran, marcadas, y NO se reemiten por defecto. */
  esDePrueba: boolean;
};

export async function evaluacionesDesfasadas(): Promise<EvaluacionDesfasada[]> {
  const supabase = await createSupabaseServerClient();
  // Se piden los diagnosticos con su evaluacion y la marca de prueba del paciente. El tope alto y el
  // orden estable son los de siempre: PostgREST devuelve mil filas y no lo dice.
  const { data, error } = await supabase
    .from("diagnoses")
    .select("evaluation_id, engine_version, created_at, evaluations!inner(patients!inner(cuenta_como_de_prueba))")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`desfasadas-reader: ${error.message}`);

  // UNA POR EVALUACION, LA MAS RECIENTE: el `order` de arriba ya las trae en ese orden, asi que la
  // primera que se ve de cada evaluacion es la vigente. Las demas son historia.
  const vigentePorEvaluacion = new Map<string, EvaluacionDesfasada>();
  for (const fila of data ?? []) {
    const id = fila.evaluation_id as string;
    if (vigentePorEvaluacion.has(id)) continue;
    const ev = fila.evaluations as { patients?: { cuenta_como_de_prueba?: boolean } } | null;
    vigentePorEvaluacion.set(id, {
      evaluationId: id,
      selladaCon: (fila.engine_version as string) ?? "(sin version)",
      fecha: String(fila.created_at).slice(0, 10),
      esDePrueba: ev?.patients?.cuenta_como_de_prueba === true,
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
