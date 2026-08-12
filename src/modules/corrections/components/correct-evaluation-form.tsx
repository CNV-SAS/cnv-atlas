"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// Tipo desde el modulo neutro de tipos, NO desde el reader `server-only` (este es un componente cliente).
import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";
import { SurveyQuestion } from "@/modules/evaluations/components/survey-widgets";

import { correctEvaluationAction } from "../actions";

// Formulario de CORRECCIÓN de la encuesta (S2, checkpoint 1). Muestra todas las preguntas agrupadas por
// dominio (colapsadas), prefilled con la respuesta actual; el profesional cambia la(s) equivocada(s),
// escribe el motivo, y confirma viendo la LISTA DE CAMBIOS (para detectar un clic accidental antes de
// un acto irreversible). Sin cambios reales, no se puede corregir (bloqueo, no error). El mismo
// formulario servirá para COMPLETAR (D-007), con otro envoltorio.

function decodeMulti(v: string | null): string[] {
  if (!v) return [];
  try {
    const p: unknown = JSON.parse(v);
    return Array.isArray(p) ? p.map(String) : [v];
  } catch {
    return [v];
  }
}

type Change = {
  questionId: string;
  question: string;
  before: string;
  after: string;
  added: string[];
  removed: string[];
  isMulti: boolean;
};

// Una respuesta cuenta como SIN RESPONDER si esta vacia (null, cadena vacia, o multi vacio "[]").
// Solo informa cuanto falta; NO bloquea (el profesional completa de a poco, ver D-007).
function isUnanswered(answerValue: string | null): boolean {
  const v = (answerValue ?? "").trim();
  return v === "" || v === "[]";
}

// Lee el FormData y compara con las respuestas originales -> los cambios REALES (con su antes/después).
function computeChanges(fd: FormData, domains: SurveyDomain[]): Change[] {
  const changes: Change[] = [];
  for (const dom of domains) {
    for (const q of dom.questions) {
      const name = `answer_${q.questionId}`;
      if (q.questionType === "opcion_multiple") {
        const before = decodeMulti(q.answerValue).sort();
        const after = fd.getAll(name).map(String).sort();
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          changes.push({
            questionId: q.questionId,
            question: q.questionText,
            before: before.join(", ") || "(nada)",
            after: JSON.stringify(after),
            added: after.filter((x) => !before.includes(x)),
            removed: before.filter((x) => !after.includes(x)),
            isMulti: true,
          });
        }
      } else {
        const before = (q.answerValue ?? "").trim();
        const after = ((fd.get(name) as string | null) ?? "").trim();
        if (before !== after) {
          changes.push({
            questionId: q.questionId,
            question: q.questionText,
            before: before || "(sin responder)",
            after: after || "(sin responder)",
            added: [],
            removed: [],
            isMulti: false,
          });
        }
      }
    }
  }
  return changes;
}

