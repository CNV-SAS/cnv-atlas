"use client";

import { startTransition, useActionState, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ConsentDocumentCollapsible } from "@/modules/consent/components/consent-document-collapsible";
import {
  buildConsentInstance,
  type ConsentInstanceData,
} from "@/modules/consent/consent-instance";

import { COLOMBIA_CITIES, COUNTRIES, DEFAULT_COUNTRY } from "../data/geo";
import { sendConsentOtpAction, signSurveyAction } from "../actions";
import type { OtpSendState, SignSurveyState } from "../validations";
import { Field, checkboxClass, selectClass } from "./survey-form-shared";

// FASE 1 del intake: FIRMAR. Consentimiento + identidad + verificacion por codigo (OTP). Al firmar crea
// el shell 'awaiting_survey' y devuelve el resume_token; el orquestador pasa entonces a la pantalla
// "firmado". La encuesta (fase 2) va aparte: aqui NO se recogen respuestas (dictamen 2026-08-10, la Ley
// 1581 exige autorizacion PREVIA a la recoleccion).
//
// HAZARDS de navegador (ver CLAUDE.md, seccion Next.js): (1) keys DISTINTAS en "Siguiente" vs "Firmar"
// para no reusar el nodo y auto-enviar; (2) accion por onSubmit + startTransition, NUNCA prop `action`
// (auto-reset de React 19); (3) el codigo OTP se pide al FINAL de esta fase (vence en 10 min).

const initialSign: SignSurveyState = { error: null, fields: null, resumeToken: null };
const initialOtp: OtpSendState = { error: null, sent: false, maskedDestination: null, remaining: null };

// Validez de correo para habilitar el envio del codigo en cliente (el servidor revalida con Zod).
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

// Parentesco/calidad del representante legal (CONSENT_ATLAS seccion 11).
const RELATIONSHIPS: { value: string; label: string }[] = [
  { value: "padre", label: "Padre" },
  { value: "madre", label: "Madre" },
  { value: "tutor", label: "Tutor legal" },
  { value: "curador", label: "Curador" },
];

// Edad en años cumplidos a partir de una fecha YYYY-MM-DD (UTC). null si vacia o invalida. Solo cliente,
// para mostrar/ocultar el asentimiento; el servidor revalida con el mismo criterio (consent/validations).
function ageFromISO(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - Number(m[1]);
  const monthDiff = now.getUTCMonth() + 1 - Number(m[2]);
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < Number(m[3]))) age -= 1;
  return age;
}

export type SignPhaseFormProps = {
  token: string;
  prefill: { city?: string | null; phone?: string | null } | null;
  consentText: string;
  // Datos del profesional asignado para el bloque del profesional del consentimiento (numeral 2).
  professional: { fullName: string; profession: string; license: string | null };
  // Se invoca al firmar con exito, con el resume_token. El orquestador pasa a la pantalla "firmado".
  onSigned: (resumeToken: string) => void;
};

