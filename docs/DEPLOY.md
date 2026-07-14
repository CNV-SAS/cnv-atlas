# Operación y despliegue de Atlas (CNV)

**Versión:** 1.0 (adaptado del DEPLOY del LMS)
**Dominio:** `atlas.cnvsystem.com`
**Acompaña a:** `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `CLAUDE.md`.

> Nota de reconciliación: el LMS aprendió que `minimumReleaseAge: 10080` (7 días) bloquea deps transitivas legítimas. Atlas usa **1440 (24h)**, que es el valor probado. Esto supersede la mención a "7 días" en `SECURITY.md`/`CLAUDE.md`; alinéalas a 1440.

## Cuentas y servicios necesarios
GitHub (repo privado `cnv-atlas`), Supabase, Vercel, Cloudflare (zona `cnvsystem.com`), Resend, Groq y Gemini, Upstash (Redis para rate limiting), Sentry, Wompi (pagos), Alegra (contabilidad), y Bitwarden (plan Free) como gestor de secretos del equipo para las credenciales de Biody Manager.

## Variables de entorno
`.env.local.example` (sin valores) va al repo:
```bash
# ===== Supabase =====
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
DATABASE_URL=postgresql://...        # Drizzle (migraciones + queries server)

# ===== IA =====
GROQ_API_KEY=
GROQ_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=

# ===== Email =====
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@atlas.cnvsystem.com
EMAIL_REPLY_TO=soporte@cnvsystem.com
# REQUISITO (B10): el dominio de EMAIL_FROM debe estar VERIFICADO en Resend
# (resend.com/domains). Sin verificar, Resend solo permite enviar al correo dueno de
# la cuenta y desde onboarding@resend.dev; el envio de reportes en produccion fallara
# con "This API key is not authorized to send emails from <dominio>". Verificado en el
# smoke de B10: el codigo maneja el fallo (el reporte queda approved, reintentable),
# pero hay que verificar el dominio antes de enviar reportes reales.

# ===== Pagos =====
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=        # público por diseño (widget de checkout)
WOMPI_PRIVATE_KEY=                   # solo server
WOMPI_EVENTS_SECRET=                 # solo server, valida firma HMAC de webhooks
WOMPI_INTEGRITY_SECRET=              # solo server, firma de integridad del checkout
ALEGRA_EMAIL=                        # solo server
ALEGRA_API_KEY=                      # solo server
ALEGRA_BASE_URL=                     # solo server, base de la API (sandbox vs produccion)
ALEGRA_DEFAULT_CLIENT_ID=            # solo server, cliente por defecto para la factura (MVP)
ALEGRA_DEFAULT_ITEM_ID=              # solo server, item generico por defecto (MVP)
ALEGRA_IVA_TAX_ID=                   # solo server, id del impuesto IVA 19% en Alegra

# ===== Rate limiting =====
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ===== Observabilidad =====
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=

# ===== App =====
NEXT_PUBLIC_APP_URL=https://atlas.cnvsystem.com
NEXT_PUBLIC_APP_NAME=Atlas
NODE_ENV=development
```
En Vercel se cargan en Production, Preview y Development. **Regla crítica:** los secrets sensibles (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET`, `ALEGRA_API_KEY`, `SENTRY_AUTH_TOKEN`, tokens de Upstash) NUNCA llevan prefijo `NEXT_PUBLIC_`.

## Setup inicial

### 1. Repositorio
`cnv-atlas`, privado, `.gitignore` Node.

### 2. Bootstrap Next.js (con pnpm)
Verifica pnpm (`pnpm --version`; si falta, `corepack enable && corepack prepare pnpm@latest --activate`).
```bash
pnpm create next-app@latest cnv-atlas --typescript --tailwind --app --src-dir --eslint --no-import-alias --use-pnpm
cd cnv-atlas && git init && git remote add origin https://github.com/CNV/cnv-atlas.git
```
`tsconfig.json` con `"strict": true`.

### 2bis. Supply chain (CRÍTICO, antes de instalar deps)
pnpm 11 ya no lee settings non-auth de `.npmrc`; viven en `pnpm-workspace.yaml`.

`.npmrc` (placeholder para auth/registry).

