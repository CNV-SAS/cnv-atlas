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
15. Ninguna evaluación sin las autorizaciones de consentimiento necesarias vigentes (`servicio`, `datos_sensibles`; `revoked_at IS NULL`). Se verifica en la policy `evaluations/can-create-evaluation`, también en el flujo de seguimiento. (Consent v1.0, revisión legal 2026-08-11: `internacional_ia` dejó de ser autorización, se absorbió en `servicio`. La aceptación del medio electrónico, necesaria para FIRMAR, la exige `consentSchema` en el servidor y se persiste aparte; no es del gate clínico.)

---

## Regla 0: qué es este software, y qué no es (gobierna todo lo demás)

**Instrucción de Gildardo, 2026-08-27. Está por encima de cualquier otra consideración de producto.**

> **Esto no es un software clínico para médicos. Es un software para aplicar el modelo ANI BIS-E.**
> No es un sistema de soporte a la decisión clínica, ni un verificador de seguridad alimentaria, ni un
> tamizador de patologías. **No se compliquen la vida.**

**Y la regla que sale de ahí: el software representa el archivo, LITERALMENTE. No puede tener más, no
puede tener menos.** No se añaden datos que el archivo no captura, ni secuencias distintas de las que el
archivo tiene, ni instrumentos que el archivo no incluye. Aplica a la encuesta y a los módulos de
antropometría, diagnóstico con sus submódulos, rutas de tratamiento y reporte/HC.

**La pregunta cuando algo parece faltar NO es "¿lo construimos?", es "¿por qué no está?", y se le hace a
él.** Ni nosotros ni su herramienta podemos atribuirnos cambios en el software clínico.

Cómo se aplica en la práctica:

- **Antes de construir contenido diagnóstico, verificar las DOS condiciones:** que el dato ya esté en la
  encuesta **y** que el criterio ya esté en el archivo. Lo que no cumpla las dos, se le devuelve.
- **Mostrar un dato capturado NO es construir contenido.** Su archivo ya trae un bloque de datos crudos
  del paciente; portar eso es representar el archivo. Inventar un tamizaje que cruce esos datos, no.
- **El motor propone, el profesional dispone.** Ninguna cifra de la prescripción nutricional lleva techo,
  piso, validación ni advertencia (2026-08-27, §5: vale para TODA la prescripción, no indicador por
  indicador).
- **Los ajustes salen de nuestros datos y de nuestros artículos**, no de lo que parezca razonable.
- Si una propuesta nuestra ya se construyó y resulta que el archivo no la tiene, **se retira**, no se
  defiende. Precedente: las tablas de alérgenos y patrones (2026-08-27, §10).

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
- **Ortografía por superficie.** ASCII (sin tildes ni enes) está bien para lo INTERNO: mensajes de commit, comentarios de código, documentos internos, nombres de variables. Español CORRECTO, con tildes y enes, para TODO lo que ve un usuario: textos de pantalla, mensajes de error, avisos, correos, PDF, y cualquier cadena que llegue a un profesional o a un paciente. Media corrección deja el sistema mezclado ("pestana" junto a "prescripción"), que se lee como sistema mal hecho.

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
- **Fronteras RSC: LAS DOS DIRECCIONES rompen en producción y son invisibles a tsc.** `pnpm check:rsc` (`scripts/check-rsc-boundaries.mjs`) barre ambas; **paso OBLIGATORIO tras cada feature con componentes cliente** (cero aristas). tsc verde NO descarta un fallo de frontera RSC; solo este check (o el build de producción real) lo atrapa.
  - **A · cliente → server-only.** Ningún componente `"use client"` importa un VALOR de un módulo `server-only` (ni un `import type`, que tsc borra sin reportar). La arista deja el reader al alcance del boundary de cliente y el bundler de PRODUCCIÓN puede volverlo referencia-cliente, dejando sus funciones `undefined` en runtime (hazard LATENTE: reales en referrals y corrections, 2026-08-08).
  - **B · servidor → valor de cliente.** Ningún archivo de SERVIDOR (sin `"use client"`, p. ej. una `page.tsx`) importa un VALOR NO-componente (función/constante) de un módulo `"use client"` y lo INVOCA. React lanza "Attempted to call X() from the server but X is on the client" y tumba la página con 500 (invisible a tsc/lint/tests/build; tumbó `/evaluaciones` el 2026-08-21: `prescriptionSignature` quedó en el componente cliente y la `page` la llamaba). Importar un COMPONENTE (PascalCase) de un módulo cliente y renderizarlo como JSX SÍ es válido; el hazard es invocar una función.
  - **El fix de ambas es el mismo:** el valor que comparten cliente y servidor vive en un módulo NEUTRO (sin `"use client"` ni `server-only`: `*-types.ts`, `validations`, `protocol-signature`), que los dos lados importan.
