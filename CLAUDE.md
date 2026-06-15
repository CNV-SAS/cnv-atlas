# CLAUDE.md

**Instrucciones operativas para Claude Code en el proyecto Atlas (CNV).**

Este archivo se carga automáticamente al iniciar cada sesión. Léelo completo. Su propósito NO es describir el proyecto (eso está en `docs/`), sino establecer cómo debes comportarte mientras trabajas aquí.

---

## Sobre el proyecto en 3 líneas

Atlas es la plataforma clínica de Connected Nutrition Ventures SAS: el sistema donde el modelo de atención en salud ANI-BIS-E se aplica, se mide, se gobierna y se audita. El stack es Next.js (App Router) + TypeScript + Supabase + Vercel, con Drizzle ORM y el motor clínico aislado en `src/clinical-engine/`. El proyecto está planeado en `docs/`. Tu trabajo es ejecutar disciplinadamente, no rediseñar. Atlas maneja datos de salud (PHI/PII): la seguridad y la trazabilidad clínica no son negociables.

---

## Orden de lectura

Al inicio de cada sesión, lee EN ESTE ORDEN antes de tocar nada:

1. `docs/README.md` (índice, contexto general)
2. `docs/ARCHITECTURE.md` (15 reglas duras + estructura, IMPRESCINDIBLE)

Al iniciar un bloque específico, lee adicionalmente:

3. La sección correspondiente de `docs/MVP.md`
4. `docs/DATABASE.md` si el bloque toca BD
5. `docs/SECURITY.md` si el bloque toca auth, datos o superficies públicas
6. `docs/DATA_GOVERNANCE.md` y `docs/CONSENT_ATLAS.md` si el bloque toca PII, consentimiento, anonimización o el LLM
7. `docs/CLINICAL_ENGINE.md` y `docs/SCIENTIFIC_MODEL.md` si el bloque toca el motor, indicadores, clasificaciones o la Diana
8. `docs/BRAND.md` si el bloque toca UI
9. `docs/API_INTEGRATIONS.md` si el bloque toca Wompi, Alegra, Groq/Gemini o el import de Biody Manager
10. `docs/DEPLOY.md` para setup, comandos, variables de entorno y runbooks

---

## Las 15 reglas duras (síntesis)

Viven en `ARCHITECTURE.md`. No se rompen sin actualizar el doc primero.

1. Ningún acceso directo a Supabase fuera de `data/` (repositorios).
2. Ninguna lógica de negocio en pages, server actions ni route handlers.
3. Ninguna autorización fuera de policies. Nunca por `user.role === ...` suelto ni por dominio de email.
4. Server Components por defecto. `"use client"` solo cuando aporta.
5. Ningún cálculo clínico fuera de `clinical-engine`.
6. Ninguna versión del motor sin golden tests que prueben paridad con el HTML de referencia.
7. Ningún registro clínico sin su constelación de versiones (`engine_version`, `survey_version_id`, `model_version_id`, `rules_version`).
8. Ningún evento clínico crítico sin `clinical_audit_log`, inline en la transacción. Nunca por el bus.
9. Ningún prompt IA inline. Versionado en `modules/*/ai/prompts/`. Nunca PII al LLM.
10. Ninguna llamada externa sin timeout explícito.
11. Ningún import cruzado con CNV Learning.
12. El `clinical-engine` no importa nada de la app (ni Next, ni React, ni Supabase). Es TypeScript puro.
13. Ningún tipo global monstruoso. Tipos viven en su módulo.
14. Ninguna cuenta clínica se recicla. Offboarding = desactivar y reasignar.
15. Ninguna evaluación sin las autorizaciones de consentimiento necesarias vigentes (`servicio`, `datos_sensibles`, `internacional_ia`; `revoked_at IS NULL`). Se verifica en la policy `evaluations/can-create-evaluation`, también en el flujo de seguimiento.

---

## Lo clínico (atención máxima)

Esto es lo que diferencia a Atlas de un proyecto normal. Léelo dos veces.

- **Congelado hasta Gildardo:** el `clinical-engine` (la matemática) y el **contenido de la encuesta** están congelados hasta que Gildardo entregue la versión final del HTML. Mientras tanto trabajas todo lo demás (ver orden de construcción en `MVP.md`). No inventes fórmulas ni preguntas.
- **Port fiel, no reingeniería:** cuando llegue el HTML, la lógica clínica se porta SIN cambiar ni un decimal. Primero demostrar equivalencia (golden tests contra valores capturados del HTML real), después optimizar. Nunca al revés.
- **Los golden tests prueban paridad con el HTML, no corrección clínica.** La corrección la firma Gildardo sobre una muestra. No "corrijas" la matemática del HTML aunque te parezca rara: repórtalo.
- **Nunca PII al LLM:** al portar la IA de apoyo, envía solo variables clínicas seudonimizadas, jamás nombre, cédula ni celular.
- **Resolución de identidad:** Atlas nunca decide solo inicial vs seguimiento. Resuelve por documento exacto; ante duda, alerta y el profesional confirma.

---

## Flujo de trabajo

