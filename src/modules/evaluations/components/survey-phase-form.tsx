"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { isAnswered } from "@/modules/clinical-pipeline/services/survey-completeness";

import { saveProgressAction, submitSurveyAnswersAction } from "../actions";
import type { SaveProgressState, SurveyFormState } from "../validations";
import type { SurveyQuestionView } from "../data/survey-view-types";
import { AboutYouSection, type AboutYouPrefill } from "./about-you-section";
import { ResumeLinkBox } from "./resume-link-box";
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
  // Paso inicial (reanudacion): la ultima seccion DE ENCUESTA con alguna respuesta. En el flujo normal, 0.
  initialStep?: number;
  // Caracterizacion ya guardada (reanudacion), para no perderla al reanudar.
  characterizationPrefill?: AboutYouPrefill | null;
  // Etnia: el campo solo aparece si el paciente otorgo la autorizacion de investigacion (consent v1.0).
  ethnicityAuthorized?: boolean;
};

// Introduccion por seccion (ECA2): encuadra la pregunta ANTES de responder. La de Alimentacion es la que
// mas cambia el dato de origen ("piensa en como comes habitualmente, no en lo que comiste ayer" evita que
// el paciente responda por el ultimo dia). Verbatim de ATLAS_v8.html. Keyed por la etiqueta de seccion.
const SECTION_INTRO: Record<string, string> = {
  Alimentación:
    "Piensa en cómo comes habitualmente, no en lo que comiste ayer. Para cada alimento, elige con qué frecuencia lo consumes en una semana típica. La referencia debajo de cada grupo te ayuda a imaginar la cantidad usual.",
};

