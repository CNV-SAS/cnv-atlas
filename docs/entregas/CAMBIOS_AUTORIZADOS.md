# Registro de cambios autorizados (opción B)

**Qué es y por qué existe.** Gildardo autorizó (ronda 2) la **opción B**: para los cambios que tocan la ciencia, Atlas los implementa de su lado a partir de la **instrucción escrita** de Gildardo, con dos condiciones suyas: (1) cada cambio parte de una instrucción escrita con fórmula, condición y cortes explícitos; (2) **él lo aprueba, en lenguaje llano, ANTES de que entre a producción**.

Hasta ahora la garantía era **mecánica**: byte-identidad del frozen + golden contra su HTML. Para los cambios de opción B **no hay artefacto contra el cual comparar**: su instrucción escrita reemplaza al archivo y su aprobación reemplaza al golden. Es una garantía más débil, sostenida por disciplina. **Este registro ES ese reemplazo del golden**, no un documento administrativo: sin él, en seis meses nadie reconstruye por qué el sistema calcula lo que calcula.

---

## GATE DE LANZAMIENTO (Hito 3)

> **No se lanza a producción con ningún cambio de opción B sin la aprobación de Gildardo registrada aquí (estado `aprobado`).** La condición la puso él ("yo lo apruebo antes de que entre a producción"); este gate la hace verificable en vez de depender de que alguien la recuerde.

Cuando exista `docs/LANZAMIENTO.md` (hoy no existe, solo se referencia en MAPA/BACKLOG), este gate se copia allí como gate del Hito 3. Mientras tanto, vive aquí.

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

<!-- Próximas entradas conforme se implementen de opción B: cáncer-remisión (C, 3.2), y los C1-C13 que apliquemos de nuestro lado con su instrucción. Cada una con su fila de divergencia en INVENTARIO 0ter. -->
