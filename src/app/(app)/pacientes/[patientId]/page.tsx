import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { getPatientDetail } from "@/modules/patients/data/patient-detail-reader";
import { edadEnAnios, fechaCorta } from "@/modules/patients/format";
import {
  estadoEvaluacionLabel,
  estadoPacienteLabel,
  sexoLabel,
} from "@/modules/patients/labels";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";

export const metadata = { title: "Historia del paciente - Atlas" };

const TIPO_LABEL: Record<string, string> = {
  inicial: "Inicial",
  seguimiento: "Seguimiento",
};

// Historia del paciente: identidad, contacto y linea de tiempo de sus evaluaciones.
// La policy gobierna el rol (regla 3); el alcance fino (que sea su paciente) lo impone la
// RLS en el reader: si no es suyo, getPatientDetail devuelve null -> 404.
export default async function HistoriaPacientePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const user = await requireUser();
  if (!canViewPatients(user)) redirect("/no-autorizado");

  const paciente = await getPatientDetail(patientId);
  if (!paciente) notFound();

  const anos = edadEnAnios(paciente.birthDate);
  const nombre = `${paciente.firstName} ${paciente.lastName}`.trim() || "Sin nombre";
  const datos: { label: string; value: string }[] = [
    { label: "Documento", value: `${paciente.documentType} ${paciente.documentNumber}`.trim() },
    { label: "Edad", value: anos === null ? "-" : `${anos} años` },
    { label: "Sexo", value: sexoLabel(paciente.sex) },
    {
      label: "Ubicación",
      value: [paciente.city, paciente.country].filter(Boolean).join(", ") || "-",
    },
    { label: "Correo", value: paciente.email ?? "-" },
    { label: "Teléfono", value: paciente.phone ?? "-" },
    { label: "Estado", value: estadoPacienteLabel(paciente.status) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/pacientes"
          className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Volver a pacientes
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{nombre}</h1>
        <p className="text-muted-foreground">Historia clínica del paciente.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {datos.map((d) => (
          <div key={d.label} className="flex flex-col gap-1 rounded-xl border border-border p-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</span>
            <span className="text-sm font-medium text-foreground">{d.value}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Evaluaciones</h2>
        {paciente.evaluations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Este paciente todavía no tiene evaluaciones.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 text-right font-semibold">Resultados</th>
                </tr>
              </thead>
              <tbody>
                {paciente.evaluations.map((e) => (
                  <tr key={e.evaluationId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {TIPO_LABEL[e.type] ?? e.type}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {fechaCorta(e.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {estadoEvaluacionLabel(e.status)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/evaluaciones/${e.evaluationId}`}
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        Ver resultados
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
