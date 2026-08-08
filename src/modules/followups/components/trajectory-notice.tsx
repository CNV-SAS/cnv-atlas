import type { TrajectoryNotice as Notice } from "../data/trajectory-notice-reader";

// P0 Parte 2 (P5): aviso al PROFESIONAL de por qué el paciente no ve un cambio en su reporte de
// seguimiento. Distingue los motivos: interval_too_short e incompleto son ACCIONABLES (cuándo citar /
// completar la encuesta); no_prior es informativo. null si no aplica (no se renderiza).
export function TrajectoryNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  let text: string;
  if (notice.kind === "interval_too_short") {
    text =
      `El paciente no verá el cambio de su evaluación: la medición anterior es de hace ${notice.nearestWeeks} ` +
      "semanas y el modelo no compara cambios a menos de 12 semanas. No es una falla; para comunicar el " +
      "cambio, la próxima medición comparable debe estar al menos a esa distancia.";
  } else if (notice.kind === "incompleto") {
    text =
      "El paciente no verá el cambio de su evaluación: la encuesta está incompleta y el modelo no comunica " +
      "el cambio de edad bioeléctrica con datos a medias (se distorsiona). Para comunicarlo, completa la " +
      "encuesta con el paciente en la próxima consulta.";
  } else {
    text = "El paciente no verá un cambio: no hay una medición anterior comparable con la cual contrastar.";
  }

  return (
    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      {text}
    </p>
  );
}
