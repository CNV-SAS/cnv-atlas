# MAPA.md · Dónde estamos

Mapa de una pantalla para orientarse en diez segundos. No es plan ni backlog: si algo tiene detalle, vive en `LANZAMIENTO.md` (gates), `BACKLOG.md` (diferido) o `docs/MVP.md` (histórico); aquí solo se nombra. Se actualiza al cerrar cada subtarea.

> **Estado de gates e hitos: la fuente es `LANZAMIENTO.md`.** Las menciones de "Hito N" o "gate" en este documento describen el TRABAJO; su ESTADO (abierto/cerrado), su HITO y el CONTEO son los que declara `LANZAMIENTO.md`. Si discrepan, gana `LANZAMIENTO.md`.

> ## 📍 AHORA: para la posición vigente en lenguaje llano, ver `ESTADO.md`; para el estado de cada gate por hito, `LANZAMIENTO.md`.
> (Las secciones de detalle de este mapa quedaron rezagadas respecto de esos dos docs; se conservan como orientación de estructura, no de estado.)

---

## Los tres hitos

Dos ejes, no una lista: **qué rol** (profesional → admin → soporte → dirección → ObBIA) y **qué hito** (construir → revisión de integrantes → pacientes reales). Los hitos son compuertas; cada rol tiene un mínimo distinto en cada una. **La tabla, el estado y el conteo por hito viven en `LANZAMIENTO.md` (fuente única); aquí solo se nombran los tres:** Hito 1 (producto para el integrante, sin pacientes reales), Hito 2 (revisión de integrantes en la nube), Hito 3 (pacientes reales).

## Qué falta dentro del Hito 1 (orientativo; el estado autoritativo por gate está en `LANZAMIENTO.md`)

- Superficies del profesional: **T2, T3, Plan alimentario, T4** y los cuatro motores de tratamiento.
- ~~Bug de auto-envío de la encuesta (D8)~~ **CERRADO (2026-08-02).** Flujo de corrección post-diagnóstico (sigue pendiente).
- **Seguimiento: NO es una fase sin construir; es una fase CONSTRUIDA esperando TRES frases (Q25).** El mecanismo ya existe (`followups/services/eb-trajectory.ts`): comparación entre evaluaciones, gate de 12 semanas, las tres bandas (mejoró/sin cambio/empeoró), corte provisional ±2. Está DESCONECTADO a propósito y lo único que espera es la redacción de los tres textos al paciente (Q25, autoría de Gildardo) y las dos decisiones clínicas que la acompañan. No confundir "espera a Gildardo" (tres frases) con "sin construir".
- Gate del generador de menú vs restricciones del modelo.
- Módulo de documentos del Integrante. Dashboards. Notificaciones. Admin mínimo para operar la revisión.
- **Pulido de fidelidad en CUATRO bloques** (decisión de Santiago, 2026-07-30): encuesta, evaluación, diagnóstico y tratamiento, cada uno con **comparación crítica contra el HTML de Gildardo** (fidelidad al modelo, no estética de marca). Van **después de terminar Tratamiento** y **antes** del diseño gráfico. Reemplazan la idea vieja de "un pulido general antes del diseño": ahora son cuatro, cada uno con su criterio propio por superficie.
- Diseño gráfico de toda la app: **al final del Hito 1**, sobre todas las pantallas juntas (no pulir sueltas sobre la marcha), DESPUÉS de los cuatro bloques de pulido de fidelidad.
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
| **A3** | Costura calórica completa: `motorProtocolo` frozen (A3.1) + cadena TS GOLDEN 1 (A3.2) + fenotipo F1-F12 (A3.4) + candado de versión + orquestador + sellado en el pipeline + `approveProtocol` (efectivo, dos versiones, dos fechas) | ✅ **T2a cerrado** |
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
- **DOC-4** `LANZAMIENTO.md` con los tres hitos de dos ejes + nota en `MVP.md`. **HECHO (2026-07-30):** creado con los gates consolidados por hito y punteros a `BACKLOG.md`; la matriz rol × hito se completa por rol conforme se decida. (El conteo vigente de gates abiertos por hito vive en `LANZAMIENTO.md`, no aquí.)

## Depende de Gildardo (no bloquea T2)

Respondió el extracto DOC-1. Bloquean el primer paciente real (Hito 3), no antes: firma del modelo de índices (Q8) y cuál modelo calórico es el vigente (Q14).
