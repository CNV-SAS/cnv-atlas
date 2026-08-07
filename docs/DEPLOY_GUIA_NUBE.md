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

**Qué se hizo (HECHO 2026-08-07):** un interruptor `SEED_DEMO` en `supabase/seed.ts`. Con `SEED_DEMO=false` el seed crea solo el mínimo + la cuenta admin de arranque (para poder entrar e invitar gente), y NO crea usuarios demo, paciente demo, PII, ni inventario demo. Verificado en local: `pnpm db:seed` (default) sigue con todo el demo; `SEED_DEMO=false pnpm db:seed` imprime "Seed completo (MINIMO, sin datos demo)". La nube se siembra con `SEED_DEMO=false` (Paso 1.5).

**Cómo verificar (después de sembrar la nube, Paso 1.5):** en Supabase → Table editor → `patients` está **vacía**; `nutraceuticals` tiene los 10 productos; `roles` tiene los 5; `survey_versions` tiene la encuesta. Cero pacientes, cero PII.

**Qué puede salir mal:** olvidar el `SEED_DEMO=false` al sembrar la nube (entraría el paciente demo con PII). El check de arriba (patients vacía) lo atrapa: si aparece el paciente demo, se sembró mal.

---

## Paso 1 — Supabase en la nube

**Consola:** app.supabase.com

1.1 **Crear el proyecto** (si no existe). New project → nombre `cnv-atlas`, región **US East (us-east-1)** (por la decisión de infraestructura), contraseña de base de datos fuerte (guárdala en Bitwarden; es la del rol `postgres`).
- **Qué verás:** el proyecto tarda ~2 min en aprovisionar; luego el dashboard del proyecto.
- **Verificar:** el proyecto aparece "Active/Healthy" (verde) en la lista.

1.2 **Copiar las credenciales.** Project Settings → API: copia `Project URL` y la `anon public` key. Project Settings → API → `service_role` key (secreta). Project Settings → Database → Connection string → **URI** (esa es tu `DATABASE_URL`; reemplaza `[YOUR-PASSWORD]` por la contraseña de 1.1).
- **De dónde salen:** todas del dashboard de este proyecto. Guárdalas en Bitwarden; las cargas a Vercel en el Paso 2.
- **Cuidado:** la `service_role` key y la `DATABASE_URL` son secretas (dan acceso total). NUNCA en el código ni con prefijo `NEXT_PUBLIC_`.

1.3 **Aplicar las migraciones.** IMPORTANTE, léelo antes: **tu `.env.local` NO cambia, se queda apuntando a local.** Las credenciales de la nube van en Vercel (Paso 2), NO en tu máquina. La única excepción son estos dos comandos (migrate y seed), que corren con la URL/credenciales remotas puestas SOLO para ese comando (variable de shell), sin editar ningún archivo. Verificado que Node NO pisa esa variable con `.env.local`, así que funciona.
- Comando (PowerShell), reemplazando la URI por la `DATABASE_URL` del Paso 1.2:
  ```powershell
  $env:DATABASE_URL = "postgresql://...tu-uri-de-la-nube..."
  pnpm db:migrate
  Remove-Item Env:\DATABASE_URL   # limpia la variable al terminar
  ```
- Aplica las 48 migraciones, incluidas las de RLS y triggers.
- **Qué verás:** "migrations applied successfully".
- **Verificar:** Supabase → Table editor: aparecen las tablas (`patients`, `evaluations`, `nutraceutical_faltante_cases`, etc.). Database → Roles/Policies: las políticas RLS existen.
- **Qué puede salir mal:** timeout o permiso. Si una migración de trigger falla, NO sigas: el orden importa. Copia el error y páralo. Si `DATABASE_URL` quedó vacía, el comando falla al conectar: revisa que la pusiste en la MISMA ventana de PowerShell.

1.4 **Storage (buckets).** Supabase → Storage: crea el bucket privado que usan los PDF de reporte (mismo nombre que en local; revisa `report-storage.ts` para el nombre exacto). Privado, no público.
- **Verificar:** el bucket aparece y es privado (candado).

1.5 **Sembrar el mínimo.** Igual que 1.3: variables de shell SOLO para este comando, sin tocar `.env.local`. El seed usa la URL y la **service_role key** de la nube (Paso 1.2), el correo del admin de arranque (`sau.idk001@gmail.com` u otro que definas en `supabase/seed.ts`), una contraseña fuerte, y `SEED_DEMO=false`.
  ```powershell
  $env:NEXT_PUBLIC_SUPABASE_URL = "https://...tu-proyecto.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY = "...tu-service-role-key..."
  $env:SEED_ADMIN_PASSWORD = "...una-clave-fuerte-para-el-admin..."
  $env:SEED_DEMO = "false"
  pnpm db:seed
  Remove-Item Env:\NEXT_PUBLIC_SUPABASE_URL, Env:\SUPABASE_SERVICE_ROLE_KEY, Env:\SEED_ADMIN_PASSWORD, Env:\SEED_DEMO
  ```
