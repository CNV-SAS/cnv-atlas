import Link from "next/link";

import type { AwaitingSurveyEvaluation } from "../data/evaluations-repository";

// Lista de shells firmados sin responder. DISCRETA a proposito: no es cola de accion clinica (las cuatro
// de arriba lo son), es seguimiento operativo. Si queda al mismo nivel visual compite por atencion con lo
// urgente. Por eso: encabezado atenuado y mas chico, sin tarjetas de accion, al fondo del panel; y se
// OCULTA cuando esta vacia (no deja un recuadro permanente). Cada fila enlaza a la ficha del paciente,
// desde donde se puede cerrar (sub-tarea de cierre).

// Cuanto lleva firmada sin responder (mismo criterio que las remesas sin confirmar): uno de ayer es
// normal, uno de hace semanas es el que conviene cerrar. nowMs viene del server (no Date.now en render).
function ageLabel(createdAt: string, nowMs: number): string {
  const days = Math.max(0, Math.floor((nowMs - new Date(createdAt).getTime()) / 86_400_000));
  if (days < 1) return "firmó hoy";
  return `firmó hace ${days} día${days === 1 ? "" : "s"}`;
}

export function AwaitingSurveyList({
  items,
  nowMs,
}: {
  items: AwaitingSurveyEvaluation[];
  nowMs: number;
}) {
  if (items.length === 0) return null; // vacia: no se muestra (no competir con lo urgente)

  return (
    <section className="flex flex-col gap-3 border-t border-dashed border-border pt-6">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-muted-foreground">Firmaron, falta la encuesta</h2>
        <p className="text-xs text-muted-foreground">
          Pacientes que firmaron el consentimiento pero no completaron la encuesta. No requieren accion
          clinica; es seguimiento. Desde la ficha del paciente puedes cerrar una que no vaya a completarse.
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {items.map((e) => (
          <li key={e.evaluationId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm text-foreground">
                {e.lastName} {e.firstName}
              </span>
              <span className="text-xs text-muted-foreground">
                {e.documentType} {e.documentNumber} · {ageLabel(e.createdAt, nowMs)}
              </span>
            </div>
            <Link
              href={`/pacientes/${e.patientId}`}
              className="text-xs font-medium text-primary underline underline-offset-2"
            >
              Ver ficha
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
