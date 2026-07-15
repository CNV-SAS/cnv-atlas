import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { listPatientsForProfessional } from "@/modules/patients/data/patients-list-reader";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";

export const metadata = { title: "Pacientes - Atlas" };

// Edad en anos a partir de la fecha de nacimiento (presentacion). Null si no hay fecha.
function edad(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const nacimiento = new Date(birthDate);
  const hoy = new Date();
  let anos = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) anos -= 1;
  return anos;
}

// Roster de pacientes del profesional. Autorizacion de ruta por policy (regla 3); el
// alcance de datos (solo los propios, o todos para admin) lo impone RLS.
export default async function PacientesPage() {
  const user = await requireUser();
  if (!canViewPatients(user)) {
    redirect("/no-autorizado");
  }

  const pacientes = await listPatientsForProfessional();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Pacientes</h1>
        <p className="text-muted-foreground">
          Tus pacientes y el acceso a su historia clinica. Solo ves los pacientes asignados a ti.
        </p>
      </header>

      {pacientes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Todavia no tienes pacientes. Apareceran aqui cuando confirmes la identidad de una
          evaluacion recibida por la encuesta.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Paciente</th>
                <th className="px-3 py-2 font-semibold">Documento</th>
                <th className="px-3 py-2 font-semibold">Edad</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">Evaluaciones</th>
                <th className="px-3 py-2 font-semibold text-right">Historia</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => {
                const anos = edad(p.birthDate);
                return (
                  <tr key={p.patientId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {`${p.firstName} ${p.lastName}`.trim() || "Sin nombre"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {`${p.documentType} ${p.documentNumber}`.trim()}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {anos === null ? "-" : anos}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.evaluationCount}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/pacientes/${p.patientId}`}
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        Ver historia
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
