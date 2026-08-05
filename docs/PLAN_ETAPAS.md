# PLAN_ETAPAS.md — la secuencia de Atlas hacia el lanzamiento

**Qué es.** El ORDEN del trabajo hacia el Hito 1/2/3, en tres etapas. Complementa, no reemplaza:
- `LANZAMIENTO.md` tiene los **gates** (qué debe cumplirse), no la secuencia.
- `BACKLOG.md` tiene el **detalle** de cada ítem. Este documento **enlaza** a BACKLOG en vez de duplicarlo (una copia se desactualiza y contradice al original).

**Cómo leer el estado de cada ítem:**
- ✅ **hecho** — construido y verificado.
- 🔨 **a medio construir** — empezado, con estado intermedio. **Más urgente que lo sin empezar:** un estado a medias puede ser peor que ninguno (pasó con P0 Parte 2 y el flujo de corrección).
- ⬜ **sin empezar** — no arrancado, pero construible.
- ⛔ **bloqueado** — no se puede avanzar; cada uno dice **por qué** y **desde cuándo**, y si el bloqueo es de **Gildardo** (su lado) o **nuestro**.

---

## E1 · CLÍNICO — las cuatro fases del modelo

**Termina cuando:** un profesional puede atender un paciente de punta a punta (Evaluación → Diagnóstico → Tratamiento → Seguimiento → Reporte).

### Evaluación
- ✅ Intake (encuesta 62 preguntas), import BIS, condiciones de la toma, consentimiento, resolución de identidad.
- 🔨 Lote de pulido de usabilidad (observaciones del recorrido end-to-end) → E3. Ver `BACKLOG.md` "[PROCESO/CALIDAD] Recorrido end-to-end".

### Diagnóstico
- ✅ Motor real (frozen), snapshot inmutable, Diana EFR, tabla de indicadores, DFI, composición.
- 🔨 Aviso de encuesta incompleta (D-007 **Fase A** hecha: informa qué dominios faltan y qué se suspendería). ⛔ **Fase B** (suspender de verdad EB-BIS/ICEC/rutas) — bloqueada por **P-09** (Gildardo: dependencia exacta), desde 2026-08-04.
- ⛔ **Re-sync del frozen con el HTML vigente** — cPABU/cMMEM bloqueados por **Q27/P-?** (Gildardo), desde 2026-08-01; `_ffmiLow` y los 3 cortes MCCB son **nuestros** (no esperan a Gildardo). **AVISO: el vigente es ahora el v8** (19.259 líneas), re-verificar antes de ejecutar. Ver `BACKLOG.md` "Re-sincronizar el frozen".

### Tratamiento (cuatro workspaces por profesión)
- ✅ Motores médico, ejercicio, psicólogo (display) + nutricionista, portados y cableados.
- ⬜ **Barra de subpestañas** por profesión (se pospuso hasta tener >1 contenido; ahora ya lo hay).
- ⬜ **Plan alimentario D1-D8** (`calcPatron`/C9) — **nuestro**, construible ya (tenemos `atlas-encuesta-patron.js`), pendiente desde 2026-07-24. Habilita "Diagnóstico de encuesta".
- ⬜ **Remisión como acción registrable** (D-009) — bloque propio (tabla + audit + redacción del frozen).
- ⛔ **Cadena calórica** — bloqueada por **C6** (Gildardo: proteína + sobrecosto en cifras), desde ~2026-07. Es el bloqueo de mayor peso del proyecto. Incluye la salvaguarda de TCA como requisito duro.

### Seguimiento
- ✅ Comparación longitudinal contra la evaluación previa (anclada a `measurement_date`, C2-a).
- 🔨 **P0 Parte 2** (comunicación del cambio al paciente en 3 bandas): núcleo `eb-trajectory.ts` hecho; **P2-P5 en curso** (reader de previas, sellado de la banda, gates de "empeoró", render). En pase enfocado. Ver `BACKLOG.md` "Comunicación del cambio al paciente".

### Reporte (salida de las fases)
- ✅ PDF desde el snapshot, aprobar (confirma diagnóstico), enviar por correo, notas del profesional.
- ⬜ Referencia + interpretación por indicador en el PDF del paciente (gate Hito 3, `LANZAMIENTO.md`).

---

## E2 · OPERATIVO — lo que el integrante necesita ADEMÁS del acto clínico

**Esto NO es pulido, es PRODUCTO.** Sin ello el Hito 2 no se puede hacer: los integrantes necesitan entrar a algo, operar y cobrar. Inventario verificado 2026-08-04.

**Alcance del Hito 1 (decidido por Santiago 2026-08-04):**
- **OBLIGATORIO antes de que un integrante entre (gate Hito 2):** profesión al invitar · deploy a la nube (staging) · limpieza de PII y datos de prueba · grants sobre contenido clínico · "olvidé mi clave" self-service.
- **PUEDE ESPERAR (Hito 3 o después):** agenda · avisos/notificaciones · dashboards · `/comercial`.
- ⚠️ **RIESGO DEL HITO 2, no pendiente del Hito 3:** si el Hito 2 dura **semanas**, la ausencia de **avisos** empieza a doler (un integrante que no recibe nada cuando un paciente paga tiene que estar revisando a mano). No se construye para el Hito 2, pero queda escrito como riesgo a vigilar: si la revisión se alarga, sube de prioridad.

