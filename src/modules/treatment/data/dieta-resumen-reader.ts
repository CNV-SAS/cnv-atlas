import "server-only";

import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";
import { FREQ_OPC, FREQ_SUP } from "@/clinical-engine/frozen/engine.patron.js";
import { resumenDietaParrafo } from "@/clinical-engine/resumen-dieta";
import {
  resumenEjercicioParrafo,
  resumenMedicoParrafo,
  resumenPsicoParrafo,
} from "@/clinical-engine/resumen-profesion";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { FilaPrescripcion, PrescripcionNutricional } from "./treatment-view-types";

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

// ─── LA PRESCRIPCIÓN NUTRICIONAL DEL MODELO (motorTratNutri) ────────────────────────────────────────
//
// SU DECISIÓN, textual (respuesta a la ronda del 2026-08-23, §1): *"`motorTratNutri` gobierna la
// prescripción nutricional. Es el que tiene la ciencia actualizada, y el sodio lo demuestra: 1.500 mg en
// hipertensión es lo que sostienen OMS, DASH/NHLBI y AHA/ACC 2025. Los 2.300 del otro motor son el corte
// viejo. Porten las nueve filas de `motorTratNutri`."*
//
// LO QUE ARREGLA, y llevaba ocho días en pantalla: el motor estaba PORTADO (con sus tres correcciones y su
// golden) y NADIE lo llamaba. Las restricciones que veía el nutricionista, y las que viajaban al generador
// de menús, salían de `atlas-protocolo`, el motor que NO gobierna: a un hipertenso le decían **2.300 mg de
// sodio**. Él mismo nos había señalado esa incoherencia en su carta.
//
// UNA SOLA FUENTE PARA LOS DOS CONSUMIDORES (la pantalla y el prompt del menú), a propósito: dos lecturas
// del mismo motor son dos sitios que pueden divergir, y esta pieza existe justamente porque había dos
// motores diciendo cosas distintas.
//
// LO QUE **NO** SE TOCA, Y ES DELIBERADO: las CIFRAS CALÓRICAS. `motorTratNutri` calcula su propio GEB
// (Mifflin siempre, sobre el peso meta) y la cadena que el profesional edita usa Cunningham cuando hay masa
// libre de grasa, que es siempre porque medimos bioimpedancia. Él lo nombró y dijo *"no lo cambien ahora"*.
// Cambiarlo movería el objetivo calórico de TODOS los pacientes, así que se pregunta antes. Aquí se leen
// solo las filas CUALITATIVAS de la prescripción, que son las que él mandó portar y las que estaban mal.
// El tipo vive en el modulo NEUTRO (treatment-view-types): lo consume tambien el panel, que es cliente.

export async function getPrescripcionNutricional(
  evaluationId: string,
  sexo: string,
  bis: Record<string, unknown>,
  /**
   * Peso EFECTIVO de la cadena (`adj_peso_meta ?? pesoCalculo`). Se le pasa al motor como su `peso_meta`
   * para que los gramos de proteína que imprime sean LOS MISMOS que muestra la cadena. Sin esto el motor
   * usaría su propio default (Lorentz) e ignoraría el peso meta que fijó el profesional: dos gramajes del
   * mismo concepto en dos pantallas, que es el defecto que esta pieza vino a cerrar.
   */
  pesoMeta?: number | null,
): Promise<PrescripcionNutricional | null> {
  const enc = await buildEnc(evaluationId, sexo);
  if (!enc) return null;

  const m = motorTratNutri(enc, bis, pesoMeta != null && pesoMeta > 0 ? { peso_meta: pesoMeta } : {}) as {
    tipoEnergia: string;
    protKg: number;
    protG: number;
    sodioMax: number | null;
    grasaSatMax: number | null;
    attrs: string[];
    notas: string[];
    refs: string[];
  };

  // Las filas con cifra, en el mismo formato que ya lee la pantalla y el prompt. `fmtDec` no se usa aquí
  // porque los valores llevan separador de miles y unidad; se escriben como su archivo los imprime.
  // LOS LIMITES van aparte de la proteina objetivo, y no es cosmetico: el motor SIEMPRE devuelve una
  // proteina, asi que meterla entre las restricciones abriria el gate de la IA para todos los pacientes y
  // romperia su §13. Un limite restringe lo que se puede comer; una meta no.
  const limites: FilaPrescripcion[] = [];
  if (m.sodioMax != null) {
    limites.push({
      nombre: "Sodio",
      valor: `< ${m.sodioMax.toLocaleString("es-CO")} mg/día`,
      ref: "OMS; DASH/NHLBI; AHA/ACC 2025",
    });
  }
  if (m.grasaSatMax != null) {
    limites.push({ nombre: "Grasa saturada", valor: `< ${m.grasaSatMax} % del total`, ref: "AHA; ESC/EAS; NLA" });
  }
  const filas: FilaPrescripcion[] = [
    { nombre: "Proteína", valor: `${String(m.protKg).replace(".", ",")} g/kg`, ref: m.refs[0] ?? "ANI BIS-E" },
    ...limites,
  ];

  return {
    tipoEnergia: m.tipoEnergia,
    protKg: m.protKg,
    protG: m.protG,
    sodioMax: m.sodioMax,
    filas,
    limites,
    atributos: m.attrs,
    notas: m.notas,
    referencias: m.refs,
  };
}
