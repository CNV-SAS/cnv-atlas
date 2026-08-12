"use client";

import { useState } from "react";

import {
  EDUCACION_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  ESTRATO_OPTIONS,
  ETNIA_OPTIONS,
  MOTIVO_OPTIONS,
  OCUPACION_OPTIONS,
} from "../data/sociodemographic-options";
import { Field, checkboxClass, selectClass } from "./survey-form-shared";

// Seccion "Sobre ti" al inicio de la fase 2 del intake (E1). Caracterizacion OPCIONAL y post-autorizacion
// (ya se firmo en la fase 1). Los 4 campos de perfil van a patient_profiles; el motivo (multi) a la
// evaluacion. VISIBLEMENTE opcional: nada obligatorio, sin asterisco, sin gate (un dato inventado es peor
// que uno vacio para el observatorio). Opciones portadas verbatim del archivo de Gildardo.
//
// includeProfile=false en SEGUIMIENTO: el perfil ya se capturo en la evaluacion inicial (dato estable), asi
// que solo se muestra el motivo (dato del encuentro) + una linea de que sus datos ya estan. El marcador
// oculto hasProfileFields distingue las dos ramas en el servidor (no re-escribe el perfil en seguimiento).

export type AboutYouPrefill = {
  educationLevel: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  socioeconomicStratum: string | null;
  ethnicity: string | null;
  reasonForVisit: string[];
};

// La ocupacion "Otra" habilita texto libre; separa la eleccion del desplegable del valor final.
function splitOccupation(value: string | null): { choice: string; other: string } {
  if (!value) return { choice: "", other: "" };
  const preset = (OCUPACION_OPTIONS as readonly string[]).includes(value) && value !== "Otra";
  return preset ? { choice: value, other: "" } : { choice: "Otra", other: value };
}

export function AboutYouSection({
  includeProfile,
  prefill = null,
  // Etnia (dato sensible): el campo solo aparece si el paciente OTORGO la autorizacion de investigacion
  // (consent v1.0). No basta que la version sea la nueva; tiene que haberla marcado. El servidor lo re-gatea.
  ethnicityAuthorized = false,
}: {
  includeProfile: boolean;
  prefill?: AboutYouPrefill | null;
  ethnicityAuthorized?: boolean;
}) {
  const initialOcc = splitOccupation(prefill?.occupation ?? null);
  const [educationLevel, setEducationLevel] = useState(prefill?.educationLevel ?? "");
  const [maritalStatus, setMaritalStatus] = useState(prefill?.maritalStatus ?? "");
  const [stratum, setStratum] = useState(prefill?.socioeconomicStratum ?? "");
  const [ethnicity, setEthnicity] = useState(prefill?.ethnicity ?? "");
  const [occupationChoice, setOccupationChoice] = useState(initialOcc.choice);
  const [occupationOther, setOccupationOther] = useState(initialOcc.other);
  const [motivo, setMotivo] = useState<string[]>(prefill?.reasonForVisit ?? []);

  const toggleMotivo = (opt: string) =>
    setMotivo((prev) => (prev.includes(opt) ? prev.filter((m) => m !== opt) : [...prev, opt]));

  // Valor canonico de ocupacion: el texto libre si eligio "Otra"; si no, la opcion. Vacio => no se envia.
  const occupationValue =
    occupationChoice === "Otra" ? occupationOther.trim() : occupationChoice;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Sobre ti (opcional)</h2>
        <p className="text-sm text-muted-foreground">
          Nos ayuda a entender mejor a quienes atendemos. Puedes omitir lo que no quieras responder;
          nada de esto es obligatorio.
        </p>
      </div>

      {/* El motivo (multi) siempre viaja por name="motivo"; se controla por estado. */}
      {motivo.map((m) => (
        <input key={m} type="hidden" name="motivo" value={m} />
      ))}
      {/* La ocupacion viaja resuelta por name="occupation" (texto libre si eligio "Otra"). */}
      {includeProfile && occupationValue ? (
        <input type="hidden" name="occupation" value={occupationValue} />
      ) : null}
      {/* Marcador de rama: presente solo cuando se muestran los 4 de perfil (intake inicial). En seguimiento
          ausente, para que el servidor no re-escriba el perfil ya capturado. */}
      {includeProfile ? <input type="hidden" name="hasProfileFields" value="1" /> : null}

      <Field label="Motivo de consulta (puedes elegir varios)">
        <div className="flex flex-col gap-2">
          {MOTIVO_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={motivo.includes(opt)}
                onChange={() => toggleMotivo(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </Field>

      {includeProfile ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nivel educativo">
            <select
              name="educationLevel"
              className={selectClass}
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value)}
            >
              <option value="">Prefiero no responder</option>
              {EDUCACION_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ocupación">
            <select
              className={selectClass}
              value={occupationChoice}
              onChange={(e) => setOccupationChoice(e.target.value)}
            >
              <option value="">Prefiero no responder</option>
              {OCUPACION_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {occupationChoice === "Otra" ? (
              <input
                type="text"
                className={`${selectClass} mt-2`}
                placeholder="Especifica tu ocupación"
                maxLength={120}
                value={occupationOther}
                onChange={(e) => setOccupationOther(e.target.value)}
              />
            ) : null}
          </Field>

          <Field label="Estado civil">
            <select
              name="maritalStatus"
              className={selectClass}
              value={maritalStatus}
              onChange={(e) => setMaritalStatus(e.target.value)}
            >
              <option value="">Prefiero no responder</option>
              {ESTADO_CIVIL_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estrato socioeconómico">
            <select
              name="socioeconomicStratum"
              className={selectClass}
              value={stratum}
              onChange={(e) => setStratum(e.target.value)}
            >
              <option value="">Prefiero no responder</option>
              {ESTRATO_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          {/* Etnia (dato sensible): SOLO si el paciente otorgo la autorizacion de investigacion. Una linea
              la conecta con lo que acepto; el select se llama "ethnicity"; el servidor la re-gatea. */}
          {ethnicityAuthorized ? (
            <div className="sm:col-span-2">
              <Field label="Pertenencia étnica">
                <p className="mb-1 text-xs text-muted-foreground">
                  Autorizaste informar tu pertenencia étnica para investigación; es voluntario y puedes
                  omitirlo. Es por autorreconocimiento (nadie la asigna por ti).
                </p>
                <select
                  name="ethnicity"
                  className={selectClass}
                  value={ethnicity}
                  onChange={(e) => setEthnicity(e.target.value)}
                >
                  <option value="">Sin especificar</option>
                  {ETNIA_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Tus datos de caracterización ya están registrados de tu evaluación anterior. Solo confirmamos el
          motivo de esta consulta.
        </p>
      )}
    </section>
  );
}
