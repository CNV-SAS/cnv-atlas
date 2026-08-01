# Paquete de revisión para Dirección Científica (Gildardo) — 2026-08-01

**Para qué es este documento.** Pediste ver el estado de tus decisiones (C1-C13) y de los puntos P0-P3 "como los tienen ustedes", para revisarlos completos antes de firmar. Esto es eso: un resumen en lenguaje llano de en qué quedó cada cosa, y **qué te toca aprobar**. No es para auditar código; las referencias técnicas (archivo y línea) van al final, en un anexo, por si las quieres.

Está organizado en cuatro partes:
1. Tus decisiones C1-C13 (dónde está cada una).
2. Los puntos P0, P1, P2, P3.
3. Lo que te toca aprobar (CA-1 y CA-2).
4. Anexo técnico (referencias).

---

## 1. Tus decisiones C1-C13

Fuente: tu documento **`Decisiones_ANI-BIS-E_2026-07-29`** (está en el repositorio, `docs/entregas/Decisiones_ANI-BIS-E_2026-07-29.docx`). Autorizaste que las apliquemos de nuestro lado a partir de tu instrucción escrita (opción B), sin editar tu archivo. Revisamos las trece contra tu propio estándar (que cada una traiga fórmula, condición y cortes explícitos). Quedaron en tres grupos:

**a) Nueve están claras y listas para implementar** (la lógica está en tu código, solo hay que portarla de nuestro lado):
- **C1** — mapeo del índice contextual.
- **C3** — rutas del Diagnóstico Funcional Integrado (DFI).
- **C4** — corregir cuatro usos de un mismo valor.
- **C5** — retirar predicados que hoy no hacen nada (inertes).
- **C7** — retirar la estrategia calórica por fenotipo.
- **C8** — el rótulo de la fórmula calórica (Cunningham vs Mifflin).
- **C9** — quince grupos de frecuencia en el patrón alimentario.
- **C10** — la fila "TOTAL" de la tabla.
- **C12** — AEC/MCA: verificamos que tu código SÍ la calcula (creíamos que era solo de pantalla; no lo es), así que es portable.

Estas están **pendientes de que las implementemos** de nuestro lado; ninguna está bloqueada. Se harán en su turno.

**b) Dos no son fórmulas, son de proceso** (cómo se versiona un cambio para no reescribir lo ya emitido):
- **C2** y **C2b** — reemitir con número de versión, sin sobrescribir un diagnóstico ya entregado. Ya tenemos el mecanismo (las "versiones de emisión"); no requieren decisión clínica tuya.

**c) Tres están DEVUELTAS: esperan una decisión tuya antes de poder implementarse:**
- **C6** (gasto basal y proteína sobre el peso meta) — **depende de P1.** Tú mismo lo marcaste. Con P1 ya cerrado (abajo), C6 se puede destrabar cuando confirmemos un detalle (ver P1).
- **C11** (exponer los rangos de referencia "por indicador y sexo") — **es la contradicción Q20.** Tu instrucción pide *por sexo*, pero cita la tabla de tu prototipo, que NO es por sexo. Necesitamos que confirmes cuál manda (el clasificador del motor, que es por sexo, o el de la tabla). Mientras tanto, tres indicadores (IFC, IRC, FMI) muestran "-" en vez de un rango que se leería al revés.
- **C13** (nutracéuticos por ruta) — **espera P2** (tu autoría de la tabla de nutracéuticos por ruta).

---

## 2. Puntos P0, P1, P2, P3

- **P0 — Presentación del EB-BIS: CERRADO** (lo cerraste en tu último documento). Registrado y en cola de implementación: la cifra nunca va al reporte del paciente; el profesional la ve con marca de "calibración provisional"; desde la segunda medición al paciente se le muestra el cambio (mejoró / sin cambio / empeoró), no el nivel, con intervalo mínimo de 12 semanas. **Una sub-pregunta que tu regla abre y no resuelve:** si dos mediciones están a menos de 12 semanas, ¿qué ve el paciente? (nada, o el mismo contenido que en la primera medición). Es decisión de producto; la dejamos anotada.
- **P1 — Gasto basal sobre el peso de referencia: CERRADO en decisión.** Entendido: se prescribe con Mifflin sobre el peso de referencia, sin déficit adicional; Cunningham sobre el peso medido queda como dato informativo para el profesional. **La implementación está en pausa** hasta que aclaremos contigo una ambigüedad (Santiago te la lleva). De P1 depende C6 y también qué diferencia real queda entre cáncer activo y en remisión (al desaparecer el hipercalórico para todos, "la remisión no activa el hipercalórico" cambia de significado).
- **P2 — Tabla de nutracéuticos por ruta: PENDIENTE de tu autoría** (la marcaste "autoría, sin fecha"). Bloquea C13.
- **P3 — Secciones 4, 5 y 6 del Manual de Tratamiento DFI: PENDIENTE de tu autoría** (autoría, sin fecha).

---

## 3. Lo que te toca aprobar

Bajo opción B, nosotros implementamos y **tú apruebas en lenguaje llano ANTES de que entre a producción** (es decir, antes de que un Integrante lo vea; en tu revisión del Hito 2). Si no apruebas, se revierte. Hoy hay dos cambios en este registro:

- **CA-1 · Cintura: leer la medida, no el umbral. YA APROBADO** (tu respuesta del 2026-07-30). El campo de cintura tomaba el umbral de referencia de la OMS (102 cm, igual para todos) en vez de la medida real del paciente; ya lo corregimos. Nada que hacer de tu parte; queda como registro.
- **CA-2 · La columna Δ (diferencia): PENDIENTE DE TU APROBACIÓN.** Unificamos la Δ a una sola definición: **valor obtenido − referencia de normalidad** (el promedio del rango si tiene dos bordes; el corte si es de un solo límite), reemplazando la regla de tu prototipo (que restaba un borde distinto por indicador). Es una divergencia deliberada, tal como la pediste. Corrimos la regresión que pediste sobre el caso de referencia: cambian tres indicadores (AF, ISCM, FFMI); el resto no. **Un detalle para que lo consideres al aprobar:** en un rango ancho (por ejemplo FFMI 17-25), un paciente dentro de rango pero cerca de un borde muestra una Δ grande (hasta ±4), que puede parecer alarmante sin serlo. No es un error, es la consecuencia de la regla; te lo señalamos por si quieres ajustarla.

---

## 4. Anexo técnico (solo referencias, por si las quieres)

- Registro completo y verificable de CA-1 y CA-2: `docs/entregas/CAMBIOS_AUTORIZADOS.md`.
- Estado detallado de C1-C13, P0-P3 y las preguntas abiertas (Q8, Q14, Q19, Q20, Q22, Q23): `docs/GILDARDO_QUERIES.md`.
- Tu documento de decisiones: `docs/entregas/Decisiones_ANI-BIS-E_2026-07-29.docx`.
- La regresión de la Δ (antes → después sobre el donante golden): `src/tests/indicator-ranges.test.ts`.

**Preguntas abiertas que también esperan tu respuesta** (registradas en `GILDARDO_QUERIES.md`): **Q20** (cuál clasificador manda, toca C11), **Q22** (qué puede hacer un médico o un deportólogo dentro del modelo), **Q23** (cómo funciona la remisión).
