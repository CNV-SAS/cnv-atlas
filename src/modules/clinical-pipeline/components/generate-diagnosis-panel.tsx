"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { runPipelineAction, type RunPipelineState } from "../actions";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initialState: RunPipelineState = {
  error: null,
  success: null,
  warning: null,
  done: false,
  completeHref: null,
};

// Boton de generar diagnostico DENTRO de la pestana Diagnostico (el caso individual), ademas del panel de
// Evaluaciones (la lista, para trabajo de lote), como las otras colas. Gate de "listo": identidad confirmada
// + BIS importado. Antes la pestana mandaba una instruccion generica ("confirma la identidad, importa el BIS
// y genera desde el panel") aunque ya se hubieran hecho los dos primeros pasos; ahora dice QUE falta EXACTO.
export function GenerateDiagnosisPanel({
  evaluationId,
  identityConfirmed,
  bisImported,
}: {
  evaluationId: string;
  identityConfirmed: boolean;
  bisImported: boolean;
}) {
  const [state, action, pending] = useActionState(runPipelineAction, initialState);
  useFormToast(state);
  const router = useRouter();

  const ready = identityConfirmed && bisImported;

  // ═══ SE GENERA SOLO AL ENTRAR (2026-09-09, peticion de Gildardo) ═══
  //
  // LAS DOS PROTECCIONES QUE ESTO NECESITABA YA EXISTIAN, y por eso se puede automatizar sin construir
  // nada nuevo:
  //   · "SOLO UNA VEZ" no depende de la pantalla: el writer lanza `PipelineAlreadyRunError` si ya hay
  //     diagnostico. Es guarda de base de datos, no de interfaz. Volver a entrar no regenera.
  //   · "NO CON LA ENCUESTA A MEDIAS" tampoco: el servicio tiene un gate de encuesta COMPLETA (las 64
  //     preguntas de la version, instruccion de Gildardo §1) que devuelve el detalle por dominio.
  // Mas el gate de estado `in_progress`, que es lo que ACOPLA esto con la confirmacion de identidad: sin
  // ella la evaluacion sigue en borrador y el pipeline se niega. Por eso la (a) tenia que ir primero.
  //
  // Y EL FALLO SE VE, que es el cuidado que pidio Santiago y el que de verdad importa aqui: sin boton, un
  // diagnostico que no corre porque faltan tres preguntas tiene que DECIRLO. El error y el enlace a
  // completar la encuesta se rinden abajo igual que antes; lo unico que desaparece es el boton.
  const disparado = useRef(false);
  useEffect(() => {
    if (!ready || disparado.current) return;
    disparado.current = true;
    const datos = new FormData();
    datos.set("evaluationId", evaluationId);
    action(datos);
  }, [ready, action, evaluationId]);

  // Al generar, la pagina tiene que re-renderizar a la rama de resultados: se rindio SIN diagnostico, asi
  // que sin esto el profesional se queda mirando el panel de "generando" con el diagnostico ya hecho.
  useEffect(() => {
    if (state.done) router.refresh();
  }, [state.done, router]);

  if (!ready) {
    // Lo que falta, en el orden del flujo. Los dos pasos viven en la pestana Evaluacion de esta misma pagina
    // (visible arriba); se nombra, no se enlaza, porque las pestanas no son deep-linkables.
    const missing: string[] = [];
    if (!identityConfirmed) missing.push("confirmar la identidad del paciente");
    if (!bisImported) missing.push("importar la medición BIS");
    const falta = missing.length === 1 ? missing[0] : `${missing[0]} y ${missing[1]}`;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-foreground">Esta evaluación aún no tiene un diagnóstico generado.</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Para generarlo falta {falta}. {missing.length === 1 ? "Ese paso vive" : "Esos pasos viven"} en la
          pestaña <span className="font-medium text-foreground">Evaluación</span> de esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-sm text-foreground">
        Todo listo: identidad confirmada y medición BIS importada.
      </p>
      <div className="flex flex-col items-center gap-2">
        {state.error ? (
          <p className="max-w-prose text-sm font-medium text-destructive">{state.error}</p>
        ) : null}
        {/* Encuesta incompleta: no queda bloqueado a ciegas. Enlace a completarla (la pagina de editar
            resalta las preguntas que faltan). Gildardo 2026-08-13 §1. */}
        {state.completeHref ? (
          <Link
            href={state.completeHref}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Completar la encuesta con el paciente
          </Link>
        ) : null}
        {/* EL BOTON SOLO REAPARECE SI FALLO. Con el camino feliz automatico, un boton permanente seria
            un mando que no hace falta pulsar; pero cuando el intento fallo (encuesta incompleta, y el
            profesional acaba de completarla en otra pestaña) hace falta una via para reintentar sin
            recargar. Es la misma pieza, ofrecida solo cuando sirve. */}
        {state.error ? (
          <form onSubmit={enviarSinReset(action)}>
            <input type="hidden" name="evaluationId" value={evaluationId} />
            <Button type="submit" disabled={pending}>
              {pending ? "Generando..." : "Reintentar"}
            </Button>
          </form>
        ) : (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {pending ? "Generando el diagnóstico..." : "Preparando el diagnóstico..."}
          </p>
        )}
        <p className="max-w-prose text-xs text-muted-foreground">
          Genera los indicadores, el diagnóstico, el tratamiento y el reporte con el motor clínico. Se
          genera una sola vez: volver a entrar no lo recalcula.
        </p>
      </div>
    </div>
  );
}