export function CorrectEvaluationForm({
  evaluationId,
  domains,
  warnings,
  backHref,
}: {
  evaluationId: string;
  domains: SurveyDomain[];
  // Líneas condicionales de la confirmación (pérdidas del tratamiento, aprobación, reporte enviado,
  // modelo cambiado). Las computa la página server-side; el formulario solo las muestra.
  warnings: string[];
  backHref: string;
}) {
  const [stage, setStage] = useState<"edit" | "confirm">("edit");
  const [changes, setChanges] = useState<Change[]>([]);
  const [reason, setReason] = useState("");
  const [emptyBlock, setEmptyBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Guarda el FormData del paso de edición para no re-leerlo al confirmar (el DOM del form se oculta).
  const [fdSnapshot, setFdSnapshot] = useState<FormData | null>(null);

  // Conteo de lo que falta (solo informa; no cambia el comportamiento). Por dominio, total, y cuantas
  // de las que faltan alimentan el diagnostico (used_in_diagnosis): esas son las que mantienen el
  // diagnostico incompleto, a priorizar al completar en consulta.
  const missingByDomain = domains.map((d) => d.questions.filter((q) => isUnanswered(q.answerValue)).length);
  const totalQuestions = domains.reduce((n, d) => n + d.questions.length, 0);
  const totalMissing = missingByDomain.reduce((n, m) => n + m, 0);
  const missingDiagnosis = domains.reduce(
    (n, d) => n + d.questions.filter((q) => isUnanswered(q.answerValue) && q.usedInDiagnosis).length,
    0,
  );

  function onReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ch = computeChanges(fd, domains);
    if (ch.length === 0) {
      setEmptyBlock(true);
      return;
    }
    setEmptyBlock(false);
    setChanges(ch);
    setFdSnapshot(fd);
    setStage("confirm");
  }

  function onConfirm() {
    if (!fdSnapshot) return;
    const correctedAnswers = changes.map((c) => ({
      questionId: c.questionId,
      answerValue: c.isMulti
        ? c.after // ya es JSON de las opciones nuevas
        : ((fdSnapshot.get(`answer_${c.questionId}`) as string | null) ?? ""),
    }));
    startTransition(async () => {
      const res = await correctEvaluationAction({ evaluationId, correctedAnswers, reason: reason.trim() });
      if (res.error) setError(res.error);
      // Va a la evaluación NUEVA (la vigente), no a la vieja (ahora reemplazada): quedarse en la vieja
      // dejaría al profesional leyendo datos obsoletos sin saberlo.
      else if (res.newEvaluationId) window.location.href = `/evaluaciones/${res.newEvaluationId}`;
      else window.location.href = backHref; // defensivo: sin id nuevo, al menos refresca la vista
    });
  }

  if (stage === "confirm") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Confirmar la corrección</h2>
        <p className="text-sm text-muted-foreground">Revisa los cambios antes de continuar. Esto genera una versión nueva.</p>

        <section className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Cambios ({changes.length})</h3>
          <ul className="flex flex-col gap-2">
            {changes.map((c) => (
              <li key={c.questionId} className="text-sm">
                <span className="font-medium text-foreground">{c.question}: </span>
                {c.isMulti ? (
                  <span className="text-muted-foreground">
                    {c.added.length ? `agregaste ${c.added.join(", ")}` : ""}
                    {c.added.length && c.removed.length ? "; " : ""}
                    {c.removed.length ? `quitaste ${c.removed.join(", ")}` : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    de &quot;{c.before}&quot; a &quot;{c.after}&quot;
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm text-foreground">
          <span className="font-medium">Motivo:</span> {reason.trim()}
        </p>
        <p className="text-sm text-muted-foreground">
          Se rehace el diagnóstico, el tratamiento y el reporte con los datos corregidos. La versión actual NO se
          borra: queda registrada como reemplazada.
        </p>
        {warnings.length ? (
          <ul className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex gap-3">
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Corrigiendo…" : "Corregir"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStage("edit")} disabled={pending}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onReview} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Corrige la(s) respuesta(s) equivocada(s). Al continuar verás la lista de cambios antes de confirmar.
      </p>

      {/* Alcance honesto (CP3): aquí solo se corrige la encuesta. La medición del equipo y la identidad
          no se corrigen aquí; el Biody equivocado se resuelve cerrando la evaluación (vía aún no
          construida, va por soporte). Sin este aviso el profesional busca, no encuentra y cree que no
          se permite. */}
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Aquí corriges las respuestas de la encuesta. La medición del equipo (Biody) y la identidad del
        paciente no se corrigen aquí. Si importaste la medición del paciente equivocado, esa evaluación
        debe cerrarse y hacerse de nuevo con el archivo correcto; esa opción todavía no está disponible,
        escríbele a soporte.
      </div>

      {totalMissing > 0 ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
          {totalMissing === 1 ? "Falta 1 respuesta" : `Faltan ${totalMissing} respuestas`} de {totalQuestions}.
          {missingDiagnosis > 0 ? (
            <>
              {" "}
              De las que faltan, {missingDiagnosis} {missingDiagnosis === 1 ? "alimenta" : "alimentan"} el
              diagnóstico.
            </>
          ) : null}
          <span className="mt-1 block text-xs text-muted-foreground">
            Puedes completar de a poco, en varias consultas; no hace falta responderlas todas ahora.
          </span>
        </div>
      ) : null}

      {domains.map((dom, i) => (
        <details key={dom.section} className="rounded-xl border border-border">
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
                q={{ id: q.questionId, number: q.number, text: q.questionText, hint: q.questionHint, type: q.questionType, section: dom.section, options: q.options.map((o, i) => ({ id: `${q.questionId}-${i}`, text: o })) }}
                answer={q.answerValue}
              />
            ))}
          </div>
        </details>
      ))}

      {/* El motivo vive cerca del botón de enviar (no al final tras todas las preguntas): es obligatorio. */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4">
        <Label htmlFor="reason" className="text-sm font-medium text-foreground">
          Motivo de la corrección (obligatorio)
        </Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Por qué corriges (p. ej. dato mal digitado en la encuesta)."
          className="min-h-16"
        />
        {emptyBlock ? (
          <p className="text-sm text-destructive">No cambiaste ninguna respuesta: no hay nada que corregir.</p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={!reason.trim()}>
            Revisar cambios
          </Button>
          <Button asChild type="button" variant="outline">
            <a href={backHref}>Cancelar</a>
          </Button>
        </div>
        {!reason.trim() ? (
          <p className="text-xs text-muted-foreground">Escribe el motivo para poder continuar.</p>
        ) : null}
      </div>
    </form>
  );
}
