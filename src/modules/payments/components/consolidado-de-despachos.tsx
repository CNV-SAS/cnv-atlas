import { theadTr, th } from "@/components/shared/tabla";
import { TituloSeccion } from "@/components/shared/titulo-pantalla";

import type { EnvioPorCoordinar } from "../data/despachos-reader";
import { RegistrarDestinoForm } from "./registrar-destino-form";

// ═══ LOS ENVIOS A DOMICILIO: LA COLA DE LO QUE HAY QUE COORDINAR (2026-09-29, REESCRITO EL 2026-10-05) ═══
//
// ANTES ERA UNA CUENTA: el consolidado quincenal de lo que CNV le pagaba al domiciliario, con lo cobrado al
// paciente al lado y la diferencia que se llevaba la pasarela. Lo pidio contabilidad porque ese pago no es
// deducible sin soporte.
//
// LA DECISION DEL 2026-10-05 DISOLVIO LA CUENTA ENTERA: el flete queda fuera de CNV, el paciente le paga al
// mensajero, y Atlas no cobra el envio ni registra el gasto. No hay pago que soportar ni diferencia que
// explicar, asi que las columnas de plata no se ocultaron: ya no existen.
//
// LO QUE QUEDA ES UNA LISTA DE TRABAJO, que es lo que la misma decision pide: la venta queda pendiente de
// coordinar el envio, y admin o soporte la marcan entregada cuando se despacho de verdad. Por eso la tabla
// tiene CELULAR y DIRECCION (lo que hace falta para llamar y despachar) en vez de totales.
function Tabla({ envios, conFecha }: { envios: EnvioPorCoordinar[]; conFecha: boolean }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[44rem] text-xs">
        <thead>
          <tr className={theadTr}>
            <th className={th}>Día de la venta</th>
            <th className={th}>Destino</th>
            <th className={th}>Dirección</th>
            <th className={th}>Celular</th>
            <th className={th}>{conFecha ? "Despachado" : "Estado"}</th>
          </tr>
        </thead>
        <tbody>
          {envios.map((e) => (
            <tr key={e.transactionId} className="border-b border-border/60">
              <td className="px-3 py-2 text-muted-foreground">{e.dia}</td>
              {/* ═══ SIN DIRECCIÓN SE DICE QUE FALTA PEDIRLA, NO SE DEJA UN GUION (legal, 2026-10-08) ═══

                  Condición textual suya: *"que la venta entre a Envíos por coordinar marcada visiblemente como
                  sin dirección, no simplemente con los campos vacíos. La diferencia entre 'falta por pedir' y
                  'se nos olvidó' tiene que verse."*

                  Y DESDE HOY ES EL CASO NORMAL, no la excepción: la venta a domicilio nace sin dirección porque
                  la pide quien coordina, que es quien lee esta tabla. Un guion aquí se leería como un dato
                  perdido, cuando es el trabajo que esta pantalla existe para repartir. */}
              <td className="px-3 py-2 text-foreground">
                {e.ciudad ?? <span className="text-attention">por pedir</span>}
                {e.departamento ? ` (${e.departamento})` : ""}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {e.direccion ?? (
                  <span className="font-medium text-attention">Falta por pedir: llámalo y regístrala</span>
                )}
              </td>
              {/* SIN CELULAR SE DICE QUE FALTA, no se deja un guion: es el dato que impide coordinar, y es lo
                  que pasa con los envios anteriores al 2026-10-05, que no lo pedian. */}
              <td className="px-3 py-2 text-muted-foreground">
                {e.celular ?? <span className="text-attention">sin celular registrado</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {conFecha ? (
                  (e.entregadoEl ?? "-")
                ) : e.direccion == null ? (
                  /* ── Y AQUI SE PUEDE RESOLVER, no solo enterarse (legal, 2026-10-08) ──

                     El botón va junto a la fila que lo necesita, porque es el mismo momento: se llama al
                     paciente, se le confirma el valor del envío y se anota a dónde va. Sin esta salida, el
                     portón de la entrega habría dejado la venta trabada para siempre. */
                  <RegistrarDestinoForm transactionId={e.transactionId} faltaCelular={e.celular == null} />
                ) : (
                  <span className="text-attention">por coordinar</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConsolidadoDeDespachosSection({
  porCoordinar,
  despachados,
}: {
  porCoordinar: EnvioPorCoordinar[];
  despachados: EnvioPorCoordinar[];
}) {
  if (porCoordinar.length === 0 && despachados.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      <TituloSeccion>Envíos a domicilio</TituloSeccion>
      <p className="max-w-prose text-sm text-muted-foreground">
        El envío lo realiza un servicio de mensajería independiente y el paciente se lo paga directamente a esa
        persona.{" "}
        <strong className="text-foreground">CNV no cobra el envío, no lo factura y no registra ese gasto.</strong>{" "}
        Lo que hay que hacer con cada uno es llamar al paciente, coordinar la entrega y marcar la venta como
        entregada cuando salga.
      </p>

      {porCoordinar.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            Por coordinar · {porCoordinar.length} {porCoordinar.length === 1 ? "envío" : "envíos"}
          </span>
          {/* EL MAS VIEJO ARRIBA, y se dice: quien lleva mas tiempo esperando es a quien hay que llamar
              primero. */}
          <p className="max-w-prose text-xs text-muted-foreground">
            El primero de la lista es el que lleva más tiempo esperando. Se marca como entregado desde
            /pagos, en la venta.
          </p>
          <Tabla envios={porCoordinar} conFecha={false} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No hay envíos pendientes de coordinar.</p>
      )}

      {despachados.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Ya despachados</span>
          <Tabla envios={despachados} conFecha />
        </div>
      ) : null}
    </div>
  );
}
