# Guía de despliegue a la nube (staging = producción) — para Santiago

**Qué es esto.** Los pasos, en orden estricto, para montar Atlas en la nube por primera vez. Está escrito para hacerse en consolas (Supabase, Vercel, Cloudflare, Wompi, Alegra, Resend), no en el editor de código. Cada paso dice: en qué consola estás, qué hacer, qué vas a ver cuando funcione, qué dato te pide y de dónde sale, **cómo verificar que quedó bien antes de seguir**, y qué puede salir mal.

**Dos cosas decididas (para que no las decidas a mitad):**

- **Un solo entorno, tratado como real desde el día uno.** Lo que montes ahora es lo que van a usar los integrantes; los datos que entren son reales. No montamos un "ensayo" aparte: duplicaría el trabajo y el segundo siempre se hace con prisa. La consecuencia: **nada de datos de prueba entra a la nube** (ver Paso 0).
- **Wompi en SANDBOX primero.** El cobro se prueba contra el sandbox de Wompi con una URL pública real: verifica el flujo completo (pago, webhook, transacción, factura) sin mover dinero. Pasar a producción después es cambiar credenciales, no rehacer el código. **Confirmá contra la documentación vigente de Wompi** que su sandbox acepta un webhook a una URL pública (es lo normal, pero cambia con el tiempo).

**El entorno local NO desaparece.** Es donde corren los tests y donde haces smokes sin tocar datos reales. Se queda. Esto monta el entorno de la nube, que hoy no existe.

**Antes de empezar, ten a mano** (cuentas ya creadas o por crear): Supabase, Vercel, Cloudflare (dominio `cnvsystem.com`), Wompi (sandbox), Alegra (sandbox), Resend, Groq y Gemini, Upstash, Sentry. Si alguna no existe, créala cuando el paso la pida.

---

## Paso 0 — Separar el seed (tarea de código, va ANTES de sembrar la nube)

**Por qué.** El seed actual (`supabase/seed.ts`) mezcla lo mínimo (organización, roles, model-registry, encuesta, dispositivos, catálogo de nutracéuticos) con **datos demo**: usuarios de prueba (profesional/soporte/dirección demo) y un **paciente ficticio con PII**. La nube NO debe nacer con eso: contra la decisión de "real desde el día uno", y contra la limpieza de PII.

**Qué se hizo (HECHO 2026-08-07):** un interruptor `SEED_DEMO` en `supabase/seed.ts`. Con `SEED_DEMO=false` el seed crea solo el mínimo + la cuenta admin de arranque (para poder entrar e invitar gente), y NO crea usuarios demo, paciente demo, PII, ni inventario demo. Verificado en local: `pnpm db:seed` (default) sigue con todo el demo; `SEED_DEMO=false pnpm db:seed` imprime "Seed completo (MINIMO, sin datos demo)". La nube se siembra con `SEED_DEMO=false` (Paso 3.2).

**Cómo verificar (después de sembrar la nube, Paso 3.2):** en Supabase → Table editor → `patients` está **vacía**; `nutraceuticals` tiene los 10 productos; `roles` tiene los 5; `survey_versions` tiene la encuesta. Cero pacientes, cero PII.

**Qué puede salir mal:** olvidar el `SEED_DEMO=false` al sembrar la nube (entraría el paciente demo con PII). El check de arriba (patients vacía) lo atrapa: si aparece el paciente demo, se sembró mal.

---

## Paso 1 — Supabase en la nube: crear el proyecto

**Consola:** app.supabase.com

Este paso solo CREA la base y sus credenciales. Las migraciones y el seed van DESPUÉS (Paso 3), a propósito: primero confirmamos que la app desplegada conecta a la base (Paso 2) y solo entonces le cargamos el esquema. Así, si algo falla, sabes cuál de los dos fue (la conexión por variables, o el esquema por migraciones), sin mezclarlos.

> **Si el proyecto de Supabase ya existe** (creado antes), no lo crees de nuevo: salta 1.1 y ve directo a 1.2 (copiar credenciales, en especial la `DATABASE_URL`) y 1.3 (el bucket). Es común que 1.2 y 1.3 queden pendientes aunque el proyecto lleve tiempo creado: la `DATABASE_URL` sale del connection string (no del panel de API, por eso se olvida) y el bucket hay que crearlo a mano.

