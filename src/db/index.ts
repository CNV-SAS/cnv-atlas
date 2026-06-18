import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Cliente Drizzle para queries del servidor. DATABASE_URL nunca llega al cliente
// (server-only lo garantiza en build): es la cadena con credenciales completas.
// Lo consumen los repositorios en data/ (ARCHITECTURE regla 1); el resto de la
// app no toca este modulo directamente.
//
// prepare: false desactiva prepared statements: el pooler en modo transaction de
// Supabase (produccion serverless) no los soporta. En local da igual, pero deja
// el mismo comportamiento en ambos entornos.
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });
