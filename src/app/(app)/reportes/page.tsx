import { redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
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
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* SUBTITULO RECORTADO. La primera mitad enumeraba los estados ("borradores, aprobados y enviados"),
          que es justo lo que la lista de abajo muestra en cada tarjeta. La segunda dice algo que la
          pantalla NO muestra: que un reporte enviado ya no se puede deshacer. Esa se queda. */}
      <TituloPantalla
        titulo="Reportes"
        descripcion="Los enviados quedan aquí como registro permanente."
      />

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
