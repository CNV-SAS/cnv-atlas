import { index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { nutraceuticalAvailability, nutraceuticalMovementType } from "./enums";
import { organizations, professionalProfiles, profiles } from "./organizations";
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

// Saldo de custodia POR PROFESIONAL (consignacion): el producto es de CNV, ubicado en la vitrina del
// integrante. stock_quantity es un CACHE del saldo (suma de los movimientos); lo mueve SOLO el trigger
// del movimiento, nunca escritura directa (coherencia por trigger, migracion 0040). Una fila por
// (profesional, producto).
export const nutraceuticalInventory = pgTable(
  "nutraceutical_inventory",
  {
    id: pk(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id),
    nutraceuticalId: uuid("nutraceutical_id")
      .notNull()
      .references(() => nutraceuticals.id, { onDelete: "cascade" }),
    stockQuantity: integer("stock_quantity").notNull().default(0), // saldo cacheado = suma de movimientos
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("nutra_inventory_prof_nutra_unique").on(t.professionalId, t.nutraceuticalId)],
);

// Movimientos de inventario en consignacion: la FUENTE DE VERDAD auditable del saldo. Cada uno es
// INMUTABLE (trigger append-only, migracion 0040): un movimiento mal registrado NO se edita ni se borra,
// se corrige con otro en sentido contrario. El saldo (nutraceutical_inventory) es una proyeccion que
// SOLO mueve el trigger de este insert. delta con signo (+recepcion, -despacho, +/-conciliacion).
export const nutraceuticalStockMovements = pgTable(
  "nutraceutical_stock_movements",
  {
    id: pk(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id),
    nutraceuticalId: uuid("nutraceutical_id")
      .notNull()
      .references(() => nutraceuticals.id),
    delta: integer("delta").notNull(), // con signo
    type: nutraceuticalMovementType("type").notNull(),
    reason: text("reason"),
    // Despacho (T3b-2): liga la entrega al tratamiento (y por el, al paciente). Nullable: los demas
    // tipos (recepcion, conciliacion, devolucion) son comerciales, sin paciente.
    treatmentId: uuid("treatment_id").references(() => treatments.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [index("nutra_movements_prof_nutra_idx").on(t.professionalId, t.nutraceuticalId)],
);

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
