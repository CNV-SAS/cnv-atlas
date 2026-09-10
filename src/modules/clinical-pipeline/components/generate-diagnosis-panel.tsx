"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { useEtapaActiva } from "@/modules/diagnoses/components/etapa-activa";
import { etiquetaDeEtapa } from "@/modules/diagnoses/etapas";

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
  //
  // ═══ "AL ENTRAR" ES ESTAR A LA VISTA, NO ESTAR MONTADO (2026-09-10) ═══
  //
  // EL DEFECTO, del smoke: Santiago entro a Diagnostico SIN el BIS importado y vio el bloqueo correcto. Se
  // fue a Antrop. & BIS, importo el xlsx, y **el diagnostico se genero solo**, sin volver a esta pestaña y
  // sin que hubiera puesto el peso meta ni la fuerza prensil. Es justo lo que este disparador existe para
  // no hacer: diagnosticar sobre datos que el profesional todavia va a tocar.
  //
  // FUERON LAS DOS COSAS A LA VEZ, y ninguna bastaba sola:
  //   · El efecto quedo ARMADO. Hasta el 2026-09-09 cambiar de pestaña desmontaba esta, asi que el efecto
  //     solo podia correr estando aqui. Al hacer que una etapa visitada NO se desmonte (para no perder el
  //     borrador del tratamiento) el panel siguio vivo en segundo plano.
  //   · Y el REFRESCO del import reevaluo la condicion: `bisImported` volteo a true, `ready` con el, y el
  //     efecto corrio sin que hubiera navegacion ninguna.
  //
  // POR ESO CUELGA DE `activa` Y NO SOLO DE `ready`: el disparo ocurre al ENTRAR a la pestaña. Con la
  // condicion cumplida desde otra, no pasa nada hasta que el profesional llega aqui.
  //
  // Y NO VUELVE A CORRER AL ENTRAR, SALIR Y VOLVER: `disparado` es un ref y el panel no se desmonta. Si
  // ademas la pagina se recarga entera, este panel solo se rinde cuando NO hay diagnostico, asi que
  // tampoco hay segundo intento. La guarda de base (`PipelineAlreadyRunError`) sigue detras de las dos.
  const activa = useEtapaActiva();
  const disparado = useRef(false);
  useEffect(() => {
    if (!activa || !ready || disparado.current) return;
    disparado.current = true;
    const datos = new FormData();
    datos.set("evaluationId", evaluationId);
    action(datos);
  }, [activa, ready, action, evaluationId]);

  // Al generar, la pagina tiene que re-renderizar a la rama de resultados: se rindio SIN diagnostico, asi
  // que sin esto el profesional se queda mirando el panel de "generando" con el diagnostico ya hecho.
  useEffect(() => {
    if (state.done) router.refresh();
  }, [state.done, router]);

  if (!ready) {
    // LO QUE FALTA, Y DONDE VIVE. Cada paso se nombra CON SU PESTAÑA, y la etiqueta sale del mapa de
    // etapas, no escrita aqui: este texto mandaba a "la pestaña Evaluación" y esa pestaña dejo de existir
    // al partirla en Encuesta + Antrop. & BIS. Sobrevivio semanas porque una cadena no sabe que su premisa
    // cambio. Derivarla es lo unico que hace que se renombre sola.
    //
    // Y LA IDENTIDAD YA NO ES UN PASO QUE SE PULSA (2026-09-09): se confirma sola al abrir. Que siga sin
    // confirmar significa que ALGO LA IMPIDIO (tipicamente la rama de consentimiento incoherente con la
    // fecha de nacimiento), asi que el aviso dice eso y no "ve a pulsar un boton que ya no existe".
    const falta: string[] = [];
    if (!identityConfirmed) {
      falta.push(
        `la identidad no se pudo confirmar; el aviso con el motivo está en ${etiquetaDeEtapa("encuesta")}`,
      );
    }
    if (!bisImported) falta.push(`importar la medición BIS, en ${etiquetaDeEtapa("antro")}`);
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-foreground">Esta evaluación aún no tiene un diagnóstico generado.</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Falta {falta.length === 1 ? falta[0] : `${falta[0]}, y ${falta[1]}`}.
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
            {/* TRES ESTADOS, NO DOS (Santiago, 2026-09-09: "es necesario esperar segundos?").
                El motor NO es lo lento: el pipeline completo contra base de datos son ~600-830 ms
                medidos (`pipeline-propagation.test.ts`). Los segundos son el `router.refresh()` de
                arriba, que vuelve a rendir la pagina entera contra la nube.
                Y en ESE tramo, que es el largo, el texto decia "Preparando el diagnóstico...", porque
                `pending` ya es false: afirmaba estar preparando algo que ya habia terminado. Es la
                misma familia de los dos textos que se barrieron el 2026-09-09, y el arreglo es el
                mismo: derivar del estado real en vez de leer una sola bandera. */}
            {state.done
              ? "Diagnóstico generado. Cargando los resultados..."
              : pending
                ? "Generando el diagnóstico..."
                : "Preparando el diagnóstico..."}
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
