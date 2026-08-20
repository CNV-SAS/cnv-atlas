"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
// Tipo desde el modulo NEUTRO de tipos, NO desde el reader server-only (este es componente cliente).
import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";
import { SurveyQuestion } from "@/modules/evaluations/components/survey-widgets";
// El MISMO predicado del gate (y del aviso del paciente): una respuesta cuenta como respondida solo si tiene
// valor real, incluida la regla de "Otra" pelada (multi y unica). Antes este form tenia su propio isUnanswered
// que solo miraba ""/"[]" y por eso NO detectaba "Otra" sin texto en ninguna pregunta (tercer sitio divergente).
import { isAnswered } from "@/modules/clinical-pipeline/services/survey-completeness";

import { saveSurveyEditAction } from "../actions";

// Formulario de EDICION/COMPLETADO de la encuesta por el profesional, ANTES del diagnostico (a). Reusa
// los widgets del intake (SurveyQuestion), prefilled con la respuesta actual. Pre-diagnostico no hay
// nada sellado, asi que NO versiona ni pide motivo (distinto del flujo de correccion): guarda directo.
// El paso a este modo es DELIBERADO (se entra por un boton desde la vista de solo lectura), para que
// "ver" siga siendo lo por defecto.

// Arma las respuestas del FormData. Multi -> JSON de los textos elegidos; resto -> el valor. Lo vacio no
// se envia (ausencia = sin responder), igual que el intake.
function collectAnswers(fd: FormData, domains: SurveyDomain[]): { questionId: string; answerValue: string }[] {
  const out: { questionId: string; answerValue: string }[] = [];
  for (const dom of domains) {
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
  return out;
}

export function SurveyEditForm({
  evaluationId,
  domains,
  backHref,
}: {
  evaluationId: string;
  domains: SurveyDomain[];
  backHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const totalQuestions = domains.reduce((acc, d) => acc + d.questions.length, 0);
  const missingByDomain = domains.map((d) => d.questions.filter((q) => !isAnswered(q.answerValue)).length);
  const totalMissing = missingByDomain.reduce((a, b) => a + b, 0);

  // El envio va por onSubmit + startTransition (no la prop `action`): la prop resetea los inputs no
  // controlados de React 19 tras la accion, borrando lo que el profesional lleno si algo falla.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const answers = collectAnswers(new FormData(e.currentTarget), domains);
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

      {domains.map((dom, i) => (
        <details key={dom.section} className="rounded-xl border border-border" open={missingByDomain[i] > 0}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
            {dom.section}{" "}
            <span className="font-normal text-muted-foreground">
              ({dom.questions.length} preguntas
              {missingByDomain[i] > 0 ? ` · ${missingByDomain[i]} sin responder` : ""})
            </span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-border p-4">
            {dom.questions.map((q) => (
              <SurveyQuestion
                key={q.questionId}
                q={{
                  id: q.questionId,
                  number: q.number,
                  text: q.questionText,
                  hint: q.questionHint,
                  type: q.questionType,
                  section: dom.section,
                  options: q.options.map((o, idx) => ({ id: `${q.questionId}-${idx}`, text: o })),
                }}
                answer={q.answerValue}
              />
            ))}
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