### 1 · ENTRAR (onboarding / auth) — mayormente hecho
- ✅ Invitación por correo (Supabase Auth), login, MFA (internos), recuperación forzada por admin, creación de cuenta/clave.
- ⬜ **[OBLIGATORIO H2] Profesión al invitar** — hoy `profession=null` bloquea TODAS las escrituras de tratamiento, así que un integrante nuevo no podría trabajar. + `profession` NOT NULL + backfill. Gate Hito 2. **Nuestro.**
- ⬜ **[OBLIGATORIO H2, barato] "Olvidé mi clave" self-service** — hoy solo lo fuerza un admin; si un profesional queda fuera un sábado no hay quien lo atienda. Verificado barato: la plantilla `recovery.html` existe, `resetPasswordForEmail` ya se usa (admin path), `set-password` ya aterriza la recuperación; falta un link en login + una página chica. **Nuestro.**
- ⬜ MFA para profesionales (hoy solo internos) — puede esperar.

### 2 · OPERAR (operación diaria) — parcial
- ✅ Roster de pacientes (`/pacientes`), detalle, resolución de identidad, lista de evaluaciones, gestión de reportes.
- ⬜ **Agenda / scheduling** — NO existe (solo un campo `proxima_cita`, sin calendario ni recordatorios). Puede esperar. Módulo `professionals/` vacío.

### 3 · COBRAR (facturación) — mayormente hecho (sandbox)
- ✅ Wompi (checkout, comisión, webhook HMAC+idempotencia) + Alegra (factura best-effort), todo en **sandbox**.
- ⬜ Wompi/Alegra **producción** (nunca ejercitado contra proveedor real; necesita el deploy; mapeo de catálogo Alegra). Puede esperar; se ejercita con staging.
- ⬜ `/comercial` (vista de pagos/comisiones) — placeholder. Puede esperar.

### 4 · RECIBIR AVISOS (notificaciones) — mayormente ausente
- ✅ Un solo correo transaccional: reporte al paciente (Resend).
- ⬜ **Módulo de notificaciones** — NO existe. Puede esperar, PERO ver el ⚠️ riesgo del Hito 2 arriba.

### 5 · VER SU NEGOCIO (dashboards) — ausente
- ⬜ `/dashboard` y `/comercial` son placeholders; cero métricas de negocio. Puede esperar.

### 6 · EL ENTORNO (infra) — mayormente por construir
- ✅ Mecanismo de grants para las 3 tablas de notas narrativas (`clinical-access/`).
- ⬜ **[OBLIGATORIO H2] Deploy a la nube (staging)** — hoy Vercel solo muestra el login (Supabase nube vacío/pausado). Gate Hito 2. **Nuestro** (config + operativo de Santiago). Ver `BACKLOG.md` "Despliegue a la nube".
- ⬜ **[OBLIGATORIO H2] Grants sobre TODO el contenido clínico identificado** — hoy el `admin` ve más de lo que debería (solo las 3 tablas de notas están cerradas; evaluaciones/BIS/diagnósticos/tratamientos/reportes/pacientes siguen admin-amplio). PRIORIDAD ALTA, confirmado por el chat legal. **Nuestro.** Ver `BACKLOG.md` "Extender el mecanismo de grants".
- ⬜ **[OBLIGATORIO H2] Limpieza de PII y datos de prueba** — el seed introduce "Santiago Arroyave" y hay pacientes reales de pruebas manuales; no pueden estar en staging. + seed no-destructivo (UPSERT). **Nuestro.** Ver `BACKLOG.md` gate Hito 2.

---

## E3 · PULIDO — al final, después de la funcionalidad

- ⬜ **Cuatro bloques de cotejo visual** contra el HTML vigente: encuesta, evaluación, diagnóstico, tratamiento (fidelidad al modelo clínico). Ver `BACKLOG.md` "Pulido de fidelidad".
- ⬜ **Rediseño gráfico transversal** de toda la app, de una sola vez (después de cablear toda la funcionalidad). Ver `BACKLOG.md` "Rediseño gráfico coherente".

---

## Resumen para decidir orden y alcance

Estado por etapa (ítems cerrados, no porcentaje inventado):

| Etapa | Cerrado | A medio (🔨) | Sin empezar (⬜) | Bloqueado (⛔) | Mayor bloqueo |
|---|---|---|---|---|---|
| **E1 Clínico** | Evaluación, Diagnóstico núcleo, Tratamiento 4 motores, Comparación, Reporte | D-007 Fase A, P0 Parte 2 | Plan alimentario, barra subpestañas, remisión, PDF referencia | Cadena calórica, D-007 Fase B, re-sync core | **C6 (Gildardo)** — cadena calórica |
| **E2 Operativo** | Entrar (base), Cobrar (sandbox) | — | Agenda, avisos, dashboards, /comercial | — | **Nuestro** — todo E2 es construcción nuestra; nada espera a Gildardo |
| **E3 Pulido** | — | — | 4 cotejos visuales, rediseño gráfico | — | va al final |

**Lo que depende de Gildardo:** la cadena calórica (C6) y su cascada, D-007 Fase B (P-09), y el resto del re-sync de core (cPABU/cMMEM). Todo lo demás construible es **nuestro** — E2 entero, el plan alimentario, `_ffmiLow`, P0 Parte 2.

**Consecuencia para el orden:** mientras C6 no llegue, el trabajo clínico de mayor peso (cadena calórica) está detenido, así que conviene avanzar en paralelo lo nuestro: terminar P0 Parte 2, el plan alimentario, y **arrancar E2** (que no espera a nadie y es gate del Hito 2). El alcance obligatorio de E2 para el Hito 1 está fijado arriba.
