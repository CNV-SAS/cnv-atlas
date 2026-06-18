import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { evaluations } from "./evaluations";
import { patients } from "./patients";
import { treatments } from "./treatments";

// Grupo 10: seguimiento.

export const followups = pgTable(
  "followups",
  {
    id: pk(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    treatmentId: uuid("treatment_id").references(() => treatments.id, {
      onDelete: "set null",
    }),
    // La evaluacion de tipo seguimiento.
    evaluationId: uuid("evaluation_id").references(() => evaluations.id, {
      onDelete: "set null",
    }),
    followupDate: timestamp("followup_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("followups_patient_idx").on(t.patientId)],
);

export const followupMetrics = pgTable("followup_metrics", {
  id: pk(),
  followupId: uuid("followup_id")
    .notNull()
    .references(() => followups.id, { onDelete: "cascade" }),
  metricName: text("metric_name").notNull(),
  value: numeric("value"),
});
