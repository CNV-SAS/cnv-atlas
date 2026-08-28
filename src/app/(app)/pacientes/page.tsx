
import { redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { listPatientsForProfessional } from "@/modules/patients/data/patients-list-reader";

import { ListaPacientes } from "@/modules/patients/components/lista-pacientes";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";

export const metadata = { title: "Pacientes - Atlas" };

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
          Tus pacientes y el acceso a su historia clínica. Solo ves los pacientes asignados a ti.
        </p>
      </header>

      {pacientes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Todavía no tienes pacientes. Aparecerán aquí cuando confirmes la identidad de una
          evaluación recibida por la encuesta.
        </div>
      ) : (
        // Filas de dos lineas con buscador, no tabla: esta lista se BUSCA (BRAND, "si busca,
        // densidad; si compara, columnas"). El buscador necesita estado, asi que la lista es un
        // componente cliente; la pagina sigue siendo servidor y trae el roster bajo RLS.
        <ListaPacientes pacientes={pacientes} />
      )}
    </div>
  );
}