1.1 **Crear el proyecto** (si no existe). New project → nombre `cnv-atlas`, región **US East (us-east-1)** (por la decisión de infraestructura), contraseña de base de datos fuerte (guárdala en Bitwarden; es la del rol `postgres`).
- **Qué verás:** el proyecto tarda ~2 min en aprovisionar; luego el dashboard del proyecto.
- **Verificar:** el proyecto aparece "Active/Healthy" (verde) en la lista.

1.2 **Copiar las credenciales.** Project Settings → API: copia `Project URL` y la `anon public` key. Project Settings → API → `service_role` key (secreta). Project Settings → Database → Connection string → **URI** (esa es tu `DATABASE_URL`; reemplaza `[YOUR-PASSWORD]` por la contraseña de 1.1).
- **De dónde salen:** todas del dashboard de este proyecto. Guárdalas en Bitwarden; las cargas a Vercel en el Paso 2.
- **Cuidado:** la `service_role` key y la `DATABASE_URL` son secretas (dan acceso total). NUNCA en el código ni con prefijo `NEXT_PUBLIC_`.
- **Si la conexión directa falla, usa el pooler (importante).** En el mismo panel (Connection string) Supabase ofrece varias cadenas: **Direct connection**, **Session pooler** y **Transaction pooler**. La directa suele fallar desde funciones sin estado (serverless, como Vercel) o redes solo-IPv4; Santiago ya lo vivió en un despliegue anterior y tuvo que usar el **Session pooler**. Si la URI directa no conecta (timeout o "no route"), toma la cadena del pooler de ese panel (Session o Transaction) y úsala como `DATABASE_URL`, tanto en Vercel como en los comandos del Paso 3. La app ya está preparada para el pooler (usa `prepare: false`), así que funciona sin cambios de código; solo cambia la cadena.

1.3 **Storage (buckets).** Supabase → Storage: crea el bucket privado que usan los PDF de reporte (mismo nombre que en local; revisa `report-storage.ts` para el nombre exacto). Privado, no público.
- **Verificar:** el bucket aparece y es privado (candado).

---

## Paso 2 — Variables de entorno en Vercel

**Consola:** vercel.com → tu proyecto → Settings → Environment Variables

> **Si el repo ya está conectado y desplegando con cada push** (caso común si se montó Vercel antes), 2.1 ya está hecho. El trabajo que queda es que estén TODAS las variables: la que más se olvida es `DATABASE_URL` (sale del connection string, no del panel de API). Cárgala, contrasta el resto contra `DEPLOY.md`, y luego un redeploy (2.3) para que Vercel tome lo nuevo (las variables NO se aplican a lo ya desplegado).

2.1 **Conectar el repo a Vercel** (si no está): New Project → importa el repo de GitHub. Framework: Next.js (lo detecta). NO despliegues todavía (faltan las variables).

2.2 **Cargar TODAS las variables**, en los tres scopes (Production, Preview, Development). La lista completa con su alcance vive en `DEPLOY.md` sección "Variables de entorno". Las de la nube van con los valores del Paso 1; las de terceros, del Paso 5. Regla dura: las sensibles (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `ALEGRA_API_KEY`, tokens de Upstash, `SENTRY_AUTH_TOKEN`) **NUNCA** con prefijo `NEXT_PUBLIC_`.
- Agrega también `ENABLE_EXPERIMENTAL_COREPACK=1` (para que Vercel use pnpm 11 y respete las protecciones de supply chain).
- **De dónde sale cada una:** Supabase (Paso 1), Wompi/Alegra/Resend (Paso 5), Groq/Gemini/Upstash/Sentry (sus consolas). Si un valor sale de otro paso, ese paso lo dice.
- **Verificar:** cuéntalas contra la lista de `DEPLOY.md`; que ninguna sensible tenga `NEXT_PUBLIC_`.
- **Qué puede salir mal:** una variable en el scope equivocado (p. ej. solo Production) hace que los Preview fallen. Cárgalas en los tres.

**Las cuatro de Supabase, sin ambigüedad** (este es el error más caro y más silencioso: poner una clave secreta con `NEXT_PUBLIC_` la deja expuesta en el navegador, sin dar ningún error). Todas salen del dashboard del proyecto (Paso 1.2):

