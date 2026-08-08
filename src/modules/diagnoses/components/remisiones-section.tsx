import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildRemisiones, type RutaContent } from "@/clinical-engine/rutas-content";
import { RegisterReferralForm } from "@/modules/referrals/components/register-referral-form";

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

// `register` habilita el registro de remisión (D-009): solo cuando lo pasa el profesional que atiende
// (con el treatmentId de la vista de tratamiento). Sin él, la sección es solo lectura (como en Diagnóstico).
export function RemisionesSection({
  rutas,
  register,
}: {
  rutas: RutaContent[];
  register?: { treatmentId: string; today: string; actorProfession: string | null };
}) {
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
          remisiones.map((rem, i) => {
            // Auto-remisión: la ruta remite a la MISMA profesión del que atiende = conducta propia, no
            // remisión (D-009). No se ofrece registrar; la redacción "conducta propia" espera a Gildardo (Q32).
            const esConductaPropia = register != null && rem.referralTarget === register.actorProfession;
            return (
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
                {register != null && !esConductaPropia ? (
                  <RegisterReferralForm
                    treatmentId={register.treatmentId}
                    today={register.today}
                    prefillTarget={rem.referralTarget}
                    prefillReason={rem.indicaciones.join("; ")}
                    fromRoute
                  />
                ) : null}
                {esConductaPropia ? (
                  <p className="text-xs text-muted-foreground">
                    Es tu propia profesión: esto es conducta tuya en la consulta, no una remisión (no se registra).
                  </p>
                ) : null}
              </div>
            );
          })
        )}

        {register != null ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              ¿Remites por criterio propio, aunque el modelo no lo indique? Regístralo:
            </span>
            <RegisterReferralForm treatmentId={register.treatmentId} today={register.today} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
