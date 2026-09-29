import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/shared/panel";

import { misLotesPorVencer } from "../services/vencimientos-lectura";
import { MarcarVencimientoVistoForm } from "./marcar-vencimiento-visto-form";

// ═══ LO QUE SE LE VENCE AL INTEGRANTE (0186) ═══
//
// ES SU PRIMERA VISTA POR LOTE. "Saldo actual", mas abajo, es por producto: ahi un frasco que vence el mes
// que viene y otro del año que viene son el mismo numero. Aqui no, porque la fecha es lo unico que importa.
//
// EL COLOR ES AMBAR OPERATIVO (`attention`) Y NO EL ROJO CLINICO, aunque un vencido "se sienta" critico: la
// escala `--clinical-*` es un VEREDICTO SOBRE UNA PERSONA y sus hexadecimales salen de los clasificadores de
// Gildardo. Un lote vencido es un aviso sobre el TRABAJO. Lo exige el candado `capa-clinica-solo-veredictos`,
// que atrapo este mismo archivo al escribirlo.
//
// LA FRASE DE LA CONSECUENCIA ES EL PUNTO DE LA SECCION, no un adorno legal: sin ella esto es un dato
// curioso, y con ella es lo que le permite no perder plata. La dice igual que el correo, a proposito.
export async function MisVencimientosSection({ userId }: { userId: string }) {
  const lotes = await misLotesPorVencer(userId);
  if (lotes.length === 0) return null;

  const hayVencido = lotes.some((l) => l.vencido);

  return (
    <Panel titulo={hayVencido ? "Producto vencido o por vencer" : "Producto por vencer"}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Estos lotes están cerca de su fecha de vencimiento, o ya la pasaron. Véndelos primero.{" "}
          <strong className="text-foreground">
            El producto no vendido que se vence lo asume CNV, salvo que hayas recibido este aviso y no hayas
            actuado
          </strong>
          : en ese caso se te cobra al precio de facturación, igual que un faltante. Si no vas a poder
          venderlos, escríbele a CNV para devolverlos antes de que venzan.
        </p>

        {lotes.map((l) => (
          <div
            key={l.alertaId}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
              l.vencido ? "border-attention bg-attention-bg" : "border-border"
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">{l.producto}</span>
              <span className="text-xs text-muted-foreground">
                Lote {l.codigo} · vence el {l.vence}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-foreground">
                {l.unidades} {l.unidades === 1 ? "unidad" : "unidades"}
              </span>
              <Badge
                variant="outline"
                className={`font-normal ${l.vencido ? "border-attention text-attention" : "border-attention/60 text-attention"}`}
              >
                {l.plazo}
              </Badge>
              {/* LA MARCA DE VISTA ES UN REGISTRO, NO UN ACUSE DE CORTESIA: el modelo comercial pide
                  registrar si la alerta fue vista, y ese registro es parte de lo que determina quien asume
                  el vencido. Por eso se le dice para qué sirve, en vez de un "OK" sin explicación. */}
              {l.vistaEl ? (
                <span className="text-xs text-muted-foreground">Marcaste que lo viste el {l.vistaEl}</span>
              ) : (
                <MarcarVencimientoVistoForm alertaId={l.alertaId} />
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
