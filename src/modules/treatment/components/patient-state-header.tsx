import { Activity } from "lucide-react";

// Referencia mínima del estado del paciente, arriba de la pestaña Tratamiento (parte común, todas las
// profesiones). Da el contexto de una línea que hace legible el abordaje: un profesional que lee "cómo
// abordar el estado" tiene que ver DE QUÉ estado sale, sin ir y volver a Diagnóstico (ajuste 2). No
// duplica Diagnóstico (que trae el estado completo con mapas y tablas): es solo sector EFR + fenotipo,
// ambos ya sellados en el snapshot. Presentación pura.

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
        Sector EFR: <span className="font-medium text-foreground">{sector.key}</span> · {sector.nombre}
      </span>
      <span className="text-sm text-muted-foreground">
        Fenotipo: <span className="font-medium text-foreground">{fenotipo.key}</span> · {fenotipo.nombre}
      </span>
    </div>
  );
}
