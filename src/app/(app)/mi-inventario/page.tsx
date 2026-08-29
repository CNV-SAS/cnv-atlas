import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Panel } from "@/components/shared/panel";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { ConfirmarRemesaSection } from "@/modules/nutraceuticals/components/confirmar-remesa-section";
import { MiConteoForm } from "@/modules/nutraceuticals/components/mi-conteo-form";
import { MiInventarioForm } from "@/modules/nutraceuticals/components/mi-inventario-form";
import { MisFaltantesSection } from "@/modules/nutraceuticals/components/mis-faltantes-section";
import { canLoadOwnStock } from "@/modules/nutraceuticals/policies/can-load-own-stock";
import { getOwnInventory, getOwnMovements } from "@/modules/nutraceuticals/services/inventory-service";
import { getPendingRemesasForOwn } from "@/modules/nutraceuticals/services/remesa-service";

export const metadata = { title: "Mi inventario - Atlas" };

const AVAILABILITY_LABEL: Record<string, string> = {
  en_consultorio: "En consultorio",
  solo_tienda: "Solo en tienda",
  no_disponible: "No disponible",
};
const MOVEMENT_LABEL: Record<string, string> = {
  remesa: "Remesa de CNV",
  recepcion: "Recepción",
  despacho: "Entrega a paciente",
  conciliacion: "Ajuste por conteo",
  devolucion: "Devolución a CNV",
};

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

// Mi inventario (consignacion): el producto es de CNV, en tu custodia. Aqui ves tu saldo, registras lo que
// recibes, y consultas el historial de movimientos (que es tambien tu evidencia ante un faltante).
export default async function MiInventarioPage() {
  const user = await requireUser();
  if (!canLoadOwnStock(user)) redirect("/no-autorizado");

  const [inventory, movements, pendingRemesas] = await Promise.all([
    getOwnInventory(user.id),
    getOwnMovements(user.id),
    getPendingRemesasForOwn(user.id),
  ]);
  const lines = inventory ?? [];
  const recibibles = lines.filter((l) => l.commercialAvailability === "en_consultorio");

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
      {/* De las tres frases cae la del medio ("aqui registras lo que recibes y ves tu saldo"), que es lo
          que la pantalla hace y se ve. Quedan las dos que no se ven: de QUIEN son los productos, y que
          cada movimiento sirve de evidencia ante una diferencia de conteo. */}
      <TituloPantalla
        titulo="Mi inventario"
        descripcion="Los productos son de CNV, en tu custodia (consignación). Cada movimiento queda como registro: es tu evidencia si hay una diferencia en un conteo."
      />

      <ConfirmarRemesaSection pending={pendingRemesas ?? []} />

      <MisFaltantesSection userId={user.id} />

      <Panel titulo="Registrar recepción">
        <Card>
          <CardHeader>
            <CardDescription>
              Registra las unidades que recibiste de CNV. Escribe la cantidad; el lote es opcional. Cada
              recepcion es un movimiento; para corregir un error, se registra otro en sentido contrario (no
              se edita).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recibibles.length ? (
              <MiInventarioForm products={recibibles.map((l) => ({ id: l.nutraceuticalId, name: l.name }))} />
            ) : (
              <p className="text-sm text-muted-foreground">No hay productos disponibles en consultorio para recibir.</p>
            )}
          </CardContent>
        </Card>
      </Panel>

      <Panel titulo="Conteo físico">
        <Card>
          <CardHeader>
            <CardDescription>
              Cuenta lo que tienes en la vitrina y registralo. El conteo queda como evidencia (aunque todo
              cuadre); si cuentas menos de lo que el sistema tiene, se abre un caso de faltante que puedes
              justificar. No se muestra el saldo del sistema a proposito: cuenta lo que hay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lines.length ? (
              <MiConteoForm products={lines.map((l) => ({ id: l.nutraceuticalId, name: l.name }))} />
            ) : (
              <p className="text-sm text-muted-foreground">Aun no tienes productos en custodia para contar.</p>
            )}
          </CardContent>
        </Card>
      </Panel>

      <Panel titulo="Saldo actual">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no tienes productos en custodia.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lines.map((l) => (
              <div
                key={l.nutraceuticalId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{l.name}</span>
                  {l.indication ? <span className="text-xs text-muted-foreground">{l.indication}</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {AVAILABILITY_LABEL[l.commercialAvailability] ?? l.commercialAvailability}
                  </Badge>
                  <span className="text-lg font-black text-foreground">{l.stock}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel titulo="Historial de movimientos">
        {!movements || movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos todavia.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-semibold">Fecha</th>
                  <th className="px-3 py-2.5 font-semibold">Producto</th>
                  <th className="px-3 py-2.5 font-semibold">Movimiento</th>
                  <th className="px-3 py-2.5 font-semibold">Lote</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-muted-foreground">{fmtDate(m.createdAt)}</td>
                    <td className="py-2 pr-4 text-foreground">{m.nutraceuticalName}</td>
                    <td className="py-2 pr-4 text-foreground">{MOVEMENT_LABEL[m.type] ?? m.type}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{m.lote ?? "-"}</td>
                    <td className={`py-2 pr-4 text-right font-bold tabular-nums ${m.delta < 0 ? "text-clinical-warning" : "text-clinical-optimal"}`}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
