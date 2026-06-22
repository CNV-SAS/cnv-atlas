import "server-only";

import type { EngineOutput } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lecturas de reportes para la UI autenticada (regla dura 1). Cliente anon + RLS:
// reports_select deja al profesional del paciente (y admin) ver sus reportes. Sirve
// ademas de gate de ownership antes de la escritura por owner: si la sesion no puede
// leer el reporte, getReportDispatch devuelve null.

function one<T>(embed: T | T[] | null | undefined): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
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

export type ReportDispatch = {
  reportId: string;
  evaluationId: string;
  patientId: string;
  status: ReportStatus;
  snapshot: EngineOutput;
  storagePath: string | null;
  patientName: string;
  documentLabel: string;
  email: string | null;
  evaluationDate: string;
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
      "id, evaluation_id, patient_id, status, snapshot, storage_path, created_at, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name), patient_contacts(email))",
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
    storagePath: data.storage_path,
    patientName: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
    documentLabel: `${patient?.document_type ?? ""} ${patient?.document_number ?? ""}`.trim(),
    email: contact?.email ?? null,
    evaluationDate: data.created_at,
  };
}
