"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsentDocument } from "@/modules/consent/components/consent-document";

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

// Parentesco/calidad del representante legal (CONSENT_ATLAS seccion 11). El valor es
// el corto que persiste el esquema; la etiqueta es la que ve el usuario.
const RELATIONSHIPS: { value: string; label: string }[] = [
  { value: "padre", label: "Padre" },
  { value: "madre", label: "Madre" },
  { value: "tutor", label: "Tutor legal" },
  { value: "curador", label: "Curador" },
];

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

const checkboxClass = "mt-1 size-4 shrink-0 accent-primary";

// Edad en años cumplidos a partir de una fecha YYYY-MM-DD (UTC). null si vacia o
// invalida. Se calcula en cliente solo para mostrar/ocultar el asentimiento; el
// servidor revalida con el mismo criterio (consent/validations).
function ageFromISO(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - Number(m[1]);
  const monthDiff = now.getUTCMonth() + 1 - Number(m[2]);
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < Number(m[3]))) age -= 1;
  return age;
}

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

  // Capa de consentimiento. La rama de edad (mayor/menor) es una eleccion explicita
  // y obligatoria (DELTA2 B2). En menor se abre el bloque del representante legal y,
  // si el menor tiene 14-17, el asentimiento. Todo se controla en cliente solo para
  // habilitar el envio; el servidor revalida con Zod de todos modos.
  const [ageBranch, setAgeBranch] = useState<"" | "mayor" | "menor">("");
  const [necessary, setNecessary] = useState({
    servicio: false,
    datos_sensibles: false,
    internacional_ia: false,
  });
  const [rep, setRep] = useState({
    name: "",
    document: "",
    relationship: "",
    email: "",
  });
  const [minorBirthDate, setMinorBirthDate] = useState("");
  const [assent, setAssent] = useState(false);
  // Nombre del menor: se toma de identificacion (mismo paciente) para interpolarlo en
  // el texto del asentimiento. Controlado para poder mostrarlo en vivo.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showFullText, setShowFullText] = useState(false);

  const isMinor = ageBranch === "menor";
  const minorAge = isMinor ? ageFromISO(minorBirthDate) : null;
  const assentRequired = minorAge !== null && minorAge >= 14 && minorAge <= 17;
  const minorName = `${firstName} ${lastName}`.trim();

  const necessaryOk =
    necessary.servicio && necessary.datos_sensibles && necessary.internacional_ia;
  const branchOk =
    ageBranch === "mayor"
      ? true
      : isMinor
        ? Boolean(
            rep.name.trim() &&
              rep.document.trim().length >= 3 &&
              rep.relationship &&
              rep.email.trim() &&
              minorBirthDate &&
              minorAge !== null &&
              minorAge < 18 &&
              (!assentRequired || assent),
          )
        : false;
  const canContinue = necessaryOk && branchOk;

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

        {/* Selector de edad: eleccion explicita y obligatoria (CONSENT_ATLAS seccion 11) */}
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Antes de continuar, indica tu situacion
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="ageBranch"
              value="mayor"
              className={checkboxClass}
              checked={ageBranch === "mayor"}
              onChange={() => setAgeBranch("mayor")}
            />
            <span>Soy mayor de 18 años y actuo en nombre propio.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="ageBranch"
              value="menor"
              className={checkboxClass}
              checked={isMinor}
              onChange={() => setAgeBranch("menor")}
            />
            <span>Soy menor de 18 años; firma mi representante legal.</span>
          </label>
        </fieldset>

        {/* Bloque del representante legal (solo rama menor) */}
        {isMinor ? (
          <fieldset className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Datos del representante legal
            </legend>
            <p className="text-xs text-muted-foreground">
              El representante legal otorga el consentimiento en nombre del menor y firma
              las autorizaciones.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nombre completo del representante">
                <Input
                  name="legalRepresentativeName"
                  className="h-9"
                  value={rep.name}
                  onChange={(e) => setRep((s) => ({ ...s, name: e.target.value }))}
                />
              </Field>
              <Field label="Tipo y numero de documento">
                <Input
                  name="legalRepresentativeDocument"
                  className="h-9"
                  value={rep.document}
                  onChange={(e) => setRep((s) => ({ ...s, document: e.target.value }))}
                />
              </Field>
              <Field label="Parentesco o calidad">
                <select
                  name="legalRepresentativeRelationship"
                  className={selectClass}
                  value={rep.relationship}
                  onChange={(e) =>
                    setRep((s) => ({ ...s, relationship: e.target.value }))
                  }
                >
                  <option value="">Selecciona una opcion</option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Correo del representante">
                <Input
                  name="legalRepresentativeEmail"
                  type="email"
                  className="h-9"
                  value={rep.email}
                  onChange={(e) => setRep((s) => ({ ...s, email: e.target.value }))}
                />
              </Field>
              <Field label="Fecha de nacimiento del menor">
                <Input
                  name="minorBirthDate"
                  type="date"
                  className="h-9"
                  value={minorBirthDate}
                  onChange={(e) => setMinorBirthDate(e.target.value)}
                />
              </Field>
            </div>

            {/* Asentimiento del menor: solo entre 14 y 17 años (CONSENT_ATLAS seccion 11) */}
            {assentRequired ? (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
                <p className="text-xs italic text-muted-foreground">
                  &ldquo;Yo, {minorName || "el/la menor evaluado/a"}, he sido informado/a
                  de forma adecuada a mi edad sobre esta evaluacion y estoy de acuerdo en
                  participar.&rdquo;
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="asentimiento_menor"
                    className={checkboxClass}
                    checked={assent}
                    onChange={(e) => setAssent(e.target.checked)}
                  />
                  <span>
                    El menor (14 a 17 años) otorga su asentimiento en los terminos
                    anteriores.
                  </span>
                </label>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {/* Necesarias */}
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Autorizaciones necesarias para el servicio
          </legend>
          {isMinor ? (
            <p className="text-xs text-muted-foreground">
              El representante legal las autoriza en nombre del menor.
            </p>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="servicio"
              className={checkboxClass}
              checked={necessary.servicio}
              onChange={(e) => setNecessary((s) => ({ ...s, servicio: e.target.checked }))}
            />
            <span>
              Autorizo el tratamiento de los datos personales para las finalidades del
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
              Autorizo el tratamiento de los datos sensibles de salud, de forma
              voluntaria, para la evaluacion.
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
              automatizados, y conozco los derechos aplicables.
            </span>
          </label>
        </fieldset>

        {/* Opcionales, separadas */}
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Autorizaciones opcionales (no afectan la atencion)
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="investigacion" className={checkboxClass} />
            <span>
              Autorizo el uso de los datos seudonimizados para investigacion cientifica
              del modelo.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="comunicaciones_continuidad"
              className={checkboxClass}
            />
            <span>Autorizo recibir comunicaciones de continuidad de la atencion.</span>
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
              <ConsentDocument text={consentText} />
            </div>
          ) : null}
        </div>
      </section>

      {/* 2. Identificacion (datos del paciente; en rama menor, del menor evaluado) */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isMinor ? "Datos del menor evaluado" : "Tus datos"}
        </h2>
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
            <Input
              name="firstName"
              required
              className="h-9"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Apellidos">
            <Input
              name="lastName"
              required
              className="h-9"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
          <Field label="Fecha de nacimiento">
            {isMinor ? (
              // Ya se pidio en el consentimiento; se reutiliza y no se vuelve a pedir.
              <>
                <input type="hidden" name="birthDate" value={minorBirthDate} />
                <p className="flex h-9 items-center text-sm text-muted-foreground">
                  {minorBirthDate || "Indicala en el bloque del representante legal"}
                </p>
              </>
            ) : (
              <Input name="birthDate" type="date" className="h-9" />
            )}
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
          {questions.map((q) =>
            q.type === "opcion_multiple" && q.options.length > 0 ? (
              // Multi-select: varias casillas con el mismo name; el servidor las agrupa.
              // El value es el TEXTO (option_text), lo que compara el motor.
              <fieldset key={q.id} className="flex flex-col gap-2">
                <legend className="text-xs text-muted-foreground">{q.text}</legend>
                {q.options.map((o) => (
                  <label key={o.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={`answer_${q.id}`}
                      value={o.text}
                      className={checkboxClass}
                    />
                    <span>{o.text}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <Field key={q.id} label={q.text}>
                {q.type === "opcion" && q.options.length > 0 ? (
                  // Opcion unica: el value es el TEXTO (option_text), no el id.
                  <select name={`answer_${q.id}`} className={selectClass} defaultValue="">
                    <option value="">Selecciona una opcion</option>
                    {q.options.map((o) => (
                      <option key={o.id} value={o.text}>
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
            ),
          )}
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        {!canContinue ? (
          <p className="text-xs text-muted-foreground">
            Indica tu situacion de edad, completa el bloque que corresponda y marca las
            tres autorizaciones necesarias para continuar.
          </p>
        ) : null}
        <Button type="submit" disabled={!canContinue || pending} className="w-full sm:w-auto">
          {pending ? "Enviando..." : isFollowup ? "Enviar seguimiento" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
