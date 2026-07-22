"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { SurveyOptionView, SurveyQuestionView } from "../data/survey-reader";

// Widgets de la encuesta por tipo de pregunta. Fuente unica: los usa el formulario publico del
// paciente (survey-intake-form, interactivos) y la vista de solo lectura del profesional
// (survey-readonly, via SurveyAnswerReadonly, que reusa la misma presentacion). El contrato de datos
// con el server action NO cambia (los hidden input llevan el TEXTO de la opcion o el numero).

// Estilo de una pastilla (pill) segun estado, con tokens de marca.
export function pillClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-input bg-background text-foreground hover:bg-muted"
  }`;
}

// Pills de seleccion UNICA. Un hidden input lleva el TEXTO elegido (option_text) al
// FormData con el mismo name que ya lee el server action. Toca de nuevo para deseleccionar.
export function PillsSingle({ id, options }: { id: string; options: SurveyOptionView[] }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.text;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => setValue(active ? "" : o.text)}
            className={pillClass(active)}
          >
            {o.text}
          </button>
        );
      })}
      {value ? <input type="hidden" name={`answer_${id}`} value={value} /> : null}
    </div>
  );
}

// Pills de seleccion MULTIPLE. Un hidden input por valor elegido; el server action agrupa
// los repetidos con getAll y los serializa a JSON.
export function PillsMulti({ id, options }: { id: string; options: SurveyOptionView[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (t: string) =>
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.text);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.text)}
            className={pillClass(active)}
          >
            {o.text}
          </button>
        );
      })}
      {selected.map((v) => (
        <input key={v} type="hidden" name={`answer_${id}`} value={v} />
      ))}
    </div>
  );
}

// Contador +/- para cantidades (bebidas/dia). Rango 0-30 (como el prototipo).
export function Counter({ id }: { id: string }) {
  const [count, setCount] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Restar"
        onClick={() => setCount((c) => Math.max(0, c - 1))}
      >
        <span aria-hidden>-</span>
      </Button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{count}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Sumar"
        onClick={() => setCount((c) => Math.min(30, c + 1))}
      >
        <span aria-hidden>+</span>
      </Button>
      <input type="hidden" name={`answer_${id}`} value={String(count)} />
    </div>
  );
}

// Slider para escalas 1-10 (nivel de estres). Sin valor hasta que el usuario interactua;
// el hidden input solo se emite cuando hay seleccion (no se asume un default).
export function Scale({ id }: { id: string }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">1</span>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value ?? 5}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label="Nivel en escala de 1 a 10"
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      <span className="text-xs text-muted-foreground">10</span>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{value ?? "-"}</span>
      {value !== null ? <input type="hidden" name={`answer_${id}`} value={String(value)} /> : null}
    </div>
  );
}

// Render de una pregunta segun su widget (formulario publico). El value enviado es el TEXTO de la
// opcion (option_text) o el numero; el contrato de datos con el server action no cambia.
export function SurveyQuestion({ q }: { q: SurveyQuestionView }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-foreground">{q.text}</Label>
      {q.type === "opcion" && q.options.length > 0 ? (
        <PillsSingle id={q.id} options={q.options} />
      ) : q.type === "opcion_multiple" && q.options.length > 0 ? (
        <PillsMulti id={q.id} options={q.options} />
      ) : q.type === "contador" ? (
        <Counter id={q.id} />
      ) : q.type === "escala" ? (
        <Scale id={q.id} />
      ) : (
        // Fallback defensivo (texto/numero sueltos, hoy no presentes en el seed).
        <Input name={`answer_${q.id}`} className="h-9" />
      )}
    </div>
  );
}

function parseMulti(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [value];
  } catch {
    return [value];
  }
}

// Render de SOLO LECTURA de la respuesta a una pregunta (vista del profesional). Reusa pillClass
// para verse igual que el formulario: en opcion(es) muestra las pastillas resaltando la(s)
// elegida(s); en numeros muestra el valor. No lleva estado ni inputs. Presentacion pura.
export function SurveyAnswerReadonly({
  questionType,
  answerValue,
  options,
}: {
  questionType: string;
  answerValue: string | null;
  options: string[];
}) {
  if (answerValue == null || answerValue === "") {
    return <span className="text-sm italic text-muted-foreground">Sin responder</span>;
  }

  if (questionType === "opcion" || questionType === "opcion_multiple") {
    const selected = questionType === "opcion_multiple" ? parseMulti(answerValue) : [answerValue];
    // Si hay catalogo de opciones, muestra todas resaltando las elegidas; si no, solo las elegidas.
    const chips = options.length ? options : selected;
    return (
      <div className="flex flex-wrap gap-2">
        {chips.map((o, i) => {
          const active = selected.includes(o);
          return (
            <span
              key={`${o}-${i}`}
              aria-pressed={active}
              className={`${pillClass(active)} cursor-default ${active ? "" : "opacity-50"}`}
            >
              {o}
            </span>
          );
        })}
      </div>
    );
  }

  // contador / escala / numero / texto: el valor tal cual.
  return <span className="text-sm font-semibold tabular-nums text-foreground">{answerValue}</span>;
}
