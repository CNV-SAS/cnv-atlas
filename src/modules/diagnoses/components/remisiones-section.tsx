import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildRemisiones, type RutaContent } from "@/clinical-engine/rutas-content";

// Sección 3 del Tratamiento: las remisiones AGREGADAS de las rutas activas (médico / entrenador-
// fisioterapeuta / psicólogo con remisión). Presentación pura desde el contenido congelado en el
// snapshot (T1). Indicaciones VERBATIM de Gildardo, sin resumir ni reordenar.

// Tono visual de la urgencia DERIVADO del texto, sin alterar el string: obligatoria → crítico,
// recomendada → advertencia, cualquier otro (no clasificable con claridad) → neutro. La etiqueta
// muestra la urgencia COMPLETA verbatim.
function urgenciaCls(urgencia: string): string {
  const s = urgencia.toLowerCase();
  if (s.includes("obligatoria")) return "bg-clinical-critical-bg text-clinical-critical";
  if (s.includes("recomendada")) return "bg-clinical-warning-bg text-clinical-warning";
  return "bg-muted text-muted-foreground";
}

export function RemisionesSection({ rutas }: { rutas: RutaContent[] }) {
  const remisiones = buildRemisiones(rutas);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remisiones</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {remisiones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No se requieren remisiones con el perfil actual.
          </p>
        ) : (
          remisiones.map((rem, i) => (
            <div key={`${rem.rutaId}-${rem.profesional}-${i}`} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  → Remisión a: {rem.profesional}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{rem.rutaId}</Badge>
                  {rem.urgencia ? <Badge className={urgenciaCls(rem.urgencia)}>{rem.urgencia}</Badge> : null}
                </div>
              </div>
              <p className="text-xs italic text-muted-foreground">{rem.rutaLabel}</p>
              {rem.indicaciones.length ? (
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {rem.indicaciones.map((ind, j) => (
                    <li key={j}>{ind}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