`pnpm-workspace.yaml`:
```yaml
minimumReleaseAge: 1440          # 24h de cuarentena (7 días bloquea transitivas legítimas)
minimumReleaseAgeStrict: false   # ante una version muy nueva, cae a una mas vieja que cumpla
minimumReleaseAgeExclude:        # paquetes sin codigo ejecutable, menos friccion
  - "@types/*"
blockExoticSubdeps: true         # rechaza deps de git/tarballs
savePrefix: ''                   # versiones exactas, sin ^ ni ~ (en pnpm 11 NO existe saveExact)
allowBuilds:                     # whitelist (mapa) de postinstall verificados
  sharp: true
  esbuild: true
  "@sentry/cli": true
  supabase: true
overrides: {}                    # parches de versión por CVE conocido
```
Cada entrada de `allowBuilds` requiere verificación previa del package y justificación inline. Si una instalación falla pidiendo aprobación, NO desactives la protección global: verifica el package y agrégalo a `allowBuilds`. No se usa `ignoreScripts: true`: en pnpm 10+ los build scripts de dependencias ya se bloquean por defecto y `allowBuilds` actúa como lista de aprobación, así que `ignoreScripts` solo anularía esa whitelist (incluidos los 4 verificados). El pinning exacto en pnpm 11 es `savePrefix: ''`; la clave `saveExact` no existe (no aparece en pnpm.io/settings) y, si se pusiera, se ignoraría en silencio.

### 3. Dependencias clave
```bash
pnpm add \
  @supabase/supabase-js @supabase/ssr \
  drizzle-orm postgres \
  @upstash/ratelimit @upstash/redis \
  zod react-hook-form @hookform/resolvers \
  date-fns lucide-react sonner clsx tailwind-merge \
  @sentry/nextjs resend @react-pdf/renderer \
  groq-sdk @google/generative-ai \
  react-markdown remark-gfm isomorphic-dompurify \
  qrcode

pnpm add -D \
  drizzle-kit vitest @types/node prettier prettier-plugin-tailwindcss @types/qrcode
```
- `drizzle-orm` + `drizzle-kit` + `postgres`: ORM y migraciones.
- `exceljs@4.4.0` (APROBADA en B8): parser del export XLSX de Biody Manager. Se
  eligio sobre `xlsx` (SheetJS) porque la version de npm de SheetJS (`xlsx@0.18.5`)
  esta permanentemente vulnerable (Prototype Pollution GHSA-4r6h-8v6p-xvw6 y ReDoS
  GHSA-5pgg-2g8v-p4x9) y el parche (>=0.20.2) solo vive en el CDN oficial
  (`cdn.sheetjs.com`), no en npm: un tarball de CDN no puede pasar por
  `minimumReleaseAge` ni pinearse a una version de registro, rompiendo la postura
  de supply-chain. exceljs entra desde el registro npm, MIT, pin exacto, sin
  scripts de install/postinstall (no requiere `allowBuilds`). Es la frontera de
  confianza critica del import (ver `SECURITY.md`); se usa SOLO para lectura,
  server-side, y nunca se renderiza una celda como HTML.
  - Verificacion previa a instalar (socket.dev bloquea fetch automatizado con 403;
    se verifico con OSV + registro npm, la data sustantiva que socket.dev agrega):
    el unico aviso directo (GHSA-2j2j-8rrv-264g, XSS) esta corregido en 1.6.0 (no
    aplica a 4.4.0 y ademas no renderizamos celdas como HTML); las deps transitivas
    de mayor riesgo ya estan parcheadas en los rangos que exceljs fija (`unzipper`
    ^0.10.11 con el zip-slip GHSA-884w-698f-927f corregido desde 0.8.13; `jszip`
    ^3.10.1 con path traversal y prototype pollution corregidos desde 3.8.0/3.7.0).
  - Reserva conocida: mantenimiento estancado (ultima estable 2023-10). Aceptable
    por el uso acotado; el parser se aisla tras una interfaz para poder cambiarlo.
  - Tests: fixture sintetico anonimizado en `src/tests/fixtures/biody_synthetic.xlsx`
    (misma estructura de 180 columnas, valores ficticios, SIN PII), reproducible con
    `src/tests/fixtures/generate-biody-fixture.mjs`. El XLSX de muestra real con PII
    vive solo en `/reference` (gitignored) y NUNCA entra al repo.
- `qrcode`: QR de encuesta y checkout (render server-side a data URL).
- El CLI de `supabase` NO va como devDep (su tarball no trae el binario; lo descarga el postinstall). Se invoca siempre con `pnpm dlx supabase ...`. Se mantiene `allowBuilds.supabase: true` para que dlx pueda descargar el binario.
- Tras cada `pnpm add` masivo: `pnpm audit`. Si hay `high`/`critical`, detente.

