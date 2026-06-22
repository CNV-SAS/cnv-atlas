import { redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { BisImportForm } from "@/modules/bis/components/bis-import-form";
import { listEvaluationsForBisImport } from "@/modules/bis/data/bis-evaluations-reader";
import { PipelineRunner } from "@/modules/clinical-pipeline/components/pipeline-runner";
import { listEvaluationsForDiagnosis } from "@/modules/clinical-pipeline/data/pipeline-evaluations-reader";
import { ReportCard } from "@/modules/reports/components/report-card";
import { listReports } from "@/modules/reports/data/reports-repository";
import {
  IdentityConfirmation,
  type DuplicateCandidateView,
} from "@/modules/evaluations/components/identity-confirmation";
import { listPendingIdentityChecks } from "@/modules/evaluations/data/evaluations-repository";
import {
  canConfirmIdentity,
  canEmitFollowupLink,
} from "@/modules/evaluations/policies/can-manage-evaluations";
import {
  findDuplicateCandidates,
  getPatientIdentityById,
} from "@/modules/patients/data/patients-intake";
import { findDuplicatesForPatient } from "@/modules/patients/services/identity-resolution";

export const metadata = { title: "Evaluaciones - Atlas" };

// Panel del profesional: evaluaciones recien llegadas de la encuesta, pendientes de
// confirmar la identidad del paciente. Para las iniciales se recomputan los posibles
// duplicados (con score) para que el profesional decida con la informacion a la vista.
export default async function EvaluacionesPage() {
  const user = await requireUser();
  if (!canConfirmIdentity(user) && !canEmitFollowupLink(user)) {
    redirect("/no-autorizado");
  }

  const [pending, bisPending, diagnosisPending, reports] = await Promise.all([
    listPendingIdentityChecks(),
    listEvaluationsForBisImport(),
    listEvaluationsForDiagnosis(),
    listReports(),
  ]);

  // En el panel solo los reportes con accion pendiente (borrador o aprobado); los
  // enviados se consultan en /reportes.
  const pendingReports = reports.filter((r) => r.status !== "sent");

  // Duplicados solo para iniciales (en seguimiento el paciente ya quedo resuelto por
  // documento). Se computan en paralelo, via service role (cruzan toda la org).
  const dupDeps = { getPatientIdentityById, findDuplicateCandidates };
  const candidatesByPatient = new Map<string, DuplicateCandidateView[]>();
  await Promise.all(
    pending
      .filter((e) => e.type === "inicial")
      .map(async (e) => {
        const dups = await findDuplicatesForPatient(dupDeps, e.patientId);
        if (dups.length > 0) candidatesByPatient.set(e.patientId, dups);
      }),
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Evaluaciones por confirmar
          </h1>
          <p className="text-muted-foreground">
            Revisa la identidad de cada paciente y confirma para continuar la atencion.
          </p>
        </header>

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay evaluaciones pendientes de confirmar.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((e) => (
              <IdentityConfirmation
                key={e.evaluationId}
                evaluation={e}
                duplicateCandidates={candidatesByPatient.get(e.patientId) ?? []}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Mediciones BIS por importar
          </h2>
          <p className="text-muted-foreground">
            Sube el XLSX exportado de Biody Manager para cada evaluacion con la
            identidad ya confirmada.
          </p>
        </header>

        {bisPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay evaluaciones listas para importar BIS.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {bisPending.map((e) => (
              <BisImportForm key={e.evaluationId} evaluation={e} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Generar diagnostico
          </h2>
          <p className="text-muted-foreground">
            Con la medicion BIS importada, genera indicadores, diagnostico, tratamiento
            y reporte (motor stub hasta la entrega del modelo final).
          </p>
        </header>

        {diagnosisPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay evaluaciones listas para generar diagnostico.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {diagnosisPending.map((e) => (
              <PipelineRunner key={e.evaluationId} evaluation={e} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Reportes por aprobar y enviar
          </h2>
          <p className="text-muted-foreground">
            Revisa el preview, aprueba (confirma el diagnostico) y envia el reporte al
            paciente. Los enviados quedan en Reportes.
          </p>
        </header>

        {pendingReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay reportes pendientes.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {pendingReports.map((r) => (
              <ReportCard
                key={r.reportId}
                report={{
                  reportId: r.reportId,
                  evaluationType: r.evaluationType,
                  status: r.status,
                  documentLabel: r.documentLabel,
                  patientName: r.patientName,
                  createdAt: r.createdAt,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
