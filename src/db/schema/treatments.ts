import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { diagnoses } from "./diagnoses";
import { nutraceuticals } from "./nutraceuticals";
import { profiles } from "./organizations";

// Grupo 9: tratamiento.

export const treatments = pgTable("treatments", {
  id: pk(),
  diagnosisId: uuid("diagnosis_id")
    .notNull()
    .references(() => diagnoses.id, { onDelete: "restrict" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id),
  createdAt: createdAt(),
});

export const treatmentNutraceuticals = pgTable("treatment_nutraceuticals", {
  id: pk(),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "cascade" }),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id),
  dosage: text("dosage"),
  durationDays: integer("duration_days"),
});

export const treatmentDietGuidelines = pgTable("treatment_diet_guidelines", {
  id: pk(),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "cascade" }),
  guidelineText: text("guideline_text").notNull(),
});

export const treatmentNotes = pgTable("treatment_notes", {
  id: pk(),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: createdAt(),
});
