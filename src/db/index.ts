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
//
// Y EL TAMANO DEL POOL IMPORTA EN SERVERLESS (2026-09-15). Por defecto postgres.js abre hasta 10 conexiones POR
// INSTANCIA, y Vercel tiene muchas instancias vivas a la vez (mas todavia justo despues de un deploy, cuando
// conviven las viejas y las nuevas). Contra una base que admite pocas conexiones, eso las agota y la base empieza
// a rechazar: las consultas que van por aqui fallan mientras las que van por la API REST de Supabase siguen
// funcionando. Es el cuadro del smoke del Bloque A: /pagos caido para administracion y el webhook de Wompi sin
// poder registrar el evento, con la app navegando bien. `idle_timeout` devuelve la conexion que nadie usa en vez
// de retenerla, y `connect_timeout` evita que una conexion que no llega cuelgue la peticion.
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
});

// ═══ NADA DE PARAMETROS DE ARRANQUE AQUI (`connection: {...}`) ═══
//
// Tentacion natural: poner `connection: { statement_timeout: 20_000 }` para que ninguna consulta se eternice.
// NO SE PUEDE. El pooler en modo TRANSACCION (el que usa la app, puerto 6543) NO admite parametros de sesion en
// el arranque: la conexion es de cada transaccion, no de cada cliente. Puesto ahi, no falla una consulta: fallan
// TODAS, con "unsupported startup parameter". Lo mismo vale para `search_path` o cualquier otro `SET` de sesion.
//
// Donde si se puede acotar: DENTRO de una transaccion, con `set local` (asi funciona el `lock_timeout` de los
// writers de tratamiento), o por rol en la base. El candado `cliente-de-la-base` lo vigila.

export const db = drizzle(client, { schema });

// Tipo de la transaccion que pasa db.transaction(...). Se importa como tipo (se
// borra en runtime), asi quien lo use no carga este modulo server-only.
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