- **Qué verás:** "Seed completo (MINIMO, sin datos demo)".
- **Verificar (crítico):** `patients` vacía; `nutraceuticals` = 10; `roles` = 5; `survey_versions` con la encuesta. Un usuario admin con el correo de arranque.
- **Qué puede salir mal:** si NO pusiste `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` de la nube, el seed apunta a LOCAL (el default del script) y no toca la nube. El check de "patients vacía en la nube" lo delata: si en la nube no aparecieron ni los 10 nutracéuticos, sembraste local por error.

---

## Paso 2 — Variables de entorno en Vercel

**Consola:** vercel.com → tu proyecto → Settings → Environment Variables

2.1 **Conectar el repo a Vercel** (si no está): New Project → importa el repo de GitHub. Framework: Next.js (lo detecta). NO despliegues todavía (faltan las variables).

2.2 **Cargar TODAS las variables**, en los tres scopes (Production, Preview, Development). La lista completa con su alcance vive en `DEPLOY.md` sección "Variables de entorno". Las de la nube van con los valores del Paso 1; las de terceros, del Paso 4. Regla dura: las sensibles (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `ALEGRA_API_KEY`, tokens de Upstash, `SENTRY_AUTH_TOKEN`) **NUNCA** con prefijo `NEXT_PUBLIC_`.
- Agrega también `ENABLE_EXPERIMENTAL_COREPACK=1` (para que Vercel use pnpm 11 y respete las protecciones de supply chain).
- **De dónde sale cada una:** Supabase (Paso 1), Wompi/Alegra/Resend (Paso 4), Groq/Gemini/Upstash/Sentry (sus consolas). Si un valor sale de otro paso, ese paso lo dice.
- **Verificar:** cuéntalas contra la lista de `DEPLOY.md`; que ninguna sensible tenga `NEXT_PUBLIC_`.
- **Qué puede salir mal:** una variable en el scope equivocado (p. ej. solo Production) hace que los Preview fallen. Cárgalas en los tres.

---

## Paso 3 — Deploy y dominio

3.1 **Primer deploy.** Vercel → Deployments → Redeploy (o push a `main`).
- **Qué verás:** el build corre (tsc, lint, tests); si pasa, "Ready".
- **Verificar:** abre la URL `*.vercel.app` que da Vercel; la app carga (pantalla de login).
- **Qué puede salir mal:** build falla por una variable faltante (lee el log, dice cuál) o por los tests. Si un test de BD real corre en CI y no hay `DATABASE_URL` de test, se auto-salta (está diseñado así).

3.2 **Dominio.** Cloudflare (zona `cnvsystem.com`): CNAME `atlas` → `cname.vercel-dns.com`, proxy activado, SSL Full (strict). Vercel → Settings → Domains: agrega `atlas.cnvsystem.com`.
- **Verificar:** `https://atlas.cnvsystem.com` responde (puede tardar por DNS). Vercel muestra el dominio "Valid".
- **Qué puede salir mal:** DNS tarda; si Vercel dice "Invalid Configuration", revisa el CNAME. SSL Full (strict) evita el bucle de redirección.

---

## Paso 4 — Los terceros apuntando a la URL pública

Ahora que existe `https://atlas.cnvsystem.com`, los servicios que necesitan llamarte "de vuelta" ya tienen a dónde.

4.1 **Wompi (sandbox).** Consola de Wompi (ambiente sandbox): obtén las llaves de sandbox (`public`, `private`, `integrity`, `events`). Registra el webhook/URL de eventos apuntando a `https://atlas.cnvsystem.com/api/webhooks/wompi`. Carga las 4 llaves a Vercel (Paso 2; `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` es la única pública).
- **Verificar:** Wompi acepta la URL del webhook sin error. (El pago real se prueba en el Paso 5.)
- **Qué puede salir mal:** que confundas llaves de sandbox con producción (empiezan distinto). Usa las de sandbox.

4.2 **Alegra (sandbox).** Consola de Alegra: credenciales de sandbox; carga a Vercel. (La factura se prueba en el Paso 5, tras el pago.)

4.3 **Resend.** Verifica el dominio de envío en Resend (o usa el remitente ya disponible en `cnvsystem.com`, ver `DEPLOY.md`: el subdominio propio requiere plan Pro). Carga `RESEND_API_KEY` y el `EMAIL_FROM`.
- **Verificar:** Resend marca el dominio/remitente como verificado.

---

## Paso 5 — El smoke de cobro end-to-end (lo que todo esto desbloquea)

**Por qué este es el punto.** El cobro es lo único que nunca se probó de verdad: el webhook de Wompi necesita una URL pública, y en local corría solo en simulación. Ahora se prueba real (contra el sandbox).

5.1 Entra a `https://atlas.cnvsystem.com`, login como admin (Paso 1.5).
5.2 Crea un profesional (invítalo) y un paciente mínimo, o usa el flujo que corresponda para llegar a un checkout de nutracéutico.
5.3 Genera el checkout de un nutracéutico y paga con una tarjeta de PRUEBA del sandbox de Wompi (las da su documentación).
5.4 **Verificar la cadena, paso por paso** (esto es lo que evita "no sé dónde falló"):
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
