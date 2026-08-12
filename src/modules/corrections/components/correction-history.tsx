import Link from "next/link";

import { getCorrectionChain } from "../data/correction-history-reader";

// Historial de correcciones (CP2): la cadena de versiones con el MOTIVO de cada salto, quien y cuando.
// Server component que se autoconsulta (RLS): se monta en la vista de la evaluacion y se ve desde la
// version vigente y desde las reemplazadas. Si la evaluacion nunca se corrigio, no renderiza nada.
// Es display de un registro clinico; no hay accion aqui (corregir vive en CorrectionEntry).

const TRIGGER_LABEL: Record<string, string> = {
  correccion_profesional: "Corrección del profesional",
  recalibracion_ciencia: "Recalibración científica",
  completar_profesional: "Completada en consulta",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export async function CorrectionHistory({ evaluationId }: { evaluationId: string }) {
  const { entries, currentEvaluationId, currentVigenteId } = await getCorrectionChain(evaluationId);
  if (entries.length === 0) return null;

  // Las versiones de la cadena: el `old` de la primera correccion (v1) + cada `new`. La correccion que
  // PRODUJO la version i (i >= 1) es entries[i-1]; la version 0 es el original (sin correccion previa).
  const versions = [entries[0].oldEvaluationId, ...entries.map((e) => e.newEvaluationId)];
  const viewingReplaced = currentEvaluationId !== currentVigenteId;

  return (
    <details className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold text-foreground">
        Historial de correcciones ({entries.length})
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {viewingReplaced ? (
          <p className="text-muted-foreground">
            Estás viendo una versión reemplazada.{" "}
            <Link
              href={`/evaluaciones/${currentVigenteId}`}
              className="font-medium text-primary underline underline-offset-4"
            >
              Ir a la versión vigente
            </Link>
            .
          </p>
        ) : null}
        <ol className="flex flex-col gap-3">
          {versions.map((versionId, i) => {
            const corr = i === 0 ? null : entries[i - 1];
            const isCurrent = versionId === currentEvaluationId;
            const isVigente = versionId === currentVigenteId;
            return (
              <li key={versionId} className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
                <span className="text-foreground">
                  <span className="font-medium">Versión {i + 1}</span>
                  {isCurrent ? " · la que ves" : ""}
                  {isVigente ? " · vigente" : ""}
                </span>
                {corr ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(corr.createdAt)} · {corr.correctedByName}
                      {corr.triggerType !== "correccion_profesional"
                        ? ` · ${TRIGGER_LABEL[corr.triggerType] ?? corr.triggerType}`
                        : ""}
                    </span>
                    <span className="text-foreground">Motivo: {corr.reason}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Versión original</span>
                )}
                {!isCurrent ? (
                  <Link
                    href={`/evaluaciones/${versionId}`}
                    className="text-xs text-primary underline underline-offset-4"
                  >
                    Ver esta versión
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}