- **Hazards de formularios que SOLO aparecen en un navegador real (ni tsc, ni lint, ni jsdom los atrapan).** Son de la misma familia que el de cliente→server-only: verdes en local, rotos en producción o en el navegador. Los conocidos:
  1. **`key` compartida entre "Siguiente" (type=button) y "Enviar" (type=submit) en un wizard multi-paso.** React reutiliza el mismo nodo DOM en la última transición; el re-render síncrono dentro del `onClick` cambia el `type` a submit y el navegador ejecuta la acción por defecto del clic sobre un botón que ya envía → **el formulario se auto-envía solo al entrar al último paso y ese paso se pierde en TODOS los pacientes** (así quedó degradado el demo semanas). PRESERVAR: `key` DISTINTAS en los dos botones (el nodo de "Siguiente" se desmonta y "Enviar" se monta nuevo). En un flujo con VARIOS puntos de envío (p. ej. el intake de dos fases: firmar y enviar), cada botón de envío arrastra el mismo hazard.
  2. **Auto-reset de React 19 con `<form action={fn}>`.** La prop `action` resetea los inputs no controlados tras la acción; un error (código malo) borra lo que el paciente llenó. PRESERVAR: invocar la acción con `onSubmit` + `startTransition(() => action(new FormData(e.currentTarget)))`, NO como prop `action`.
  3. **Momento del código OTP.** El código vence en 10 min; si el bloque de verificación aparece antes del último paso, vence mientras el paciente aún llena. PRESERVAR: pedir/verificar el código al FINAL de su fase.
  4. **Un campo `disabled` NO SE ENVIA en el FormData.** Bloquear con `disabled` un campo cuyo valor tiene que viajar hace que el servidor no lo reciba, y la pantalla se contradice: una parte dice que el dato esta bien y la otra que falta. Caso real (2026-08-26): al validar el codigo de verificacion se ponia `disabled` en su campo; salia el verde "Código correcto. Ya puedes firmar" y al firmar el servidor respondia "Ingresa el código de verificación". **El camino feliz tambien fallaba**, y el sintoma aparecia despues de haber probado otras cosas, lo que invita a un diagnostico equivocado. PRESERVAR: `readOnly` (mas `aria-readonly` y estilo apagado) para bloquear un campo que debe enviarse; `disabled` solo donde el valor no viaja (botones, o campos que de verdad no deben llegar). **Y la regla de fondo: si dos partes de la pantalla dicen cosas opuestas, no es que una este mal, es que LEEN FUENTES DISTINTAS**; el arreglo no es corregir el mensaje sino unir las fuentes.

  **Lo que las CUATRO tienen en común: son defectos que solo se ven en un navegador real.** Por eso, en superficies de formulario sensibles (el intake del paciente sobre todo), **el smoke humano en navegador NO es opcional**: es la única verificación que atrapa esta clase de bug. Si tocas uno de estos componentes, pruébalo en un navegador real antes de darlo por hecho.

### Supabase y Drizzle