### Bloques de setup, auth y layout: planning-first OBLIGATORIO

Al recibir el prompt del bloque:

1. Lee los docs relevantes.
2. NO ejecutes nada todavía.
3. Devuelve en plain text: resumen del alcance (2-3 líneas), lista de archivos a crear/modificar, plan de comandos en orden, decisiones que tomas tú y por qué.
4. Espera aprobación explícita ("adelante", "ejecuta", "OK").
5. Solo entonces ejecuta.

### Bloques siguientes: execution-with-checkpoints

Aprobado el plan general del bloque:

1. Ejecuta sub-tarea 1.
2. Muestra `git diff` resumido.
3. Propón commit message y espera "OK" para comitar.
4. Pasa a la siguiente sub-tarea. Repetir hasta terminar.
5. Al final, corre el criterio de aceptación y confirma que pasa.

---

## Commits

- Un commit por sub-tarea completada. No por bloque entero ni por archivo.
- Formato del mensaje:
  ```
  <tipo>: <descripción corta en inglés, modo imperativo>

  Párrafo en español explicando el "por qué", no solo el "qué".
  Referencia el doc si aplica: "ARCHITECTURE.md regla 7", "DATABASE.md".
  ```
- Tipos válidos: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`.
- NUNCA hagas `git push`. El push lo hace Santiago al final del bloque.
- NUNCA hagas commits sin mostrar antes el `git diff` resumido y el mensaje propuesto.
- Toda migración SQL, policy RLS, fórmula clínica, evento de dominio y prompt IA se commitea explicando el porqué.

---

## Manejo de errores

### Al ejecutar un comando que falla

1. NO reintentes el mismo comando 3 veces.
2. Lee el mensaje de error completo.
3. Diagnostica: versión, permisos, configuración, código.
4. Propón solución en texto y espera aprobación.

### Conflicto entre código y documentación

1. El documento gana. El código está mal.
2. Reporta el conflicto a Santiago. No ajustes el código a la fuerza: pregunta, por si el doc es el que debe actualizarse.

### Error que no entiendes después de 2 intentos

Para. No instales paquetes random. Pide ayuda con: comando ejecutado, error completo, lo que intentaste, tu hipótesis.

---

## Restricciones de estilo (no negociables)

### Idioma y tono

- Español neutro en código (variables, funciones, copy de UI), commits y comentarios.
- Excepción: nombres técnicos estándar en inglés (`userId`, `createdAt`, `submitEvaluation`).
- Tuteo en interfaz de usuario. Sin emojis en UI. Sin signos de exclamación múltiples.

### Em-dash

NUNCA uses em-dash en ningún lugar: ni en código, ni en copy, ni en docs, ni en commits, ni en comentarios. Reemplaza por coma (pausa breve), punto (separa ideas), punto y coma (enumera complejo) o paréntesis (aclara).

### Comentarios en código

- Breves, en español, explicando el porqué, no el qué.
- Excepción: comentarios en SQL pueden ir en inglés si son convención estándar.

---

## Restricciones técnicas críticas

### Next.js

- App Router, no Pages Router.
- Server Components por defecto. `"use client"` solo con estado, efectos, event handlers o APIs del navegador.
- Node.js runtime para todo. Única excepción acotada: `proxy.ts` en Edge para refresco de sesión y redirects de auth.
- TypeScript `strict: true` obligatorio.

### Supabase y Drizzle

- Cliente normal (anon key + RLS) para el 99% de los casos.
- Service role (`admin.ts`) SOLO en server actions y route handlers, con comentario justificando por qué se bypassa RLS.
- Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` al cliente.
- Migraciones con Drizzle: forward-only. NUNCA modifiques una migración aplicada; crea una nueva.

### Validación

- Toda entrada externa pasa por Zod, con límite de tamaño de payload.
- Schemas en `modules/<dominio>/validations/`.
- Server actions retornan `Result<T, AppError>`, no hacen throw para errores esperables.

### Package manager y supply chain

Este proyecto usa `pnpm`, NO `npm`. Traduce siempre: `npm install` a `pnpm install`, `npm run` a `pnpm`, `npx` a `pnpm dlx`.

Protecciones de supply chain (fuente de verdad: `DEPLOY.md`). En pnpm 11 estas protecciones viven en `pnpm-workspace.yaml`, NO en `.npmrc` (que queda solo para auth/registry):

- `minimumReleaseAge: 1440` (cuarentena de 24h: solo instala versiones con al menos un día de publicadas, ventana en la que se detecta la mayoría del malware).
- `minimumReleaseAgeStrict: false` (ante una versión demasiado nueva, cae a una más vieja que cumple, no falla la instalación).
- `minimumReleaseAgeExclude: ["@types/*"]` (paquetes sin código ejecutable, para reducir fricción).
- `blockExoticSubdeps: true` (rechaza deps de git/tarballs).
- `ignoreScripts: true` (bloquea postinstall, vector principal de supply-chain).
- `saveExact: true` (versiones exactas, sin `^` ni `~`).
- `allowBuilds` como whitelist de los postinstall verificados (este es el setting de pnpm 11; NO uses el viejo `onlyBuiltDependencies`).
- NUNCA pongas `minimumReleaseAge` en `.npmrc`.
- Al configurar en B0, verifica la ubicación y el comportamiento exacto de cada setting contra la doc oficial (pnpm.io/settings). Si una protección queda en el archivo equivocado, se desactiva en silencio sin dar error.
- Contexto: la campaña de supply chain en npm sigue activa (Shai-Hulud y variantes, 2025-2026). Estas protecciones son obligatorias.

