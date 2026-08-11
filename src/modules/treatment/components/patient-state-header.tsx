import { Activity } from "lucide-react";

// Referencia mínima del estado del paciente, arriba de la pestaña Tratamiento (parte común, todas las
// profesiones). Da el contexto de una línea que hace legible el abordaje: un profesional que lee "cómo
// abordar el estado" tiene que ver DE QUÉ estado sale, sin ir y volver a Diagnóstico (ajuste 2). No
// duplica Diagnóstico (que trae el estado completo con mapas y tablas): es solo sector funcional +
// fenotipo, ambos ya sellados en el snapshot. Presentación pura.
//
// Se muestra el NOMBRE, no la clave interna: la clave ("3_1", "A_B") es un identificador de la matriz,
// no algo para leer en pantalla. El nombre sale del snapshot (FYR_LABELS / STRUCT_LABELS del motor, que
// cubren las 9 combinaciones de cada eje), así que siempre existe.

export function PatientStateHeader({
  sector,
  fenotipo,
}: {
  sector: { key: string; nombre: string };
  fenotipo: { key: string; nombre: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Activity className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        Estado del paciente
      </span>
      <span className="text-sm text-muted-foreground">
        Sector funcional: <span className="font-medium text-foreground">{sector.nombre}</span>
      </span>
      <span className="text-sm text-muted-foreground">
        Fenotipo estructural: <span className="font-medium text-foreground">{fenotipo.nombre}</span>
      </span>
    </div>
  );
}
