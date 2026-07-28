# MAPA.md · Dónde estamos

Mapa de una pantalla para orientarse en diez segundos. No es plan ni backlog: si algo tiene detalle, vive en `LANZAMIENTO.md` (gates), `BACKLOG.md` (diferido) o `docs/MVP.md` (histórico); aquí solo se nombra. Se actualiza al cerrar cada subtarea.

> ## 📍 AHORA: Hito 1, Tratamiento T2, subtarea A3 (costura del motor calórico).
> A1 (`profession`) y A2 (migración + writer + policy + trigger de inmutabilidad) cerrados y comiteados. A3 es la pieza grande: portar `motorProtocolo` a `frozen/` verbatim + la cadena aritmética como TS nuestro, con golden. El `approveProtocol` (sella el set efectivo) va aquí, porque necesita el motor.

---

## Los tres hitos

Dos ejes, no una lista: **qué rol** (profesional → admin → soporte → dirección → ObBIA) y **qué hito** (construir → revisión de integrantes → pacientes reales). Los hitos son compuertas; cada rol tiene un mínimo distinto en cada una. Tabla completa en `LANZAMIENTO.md`.

| Hito | Qué es | Estado |
|---|---|---|
| **Hito 1** | Producto completo y pulido para el Integrante (sandbox de pagos, sin pacientes reales) | **EN CURSO** |
| **Hito 2** | Revisión de Integrantes (prueban en la nube, dan visto bueno) | pendiente |
| **Hito 3** | Operación con pacientes reales | pendiente |

## Qué falta dentro del Hito 1

- Superficies del profesional: **T2, T3, Plan alimentario, T4** y los cuatro motores de tratamiento.
- Despliegue a la nube (es gate del Hito 2, pero se construye aquí). Ver `BACKLOG.md`.
- Bug de auto-envío de la encuesta (D8). Flujo de corrección post-diagnóstico.
- Gate del generador de menú vs restricciones del modelo.
- Módulo de documentos del Integrante. Dashboards. Notificaciones. Admin mínimo para operar la revisión.
- Diseño gráfico de toda la app: **al final del Hito 1**, sobre todas las pantallas juntas (no pulir sueltas sobre la marcha).
- Revisión técnica interna de Gildardo del flujo, antes de pulir el diseño.

## Los cinco bloques de Tratamiento

| Bloque | Qué es | Estado |
|---|---|---|
| **T1** | Rutas de atención + Remisiones | ✅ hecho, pusheado |
| **T2** | Tabla de Wang, Nivel IV apartados A/B/D (protocolo y fórmula), por especialidad | **EN CURSO** |
| **T3** | Nutracéuticos priorizados + despacho | pendiente |
| **Plan alimentario** | Nivel IV apartados E/F (plan por grupos + menú). Antes se llamaba "T5"; sin número | pendiente |
| **T4** | Reportes (apartado propio con generación por checklist) | pendiente |

Secuencia: T2 → T3 → Plan alimentario → T4.

## Qué es la tabla de Wang

El tratamiento organizado por la jerarquía de composición corporal, en niveles: **II molecular, III celular, IV tejidos y sistemas, V cuerpo entero**. El **Nivel IV** tiene apartados **A a F**: A resumen clínico, B protocolo sugerido, D fórmula sintética, E fórmula desarrollada, F menú semanal (no hay apartado C; la letra salta B→D). **T2 construye A, B y D; E y F son el bloque Plan alimentario.**

## Desglose de T2

**T2a (cimiento):**
| Sub | Qué hace | Estado |
|---|---|---|
| **A1** | Campo `profession` (lista cerrada) que gobierna la subpestaña por especialidad | ✅ hecho, comiteado (sin push) |
| **A2** | Migración de `treatments` (sellado sugerido + aprobado, ajustes, aprobación) + writer/policy/trigger | ✅ hecho (schema + writer + policy + trigger) |
| **A3** | Costura calórica: `motorProtocolo` a `frozen/` + la cadena aritmética como TS nuestro, con golden; incluye `approveProtocol` (sella el efectivo) | **AHORA** |
| **A4** | Registrar hallazgos E/F como Q12/Q13 en la bitácora | ✅ hecho |

**T2b (superficie):**
| Sub | Qué hace | Estado |
|---|---|---|
| **B0** | Reconocer el Nivel IV completo | ✅ hecho (no hay apartado C; estructura A/B/D/E/F) |
| **B1** | Navegación de subpestañas por profesión | pendiente |
| **B2** | La tabla de Wang, apartados A-D, con fidelidad visual | pendiente (necesita capturas de Niveles II, III, V) |
| **B3** | Absorber el panel de "Objetivos nutricionales" de B13 | pendiente |

## Tareas doc-only (renombradas D1-D4 → DOC-1 a DOC-4)

- **DOC-1** ✅ extracto de pendientes para Gildardo (enviado 2026-07-27).
- **DOC-2** regla de anonimización en `BACKLOG.md`. pendiente.
- **DOC-3** línea de Aminogram en reportes + retirar el handoff a `BACKLOG`/`CLAUDE.md`. pendiente.
- **DOC-4** `LANZAMIENTO.md` con los tres hitos de dos ejes + nota en `MVP.md`. pendiente.

## Depende de Gildardo (no bloquea T2)

Respondió el extracto DOC-1. Bloquean el primer paciente real (Hito 3), no antes: firma del modelo de índices (Q8) y cuál modelo calórico es el vigente (Q14).
