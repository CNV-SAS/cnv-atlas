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

  // Fecha de la MEDICION de esta consulta: es el ancla clinica de la sugerencia.
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
    citaSugerida: fechaSugerida(fechaMedicion, ruta?.frecuencia ?? null),
    fechaMedicion,
    puedeGuardar: Boolean(t?.id),
  };
}
