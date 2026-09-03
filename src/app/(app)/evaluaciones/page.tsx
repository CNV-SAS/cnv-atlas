import Link from "next/link";
import { redirect } from "next/navigation";

import { TituloPantalla, TituloSeccion } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { BisImportForm } from "@/modules/bis/components/bis-import-form";
import { listEvaluationsForBisImport } from "@/modules/bis/data/bis-evaluations-reader";
import { PipelineRunner } from "@/modules/clinical-pipeline/components/pipeline-runner";
import { listEvaluationsForDiagnosis } from "@/modules/clinical-pipeline/data/pipeline-evaluations-reader";
import { ReportCard } from "@/modules/reports/components/report-card";
import { listReports } from "@/modules/reports/data/reports-repository";
import { AwaitingSurveyList } from "@/modules/evaluations/components/awaiting-survey-list";
import { ConsultorioLink } from "@/modules/evaluations/components/consultorio-link";
import {
  listAwaitingSurveyEvaluations,
  listPendingIdentityChecks,
} from "@/modules/evaluations/data/evaluations-repository";
import {
  canConfirmIdentity,
  canEmitFollowupLink,
} from "@/modules/evaluations/policies/can-manage-evaluations";

export const metadata = { title: "Evaluaciones - Atlas" };

// Panel del profesional: evaluaciones recien llegadas de la encuesta, pendientes de
// confirmar la identidad del paciente. Para las iniciales se recomputan los posibles
// duplicados (con score) para que el profesional decida con la informacion a la vista.
export default async function EvaluacionesPage() {
  const user = await requireUser();
  if (!canConfirmIdentity(user) && !canEmitFollowupLink(user)) {
    redirect("/no-autorizado");
  }

  const [pending, bisPending, diagnosisPending, reports, awaitingSurvey] = await Promise.all([
    listPendingIdentityChecks(),
    listEvaluationsForBisImport(),
    listEvaluationsForDiagnosis(),
    listReports(),
    listAwaitingSurveyEvaluations(),
  ]);
  // Tiempo de request (pagina dinamica) para la antiguedad de los shells sin responder.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  // En el panel solo los reportes con accion pendiente (borrador o aprobado); los
  // enviados se consultan en /reportes.
  const pendingReports = reports.filter((r) => r.status !== "sent");
  // Los duplicados YA NO se computan aqui: la confirmacion (con su alerta de duplicados) se movio DENTRO de
  // la evaluacion (Santiago 2026-08-15, c). La lista sigue siendo la COLA, pero cada pendiente lleva a la
  // evaluacion, donde se revisa y confirma. Asi el profesional no pierde el "tienes N por confirmar".

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* EL TITULO DE LA PAGINA ES LA SECCION, no el bloque que hay dentro. Antes el h1 decia "Evaluaciones
          por confirmar", que es el nombre de UNA de las dos partes de esta pantalla (la otra es el enlace
          de consultorio). Ahora la pagina se llama como la seccion y "Por confirmar" baja a titulo de
          bloque, que es lo que es.
          (La razon original citaba ademas que discrepaba del rotulo de la barra superior; ese rotulo se
          retiro el 2026-09-03 y la pagina es hoy el UNICO sitio que dice donde estas.) */}
      <TituloPantalla
        titulo="Evaluaciones"
        descripcion="Revisa la identidad de cada paciente y confirma para continuar la atención."
      />

      {/* Link/QR base de consultorio (get-or-create del profesional), arriba del panel. */}
      <ConsultorioLink />

      <section className="flex flex-col gap-3">
        <TituloSeccion>Por confirmar</TituloSeccion>

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay evaluaciones pendientes de confirmar.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((e) => (
              // Fila compacta que LLEVA a la evaluacion, donde se revisa y confirma (c). El conflicto de
              // identidad se marca aqui, pero se resuelve alla (con los dos nombres a la vista).
              <Link
                key={e.evaluationId}
                href={`/evaluaciones/${e.evaluationId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {e.firstName} {e.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {e.documentType} {e.documentNumber} ·{" "}
                    {e.type === "inicial" ? "Evaluación inicial" : "Seguimiento"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {e.identityConflict ? (
                    <span className="rounded-md bg-clinical-warning-bg px-2 py-0.5 text-xs font-semibold text-clinical-warning">
                      Conflicto de identidad
                    </span>
                  ) : null}
                  <span className="text-sm font-medium text-primary">Revisar y confirmar</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <TituloSeccion>Mediciones BIS por importar</TituloSeccion>
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
          <TituloSeccion>Generar diagnostico</TituloSeccion>
          <p className="text-muted-foreground">
            Con la medicion BIS importada, genera indicadores, diagnostico y reporte con
            el motor real ANI-BIS-E. Luego revisa los resultados y la Diana.
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
          <TituloSeccion>Reportes por aprobar y enviar</TituloSeccion>
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
                  evaluationId: r.evaluationId,
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

      {/* Seguimiento operativo (NO accion clinica): shells firmados sin responder. Al fondo y discreto
          para no competir con las cuatro colas de arriba. Se oculta solo si esta vacia. */}
      <AwaitingSurveyList items={awaitingSurvey} nowMs={nowMs} />
    </div>
  );
}
