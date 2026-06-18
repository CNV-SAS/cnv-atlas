import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { profiles } from "./organizations";

// Grupo 17: IA (config y prompts versionados). Las API keys siguen en .env, nunca
// en la BD. Cada edicion de prompt crea una version nueva (inmutable).

// Config global de IA: el admin elige proveedor/modelo activos.
export const aiConfig = pgTable("ai_config", {
  id: pk(),
  activeProvider: text("active_provider").notNull(), // groq, gemini
  activeModel: text("active_model").notNull(),
  updatedBy: uuid("updated_by").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiPrompts = pgTable(
  "ai_prompts",
  {
    id: pk(),
    promptKey: text("prompt_key").notNull(), // ej. menu.generate
    version: integer("version").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("active"), // active, retired
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("ai_prompts_key_version_unique").on(t.promptKey, t.version),
    uniqueIndex("ai_prompts_one_active_idx")
      .on(t.promptKey)
      .where(sql`status = 'active'`),
  ],
);