| Variable | Dónde en el dashboard | Prefijo | Por qué |
|----------|-----------------------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL | **NEXT_PUBLIC_** (pública) | El navegador la usa para hablar con Supabase; no es secreta. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → `anon public` | **NEXT_PUBLIC_** (pública) | Clave anónima, protegida por RLS; diseñada para ir al navegador. |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` | **NUNCA** `NEXT_PUBLIC_` | Salta toda la RLS (acceso total). Si llega al navegador, cualquiera lee y borra todo. |
| `DATABASE_URL` | Settings → Database → Connection string → URI (reemplaza `[YOUR-PASSWORD]`) | **NUNCA** `NEXT_PUBLIC_` | Conexión directa con credenciales completas; la usan los repositorios EN RUNTIME (no solo las migraciones). |

Regla mental: `NEXT_PUBLIC_` significa "puede verse en el navegador". Las dos de abajo no pueden verse nunca. Las cuatro son necesarias para que la app arranque y opere; cárgalas de una vez (si falta una, el arranque falla y descubrirías la siguiente en el próximo intento).

2.3 **Redesplegar y confirmar que la app conecta a la base (aún sin tablas).** Con las variables cargadas, dispara un deploy: Vercel → Deployments → Redeploy (o un push a `main`; si el repo ya está conectado, cada push despliega). Cuando quede "Ready", abre `https://atlas.cnvsystem.com` (o la URL `*.vercel.app`).
- **Verificar:** ya NO sale el error "Faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`"; carga la pantalla de login. Las consultas a datos aún fallarían (no hay tablas todavía): eso es esperado y se resuelve en el Paso 3. Lo que confirmas aquí es solo que la app ya sabe dónde está la base.
- **El registro de errores en producción (Sentry) ya está funcionando:** capturó limpio el error de variables faltantes con el mensaje exacto. Una pieza menos que verificar; no hay que configurar nada más de Sentry.
- **Qué puede salir mal:** el build falla por una variable faltante (el log dice cuál) o por los tests. Si un test de BD real corre en CI y no hay `DATABASE_URL` de test, se auto-salta (está diseñado así).

---

## Paso 3 — Migraciones y seed

**Qué vas a lograr:** crear las tablas en la base de la nube y cargar los datos mínimos (roles, catálogo de nutracéuticos, encuesta, tu cuenta de admin). Tu computador normalmente apunta a la base LOCAL, así que antes de cada comando le dices que use la de la nube (una variable en la misma ventana de PowerShell) y al terminar lo deshaces. **Tu `.env.local` NO se toca:** se queda apuntando a local; nada de esto edita ese archivo (verificado que Node no pisa esa variable con `.env.local`).

3.1 **Crear las tablas (migraciones).**
- **Antes del comando:** la conexión directa a la base puede fallar desde tu máquina (IPv4/firewall). Ten lista la alternativa AHORA: Supabase → Settings → Database → Connection string → **Session pooler** (o Transaction), copia esa cadena. Si el comando falla con timeout o "no route", NO es la contraseña: repites usando la cadena del pooler como `DATABASE_URL`. La app ya funciona con el pooler (`prepare: false`).
  ```powershell
  $env:DATABASE_URL = "postgresql://...tu-uri-de-la-nube..."
  pnpm db:migrate
  Remove-Item Env:\DATABASE_URL   # limpia la variable al terminar
  ```
- **Qué verás:** "migrations applied successfully". Aplica las 49 migraciones (0000 a 0048), incluidas las de RLS y triggers.
- **Qué puede salir mal:** si una migración de trigger falla a mitad, NO sigas (el orden importa): copia el error y páralo. Si `DATABASE_URL` quedó vacía, falla al conectar: revisa que la pusiste en la MISMA ventana.

3.2 **Cargar los datos mínimos (seed).**
- **Antes del comando, dos cosas que arruinan este paso:**
  - **Las variables de la nube TIENEN que estar en ESTA misma ventana, o sembrarás tu base LOCAL creyendo que sembraste la nube** (sin ellas, el seed apunta a local en silencio). La verificación de abajo (`pacientes = 0` en la nube) delata este error.
  - **`SEED_DEMO=false` es obligatorio.** Sin él, la nube nace con usuarios demo y un **paciente ficticio con PII** (contra "real desde el día uno"); habría que limpiar la base antes de seguir. El comando ya lo incluye.
  ```powershell
  $env:NEXT_PUBLIC_SUPABASE_URL = "https://...tu-proyecto.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY = "...tu-service-role-key..."
  $env:SEED_ADMIN_PASSWORD = "...una-clave-fuerte-para-el-admin..."
  $env:SEED_DEMO = "false"
  pnpm db:seed
  Remove-Item Env:\NEXT_PUBLIC_SUPABASE_URL, Env:\SUPABASE_SERVICE_ROLE_KEY, Env:\SEED_ADMIN_PASSWORD, Env:\SEED_DEMO
  ```
