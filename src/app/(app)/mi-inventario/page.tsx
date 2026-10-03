import { theadTr, th, thNum } from "@/components/shared/tabla";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Panel } from "@/components/shared/panel";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { ConfirmarRemesaSection } from "@/modules/nutraceuticals/components/confirmar-remesa-section";
import { MiConteoForm } from "@/modules/nutraceuticals/components/mi-conteo-form";
import { MisDevolucionesSection } from "@/modules/nutraceuticals/components/mis-devoluciones-section";
import { MisFaltantesSection } from "@/modules/nutraceuticals/components/mis-faltantes-section";
import { MisVencimientosSection } from "@/modules/nutraceuticals/components/mis-vencimientos-section";
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
  venta: "Venta",
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

      <MisVencimientosSection userId={user.id} />

      <MisDevolucionesSection userId={user.id} />

      <MisFaltantesSection userId={user.id} />

      {/* ═══ AQUI IBA "REGISTRAR RECEPCION", Y SE RETIRO (Santiago, 2026-09-25) ═══
          El profesional no teclea lo que recibio. El mecanismo bueno ya existia: CNV DECLARA la remesa y el
          CONFIRMA, arriba. Tener las dos cosas dejaba una puerta por la que podia entrar inventario que CNV
          nunca declaro, y ademas le pedia al integrante un trabajo de digitacion que no es suyo. */}

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
            {/* LOS DE CERO VAN DESPUES Y SE DICE DONDE EMPIEZAN (Santiago, 2026-10-03): con el PVP en cada
                fila, una lista alfabética con ceros intercalados se lee como "tengo de todo". */}
            {lines.map((l, i) => (
              <div key={`envoltura-${l.nutraceuticalId}`} className="flex flex-col gap-2">
                {l.stock === 0 && i > 0 && lines[i - 1].stock !== 0 ? (
                  <p className="pt-2 text-xs text-muted-foreground">
                    De aquí para abajo no tienes unidades. Se listan con su precio para poder consultarlo y
                    para poder recibirlos.
                  </p>
                ) : null}
              <div
                key={l.nutraceuticalId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {l.name}
                    {/* MARCADOS EN LA LISTA, EXCLUIDOS DE LA CIFRA (smoke del 2026-09-29). Si la lista los
                        escondiera, su saldo desaparecería sin poder cuadrarlo; si la tarjeta los contara,
                        diría otro número que la de Dirección sobre el mismo hecho. */}
                    {l.esDePrueba ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        De prueba · no cuenta en las cifras
                      </span>
                    ) : null}
                  </span>
                  {l.indication ? <span className="text-xs text-muted-foreground">{l.indication}</span> : null}
                  {/* ═══ EL PRECIO, AQUI (Santiago, 2026-10-03) ═══

                      Los Integrantes entran a su inventario a mirar el PVP y no estaba: había que irse a
                      /pagos o al tratamiento. Es el primer sitio donde se busca, y con razón: el precio es un
                      atributo del producto que tienen en la mano. Se dice que es con IVA porque es como se
                      cobra, y porque un precio sin esa aclaración invita a sumarle el IVA otra vez. */}
                  {l.pvp != null ? (
                    <span className="text-xs text-muted-foreground">
                      PVP <span className="font-medium text-foreground">{l.pvp.toLocaleString("es-CO")} COP</span>{" "}
                      (IVA incluido)
                    </span>
                  ) : null}
                  {/* ═══ Y LOS LOTES CON SU VENCIMIENTO ═══

                      El saldo ya se guarda POR LOTE y la pantalla lo sumaba en un solo número. Quien saca la
                      caja del estante necesita saber CUÁL sale primero, que es justo lo que decide el
                      descuento (FEFO). Van en ese orden: el primero de la lista es el que sale primero. */}
                  {l.lotes.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {l.lotes.length === 1 ? "Lote: " : "Lotes (sale primero el de arriba): "}
                      {l.lotes
                        .map((x) => `${x.codigo} · ${x.cantidad} u.${x.vence ? ` · vence ${x.vence}` : ""}`)
                        .join("  |  ")}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {AVAILABILITY_LABEL[l.commercialAvailability] ?? l.commercialAvailability}
                  </Badge>
                  <span className="text-lg font-black text-foreground">{l.stock}</span>
                </div>
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
          // SIN TARJETA PROPIA: ya vive dentro de un `Panel`, que pone la superficie. Con las dos salia
          // una tarjeta dentro de otra. El borde y el redondeo se quedan en el Panel; aqui solo el
          // desplazamiento lateral y la banda de encabezados.
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Fecha</th>
                  <th className={th}>Producto</th>
                  <th className={th}>Movimiento</th>
                  <th className={th}>Lote</th>
                  <th className={thNum}>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(m.createdAt)}</td>
                    <td className="px-3 py-2 text-foreground">{m.nutraceuticalName}</td>
                    <td className="px-3 py-2 text-foreground">{MOVEMENT_LABEL[m.type] ?? m.type}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.lote ?? "-"}</td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${m.delta < 0 ? "text-clinical-warning" : "text-clinical-optimal"}`}>
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
