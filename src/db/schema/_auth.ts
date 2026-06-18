import { pgSchema, uuid } from "drizzle-orm/pg-core";

// Referencia minima a auth.users, que gestiona Supabase, NO Drizzle. Solo se usa
// como destino de claves foraneas (profiles.id la referencia). No se reexporta en
// index.ts a proposito: drizzle-kit genera DDL solo para el schema public
// (schemaFilter por defecto), asi que esta tabla nunca se crea ni se altera desde
// nuestras migraciones, pero la FK hacia auth.users si se emite.
const auth = pgSchema("auth");

export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey(),
});
