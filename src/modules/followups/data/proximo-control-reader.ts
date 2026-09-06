import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { fechaSugerida, rutaPrimaria, type ProximoControlView } from "./proximo-control";

// Lectura del bloque de PROXIMO CONTROL. Bajo RLS: null si la evaluacion no es del profesional.
//
// Las rutas salen del snapshot SELLADO del reporte (rutasContent), no del registro vivo: la frecuencia
// que rige es la que se prescribio ese dia. La cita guardada vive en el tratamiento.

type RutaSellada = { id: string; label: string; seguimiento: { frecuencia: string; criterioEgreso: string } };

export async function getProximoControl(evaluationId: string): Promise<ProximoControlView | null> {
  const supabase = await createSupabaseServerClient();

  const { data: rep, error } = await supabase
    .from("reports")
    .select("snapshot")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`proximo-control-reader: ${error.message}`);
  if (!rep) return null;

  const rutas = ((rep.snapshot as { rutasContent?: RutaSellada[] })?.rutasContent ?? []).filter(
    (r) => r?.seguimiento?.frecuencia,
  );
  const ruta = rutaPrimaria(rutas);

  // EL ANCLA ES LA CONSULTA, NO LA TOMA (cuarto smoke, 2026-09-06). Hasta aqui la sugerencia se contaba
  // desde `bis_measurements.measurement_date`.
  //
  // POR QUE CAMBIA, y la razon es de Santiago: hoy da igual porque la toma se hace EN la consulta, pero
  // el dia que el paciente venga con el BIS hecho dias antes, el intervalo clinico no cuenta desde el
  // aparato: cuenta desde que se le vio. "90 dias despues de ir al medico me toca otra cita". Y ese dia
  // el cambio ya no seria una mejora, seria un defecto con pacientes citados demasiado pronto.
  //
  // ES `created_at` DE LA EVALUACION, que es la misma fecha que muestra la cabecera de la pantalla, asi
  // que la cuenta se puede rehacer a ojo desde lo que se ve. (Queda dicho que la ficha del paciente usa
  // la fecha de MEDICION para ubicar la evaluacion: esa discrepancia es anterior y esta reportada.)
  const { data: evalRow } = await supabase
    .from("evaluations")
    .select("created_at")
    .eq("id", evaluationId)
    .maybeSingle();
  const fechaConsulta = (evalRow?.created_at as string | null) ?? null;

  // La fecha de la MEDICION se sigue leyendo: la vista la expone y la pantalla la usa para decir contra
  // que se cuenta cuando las dos no coinciden.
  const { data: med } = await supabase
    .from("bis_measurements")
    .select("measurement_date")
    .eq("evaluation_id", evaluationId)
    .limit(1)
    .maybeSingle();
  const fechaMedicion = (med?.measurement_date as string | null) ?? null;

  const { data: t } = await supabase
    .from("treatments")
    .select("id, proxima_cita, diagnoses!inner(evaluation_id)")
    .eq("diagnoses.evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ruta,
    citaGuardada: (t?.proxima_cita as string | null) ?? null,
    // Desde la CONSULTA; si por lo que sea no hay fecha de evaluacion, se cae a la de la toma antes que
    // dejar al profesional sin sugerencia.
    citaSugerida: fechaSugerida(fechaConsulta ?? fechaMedicion, ruta?.frecuencia ?? null),
    fechaConsulta,
    fechaMedicion,
    puedeGuardar: Boolean(t?.id),
  };
}
