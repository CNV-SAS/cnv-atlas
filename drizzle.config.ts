import { defineConfig } from "drizzle-kit";

// Carga .env.local sin dependencias externas (Node >=20.12 trae loadEnvFile).
// drizzle-kit no lee .env.local por su cuenta; sin esto, DATABASE_URL viene vacio
// y `migrate` falla. `generate` es offline (no necesita conexion), pero cargarlo
// aqui deja un solo punto de configuracion para ambos comandos.
process.loadEnvFile?.(".env.local");

// Drizzle es el unico runner de migraciones (decision B1). Las migraciones viven
// en ./drizzle, NO en supabase/migrations: el stack local de Supabase aplica por
// su cuenta lo que haya en supabase/migrations al arrancar/resetear, y eso
// chocaria con `drizzle-kit migrate`. Manteniendolas separadas, Supabase solo
// levanta el contenedor y genera tipos; Drizzle aplica el esquema.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // strict pide confirmacion antes de cambios destructivos; verbose imprime el SQL.
  strict: true,
  verbose: true,
});
