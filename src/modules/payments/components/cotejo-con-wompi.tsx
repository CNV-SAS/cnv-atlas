"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/date";

import { cotejarConWompiAction } from "../actions";
import { resumirDiscrepancias, type UltimaCorrida } from "../conciliacion";

// ═══ "PREGUNTARLE A WOMPI" (Bloque 3b, sesion 3) ═══
//
// Wompi reintenta su webhook 3 veces en 24 horas y despues no mas: un pago cuyo webhook se perdio queda cobrado y
// sin registrar, y hasta ahora nada lo recuperaba. La tarea programada cotejo cada manana; este boton es para
// cuando alguien SABE que un pago no llego y no quiere esperar.
//
// Y SE DICE CUANDO CORRIO LA ULTIMA VEZ, porque un control que dejo de correr es justo el que hace falta el dia
// que algo falla.
export function CotejoConWompi({ ultima }: { ultima: UltimaCorrida | null }) {
  const [state, action, pending] = useActionState(cotejarConWompiAction, {
    error: null,
    success: null,
    warning: null,
  });
  // REFRESCA TAMBIEN CON AVISO, no solo con exito (Santiago, 2026-09-18): el toast contaba la corrida recien
  // hecha y el bloque rojo seguia mostrando la ANTERIOR, asi que decian cosas distintas de las mismas ventas
  // ("se abrió el caso" contra "su caso ya está abierto"). Aqui no hay nada escrito a medias que preservar.
  useFormToastAndRefresh(state);

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-medium text-foreground">Pagos que Wompi aprobó y aquí no llegaron</h2>
      <p className="text-sm text-muted-foreground">
        Wompi reintenta avisarnos tres veces en 24 horas y después deja de intentar. Esto le pregunta directamente
        por los pagos de los últimos tres días y registra los que falten, con su factura y su comisión.
      </p>
      <form onSubmit={enviarSinReset(action)}>
        <Button type="submit" disabled={pending}>
          {pending ? "Preguntando a Wompi..." : "Buscar pagos sin registrar"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Se puede pulsar las veces que haga falta: un pago que ya está registrado no se cobra ni se factura otra vez.
      </p>
      {ultima ? (
        <p className="text-xs text-muted-foreground">
          Última revisión: {formatDateTime(ultima.ranAt)} ({ultima.origen === "tarea" ? "automática" : "a mano"}).{" "}
          {ultima.falloPor
            ? `No se pudo consultar: ${ultima.falloPor}`
            : `${ultima.revisadas} venta${ultima.revisadas === 1 ? "" : "s"} revisada${ultima.revisadas === 1 ? "" : "s"}, ${ultima.recuperadas} recuperada${ultima.recuperadas === 1 ? "" : "s"}${ultima.discrepancias > 0 ? `, ${ultima.discrepancias} con novedad` : ""}.`}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Todavía no se ha hecho ninguna revisión.</p>
      )}
      {ultima && ultima.detalle.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
          {resumirDiscrepancias(ultima.detalle).map((linea) => (
            <li key={linea} className="text-xs text-destructive">
              {linea}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
