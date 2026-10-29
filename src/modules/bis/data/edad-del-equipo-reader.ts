import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { discordanciaDeEdad, type DiscordanciaDeEdad } from "@/clinical-engine/edad-discordante";
import { edadSiSePuede } from "@/modules/clinical-pipeline/services/build-engine-input";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA EDAD QUE EL EQUIPO REGISTRO EN LA TOMA  ·  LECTURA (regla dura 1)
//
// ═══ POR QUE HAY QUE IR A BUSCARLA ═══
//
// La columna `Edad` del BiodyXpert SI llega y SI se guarda en `bis_raw_values`, pero NO esta en
// `BIODY_COLUMNS`, asi que el motor nunca la lee: no es un insumo del calculo (la edad del calculo sale de
// la fecha de nacimiento, que es lo que su error 6 pide). O sea que estaba en la base, entera, y nadie la
// miraba. Su error 5 es justo lo que se ve al mirarla.
//
// ═══ LA EDAD DE LA FICHA SE CALCULA CON LA MISMA FUNCION QUE EL MOTOR ═══
//
// `edadSiSePuede`, no una copia: si aqui se escribiera otra lectura de la fecha, el aviso compararia una
// edad que el motor no usa, y entonces podria avisar de una discordancia que el calculo no tiene (o
// callarse sobre una que si). Dos definiciones de "edad" en la casa acaban diciendo que el mismo paciente
// tiene dos edades, que es literalmente el defecto que esto vigila.
//
// Y A LA FECHA DE LA MEDICION, como el motor: la edad de la ficha el dia de la toma, no la de hoy.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El `variable_name` con el que queda guardada la edad del equipo (encabezado normalizado). */
const VARIABLE_EDAD_DEL_EQUIPO = "Edad";

/**
 * La discordancia de edad de esta consulta, o `null` si no hay ninguna que avisar.
 *
 * `null` tambien cuando falta cualquiera de las dos edades o no hay medicion: no se afirma que dos cosas
 * no coinciden si una no se tiene.
 */
export async function edadDiscordanteDeLaConsulta(
  evaluationId: string,
): Promise<DiscordanciaDeEdad | null> {
  const supabase = await createSupabaseServerClient();

  // La medicion VIGENTE de esta evaluacion, con la fecha de la toma y la fecha de nacimiento del
  // paciente. Va con el HINT del embed anidado porque `evaluations` se referencia desde varias tablas.
  const { data, error } = await supabase
    .from("bis_measurements")
    .select(
      "id, measurement_date, evaluations!inner(id, patients!inner(patient_profiles!inner(birth_date)))",
    )
    .eq("evaluation_id", evaluationId)
    .order("measurement_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const nacimiento =
    (data.evaluations as { patients?: { patient_profiles?: { birth_date?: string | null } } } | null)
      ?.patients?.patient_profiles?.birth_date ?? null;
  const fechaDeLaToma = data.measurement_date ? new Date(data.measurement_date) : null;
  if (!fechaDeLaToma || Number.isNaN(fechaDeLaToma.getTime())) return null;

  const edadDeLaFicha = edadSiSePuede(nacimiento, fechaDeLaToma);
  if (edadDeLaFicha == null) return null;

  const { data: fila } = await supabase
    .from("bis_raw_values")
    .select("value")
    .eq("measurement_id", data.id)
    .eq("variable_name", VARIABLE_EDAD_DEL_EQUIPO)
    .maybeSingle();
  // `numeric` llega como cadena: "43.95" no es un numero hasta que se convierte.
  const edadDelEquipo = fila?.value != null ? Number(fila.value) : null;

  return discordanciaDeEdad(edadDeLaFicha, edadDelEquipo);
}
