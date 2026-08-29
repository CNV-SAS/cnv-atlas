import "server-only";

import type { EngineOutput } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BAND_TEXT, type EbBand } from "@/modules/followups/services/eb-trajectory";

// TrajectoryConfirmation (usado en anotaciones del reader) vive en el modulo neutro; ver reexport abajo.
import type { TrajectoryConfirmation } from "./reports-view-types";

// Lecturas de reportes para la UI autenticada (regla dura 1). Cliente anon + RLS:
// reports_select deja al profesional del paciente (y admin) ver sus reportes. Sirve
// ademas de gate de ownership antes de la escritura por owner: si la sesion no puede
// leer el reporte, getReportDispatch devuelve null.

function one<T>(embed: T | T[] | null | undefined): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

// P0 Parte 2 (P5): decide QUÉ texto de banda ve el paciente en el PDF (o null = sin sección). Regla,
// en un solo lugar: hay banda sellada Y (banda != 'empeoró', O 'empeoró' confirmado). Un 'empeoró' sin
// confirmar NO se comunica (Gildardo); y la confirmación garantizó la cita, así que confirmado => cita.
export function computePatientBandText(
  trajectory: { band?: string } | null | undefined,
  confirmed: boolean,
  dfiComplete: boolean,
): string | null {
  // Encuesta INCOMPLETA: la banda es cambio de EB-BIS, que se distorsiona con la encuesta a medias -> NO se
  // comunica al paciente (aplicación de D-007). Es la primera compuerta y se recomputa en cada render, así
  // que cubre también los reportes YA SELLADOS con banda sobre datos incompletos (no se reescriben, no la muestran).
  if (!dfiComplete) return null;
  const band = trajectory?.band;
  if (!band) return null;
  if (band === "empeoro" && !confirmed) return null;
  return BAND_TEXT[band as EbBand];
}

export type ReportStatus = "draft" | "approved" | "sent";

export type EvaluationReport = {
  reportId: string;
  status: ReportStatus;
  approvedAt: string | null;
  sentAt: string | null;
  storagePath: string | null;
};

// Reporte del paciente para una evaluacion (el mas reciente). Lo consume el panel.
export async function getReportForEvaluation(
  evaluationId: string,
): Promise<EvaluationReport | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, status, approved_at, sent_at, storage_path")
    .eq("evaluation_id", evaluationId)
    .eq("type", "paciente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`reports-repository: getReportForEvaluation: ${error.message}`);
  if (!data) return null;
  return {
    reportId: data.id,
    status: data.status as ReportStatus,
    approvedAt: data.approved_at,
    sentAt: data.sent_at,
    storagePath: data.storage_path,
  };
}

export type ReportListItem = {
  reportId: string;
  evaluationId: string;
  status: ReportStatus;
  evaluationType: "inicial" | "seguimiento";
  createdAt: string;
  documentLabel: string;
  patientName: string;
};

type ListPatientEmbed = {
  document_type: string;
  document_number: string;
  patient_profiles:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
};

type ListEvaluationEmbed = {
  type: "inicial" | "seguimiento";
  patients: ListPatientEmbed | ListPatientEmbed[] | null;
};

// Reportes del paciente del profesional (RLS). Lo consumen el panel (filtrando los
// pendientes) y la pagina /reportes (todos).
export async function listReports(): Promise<ReportListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, status, evaluation_id, created_at, evaluations!inner(type, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name)))",
    )
    .eq("type", "paciente")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`reports-repository: listReports: ${error.message}`);
  return (data ?? []).map((row) => {
    const evaluation = one<ListEvaluationEmbed>(
      row.evaluations as ListEvaluationEmbed | ListEvaluationEmbed[] | null,
    );
    const patient = one<ListPatientEmbed>(evaluation?.patients ?? null);
    const profile = one(patient?.patient_profiles ?? null);
    return {
      reportId: row.id,
      evaluationId: row.evaluation_id,
      status: row.status as ReportStatus,
      evaluationType: evaluation?.type ?? "inicial",
      createdAt: row.created_at,
      documentLabel: `${patient?.document_type ?? ""} ${patient?.document_number ?? ""}`.trim(),
      patientName: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
    };
  });
}

// TrajectoryConfirmation vive en reports-view-types (modulo neutro) para que la card cliente lo importe
// sin el reader server-only. El reader lo reexporta para el server.
export type { TrajectoryConfirmation } from "./reports-view-types";

