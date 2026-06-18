import { timestamp, uuid } from "drizzle-orm/pg-core";

// Builders de columnas repetidas. Son funciones (no constantes) para devolver una
// instancia nueva por tabla; compartir el mismo builder entre tablas puede arrastrar
// estado y producir DDL incorrecto.

// IDs uuid con default gen_random_uuid() (DATABASE.md principio 10).
export const pk = () => uuid("id").primaryKey().defaultRandom();

// created_at/updated_at en toda tabla mutable (principio 9). El updated_at lo
// mueve el trigger set_updated_at (sub-tarea 4); aqui solo va el default.
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
