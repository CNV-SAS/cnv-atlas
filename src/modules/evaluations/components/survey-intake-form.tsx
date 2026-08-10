"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ConsentDocumentCollapsible } from "@/modules/consent/components/consent-document-collapsible";

import { sendConsentOtpAction, submitSurveyAction } from "../actions";
import type { OtpSendState, SurveyFormState } from "../validations";
import type { SurveyQuestionView } from "../data/survey-view-types";
import { SurveyQuestion } from "./survey-widgets";

const initial: SurveyFormState = { error: null, fields: null, done: false };
const initialOtp: OtpSendState = { error: null, sent: false, maskedDestination: null, remaining: null };

// Validez de correo para habilitar el envio en cliente (el servidor revalida con Zod). Basta un patron
// simple: no decide nada legal, solo si el boton "Enviar codigo" esta disponible.
function emailLooksValid(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

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
  const topRef = useRef<HTMLDivElement>(null);

  // Firma electronica (B7). sessionId: nonce opaco de ESTE intento de firma, generado una sola vez
  // en cliente; ancla el codigo a este navegador y viaja al enviar y al validar. Estado del envio del
  // codigo por su propia accion (useActionState), invocada IMPERATIVAMENTE (no como action del form)
  // para no disparar el auto-reset de React 19 sobre el resto de campos.
  const [sessionId] = useState(() => crypto.randomUUID());
  const [otpState, sendOtp, otpPending] = useActionState(sendConsentOtpAction, initialOtp);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Capa de consentimiento. La rama de edad (mayor/menor) es una eleccion explicita
  // y obligatoria (DELTA2 B2). En menor se abre el bloque del representante legal y,
  // si el menor tiene 14-17, el asentimiento. Todo se controla en cliente solo para
  // habilitar el envio; el servidor revalida con Zod de todos modos.
  const [ageBranch, setAgeBranch] = useState<"" | "mayor" | "menor">("");
  const [necessary, setNecessary] = useState({
    servicio: false,
    datos_sensibles: false,
    internacional_ia: false,
    aceptacion_medio_electronico: false,
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
  // Identidad requerida controlada, para validar el paso en vivo (habilitar "Siguiente").
  const [documentNumber, setDocumentNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showFullText, setShowFullText] = useState(false);

  const isMinor = ageBranch === "menor";
  const minorAge = isMinor ? ageFromISO(minorBirthDate) : null;
  const assentRequired = minorAge !== null && minorAge >= 14 && minorAge <= 17;
  const minorName = `${firstName} ${lastName}`.trim();

  const necessaryOk =
    necessary.servicio &&
    necessary.datos_sensibles &&
    necessary.internacional_ia &&
    necessary.aceptacion_medio_electronico;
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
  const consentOk = necessaryOk && branchOk;

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

  // Pasos del wizard: consentimiento, identificacion, y una seccion por dominio. Todos
  // los paneles se MONTAN siempre (solo se ocultan con CSS) para que el unico <form>
  // envie todos los campos en un solo server action; el stepper es solo presentacion.
  const steps = useMemo(
    () => [
      { kind: "consent" as const, title: "Consentimiento" },
      { kind: "identity" as const, title: isMinor ? "Datos del menor" : "Tus datos" },
      ...sections.map((s) => ({ kind: "survey" as const, title: s.title, questions: s.questions })),
    ],
    [sections, isMinor],
  );

  const [step, setStep] = useState(0);
  const total = steps.length;
  const current = steps[Math.min(step, total - 1)];
  const isLast = step === total - 1;

  // Firma electronica: el correo destino sale de la rama (menor -> representante; mayor -> paciente).
  // Es el mismo correo al que llega el codigo de verificacion y la copia del consentimiento.
  const destinationEmail = isMinor ? rep.email : email;
  const destinationEmailOk = emailLooksValid(destinationEmail);

  // Validacion liviana del paso de identidad (los required nativos se quitaron: en un
  // panel oculto no serian enfocables al enviar). Deriva del estado controlado; el Zod
  // del servidor sigue siendo la fuente de verdad. El correo del paciente es OBLIGATORIO en la rama
  // mayor (es donde llega el codigo); en la rama menor el correo obligatorio es el del representante,
  // que se valida en el bloque de consentimiento (branchOk), no aqui.
  const identityOk = Boolean(
    documentNumber.trim() &&
      firstName.trim() &&
      lastName.trim() &&
      (isMinor ? minorBirthDate : birthDate) &&
      (isMinor ? true : emailLooksValid(email)),
  );

  // Se puede avanzar si el paso actual esta completo. Consentimiento e identidad son
  // compuertas; las secciones de encuesta son opcionales (recoleccion, el servidor no
  // exige respuestas).
  const canAdvance =
    current.kind === "consent" ? consentOk : current.kind === "identity" ? identityOk : true;

  // Paso maximo alcanzable: consentimiento (0) siempre; identidad (1) exige consentimiento; las
  // secciones de encuesta (2+) exigen consentimiento + identidad. Como la encuesta es OPCIONAL, una vez
  // pasadas las dos compuertas TODAS las secciones son alcanzables (se puede saltar adelante y atras).
  const maxReachable = !consentOk ? 0 : !identityOk ? 1 : total - 1;

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Salto directo por click (1g): a cualquier paso hasta el maximo alcanzable, adelante o atras. Saltar
  // secciones de encuesta es valido (son opcionales); las compuertas (consent/identidad) no se saltan.
  const goTo = (i: number) => {
    if (i < 0 || i > maxReachable) return;
    setStep(i);
    scrollTop();
  };
  const goNext = () => {
    if (!canAdvance || isLast) return;
    setStep((s) => Math.min(s + 1, total - 1));
    scrollTop();
  };
  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  };

  // Envio del codigo (B7): se invoca la accion IMPERATIVAMENTE con los datos actuales (no como action
  // del form) para no resetear el resto. El servidor decide el destino por la rama; aqui solo se arma
  // el payload minimo. Reenviar es el mismo envio (el limitador cuenta; otpState.remaining lo refleja).
  const sendCode = () => {
    const fd = new FormData();
    fd.set("token", token);
    fd.set("sessionId", sessionId);
    fd.set("ageBranch", ageBranch);
    if (isMinor) fd.set("legalRepresentativeEmail", rep.email);
    else fd.set("email", email);
    startTransition(() => sendOtp(fd));
  };

  // Envio del formulario SIN el auto-reset de React 19: se invoca la action en una transicion en vez
  // de pasarla como prop `action`. Asi, si el codigo sale mal, la pantalla NO pierde lo que el paciente
  // lleno (las 63 respuestas ya viven en estado; esto ademas preserva correo, sexo y opcionales). El
  // guard de keys de los botones sigue evitando el auto-submit al entrar a la ultima seccion (D8).
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => action(new FormData(e.currentTarget)));
  };

  const otpCodeOk = /^\d{6}$/.test(otpCode.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6"
      // Evita el envio implicito con Enter fuera del ultimo paso (no hay boton submit
      // montado antes, pero Enter en un input podria dispararlo).
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isLast && e.target instanceof HTMLElement && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="token" value={token} />
      {/* Firma electronica: el nonce de este intento viaja con el envio para casar con el codigo. */}
      <input type="hidden" name="otpSessionId" value={sessionId} />
      <div ref={topRef} />

      {/* Progreso */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Paso {step + 1} de {total}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {current.title}
            {/* Numero de items de la seccion (cuantas hay que responder). Es INFORMATIVO (progreso), no
                el gate de completitud (ese cuenta solo los campos del diagnostico): no dice "completa". */}
            {current.kind === "survey" ? (
              <span className="ml-2 font-normal text-muted-foreground">
                · {current.questions.length}{" "}
                {current.questions.length === 1 ? "pregunta" : "preguntas"}
              </span>
            ) : null}
          </p>
        </div>
        <Progress value={Math.round(((step + 1) / total) * 100)} />
        {/* Navegacion por subpestanas (1g): salto directo a cualquier paso alcanzable, adelante o atras.
            Los no alcanzables (por las compuertas de consentimiento/identidad) quedan deshabilitados. */}
        <nav aria-label="Secciones de la encuesta" className="flex flex-wrap gap-1.5">
          {steps.map((s, i) => {
            const reachable = i <= maxReachable;
            const activo = i === step;
            return (
              <button
                key={`${s.kind}-${i}`}
                type="button"
                onClick={() => goTo(i)}
                disabled={!reachable}
                aria-current={activo ? "step" : undefined}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  activo
                    ? "bg-primary text-primary-foreground"
                    : reachable
                      ? "bg-muted text-foreground hover:bg-muted/70"
                      : "cursor-not-allowed text-muted-foreground/50"
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

      {/* Paso 1: Consentimiento informado */}
      <section className={`flex flex-col gap-4 ${current.kind === "consent" ? "" : "hidden"}`}>
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
              <Field label="Tipo y número de documento">
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
                  <option value="">Selecciona una opción</option>
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
                <p className="text-xs text-muted-foreground">
                  El código de verificación y la copia del consentimiento llegan a este correo del
                  representante, no al del menor.
                </p>
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
          {/* Firma electronica (B7, v1.7 numeral 12): aceptacion del medio electronico. Necesaria para
              firmar; el codigo llega al medio de contacto que se registre (propio o de un tercero de confianza). */}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="aceptacion_medio_electronico"
              className={checkboxClass}
              checked={necessary.aceptacion_medio_electronico}
              onChange={(e) =>
                setNecessary((s) => ({ ...s, aceptacion_medio_electronico: e.target.checked }))
              }
            />
            <span>
              Acepto firmar este consentimiento por medios electrónicos, con plena validez
              (Ley 527 de 1999), y recibir un código de verificación en el medio de contacto que
              registro (propio o de una persona de confianza que yo designe).
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
            <span>Autorizo recibir comunicaciones de continuidad de la atención.</span>
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
              <ConsentDocumentCollapsible text={consentText} />
            </div>
          ) : null}
        </div>
      </section>

      {/* Paso 2: Identificacion (datos del paciente; en rama menor, del menor evaluado) */}
      <section className={`flex flex-col gap-4 ${current.kind === "identity" ? "" : "hidden"}`}>
        <h2 className="text-lg font-semibold text-foreground">
          {isMinor ? "Datos del menor evaluado" : "Tus datos"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo de documento">
            <select name="documentType" className={selectClass} defaultValue="CC">
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Número de documento">
            <Input
              name="documentNumber"
              className="h-9"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </Field>
          <Field label="Nombres">
            <Input
              name="firstName"
              className="h-9"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Apellidos">
            <Input
              name="lastName"
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
              <Input
                name="birthDate"
                type="date"
                className="h-9"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
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
          {/* Correo del paciente: OBLIGATORIO en la rama mayor (es donde llega el codigo y la copia).
              En la rama menor el correo que cuenta es el del representante (bloque de consentimiento). */}
          <Field label={isMinor ? "Correo del menor (opcional)" : "Correo"}>
            <Input
              name="email"
              type="email"
              className="h-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {!isMinor ? (
              <p className="text-xs text-muted-foreground">
                Necesitamos tu correo para enviarte el código de verificación y una copia de tu
                consentimiento.
              </p>
            ) : null}
          </Field>
        </div>
      </section>

      {/* Pasos 3..N: una seccion de encuesta (dominio) por paso */}
      {sections.map((s, i) => {
        const active = current.kind === "survey" && current.title === s.title && step === i + 2;
        return (
          <section key={s.title} className={`flex flex-col gap-4 ${active ? "" : "hidden"}`}>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
              <p className="text-sm text-muted-foreground">
                Responde lo que aplique a tu caso. Puedes dejar en blanco lo que no sepas.
              </p>
            </div>
            {s.questions.map((q) => (
              <SurveyQuestion key={q.id} q={q} />
            ))}
          </section>
        );
      })}

      {/* Navegacion */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {current.kind === "consent" && !consentOk ? (
          <p className="text-xs text-muted-foreground">
            Indica tu situacion de edad, completa el bloque que corresponda y marca las
            tres autorizaciones necesarias para continuar.
          </p>
        ) : null}
        {current.kind === "identity" && !identityOk ? (
          <p className="text-xs text-muted-foreground">
            Completa documento, nombres, apellidos, fecha de nacimiento
            {!isMinor ? " y un correo válido" : ""} para continuar.
          </p>
        ) : null}

        {/* Verificacion de firma (B7): SOLO en el ultimo paso (a), cuando ya esta todo listo. Antes no,
            porque el codigo vence en 10 minutos y el paciente aun estaria llenando. */}
        {isLast ? (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Verificación para firmar</h3>
              <p className="text-xs text-muted-foreground">
                Para firmar el consentimiento te enviamos un código al correo{" "}
                {isMinor ? "del representante" : "que registraste"}. Ingrésalo aquí para completar el
                envío.
              </p>
            </div>

            {!otpState.sent ? (
              <>
                <Button
                  key="otp-send"
                  type="button"
                  onClick={sendCode}
                  disabled={!consentOk || !identityOk || !destinationEmailOk || otpPending}
                  className="self-start"
                >
                  {otpPending ? "Enviando código..." : "Enviar código de verificación"}
                </Button>
                {!destinationEmailOk ? (
                  <p className="text-xs text-muted-foreground">
                    {isMinor
                      ? "Ingresa un correo válido del representante en el paso de consentimiento."
                      : "Ingresa un correo válido en tus datos para recibir el código."}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {/* (c) La espera: puede tardar y suele caer en no deseado. */}
                <p className="text-xs text-muted-foreground">
                  Enviamos un código a{" "}
                  <span className="font-medium text-foreground">{otpState.maskedDestination}</span>.
                  Puede tardar un momento; si no lo ves, revisa la carpeta de correo no deseado.
                </p>
                <Field label="Código de verificación (6 dígitos)">
                  <Input
                    name="otpCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="h-9 w-40 tracking-[0.3em]"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </Field>
                {/* (d) Reenvio con conteo visible: 5 por 15 min; se dice cuantos quedan. */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    key="otp-resend"
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={sendCode}
                    disabled={otpPending}
                  >
                    {otpPending ? "Reenviando..." : "Reenviar código"}
                  </Button>
                  {typeof otpState.remaining === "number" ? (
                    <span className="text-xs text-muted-foreground">
                      Te{" "}
                      {otpState.remaining === 1
                        ? "queda 1 reenvío"
                        : `quedan ${otpState.remaining} reenvíos`}{" "}
                      en esta ventana.
                    </span>
                  ) : null}
                </div>
              </>
            )}

            {otpState.error ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {otpState.error}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Button
            key="nav-back"
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={step === 0 || pending}
          >
            Anterior
          </Button>
          {/* keys DISTINTAS a proposito. NO SON COSMETICAS: si las quitas vuelve el bug D8.
              Sin key, React reutiliza el mismo nodo DOM al pasar de "Siguiente" (type=button)
              a "Enviar" (type=submit) en la ultima transicion; el re-render sincrono dentro
              del onClick cambia el type a submit y, al devolver el control, el navegador
              ejecuta la accion por defecto del clic sobre un boton que ya envia. Efecto: la
              encuesta se autoenvia sola al ENTRAR a la ultima seccion (D8, Contexto Social)
              y ese dominio se pierde en TODOS los pacientes; asi quedo degradado el entorno
              demo semanas sin que nadie lo notara. Con keys distintas el nodo de "Siguiente"
              se desmonta y "Enviar" se monta nuevo, asi el clic no puede disparar el submit.
              NINGUN test automatico atrapa esto (jsdom no reproduce el default action nativo,
              solo se ve en navegador); si tocas estos botones, pruebalo en un navegador real. */}
          {isLast ? (
            <Button
              key="nav-submit"
              type="submit"
              disabled={!consentOk || !identityOk || !otpState.sent || !otpCodeOk || pending}
            >
              {pending ? "Enviando..." : isFollowup ? "Enviar seguimiento" : "Enviar"}
            </Button>
          ) : (
            <Button key="nav-next" type="button" onClick={goNext} disabled={!canAdvance}>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
