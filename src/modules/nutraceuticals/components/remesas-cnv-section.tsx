import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

import { DeclararRemesaForm } from "./declarar-remesa-form";
import type { CnvRemesa, EligibleProfessional, RemesableProduct, UnbackedReception } from "../remesa-types";

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

// Cuánto lleva una remesa declarada sin confirmar (declaredAt -> ahora): una de hace dos semanas dice algo.
function ageLabel(declaredAt: string, nowMs: number): string {
  const days = Math.max(0, Math.floor((nowMs - new Date(declaredAt).getTime()) / 86_400_000));
  if (days < 1) return "declarada hoy";
  return `sin confirmar hace ${days} día${days === 1 ? "" : "s"}`;
}

// Lado CNV de la remesa (E2), junto a los faltantes: misma familia (inventario que CNV revisa). El orden
// refleja la URGENCIA, como la cola de faltantes: lo que exige acción arriba, lo informativo abajo.
//  - Enviadas sin confirmar: producto de CNV que salió y nadie reconoció. Es lo que hay que PERSEGUIR.
//  - Confirmadas con diferencia (faltó/sobró): para REVISAR.
//  - Recepciones no respaldadas: para INVESTIGAR (una recepción sin remesa puede tapar un faltante).
//  - Confirmadas sin diferencia: informativo.
export function RemesasCnvSection({
  remesas,
  unbacked,
  professionals,
  products,
  nowMs,
}: {
  remesas: CnvRemesa[];
  unbacked: UnbackedReception[];
  professionals: EligibleProfessional[];
  products: RemesableProduct[];
  nowMs: number;
}) {
  const enviadas = remesas.filter((r) => r.status === "enviada");
  const conDiferencia = remesas.filter(
    (r) => r.status === "confirmada_faltante" || r.status === "confirmada_sobrante",
  );
  const confirmadas = remesas.filter((r) => r.status === "confirmada");

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Declarar remesa</h2>
        <Card>
          <CardHeader>
            <CardDescription>
              Declara un envío en consignación a un integrante. El producto sigue siendo de CNV, en su vitrina.
              El saldo del integrante NO sube aquí: sube cuando él confirma la recepción.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeclararRemesaForm professionals={professionals} products={products} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">Enviadas sin confirmar</h2>
          {enviadas.length > 0 ? (
            <Badge className="bg-clinical-warning-bg text-clinical-warning">{enviadas.length}</Badge>
          ) : null}
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          Producto de CNV que salió y el integrante aún no reconoció. Es lo que hay que perseguir.
        </p>
        {enviadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todas las remesas están confirmadas.</p>
        ) : (
          enviadas.map((r) => (
            <div key={r.remesaId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{r.professionalName}</span>
                <span className="text-xs text-muted-foreground">
                  {r.nutraceuticalName} · {r.declaredQuantity} unidades · {fmtDate(r.declaredAt)}
                </span>
              </div>
              <Badge variant="outline" className="text-clinical-warning">{ageLabel(r.declaredAt, nowMs)}</Badge>
            </div>
          ))
        )}
      </section>

      {conDiferencia.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Confirmadas con diferencia</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            El integrante recibió una cantidad distinta de la declarada. Para revisar (aún sin resolver quién
            responde).
          </p>
          {conDiferencia.map((r) => {
            const diff = r.difference ?? 0;
            const falto = diff < 0;
            return (
              <div key={r.remesaId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{r.professionalName}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.nutraceuticalName} · declaró {r.declaredQuantity}, recibió {r.receivedQuantity} · {fmtDate(r.declaredAt)}
                  </span>
                </div>
                <Badge className={falto ? "bg-clinical-critical-bg text-clinical-critical" : "bg-clinical-warning-bg text-clinical-warning"}>
                  {falto ? `faltó ${Math.abs(diff)}` : `sobró ${diff}`}
                </Badge>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">Recepciones no respaldadas</h2>
          {unbacked.length > 0 ? (
            <Badge className="bg-clinical-critical-bg text-clinical-critical">{unbacked.length}</Badge>
          ) : null}
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          El integrante registró una recepción sin una remesa de CNV que la respalde. Para investigar: una
          recepción sin remesa puede tapar un faltante.
        </p>
        {unbacked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay recepciones sin respaldar.</p>
        ) : (
          unbacked.map((u) => (
            <div key={u.movementId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{u.professionalName}</span>
                <span className="text-xs text-muted-foreground">
                  {u.nutraceuticalName} · {u.quantity} unidades{u.lote ? ` · lote ${u.lote}` : ""} · {fmtDate(u.receivedAt)}
                </span>
              </div>
              <Badge className="bg-clinical-critical-bg text-clinical-critical">sin remesa</Badge>
            </div>
          ))
        )}
      </section>

      {confirmadas.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Confirmadas</h2>
          <div className="flex flex-col gap-1">
            {confirmadas.map((r) => (
              <div key={r.remesaId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                <span className="text-sm text-foreground">
                  {r.professionalName} · {r.nutraceuticalName} · {r.declaredQuantity}
                </span>
                <span className="text-xs text-muted-foreground">{fmtDate(r.declaredAt)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
