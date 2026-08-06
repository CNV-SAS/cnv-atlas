import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { nutraceuticalAvailability } from "./enums";
import { organizations } from "./organizations";
import { treatments } from "./treatments";

// Grupo 13: nutraceuticos. Catalogo VITACELLEBIS. Fuente de la GRAFIA del nombre: el registro
// sanitario (INVIMA), no la tienda; cuando difieran, manda el registro (ver DATA_GOVERNANCE).
// El precio se SELLA en transaction_items.unit_price al crear el checkout: cambiarlo aqui afecta
// solo checkouts futuros, no transacciones pasadas.

export const nutraceuticals = pgTable("nutraceuticals", {
  id: pk(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit"),
  unitPrice: numeric("unit_price"),
  // Datos del catalogo VITACELLEBIS (tienda + registro sanitario).
  indication: text("indication"), // para que sirve
  composition: text("composition"), // ingredientes
  presentation: text("presentation"), // linea: liquida | polvo
  servingSize: text("serving_size"), // porcion: "30 mL", "25 g"...
  sanitaryRegistration: text("sanitary_registration"), // RSA-.../NSA-...
  commercialAvailability: nutraceuticalAvailability("commercial_availability")
    .notNull()
    .default("no_disponible"),
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
