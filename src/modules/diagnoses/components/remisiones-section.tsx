import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildRemisiones,
  consolidateRemisiones,
  type RutaContent,
} from "@/clinical-engine/rutas-content";
import { RegisterReferralForm } from "@/modules/referrals/components/register-referral-form";
// Tipo desde validations (neutro), no desde el reader `server-only`: esta seccion renderiza un
// componente cliente y no debe arrastrar el reader al boundary de cliente.
import type { PendingReferralHint } from "@/modules/referrals/validations";

// Sección 3 del Tratamiento: las remisiones de las rutas activas, CONSOLIDADAS POR DESTINATARIO (§9,
// Gildardo): una línea por profesión con el resumen de todo lo que las rutas le envían, no repetido ruta
// por ruta. Indicaciones VERBATIM de Gildardo (se unen sin duplicar, no se resumen ni reescriben). El
// registro D-009 ya es por destinatario (referred_to + reason), así que display y registro se corresponden.

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
  register?: {
    treatmentId: string;
    today: string;
    actorProfession: string | null;
    // Remisiones del paciente pendientes de retorno: para el aviso suave de repetida (D-009 smoke).
    pendingHints?: PendingReferralHint[];
  };
}) {
  // §9: una entrada por DESTINATARIO (no por ruta). Las indicaciones de todas las rutas que remiten a
  // esa profesión se unen sin duplicar; se conserva la urgencia más alta.
  const remisiones = consolidateRemisiones(buildRemisiones(rutas));

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
          remisiones.map((rem) => {
            // Auto-remisión: la profesión destino es la MISMA del que atiende = conducta propia, no
            // remisión (D-009). No se ofrece registrar; la redacción "conducta propia" espera a Gildardo (Q32).
            const esConductaPropia = register != null && rem.referralTarget === register.actorProfession;
            return (
              <div key={rem.referralTarget} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    → Remisión a: {rem.profesional}
                  </span>
                  {rem.urgencia ? (
                    <Badge className={urgenciaCls(rem.urgencia)}>{rem.urgencia}</Badge>
                  ) : null}
                </div>
                {rem.indicaciones.length ? (
                  <ul className="list-inside list-disc text-xs text-muted-foreground">
                    {rem.indicaciones.map((ind, j) => (
                      <li key={j}>{ind}</li>
                    ))}
                  </ul>
                ) : null}
                {/* Las rutas que la originan, como referencia (no se repite el detalle ruta por ruta). */}
                <p className="text-xs text-muted-foreground">Rutas: {rem.rutaIds.join(", ")}</p>
                {register != null && !esConductaPropia ? (
                  <RegisterReferralForm
                    treatmentId={register.treatmentId}
                    today={register.today}
                    prefillTarget={rem.referralTarget}
                    prefillReason={rem.indicaciones.join("; ")}
                    pendingHints={register.pendingHints}
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
            <RegisterReferralForm
              treatmentId={register.treatmentId}
              today={register.today}
              pendingHints={register.pendingHints}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