### 4. shadcn/ui
Setup base (el preset definitivo se ata a `BRAND.md` cuando esté):
```bash
pnpm dlx shadcn@latest init -t next -b radix -p vega --css-variables --yes
pnpm dlx shadcn@latest add button input label textarea card dialog sheet dropdown-menu avatar badge alert progress tabs select skeleton table
```
Si el primitivo `form` no se sirve del preset Vega, workaround probado: `pnpm dlx shadcn@latest add https://ui.shadcn.com/r/styles/new-york/form.json`.

### 5. Sentry (con scrubbing de PHI)
```bash
pnpm dlx @sentry/wizard@latest -i nextjs
```
**Atlas-específico:** configurar `beforeSend` para **scrubbear PHI** (no enviar nombres, documento, contacto ni payloads clínicos a Sentry). Ver `SECURITY.md`.

### 6. Proyecto Supabase
- Nombre: `cnv-atlas`. Región: `us-east-1` (ver `SECURITY.md`/`DATA_GOVERNANCE.md`). Plan: Free para MVP, Pro antes de datos clínicos reales (PITR + backups).
- Anotar URL, anon key, service role key, y la cadena `DATABASE_URL` (Settings → Database). Cargar a `.env.local` y Vercel.

### 7. Supabase CLI + Drizzle
CLI vía dlx: `pnpm dlx supabase init && pnpm dlx supabase link --project-ref YOUR_REF`.
- **Drizzle** maneja el DDL de tablas y la generación de tipos (desde `src/db/schema`).
- **Las RLS policies, triggers, funciones `security definer` y enums** van como **migraciones SQL crudas** (Drizzle soporta migraciones custom SQL), porque el soporte de RLS en el ORM es limitado y queremos el SQL visible y versionado.

### 8. Vercel
```bash
pnpm add -g vercel    # CLI global, no entra al package.json
vercel link && vercel env pull
```
- `"packageManager": "pnpm@11.x"` en `package.json` + env var `ENABLE_EXPERIMENTAL_COREPACK=1` en Vercel (los 3 scopes), para que Vercel use pnpm 11 y respete `allowBuilds`/`minimumReleaseAge`.
- Región de las funciones cercana a la de Supabase.

### 9. DNS en Cloudflare
Zona `cnvsystem.com`: CNAME `atlas` → `cname.vercel-dns.com`, proxy activado, SSL Full (strict). En Vercel → Domains agregar `atlas.cnvsystem.com`.

### 10. Webhooks de pago
- En Wompi: registrar el endpoint `https://atlas.cnvsystem.com/api/webhooks/wompi`; guardar `WOMPI_EVENTS_SECRET` (firma HMAC) y `WOMPI_INTEGRITY_SECRET`.
- En Alegra: registrar/integrar el endpoint de facturación; guardar credenciales.
- Verificar firma HMAC e idempotencia en cada webhook (ver `SECURITY.md`).

### 11. Gestor de secretos (Biody Manager)
Crear en Bitwarden (plan Free) una colección para las credenciales de Biody Manager por equipo (correo `biody+assetcode@cnvsystem.com` + contraseña aleatoria única por equipo). La bandeja compartida `biody@cnvsystem.com` con contraseña fuerte + MFA.

### 12. Verificación final
`https://atlas.cnvsystem.com` responde; Sentry recibe un evento de prueba (con PHI scrubbed); las migraciones iniciales están aplicadas; deploy automático al pushear a `main`.

## Flujo de deploy
- **Branches:** feature branches → PR → `main`. Sin push directo a `main`.
- **Pipeline:** push a `main` → Vercel build → tests en CI (`tsc`, `lint`, `vitest`, golden si tocó el motor) → deploy. PRs generan Preview deploys.
- **Commits:** con el porqué (ver `CLAUDE.md`).

## Migraciones
- DDL de tablas con `pnpm drizzle-kit generate` + `migrate` contra `DATABASE_URL`.
- RLS/policies/triggers/funciones/enums como migraciones SQL crudas, `NNNN_descripcion.sql`, forward-only, con comentario del porqué. Orden por dependencias (helpers antes que policies/storage). Ver `DATABASE.md`.
- Una migración aplicada nunca se edita; se crea otra encima.
- Tipos: Drizzle los genera desde el schema; no se editan a mano; van en git.

## Backups y disaster recovery
- MVP (Free): backups nativos de Supabase. Antes del lanzamiento, **prueba de restauración** a un proyecto de staging (un backup no existe hasta que se restaura con éxito).
- Antes de datos clínicos reales: subir a **Supabase Pro** para PITR (point-in-time recovery). El dato clínico lo amerita.

