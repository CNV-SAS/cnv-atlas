# LANZAMIENTO — Hitos y gates

**Qué es.** La lista que decide **cuándo se puede atender al primer paciente real** estaba dispersa en `BACKLOG.md` entre más de cien líneas. Este documento la consolida: **nombra cada gate y apunta al detalle**; el detalle sigue en `BACKLOG.md` (u otros docs).

**FUENTE ÚNICA DE VERDAD sobre gates.** Este documento es el único que declara, para cada gate: (a) **su estado** (abierto / cerrado), (b) **a qué hito pertenece**, y (c) **el conteo** de gates abiertos por hito. Ningún otro doc afirma esas tres cosas por su cuenta: los demás describen el TRABAJO de un gate (qué hace, cómo se construye) y, si necesitan referirse a su estado o su hito para leerse solos, **citan explícitamente a este documento** ("ver `LANZAMIENTO.md` gate N"). Motivo: el mismo hecho vivía duplicado en cinco docs y actualizar uno dejaba cuatro mintiendo (se repitió 7 veces). Supera a `MVP.md` y a cualquier tabla de estado de `PLAN_ETAPAS.md`/`BACKLOG.md`/`MAPA.md` para esto.

**Dos ejes (no una lista):** **qué rol** (profesional → admin → soporte → dirección → ObBIA) y **qué hito**. Los hitos son compuertas; cada rol tiene un mínimo distinto en cada una (la matriz rol × hito se completa aquí conforme se decida por rol; hoy el eje que aprieta es el del profesional).

| Hito | Qué es | Estado |
|---|---|---|
| **Hito 1** | Producto completo y pulido para el Integrante (sandbox de pagos, **sin pacientes reales**) | EN CURSO |
| **Hito 2** | Revisión de Integrantes (prueban en la nube, dan visto bueno) | pendiente |
| **Hito 3** | Operación con **pacientes reales** | pendiente |

> Regla: **cada gate se cierra antes de pasar su hito.** Un gate abierto en el Hito 3 significa que NO se puede atender al primer paciente real.

---

## Gates del Hito 1 (producto completo para el Integrante)

1. **Flujo de corrección post-diagnóstico** (versionar evaluación/diagnóstico/reporte sin sobrescribir). **CONSTRUIDO (2026-08-11, CP1-CP3 de `PLAN_S2_CORRECCION.md`), pendiente smoke de Santiago.** Alcance = corrección de ENCUESTA (crea versión nueva, no sobrescribe; historial de la cadena con motivo; gate de versión de encuesta como estado). Tests: `correct-evaluation.test.ts` + `correction-chain.test.ts`. Fuera de este gate (bloque aparte, `BACKLOG.md` "Cerrar una evaluación CON diagnóstico"): el "Biody del paciente equivocado", que se resuelve cerrando y rehaciendo, no corrigiendo la medición.
2. **Bug D8 de la encuesta (CERRADO 2026-08-02, arreglo verificado por smoke).** El auto-envío al entrar a la última sección era la acción por defecto del clic sobre un botón reusado sin `key`; arreglado con `key` distintas. Santiago verificó los cinco casos (avanzar, retroceder, responder completo, no autoenvío, vista del profesional). Queda como follow-on (no gate) un e2e del wizard, única red que atrapa su reaparición (`BACKLOG.md`). `BACKLOG.md`.
2bis-a. **`dfi.complete` mide completitud REAL (CERRADO 2026-08-02).** Antes `complete = hay al menos un campo`, así que cualquier encuesta parcial se sellaba como completa en el snapshot inmutable de `reports`. Ahora `complete = todos los field_key que declara la versión de la encuesta están respondidos` (regla 7, definición aprobada por Gildardo/Santiago). Implementado en `engine.ts` (Opción A: la lista viaja en el `EngineInput`, anclada a `survey_version_id` sellado en el snapshot; fail-loud si no se puede obtener, nunca default silencioso). Sella `missingFieldKeys` para poder decir qué falta. Regresión en `clinical-engine.test.ts` (parcial ya no se marca completo). **Nota:** una encuesta a medias produce una edad bioeléctrica mayor, un nivel de riesgo más alto y a veces rutas que no corresponden (el bug D8 real solo tiraba el dominio D8, que no alimenta la EB-BIS, así que el efecto medido fue pequeño, +0.6; el efecto grande, +20.9, era un caso 3/13 sintético; ver la corrección en `BACKLOG.md`). Aun así un parcial cambia riesgo y rutas, por eso importa marcarlo.
2bis-b. **El sistema SUSPENDE lo que depende de la encuesta cuando `complete = false` (CONSTRUIDO 2026-08-11/12, pendiente smoke de Santiago).** Implementa Q28 (Gildardo 2026-08-03). Con la encuesta incompleta: el diagnóstico bioeléctrico se emite (sale de la medición), pero la edad bioeléctrica, el índice contextual (ICEC) y las rutas de encuesta NO se emiten. Opción A (suspensión en la glue `engine.ts`, no en el frozen) + gate de render (protege snapshots ya sellados). Coherencia de display: los dominios de encuesta se marcan "No evaluable", el riesgo integrado provisional, el radar se oculta (un eje colapsado se lee como óptimo). El aviso al profesional enlaza el flujo de corrección para completar. Commits `9b6ae0d`/`c80ff09`. El riesgo integrado hereda la inflación → pregunta P-21 a Gildardo (interín conservador). **Corolario:** exigir encuesta completa para diagnosticar contradice esta decisión; no se implementa.
3. **Los cuatro bloques de pulido de fidelidad** (encuesta, evaluación, diagnóstico, tratamiento), cada uno con comparación crítica contra el HTML. **Avance (2026-08-12):** el PASE DE INSTRUMENTO de la encuesta está HECHO (encuesta v3): ECA1 cirugías, ECA2 porciones + intro D1, ECA3 nombres de grupos, rótulos, todo verbatim de v8; sociodemográficos (4 al perfil + motivo); nombres de indicadores (P-18). ECA4a (texto libre en "Otra") separado por implicación de motor → pregunta a Gildardo (ECA4b). Queda el COTEJO VISUAL con ojos de las cuatro pantallas (comparación forma-a-forma). `COTEJOS_VISUALES.md` / `MAPA.md` / `BACKLOG.md`.
4. **Diseño gráfico coherente** de toda la app (al final del Hito 1, después de los cuatro bloques de pulido). `BACKLOG.md`.

