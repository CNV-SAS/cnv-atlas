import "server-only";

import { FREQ_OPC, FREQ_SUP } from "@/clinical-engine/frozen/engine.patron.js";
import { resumenDietaParrafo } from "@/clinical-engine/resumen-dieta";
import {
  resumenEjercicioParrafo,
  resumenMedicoParrafo,
  resumenPsicoParrafo,
} from "@/clinical-engine/resumen-profesion";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Parrafo de dieta del Resumen Clinico (pieza 1b). Reconstruye la encuesta (enc) de la evaluacion y corre
// resumenDietaParrafo. DISPLAY-ONLY: se computa al vuelo, no se sella (como el resto de la lectura del
// resumen). Todo por RLS (regla 3), como las demas lecturas del profesional.
//
// FORMA DEL enc: la funcion lee los campos de FRECUENCIA (d1_N_i, d1f_*) como INDICE 0-4, pero survey_answers
// guarda el TEXTO. Se convierte texto->ordinal con la MISMA TABLA del motor de patron (FREQ_OPC para los 15
// grupos, FREQ_SUP para los 3 horarios): una sola tabla de conversion, no dos que puedan divergir (su
// acoplamiento lo guarda patron-coupling, y por reusarla, un cambio de texto truena por AMBOS consumidores).
// Los campos de CONTEXTO (d8_*) quedan como TEXTO crudo; los contadores (d7_*) como el texto numerico (toNum).

// Tabla texto->ordinal por field_key de frecuencia (el orden ES el ordinal), identica a la CANON de patron.ts.
const FREQ_CANON: Record<string, string[]> = { ...Object.fromEntries(FREQ_SUP.map((s) => [s.key, s.opts])) };
for (let i = 1; i <= 15; i++) FREQ_CANON[`d1_${i}_i`] = FREQ_OPC;

// CONSTRUCTOR UNICO DEL `enc`, compartido por el parrafo de dieta y los tres por profesion. Dos
// constructores serian dos fuentes del mismo dato sin nada que las compare, que es como se cuelan las
// divergencias silenciosas. Devuelve null si la evaluacion no tiene respuestas.
async function buildEnc(
  evaluationId: string,
  sexo: string,
): Promise<Record<string, unknown> | null> {
  const supabase = await createSupabaseServerClient();

  const { data: response, error: rErr } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rErr) throw new Error(`dieta-resumen-reader: survey_responses: ${rErr.message}`);
  if (!response) return null;

  const { data: rows, error: aErr } = await supabase
    .from("survey_answers")
    .select("answer_value, survey_questions!inner(field_key)")
    .eq("response_id", response.id);
  if (aErr) throw new Error(`dieta-resumen-reader: survey_answers: ${aErr.message}`);

  const enc: Record<string, unknown> = { sexo };
  for (const r of rows ?? []) {
    const q = r.survey_questions as unknown as { field_key: string | null } | null;
    const key = q?.field_key;
    if (!key) continue;
    const value = r.answer_value ?? "";
    const canon = FREQ_CANON[key];
    if (canon) {
      // Frecuencia: texto -> ordinal. -1 (no reconocido) se trata como AUSENTE (null), no como 0: un texto
      // no reconocido NO debe leerse como "Nunca". En la practica el candado de patron impide el -1.
      const ord = canon.indexOf(value);
      enc[key] = ord >= 0 ? ord : null;
    } else {
      enc[key] = value; // contexto (texto) y contadores (texto numerico, toNum lo lee)
    }
  }

  return enc;
}

export async function getDietaResumenForEvaluation(
  evaluationId: string,
  sexo: string,
): Promise<string | null> {
  const enc = await buildEnc(evaluationId, sexo);
  if (!enc) return null;
  const parrafo = resumenDietaParrafo(enc);
  return parrafo === "" ? null : parrafo; // "" = nada legible: se omite (no se muestra un parrafo vacio)
}

// PARRAFO DEL RESUMEN CLINICO SEGUN LA PROFESION DE QUIEN MIRA (su §11c: el resumen del profesional es "el
// de todas las condiciones clinicas a las que se tiene acceso con la encuesta y la composicion corporal").
//
// Reusa el MISMO enc que el parrafo de dieta, con su misma conversion texto->ordinal, y por eso vive aqui y
// no en un reader nuevo: dos constructores del enc serian dos fuentes del mismo dato, y ya sabemos como
// termina eso. Se paga una consulta, no dos.
//
// El del NUTRICIONISTA es el de dieta y ya estaba portado; los otros tres se portaron el 2026-08-29.
export async function getResumenProfesionForEvaluation(
  evaluationId: string,
  sexo: string,
  profession: string | null,
  bis: Record<string, unknown>,
): Promise<string | null> {
  if (!profession) return null;
  if (profession === "nutricionista") return getDietaResumenForEvaluation(evaluationId, sexo);

  const fn =
    profession === "medico"
      ? resumenMedicoParrafo
      : profession === "entrenador"
        ? resumenEjercicioParrafo
        : profession === "psicologo"
          ? resumenPsicoParrafo
          : null;
  if (!fn) return null;

  const enc = await buildEnc(evaluationId, sexo);
  if (!enc) return null;
  const parrafo = fn(enc, bis);
  return parrafo === "" ? null : parrafo;
}
