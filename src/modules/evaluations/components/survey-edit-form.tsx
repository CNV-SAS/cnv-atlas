"use client";

import { preservarScroll } from "@/components/shared/preservar-scroll";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { encabezadoAntesDe } from "@/clinical-engine/encabezados-frecuencia";
import { EncabezadoDeFrecuencia } from "@/modules/evaluations/components/encabezado-frecuencia";
// Tipo desde el modulo NEUTRO de tipos, NO desde el reader server-only (este es componente cliente).
import type { SurveyAnswerView, SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";
import { FiltroDigestivo, PreguntaPorProducto } from "@/modules/evaluations/components/cnvs-widgets";
import { SurveyQuestion } from "@/modules/evaluations/components/survey-widgets";
// El MISMO predicado del gate (y del aviso del paciente): una respuesta cuenta como respondida solo si tiene
// valor real, incluida la regla de "Otra" pelada (multi y unica). Antes este form tenia su propio isUnanswered
// que solo miraba ""/"[]" y por eso NO detectaba "Otra" sin texto en ninguna pregunta (tercer sitio divergente).
import { isAnswered } from "@/modules/clinical-pipeline/services/survey-completeness";
import { noAdherentesAlProducto } from "@/modules/followups/modulo-s";
// LA REGLA DE LO QUE SE PRESENTA, COMPARTIDA CON LA ENCUESTA DEL PACIENTE. Ver su modulo: esta pantalla
// tenia su propia lista ("todas las preguntas del instrumento") y por eso pedia responder una pregunta
// que la CNV-S habia decidido no hacer.
import {
  dominiosQueSePresentan,
  loQueSeConservaSinPreguntar,
  type InsumosParaPresentar,
} from "@/modules/evaluations/lo-que-se-presenta";
import { parsePorProducto } from "@/modules/evaluations/respuesta-en-texto";

import { saveSurveyEditAction } from "../actions";

// Formulario de EDICION/COMPLETADO de la encuesta por el profesional, ANTES del diagnostico (a). Reusa
// los widgets del intake (SurveyQuestion), prefilled con la respuesta actual. Pre-diagnostico no hay
// nada sellado, asi que NO versiona ni pide motivo (distinto del flujo de correccion): guarda directo.
// El paso a este modo es DELIBERADO (se entra por un boton desde la vista de solo lectura), para que
// "ver" siga siendo lo por defecto.

// Arma las respuestas del FormData. Multi -> JSON de los textos elegidos; resto -> el valor. Lo vacio no
// se envia (ausencia = sin responder), igual que el intake.
//
// RECORRE LO QUE SE PRESENTA, NO TODO EL INSTRUMENTO, y lo que no se presenta entra aparte (ver
// `loQueSeConservaSinPreguntar`): el writer reemplaza el snapshot completo, asi que recorrer solo la
// pantalla borraria la herencia de los `retirar` y los siete digestivos que el salto da por "Nunca".
function collectAnswers(
  fd: FormData,
  presentados: SurveyDomain[],
  conservados: { questionId: string; answerValue: string }[],
): { questionId: string; answerValue: string }[] {
  const out: { questionId: string; answerValue: string }[] = [];
  for (const dom of presentados) {
    for (const q of dom.questions) {
      const name = `answer_${q.questionId}`;
      if (q.questionType === "opcion_multiple") {
        const vals = fd.getAll(name).map(String).filter((v) => v !== "");
        if (vals.length > 0) out.push({ questionId: q.questionId, answerValue: JSON.stringify(vals) });
      } else {
        const v = ((fd.get(name) as string | null) ?? "").trim();
        if (v !== "") out.push({ questionId: q.questionId, answerValue: v });
      }
    }
  }
  return [...out, ...conservados];
}

/** La forma de pregunta que piden los widgets, armada desde la vista de respuestas. */
function paraElWidget(q: SurveyAnswerView, section: string) {
  return {
    id: q.questionId,
    number: q.number,
    text: q.questionText,
    hint: q.questionHint,
    type: q.questionType,
    section,
    fieldKey: q.fieldKey,
    options: q.options.map((o, idx) => ({ id: `${q.questionId}-${idx}`, text: o })),
  };
}

export function SurveyEditForm({
  evaluationId,
  domains,
  backHref,
  cnvs = null,
}: {
  evaluationId: string;
  domains: SurveyDomain[];
  backHref: string;
  /**
   * Los insumos de la CNV-S de esta consulta, o `null` si aplico la linea base.
   *
   * SIN ESTO LA PANTALLA NO PUEDE SABER QUE PRESENTAR: los productos indicados en la anterior deciden si
   * el S1 y el S2 existen, y las respuestas de la anterior deciden si el salto digestivo puede aplicar.
   */
  cnvs?: InsumosParaPresentar;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const todas = useMemo(() => domains.flatMap((d) => d.questions), [domains]);
  const itemS1 = useMemo(() => todas.find((q) => q.fieldKey === "cnvs_s1") ?? null, [todas]);
  const itemFiltro = useMemo(
    () => todas.find((q) => q.fieldKey === "cnvs_gi_filtro") ?? null,
    [todas],
  );

  // ═══ EL S1 Y EL FILTRO EN ESTADO, IGUAL QUE EN LA ENCUESTA DEL PACIENTE ═══
  //
  // Los dos deciden que MAS se presenta, y aqui se pueden cambiar en el momento: si la profesional
  // corrige el S1 de un producto a "No lo tomo", el S2 de ese producto tiene que aparecer sin recargar.
  // Arrancan con lo GUARDADO, que es lo que el paciente respondio.
  const [s1PorProducto, setS1PorProducto] = useState<Record<string, string>>(() =>
    parsePorProducto(itemS1?.answerValue ?? null),
  );
  const [filtroGi, setFiltroGi] = useState<string | null>(itemFiltro?.answerValue ?? null);
  const enVivo = useMemo(() => ({ s1: s1PorProducto, filtroGi }), [s1PorProducto, filtroGi]);

  const presentados = useMemo(
    () => dominiosQueSePresentan(domains, cnvs, enVivo),
    [domains, cnvs, enVivo],
  );
  const conservados = useMemo(
    () => loQueSeConservaSinPreguntar(domains, cnvs, enVivo),
    [domains, cnvs, enVivo],
  );
  const noAdherentes = useMemo(() => noAdherentesAlProducto(s1PorProducto), [s1PorProducto]);

  // LOS CONTADORES SALEN DE LA MISMA LISTA QUE SE PINTA. Contarlos sobre el instrumento entero es lo que
  // hacia que la pantalla dijera "falta 1" senalando una pregunta que no esta.
  const totalQuestions = presentados.reduce((acc, d) => acc + d.questions.length, 0);
  const missingByDomain = presentados.map(
    (d) => d.questions.filter((q) => !isAnswered(q.answerValue)).length,
  );
  const totalMissing = missingByDomain.reduce((a, b) => a + b, 0);

  // El envio va por onSubmit + startTransition (no la prop `action`): la prop resetea los inputs no
  // controlados de React 19 tras la accion, borrando lo que el profesional lleno si algo falla.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const answers = collectAnswers(new FormData(e.currentTarget), presentados, conservados);
    // El guard del scroll: invocar una server action navega con ScrollBehavior.Default. Ver
    // `preservar-scroll.ts`. Aqui la accion se llama DIRECTO, sin `useActionState`, asi que no pasa por
    // `enviarSinReset` ni por `ejecutarAccion`.
    preservarScroll();
    startTransition(async () => {
      const res = await saveSurveyEditAction({ evaluationId, answers });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Respuestas guardadas.");
      router.push(backHref);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Completa o corrige las respuestas del paciente. Se guardan directamente (antes del diagnóstico no
        hay nada sellado). Puedes dejar preguntas sin responder.
      </p>

      {totalMissing > 0 ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
          {totalMissing === 1 ? "Falta 1 respuesta" : `Faltan ${totalMissing} respuestas`} de {totalQuestions}.
        </div>
      ) : null}

      {presentados.map((dom, i) => (
        <details key={dom.section} className="rounded-xl border border-border" open={missingByDomain[i] > 0}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
            {dom.section}{" "}
            <span className="font-normal text-muted-foreground">
              ({dom.questions.length} preguntas
              {missingByDomain[i] > 0 ? ` · ${missingByDomain[i]} sin responder` : ""})
            </span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-border p-4">
            {/* Los encabezados de categoria de la matriz de frecuencia: aqui si, en la del paciente no
                (Santiago, 2026-08-31). Ver encabezados-frecuencia.ts para las dos mitades del porque. */}
            {dom.questions.map((q, i) => {
              const encabezado = encabezadoAntesDe(q.fieldKey, dom.questions[i - 1]?.fieldKey ?? null);
              const vista = paraElWidget(q, dom.section);
              return (
                <Fragment key={q.questionId}>
                  {encabezado ? <EncabezadoDeFrecuencia encabezado={encabezado} /> : null}
                  {/* EL ANCLA (2026-09-19): el resumen de la pestaña Evaluación enlaza a la pregunta que
                      falta, y enlaza AQUI, no a la vista de solo lectura: quien va a completar una
                      pregunta quiere el campo, no el dato (Santiago). `scroll-mt` deja sitio para la
                      cabecera; sin eso el salto la deja justo debajo del borde. */}
                  <div id={`p-${q.questionId}`} className="scroll-mt-24">
                    {/* EL FILTRO DIGESTIVO, CONTROLADO: su respuesta decide si los siete siguientes se
                        presentan, así que la pantalla tiene que saberla en el momento (igual que en la
                        encuesta del paciente; los widgets normales guardan su valor dentro de sí). */}
                    {cnvs && itemFiltro && q.questionId === itemFiltro.questionId ? (
                      <FiltroDigestivo q={vista} valor={filtroGi} onValor={setFiltroGi} />
                    ) : /* ═══ EL S1 Y EL S2 SE PINTAN CON SU PROPIO CONTROL (smoke, 2026-11-09) ═══

                        Su tipo es `opcion_por_producto` y guardan {idDelProducto: opcion}, así que el
                        widget normal caía en su campo de texto de respaldo: la profesional veía el
                        objeto JSON en una caja, editable a mano. Es el MISMO control que ve el
                        paciente, con los productos que el lector ya resolvió por su nombre. */
                    q.questionType === "opcion_por_producto" ? (
                      <PreguntaPorProducto
                        q={vista}
                        productos={Object.entries(q.nombresDeProductos ?? {}).map(([id, nombre]) => ({
                          id,
                          nombre,
                          dosis: null,
                        }))}
                        answer={q.answerValue}
                        // EL S2 SOLO PARA LOS PRODUCTOS NO ADHERENTES, y el S1 informa hacia arriba de lo
                        // que se va eligiendo: son las dos mitades de su §2.3, las mismas que en la
                        // encuesta del paciente.
                        soloSiNoAdherente={q.fieldKey === "cnvs_s2" ? noAdherentes : undefined}
                        onValores={q.fieldKey === "cnvs_s2" ? undefined : setS1PorProducto}
                      />
                    ) : (
                      <SurveyQuestion q={vista} answer={q.answerValue} />
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </details>
      ))}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar respuestas"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(backHref)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