## Gates del Hito 2 (revisión de Integrantes en la nube)

5. **Despliegue a la nube — CERRADO (2026-08-07/08, Santiago).** `atlas.cnvsystem.com` en producción: Supabase nube, dominio propio, Resend, y el pago probado end-to-end con Wompi sandbox. La nube nació limpia (sembrada con `SEED_DEMO=false`, `patients` vacía verificada). `DEPLOY_GUIA_NUBE.md`.
6. **Captura de la profesión al invitar + `profession` NOT NULL — CERRADO (2026-08-05).** `createUserSchema` la exige (superRefine), columna NOT NULL (migración 0036). Falta aparte (no gate): EDITAR la profesión. `BACKLOG.md`.
7. **Q19/Q20 — clasificación y fenotipo consistentes** (F1-F12 en Diagnóstico; y cuál clasificador manda, `cXXX` vs `dXXX`). Gildardo dijo "antes de abrirle Atlas a los integrantes". `GILDARDO_QUERIES.md`.
8. **Rótulo de la EB-BIS** ("no leer como edad fisiológica", indicación de Gildardo). `BACKLOG.md`.
9. **Aviso a los Integrantes del paso de confirmación del diagnóstico** (Atlas lo añade, el prototipo no lo tiene). `BACKLOG.md`.
10. **Seed no destructivo — CERRADO (2026-08-07).** Interruptor `SEED_DEMO` en `supabase/seed.ts`; la nube se siembra sin datos demo. Pendiente menor (no gate): que el seed sea UPSERT idempotente para re-siembras. `DEPLOY_GUIA_NUBE.md`.
10bis. **"Olvidé mi clave" self-service — CERRADO (bloque de auth).** Enlace en la pantalla de acceso (`forgot-password`) + correo de recuperación + cambio de clave con segundo factor (`set-password-mfa-form`), probado en la nube. No era un gate numerado; se registra aquí para que no reaparezca como pendiente. `src/modules/auth`.
11. **Gate de aprobación de Gildardo para los cambios de opción B** (él aprueba ANTES de producción = antes de que un Integrante lo vea en la nube del Hito 2). **Movido de Hito 3 a Hito 2 (2026-08-01):** los cambios de opción B que se COMPUTAN al mostrar (la Δ, CA-2) llegan a pantalla sin sellarse, así que un Integrante los vería en su revisión del Hito 2; si Gildardo no aprobó antes, se pierde el sentido de su condición. `docs/entregas/CAMBIOS_AUTORIZADOS.md`.

## Gates del Hito 3 (pacientes reales)

