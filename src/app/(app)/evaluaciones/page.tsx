import { redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
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

  const pending = await listPendingIdentityChecks();

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
    <div className="flex flex-col gap-8">
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
    </div>
  );
}
