"use client";

import { useActionState } from "react";
import { NotebookPen } from "lucide-react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNoteAction } from "@/modules/treatment/actions";
import { PROFESION_NOTA } from "@/modules/treatment/data/treatment-view-types";

// OBSERVACIONES DE LA CONSULTA · EN SEGUIMIENTO, QUE ES DONDE SU ARCHIVO LAS TIENE (2026-09-08).
//
// LA HISTORIA COMPLETA, porque sin ella esto parece un campo que va y viene:
//
//   · 2026-08-26 §8.3 — Gildardo: "deben aparecer en la historia. Y POR CONSULTA, NO POR PACIENTE". Se
//     cablearon a la HC (`HcObservaciones`), donde siguen apareciendo hoy.
//   · 2026-09-05, cotejo punto 26 — Santiago retiro el CAMPO del panel de Tratamiento: "el html no lo
//     tiene". Y tenia razon: su archivo NO las tiene en Tratamiento. Las tiene en SEGUIMIENTO, dentro
//     del formulario de proximo control.
//   · Resultado: quedaron con LECTOR y SIN ESCRITOR tres dias. Medido: CERO filas en las dos bases, asi
//     que el bloque de la historia clinica salia vacio para todos. Esta pantalla es la mitad que faltaba.
//
// NO SE CREO UNA TABLA NUEVA, y esa fue la decision que casi se toma mal: iba a añadir una columna
// `treatments.observaciones`, mutable y unica. Habria sido una CUARTA superficie de nota que ademas
// reintroducia el defecto que el mismo diagnostico en su archivo (`onConflict: 'documento'`, cada control
// pisando al anterior). Se escribe en `treatment_notes`, que ya es POR CONSULTA, APPEND-ONLY y con la
// PROFESION sellada en el acto (su §8 del 2026-08-30: "cada rol escribe lo suyo y no se pisan").

type Nota = { id: string; note: string; createdAt: string; profession: string | null };

