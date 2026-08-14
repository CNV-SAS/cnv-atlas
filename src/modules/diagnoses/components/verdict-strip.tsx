import { Badge } from "@/components/ui/badge";

import { RISK_SEV, SEV_CLS } from "./risk-severity";

// Franja de veredicto PERSISTENTE del Diagnostico: la conclusion que el profesional mira mas, SIEMPRE
// visible por encima de las subpestañas, para que ninguna pestaña la esconda (care a de la
// reorganizacion). Compacta a proposito (una linea que envuelve a dos en movil): si crece, el remedio se
// vuelve problema. Lleva lo minimo para orientar: estado EFR, riesgo integrado y ruta prioritaria (esta
// ultima como PUNTERO a Tratamiento, no se duplica el contenido de la ruta). NO reemplaza la cabecera
// (paciente/fecha/estado de confirmacion): la acompana, no le quita informacion.

export function VerdictStrip({
  stateNumber,
  efrName,
  riskLevel,
  riskScore,
  dfiComplete,
  rutaPrioritaria,
}: {
  stateNumber: number;
  efrName: string | null;
  riskLevel: string;
  riskScore: number;
  dfiComplete: boolean;
  // Nombre de la ruta prioritaria (la primera de las autoritativas del DFI), o null si no hay.
  rutaPrioritaria: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm">
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Estado EFR:</span>
        <span className="font-semibold text-foreground">{stateNumber} de 81</span>
        {efrName ? <span className="text-muted-foreground">· {efrName}</span> : null}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Riesgo integrado:</span>
        {dfiComplete ? (
          <Badge className={SEV_CLS[RISK_SEV[riskLevel] ?? 1]}>
            {riskLevel} · {riskScore}
          </Badge>
        ) : (
          <Badge className={SEV_CLS[1]}>Provisional</Badge>
        )}
      </span>
      {rutaPrioritaria ? (
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Ruta prioritaria:</span>
          <span className="font-medium text-foreground">{rutaPrioritaria}</span>
          <span className="text-xs text-muted-foreground">(ver en Tratamiento)</span>
        </span>
      ) : null}
    </div>
  );
}
