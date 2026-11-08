"use client";

import { useActionState, useMemo, useState } from "react";
import { NotebookPen } from "lucide-react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { formatDateTime } from "@/lib/format/date";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAXIMO_DE_LA_OBSERVACION } from "@/modules/treatment/validations";
import { addNoteAction } from "@/modules/treatment/actions";
import {
  observacionesVigentes,
  type ObservacionCruda,
} from "@/modules/reports/data/observaciones-vigentes";
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

type Nota = {
  id: string;
  note: string;
  /** El mensaje que va al informe del paciente. null = esa nota no llevaba. */
  mensajeParaElPaciente: string | null;
  /** Fecha ya formateada, para mostrar. */
  createdAt: string;
  /** El instante real (ISO). Es lo que decide cual es la vigente. */
  creadaEn: string;
  profession: string | null;
};

/**
 * EL MENSAJE VIGENTE: el de la ULTIMA nota QUE TRAIGA uno, con sus versiones anteriores.
 *
 * ═══ "LA ULTIMA QUE TENGA", NO "EL DE LA ULTIMA NOTA" ═══
 *
 * Es la misma regla que el informe (`ultimoMensajeParaElPaciente`), y escrita igual a proposito: si
 * fuera "el de la ultima nota", escribir una nota clinica mas SIN mensaje borraria de la pantalla el
 * mensaje que ya se le habia dejado al paciente, mientras el informe lo sigue llevando. La pantalla
 * diria que no hay mensaje y el paciente recibiria uno.
 */
function mensajesPorFecha(notas: Nota[]): { vigente: Nota; anteriores: Nota[] } | null {
  const conMensaje = notas
    .filter((n) => (n.mensajeParaElPaciente ?? "").trim() !== "")
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
  if (conMensaje.length === 0) return null;
  return { vigente: conMensaje[0], anteriores: conMensaje.slice(1) };
}

