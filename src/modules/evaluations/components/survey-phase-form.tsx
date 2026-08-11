"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { saveProgressAction, submitSurveyAnswersAction } from "../actions";
import type { SaveProgressState, SurveyFormState } from "../validations";
import type { SurveyQuestionView } from "../data/survey-view-types";
import { SurveyQuestion } from "./survey-widgets";

// FASE 2 del intake: la ENCUESTA. Se llega aqui ya firmado (fase 1) con un resume_token que autentica la
// escritura de respuestas sin sesion. Guarda a medida (al pasar de seccion) para que quien pause y vuelva
// no pierda lo que llevaba, y envia al final. La recoleccion es OPCIONAL: el servidor no exige respuestas.
//
// HAZARDS de navegador (ver CLAUDE.md): (1) keys DISTINTAS en "Siguiente" vs "Enviar"; (2) accion por
// onSubmit + startTransition, NUNCA prop `action` (si el envio falla, el auto-reset de React 19 borraria
// TODAS las respuestas del paciente). No hay OTP en esta fase (el codigo ya se verifico al firmar).

const initialSubmit: SurveyFormState = { error: null, fields: null, done: false };
const initialSave: SaveProgressState = { saved: false, error: null };

export type SurveyPhaseFormProps = {
  resumeToken: string;
  isFollowup: boolean;
  questions: SurveyQuestionView[];
  // Respuestas ya guardadas (reanudacion): questionId -> valor. En el flujo normal (recien firmado) es
  // null y todo arranca en blanco.
  prefill?: Record<string, string> | null;
  // Paso inicial (reanudacion): la ultima seccion con alguna respuesta. En el flujo normal, 0.
  initialStep?: number;
};

export function SurveyPhaseForm({
  resumeToken,
  isFollowup,
  questions,
  prefill = null,
  initialStep = 0,
}: SurveyPhaseFormProps) {
  const [state, submit, submitting] = useActionState(submitSurveyAnswersAction, initialSubmit);
  const [saveState, save, saving] = useActionState(saveProgressAction, initialSave);
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Agrupa las preguntas por dominio (section), preservando el orden del reader.
  const sections = useMemo(() => {
    const groups: { title: string; questions: SurveyQuestionView[] }[] = [];
    for (const q of questions) {
      const title = q.section ?? "Otras";
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.questions.push(q);
      else groups.push({ title, questions: [q] });
    }
    return groups;
  }, [questions]);

  const total = sections.length;
  const clampedInitial = Math.min(Math.max(initialStep, 0), Math.max(total - 1, 0));
  const [step, setStep] = useState(clampedInitial);
  const current = sections[Math.min(step, total - 1)];
  const isLast = step === total - 1;

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Guarda el SNAPSHOT COMPLETO (contrato del writer): lee todo el formulario (todas las secciones estan
  // montadas, solo ocultas) y lo manda. Los guardados se serializan por useActionState; como cada uno
  // lleva todo lo contestado, el ultimo gana y no se pierde nada aunque se avance mientras guarda.
  const persist = () => {
    const form = formRef.current;
    if (!form) return;
    startTransition(() => save(new FormData(form)));
  };

  // Toda navegacion guarda primero (el snapshot captura la seccion que se deja).
  const goTo = (i: number) => {
    if (i < 0 || i > total - 1) return;
    persist();
    setStep(i);
    scrollTop();
  };
  const goNext = () => {
    if (isLast) return;
    persist();
    setStep((s) => Math.min(s + 1, total - 1));
    scrollTop();
  };
  const goBack = () => {
    if (step === 0) return;
    persist();
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  };

  // Envio final SIN auto-reset (onSubmit + transicion): si falla, no borra las respuestas.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => submit(new FormData(e.currentTarget)));
  };

  // Indicador de guardado (no puede mentir): "Guardado" SOLO tras confirmacion del servidor. Un fallo se
  // muestra explicito, con reintento; el envio final manda todo de nuevo, asi que un guardado intermedio
  // fallido no pierde datos, solo el punto de retomado.
  const saveStatus: "saving" | "saved" | "error" | "idle" = saving
    ? "saving"
    : saveState.error
      ? "error"
      : saveState.saved
        ? "saved"
        : "idle";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isLast && e.target instanceof HTMLElement && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="resumeToken" value={resumeToken} />
      <div ref={topRef} />

      {/* Progreso */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Sección {step + 1} de {total}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {current?.title}
            {current ? (
              <span className="ml-2 font-normal text-muted-foreground">
                · {current.questions.length} {current.questions.length === 1 ? "pregunta" : "preguntas"}
              </span>
            ) : null}
          </p>
        </div>
        <Progress value={total > 0 ? Math.round(((step + 1) / total) * 100) : 0} />
        {/* Subpestanas: en la encuesta todas las secciones son alcanzables (la recoleccion es opcional). */}
        <nav aria-label="Secciones de la encuesta" className="flex flex-wrap gap-1.5">
          {sections.map((s, i) => {
            const activo = i === step;
            return (
              <button
                key={`${s.title}-${i}`}
                type="button"
                onClick={() => goTo(i)}
                aria-current={activo ? "step" : undefined}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  activo
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/70"
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </nav>
      </div>

      {state.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {/* Secciones (todas montadas; solo se muestra la actual) */}
      {sections.map((s, i) => {
        const active = step === i;
        return (
          <section key={s.title} className={`flex flex-col gap-4 ${active ? "" : "hidden"}`}>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
              <p className="text-sm text-muted-foreground">
                Responde lo que aplique a tu caso. Puedes dejar en blanco lo que no sepas.
              </p>
            </div>
            {s.questions.map((q) => (
              <SurveyQuestion key={q.id} q={q} answer={prefill?.[q.id] ?? null} />
            ))}
          </section>
        );
      })}

      {/* Navegacion + estado de guardado */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex min-h-5 items-center gap-2 text-xs">
          <span className="text-muted-foreground">Guardamos tu avance cada vez que pasas de sección.</span>
          {saveStatus === "saving" ? (
            <span className="font-medium text-muted-foreground">Guardando…</span>
          ) : saveStatus === "saved" ? (
            <span className="font-medium text-primary">Avance guardado</span>
          ) : saveStatus === "error" ? (
            <span className="flex items-center gap-2 font-medium text-destructive">
              No se pudo guardar el avance.
              <button type="button" onClick={persist} className="underline">
                Reintentar
              </button>
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button key="nav-back" type="button" variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
            Anterior
          </Button>
          {/* keys DISTINTAS a proposito (ver CLAUDE.md): sin ellas React reutiliza el nodo al pasar de
              "Siguiente" a "Enviar" y el navegador auto-envia al entrar a la ultima seccion, perdiendola
              en TODOS los pacientes. Solo se ve en navegador real. */}
          {isLast ? (
            <Button key="nav-submit" type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : isFollowup ? "Enviar seguimiento" : "Enviar"}
            </Button>
          ) : (
            <Button key="nav-next" type="button" onClick={goNext}>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
