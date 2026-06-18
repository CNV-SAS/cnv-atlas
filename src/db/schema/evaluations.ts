import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { evaluationStatus, evaluationType } from "./enums";
import { organizations, professionalProfiles, profiles } from "./organizations";
import { patients } from "./patients";

// Grupo 5: evaluaciones (la ruta). El hub: pertenece a paciente + profesional +
// organizacion.

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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("evaluations_patient_idx").on(t.patientId),
    index("evaluations_professional_idx").on(t.professionalId),
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
