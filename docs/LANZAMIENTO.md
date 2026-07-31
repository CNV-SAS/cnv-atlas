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
3. **Los cuatro bloques de pulido de fidelidad** (encuesta, evaluación, diagnóstico, tratamiento), cada uno con comparación crítica contra el HTML. `MAPA.md` / `BACKLOG.md`.
4. **Diseño gráfico coherente** de toda la app (al final del Hito 1, después de los cuatro bloques de pulido). `BACKLOG.md`.

## Gates del Hito 2 (revisión de Integrantes en la nube)

5. **Despliegue a la nube** (se construye en el Hito 1; es gate del Hito 2). `BACKLOG.md` / `DEPLOY.md`.
6. **Captura de la profesión al invitar + `profession` NOT NULL + backfill** (B1 lo volvió urgente: sin profesión no se trabaja el tratamiento). `BACKLOG.md`.
7. **Q19/Q20 — clasificación y fenotipo consistentes** (F1-F12 en Diagnóstico; y cuál clasificador manda, `cXXX` vs `dXXX`). Gildardo dijo "antes de abrirle Atlas a los integrantes". `GILDARDO_QUERIES.md`.
8. **Rótulo de la EB-BIS** ("no leer como edad fisiológica", indicación de Gildardo). `BACKLOG.md`.
9. **Aviso a los Integrantes del paso de confirmación del diagnóstico** (Atlas lo añade, el prototipo no lo tiene). `BACKLOG.md`.
10. **Seed no destructivo** en staging (no `pnpm db:seed`, que borra). `BACKLOG.md` / `INVENTARIO.md`.

## Gates del Hito 3 (pacientes reales)

11. **Q8 — firma del modelo de índices** (Gildardo confirma que la EB-BIS v5 vigente es la definitiva). `GILDARDO_QUERIES.md`. **CERRADA** (respondió), pendiente solo su OK formal.
12. **Q14 — modelo calórico vigente** (el tercero: peso meta + estrategia por condición + fórmula P1). `GILDARDO_QUERIES.md`. **CERRADA** en decisión; el re-port depende de P1.
13. **P0 — presentación de la edad biológica** (Gildardo decide entre sus tres o la 4ª propuesta). `GILDARDO_QUERIES.md`.
14. **Gate de aprobación de Gildardo para los cambios de opción B** (él aprueba antes de producción). `docs/entregas/CAMBIOS_AUTORIZADOS.md`.
15. **Supabase Pro + PITR** y backups externos (antes de datos clínicos reales). `BACKLOG.md` / `DEPLOY.md`.
16. **Separación operativo/clínico completa** (cerrar el `admin`-amplio sobre todo el contenido clínico identificado, mecanismo de grants). `BACKLOG.md` / `SECURITY.md` / `DATA_GOVERNANCE.md`.
17. **Cierre legal de `SECURITY.md` y `DATA_GOVERNANCE.md`** (consentimiento, retención, residencia, plazos SIC). `BACKLOG.md`.
18. **Verificación de residencia / DPA de Supabase** frente a la regulación colombiana de dato de salud. `BACKLOG.md`.

## Ya cerrados (registro)

- **B15** — pulido/seguridad final del MVP de código (rate limit de grants, scrub PHI, checklist de seguridad + DPA, headers). `b15-status`.

---

**Conteo de gates abiertos: Hito 1 = 4 · Hito 2 = 6 · Hito 3 = 8** (Q8/Q14 cerradas en decisión, pendientes de OK/re-port). **Total ~18.** Se agregan/mueven conforme aparezcan; cada uno con su puntero al detalle. La matriz rol × hito (mínimo por rol en cada compuerta) se completa aquí cuando se decida por rol.
