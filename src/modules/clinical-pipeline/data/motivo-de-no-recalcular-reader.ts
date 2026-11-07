import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { motivoDeNoReemitir, type MotivoDeNoReemitir } from "../motivo-para-no-reemitir";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTA CONSULTA NO SE PUEDE RECALCULAR  ·  LECTURA (regla dura 1)
//
// ═══ PARA QUE SIRVE, Y CUAL ES EL DEFECTO QUE CIERRA ═══
//
// El aviso ambar de "reemisión obligatoria" le pide a la profesional que reemita. Hay consultas donde esa
// accion NO EXISTE: la pantalla de recalibracion no las ofrece, asi que el aviso no se puede quitar nunca.
// Medido el 2026-11-07, de los 53 ambar que quedaban: 30 de pacientes de prueba, 19 de medicion repetida y
// 4 de menores de edad. Los 4 ultimos no se van a poder reemitir jamas (la EB-BIS v7 se calibro de 18 a
// 100 y fuera de ahi devuelve "pendiente"), asi que su ambar era permanente.
//
// Un freno sin salida no es un guard: detiene a una persona. Con el motivo en la mano, la pantalla puede
// decir la verdad de cada caso en vez de pedir lo imposible.
//
// ═══ LA MISMA PUERTA QUE LA PANTALLA DE RECALIBRACION Y LA SIMULACION ═══
//
// El motivo sale de `motivoDeNoReemitir`, el modulo neutro que ya comparten el panel y la simulacion. Si
// aqui se decidiera por cuenta propia, el aviso podria decir "no se puede recalcular" sobre una consulta
// que la pantalla SI ofrece, o al contrario. Tres lecturas de la misma pregunta, una sola puerta.
//
// ═══ LA HUELLA LLEGA DE AFUERA, A PROPOSITO ═══
//
// Saber si una toma esta repetida exige mirar TODAS las vigentes (`huellasRepetidasEnVigentes`), y la
// pagina de la consulta ya hace esa lectura para su propio aviso. Pedirla aqui otra vez duplicaria la
// parte cara de la consulta mas visitada del sistema.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El motivo por el que esta consulta no entra al recalculo, o `null` si entra (o si no se puede saber).
 *
 * `null` tambien cuando no hay medicion: sin fecha de toma no hay a que fecha medir la edad, y afirmar un
 * motivo sin el dato seria inventarlo. El aviso se queda entonces como estaba.
 */
export async function motivoDeNoRecalcularLaConsulta(a: {
  evaluationId: string;
  huellaRepetida: boolean;
}): Promise<MotivoDeNoReemitir | null> {
  const supabase = await createSupabaseServerClient();

  // La medicion VIGENTE con la fecha de nacimiento del paciente. Misma forma (y mismo hint de embed
  // anidado) que `edadDiscordanteDeLaConsulta`: `evaluations` la referencian varias tablas, y sin el
  // `!inner` el embed queda ambiguo en runtime sin que tsc diga nada.
  const { data, error } = await supabase
    .from("bis_measurements")
    .select(
      "id, measurement_date, evaluations!inner(id, patients!inner(patient_profiles!inner(birth_date)))",
    )
    .eq("evaluation_id", a.evaluationId)
    .order("measurement_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const nacimiento =
    (data.evaluations as { patients?: { patient_profiles?: { birth_date?: string | null } } } | null)
      ?.patients?.patient_profiles?.birth_date ?? null;
  const hasta = data.measurement_date ? new Date(data.measurement_date) : null;
  if (!hasta || Number.isNaN(hasta.getTime())) return null;

  return motivoDeNoReemitir({ huellaRepetida: a.huellaRepetida, nacimiento, hasta });
}
