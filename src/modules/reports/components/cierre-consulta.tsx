"use client";

import { startTransition, useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  closeEvaluationAction,
  reopenEvaluationAction,
  type CloseEvaluationState,
} from "@/modules/evaluations/actions";
import type { PendienteCierre } from "../data/cierre-pendientes";

const initial: CloseEvaluationState = { error: null, success: null, warning: null };

// CIERRE DE LA CONSULTA. El acto que faltaba: nadie ponia 'completed' y la ficha del paciente mostraba
// todas las consultas abiertas.
//
// TONO: la lista informa, no reprocha. El profesional puede cerrar con pendientes a proposito (el paciente
// se lo piensa, la remision depende de otro), asi que ningun texto dice "falta" ni "debes", el boton no se
// deshabilita por tener pendientes, y lo que no depende de esta consulta se separa a proposito para que no
// se lea como una tarea sin hacer.
export function CierreConsulta({
  evaluationId,
  cerrada,
  cerradaPor,
  cerradaEl,
  pendientes,
}: {
  evaluationId: string;
  cerrada: boolean;
  cerradaPor: string | null;
  cerradaEl: string | null;
  pendientes: PendienteCierre[];
}) {
  const [closeState, close, closing] = useActionState(closeEvaluationAction, initial);
  const [reopenState, reopen, reopening] = useActionState(reopenEvaluationAction, initial);
  useFormToast(closeState);
  useFormToast(reopenState);

  const accionables = pendientes.filter((p) => p.bloqueadoPor == null);
  const bloqueados = pendientes.filter((p) => p.bloqueadoPor != null);

  // onSubmit + startTransition y no la prop `action`: la prop resetea los inputs no controlados tras la
  // accion (hazard de React 19 registrado en CLAUDE.md).
  const enviar = (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => fn(data));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {cerrada ? "Consulta cerrada" : "Cerrar la consulta"}
        </CardTitle>
        {cerrada ? (
          <span className="text-xs text-muted-foreground">
            {cerradaPor ? `Cerrada por ${cerradaPor}` : "Cerrada"}
            {cerradaEl ? ` el ${cerradaEl}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Marca esta consulta como terminada. Esto no sella nada de lo clínico: el diagnóstico, el
            tratamiento y el reporte conservan su propio estado.
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        {!cerrada && accionables.length > 0 ? (
          <div className="flex w-full flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Antes de cerrar, esto quedó sin hacer
            </span>
            <ul className="flex w-full flex-col gap-1.5">
              {accionables.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
                >
                  <span className="flex flex-col">
                    <span className="text-sm text-foreground">{p.titulo}</span>
                    <span className="text-xs text-muted-foreground">{p.detalle}</span>
                  </span>
                  {p.etapa ? (
                    <a
                      href={`/evaluaciones/${evaluationId}?etapa=${p.etapa}`}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Ir a resolverlo
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!cerrada && bloqueados.length > 0 ? (
          <div className="flex w-full flex-col gap-2">
            {/* SEPARADO a proposito: mezclarlo con lo accionable obliga al profesional a averiguar cual es
                cual, y entonces no lee la lista. Aqui se dice QUE lo desbloquea. */}
            <span className="text-sm font-medium text-foreground">Esto no depende de esta consulta</span>
            <ul className="flex w-full flex-col gap-1.5">
              {bloqueados.map((p) => (
                <li key={p.id} className="rounded-md border border-dashed border-border px-3 py-2">
                  <span className="text-sm text-foreground">{p.titulo}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.detalle} Se resuelve con {p.bloqueadoPor}.
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!cerrada && pendientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quedó nada pendiente en esta consulta.
          </p>
        ) : null}

        {cerrada ? (
          <form onSubmit={enviar(reopen)} className="flex flex-col items-start gap-2">
            <input type="hidden" name="evaluationId" value={evaluationId} />
            {/* Reabrir existe para que cerrar no sea una puerta que se traba: importar un BIS, recalcular
                el diagnóstico o editar la encuesta exigen que la consulta esté en curso. */}
            <span className="text-xs text-muted-foreground">
              Si necesitas volver a trabajar en esta evaluación, puedes reabrirla. Nada de lo aprobado o
              enviado se deshace.
            </span>
            <Button type="submit" size="sm" variant="outline" disabled={reopening}>
              {reopening ? "Reabriendo…" : "Reabrir la consulta"}
            </Button>
          </form>
        ) : (
          <form onSubmit={enviar(close)} className="flex flex-col items-start gap-2">
            <input type="hidden" name="evaluationId" value={evaluationId} />
            {pendientes.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                Puedes cerrarla igual: cerrar con algo pendiente es una decisión tuya, y queda registrada.
              </span>
            ) : null}
            <Button type="submit" size="sm" disabled={closing}>
              {closing ? "Cerrando…" : "Cerrar la consulta"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
