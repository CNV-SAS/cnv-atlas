# Registro de cambios autorizados (opción B)

**Qué es y por qué existe.** Gildardo autorizó (ronda 2) la **opción B**: para los cambios que tocan la ciencia, Atlas los implementa de su lado a partir de la **instrucción escrita** de Gildardo, con dos condiciones suyas: (1) cada cambio parte de una instrucción escrita con fórmula, condición y cortes explícitos; (2) **él lo aprueba, en lenguaje llano, ANTES de que entre a producción**.

Hasta ahora la garantía era **mecánica**: byte-identidad del frozen + golden contra su HTML. Para los cambios de opción B **no hay artefacto contra el cual comparar**: su instrucción escrita reemplaza al archivo y su aprobación reemplaza al golden. Es una garantía más débil, sostenida por disciplina. **Este registro ES ese reemplazo del golden**, no un documento administrativo: sin él, en seis meses nadie reconstruye por qué el sistema calcula lo que calcula.

---

## Qué es "producción" (definición, para que el gate no sea ambiguo)

**Producción = cualquier despliegue accesible a Integrantes**, empezando por la **nube de revisión del Hito 2** (donde los Integrantes prueban y dan el visto bueno). **NO** es el commit, ni el entorno local de desarrollo, ni el DB demo local. Un cambio de opción B que está en un commit o en el DB local **todavía no está en producción**; lo estará cuando un Integrante pueda verlo. Esta definición existe porque sin ella "antes de producción" es ambiguo y se presta a que un cambio llegue a pantalla sin su visto bueno.

## GATE (Hito 2)

> **Ningún cambio de opción B llega a producción (definición de arriba) sin la aprobación de Gildardo registrada aquí (estado `aprobado`).** La condición la puso él ("yo lo apruebo antes de que entre a producción"); este gate la hace verificable en vez de depender de que alguien la recuerde.

**Por qué Hito 2 y no Hito 3:** los Integrantes revisan en el Hito 2, y ahí ya estarían viendo los cambios de opción B (sobre todo los que se COMPUTAN al mostrar, como la Δ, que aparecen en pantalla sin sellarse). Si Gildardo no los aprobó ANTES de esa revisión, se pierde el sentido de su condición. El gate vive también en `docs/LANZAMIENTO.md` como gate del Hito 2.

---

## Estados y regla de reversión

`implementado` (en el código, sin aprobar aún) · `pendiente de aprobación` (enviado a Gildardo) · `aprobado` (OK suyo con fecha) · `rechazado`.

**Regla de reversión (adición crítica):** implementamos PRIMERO y él aprueba DESPUÉS. Si **NO aprueba**, el cambio ya está en el código y hay que **revertirlo**; queda registrado aquí que se revirtió y por qué. Un cambio rechazado que se queda en el código es peor que no tener el registro.

**Cruce con divergencias (obligatorio):** todo cambio de opción B que toque el cálculo crea una fila en `docs/entregas/gildardo-2026-07/INVENTARIO.md` sección **0ter** (Atlas ⇄ archivo de Gildardo). Cada entrada de aquí apunta a su fila de divergencia y viceversa; si los dos documentos no se referencian, en tres meses uno miente.

---

## Registro

### CA-1 · Cintura: leer la medida, no el umbral

- **Instrucción de Gildardo (VERBATIM, `GILDARDO_RESPUESTA_2026-07-30` 3.3):** «Se corrige en mi archivo. El campo debe leer la circunferencia medida del paciente, no la columna del umbral de referencia de la OMS. La divergencia que ya introdujeron de su lado es la correcta. Con la corrección en mi archivo, las dos copias vuelven a coincidir.»
- **Qué implementamos:** la entrada `cintura` de `src/clinical-engine/edge/biody-columns.ts` quedó **eliminada** (apuntaba al umbral `REFERENCEESTIMEE`); la circunferencia MEDIDA vive en `src/modules/bis/services/header-map.ts` (`"Waist Size cm"`). Commit `a2d2832` (previo a esta ronda).
- **Descripción devuelta a Gildardo:** «El campo de cintura tomaba el umbral de referencia (102 cm, igual para todos) en vez de la medida real; ya lo corregimos de nuestro lado eliminando ese mapeo.»
- **Aprobación:** Gildardo, 2026-07-30 (respuesta 3.3: "la divergencia que ya introdujeron de su lado es la correcta").
- **Estado:** **aprobado.**
- **Divergencia:** `INVENTARIO.md` 0ter, fila "Cintura". **OJO:** su archivo actual (`gildardo-2026-07-30`) TODAVÍA lee el umbral en la línea 5600; dice que lo corrigió pero no está (Q18). La divergencia sigue vigente hasta que su archivo la traiga; no reponer la entrada al portar.

### CA-2 · Columna Δ: definición única (valor − referencia de normalidad)

