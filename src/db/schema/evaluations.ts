import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { evaluationStatus, evaluationType } from "./enums";
import { organizations, professionalProfiles, profiles } from "./organizations";
import { patients } from "./patients";

// Grupo 5: evaluaciones (la ruta). El hub: pertenece a paciente + profesional +
// organizacion. Del hub cuelga TODO (survey_responses, bis_measurements, diagnoses, reports),
// por eso la vigencia del flujo de correccion se marca AQUI y la cadena la hereda por el FK.

export const evaluations = pgTable(
  "evaluations",
  {
    id: pk(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    type: evaluationType("type").notNull(),
    status: evaluationStatus("status").notNull().default("draft"),
    // Reorganizacion del intake: CREDENCIAL opaca que autentica la escritura de respuestas de la fase 2
    // (el paciente no tiene sesion) y la reanudacion. Se genera al FIRMAR (fase 1) y solo vale mientras
    // status = 'awaiting_survey' (al completar la encuesta pasa a 'draft' y el token deja de habilitar).
    // Se trata como el token del enlace: largo, imposible de adivinar, nunca en logs. null salvo el shell.
    resumeToken: text("resume_token").unique(),
    // Conflicto de identidad: el documento coincidio con un paciente registrado PERO el nombre declarado
    // difiere (nameSimilarity < umbral). Se atribuye al paciente existente (el documento es la llave) pero
    // se marca para que el profesional resuelva ANTES de usarla. GATE: confirmIdentityAction rechaza
    // mientras esto sea true, y como BIS/diagnostico exigen in_progress, nada contaminado se sella. El
    // nombre DECLARADO se guarda aparte (el de seguimiento se descarta) para mostrar declarado-vs-registrado.
    identityConflict: boolean("identity_conflict").notNull().default(false),
    declaredFirstName: text("declared_first_name"),
    declaredLastName: text("declared_last_name"),
    // Motivo de consulta (caracterizacion del ENCUENTRO, no del paciente: cambia entre visitas, por eso va
    // aqui y no en patient_profiles). MULTI-select en el archivo de Gildardo: se guarda como arreglo JSON de
    // strings (mismo patron que las respuestas opcion_multiple). Opcional (nullable); sin efecto en el motor.
    reasonForVisit: text("reason_for_visit"),
    // Caracterizacion sociodemografica DEL ENCUENTRO (versionada por evaluacion, no solo en el perfil):
    // etnia, educacion, ocupacion, estado civil y estrato pueden cambiar entre consultas, y guardarlas
    // solo en patient_profiles (que se sobrescribe) perdia el historico. Columnas (no JSONB): el
    // observatorio estratifica por estos campos, sobre todo la etnia, y filtrar en JSONB es mas lento y
    // fragil. Opcionales (nullable); las evaluaciones anteriores a esta captura quedan en null (no se
    // copia el valor actual del perfil: seria fabricar un historico falso). La etnia (dato sensible, Ley
    // 1581) se persiste aqui SOLO con la autorizacion de investigacion vigente, igual que en el perfil
    // (mismo gate en el writer). El perfil sigue siendo la fuente del PREFILL en seguimiento.
    educationLevel: text("education_level"),
    occupation: text("occupation"),
    maritalStatus: text("marital_status"),
    socioeconomicStratum: text("socioeconomic_stratum"),
    ethnicity: text("ethnicity"),
    // Ascendencia (RESPUESTA_GILDARDO 2026-08-15 §3): 2a pregunta de etnia, mismo dato sensible y MISMO gate
    // de investigacion que `ethnicity` (el writer nulifica ambas sin autorizacion). Versionada por evaluacion.
    ancestry: text("ancestry"),
    // Residencia PROLONGADA del encuentro (RESPUESTA_GILDARDO 2026-08-17 §1), VERSIONADA por evaluacion:
    // alguien puede mudarse entre consultas y ese es el dato que importa para la adaptacion a la altura.
    // Opcional, caracterizacion, sin field_key. Distinta de la ciudad ACTUAL (perfil, contacto). De aqui
    // saldria la altitud FISIOLOGICA cuando el observatorio la use (hoy no alimenta el motor). El perfil es
    // la fuente del PREFILL. Se captura en la fase de firma, junto a la ciudad actual, no en la fase 2.
    longestResidenceCity: text("longest_residence_city"),
    // Flag de vigencia del flujo de correccion (gate del Hito 1, ver PLAN_FLUJO_CORRECCION.md).
    // NULL = evaluacion vigente; con valor = fue reemplazada por una version corregida. NO es la
    // relacion (a cual la reemplazo eso vive en clinical_corrections, UNA vez); es una proyeccion
    // denormalizada para filtrar barato. Lo escribe SOLO el trigger del insert de clinical_corrections
    // (nunca el servicio a mano), es write-once, y un trigger de coherencia lo amarra: no puede
    // ponerse sin una fila de correccion que nombre esta evaluacion como old_evaluation_id.
    // diagnoses/treatments/reports NO tienen equivalente: heredan vigencia por el FK a la evaluacion.
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("evaluations_patient_idx").on(t.patientId),
    index("evaluations_professional_idx").on(t.professionalId),
    // Filtro de vigencia: la mayoria de consultas piden solo las evaluaciones vigentes.
    index("evaluations_superseded_idx").on(t.supersededAt),
  ],
);

export const evaluationNotes = pgTable("evaluation_notes", {
  id: pk(),
  evaluationId: uuid("evaluation_id")
    .notNull()
    .references(() => evaluations.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id),
  note: text("note").notNull(),
  createdAt: createdAt(),
});
