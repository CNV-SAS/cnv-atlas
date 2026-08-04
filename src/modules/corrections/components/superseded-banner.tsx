import Link from "next/link";

// Banner de C2-b: avisa que ESTA version de la evaluacion fue REEMPLAZADA por una correccion, para
// que no se lea un diagnostico reemplazado como si fuera el vigente (alguien que llega por un enlace
// guardado o el historial). Enlaza a la version vigente. Solo se renderiza si superseded=true.
export function SupersededBanner({ newEvaluationId }: { newEvaluationId: string | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-4 py-3 text-sm text-clinical-warning">
      <span className="font-semibold">Esta versión de la evaluación fue reemplazada por una corrección.</span>
      <span>
        Lo que ves aquí ya no es la versión vigente; se conserva como registro.
        {newEvaluationId ? (
          <>
            {" "}
            <Link href={`/evaluaciones/${newEvaluationId}`} className="font-semibold underline underline-offset-4">
              Ver la versión vigente
            </Link>
            .
          </>
        ) : null}
      </span>
    </div>
  );
}
