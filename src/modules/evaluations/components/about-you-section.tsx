"use client";

import { useState } from "react";

import {
  ASCENDENCIA_OPTIONS,
  ASCENDENCIA_PROMPT,
  EDUCACION_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  ESTRATO_OPTIONS,
  ETNIA_OPTIONS,
  ETNIA_DESCRIPTIONS,
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
  ancestry: string | null;
  reasonForVisit: string[];
};

// La ocupacion "Otra" habilita texto libre; separa la eleccion del desplegable del valor final.
function splitOccupation(value: string | null): { choice: string; other: string } {
  if (!value) return { choice: "", other: "" };
  const preset = (OCUPACION_OPTIONS as readonly string[]).includes(value) && value !== "Otra";
  return preset ? { choice: value, other: "" } : { choice: "Otra", other: value };
}

// Motivo "Otro" (token verbatim de Gildardo, MASCULINO: no lo reconoce el detector /^otr(a|os)$/i de la
// encuesta, por eso se cablea aparte). Habilita texto libre; se guarda como "Otro: <texto>". Al reanudar,
// un valor "Otro: xxx" se descompone en el token base (para marcar la casilla) + su texto.
const MOTIVO_OTHER = "Otro";
function splitMotivo(values: string[]): { selected: string[]; otherText: string } {
  let otherText = "";
  const selected = values.map((v) => {
    const m = /^otro\s*:\s*(.+)$/i.exec(v.trim());
    if (m) {
      otherText = m[1];
      return MOTIVO_OTHER;
    }
    return v;
  });
  return { selected, otherText };
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
  const [ancestry, setAncestry] = useState(prefill?.ancestry ?? "");
  const [occupationChoice, setOccupationChoice] = useState(initialOcc.choice);
  const [occupationOther, setOccupationOther] = useState(initialOcc.other);
  const initialMotivo = splitMotivo(prefill?.reasonForVisit ?? []);
  const [motivo, setMotivo] = useState<string[]>(initialMotivo.selected);
  const [motivoOther, setMotivoOther] = useState(initialMotivo.otherText);

  const toggleMotivo = (opt: string) =>
    setMotivo((prev) => (prev.includes(opt) ? prev.filter((m) => m !== opt) : [...prev, opt]));

  // Valor canonico de ocupacion: el texto libre si eligio "Otra"; si no, la opcion. Vacio => no se envia.
  const occupationValue =
    occupationChoice === "Otra" ? occupationOther.trim() : occupationChoice;

  // "Otro" con texto -> "Otro: <texto>"; el resto tal cual. El texto vacio deja el token pelado (registro).
  const emitMotivo = (m: string) =>
    m === MOTIVO_OTHER && motivoOther.trim() ? `${MOTIVO_OTHER}: ${motivoOther.trim()}` : m;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Sobre ti (opcional)</h2>
        <p className="text-sm text-muted-foreground">
          Nos ayuda a entender mejor a quienes atendemos. Puedes omitir lo que no quieras responder;
          nada de esto es obligatorio.
        </p>
      </div>

      {/* El motivo (multi) siempre viaja por name="motivo"; se controla por estado. "Otro" viaja con su
          texto libre pegado ("Otro: <texto>") cuando lo escribio. */}
      {motivo.map((m) => (
        <input key={m} type="hidden" name="motivo" value={emitMotivo(m)} />
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
          {/* "Otro" abre texto libre (antes la casilla se marcaba pero no aparecia nada donde escribir). */}
          {motivo.includes(MOTIVO_OTHER) ? (
            <input
              type="text"
              className={`${selectClass} mt-1`}
              placeholder="¿Cuál es el motivo?"
              maxLength={120}
              value={motivoOther}
              onChange={(e) => setMotivoOther(e.target.value)}
            />
          ) : null}
        </div>
      </Field>

      {includeProfile ? (
        // Todos los selects arrancan con un PROMPT neutro (value=""), no con una opcion pre-elegida:
        // dejar en blanco = no respondio (se guarda null), no una decision que el paciente no tomo. Estos
        // cuatro no son datos sensibles, asi que no llevan un "Prefiero no responder" explicito (basta el
        // blanco); etnia SI lo lleva, porque el dictamen exige distinguir "no respondio" de "eligio no
        // informar" en un dato sensible. Misma disciplina ausencia-vs-vacio, calibrada por sensibilidad.
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nivel educativo">
            <select
              name="educationLevel"
              className={selectClass}
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value)}
            >
              <option value="">Selecciona una opción</option>
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
              <option value="">Selecciona una opción</option>
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
              <option value="">Selecciona una opción</option>
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
              <option value="">Selecciona una opción</option>
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
                  {/* Prompt neutro, NO una opcion de "no respondio": dejar en blanco ya cubre eso.
                      "Prefiero no responder" (en la lista) es la eleccion EXPLICITA de no informar. */}
                  <option value="">Selecciona una opción</option>
                  {ETNIA_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {/* Descripciones DANE: precisas y poco conocidas. Sin entenderlas no hay
                    autorreconocimiento (principio del dictamen). Pendiente de confirmacion legal. */}
                <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {ETNIA_OPTIONS.map((o) => (
                    <div key={o}>
                      <dt className="inline font-medium text-foreground">{o}:</dt>{" "}
                      <dd className="inline">{ETNIA_DESCRIPTIONS[o]}</dd>
                    </div>
                  ))}
                </dl>
              </Field>
            </div>
          ) : null}

          {/* Ascendencia (2a pregunta de etnia): JUNTO a la pertenencia (misma autorizacion). El prefijo
              "Independientemente de lo anterior" va PEGADO a la pregunta (no en un pie): es lo que evita que
              el paciente crea que se le pregunta lo mismo dos veces. */}
          {ethnicityAuthorized ? (
            <div className="sm:col-span-2">
              <Field label={`${ASCENDENCIA_PROMPT}, ¿cuál es tu ascendencia?`}>
                <p className="mb-1 text-xs text-muted-foreground">
                  Es distinta de la pertenencia étnica de arriba y también es voluntaria. Por
                  autorreconocimiento, para caracterización; nunca ajusta ningún resultado.
                </p>
                <select
                  name="ancestry"
                  className={selectClass}
                  value={ancestry}
                  onChange={(e) => setAncestry(e.target.value)}
                >
                  <option value="">Selecciona una opción</option>
                  {ASCENDENCIA_OPTIONS.map((o) => (
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
