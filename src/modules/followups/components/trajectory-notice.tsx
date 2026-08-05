import type { TrajectoryNotice as Notice } from "../data/trajectory-notice-reader";

// P0 Parte 2 (P5): aviso al PROFESIONAL de por qué el paciente no ve un cambio en su reporte de
// seguimiento. Distingue los dos motivos: interval_too_short es ACCIONABLE (le dice cuándo puede citar
// para que el cambio sea comparable); no_prior es informativo. null si no aplica (no se renderiza).
export function TrajectoryNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      {notice.kind === "interval_too_short" ? (
        <>
          El paciente no verá el cambio de su evaluación: la medición anterior es de hace{" "}
          {notice.nearestWeeks} semanas y el modelo no compara cambios a menos de 12 semanas. No es una
          falla; para comunicar el cambio, la próxima medición comparable debe estar al menos a esa
          distancia.
        </>
      ) : (
        <>El paciente no verá un cambio: no hay una medición anterior comparable con la cual contrastar.</>
      )}
    </p>
  );
}