export function ObservacionesConsulta({
  evaluationId,
  notas,
  puedeEscribir,
}: {
  evaluationId: string;
  notas: Nota[];
  /** Sin tratamiento no hay donde colgar la nota (el diagnostico todavia no se confirmó). */
  puedeEscribir: boolean;
}) {
  const [state, action, pending] = useActionState(addNoteAction, {
    error: null,
    success: null,
    warning: null,
  });
  useFormToastAndRefresh(state);

  // MANDA LA ULTIMA Y LAS ANTERIORES QUEDAN PLEGADAS. Es el patron con el que quedo el criterio del
  // profesional (cotejo 2026-09-06, punto 13a), y se trae tal cual porque el problema es el mismo:
  // Santiago pidio poder CORREGIRSE, y `treatment_notes` es append-only por decision de Gildardo (§8).
  // Pisar o borrar iria contra eso; marcar cual VIGE no toca el registro. Lo que se decide aqui es cual
  // MANDA, no cual existe.
  //
  // POR PROFESION, que es la otra mitad de su §8: cada rol tiene SU vigente. La ultima nota del medico no
  // deja de valer porque la nutricionista escriba despues.
  const porProfesion = new Map<string, Nota[]>();
  for (const n of notas) {
    const k = n.profession ?? "sin-profesion";
    porProfesion.set(k, [...(porProfesion.get(k) ?? []), n]);
  }

  return (
    // EL MISMO TRATAMIENTO VISUAL QUE TENIA EL CRITERIO DEL PROFESIONAL EN DIAGNOSTICO: es la misma pieza
    // movida de sitio, y darle otro aspecto la haria parecer otra cosa. Franja de encabezado tenida, no
    // borde discontinuo (que en la app significa "aqui no hay nada todavia").
    <section className="flex flex-col overflow-hidden rounded-xl border border-primary/40 bg-card">
      <div className="flex flex-col gap-2 border-b border-primary/30 bg-primary/5 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* EL ANTETITULO ES EL NOMBRE DE SU SECCION. Su ModSeguimiento las llama "Observaciones", dentro
              del formulario del proximo control. */}
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Seguimiento · Observaciones
          </span>
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            Lo escribes tú
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotebookPen className="size-4 shrink-0 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">Observaciones de la consulta</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tu registro clínico de esta consulta. <strong>Sale en la historia clínica</strong>, agrupado por
          profesión. Se agrega al historial (no se reescribe): si te corriges, la nueva pasa a ser la
          vigente y la anterior queda plegada.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        {notas.length > 0 ? (
          <div className="flex flex-col gap-4">
            {[...porProfesion.entries()].map(([prof, lista]) => {
              const vigente = lista[lista.length - 1];
              const anteriores = lista.slice(0, -1);
              return (
                <div key={prof} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {PROFESION_NOTA[prof] ?? "Sin profesión registrada"}
                  </p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Observación vigente
                      </span>
                      <span className="text-xs text-muted-foreground">{vigente.createdAt}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {vigente.note}
                    </p>
                  </div>
                  {anteriores.length ? (
                    <details className="rounded-lg border border-dashed border-border">
                      <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground">
                        {anteriores.length === 1
                          ? "Ver la observación anterior"
                          : `Ver las ${anteriores.length} observaciones anteriores`}
                      </summary>
                      <ol className="flex flex-col gap-3 border-t border-border p-4">
                        {anteriores.map((n, k) => (
                          <li key={n.id} className="rounded-lg border border-border p-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Observación {k + 1} de {lista.length}
                              </span>
                              <span className="text-xs text-muted-foreground">{n.createdAt}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                              {n.note}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm italic text-muted-foreground">
            Aún no has registrado observaciones para esta consulta.
          </p>
        )}

        {puedeEscribir ? (
          // NO se usa la prop `action`: en React 19 resetea el formulario tras la accion, y ahi es donde
          // se pierde lo escrito cuando el servidor rechaza (hazard 2 de CLAUDE.md).
          <form
            onSubmit={enviarSinReset(action)}
            className="flex flex-col gap-2 border-t border-border pt-4"
          >
            <input type="hidden" name="evaluationId" value={evaluationId} />
            {/* EL CAMPO SE VACIA AL GUARDAR, y la forma importa. Dejar el texto invita a pulsar dos
                veces, y como esto es append-only la segunda pulsacion no corrige: DUPLICA una nota que
                despues no se puede borrar.

                SE VACIA CON UNA `key` DERIVADA DE LO QUE EL SERVIDOR YA GUARDO, no con estado ni con un
                efecto: cuando la nota entra, `notas.length` cambia, el campo se remonta y sale vacio. Asi
                se vacia cuando la nota EXISTE, no cuando la accion vuelve, y si el servidor rechaza el
                texto se queda donde estaba. Es el mismo patron que usan las medidas de Antropometria, y
                NO reabre el hazard 2: un remonte por dato nuevo no es un `form.reset()`. */}
            <Textarea
              key={`nota-${notas.length}`}
              name="note"
              rows={4}
              required
              placeholder="Qué observaste en esta consulta, qué acordaste con el paciente, qué vigilar en el próximo control"
            />
            <div className="flex flex-wrap items-center gap-3">
              {/* `required` en el campo y no un `disabled` calculado: sin estado controlado, deshabilitar
                  por vacio exigiria volver a controlarlo. El navegador ya impide enviar vacio. */}
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Agregando..." : "Agregar observación"}
              </Button>
              {/* LA CONSECUENCIA, DONDE SE PULSA (leccion del punto 13: a media pantalla del boton no se
                  lee). Y se dice que sale en la historia clinica, porque creer que una nota es privada
                  cambia lo que se escribe en ella. */}
              <span className="text-xs text-muted-foreground">
                Queda registrada y sale en la historia clínica. No se puede borrar: si te corriges, la
                nueva pasa a ser la vigente.
              </span>
            </div>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">
            Podrás escribir observaciones cuando el diagnóstico esté confirmado y exista el tratamiento.
          </p>
        )}
      </div>
    </section>
  );
}