12. **Q8 — firma del modelo de índices** (Gildardo confirma que la EB-BIS v5 vigente es la definitiva). `GILDARDO_QUERIES.md`. **CERRADA** (respondió), pendiente solo su OK formal.
13. **Q14 — modelo calórico vigente** (el tercero: peso meta + estrategia por condición + fórmula P1). `GILDARDO_QUERIES.md`. **CERRADA** en decisión; el re-port depende de P1.
14. **P0 — presentación de la edad biológica** (Gildardo decidió, 2026-08-01). Verificación concreta, no una intención: **el reporte del paciente NO contiene la cifra de EB-BIS, ni la de IAE, ni la expresión "edad biológica".** Parte 1 HECHA (EB/IAE fuera del reporte + marca de calibración provisional para el profesional), con test que lo ancla (`report-render.test.ts`). Resta la Parte 2 (cambio en tres bandas desde la 2ª medición). `GILDARDO_QUERIES.md`.
15. **Supabase Pro + PITR** y backups externos (antes de datos clínicos reales). `BACKLOG.md` / `DEPLOY.md`.
16. **Separación operativo/clínico completa** (cerrar el `admin`-amplio sobre todo el contenido clínico identificado, mecanismo de grants). `BACKLOG.md` / `SECURITY.md` / `DATA_GOVERNANCE.md`.
17. **Cierre legal de `SECURITY.md` y `DATA_GOVERNANCE.md`** (consentimiento, retención, residencia, plazos SIC). `BACKLOG.md`.
18. **Verificación de residencia / DPA de Supabase** frente a la regulación colombiana de dato de salud. `BACKLOG.md`.
19. **El reporte del paciente entrega la LECTURA FUNCIONAL de los indicadores, no sigla + número crudo (P0, movido de BACKLOG 2026-08-01).** Cita textual de Gildardo (P0, 2026-07-30): *"el reporte del paciente lleva la lectura funcional de los indicadores con su clasificación y su interpretación en lenguaje llano"*. HOY lleva **sigla y número crudo** (IFC 5.26 · IRC 2.03 · …), sin las tres cosas. Qué falta: (a) la **clasificación** ya está sellada en el diagnóstico → barato; (b) la **referencia** existe (`indicator-ranges.ts`) → barato (IFC/IRC/FMI en "-" hasta Q20); (c) la **interpretación en lenguaje llano** la genera una **IA** en el HTML (no es texto estático), así que necesita construir el resumen IA para el paciente (infra B12/B14, apta-paciente y PII-free) + su muestra de estilo. Parte de la Parte 1 de P0 solo QUITÓ lo peligroso (EB/IAE); el documento aún no es el que Gildardo describió. `BACKLOG.md` (item T4 original, ahora apunta aquí).

## Ya cerrados (registro)

- **B15** — pulido/seguridad final del MVP de código (rate limit de grants, scrub PHI, checklist de seguridad + DPA, headers). `b15-status`.
- **Gate 2 · Bug D8** (2026-08-02) — autoenvío arreglado con `key` distintas, smoke de Santiago pasado. Follow-on abierto: e2e del wizard (no gate).
- **Gate 2bis-a · `dfi.complete` mide completitud real** (2026-08-02) — Opción A implementada, `missingFieldKeys` sellado, fail-loud, regresión verde. La mitad que ACTÚA (2bis-b) sigue abierta, espera Q28.
- **Gate 5 · Despliegue a la nube** (2026-08-07/08) — `atlas.cnvsystem.com` en producción, pago end-to-end en Wompi sandbox, nube limpia.
- **Gate 6 · Profesión al invitar + NOT NULL** (2026-08-05) — migración 0036.
- **Gate 10 · Seed no destructivo** (2026-08-07) — `SEED_DEMO=false`, nube sin datos demo.
- **Gate 10bis · "Olvidé mi clave" self-service** — enlace + correo + cambio con MFA, probado en la nube.

---

**Conteo de gates abiertos: Hito 1 = 4 · Hito 2 = 4 · Hito 3 = 8.** De los 4 del Hito 1, DOS están CONSTRUIDOS y solo esperan el smoke de Santiago (gate 1 corrección, gate 2bis-b suspensión Q28); los otros dos (gate 3 cotejo visual, gate 4 diseño gráfico) están abiertos de trabajo. (El 2026-08-02 se cerraron el gate 2/bug D8 y 2bis-a; el 2026-08-11/12 se CONSTRUYÓ 2bis-b, la suspensión Q28. Q8/Q14/P0 cerradas en decisión, pendientes de OK/re-port/trabajo; el gate de opción B se movió de Hito 3 a Hito 2; el gate 19, la lectura funcional del reporte, se movió de BACKLOG.) **Total ~19.** La matriz rol × hito se completa aquí cuando se decida por rol.