- **Qué verás:** "Seed completo (MINIMO, sin datos demo)". Guarda la `SEED_ADMIN_PASSWORD` en Bitwarden: es con la que entrarás como admin.

3.3 **Verificar (una sola consulta, en Supabase → SQL Editor).** Contar a ojo en el Table editor no sirve; esta consulta da cuatro números exactos:
  ```sql
  select
    (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tablas,
    (select count(*) from pg_tables where schemaname='public' and rowsecurity=true) as con_rls,
    (select count(*) from pg_policies where schemaname='public') as policies,
    (select count(*) from patients) as pacientes;
  ```
- **Debe dar EXACTAMENTE:** `tablas = 67`, `con_rls = 67` (las 67 con RLS activo), `policies = 147`, `pacientes = 0`.
- **Cómo leer cada número:** `tablas` distinto de 67 → faltaron migraciones (páralo, revisa el log de 3.1). `con_rls` menor que `tablas` → alguna tabla quedó sin RLS (una migración de policy se saltó). `policies` distinto de 147 → lo mismo, faltan policies. **`pacientes` distinto de 0 → el seed corrió con demo o sembró tu base local: se limpia la nube antes de seguir, no se deja pasar.** (Si quieres, de paso: `select count(*) from nutraceuticals;` = 10 y `select count(*) from roles;` = 5.)

---

## Paso 4 — Dominio

**Qué vas a lograr:** que la app viva en tu dominio (`atlas.cnvsystem.com`) en vez de la URL de Vercel, y que TODO lo que manda enlaces (correos de recuperación/invitación, encuesta del paciente) apunte ahí. Dos partes: conectar el dominio (4.1) y mover a él lo que aún apunta a otro lado (4.2). En tu caso el dominio ya está validado, así que lo que falta es 4.2, en especial la Site URL y las plantillas de correo de Supabase.

4.1 **Dominio.** El dominio se configura **DESPUÉS del primer deploy** (Paso 2.3), nunca antes: apuntar un dominio a un proyecto sin desplegar solo da error y confunde.
- **En Vercel primero:** Settings → Domains → agrega `atlas.cnvsystem.com`. Vercel te va a **mostrar el registro DNS exacto** que debes crear (el valor del CNAME). **Usa ese valor, no uno inventado:** puede variar por proyecto (suele ser `cname.vercel-dns.com`, pero confirma el que te muestre Vercel).
- **En Cloudflare** (zona `cnvsystem.com`): crea el CNAME `atlas` → el valor que te dio Vercel, con el **proxy DESACTIVADO (nube GRIS, "DNS only")**. Este es el error más común: si dejas el proxy activado (nube naranja), Vercel no puede emitir su certificado y salen fallos de SSL que parecen otra cosa. Gris = Vercel maneja el certificado directo.
- **Verificar:** `https://atlas.cnvsystem.com` responde (puede tardar por DNS); Vercel muestra el dominio **"Valid"** y emite el certificado. Si dice "Invalid Configuration", casi siempre es el proxy naranja: cámbialo a gris.

4.2 **Apuntar TODO al dominio propio (crítico; lo que más se olvida).** Ahora que existe `https://atlas.cnvsystem.com`, hay cosas que quedaron apuntando a la URL de Vercel o a local y hay que moverlas:
- **Supabase → Authentication → URL Configuration: `Site URL` = `https://atlas.cnvsystem.com`, y agrega esa URL (y `.../auth/confirm`) a `Redirect URLs`.** ESTE ES EL QUE MÁS SE OLVIDA Y ROMPE JUSTO LA RECUPERACIÓN/INVITACIÓN: Supabase arma los enlaces de los correos (recuperación, invitación) con la `Site URL`. Si apunta a otro lado, el enlace del correo lleva al lugar equivocado y el flujo que acabamos de arreglar falla en producción.
- **Supabase → Authentication → Email Templates: replica las plantillas de "Reset Password" e "Invite User".** La nube (Supabase hosted) NO lee `supabase/config.toml` ni `supabase/templates/*.html` (eso es solo para el entorno local); en la nube las plantillas se editan en el dashboard. Sin esto, la nube usa la plantilla por defecto (`{{ .ConfirmationURL }}`), que NO pasa por `/auth/confirm` con `token_hash` y rompe el flujo. Pega, en cada una, el enlace que ya usamos en local (`supabase/templates/recovery.html` e `invite.html`):
  - Reset Password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/set-password`
  - Invite User: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password`