export function SignPhaseForm({ token, prefill, consentText, professional, onSigned }: SignPhaseFormProps) {
  const [state, action, pending] = useActionState(signSurveyAction, initialSign);
  const topRef = useRef<HTMLDivElement>(null);

  // Al firmar con exito el servidor devuelve el resume_token: se lo pasamos al orquestador (que pasa a la
  // pantalla "firmado"). Este componente se desmonta ahi; el efecto no se dispara dos veces.
  useEffect(() => {
    if (state.resumeToken) onSigned(state.resumeToken);
  }, [state.resumeToken, onSigned]);

  // Firma electronica (B7). sessionId: nonce opaco de ESTE intento, generado una sola vez; ancla el
  // codigo a este navegador y viaja al enviar y al validar. El envio del codigo se invoca IMPERATIVAMENTE
  // (no como action del form) para no disparar el auto-reset de React 19 sobre el resto de campos.
  const [sessionId] = useState(() => crypto.randomUUID());
  const [otpState, sendOtp, otpPending] = useActionState(sendConsentOtpAction, initialOtp);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Rama de edad (mayor/menor): eleccion explicita y obligatoria (DELTA2 B2).
  const [ageBranch, setAgeBranch] = useState<"" | "mayor" | "menor">("");
  // v1.0 (revision legal): TRES necesarias (servicio absorbe el acuse del tratamiento internacional/IA/
  // derechos; ya no hay casilla 'internacional_ia' separada).
  const [necessary, setNecessary] = useState({
    servicio: false,
    datos_sensibles: false,
    aceptacion_medio_electronico: false,
  });
  const [rep, setRep] = useState({ name: "", document: "", relationship: "", email: "" });
  const [minorBirthDate, setMinorBirthDate] = useState("");
  const [assent, setAssent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  // Sexo OBLIGATORIO (el motor lo exige F/M estricto). Pais con default Colombia.
  const [sex, setSex] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [showFullText, setShowFullText] = useState(false);

  const isMinor = ageBranch === "menor";
  const minorAge = isMinor ? ageFromISO(minorBirthDate) : null;
  const assentRequired = minorAge !== null && minorAge >= 14 && minorAge <= 17;
  const minorName = `${firstName} ${lastName}`.trim();

  const necessaryOk =
    necessary.servicio && necessary.datos_sensibles && necessary.aceptacion_medio_electronico;
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

  // INSTANCIA del consentimiento para MOSTRAR (B7): la plantilla congelada con el bloque del profesional
  // relleno, SOLO la rama que aplica, y (cuando existan) nombre y documento del paciente; antes, como
  // "pendiente". En pantalla el numeral 12 va SIN marcar (los controles de abajo lo marcan; la COPIA lo
  // refleja) y la fecha queda pendiente. La plantilla y el hash no se tocan.
  const pendiente = "(se completará con tus datos)";
  const patientName = minorName || pendiente;
  const patientDocument = documentNumber.trim() || pendiente;
  const consentInstance = useMemo(() => {
    const data: ConsentInstanceData = {
      branch: ageBranch === "menor" ? "menor" : "mayor",
      patient: { name: patientName, document: patientDocument },
      professional,
      representative: isMinor ? rep : null,
      representativePending: "*(Se completarán con los datos del representante.)*",
      assent: isMinor ? { applies: assentRequired, minorName: patientName } : null,
      granted: [],
      acceptedAt: null,
    };
    return buildConsentInstance(consentText, data);
  }, [consentText, ageBranch, isMinor, patientName, patientDocument, professional, rep, assentRequired]);
  const deferredConsentInstance = useDeferredValue(consentInstance);

  // Pasos de la fase 1: consentimiento e identidad (dos compuertas). La verificacion por codigo aparece
  // en el segundo paso (el ultimo de esta fase), no antes: el codigo vence en 10 minutos.
  const steps = useMemo(
    () => [
      { kind: "consent" as const, title: "Consentimiento" },
      { kind: "identity" as const, title: isMinor ? "Datos del menor" : "Tus datos" },
    ],
    [isMinor],
  );
  const [step, setStep] = useState(0);
  const total = steps.length;
  const current = steps[Math.min(step, total - 1)];
  const isLast = step === total - 1;

  const destinationEmail = isMinor ? rep.email : email;
  const destinationEmailOk = emailLooksValid(destinationEmail);

  const identityOk = Boolean(
    documentNumber.trim() &&
      firstName.trim() &&
      lastName.trim() &&
      (sex === "F" || sex === "M") &&
      (isMinor ? minorBirthDate : birthDate) &&
      (isMinor ? true : emailLooksValid(email)),
  );

  // Que falta EXACTAMENTE en el paso de identidad, para que el boton deshabilitado no obligue a revisar
  // campo por campo (reporte de Santiago). Orden de aparicion en el formulario. En rama menor la fecha y el
  // correo viven en el paso de consentimiento (no se listan aqui).
  const missingIdentity: string[] = [];
  if (!documentNumber.trim()) missingIdentity.push("número de documento");
  if (!firstName.trim()) missingIdentity.push("nombres");
  if (!lastName.trim()) missingIdentity.push("apellidos");
  if (!(sex === "F" || sex === "M")) missingIdentity.push("sexo");
  if (isMinor) {
    // En menor la fecha y el correo del representante viven en el paso de consentimiento.
    if (!minorBirthDate) missingIdentity.push("la fecha de nacimiento del menor (paso anterior)");
  } else {
    if (!birthDate) missingIdentity.push("fecha de nacimiento");
    if (!emailLooksValid(email)) missingIdentity.push("un correo válido");
  }
  // Mensaje: pocos -> se enumeran; muchos -> el conteo (una lista larga desalienta mas que orienta).
  const missingText =
    missingIdentity.length === 0
      ? null
      : missingIdentity.length <= 3
        ? `Falta${missingIdentity.length > 1 ? "n" : ""}: ${missingIdentity.join(", ")}.`
        : `Faltan ${missingIdentity.length} datos por completar (revisa los campos de arriba).`;

  const canAdvance = current.kind === "consent" ? consentOk : identityOk;
  const maxReachable = !consentOk ? 0 : 1;

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  // Envio del codigo (B7): imperativo (no como action del form) para no resetear el resto. El destino lo
  // decide el servidor por la rama; aqui solo se arma el payload minimo.
  const sendCode = () => {
    const fd = new FormData();
    fd.set("token", token);
    fd.set("sessionId", sessionId);
    fd.set("ageBranch", ageBranch);
    if (isMinor) fd.set("legalRepresentativeEmail", rep.email);
    else fd.set("email", email);
    startTransition(() => sendOtp(fd));
  };

  // Envio SIN el auto-reset de React 19: la action se invoca en una transicion, no como prop `action`.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => action(new FormData(e.currentTarget)));
  };

  const otpCodeOk = /^\d{6}$/.test(otpCode.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6"
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
          <p className="text-sm font-semibold text-foreground">{current.title}</p>
        </div>
        <Progress value={Math.round(((step + 1) / total) * 100)} />
        <nav aria-label="Pasos para firmar" className="flex flex-wrap gap-1.5">
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
            Antes de empezar necesitamos tu autorizacion para tratar tus datos. Marca las
            casillas necesarias para continuar.
          </p>
        </div>

        {/* Selector de edad (eleccion explicita y obligatoria) */}
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
              El representante legal otorga el consentimiento en nombre del menor y firma las
              autorizaciones.
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
                  onChange={(e) => setRep((s) => ({ ...s, relationship: e.target.value }))}
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

            {/* Asentimiento del menor: solo entre 14 y 17 años */}
            {assentRequired ? (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
                <p className="text-xs italic text-muted-foreground">
                  &ldquo;Yo, {minorName || "el/la menor evaluado/a"}, he sido informado/a de forma
                  adecuada a mi edad sobre esta evaluacion y estoy de acuerdo en participar.&rdquo;
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="asentimiento_menor"
                    className={checkboxClass}
                    checked={assent}
                    onChange={(e) => setAssent(e.target.checked)}
                  />
                  <span>El menor (14 a 17 años) otorga su asentimiento en los terminos anteriores.</span>
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
              Autorizo el tratamiento de los datos personales para las finalidades necesarias del
              servicio, y declaro conocer el tratamiento internacional, el uso de sistemas automatizados y
              mis derechos como titular.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="datos_sensibles"
              className={checkboxClass}
              checked={necessary.datos_sensibles}
              onChange={(e) => setNecessary((s) => ({ ...s, datos_sensibles: e.target.checked }))}
            />
            <span>
              Autorizo el tratamiento de los datos sensibles de salud, de forma voluntaria, para la
              evaluacion.
            </span>
          </label>
          {/* Firma electronica (v1.0 numeral 12): aceptacion del medio electronico. */}
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
              Acepto firmar este consentimiento por medios electrónicos, con plena validez (Ley 527 de
              1999), y recibir un código de verificación en el medio de contacto que registro (propio o
              de una persona de confianza que yo designe).
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
              Autorizo el uso de los datos seudonimizados para investigacion cientifica del modelo,
              incluida mi pertenencia etnica para el analisis de diferencias entre poblaciones, cuando
              decida informarla.
            </span>
          </label>
          {/* Continuidad y publicidad DIFERENCIADAS (rotulo en negrita), NUNCA fusionadas: fusionarlas
              condicionaria la continuidad de la atencion a aceptar publicidad (revision legal). */}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="comunicaciones_continuidad" className={checkboxClass} />
            <span>
              <strong>Continuidad asistencial.</strong> Autorizo que CNV me contacte para asegurar la
              continuidad de mi proceso en salud dentro de la red, especialmente si mi profesional deja de
              operar el modelo.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="comunicaciones_comerciales" className={checkboxClass} />
            <span>
              <strong>Publicidad.</strong> Autorizo recibir comunicaciones comerciales y promocionales del
              ecosistema CNV.
            </span>
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
              <ConsentDocumentCollapsible text={deferredConsentInstance} />
            </div>
          ) : null}
        </div>
      </section>

      {/* Paso 2: Identificacion (en rama menor, del menor evaluado) */}
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
            <Input name="firstName" className="h-9" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Apellidos">
            <Input name="lastName" className="h-9" value={lastName} onChange={(e) => setLastName(e.target.value)} />
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
            <select name="sex" value={sex} onChange={(e) => setSex(e.target.value)} className={selectClass}>
              <option value="" disabled>
                Selecciona
              </option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
            </select>
          </Field>
          <Field label="País">
            <select name="country" value={country} onChange={(e) => setCountry(e.target.value)} className={selectClass}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ciudad">
            {/* Datalist: sugiere ciudades de Colombia PERO acepta cualquier texto. Otros paises: texto libre. */}
            <Input
              name="city"
              className="h-9"
              defaultValue={prefill?.city ?? ""}
              list={country === DEFAULT_COUNTRY ? "co-cities" : undefined}
            />
            {country === DEFAULT_COUNTRY ? (
              <datalist id="co-cities">
                {COLOMBIA_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            ) : null}
          </Field>
          <Field label="Celular">
            <Input name="phone" className="h-9" defaultValue={prefill?.phone ?? ""} />
          </Field>
          {/* Correo del paciente: OBLIGATORIO en la rama mayor (llega el codigo y la copia). En menor el
              que cuenta es el del representante (bloque de consentimiento). */}
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

      {/* Navegacion + verificacion */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {current.kind === "consent" && !consentOk ? (
          <p className="text-xs text-muted-foreground">
            Indica tu situacion de edad, completa el bloque que corresponda y marca las autorizaciones
            necesarias para continuar.
          </p>
        ) : null}
        {current.kind === "identity" && missingText ? (
          <p className="text-xs font-medium text-clinical-warning">{missingText}</p>
        ) : null}

        {/* Verificacion de firma (B7): SOLO al final de esta fase (el codigo vence en 10 minutos). */}
        {isLast ? (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Verificación para firmar</h3>
              <p className="text-xs text-muted-foreground">
                Para firmar el consentimiento te enviamos un código al correo{" "}
                {isMinor ? "del representante" : "que registraste"}. Ingrésalo aquí para firmar y pasar a
                la encuesta.
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
                <p className="text-xs text-muted-foreground">
                  Enviamos un código a{" "}
                  <span className="font-medium text-foreground">{otpState.maskedDestination}</span>. Puede
                  tardar un momento; si no lo ves, revisa la carpeta de correo no deseado.
                </p>
                {/* Auto-correccion del correo antes de firmar: el codigo y el enlace de reanudacion van al
                    MISMO correo, asi que un correo malo se descubre AQUI (el codigo no llega) y se corrige
                    sin ayuda. El campo sigue editable en este punto. En rama menor el correo esta en el paso
                    de consentimiento (el del representante), no en esta pantalla. */}
                <p className="text-xs text-muted-foreground">
                  {isMinor
                    ? "¿No llega? Revisa que el correo del representante esté bien escrito en el paso de consentimiento; corrígelo y pide el código de nuevo."
                    : "¿No llega? Revisa que tu correo esté bien escrito arriba; puedes corregirlo y pedir el código de nuevo."}
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
                <div className="flex flex-wrap items-center gap-3">
                  <Button key="otp-resend" type="button" variant="outline" size="sm" onClick={sendCode} disabled={otpPending}>
                    {otpPending ? "Reenviando..." : "Reenviar código"}
                  </Button>
                  {typeof otpState.remaining === "number" ? (
                    <span className="text-xs text-muted-foreground">
                      Te{" "}
                      {otpState.remaining === 1 ? "queda 1 reenvío" : `quedan ${otpState.remaining} reenvíos`} en
                      esta ventana.
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
          <Button key="nav-back" type="button" variant="outline" onClick={goBack} disabled={step === 0 || pending}>
            Anterior
          </Button>
          {/* keys DISTINTAS a proposito. NO SON COSMETICAS: sin ellas React reutiliza el mismo nodo DOM al
              pasar de "Siguiente" (type=button) a "Firmar" (type=submit) en la ultima transicion, el
              re-render sincrono cambia el type a submit y el navegador ejecuta el envio por defecto. Con
              keys distintas "Siguiente" se desmonta y "Firmar" se monta nuevo. Ver CLAUDE.md; solo se ve
              en navegador real. */}
          {isLast ? (
            <Button
              key="nav-submit"
              type="submit"
              disabled={!consentOk || !identityOk || !otpState.sent || !otpCodeOk || pending}
            >
              {pending ? "Firmando..." : "Firmar y continuar"}
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