export type ReportCardData = ReportListItem & {
  trajectory: TrajectoryConfirmation | null;
  // Cuantas veces salio el MISMO documento despues del primer envio. 0 = solo el envio original.
  resentCount: number;
};

// Reporte del paciente de UNA evaluacion, con los campos que consume la ReportCard. El mas reciente
// (order created_at desc): si una correccion supero a un reporte enviado, se muestra el vigente. Lo
// consume la etapa de Tratamiento como cierre (ST7).
export async function getReportCardForEvaluation(
  evaluationId: string,
): Promise<ReportCardData | null> {
  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("reports")
    .select(
      "id, status, evaluation_id, created_at, trajectory, trajectory_communicated_at, resent_count, evaluations!inner(type, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name)))",
    )
    .eq("type", "paciente")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`reports-repository: getReportCardForEvaluation: ${error.message}`);
  if (!row) return null;
  const evaluation = one<ListEvaluationEmbed>(
    row.evaluations as ListEvaluationEmbed | ListEvaluationEmbed[] | null,
  );
  const patient = one<ListPatientEmbed>(evaluation?.patients ?? null);
  const profile = one(patient?.patient_profiles ?? null);

  const sealed = row.trajectory as { band?: string; ebDelta?: number; provisional?: boolean } | null;
  let trajectory: TrajectoryConfirmation | null = null;
  if (sealed?.band) {
    // proxima_cita solo se necesita cuando hay que confirmar (empeoro): una lectura chica adicional
    // por el camino evaluation -> diagnosis -> treatment, bajo RLS.
    let proximaCita: string | null = null;
    if (sealed.band === "empeoro") {
      const { data: t } = await supabase
        .from("treatments")
        .select("proxima_cita, diagnoses!inner(evaluation_id)")
        .eq("diagnoses.evaluation_id", evaluationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      proximaCita = (t?.proxima_cita as string | null) ?? null;
    }
    trajectory = {
      band: sealed.band as TrajectoryConfirmation["band"],
      ebDelta: sealed.ebDelta ?? 0,
      provisional: sealed.provisional ?? true,
      communicated: row.trajectory_communicated_at != null,
      proximaCita,
    };
  }

  return {
    reportId: row.id,
    evaluationId: row.evaluation_id,
    status: row.status as ReportStatus,
    evaluationType: evaluation?.type ?? "inicial",
    createdAt: row.created_at,
    documentLabel: `${patient?.document_type ?? ""} ${patient?.document_number ?? ""}`.trim(),
    patientName: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
    trajectory,
    resentCount: (row.resent_count as number | null) ?? 0,
  };
}

export type ReportDispatch = {
  reportId: string;
  evaluationId: string;
  patientId: string;
  status: ReportStatus;
  snapshot: EngineOutput;
  professionalNotes: string | null;
  sendMode: string | null;
  storagePath: string | null;
  patientName: string;
  documentLabel: string;
  email: string | null;
  evaluationDate: string;
  // P0 Parte 2 (P5): el TEXTO de la banda que el PACIENTE debe ver en el PDF, o null si no va sección.
  // Regla: hay banda sellada Y (banda != empeoró, O empeoró confirmado). La confirmación garantizó la
  // cita, así que confirmado implica cita. Computado aquí (una sola fuente de la regla); el PDF lo pinta.
  patientBandText: string | null;
  // §6 (Gildardo Q33): cuando el paciente ve un "empeoró", debe ver CUÁNDO lo vuelven a ver. La fecha de
  // la próxima cita vive en el tratamiento (proxima_cita), se lee EN VIVO (no se sella: es la cita
  // vigente) y ya formateada. null salvo que la sección del "empeoró" confirmado se vaya a mostrar.
  patientBandAppointmentDate: string | null;
};

// Formatea una fecha ISO (YYYY-MM-DD) a "10 de agosto de 2026", de cara al paciente. Se parsea POR
// PARTES (no new Date(iso), que a medianoche UTC corre un día). null si no es una fecha válida.
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export function formatAppointmentDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return null;
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}

type PatientEmbed = {
  document_type: string;
  document_number: string;
  patient_profiles:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
  patient_contacts: { email: string | null } | { email: string | null }[] | null;
};

