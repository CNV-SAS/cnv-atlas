import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { profiles } from "./organizations";

// Grupo 15: investigacion (ligero en MVP). Acceso a data agregada/anonimizada,
// nunca a PII (patron RLS obbia/research).

export const researchDatasets = pgTable("research_datasets", {
  id: pk(),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => profiles.id),
  scope: text("scope").notNull(),
  anonymizationLevel: text("anonymization_level").notNull(), // aggregate, anonymized
  status: text("status").notNull().default("pending"),
  createdAt: createdAt(),
});
