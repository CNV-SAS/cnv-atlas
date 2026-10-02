import { Panel } from "@/components/shared/panel";
import { formatDate, formatDateTime } from "@/lib/format/date";

import { limiteDe, type Pendiente, type TipoSinSalida } from "../resumen";

import { DescarteDePendienteForm, ReactivarPendienteForm } from "./descarte-de-pendiente-form";

// ═══ LOS PENDIENTES QUE NO TIENEN SALIDA, Y SU DESCARTE (0205) ═══
//
// POR QUE ESTE PANEL EXISTE: estos dos pendientes solo vivian en el correo de las 7 y las 5. No habia pantalla
// donde trabajarlos, y tampoco forma de cerrarlos, asi que el correo repetia los mismos cada dia. Un aviso que
// no se puede quitar se vuelve ruido, y el dia que haya uno de verdad nadie lo va a ver.
//
// NO SE ESCONDE LO DESCARTADO: la fila sigue, con quien lo descarto, cuando, por que, y un boton para
// reactivarlo. Lo que se calla es el correo, que es donde estaba el ruido.
//
// Y NO SE ESCONDE VACIO, igual que las ventas por revisar: el cero es el dato.

const ROTULO: Record<TipoSinSalida, string> = {
  sin_saldo: "Cobrada sin saldo: la vitrina cuenta unidades que ya salieron",
  por_despachar: "Pagada y sin entregar: el producto sale de la bodega",
};

const EXPLICACION: Record<TipoSinSalida, string> = {
  sin_saldo:
    "Se cobró y el saldo de Atlas no alcanzó para descontarla. No se arregla aquí: se arregla contando la vitrina y registrando lo que falte. Descártala cuando ya hayas cuadrado el inventario, dejando escrito qué encontraste.",
  por_despachar:
    "El producto no estaba en la vitrina del Integrante: sale de la bodega y alguien de CNV tiene que despacharlo. Si ya se entregó por fuera de Atlas, descártala diciéndolo; si falta despacharla, despáchala.",
};

export function PendientesSinSalida({
  pendientes,
  puedeDescartar,
  ahora,
}: {
  pendientes: Pendiente[];
  /** Quien ve el ingreso. Soporte ve el panel y no descarta: apagar el control es de quien responde por él. */
  puedeDescartar: boolean;
  ahora: Date;
}) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(ahora);
  const activos = pendientes.filter((p) => p.descarte == null || p.descarte.caducado);
  const descartados = pendientes.length - activos.length;

  return (
    <Panel titulo="Pendientes sin salida">
      <p className="text-sm text-muted-foreground">
        Estos dos no se cierran con ninguna acción en Atlas: se resuelven por fuera. Por eso se pueden descartar
        con un motivo, y el descarte caduca si el hecho de la venta cambia.
      </p>
      {pendientes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Ninguno. Nada que descartar.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {activos.length} pendiente{activos.length === 1 ? "" : "s"} sin resolver
            {descartados > 0 ? ` · ${descartados} descartado${descartados === 1 ? "" : "s"}` : ""}
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {pendientes.map((p) => {
              const tipo = p.tipo as TipoSinSalida;
              const descartado = p.descarte != null && !p.descarte.caducado;
              const caducado = p.descarte != null && p.descarte.caducado;
              const limite = limiteDe(p);
              return (
                <li
                  key={`${p.tipo}:${p.transactionId}`}
                  className={`rounded-md border p-3 ${descartado ? "border-border bg-muted/30" : "border-attention/30 bg-attention-bg"}`}
                >
                  <p className={`text-sm font-medium ${descartado ? "text-muted-foreground" : "text-attention"}`}>
                    {ROTULO[tipo]}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {Number(p.monto).toLocaleString("es-CO")} COP · {p.productos || "Sin líneas"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Del {formatDate(p.desde)}
                    {!descartado && hoy > limite ? ` · su plazo venció el ${formatDate(`${limite}T12:00:00`)}` : ""}
                  </p>
                  {descartado ? null : <p className="mt-2 text-xs text-muted-foreground">{EXPLICACION[tipo]}</p>}

                  {p.descarte ? (
                    <div className="mt-2 flex flex-col gap-1">
                      {caducado ? (
                        // EL CASO QUE JUSTIFICA LA CADUCIDAD: alguien lo descartó, y después la venta cambió. El
                        // juicio se tomó sobre otro hecho, así que ya no lo cubre y vuelve a pedir acción.
                        <p className="text-xs font-medium text-clinical-warning">
                          Se había descartado, pero la venta cambió después. El motivo de entonces ya no cubre lo
                          que hay ahora: vuelve a pedir acción.
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Descartado el {formatDateTime(p.descarte.en)}
                        {p.descarte.por ? ` por ${p.descarte.por}` : ""}: {p.descarte.motivo}
                      </p>
                    </div>
                  ) : null}

                  {puedeDescartar ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {descartado || caducado ? (
                        <ReactivarPendienteForm tipo={tipo} transactionId={p.transactionId} />
                      ) : null}
                      {descartado ? null : <DescarteDePendienteForm tipo={tipo} transactionId={p.transactionId} />}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}
