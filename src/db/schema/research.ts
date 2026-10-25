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
  // EL VOCABULARIO ESTA CERRADO POR CHECK en la base (0227) y DECLARADO AQUI con el mismo tipo, para que
  // un nivel inventado no compile. El comentario anterior decia "aggregate, anonymized" y no era un
  // control: la columna aceptaba cualquier texto, y le faltaba el nivel que describe lo que CNV produce
  // hoy (seudonimizado).
  //
  // Y NO SE TECLEA: se deriva de lo que el export quita (`modules/obbia/services/nivel-de-anonimizacion`).
  anonymizationLevel: text("anonymization_level", {
    enum: ["aggregate", "pseudonymized", "anonymized"],
  }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: createdAt(),
});