- **Instrucción de Gildardo (VERBATIM, `GILDARDO_RESPUESTA_..._TERCERA_RONDA (1).md` punto 4):** «Decisión: una sola definición, para todas las fórmulas y todos los indicadores. **Δ = valor obtenido − referencia de normalidad.** Cuando la referencia es un rango con dos bordes, la referencia es el **promedio del rango**. Cuando la referencia es un corte único, sin segundo borde, la referencia es **el corte**. […] esta regla sustituye el comportamiento del archivo HTML. Es una divergencia deliberada y debe quedar documentada como tal, no corregida hacia el archivo. […] un paciente dentro de rango pero por debajo del promedio pasa a mostrar Δ negativo donde antes mostraba cero. Conviene una prueba de regresión sobre el caso de referencia antes de publicar.»
- **Qué implementamos (2026-08-01, código HECHO):** `indicator-ranges.ts` recalcula la Δ = valor − referencia de normalidad (promedio del rango si tiene dos bordes; el corte si es de un solo límite), reemplazando la regla del HTML (borde clínicamente relevante por indicador). Efecto sobre el donante golden: **cambian AF** (−0.70 → −0.95, promedio 6.75 en vez del borde 6.5), **ISCM** (−2.07 → −1.07, corte −1 en vez del valor crudo) y **FFMI** (4.10 → 0.10, promedio 21 en vez del borde 17); el resto no cambia (su referencia de normalidad ya coincidía). Los tres bloqueados por Q20 (IFC/IRC/FMI) siguen en "-". **Regresión documentada** en `src/tests/indicator-ranges.test.ts` (bloque "regresion Δ sobre el donante golden", antes→después). Commit de código en el árbol (sin pushear).
- **Descripción devuelta a Gildardo:** «Unificamos la Δ a valor − referencia (promedio del rango, o el corte cuando hay un solo límite), reemplazando la regla del archivo. En el caso de referencia cambian AF, ISCM y FFMI; documentamos la divergencia y corrimos la regresión.»
- **Nota para su aprobación (dos efectos de la regla, verificados 2026-08-01):**
  1. **Rango ancho:** la regla del promedio hace que un rango ANCHO produzca Δ grandes en los bordes aunque el valor esté DENTRO de rango. Caso: **FFMI (17–25)**: un FFMI en el borde (17 o 25), clínicamente normal, muestra Δ ∓4; un paciente normal-pero-limítrofe vería "−4"/"+4", que puede leerse alarmante sin serlo. **IAE (−5 a +5)**: ±5 en el borde.
  2. **Corte único con tres bandas (indicador AEC/MCA, C12):** los cortes son <0.45 Óptimo, ≤0.55 Alerta, >0.55 Riesgo, y la Δ se calcula contra 0.45. Un paciente en **0.50 está en Alerta** (no en Riesgo), pero su **Δ sale POSITIVA (+0.05)**, como si se hubiera pasado del límite. Es la regla aplicada a un indicador con banda intermedia y corte único. Ejemplo real (donante golden): AEC/MCA 0.462, clasificación **Alerta**, Δ **+0.012**.
  - Ninguno es un error (es su regla); se señalan para que los considere al aprobar. AF (rango 0.5) y los de corte único de dos bandas no tienen estos efectos.
- **Aprobación:** **APROBADA por Gildardo (cuarta ronda 2026-08-02, `GILDARDO_RESPUESTA_2026-08-02.md` punto 2), CON una condición de presentación:** «La Delta se muestra siempre acompañada de la referencia contra la cual se calculó, y la Delta **no lleva color, flecha ni marca de alerta por sí misma**. La condición de normalidad la fija su clasificador, nunca la magnitud de la diferencia.»
- **Verificación de cumplimiento de la condición (2026-08-02, sin cambios de código necesarios):** Atlas YA cumple. En las dos tablas con columna Δ (`evaluation-results.tsx:404-409` y `composition-section.tsx:185-187`) la celda Δ es `text-muted-foreground` **sin color, flecha ni marca condicional**; la Δ siempre lleva su columna **Referencia** al lado; y el color (punto/celda de severidad) vive en la columna **Clasificación/Diagnóstico**, alimentado por el clasificador sellado (`indicatorSeverities(snapshot)`, `DiagnosisCell`), **no por la magnitud de la Δ**. El color de AF/IR que se cableó vive en la clasificación, no en la Delta. Nada que quitar.
- **Estado:** **APROBADA con condición (cumplida).**
- **Sella-vs-computa (efecto RETROACTIVO, escrito a propósito):** la Δ **se computa al mostrar, NO se sella** (es ayuda de lectura, no valor clínico). Consecuencia: el cambio es **retroactivo**, cambia la Δ mostrada en **diagnósticos YA emitidos**, no solo en los nuevos. Con demo da igual (nadie más entra). Con **pacientes reales**, un profesional vería **números distintos de un día para otro sin que nada cambiara en el paciente**, y no habría forma de explicárselo: por eso el gate del Hito 2 (aprobación de Gildardo ANTES de que un Integrante lo vea) importa más para los cambios que se COMPUTAN que para los que se sellan. Es la misma familia del criterio sella-vs-computa (ARCHITECTURE). Aceptable porque la Δ es apoyo, no prescripción, y el valor+clasificación sellados no cambian. **NO agrega clave a emission_versions.**
- **Divergencia:** `INVENTARIO.md` 0ter, fila "Delta".

<!-- Próximas entradas conforme se implementen de opción B: cáncer-remisión (C, 3.2), y los C1-C13 que apliquemos de nuestro lado con su instrucción. Cada una con su fila de divergencia en INVENTARIO 0ter. -->