export function SurveyPhaseForm({
  resumeToken,
  isFollowup,
  questions,
  prefill = null,
  initialStep = 0,
  characterizationPrefill = null,
  ethnicityAuthorized = false,
}: SurveyPhaseFormProps) {
  const [state, submit, submitting] = useActionState(submitSurveyAnswersAction, initialSubmit);
  const [saveState, save, saving] = useActionState(saveProgressAction, initialSave);
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // En seguimiento el perfil ya se capturo (dato estable): "Sobre ti" solo muestra el motivo. En inicial
  // muestra los 4 campos de perfil + motivo.
  const includeProfile = !isFollowup;

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

  // El wizard tiene "Sobre ti" como paso 0 y luego las secciones de encuesta (pasos 1..N). Se arranca en
  // "Sobre ti" salvo al reanudar CON respuestas: ahi se aterriza en la seccion donde iba (initialStep+1).
  const totalSteps = sections.length + 1;
  const resuming = Boolean(prefill && Object.keys(prefill).length > 0);
  const initialWizardStep = resuming
    ? Math.min(Math.max(initialStep, 0), sections.length - 1) + 1
    : 0;
  const [step, setStep] = useState(initialWizardStep);
  // Advertencia de envio con preguntas sin responder (no bloquea): al pulsar "Enviar", si faltan, se
  // muestra el conteo y se deja enviar igual. null = sin advertencia pendiente.
  const [confirmMissing, setConfirmMissing] = useState<number | null>(null);
  const isAbout = step === 0;
  const current = isAbout ? null : sections[step - 1];
  const isLast = step === totalSteps - 1;

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Guarda el SNAPSHOT COMPLETO (contrato del writer): lee todo el formulario (todas las secciones estan
  // montadas, solo ocultas) y lo manda. Los guardados se serializan por useActionState; como cada uno
  // lleva todo lo contestado, el ultimo gana y no se pierde nada aunque se avance mientras guarda.
  const persist = () => {
    const form = formRef.current;
    if (!form) return;
    startTransition(() => save(new FormData(form)));
  };

  // Toda navegacion guarda primero (el snapshot captura la seccion que se deja). Navegar tambien
  // descarta la advertencia pendiente: el paciente esta revisando, ya no esta en el punto de envio.
  const goTo = (i: number) => {
    if (i < 0 || i > totalSteps - 1) return;
    persist();
    setConfirmMissing(null);
    setStep(i);
    scrollTop();
  };
  const goNext = () => {
    if (isLast) return;
    persist();
    setConfirmMissing(null);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
    scrollTop();
  };
  const goBack = () => {
    if (step === 0) return;
    persist();
    setConfirmMissing(null);
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  };

  // Preguntas de encuesta sin responder, con EL MISMO predicado que el gate del profesional (isAnswered).
  // Antes contaba "cualquier valor no vacio", asi que una multi con "Otra" SIN texto (emitida como el token
  // pelado) se contaba como respondida aqui pero el gate la veia como hueco: dos varas para lo mismo, y el
  // paciente veia la que miente. Ahora se reconstruye el valor TAL COMO lo guarda el servidor (multi -> JSON,
  // resto -> el valor) y se evalua con el mismo isAnswered. "Sobre ti" es opcional y NO cuenta aqui.
  const countUnanswered = (form: HTMLFormElement): number => {
    const fd = new FormData(form);
    let missing = 0;
    for (const q of questions) {
      const raw = fd
        .getAll(`answer_${q.id}`)
        .map((v) => String(v).trim())
        .filter((v) => v !== "");
      const stored =
        q.type === "opcion_multiple" ? (raw.length ? JSON.stringify(raw) : "") : (raw[0] ?? "");
      if (!isAnswered(stored)) missing += 1;
    }
    return missing;
  };

  // Envio real, SIN auto-reset (transicion sobre el form del ref, no la prop `action`): si falla, no
  // borra las respuestas del paciente (hazard React 19, ver CLAUDE.md).
  const doSubmit = () => {
    const form = formRef.current;
    if (!form) return;
    setConfirmMissing(null);
    startTransition(() => submit(new FormData(form)));
  };

  // "Enviar": si faltan preguntas y aun no se advirtio, muestra el aviso y NO envia todavia (una sola
  // vez; el propio boton de "Enviar" ya no vuelve a frenar porque el aviso trae su propio "Enviar asi").
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const missing = countUnanswered(form);
    if (missing > 0) {
      // El aviso aparece pegado al boton (abajo): no se hace scroll, se veria fuera de pantalla.
      setConfirmMissing(missing);
      return;
    }
    doSubmit();
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

      {/* Enlace de reanudacion + aviso de que puede pausar. Al inicio de la fase 2 (no en una pantalla
          aparte): el paciente lo ve y lo puede copiar ANTES de empezar, no solo tras guardar. */}
      <ResumeLinkBox resumeToken={resumeToken} />

      {/* Progreso */}
      <div className="flex flex-col gap-2">
        {/* El TITULO de la seccion ya va en el h2 de abajo: aqui salia dos veces, con los chips en medio.
            En un telefono eso son dos renglones de una pantalla que todavia no muestra ninguna pregunta. */}
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Paso {step + 1} de {totalSteps}
          </p>
          {current ? (
            <p className="text-xs text-muted-foreground">
              {current.questions.length} {current.questions.length === 1 ? "pregunta" : "preguntas"}
            </p>
          ) : null}
        </div>
        <Progress value={Math.round(((step + 1) / totalSteps) * 100)} />
        {/* Subpestanas: "Sobre ti" (paso 0) + las secciones de encuesta. Todas alcanzables (opcional). */}
        <nav
          aria-label="Secciones de la encuesta"
          className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
        >
          {["Sobre ti", ...sections.map((s) => s.title)].map((title, i) => {
            const activo = i === step;
            return (
              <button
                key={`${title}-${i}`}
                type="button"
                onClick={() => goTo(i)}
                aria-current={activo ? "step" : undefined}
                ref={
                  activo
                    ? (el) => {
                        // En la tira con desplazamiento el chip activo puede quedar fuera de vista al
                        // avanzar; se trae al centro. "nearest" evita mover la pagina entera.
                        el?.scrollIntoView({ block: "nearest", inline: "center" });
                      }
                    : undefined
                }
                className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  activo
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/70"
                }`}
              >
                {title}
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

      {/* Paso 0: "Sobre ti" (caracterizacion opcional). Montado siempre; solo visible en el paso 0. */}
      <div className={isAbout ? "" : "hidden"}>
        <AboutYouSection
          includeProfile={includeProfile}
          prefill={characterizationPrefill}
          ethnicityAuthorized={ethnicityAuthorized}
        />
      </div>

      {/* Secciones de encuesta (todas montadas; solo se muestra la actual). Paso i+1 en el wizard. */}
      {sections.map((s, i) => {
        const active = step === i + 1;
        return (
          <section key={s.title} className={`flex flex-col gap-4 ${active ? "" : "hidden"}`}>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
              {SECTION_INTRO[s.title] ? (
                <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {SECTION_INTRO[s.title]}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Responde lo que aplique a tu caso. Puedes dejar en blanco lo que no sepas.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:gap-6">
              {s.questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:bg-transparent sm:p-0 sm:border-0"
                >
                  <SurveyQuestion q={q} answer={prefill?.[q.id] ?? null} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Navegacion + estado de guardado */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted-foreground">Guardamos tu avance al pasar de sección.</span>
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

        {/* Advertencia de envio con preguntas sin responder: informa, no culpa, no bloquea. Solo en el
            ultimo paso (donde vive "Enviar"). "Enviar asi" es type=button (no otro submit) para no
            reintroducir el hazard de keys compartidas entre botones de envio (ver CLAUDE.md). */}
        {isLast && confirmMissing !== null ? (
          <div className="flex flex-col gap-2 rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
            <p>
              Te {confirmMissing === 1 ? "falta" : "faltan"}{" "}
              <span className="font-semibold">
                {confirmMissing} {confirmMissing === 1 ? "pregunta" : "preguntas"}
              </span>{" "}
              por responder. Puedes enviarla así y completarlas con tu profesional, o volver a revisarlas.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button key="confirm-send" type="button" onClick={doSubmit} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Enviando..." : "Enviar así"}
              </Button>
              <Button
                key="confirm-review"
                type="button"
                variant="outline"
                onClick={() => setConfirmMissing(null)}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Volver a revisar
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className={`flex items-center justify-between gap-3 ${
            isLast && confirmMissing !== null ? "hidden" : ""
          }`}
        >
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