- Cliente normal (anon key + RLS) para el 99% de los casos.
- Service role (`admin.ts`) SOLO en server actions y route handlers, con comentario justificando por qué se bypassa RLS.
- Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` al cliente.
- Migraciones con Drizzle: forward-only. NUNCA modifiques una migración aplicada; crea una nueva.
- **Una SEGUNDA relación (FK) hacia una tabla ya referenciada vuelve AMBIGUOS los embeds existentes de PostgREST.** Al agregar un FK nuevo a una tabla que otras consultas ya embeben (`.select("... otra_tabla(campo)")`), PostgREST deja de saber por cuál relación resolver el embed y falla en runtime ("Could not embed because more than one relationship was found... hint the column with `otra!<columna>`"). Rompe consultas que NO tienen nada que ver con el FK nuevo. Es de la familia que **tsc no ve**: en un embed ANIDADO (`a(b(campo))`) el tipo no marca la ambigüedad y compila verde; solo un **test contra BD real** (o el runtime) lo atrapa. Caso real: agregar `rut_verified_by → profiles` rompió tres embeds `profiles ← professional_profiles` en comodato, faltantes y remesa (2026-08-12). **PRESERVAR:** al agregar un FK a una tabla ya referenciada, buscar todos los embeds de esa tabla (`grep "<tabla>("`) y desambiguarlos con el hint `tabla!columna(...)`; y correr la suite de BD real, no solo tsc.

### Validación

- Toda entrada externa pasa por Zod, con límite de tamaño de payload.
- Schemas en `modules/<dominio>/validations/`.
- Server actions retornan `Result<T, AppError>`, no hacen throw para errores esperables.

### Package manager y supply chain

Este proyecto usa `pnpm`, NO `npm`. Traduce siempre: `npm install` a `pnpm install`, `npm run` a `pnpm`, `npx` a `pnpm dlx`.

Protecciones de supply chain (fuente de verdad: `DEPLOY.md`). En pnpm 11 estas protecciones viven en `pnpm-workspace.yaml`, NO en `.npmrc` (que queda solo para auth/registry):

- Los settings vigentes viven en `pnpm-workspace.yaml`, cada uno comentado inline con su justificación, y están explicados en `DEPLOY.md` sección 2bis. No los dupliques aquí: la copia se desactualiza y contradice al original. Para verificar el comportamiento real: `pnpm config get <setting>`.
- NUNCA pongas `minimumReleaseAge` en `.npmrc`. Si una protección queda en el archivo equivocado se desactiva en silencio, sin dar error.
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

La lista completa, con la anotación de alcance (cliente OK / solo server) de cada variable, vive en `DEPLOY.md` sección "Variables de entorno". No la dupliques aquí.

**Regla crítica:** todo lo sensitive NUNCA lleva prefijo `NEXT_PUBLIC_`. Si una variable necesita ser pública, se decide y se documenta en `DEPLOY.md` antes de usarla.

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
6. **Actualiza la entrada de estado del bloque (BACKLOG.md / PLAN_ETAPAS.md / handoff) a HECHO EN EL MISMO COMMIT que lo cierra.** Los documentos de estado se escriben al planear; si no se actualizan al terminar, quedan stale y se replantea o reconstruye algo ya hecho (ha pasado 4+ veces: las 7 entradas del barrido, el mecanismo de modificaciones autorizadas, P0 Parte 2). Cerrar en el mismo commit ataca la raíz.
7. Reporta: "Bloque N completo. Criterios de aceptación: [✓ A, ✓ B, ✓ C]. Listo para push."

**Corolario, contra el mismo patrón:**
- **"Pendiente" se trata como "verificar primero", no como verdad.** Antes de construir un ítem que un doc marca abierto, cotéjalo contra el código y los tests; puede estar hecho (verificar salvó un re-build de P0 Parte 2, 2026-08-08).
- **Estado PREFERIDO cuando el bloque tiene test de aceptación: "corre estos tests", no una afirmación a mano.** Una aserción "HECHO" envejece; un puntero a un test que pasa, no. Donde exista un test de aceptación, el estado del bloque lo CITA en vez de afirmarlo. No cubre todo bloque, pero donde aplique es lo único que no queda stale.

---

## Recordatorio final

Este proyecto se construye una sola vez bien hecho. No es un prototipo desechable: es el sistema que cambia cómo se mide la salud, y el motor clínico no admite errores. Cada decisión que tomes hoy se hereda.

Cuando dudes entre velocidad y calidad, elige calidad. Cuando dudes entre el patrón documentado y el "más simple", elige el documentado. Cuando dudes entre actuar e inventar, pregunta. La disciplina arquitectónica es barata hoy y carísima dentro de 6 meses si no se cuidó.
