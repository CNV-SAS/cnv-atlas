# ENTORNO.md · Levantar y restaurar el entorno local

Guía práctica para tener Atlas corriendo en la máquina local. En lenguaje llano. Para el despliegue a la nube, ver `BACKLOG.md` (bloque "Despliegue a la nube", pendiente).

## Qué es el entorno local

Atlas corre contra un **Supabase local** (Postgres + Auth + Storage en Docker), no contra la nube. Todo el desarrollo y las pruebas son local-first. La base local no tiene pacientes reales.

## Requisitos

- **Docker Desktop** corriendo (Supabase local vive en contenedores Docker).
- Dependencias instaladas: `pnpm install`.
- Archivo `.env.local` con las variables (ver `DEPLOY.md`).

## Después de reiniciar el PC

Docker se apaga al reiniciar. Para volver a levantar el Supabase local:

```
supabase start
```

Eso levanta los contenedores con la base **tal como estaba** (los datos persisten en un volumen de Docker). No borra nada. Si `supabase start` dice que ya está corriendo, no hay nada que hacer.

## Restaurar el entorno desde cero (secuencia completa)

**ADVERTENCIA:** `supabase db reset` deja la base **VACÍA**. No restaura nada. Por sí solo deja el entorno inservible. La restauración son los CINCO pasos, en este orden:

```
supabase db reset      # 1. vacia la base y la deja limpia (NO aplica migraciones: viven en drizzle/, no en supabase/migrations/)
pnpm db:migrate        # 2. aplica las 24 migraciones de drizzle/ (crea todas las tablas, enums, RLS, triggers)
pnpm db:seed           # 3. siembra usuarios demo, modelo, encuesta, paciente demo (DESTRUCTIVO con survey_*, ver nota)
pnpm db:seed:bis       # 4. siembra las condiciones de la toma BIS (crashea al salir en Windows, ver nota; la data SÍ queda)
pnpm seed:golden       # 5. siembra el caso Demo GoldenPath (a2), target de los smokes
```

Verificado el 2026-07-27: esta secuencia deja el entorno como debe quedar.

## Notas que evitan sustos

- **`supabase db reset` NO aplica las migraciones del proyecto.** Las migraciones viven en `drizzle/`, no en `supabase/migrations/` (que está vacía). El reset solo vacía; el paso 2 (`pnpm db:migrate`) es el que construye el esquema. Ver `ARCHITECTURE.md`, sección Datos.
- **`pnpm db:seed` es destructivo con la encuesta.** Borra `survey_answers`, `survey_responses` y `survey_questions` antes de reinsertar. En una base nueva da igual; en una base con datos, borra respuestas. No corras `db:seed` para "actualizar contenido" sobre una base con trabajo dentro. (Deuda registrada en `BACKLOG.md`: falta un camino de siembra no destructivo por UPSERT.)
- **`pnpm db:seed:bis` crashea al salir**, con un error de Node en Windows ("Assertion failed ... UV_HANDLE_CLOSING", código `0xC0000409`). Es un problema de cierre del proceso (la conexión no cierra limpia), NO de la siembra: la data (14 condiciones) SÍ queda. Consecuencia práctica: **no se puede encadenar con `&&`** después de este paso, porque el código de salida distinto de cero rompería la cadena.

## Sobre un script único (`pnpm env:reset`)

Sería cómodo un solo comando que encadene los cinco pasos. Hoy **no se puede con `&&`** por el crash de `db:seed:bis` (paso 4). Opciones, sin construir todavía: encadenar con `;` en vez de `&&` (ignora el código de salida), o arreglar el crash de teardown primero. Queda como propuesta; se decide si vale la pena.