export function ObservacionesConsulta({
  evaluationId,
  notas: notasDelServidor,
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

  // ═══ LO GUARDADO APARECE AL INSTANTE, NO CUANDO TERMINE EL REFRESCO (Santiago, 2026-11-08) ═══
  //
  // EL DEFECTO, de su smoke: *"al pulsar «Agregar observación» hay que esperar unos 5 segundos, o
  // recargar, para que el campo se limpie y aparezca la vigente"*.
  //
  // La causa no era el guardado, que es inmediato: la pantalla esperaba al `router.refresh()`, que
  // recompone la PAGINA ENTERA de la evaluacion (encuesta, composicion, diagnostico, tratamiento). Cinco
  // segundos mirando un campo lleno, en consulta y con el paciente delante, es exactamente la ventana en
  // la que alguien vuelve a pulsar. Y esto es append-only: la segunda pulsacion no corrige, DUPLICA.
  //
  // Asi que la accion devuelve la fila que la base acaba de sellar y se pinta ya. El refresco sigue
  // llegando detras y la trae otra vez; se deduplica por `id`, que es lo unico que no depende de que las
  // dos copias se vean iguales.
  const notas = useMemo(() => {
    if (!state.nota) return notasDelServidor;
    if (notasDelServidor.some((n) => n.id === state.nota?.id)) return notasDelServidor;
    const n = state.nota;
    return [
      {
        id: n.id,
        note: n.note,
        mensajeParaElPaciente: n.mensajeParaElPaciente,
        // LA MISMA FUNCION QUE USA EL SERVIDOR para las demas: dos formatos de fecha en la misma lista se
        // ven como dos cosas distintas, y la de arriba seria justo la recien guardada.
        createdAt: formatDateTime(n.createdAt),
        creadaEn: n.createdAt,
        profession: n.profession,
      },
      ...notasDelServidor,
    ];
  }, [state.nota, notasDelServidor]);

  const mensajes = mensajesPorFecha(notas);

  // ¿Hay algo que guardar? Lo informa el bloque de campos. Arranca en  porque el formulario nace
  // vacio, y se reinicia solo: al guardar, el bloque se remonta con su  y vuelve a avisar.
  // ═══ ¿HAY ALGO QUE GUARDAR? Y POR QUÉ LLEVA LA MARCA DEL FORMULARIO AL QUE PERTENECE ═══
  //
  // El bloque de campos se remonta con una `key` derivada del número de notas, así que al guardar los dos
  // campos se vacían. Este estado vive en el PADRE y sobreviviría a ese remonte: el botón quedaría
  // diciendo "Guardar", habilitado, sobre dos campos vacíos, invitando a un envío que el servidor va a
  // rechazar.
  //
  // SE RESUELVE DERIVANDO, NO CON UN EFECTO que lo reponga: el valor se guarda junto con la `key` del
  // formulario que lo produjo, y si esa `key` ya no es la de ahora, no cuenta. Un `setState` dentro de un
  // efecto para reponer un estado es la forma de encadenar renders que el lint prohíbe, y además deja un
  // instante en que el botón dice lo que no es.
  const [escrito, setEscrito] = useState<{ enLaNota: number; hay: boolean }>({
    enLaNota: notas.length,
    hay: false,
  });
  const hayAlgoQueGuardar = escrito.enLaNota === notas.length && escrito.hay;
  const setHayAlgoQueGuardar = (hay: boolean) => setEscrito({ enLaNota: notas.length, hay });

  // MANDA LA MAS RECIENTE Y LAS ANTERIORES QUEDAN PLEGADAS. Es el patron con el que quedo el criterio del
  // profesional (cotejo 2026-09-06, punto 13a), y se trae tal cual porque el problema es el mismo:
  // Santiago pidio poder CORREGIRSE, y `treatment_notes` es append-only por decision de Gildardo (§8).
  // Pisar o borrar iria contra eso; marcar cual VIGE no toca el registro.
  //
  // LA REDUCCION VIENE DEL MISMO MODULO QUE USA EL DOCUMENTO, y esto es la correccion de un defecto real
  // (smoke de Santiago, 2026-09-08): esta pantalla tenia su propia reduccion, tomaba la ULTIMA POSICION,
  // y como el reader trae las notas `ascending: false`, la ultima posicion es la MAS ANTIGUA. Al agregar
  // una observacion nueva salia numerada la primera y se marcaba vigente la vieja.
  //
  // Con una sola definicion compartida, la pantalla y el documento no pueden elegir distinto. Y la
  // eleccion ya no depende de como venga ordenada la lista: se ordena por FECHA, que es lo que "vigente"
  // significa.
  const vigentes = observacionesVigentes(
    notas.map(
      (n): ObservacionCruda => ({
        id: n.id,
        note: n.note,
        fecha: n.createdAt,
        creadaEn: n.creadaEn,
        profesion: n.profession,
      }),
    ),
  );

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
            {vigentes.map((vigente) => {
              const anteriores = vigente.anteriores;
              return (
                <div key={vigente.id} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {vigente.profesion
                      ? (PROFESION_NOTA[vigente.profesion] ?? vigente.profesion)
                      : "Sin profesión registrada"}
                  </p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Observación vigente
                      </span>
                      <span className="text-xs text-muted-foreground">{vigente.fecha}</span>
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
                                Observación {k + 1} de {anteriores.length + 1}
                              </span>
                              <span className="text-xs text-muted-foreground">{n.fecha}</span>
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

        {/* ═══ EL MENSAJE PARA EL PACIENTE, QUE NO SE VEÍA EN NINGUNA PARTE (Santiago, 2026-11-08) ═══

            Su smoke: *"el «Mensaje para el paciente» no se ve en ningún lado después de guardarse; tras
            recargar el campo sale vacío y la profesional no sabe qué le va a llegar al paciente."*

            Y es lo más delicado de los dos textos, porque es el único que SALE DE LA CLÍNICA. Un
            registro que no se puede releer antes de que lo lea su destinatario no se puede corregir: la
            profesional escribía una línea para una persona y la perdía de vista en el mismo acto.

            VA EN SU PROPIO BLOQUE Y NO MEZCLADO con las notas clínicas, a propósito: son dos cosas con
            dos destinos, y ponerlas juntas es lo que hizo falta separar en la 0237. */}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Mensaje para el paciente · va en su informe
            </span>
            {mensajes ? (
              <span className="text-xs text-muted-foreground">{mensajes.vigente.createdAt}</span>
            ) : null}
          </div>
          {mensajes ? (
            <>
              <p className="whitespace-pre-wrap rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
                {mensajes.vigente.mensajeParaElPaciente}
              </p>
              <span className="text-xs text-muted-foreground">
                Es lo que el paciente va a leer al final de su informe. Para cambiarlo, escribe otro
                abajo: el nuevo pasa a ser el vigente y este queda guardado.
              </span>
              {mensajes.anteriores.length ? (
                <details className="rounded-lg border border-dashed border-border">
                  <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground">
                    {mensajes.anteriores.length === 1
                      ? "Ver el mensaje anterior"
                      : `Ver los ${mensajes.anteriores.length} mensajes anteriores`}
                  </summary>
                  <ol className="flex flex-col gap-3 border-t border-border p-4">
                    {mensajes.anteriores.map((n) => (
                      <li key={n.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Mensaje anterior
                          </span>
                          <span className="text-xs text-muted-foreground">{n.createdAt}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                          {n.mensajeParaElPaciente}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm italic text-muted-foreground">
              No le has dejado ningún mensaje. Su informe sale solo, sin texto tuyo.
            </p>
          )}
        </div>

        {puedeEscribir ? (
          // NO se usa la prop `action`: en React 19 resetea el formulario tras la accion, y ahi es donde
          // se pierde lo escrito cuando el servidor rechaza (hazard 2 de CLAUDE.md).
          // `no-print`: las observaciones YA ESCRITAS son registro y van al papel; el campo para
          // escribir una nueva es taller y no (Gildardo, 2026-10-25: la hoja de cada subpestaña va "sin
          // desplegables ni campos vacios"). Un campo de texto vacio impreso es la firma de una captura.
          <form
            onSubmit={enviarSinReset(action)}
            className="no-print flex flex-col gap-2 border-t border-border pt-4"
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
            <CampoDeObservacion key={`nota-${notas.length}`} onHayAlgo={setHayAlgoQueGuardar} />
            <div className="flex flex-wrap items-center gap-3">
              {/* `required` en el campo y no un `disabled` calculado: sin estado controlado, deshabilitar
                  por vacio exigiria volver a controlarlo. El navegador ya impide enviar vacio. */}
              {/* EL BOTON ES DONDE VIVE LA EXIGENCIA desde que la nota dejo de ser obligatoria: pide
                  que haya ALGO (nota, mensaje, o los dos) y LO DICE EN SU ROTULO. Un boton muerto sin
                  explicacion es peor que un error claro (hazard 8). */}
              <Button type="submit" size="sm" disabled={pending || !hayAlgoQueGuardar}>
                {pending
                  ? "Guardando..."
                  : hayAlgoQueGuardar
                    ? "Guardar"
                    : "Escribe la nota o el mensaje"}
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

/**
 * Los DOS campos que se escriben en el mismo acto: la nota clinica y el mensaje para el paciente.
 *
 * ═══ POR QUE SON DOS, Y POR QUE EL TOPE ESTA EN EL SEGUNDO (Santiago, 2026-11-07) ═══
 *
 * Hasta el 6 de noviembre habia UN campo que hacia los dos trabajos: era la nota clinica (sale en la
 * historia clinica, la leen los otros profesionales) y era ademas el texto que el PACIENTE recibia con su
 * informe. De ahi salieron dos cosas malas a la vez: la nota clinica, que se escribe para otro
 * profesional, le llegaba a la persona tal cual; y se le habia puesto un tope de 200 caracteres a un
 * registro clinico por una razon de PAPEL (que el informe inicial quepa en una hoja).
 *
 * Ahora la nota clinica no tiene tope y el mensaje si, porque ahi los 200 caracteres son su propia razon:
 * es lo que cabe al final del informe con el nombre mas largo de la cohorte y las cinco areas en el nivel
 * peor, MEDIDO renderizando (`MAXIMO_DE_LA_OBSERVACION`, candado `el-informe-maquetado`).
 *
 * ═══ EL CONTADOR SE VE MIENTRAS SE ESCRIBE (Santiago, 2026-11-06) ═══
 *
 * Un tope que solo aparece cuando el servidor rechaza obliga a reescribir lo que ya se penso, y en una
 * pantalla de consulta eso se traduce en que el texto se recorta a lo bruto o no se escribe.
 *
 * EL ESTADO VIVE AQUI DENTRO a proposito: el padre remonta este componente con una `key` derivada del
 * numero de notas guardadas, asi que al guardar se vacian los campos Y el contador. Si el contador viviera
 * arriba, se quedaria marcando los caracteres de la nota anterior sobre un campo vacio.
 */
function CampoDeObservacion({ onHayAlgo }: { onHayAlgo: (v: boolean) => void }) {
  const [largo, setLargo] = useState(0);
  const [hayNota, setNota] = useState(false);
  const [hayMensaje, setMensaje] = useState(false);
  const setHayNota = (v: boolean) => {
    setNota(v);
    onHayAlgo(v || hayMensaje);
  };
  const quedan = MAXIMO_DE_LA_OBSERVACION - largo;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {/* ═══ EL RÓTULO DICE EL DESTINO (Santiago, 2026-11-08) ═══

            Los dos campos se escriben en el mismo acto y van a sitios distintos. Sin decirlo encima de
            cada uno, la única forma de saberlo era leer la línea de abajo, y creer que una nota es
            privada cambia lo que se escribe en ella. */}
        <label className="text-sm font-medium text-foreground" htmlFor="note">
          Nota clínica <span className="font-normal text-muted-foreground">· va a la historia clínica</span>
        </label>
        {/* SIN `maxLength`: es un registro clinico y no se recorta por una razon de maquetacion.
            Y SIN `required`, desde el 2026-11-08: corregir el mensaje al paciente obligaba a escribir
            OTRA nota clinica (esto es append-only), asi que la historia se llenaba de notas que nadie
            quiso escribir. La exigencia no desaparece, se mueve: el boton de abajo pide que haya ALGO,
            y lo dice en su rotulo. Es el hazard 8 de CLAUDE.md: una bandera inerte engaña mas que su
            ausencia, asi que se borra y la regla se rehace donde si se cumple. */}
        <Textarea
          id="note"
          name="note"
          rows={4}
          onChange={(e) => setHayNota(e.currentTarget.value.trim() !== "")}
          placeholder="Qué observaste en esta consulta, qué acordaste con el paciente, qué vigilar en el próximo control"
        />
        <span className="text-xs text-muted-foreground">
          Esta nota es para ti y para los otros profesionales del paciente: sale en la historia clínica y
          no se le envía a él.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground" htmlFor="mensajeParaElPaciente">
          Mensaje para el paciente{" "}
          <span className="font-normal text-muted-foreground">· va en su informe (opcional)</span>
        </label>
        <Textarea
          id="mensajeParaElPaciente"
          name="mensajeParaElPaciente"
          rows={3}
          maxLength={MAXIMO_DE_LA_OBSERVACION}
          onChange={(e) => {
            setLargo(e.currentTarget.value.length);
            const hay = e.currentTarget.value.trim() !== "";
            setMensaje(hay);
            onHayAlgo(hayNota || hay);
          }}
          placeholder="Una línea para él, con tus palabras. Si lo dejas en blanco, el informe sale solo."
        />
        {/* EL AVISO SOLO CAMBIA DE TONO CERCA DEL TOPE: un contador en rojo desde el primer caracter se
            vuelve ruido y se deja de mirar justo cuando empieza a importar. */}
        <span
          className={`self-end text-xs ${quedan <= 20 ? "text-clinical-warning" : "text-muted-foreground"}`}
        >
          {quedan >= 0
            ? `Quedan ${quedan} caracteres de ${MAXIMO_DE_LA_OBSERVACION}`
            : `Te pasaste por ${-quedan} caracteres`}
          {" · "}
          es el único texto tuyo que va en el informe
        </span>
      </div>
    </div>
  );
}
