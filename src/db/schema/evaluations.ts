import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
