import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { organizations } from "./organizations";
import { treatments } from "./treatments";

// Grupo 13: nutraceuticos.

export const nutraceuticals = pgTable("nutraceuticals", {
  id: pk(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit"),
  unitPrice: numeric("unit_price"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const nutraceuticalInventory = pgTable("nutraceutical_inventory", {
  id: pk(),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id, { onDelete: "cascade" }),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
});

export const nutraceuticalUsage = pgTable("nutraceutical_usage", {
  id: pk(),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "cascade" }),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id),
  quantity: integer("quantity").notNull(),
});
