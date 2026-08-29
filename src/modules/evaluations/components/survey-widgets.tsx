"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { SurveyOptionView, SurveyQuestionView } from "../data/survey-view-types";

// Widgets de la encuesta por tipo de pregunta. Fuente unica, TRES superficies que los consumen:
//   1. el formulario PUBLICO del paciente (survey-intake-form, interactivos, sin valor previo);
//   2. la vista de SOLO LECTURA del profesional (SurveyAnswerReadonly, presentacion pura);
//   3. el formulario de EDICION del profesional (correccion/completitud, S2), con valor PREVIO.
// UN CAMBIO EN UN WIDGET AFECTA A LAS TRES: al tocar cualquiera, verificar las tres (la 1 es superficie
// sensible del paciente). El contrato de datos con el server action NO cambia (los hidden input llevan
// el TEXTO de la opcion o el numero). El prop `defaultValue` es ADITIVO: el intake no lo pasa (arranca
// vacio, como siempre); la edicion lo pasa con la respuesta actual para prefillear. Backward-compatible.

// Estilo de una pastilla (pill) segun estado, con tokens de marca. Para los CONTROLES (el formulario del
// paciente y el de edicion del profesional), donde tocar una pastilla hace algo.
export function pillClass(active: boolean): string {
  return `min-h-11 rounded-full border px-4 py-2 text-sm transition-colors ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-input bg-background text-foreground hover:bg-muted"
  }`;
}

