import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Encabezado de la HISTORIA CLINICA (bloques 1 y 2): datos del paciente y motivo de consulta.
// Bajo RLS: null si la evaluacion no es del profesional de la sesion.
//
// La EDAD se calcula a la fecha de la CONSULTA, no a hoy. Un documento clinico impreso meses despues no
// debe decir la edad de hoy (misma familia del defecto de su prototipo, que fecha la firma con
// `new Date()`). Por eso sale de birth_date + la fecha de la evaluacion, no de un campo suelto.

export type HcHeader = {
  paciente: string;
  edad: number | null;
  sexo: string | null;
  fechaConsulta: string; // ISO; la formatea la vista
  profesional: string;
  motivos: string[];
  /** Proxima cita del tratamiento (bloque 13). En VIVO, no sellada: es la cita vigente. */
  proximaCita: string | null;
};

type PerfilEmbed = { first_name: string | null; last_name: string | null; sex: string | null; birth_date: string | null };
type PacienteEmbed = { patient_profiles: PerfilEmbed | PerfilEmbed[] | null };
type ProfesionalEmbed = { profiles: { full_name: string | null } | { full_name: string | null }[] | null };

const uno = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/** Edad cumplida en una fecha dada. null si falta la fecha de nacimiento. */
export function edadEnFecha(birthDate: string | null, enFecha: string): number | null {
  if (!birthDate) return null;
  const n = new Date(birthDate);
  const f = new Date(enFecha);
  if (Number.isNaN(n.getTime()) || Number.isNaN(f.getTime())) return null;
  let edad = f.getUTCFullYear() - n.getUTCFullYear();
  const mes = f.getUTCMonth() - n.getUTCMonth();
  if (mes < 0 || (mes === 0 && f.getUTCDate() < n.getUTCDate())) edad -= 1;
  return edad >= 0 ? edad : null;
}

export async function getHcHeaderForEvaluation(evaluationId: string): Promise<HcHeader | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select(
      // Hint del FK OBLIGATORIO en professional_profiles -> profiles: hay TRES relaciones (profile_id,
      // rut_verified_by, rut_rejected_by) y un embed sin hint revienta en runtime, no en tsc.
      "created_at, reason_for_visit, patients!inner(patient_profiles!inner(first_name, last_name, sex, birth_date)), professional_profiles!inner(profiles!profile_id!inner(full_name))",
    )
    .eq("id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`hc-header-reader: ${error.message}`);
  if (!data) return null;

  const paciente = uno<PerfilEmbed>(uno<PacienteEmbed>(data.patients as never)?.patient_profiles as never);
  const profesional = uno(uno<ProfesionalEmbed>(data.professional_profiles as never)?.profiles as never) as
    | { full_name: string | null }
    | null;

  const fechaConsulta = data.created_at as string;
  // reason_for_visit se guarda como JSON de opciones elegidas (con "Otro: <texto>" ya resuelto en el
  // intake). Si por cualquier via llega texto plano, se muestra tal cual antes que perderlo.
  const raw = (data.reason_for_visit as string | null) ?? "";
  let motivos: string[] = [];
  if (raw.trim() !== "") {
    if (raw.trim().startsWith("[")) {
      try {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr)) motivos = arr.filter((x): x is string => typeof x === "string" && x.trim() !== "");
      } catch {
        motivos = [raw];
      }
    } else {
      motivos = [raw];
    }
  }

  // La proxima cita vive en el tratamiento; se lee aparte y EN VIVO (no se sella: si el profesional la
  // mueve, la historia debe decir la vigente). Lectura chica por evaluation -> diagnosis -> treatment.
  const { data: t } = await supabase
    .from("treatments")
    .select("proxima_cita, diagnoses!inner(evaluation_id)")
    .eq("diagnoses.evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    paciente: `${paciente?.first_name ?? ""} ${paciente?.last_name ?? ""}`.trim(),
    edad: edadEnFecha(paciente?.birth_date ?? null, fechaConsulta),
    sexo: paciente?.sex ?? null,
    fechaConsulta,
    profesional: profesional?.full_name ?? "",
    motivos,
    proximaCita: (t?.proxima_cita as string | null) ?? null,
  };
}