// Todo lo que el preview y el envio necesitan de un reporte: snapshot (para renderizar)
// + datos del paciente (nombre, documento, correo). RLS: null si la sesion no lo posee.
export async function getReportDispatch(reportId: string): Promise<ReportDispatch | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      // La fecha de la EVALUACION sale de su medicion, no del `created_at` del REPORTE. Se suma a la
      // misma consulta: cero consultas nuevas.
      "id, evaluation_id, patient_id, status, snapshot, professional_notes, send_mode, storage_path, created_at, trajectory, trajectory_communicated_at, evaluations!inner(created_at, bis_measurements(measurement_date)), patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name), patient_contacts(email))",
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(`reports-repository: getReportDispatch: ${error.message}`);
  if (!data) return null;
  const patient = one<PatientEmbed>(data.patients as PatientEmbed | PatientEmbed[] | null);
  const profile = one(patient?.patient_profiles ?? null);
  const contact = one(patient?.patient_contacts ?? null);

  const patientBandText = computePatientBandText(
    data.trajectory as { band?: string } | null,
    data.trajectory_communicated_at != null,
    (data.snapshot as { dfi?: { complete?: boolean } }).dfi?.complete === true,
  );
  // §6 (Gildardo Q33): la fecha de la próxima cita se muestra SOLO cuando la sección del "empeoró"
  // confirmado se va a pintar (patientBandText no null y banda 'empeoro'). Lectura chica adicional por
  // evaluation -> diagnosis -> treatment, bajo RLS. Es la cita vigente (en vivo, no sellada).
  const band = (data.trajectory as { band?: string } | null)?.band;
  let patientBandAppointmentDate: string | null = null;
  if (patientBandText && band === "empeoro") {
    const { data: t } = await supabase
      .from("treatments")
      .select("proxima_cita, diagnoses!inner(evaluation_id)")
      .eq("diagnoses.evaluation_id", data.evaluation_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    patientBandAppointmentDate = formatAppointmentDate((t?.proxima_cita as string | null) ?? "");
  }

  return {
    reportId: data.id,
    evaluationId: data.evaluation_id,
    patientId: data.patient_id,
    status: data.status as ReportStatus,
    snapshot: data.snapshot as EngineOutput,
    professionalNotes: data.professional_notes,
    sendMode: data.send_mode,
    storagePath: data.storage_path,
    patientName: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
    documentLabel: `${patient?.document_type ?? ""} ${patient?.document_number ?? ""}`.trim(),
    email: contact?.email ?? null,
    // DEFECTO CORREGIDO (2026-08-29), y era mas grave de lo que parecia: el campo se llama
    // `evaluationDate` y llevaba `data.created_at`, que en esta consulta es el `created_at` del REPORTE.
    // O sea que el PDF y el correo del paciente imprimian, bajo el rotulo de la fecha de la evaluacion, el
    // dia en que alguien genero el reporte. En la BD local eso cambiaba la fecha de 37 de 40 reportes, con
    // diferencias de hasta 35 dias.
    //
    // Ahora sale de la MEDICION de la evaluacion (la cronologia clinica, la regla de
    // `comparison-chronology`), con caida a su `created_at` si aun no se midio, que es exactamente el
    // mismo criterio que la ficha del paciente y la cabecera de la evaluacion. Los tres coinciden.
    //
    // LO YA ENVIADO NO CAMBIA, y no hace falta hacer nada para conseguirlo: un reporte enviado se sirve
    // desde Storage (`storagePath`), es un archivo y no se vuelve a renderizar. Solo cambian los que aun
    // no han salido de la clinica, que es lo que se quiere.
    evaluationDate: fechaDeMedicion(data.evaluations) ?? data.created_at,
    patientBandText,
    patientBandAppointmentDate,
  };
}

// Fecha de MEDICION de la evaluacion del reporte; null si aun no se midio.
function fechaDeMedicion(ev: unknown): string | null {
  const uno = (Array.isArray(ev) ? ev[0] : ev) as
    | { bis_measurements?: { measurement_date?: string | null }[] | null }
    | undefined;
  const fechas = (uno?.bis_measurements ?? [])
    .map((m) => m.measurement_date)
    .filter((d): d is string => Boolean(d));
  return fechas.length ? fechas.sort()[fechas.length - 1] : null;
}
