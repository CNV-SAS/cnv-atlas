import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { computeCelularBadges, type CelularBadges } from "./celular-badges";

// SIN LLAMADOR DESDE EL 2026-09-07, A PROPOSITO, no por descuido (cotejo con Gildardo, punto 10): las
// badges celulares eran un duplicado de filas que ya estan en la tabla de Wang de Diagnostico, asi que la
// pagina dejo de montar la seccion. El porque y lo que se pierde (el ECM/BCM, el unico de los cuatro sin
// fila propia) estan en DIVERGENCIAS.md y en `celular-section.tsx`. NO se retira porque hay una pregunta
// abierta a Gildardo: si las quiere de vuelta, re-cablearlo es una linea. Esto es ausencia declarada, no
// codigo muerto, y la diferencia entre las dos es justamente que esta escrito.
//
// Lee los crudos BIS de la medicion (misma fuente e RLS que la composicion de Diagnostico:
// bis_raw_values, gateada por is_patient_professional) + el sexo del paciente, y computa las badges
// de salud celular del panel de Tratamiento. Solo display; no toca snapshot ni prescripcion.
//
// Devuelve null en los dos casos en que no hay nada que evaluar: cuando no hay medicion BIS, y cuando el
// paciente no tiene un sexo registrado valido (los cuatro cortes celulares son sexo-especificos, asi que
// sin ese dato no hay badge posible, solo una inventada).
//
// Si hay medicion y hay sexo pero faltan las columnas celulares, computeCelularBadges marca
// dataAvailable=false ("no se pudo evaluar"), que NO es lo mismo que "sin alteraciones".

export type { CelularBadges } from "./celular-badges";

export async function getCelularBadgesForEvaluation(
  evaluationId: string,
): Promise<CelularBadges | null> {
  const supabase = await createSupabaseServerClient();

  const { data: meas, error: mErr } = await supabase
    .from("bis_measurements")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mErr) throw new Error(`celular-badges-reader: bis_measurements: ${mErr.message}`);
  if (!meas) return null;

  // Sexo del paciente (para cAF y el umbral sexo-especifico). Via evaluacion -> perfil, bajo RLS.
  const { data: ev, error: eErr } = await supabase
    .from("evaluations")
    .select("patient_id")
    .eq("id", evaluationId)
    .maybeSingle();
  if (eErr) throw new Error(`celular-badges-reader: evaluations: ${eErr.message}`);
  if (!ev) return null;
  const { data: profile, error: pErr } = await supabase
    .from("patient_profiles")
    .select("sex")
    .eq("patient_id", ev.patient_id)
    .maybeSingle();
  if (pErr) throw new Error(`celular-badges-reader: patient_profiles: ${pErr.message}`);
  // SIN EL SEXO NO SE ADIVINA, Y AQUI SE ADIVINABA (2026-10-10). Esta linea decia
  // `!(profile?.sex ?? "").toLowerCase().startsWith("f")`, asi que CUALQUIER ausencia caia en masculino y
  // las cuatro badges se evaluaban con los umbrales del hombre, en silencio. Los cuatro cortes de salud
  // celular son sexo-especificos igual que los del motor, asi que el dato que falta no es un detalle de
  // presentacion: es la diferencia entre una badge correcta y una equivocada sobre una paciente.
  //
  // SE DEVUELVE null (la seccion no se rinde) por lo mismo que cuando no hay medicion BIS: ninguna badge
  // es mejor que una badge con el sexo inventado. Y el sitio donde el profesional tiene que ENTERARSE de
  // que falta ya existe y es otro: la puerta del diagnostico (`sexoParaDiagnosticar`), que lo manda a la
  // ficha a completarlo. Si esto se re-cablea, no hay que inventar un aviso nuevo.
  const sexoRegistrado = (profile?.sex ?? "").trim().toUpperCase();
  if (sexoRegistrado !== "F" && sexoRegistrado !== "M") return null;
  const sexoM = sexoRegistrado === "M";

  const { data: rows, error: rErr } = await supabase
    .from("bis_raw_values")
    .select("variable_name, value")
    .eq("measurement_id", meas.id);
  if (rErr) throw new Error(`celular-badges-reader: bis_raw_values: ${rErr.message}`);

  const raw: Record<string, number> = {};
  for (const r of rows ?? []) {
    const v = Number(r.value);
    if (Number.isFinite(v)) raw[r.variable_name] = v;
  }

  return computeCelularBadges(raw, sexoM);
}
