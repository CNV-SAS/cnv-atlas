"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { submitSurveyAction } from "../actions";
import type { SurveyFormState } from "../validations";
import type { SurveyQuestionView } from "../data/survey-reader";

const initial: SurveyFormState = { error: null, fields: null, done: false };

const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: "CC", label: "Cedula de ciudadania" },
  { value: "CE", label: "Cedula de extranjeria" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
  { value: "NIT", label: "NIT" },
];

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

const checkboxClass = "mt-1 size-4 shrink-0 accent-primary";

export type SurveyIntakeFormProps = {
  token: string;
  isFollowup: boolean;
  prefill: { city?: string | null; phone?: string | null } | null;
  questions: SurveyQuestionView[];
  consentText: string;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function SurveyIntakeForm({
  token,
  isFollowup,
  prefill,
  questions,
  consentText,
}: SurveyIntakeFormProps) {
  const [state, action, pending] = useActionState(submitSurveyAction, initial);

  // Capa de consentimiento: las 3 necesarias + la declaracion de mayoria de edad
  // habilitan el envio. Las opcionales no influyen. Se controlan en cliente solo
  // para habilitar el boton; el servidor revalida con Zod de todos modos.
  const [adult, setAdult] = useState(false);
  const [necessary, setNecessary] = useState({
    servicio: false,
    datos_sensibles: false,
    internacional_ia: false,
  });
  const [showFullText, setShowFullText] = useState(false);

  const canContinue =
    adult && necessary.servicio && necessary.datos_sensibles && necessary.internacional_ia;

  return (
    <form action={action} className="flex w-full flex-col gap-8">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {/* 1. Consentimiento informado */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Consentimiento informado</h2>
          <p className="text-sm text-muted-foreground">
            Antes de empezar necesitamos tu autorizacion para tratar tus datos. Marca
            las casillas necesarias para continuar.
          </p>
        </div>

        {/* Mayoria de edad: va antes de las casillas (CONSENT_ATLAS seccion 11) */}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="mayoria_de_edad"
            className={checkboxClass}
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
          />
          <span>Declaro que soy mayor de 18 años.</span>
        </label>

        {/* Necesarias */}
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Autorizaciones necesarias para el servicio
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="servicio"
              className={checkboxClass}
              checked={necessary.servicio}
              onChange={(e) => setNecessary((s) => ({ ...s, servicio: e.target.checked }))}
            />
            <span>
              Autorizo el tratamiento de mis datos personales para las finalidades del
              servicio.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="datos_sensibles"
              className={checkboxClass}
              checked={necessary.datos_sensibles}
              onChange={(e) =>
                setNecessary((s) => ({ ...s, datos_sensibles: e.target.checked }))
              }
            />
            <span>
              Autorizo el tratamiento de mis datos sensibles de salud, de forma
              voluntaria, para mi evaluacion.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="internacional_ia"
              className={checkboxClass}
              checked={necessary.internacional_ia}
              onChange={(e) =>
                setNecessary((s) => ({ ...s, internacional_ia: e.target.checked }))
              }
            />
            <span>
              He sido informado del tratamiento internacional y del uso de sistemas
              automatizados, y conozco mis derechos.
            </span>
          </label>
        </fieldset>

        {/* Opcionales, separadas */}
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Autorizaciones opcionales (no afectan tu atencion)
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="investigacion" className={checkboxClass} />
            <span>
              Autorizo el uso de mis datos para investigacion cientifica del modelo.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="comunicaciones_continuidad"
              className={checkboxClass}
            />
            <span>Autorizo recibir comunicaciones de continuidad de mi atencion.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="comunicaciones_comerciales"
              className={checkboxClass}
            />
            <span>Autorizo recibir comunicaciones comerciales del ecosistema CNV.</span>
          </label>
        </fieldset>

        {/* Texto completo disponible, no obligatorio leerlo */}
        <div>
          <button
            type="button"
            onClick={() => setShowFullText((v) => !v)}
            className="text-sm font-medium text-primary underline"
          >
            {showFullText ? "Ocultar el texto completo" : "Ver mas: texto completo del consentimiento"}
          </button>
          {showFullText ? (
            <div className="mt-2 max-h-80 overflow-auto rounded-md border border-border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                {consentText}
              </pre>
            </div>
          ) : null}
        </div>
      </section>

      {/* 2. Identificacion */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Tus datos</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo de documento">
            <select name="documentType" required className={selectClass} defaultValue="CC">
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Numero de documento">
            <Input name="documentNumber" required className="h-9" />
          </Field>
          <Field label="Nombres">
            <Input name="firstName" required className="h-9" />
          </Field>
          <Field label="Apellidos">
            <Input name="lastName" required className="h-9" />
          </Field>
          <Field label="Fecha de nacimiento">
            <Input name="birthDate" type="date" className="h-9" />
          </Field>
          <Field label="Sexo">
            <Input name="sex" className="h-9" />
          </Field>
          <Field label="Ciudad">
            <Input name="city" className="h-9" defaultValue={prefill?.city ?? ""} />
          </Field>
          <Field label="Celular">
            <Input name="phone" className="h-9" defaultValue={prefill?.phone ?? ""} />
          </Field>
          <Field label="Correo">
            <Input name="email" type="email" className="h-9" />
          </Field>
        </div>
      </section>

      {/* 3. Encuesta */}
      {questions.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">Encuesta</h2>
          {questions.map((q) => (
            <Field key={q.id} label={q.text}>
              {q.type === "opcion" && q.options.length > 0 ? (
                <select name={`answer_${q.id}`} className={selectClass} defaultValue="">
                  <option value="">Selecciona una opcion</option>
                  {q.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.text}
                    </option>
                  ))}
                </select>
              ) : q.type === "numero" ? (
                <Input name={`answer_${q.id}`} type="number" className="h-9" />
              ) : (
                <Input name={`answer_${q.id}`} className="h-9" />
              )}
            </Field>
          ))}
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        {!canContinue ? (
          <p className="text-xs text-muted-foreground">
            Marca la declaracion de mayoria de edad y las tres autorizaciones
            necesarias para continuar.
          </p>
        ) : null}
        <Button type="submit" disabled={!canContinue || pending} className="w-full sm:w-auto">
          {pending ? "Enviando..." : isFollowup ? "Enviar seguimiento" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