- **Webhook de Wompi:** apunta a `https://atlas.cnvsystem.com/api/webhooks/wompi` (se hace en el Paso 5).
- **Enlaces de la encuesta del paciente / correos:** salen de la app (usan la URL pública) y de Supabase (Site URL). Con la `Site URL` correcta y el dominio activo, quedan bien.
- **Verificar:** dispara un correo de recuperación en producción (con una cuenta de prueba) y confirma que el enlace del correo empieza por `https://atlas.cnvsystem.com/auth/confirm`, no por la URL de Vercel ni localhost.

---

## Paso 5 — Los terceros apuntando a la URL pública

**Qué vas a lograr:** darles a Wompi, Alegra y Resend sus llaves y tu URL pública, para que puedan llamar a la app de vuelta (el webhook de pago) y enviar correos. Todo en modo **sandbox/prueba**: no mueve dinero real. Ahora que existe `https://atlas.cnvsystem.com`, los servicios que necesitan llamarte "de vuelta" ya tienen a dónde.

5.1 **Wompi (sandbox).** Consola de Wompi (ambiente sandbox): obtén las llaves de sandbox (`public`, `private`, `integrity`, `events`). Registra el webhook/URL de eventos apuntando a `https://atlas.cnvsystem.com/api/webhooks/wompi`. Carga las 4 llaves a Vercel (Paso 2; `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` es la única pública).
- **Verificar:** Wompi acepta la URL del webhook sin error. (El pago real se prueba en el Paso 6.)
- **Qué puede salir mal:** que confundas llaves de sandbox con producción (empiezan distinto). Usa las de sandbox.

5.2 **Alegra (sandbox).** Consola de Alegra: credenciales de sandbox; carga a Vercel. (La factura se prueba en el Paso 6, tras el pago.)

5.3 **Resend.** Verifica el dominio de envío en Resend (o usa el remitente ya disponible en `cnvsystem.com`, ver `DEPLOY.md`: el subdominio propio requiere plan Pro). Carga `RESEND_API_KEY` y el `EMAIL_FROM`.
- **Verificar:** Resend marca el dominio/remitente como verificado.

---

## Paso 6 — El smoke de cobro end-to-end (lo que todo esto desbloquea)

**Qué vas a lograr:** probar un cobro completo de punta a punta contra el sandbox de Wompi (pago, webhook, transacción, comisión, factura) sin mover dinero real. **Por qué este es el punto:** el cobro es lo único que nunca se probó de verdad, porque el webhook de Wompi necesita una URL pública y en local corría solo en simulación. Ahora se prueba real (contra el sandbox).

6.1 Entra a `https://atlas.cnvsystem.com`, login como admin (Paso 3.2).
6.2 Crea un profesional (invítalo) y un paciente mínimo, o usa el flujo que corresponda para llegar a un checkout de nutracéutico.
6.3 Genera el checkout de un nutracéutico y paga con una tarjeta de PRUEBA del sandbox de Wompi (las da su documentación).
6.4 **Verificar la cadena, paso por paso** (esto es lo que evita "no sé dónde falló"):
- Wompi muestra el pago aprobado (sandbox).
- Supabase → `payment_webhook_events`: llegó un evento (idempotente por `provider`+`external_id`). **Si no llegó, el problema es el webhook** (URL, firma `WOMPI_EVENTS_SECRET`).
- `transactions`: la transacción quedó en `paid`.
- `cnv_revenue` y `professional_revenue`: se generaron (la comisión con la tasa sellada).
- Alegra (sandbox): se creó la factura borrador.
- **Qué puede salir mal y dónde mirar:** si el pago aprueba pero no hay evento en `payment_webhook_events`, es el webhook (URL mal registrada, o firma que no valida). Si hay evento pero la transacción no pasa a `paid`, es el mapeo de estado. Si la transacción paga pero no hay factura, es Alegra. Cada eslabón se verifica solo, así el fallo se aísla.

**Cuando esto pasa de punta a punta, el cobro está verificado por primera vez.** Pasar Wompi/Alegra a producción después es cambiar las credenciales de sandbox por las de producción en Vercel (Paso 2) y re-registrar el webhook con las llaves de producción; el código no cambia.

---

## Después del smoke

- Los ítems operativos de producción (`DEPLOY.md` sección "Items operativos"), incluido fijar `idle_in_transaction_session_timeout` en el rol de la BD (cierra el vector de una transacción idle que sujeta un lock).
- Recién entonces: los 4 cotejos visuales (E3).