### Antes de instalar cualquier paquete

1. Verifica que esté listado en `DEPLOY.md` como dependencia aprobada.
2. Si NO está, detente y propónlo primero.
3. Si dudas si está comprometido, búscalo en `socket.dev` antes de instalar.
4. Si un build de post-install se bloquea por `ignoreScripts`, NO lo desactives global: verifica el package, agrégalo a `allowBuilds` con justificación inline, y espera aprobación.

---

## Cuándo PARAR y pedir input

- Decisión arquitectónica no documentada en `docs/`.
- Tentación de instalar una dependencia no listada.
- Conflicto entre dos documentos.
- Error que no diagnosticas en 2-3 intentos.
- Cualquier cosa que potencialmente cruce con CNV Learning (ver `BOUNDARIES.md`).
- Cambio de schema SQL en una tabla ya migrada.
- Cualquier prompt IA nuevo (debe versionarse).
- **Cualquier cambio a una fórmula, indicador, clasificación o a la Diana.**
- **Cualquier divergencia entre el port y los golden tests.**
- **Cualquier cosa que toque el contenido de la encuesta (congelado).**

---

## Lo que NUNCA debes hacer

1. Modificar una migración SQL aplicada. Crea una nueva.
2. Hacer `git push` sin permiso explícito.
3. Importar código entre dominios CNV.
4. Exponer service_role key al cliente.
5. Usar `localStorage` o `sessionStorage` para datos sensibles.
6. Asumir que algo es "obvio" sin verificar en `docs/`.
7. Inventar campos de tabla que no estén en `DATABASE.md`.
8. Hacer `fetch()` sin timeout explícito.
9. Usar `dangerouslySetInnerHTML`.
10. Saltarte el planning en los bloques tempranos.
11. Usar `npm` en lugar de `pnpm`.
12. Instalar un paquete que no esté en `DEPLOY.md` sin aprobación.
13. Cambiar la matemática/lógica clínica durante el port.
14. Persistir un registro clínico sin su constelación de versiones.
15. Enviar PII al LLM.
16. Escribir en `clinical_audit_log` por el bus (siempre inline).
17. Reciclar una cuenta clínica (offboarding = desactivar y reasignar).
18. Auto-decidir inicial vs seguimiento (resuelve identidad, el profesional confirma).
19. Crear una evaluación sin verificar las autorizaciones de consentimiento necesarias vigentes (regla dura 15).

---

## Variables de entorno

Documentadas en `DEPLOY.md`. Todo lo sensitive NUNCA lleva prefijo `NEXT_PUBLIC_`.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (cliente OK)
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (solo server)
- `GROQ_API_KEY` / `GEMINI_API_KEY` + variables de modelo (solo server)
- `RESEND_API_KEY` (solo server)
- `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET` (solo server; el events secret valida la firma HMAC de webhooks)
- `ALEGRA_API_KEY` (solo server)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (solo server; rate limiting)
- `NEXT_PUBLIC_SENTRY_DSN` (público por diseño), `SENTRY_AUTH_TOKEN` (solo server/build), `NEXT_PUBLIC_APP_URL`

---

## Sobre las preguntas del usuario

Santiago (responsable técnico) NO es desarrollador profesional. Es competente, pero:

- Explica los conceptos técnicos sin asumir contexto avanzado.
- Si usas terminología nueva, dale 1 línea de contexto.
- No le devuelvas paredes de código sin explicación.
- Si una decisión tiene trade-offs, explícalos brevemente.

---

## Verificación al final de cada bloque

Antes de declarar un bloque terminado:

1. Ejecuta el criterio de aceptación documentado en `MVP.md`.
2. Corre `tsc --noEmit`.
3. Corre `pnpm lint`.
4. Corre los tests relevantes (`pnpm vitest run`), incluidos los **golden tests** si el bloque tocó el motor.
5. Confirma que el deploy local funciona (`pnpm dev`).
6. Reporta: "Bloque N completo. Criterios de aceptación: [✓ A, ✓ B, ✓ C]. Listo para push."

---

## Recordatorio final

Este proyecto se construye una sola vez bien hecho. No es un prototipo desechable: es el sistema que cambia cómo se mide la salud, y el motor clínico no admite errores. Cada decisión que tomes hoy se hereda.

Cuando dudes entre velocidad y calidad, elige calidad. Cuando dudes entre el patrón documentado y el "más simple", elige el documentado. Cuando dudes entre actuar e inventar, pregunta. La disciplina arquitectónica es barata hoy y carísima dentro de 6 meses si no se cuidó.
