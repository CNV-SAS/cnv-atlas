import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { BisConditionsReadonly as Data } from "../data/bis-conditions-reader";

// Vista de SOLO LECTURA de las condiciones de la toma BIS selladas (tras el diagnostico, la captura
// ya no es editable). Extiende el patron de lectura de la encuesta (sub-bloque A): lo sellado se ve,
// no desaparece. Muestra solo las condiciones que se respondieron. Presentacion pura.
export function BisConditionsReadonly({ data }: { data: Data }) {
  const answered = data.conditions.filter((c) => data.answers[c.key] != null);
  if (answered.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Condiciones de la toma BIS</CardTitle>
          <span className="text-xs text-muted-foreground">Selladas al capturar · solo lectura</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {answered.map((c) => {
          const a = data.answers[c.key];
          const isYes = a.value === true;
          const answer = typeof a.value === "boolean" ? (a.value ? "Sí" : "No") : String(a.value);
          const detail = a.detail != null && a.detail !== "" ? ` · ${a.detail}` : "";
          return (
            <div
              key={c.key}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
            >
              <span className="text-sm text-foreground">{c.label}</span>
              <div className="flex items-center gap-2">
                {isYes && c.kind === "contraindicacion" ? (
                  <Badge className="bg-clinical-critical-bg text-clinical-critical">
                    Contraindicación
                  </Badge>
                ) : null}
                {isYes && c.compromisesValidity ? (
                  <Badge className="bg-clinical-warning-bg text-clinical-warning">
                    Reserva de validez
                  </Badge>
                ) : null}
                {isYes && c.kind === "advertencia" && a.acknowledgedAt ? (
                  <span className="text-xs text-clinical-warning">Reconocido</span>
                ) : null}
                <span className="text-sm font-medium text-foreground">
                  {answer}
                  {detail}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
