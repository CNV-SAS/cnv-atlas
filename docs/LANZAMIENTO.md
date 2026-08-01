# LANZAMIENTO — Hitos y gates

**Qué es.** La lista que decide **cuándo se puede atender al primer paciente real** estaba dispersa en `BACKLOG.md` entre más de cien líneas. Este documento la consolida: **nombra cada gate y apunta al detalle**; el detalle sigue en `BACKLOG.md` (u otros docs). Fuente única de la definición de gates (supera a `MVP.md` para esto).

**Dos ejes (no una lista):** **qué rol** (profesional → admin → soporte → dirección → ObBIA) y **qué hito**. Los hitos son compuertas; cada rol tiene un mínimo distinto en cada una (la matriz rol × hito se completa aquí conforme se decida por rol; hoy el eje que aprieta es el del profesional).

| Hito | Qué es | Estado |
|---|---|---|
| **Hito 1** | Producto completo y pulido para el Integrante (sandbox de pagos, **sin pacientes reales**) | EN CURSO |
| **Hito 2** | Revisión de Integrantes (prueban en la nube, dan visto bueno) | pendiente |
| **Hito 3** | Operación con **pacientes reales** | pendiente |

> Regla: **cada gate se cierra antes de pasar su hito.** Un gate abierto en el Hito 3 significa que NO se puede atender al primer paciente real.

---

## Gates del Hito 1 (producto completo para el Integrante)

1. **Flujo de corrección post-diagnóstico** (versionar evaluación/diagnóstico/reporte sin sobrescribir). `BACKLOG.md`. Bloquea porque hoy confirmar es un callejón sin salida.
2. **Bug D8 de la encuesta** (auto-envío al llegar a Contexto Social → sección siempre incompleta en todos los pacientes). `BACKLOG.md`.
2bis. **`dfi.complete` mide presencia, no completitud** (hoy `complete = hay al menos un campo`, así que CUALQUIER encuesta parcial se sella como completa; el valor es inmutable con el snapshot de `reports`, no se corrige sin el flujo del gate 1). Es el mismo síntoma que D8 pero del diagnóstico: aunque se arregle el auto-envío, sin redefinir `complete` una encuesta corta seguiría sellándose completa. Debe cerrarse ANTES de sellar diagnósticos reales, porque el campo es de definición única y sellada. `BACKLOG.md`.
3. **Los cuatro bloques de pulido de fidelidad** (encuesta, evaluación, diagnóstico, tratamiento), cada uno con comparación crítica contra el HTML. `MAPA.md` / `BACKLOG.md`.
4. **Diseño gráfico coherente** de toda la app (al final del Hito 1, después de los cuatro bloques de pulido). `BACKLOG.md`.

## Gates del Hito 2 (revisión de Integrantes en la nube)

5. **Despliegue a la nube** (se construye en el Hito 1; es gate del Hito 2). `BACKLOG.md` / `DEPLOY.md`.
6. **Captura de la profesión al invitar + `profession` NOT NULL + backfill** (B1 lo volvió urgente: sin profesión no se trabaja el tratamiento). `BACKLOG.md`.
7. **Q19/Q20 — clasificación y fenotipo consistentes** (F1-F12 en Diagnóstico; y cuál clasificador manda, `cXXX` vs `dXXX`). Gildardo dijo "antes de abrirle Atlas a los integrantes". `GILDARDO_QUERIES.md`.
8. **Rótulo de la EB-BIS** ("no leer como edad fisiológica", indicación de Gildardo). `BACKLOG.md`.
9. **Aviso a los Integrantes del paso de confirmación del diagnóstico** (Atlas lo añade, el prototipo no lo tiene). `BACKLOG.md`.
10. **Seed no destructivo** en staging (no `pnpm db:seed`, que borra). `BACKLOG.md` / `INVENTARIO.md`.
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

---

**Conteo de gates abiertos: Hito 1 = 5 · Hito 2 = 7 · Hito 3 = 8** (Q8/Q14/P0 cerradas en decisión, pendientes de OK/re-port/trabajo; el gate de opción B se movió de Hito 3 a Hito 2; el gate 19, la lectura funcional del reporte, se movió de BACKLOG; el gate 2bis, `dfi.complete`, se agregó al Hito 1 el 2026-08-01). **Total ~20.** Se agregan/mueven conforme aparezcan; cada uno con su puntero al detalle. La matriz rol × hito (mínimo por rol en cada compuerta) se completa aquí cuando se decida por rol.