## Runbooks
- **Crear usuario (staff/profesional):** admin crea la cuenta en Atlas, asigna rol vía `user_roles`; el sistema envía invitación para que el usuario fije su contraseña. Para profesional, crear `professional_profiles` con `commission_rate`.
- **Forzar reset de contraseña:** admin dispara el envío de recuperación; llega al correo propio del usuario.
- **Activar una versión del modelo:** poblar el `model-registry` (indicadores, cortes, mapas, 81 estados EFR), poner la versión en `active` (solo una activa); registrar el evento en `clinical_audit_log`.
- **Provisionar un equipo Biody:** crear `devices` (asset_code, manufacturer_serial, system_email), generar contraseña aleatoria en el vault, registrar el comodato en `device_assignments`.
- **Rotar secreto de webhook (Wompi/Alegra):** generar nuevo secret en el proveedor, actualizar en Vercel, redeploy.
- **Recuperar acceso admin (lockout):** vía service role / SQL, reasignar el rol admin en `user_roles`.
- **Revisar logs de producción:** Vercel logs + Sentry (con PHI scrubbed).
- **Rollback de deploy:** Vercel → Deployments → promover el deploy anterior.
- **Cambiar variables de entorno:** Vercel → Settings → Environment Variables (los 3 scopes) → redeploy.
- **Limpiar data clínica de prueba antes del lanzamiento:** vía service role, eliminar pacientes/evaluaciones de prueba; el `clinical_audit_log` es append-only (no se borra).

## Límites de plan (MVP)
- **Supabase Free:** suficiente para piloto; subir a Pro antes de datos clínicos reales (backups/PITR, más capacidad).
- **Vercel Hobby:** suficiente para piloto; revisar límites de funciones serverless para tareas largas (PDFs, sync Alegra → background post-MVP).

## Smoke test manual antes del lanzamiento
Login con MFA (admin); crear profesional y comodato; generar QR de encuesta; llenar encuesta (inicial y seguimiento con pre-llenado); importar XLSX de Biody; ver indicadores/diagnóstico (con motor real o stub); aprobar y enviar reporte al paciente; checkout de nutracéutico end-to-end (pago → webhook → transacción → factura Alegra); **auditoría/grants**: como soporte solicitar acceso identificado a un paciente y como admin aprobarlo, abrir la vista identificada; como admin solicitar acceso seudonimizado y como dirección aprobarlo, abrir `/auditoria/notas`; verificar que `admin` sin grant NO ve las notas; verificar que el `clinical_audit_log` registró todos los eventos, incluidos `access.requested` / `access.approved` / `access.used`.

## Checklist de lanzamiento (B15)

### DPA documental de sub-encargados
Confirmar que hay DPA firmado y **archivado** por cada sub-encargado. La tabla de sub-encargados con región y transferencia internacional es la de `DATA_GOVERNANCE.md` (fuente de verdad); aquí solo se rastrea el archivado del documento.

- [ ] Supabase (DB/Auth/Storage, EE. UU.)
- [ ] Vercel (hosting, EE. UU.)
- [ ] Resend (correos, EE. UU.)
- [ ] Groq / Gemini (variables clínicas seudonimizadas, EE. UU.)
- [ ] Wompi (pagos, Colombia)
- [ ] Alegra (facturación, Colombia)
- [ ] Aminogram / Biody Manager / Connect (BIS + PII, Francia, HDS)
- [ ] Sentry (metadatos de error, EE. UU.; scrubbing de PHI activo)
- [ ] Cloudflare (DNS/CDN, EE. UU.)
- [ ] Upstash (rate limiting, EE. UU.)

### Items operativos (dependen de Santiago, no son código)
- [ ] **Resend, dominio de envío:** `atlas.cnvsystem.com` NO se puede verificar en el plan Free de Resend (ya se usa el único dominio disponible en `cnvsystem.com`). Para el lanzamiento, `EMAIL_FROM = atlas-notificaciones@cnvsystem.com`. Verificar el subdominio propio queda pendiente de subir al plan Pro; es decisión operativa de Santiago.
- [ ] **Upstash de producción** configurado (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` en Vercel), para que el rate limiting sea multi-instancia y no solo la ventana en memoria.
- [ ] **Sentry:** DSN de producción activo; monitorear 24h sin errores recurrentes tras el lanzamiento (criterio de aceptación de B15).
- [ ] **Secretos** en Bitwarden y en las env de Vercel; ninguno en el repo. `SUPABASE_SERVICE_ROLE_KEY` solo server.
- [ ] **Smoke E2E manual** (sección anterior) ejecutado en el entorno de lanzamiento.

## Próximos hitos operativos (post-MVP)
Supabase Pro + PITR; jobs en background (Inngest) para PDFs/sync/exports; E2E con Playwright en CI; observabilidad ampliada.
