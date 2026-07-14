import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  diagnoses,
  diagnosisNotes,
  evaluationNotes,
  evaluations,
  patientProfiles,
  patients,
  treatmentNotes,
  treatments,
} from "@/db/schema";

// Lectura IDENTIFICADA de las notas de UN paciente (Nivel c). Va por owner (Drizzle db,
// BYPASSRLS) a proposito: el acceso identificado NO se abre por RLS relajada (las
// policies de notas solo responden a notes_pseudonymous), se resuelve por esta via de
// servidor, que el service gatea por grant y audita (access.used). Aqui SI se une a la
// PII del paciente (nombre y documento), porque el Nivel c es identificado. La
// autorizacion la verifica el service antes de llamar a este reader; nunca se expone sin
// pasar por alli.

export type IdentifiedPatient = {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
};

export type IdentifiedNote = {
  id: string;
  source: "evaluation" | "diagnosis" | "treatment";
  sourceId: string;
  note: string;
  createdAt: string;
};

export type IdentifiedNotesView = {
  patient: IdentifiedPatient;
  notes: IdentifiedNote[];
};

export async function getIdentifiedNotes(patientId: string): Promise<IdentifiedNotesView | null> {
  // Base en patients (la identidad minima, el documento, siempre existe) con leftJoin a
  // patient_profiles: el nombre es PII complementaria que puede faltar (p. ej. un paciente
  // resuelto por documento antes de completar sus datos demograficos). Un innerJoin haria
  // "desaparecer" al paciente y romperia el Nivel c pese a que existe.
  const [p] = await db
    .select({
      id: patients.id,
      firstName: patientProfiles.firstName,
      lastName: patientProfiles.lastName,
      documentType: patients.documentType,
      documentNumber: patients.documentNumber,
    })
    .from(patients)
    .leftJoin(patientProfiles, eq(patientProfiles.patientId, patients.id))
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!p) return null;

  const [evalNotes, diagNotes, treatNotes] = await Promise.all([
    db
      .select({ id: evaluationNotes.id, sourceId: evaluationNotes.evaluationId, note: evaluationNotes.note, createdAt: evaluationNotes.createdAt })
      .from(evaluationNotes)
      .innerJoin(evaluations, eq(evaluations.id, evaluationNotes.evaluationId))
      .where(eq(evaluations.patientId, patientId)),
    db
      .select({ id: diagnosisNotes.id, sourceId: diagnosisNotes.diagnosisId, note: diagnosisNotes.note, createdAt: diagnosisNotes.createdAt })
      .from(diagnosisNotes)
      .innerJoin(diagnoses, eq(diagnoses.id, diagnosisNotes.diagnosisId))
      .innerJoin(evaluations, eq(evaluations.id, diagnoses.evaluationId))
      .where(eq(evaluations.patientId, patientId)),
    db
      .select({ id: treatmentNotes.id, sourceId: treatmentNotes.treatmentId, note: treatmentNotes.note, createdAt: treatmentNotes.createdAt })
      .from(treatmentNotes)
      .innerJoin(treatments, eq(treatments.id, treatmentNotes.treatmentId))
      .innerJoin(diagnoses, eq(diagnoses.id, treatments.diagnosisId))
      .innerJoin(evaluations, eq(evaluations.id, diagnoses.evaluationId))
      .where(eq(evaluations.patientId, patientId)),
  ]);

  const notes: IdentifiedNote[] = [
    ...evalNotes.map((n) => ({ id: n.id, source: "evaluation" as const, sourceId: n.sourceId, note: n.note, createdAt: n.createdAt.toISOString() })),
    ...diagNotes.map((n) => ({ id: n.id, source: "diagnosis" as const, sourceId: n.sourceId, note: n.note, createdAt: n.createdAt.toISOString() })),
    ...treatNotes.map((n) => ({ id: n.id, source: "treatment" as const, sourceId: n.sourceId, note: n.note, createdAt: n.createdAt.toISOString() })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    patient: {
      id: p.id,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      documentType: p.documentType,
      documentNumber: p.documentNumber,
    },
    notes,
  };
}