// EN LECTURA NO SE MUESTRA UN CONTROL, SE MUESTRA UN VALOR. Hallazgo de Santiago (2026-08-29): la vista de
// solo lectura de la encuesta reusaba `pillClass`, asi que cada pregunta salia como cinco botones con uno
// azul. Tres cosas mal a la vez:
//   - Las no elegidas conservaban BORDE y `hover:bg-muted`, o sea que prometian ser clicables sin serlo.
//   - La elegida iba en el AZUL DE ACCION, que en esta aplicacion significa "haz clic" y en la barra
//     lateral "estas aqui". Aqui significa "este es el valor": tres significados para un color.
//   - Y el conjunto se leia como un formulario a medio rellenar, no como una respuesta.
//
// LA ESCALA SE CONSERVA, y es deliberado: saber que el paciente eligio "1-2 dias" de cinco niveles ubica la
// respuesta, y mostrar solo el valor elegido perderia esa referencia. Lo que cambia es QUIEN tiene
// superficie: la elegida es la unica con relleno y borde; las demas se quedan sin caja y pasan a leerse
// como los rotulos de la escala que son.
export function pillReadonlyClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 text-sm ${
    active
      ? "border border-border bg-muted font-semibold text-foreground"
      : "border border-transparent text-muted-foreground"
  }`;
}

// Pills de seleccion UNICA. Un hidden input lleva el TEXTO elegido (option_text) al FormData con el mismo name
// que ya lee el server action. Toca de nuevo para deseleccionar. "Otra": abre texto libre y emite "Otra: <texto>"
// (igual que PillsMulti). SIN esto, una pregunta de opcion unica con "Otra" marcaba pero no abria donde escribir
// (bug de P61, la unica de las nueve que es opcion unica; RESPUESTA_GILDARDO 2026-08-20 §5).
export function PillsSingle({
  id,
  options,
  defaultValue = "",
}: {
  id: string;
  options: SurveyOptionView[];
  defaultValue?: string;
}) {
  // Prefill (edicion/reanudacion): un "Otra: xxx" se descompone en el token base + su texto.
  const split = splitOther(defaultValue);
  const [value, setValue] = useState(split?.base ?? defaultValue);
  const [otherText, setOtherText] = useState(split?.text ?? "");

  const otherOption = options.find((o) => isOtherOption(o.text))?.text ?? null;
  const showOtherInput = otherOption != null && value === otherOption;
  // Valor emitido: "Otra" con texto -> "Otra: <texto>"; el resto tal cual.
  const emitted =
    otherOption && value === otherOption && otherText.trim() ? `${value}: ${otherText.trim()}` : value;

  return (
    <div className="flex flex-col gap-2">
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
      </div>
      {showOtherInput ? (
        <Input
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="¿Cuál? Especifica"
          maxLength={200}
          className="h-9"
        />
      ) : null}
      {value ? <input type="hidden" name={`answer_${id}`} value={emitted} /> : null}
    </div>
  );
}

// "Ninguna/Ninguno" (opcion excluyente): marcarla limpia el resto y viceversa. "Otra/Otros": abre texto
// libre. El motor filtra "ninguna" en las preguntas que lee (engine.dfi.js:127,245,253), asi que la
// exclusividad no cambia el diagnostico; y el texto libre se guarda como "Otra: <texto>" y la GLUE lo
// stripea antes del motor (build-engine-input), asi no alimenta d5_39 (provisional hasta ECA4b).
const isNoneOption = (t: string) => /^ningun[oa]$/i.test(t.trim());
// Cubre las CUATRO flexiones (otra/otro/otras/otros), no solo otra/otros: un "Otras"/"Otro" verbatim de
// Gildardo fallaba en silencio (d6_43 "Otras" era un no-match latente). En sync con survey-completeness.
const isOtherOption = (t: string) => /^otr[oa]s?$/i.test(t.trim());
// Separa un valor guardado "Otra: xxx" en {base:"Otra", text:"xxx"}. null si no es texto libre de "Otra".
function splitOther(stored: string): { base: string; text: string } | null {
  const m = /^(otr[oa]s?)\s*:\s*(.+)$/i.exec(stored.trim());
  return m ? { base: m[1], text: m[2] } : null;
}

// Pills de seleccion MULTIPLE. Un hidden input por valor elegido; el server action agrupa
// los repetidos con getAll y los serializa a JSON.
export function PillsMulti({
  id,
  options,
  defaultValue = [],
}: {
  id: string;
  options: SurveyOptionView[];
  defaultValue?: string[];
}) {
  // Prefill (edicion): un elemento "Otra: xxx" se descompone en el token base + su texto.
  const [selected, setSelected] = useState<string[]>(() =>
    defaultValue.map((v) => splitOther(v)?.base ?? v),
  );
  const [otherText, setOtherText] = useState<string>(
    () => defaultValue.map((v) => splitOther(v)?.text).find(Boolean) ?? "",
  );

  const otherOption = options.find((o) => isOtherOption(o.text))?.text ?? null;

  const toggle = (t: string) =>
    setSelected((s) => {
      if (isNoneOption(t)) {
        // "Ninguna": marcarla deja SOLO ella; desmarcarla la quita.
        return s.includes(t) ? s.filter((x) => x !== t) : [t];
      }
      // Cualquier otra opcion quita "Ninguna".
      const withoutNone = s.filter((x) => !isNoneOption(x));
      return withoutNone.includes(t) ? withoutNone.filter((x) => x !== t) : [...withoutNone, t];
    });

  const showOtherInput = otherOption != null && selected.includes(otherOption);
  // Valor emitido por opcion: "Otra" con texto -> "Otra: <texto>"; el resto tal cual.
  const emit = (t: string) =>
    otherOption && t === otherOption && otherText.trim() ? `${t}: ${otherText.trim()}` : t;

  return (
    <div className="flex flex-col gap-2">
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
      </div>
      {showOtherInput ? (
        <Input
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="¿Cuál? Especifica"
          maxLength={200}
          className="h-9"
        />
      ) : null}
      {selected.map((v) => (
        <input key={v} type="hidden" name={`answer_${id}`} value={emit(v)} />
      ))}
    </div>
  );
}

// Contador +/- para cantidades (bebidas/dia). Rango 0-30 (como el prototipo). Arranca SIN valor
// (vacio, "-") hasta que alguien lo toca: un contador sin tocar NO es 0, es sin responder (Gildardo:
// un dominio sin responder no se corre con defaults, eso inventa una respuesta que el paciente no dio).
// El 0 deliberado si es alcanzable: el primer "-" desde vacio da 0, distinguible de no haberlo tocado.
// El hidden input solo se emite cuando hay valor (igual que Scale); vacio no envia nada.
export function Counter({ id, defaultValue = null }: { id: string; defaultValue?: number | null }) {
  // Arranca SIN valor (null = "-"), NUNCA en 0: un contador sin tocar es AUSENCIA, no "consume 0" (seria
  // ausencia disfrazada de dato, y el agua entra al LE8). Para responder "cero" el paciente pulsa "Ninguno"
  // (0 EXPLICITO, tocado). El input oculto solo se emite cuando hay valor, asi el gate distingue sin
  // responder de cero. Comparte familia con la guarda de calcLE8.
  const [count, setCount] = useState<number | null>(defaultValue);
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Restar"
        onClick={() => setCount((c) => Math.max(0, (c ?? 0) - 1))}
      >
        <span aria-hidden>-</span>
      </Button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{count ?? "-"}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Sumar"
        onClick={() => setCount((c) => Math.min(30, (c ?? 0) + 1))}
      >
        <span aria-hidden>+</span>
      </Button>
      <Button
        type="button"
        variant={count === 0 ? "default" : "outline"}
        size="sm"
        aria-pressed={count === 0}
        onClick={() => setCount(0)}
      >
        Ninguno
      </Button>
      {count !== null ? <input type="hidden" name={`answer_${id}`} value={String(count)} /> : null}
    </div>
  );
}

// Slider para escalas 1-10 (nivel de estres). Sin valor hasta que el usuario interactua;
// el hidden input solo se emite cuando hay seleccion (no se asume un default).
export function Scale({ id, defaultValue }: { id: string; defaultValue?: number }) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">1</span>
      {/* Sin responder hasta que el paciente lo toque: el pulgar arranca en el centro pero ATENUADO (no
          es un valor preseleccionado), y el numero muestra "-". Cualquier interaccion (arrastrar o clic en
          la pista) fija el valor. El input oculto solo se emite con valor, asi el gate lo distingue. */}
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value ?? 5}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label="Nivel en escala de 1 a 10"
        aria-valuetext={value == null ? "Sin responder" : String(value)}
        className={`h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary ${
          value == null ? "opacity-40" : ""
        }`}
      />
      <span className="text-xs text-muted-foreground">10</span>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{value ?? "-"}</span>
      {value !== null ? <input type="hidden" name={`answer_${id}`} value={String(value)} /> : null}
    </div>
  );
}

// Render de una pregunta segun su widget. El value enviado es el TEXTO de la opcion (option_text) o
// el numero; el contrato de datos con el server action no cambia. `answer` (opcional) prefillea el
// valor actual para la EDICION del profesional; el intake publico no lo pasa (arranca vacio).
export function SurveyQuestion({ q, answer }: { q: SurveyQuestionView; answer?: string | null }) {
  const a = answer ?? undefined;
  // Rotulo "puedes elegir varias" derivado del tipo (ECA-label): lo lleva el widget, no el seed, asi vale
  // para toda pregunta de seleccion multiple sin duplicar contenido.
  const isMulti = q.type === "opcion_multiple";
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-foreground">
        <span className="text-muted-foreground">{q.number}.</span> {q.text}
      </Label>
      {/* Ayuda bajo el enunciado: ejemplos + ancla de porcion en D1, o aclaracion de item (ECA2/ECA3). */}
      {q.hint ? <p className="text-xs text-muted-foreground">{q.hint}</p> : null}
      {isMulti ? (
        <p className="text-xs font-medium text-muted-foreground">Puedes elegir varias.</p>
      ) : null}
      {q.type === "opcion" && q.options.length > 0 ? (
        <PillsSingle id={q.id} options={q.options} defaultValue={a ?? ""} />
      ) : q.type === "opcion_multiple" && q.options.length > 0 ? (
        <PillsMulti id={q.id} options={q.options} defaultValue={a ? parseMulti(a) : []} />
      ) : q.type === "contador" ? (
        // a === "0" es un cero real guardado (string truthy -> muestra 0); sin respuesta -> null (vacio).
        <Counter id={q.id} defaultValue={a ? Number(a) : null} />
      ) : q.type === "escala" ? (
        <Scale id={q.id} defaultValue={a ? Number(a) : undefined} />
      ) : (
        // Fallback defensivo (texto/numero sueltos, hoy no presentes en el seed).
        <Input name={`answer_${q.id}`} defaultValue={a ?? ""} className="h-9" />
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

// Render de SOLO LECTURA de la respuesta a una pregunta (vista del profesional). Dos variantes de
// PRESENTACION sobre la MISMA interpretacion del dato (parseMulti/splitOther, incluido el texto libre
// de "Otra"), asi las dos superficies no divergen en lo que importa (que se eligio), solo en la forma:
//  - "chips" (default, pestaña Evaluacion): reusa pillClass y pinta TODAS las opciones resaltando la(s)
//    elegida(s). Ahi el profesional REVISA la encuesta y ver las no marcadas ayuda.
//  - "plain" (Diagnostico D2-D8): solo el/los valor(es) elegido(s), en texto, como el read-out del v8.
//    Ahi el profesional solo LEE lo que el paciente dijo; las opciones no marcadas serian ruido.
// No lleva estado ni inputs. Presentacion pura.
export function SurveyAnswerReadonly({
  questionType,
  answerValue,
  options,
  variant = "chips",
}: {
  questionType: string;
  answerValue: string | null;
  options: string[];
  variant?: "chips" | "plain";
}) {
  if (answerValue == null || answerValue === "") {
    return <span className="text-sm italic text-muted-foreground">Sin responder</span>;
  }

  if (questionType === "opcion" || questionType === "opcion_multiple") {
    const selected = questionType === "opcion_multiple" ? parseMulti(answerValue) : [answerValue];
    // Texto plano: solo lo elegido, con el texto libre de "Otra" pegado, unido por comas. Misma
    // descomposicion (splitOther) que los chips, para que el dato se lea identico en las dos formas.
    if (variant === "plain") {
      const labels = selected.map((v) => {
        const s = splitOther(v);
        return s && s.text ? `${s.base}: ${s.text}` : s ? s.base : v;
      });
      return (
        <span className="text-sm font-semibold text-foreground">{labels.join(", ")}</span>
      );
    }
    // Descompone cada valor guardado igual que el form de edicion: "Otra: penicilina" -> base "Otra" +
    // texto "penicilina". El catalogo trae "Otra" (no "Otra: penicilina"), asi que sin descomponer la
    // opcion sale apagada y el texto libre del paciente (alergia, antecedente) se PIERDE en la lectura
    // del profesional. Es informacion clinica: no puede desaparecer en pantalla.
    const parts = selected.map((v) => {
      const s = splitOther(v);
      return s ? { base: s.base, text: s.text } : { base: v, text: "" };
    });
    // Catalogo si existe; si no, las bases elegidas. Anexa cualquier base elegida que NO este en el
    // catalogo (p. ej. respuesta de una version de encuesta distinta) para no descartarla en silencio.
    const baseChips = options.length ? options : parts.map((p) => p.base);
    const extraChips = parts.map((p) => p.base).filter((b) => !baseChips.includes(b));
    const chips = [...baseChips, ...extraChips];
    return (
      <div className="flex flex-wrap gap-2">
        {chips.map((o, i) => {
          const match = parts.find((p) => p.base === o);
          const active = Boolean(match);
          // La opcion elegida con texto libre ("Otra") lo muestra pegado al chip: "Otra: penicilina".
          const label = match && match.text ? `${o}: ${match.text}` : o;
          return (
            <span
              key={`${o}-${i}`}
              aria-pressed={active}
              className={`${pillReadonlyClass(active)} cursor-default`}
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  // contador / escala / numero / texto: el valor tal cual.
  return <span className="text-sm font-semibold tabular-nums text-foreground">{answerValue}</span>;
}
