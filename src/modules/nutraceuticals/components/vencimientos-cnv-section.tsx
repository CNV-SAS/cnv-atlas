import { TituloSeccion } from "@/components/shared/titulo-pantalla";
import { Badge } from "@/components/ui/badge";

import { lotesProvisionales, vencimientosParaCnv } from "../services/vencimientos-lectura";
import { CompletarVencimientoForm } from "./completar-vencimiento-form";

// ═══ LOS VENCIMIENTOS, DEL LADO DE CNV (0186) ═══
//
// DOS GRUPOS, y la division no es estetica: lo que TODAVIA no vence se puede evitar (y el Integrante ya
// recibio su aviso con la consecuencia); lo que YA vencio es plata perdida y solo queda decidir quien la
// asume. Por eso la propuesta de quien asume aparece solo en el segundo: proponer un cargo sobre algo que
// todavia se puede vender seria adelantarse a un hecho que no ocurrio.
//
// EL COLOR ES AMBAR OPERATIVO (`attention`) Y NO EL ROJO CLINICO, aunque un vencido "se sienta" critico: la
// escala `--clinical-*` es un VEREDICTO SOBRE UNA PERSONA y sus hexadecimales salen de los clasificadores de
// Gildardo. Un lote vencido es un aviso sobre el TRABAJO. Lo exige el candado `capa-clinica-solo-veredictos`,
// que atrapo este mismo archivo al escribirlo.
export async function VencimientosCnvSection() {
  const [todos, provisionales] = await Promise.all([vencimientosParaCnv(), lotesProvisionales()]);
  if (todos.length === 0 && provisionales.length === 0) return null;

  const vencidos = todos.filter((v) => v.vencido);
  const porVencer = todos.filter((v) => !v.vencido);

  return (
    <section className="flex flex-col gap-3">
      <TituloSeccion>Vencimientos de lote</TituloSeccion>

      {/* ═══ EL HUECO POR EL QUE LA ALERTA NO PUEDE DISPARARSE ═══
          Cuando el Integrante reconoce una recepción de un lote que CNV no había dado de alta, Atlas lo CREA
          con un vencimiento inventado a un año (negarlo alejaría el saldo de la vitrina, que es peor). Un lote
          así NUNCA entra en la ventana, aunque en la realidad venza el mes que viene: el aviso existe y no se
          dispara, que es la peor forma de no tener un control. Por eso se listan CON el campo para cerrarlo:
          una lista sin forma de arreglarla sería el mismo hueco con más pasos. */}
      {provisionales.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-attention bg-attention-bg p-4">
          <p className="max-w-prose text-sm text-foreground">
            <strong>Estos lotes no tienen fecha de vencimiento real.</strong> La puso Atlas al reconocer una
            recepción, porque el lote no estaba dado de alta. Mientras no se complete,{" "}
            <strong>su alerta de vencimiento no puede dispararse</strong>. Mira el envase y escríbela.
          </p>
          {provisionales.map((l) => (
            <div
              key={l.lotId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {l.producto} · lote {l.codigo}
                </span>
                <span className="text-xs text-muted-foreground">
                  {l.unidades} {l.unidades === 1 ? "unidad" : "unidades"} · {l.donde}
                </span>
              </div>
              <CompletarVencimientoForm lotId={l.lotId} />
            </div>
          ))}
        </div>
      ) : null}

      {vencidos.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="max-w-prose text-sm text-muted-foreground">
            Producto de CNV ya vencido, con unidades en existencia. Lo asume CNV, que conserva la propiedad,{" "}
            <strong className="text-foreground">salvo</strong> que Atlas haya alertado y el Integrante no haya
            actuado. La propuesta de cada caso sale del registro de su alerta.{" "}
            <strong className="text-foreground">Nada se cobra desde aquí:</strong> el cargo por un vencido sigue
            el camino del faltante, con sus dos personas.
          </p>
          {vencidos.map((v) => (
            <div
              key={v.alertaId}
              className="flex flex-col gap-2 rounded-lg border border-attention bg-attention-bg p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {v.producto} · lote {v.codigo} · {v.unidades}{" "}
                    {v.unidades === 1 ? "unidad" : "unidades"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {v.quien ?? "Bodega central de CNV"} · venció el {v.vence} ({v.plazo})
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    v.propuesta?.asume === "integrante"
                      ? "border-attention text-attention"
                      : "font-normal"
                  }
                >
                  {v.propuesta == null
                    ? "Lo asume CNV"
                    : v.propuesta.asume === "integrante"
                      ? "Propuesta: lo asume el Integrante"
                      : "Lo asume CNV"}
                </Badge>
              </div>
              <p className="text-sm text-foreground">
                {v.propuesta?.razon ??
                  "Es producto de la bodega central de CNV: no hay a quién desplazarle el vencido."}
              </p>
              {/* EL CASO DE BORDE, A LA VISTA. Que la alerta existiera no basta si llego con menos dias de
                  los que el modelo promete: eso pasa cuando el lote entra a la vitrina con poca vida, y
                  cobrarlo seria cobrar por no vender en once dias lo que CNV mando con once dias. */}
              {v.propuesta?.alertaTardia ? (
                <p className="text-sm text-attention">
                  Ojo: la alerta le dio {v.propuesta.diasQueTuvo} días, menos de los que el modelo promete.
                  Antes de cobrar, mira cuándo entró ese lote a su vitrina.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {porVencer.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="max-w-prose text-sm text-muted-foreground">
            Todavía se pueden vender. A cada Integrante ya le llegó el aviso con la consecuencia; lo de la
            bodega central es de CNV y no le llega a nadie más.
          </p>
          {porVencer.map((v) => (
            <div
              key={v.alertaId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {v.producto} · lote {v.codigo}
                </span>
                <span className="text-xs text-muted-foreground">
                  {v.quien ?? "Bodega central de CNV"} · vence el {v.vence}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">
                  {v.unidades} {v.unidades === 1 ? "unidad" : "unidades"}
                </span>
                <Badge variant="outline" className="border-attention/60 font-normal text-attention">
                  {v.plazo}
                </Badge>
                {/* SI LA VIO O NO ES EL DATO QUE DECIDE DESPUES, asi que se ve desde ahora y no solo
                    cuando ya haya plata en juego. */}
                <span className="text-xs text-muted-foreground">
                  {v.professionalId == null ? "" : v.vistaEl ? `vista el ${v.vistaEl}` : "sin marcar como vista"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
