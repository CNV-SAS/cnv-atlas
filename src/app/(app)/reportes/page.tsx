import { redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { ReportCard } from "@/modules/reports/components/report-card";
import { listReports } from "@/modules/reports/data/reports-repository";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";

export const metadata = { title: "Reportes - Atlas" };

// Listado de reportes del profesional (RLS): borrador, aprobado y enviado. Las
// acciones (aprobar/enviar) y el preview viven en la propia tarjeta.
export default async function ReportesPage() {
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const reports = await listReports();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Reportes</h1>
        <p className="text-muted-foreground">
          Reportes clínicos del paciente: borradores, aprobados y enviados. Los enviados quedan
          aquí como registro permanente.
        </p>
      </header>

      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aun no hay reportes.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((r) => (
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
    </div>
  );
}
