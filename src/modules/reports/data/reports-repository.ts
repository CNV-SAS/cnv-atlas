import "server-only";

import type { EngineOutput } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BAND_TEXT, type EbBand } from "@/modules/followups/services/eb-trajectory";

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
): string | null {
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

// Datos de la banda de EB-BIS (P0 Parte 2) que la ReportCard necesita para la superficie de
// confirmacion de "empeoro". null si el reporte no tiene banda sellada (inicial o sin previa
// comparable). proximaCita se trae solo cuando band = 'empeoro' (es el gate); prefill del input.
export type TrajectoryConfirmation = {
  band: "mejoro" | "sin_cambio" | "empeoro";
  ebDelta: number;
  provisional: boolean;
  communicated: boolean; // ya confirmada (trajectory_communicated_at no null)
  proximaCita: string | null; // fecha ya agendada en el tratamiento, para prefill del input
};

export type ReportCardData = ReportListItem & { trajectory: TrajectoryConfirmation | null };

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
      "id, status, evaluation_id, created_at, trajectory, trajectory_communicated_at, evaluations!inner(type, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name)))",
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
};

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
      "id, evaluation_id, patient_id, status, snapshot, professional_notes, send_mode, storage_path, created_at, trajectory, trajectory_communicated_at, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name), patient_contacts(email))",
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(`reports-repository: getReportDispatch: ${error.message}`);
  if (!data) return null;
  const patient = one<PatientEmbed>(data.patients as PatientEmbed | PatientEmbed[] | null);
  const profile = one(patient?.patient_profiles ?? null);
  const contact = one(patient?.patient_contacts ?? null);
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
    evaluationDate: data.created_at,
    patientBandText: computePatientBandText(
      data.trajectory as { band?: string } | null,
      data.trajectory_communicated_at != null,
    ),
  };
}
