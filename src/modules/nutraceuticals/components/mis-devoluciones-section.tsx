import { Panel } from "@/components/shared/panel";
import { Badge } from "@/components/ui/badge";

import { misDevoluciones, misLotesDevolvibles } from "../services/devolucion-a-cnv-service";
import { DeclararDevolucionForm } from "./declarar-devolucion-form";

// ═══ DEVOLVERLE PRODUCTO A CNV (0187) ═══
//
// POR QUE EXISTE: hasta hoy, un Integrante con producto que no rota solo tenia dos salidas, venderlo a la
// fuerza o dejarlo vencer, y las dos son peores para todos. El modelo comercial cuenta la devolucion entre lo
// que se compensa en la liquidacion, y para el producto de tercero pide devolverlo "tres o cuatro meses antes
// del vencimiento".
export async function MisDevolucionesSection({ userId }: { userId: string }) {
  const [lotes, mias] = await Promise.all([misLotesDevolvibles(userId), misDevoluciones(userId)]);
  if (lotes.length === 0 && mias.length === 0) return null;

  const abiertas = mias.filter((d) => d.cerradaEl == null);
  const cerradas = mias.filter((d) => d.cerradaEl != null);

  return (
    <Panel titulo="Devolverle producto a CNV">
      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-sm text-muted-foreground">
          Si tienes producto que no vas a vender, devuélvelo en vez de dejarlo vencer. Declaras aquí lo que
          despachas y CNV confirma lo que recibe:{" "}
          <strong className="text-foreground">tu saldo baja cuando lo confirmen</strong>, no al declararlo.
          Mientras tanto, si haces un conteo y te falta lo que ya despachaste, justifícalo como devolución a
          CNV con su guía.
        </p>

        {lotes.length > 0 ? (
          <DeclararDevolucionForm lotes={lotes} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No tienes unidades disponibles para devolver (o ya están todas declaradas).
          </p>
        )}

        {abiertas.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Esperando que CNV las reciba</span>
            {abiertas.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">
                    {d.producto} · lote {d.codigo} · {d.declaradas}{" "}
                    {d.declaradas === 1 ? "unidad" : "unidades"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Declarada el {d.declaradaEl} · {d.motivo}
                  </span>
                </div>
                <Badge variant="outline" className="border-attention/60 font-normal text-attention">
                  Sin confirmar
                </Badge>
              </div>
            ))}
          </div>
        ) : null}

        {cerradas.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Cerradas</span>
            {cerradas.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">
                    {d.producto} · lote {d.codigo}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Declaraste {d.declaradas} · CNV recibió {d.recibidas} · {d.cerradaEl}
                    {d.notaDeCierre ? ` · ${d.notaDeCierre}` : ""}
                  </span>
                </div>
                {/* LA DIFERENCIA SE NOMBRA, y se dice a donde va: son unidades que siguen en su saldo y
                    que van a aparecer en su conteo. Callarlo seria dejarle descubrir un faltante sin
                    saber de donde salio. */}
                {d.recibidas != null && d.recibidas < d.declaradas ? (
                  <span className="text-xs text-attention">
                    No llegaron {d.declaradas - d.recibidas}: siguen en tu saldo
                  </span>
                ) : (
                  <Badge variant="outline" className="font-normal">
                    Completa
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
