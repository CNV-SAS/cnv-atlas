# INVENTARIO — Entrega de Gildardo 2026-07

**Fecha del inventario:** 2026-07-24
**Alcance:** solo inventario y reporte. Nada de esta entrega se aplicó, sembró ni portó. Los `.js` nuevos NO entraron a `src/clinical-engine/frozen/`; viven en esta carpeta de entrega hasta que su swap sea su propio bloque.

---

## 0. Nomenclatura del HTML (rename)

- **`ATLAS.html`** (este paquete, `docs/entregas/gildardo-2026-07/ATLAS.html`, 16.724 líneas): el **estado actual** del prototipo de Gildardo. De aquí en adelante, "el HTML de referencia" es este archivo con este nombre. Las referencias futuras apuntan a `ATLAS.html`.
- **`reference/ATLAS_v7.html`** (16.878 líneas): la **referencia histórica** de lo ya portado. El motor congelado (`src/clinical-engine/frozen/*.js`) se extrajo verbatim de este archivo en B11. Los encabezados de los `.js` congelados citan `ATLAS_v7.html` a propósito, porque ese fue su byte-source. No se tocan (regla dura 16).

En resumen: `ATLAS_v7.html` = de dónde salió lo congelado; `ATLAS.html` = el estado más nuevo, para lo que venga. Son dos archivos distintos con dos roles distintos.

**AVISO CRÍTICO (2026-07-29): los DOCUMENTOS de Gildardo llaman "ATLAS_v7.html" al artefacto ACTUAL, no a nuestro `reference/ATLAS_v7.html` (16.878, el viejo de B11).** Gildardo llama `ATLAS_v7.html` a TODOS sus archivos ("v7" es la generación del modelo, no la versión del archivo). Santiago renombró la entrega de julio a `ATLAS.html` para no colisionar con el `reference/ATLAS_v7.html` que ya existía. La desambiguación NO puede ser por el nombre (no carga versión): es por **ruta + conteo de líneas** (huella digital). Riesgo si se confunde: leer el archivo equivocado con las líneas cayendo en contenido plausible pero distinto (familia del bug de cintura: dato correcto, fuente equivocada, sin error visible). Como `reference/` está gitignored (local, no versionado), ESTE INVENTARIO (commiteado) es la fuente de verdad de la desambiguación; NO se renombra `reference/ATLAS_v7.html` (renombrar es una acción local que no propaga por git, y dejaría stale la cita de los encabezados de frozen de B11, que apuntan a ese archivo como su byte-source real; ver ARCHITECTURE regla 17).

**CORRECCIÓN (2026-07-30, escenario C): la afirmación de este aviso de que las líneas del `Decisiones_ANI-BIS-E_2026-07-29` "aplican al archivo de la entrega de julio (16.724)" resultó FALSA.** La prueba de identidad de la segunda ronda mostró que esas líneas (14077, 14088, 6529, 12828, entre las ~veinte que cita) NO caen sobre el contenido que el documento describe en NINGUNO de los dos archivos que tenemos (ni 16.878 ni 16.724), con desfases inconsistentes (ARCHITECTURE, lección del port por número de línea; `GILDARDO_QUERIES.md`, escenario C). El documento cita un archivo POSTERIOR a la entrega de julio. **RESUELTO (2026-07-30): ese archivo llegó** (`docs/entregas/gildardo-2026-07-30/ATLAS_v7.html`, 17.923 líneas) y **la prueba de identidad PASÓ**: las líneas 14077/14088/6529/12828 del `Decisiones_2026-07-29` caen sobre lo que el documento describe (motor nutricional, GEB Mifflin sobre peso medido, interruptor del índice contextual, rangos de referencia). Las referencias de línea del `Decisiones_2026-07-29` se resuelven en ESE archivo (17.923), no en 16.724 ni 16.878. Ver la tabla de resolución abajo, tercera fila.

---

## 0bis. Tabla de resolución de archivos de Gildardo

Para cualquier referencia de línea de un documento de Gildardo, esta tabla dice EN QUÉ ARCHIVO resolverla. El nombre no desambigua (todos se llaman `ATLAS_v7.html` para él); el **conteo de líneas** es la huella digital rápida. Convención (ARCHITECTURE regla 17): cada archivo nuevo entra en su carpeta `docs/entregas/gildardo-YYYY-MM-DD/` con la fecha del día, conservando el nombre original, y agrega una fila aquí.

| Entrega | Ruta en el repo | Líneas | Qué lo cita (encabezados de custodia) | Referencias de línea que le corresponden |
|---|---|---|---|---|
| B11 (portado 2026-07-06) | `reference/ATLAS_v7.html` (gitignored, local) | 16.878 | los 3 `.js` de `frozen/`: `engine.core.js`, `engine.indices.js`, `engine.dfi.js` | el port de B11 (los encabezados de esos `.js` y `MAPA-FUNCIONES.md` de B11 citan líneas de ESTE archivo) |
| 2026-07-24 | `docs/entregas/gildardo-2026-07/ATLAS.html` | 16.724 | `frozen/atlas-protocolo.js` (byte-source, `motorProtocolo` L13532-13603, copiado 2026-07-28) | los docs de esta misma entrega: `MAPA-FUNCIONES.md`, `CHANGELOG.md` y este INVENTARIO (p. ej. L5706-5729 indicadores, L10444-10480 condiciones BIS) |
| 2026-07-30 | `docs/entregas/gildardo-2026-07-30/ATLAS_v7.html` (nombre original preservado) | 17.923 | re-port T2b (en curso): motor nutricional, rangos por indicador, secciones médica/ejercicio | `Decisiones_ANI-BIS-E_2026-07-29`. **Prueba de identidad PASÓ (2026-07-30):** 14077 = `motorTratNutri` (motor nutricional); 14088 = GEB Mifflin sobre peso medido; 6529 = `LE8_MAPEO_CORREGIDO` (interruptor del índice contextual); 12828 = fila IMC (rangos de referencia Nivel V). El re-port se reanuda desde ESTE archivo |

---

## 1. Qué es cada archivo

### 7 módulos `.js` (extraídos del HTML para migrar a software en línea)

| Archivo | Contenido | Export final (ES module) |
|---|---|---|
| `atlas-core-indices.js` | Clasificadores por índice + `calcPABU` (base, sin dependencias) | `calcPABU, cIFC, cIRC, cPABU, cAF, cIR, cISCM, cIEHH, cIAE, cFMI, cFFMI, cSMM, cASMI` |
| `atlas-encuesta-patron.js` | Grupos de frecuencia (GABA/ICBF, 15 grupos), `catLabel`, `calcPatron` | `FREQ_GROUPS, catLabel, calcPatron` |
| `atlas-dfi.js` | Motor DFI + adaptador + rutas (+ nuevo `parrafo` y `metas` por rol) | `computeDFI, computeDFIFromData, RUTAS, rutasActivasDFI` |
| `atlas-resumen-clinico.js` | Párrafos de resumen por profesión | `_resumenNutriParrafo, _resumenMedicoParrafo, _resumenEjercicioParrafo, _resumenPsicoParrafo` |
| `atlas-motores-tratamiento.js` | 4 motores deterministas de tratamiento | `motorTratNutri, motorTratMedico, motorTratEjercicio, motorTratPsico` |
| `atlas-lista-intercambio.js` | Lista de intercambio UdeA/ICBF 2025 (12 grupos, 350 alimentos) | `INTER_GRUPOS, INTER_TABLA_A, INTER_TABLA_B` |
| `atlas-menu-ciclo.js` | Ciclo de 21 menús en medidas caseras | `CICLO_MENU_21` |

### Docs de orientación
- `LEEME.md`, `CHANGELOG.md`, `MAPA-FUNCIONES.md` (línea de cada función en el HTML), `diff-indicadores.md`.

### HTML
- `ATLAS.html` (ver punto 0).

### Bundle atlas-gil (carpeta `atlas-gil/`)
- `atlas-gil-encuesta-3commits (1).bundle` + `atlas-gil-encuesta-INSTRUCCIONES-Santiago (2).txt`. Es para el repo `CNV-SAS/atlas-gil` (divergente). NO se hace merge ni cherry-pick aquí; se trata como especificación (ver punto 5).

---

## 2. El "frozen delta": las fórmulas NO cambiaron. La entrega no es el paquete que pedimos

### 2.1 EB-BIS y el bloque de indicadores: CERRADO, sin acción

**Verificación verbatim.** El bloque de cálculo de indicadores del HTML entregado (`ATLAS.html` L5706-5729) es **byte-idéntico** en coeficientes al motor congelado vigente (`src/clinical-engine/frozen/engine.indices.js`). El frozen vigente **ya calcula la EB-BIS v5**, no hace falta swap ni cambio de valores.

**EB-BIS v5, coeficientes anclados en ambos lados:**

| Término | Coef. | media (μ) | desv. (σ) |
|---|---|---|---|
| constante | 41.438 | | |
| IFC (función celular) | +1.082 | 4.0146 | 2.2669 |
| PABU (equilibrio áureo) | +2.837 | 1.8303 | 0.7741 |
| ICEC/LE8 (contextual) | -7.982 | 58.578 | 13.332 |

- Frozen: `engine.indices.js` L34-41 (`computeEBBIS`), con la guarda deliberada `if (icec == null) return null`.
- HTML entregado: `ATLAS.html` L5706-5729.
- ISCM, IEHH e IAE: también idénticos (mismas medias/desv), frozen `engine.indices.js` L14-47 vs HTML `ATLAS.html` L5706-5729.

**Conclusión:** no hay frozen delta de EB-BIS. No se regenera golden ni Demo GoldenPath por este motivo. Solo queda pendiente la **confirmación formal de Gildardo** de que la v5 del frozen vigente es la definitiva (verificación técnica ya hecha de nuestro lado). Actualizado en `GILDARDO_QUERIES.md` (Q8) y `BACKLOG.md`.

### 2.2 `diff-indicadores.md` NO es un cambio de fórmula

Es un **filtro visual del Reporte/HC**: mostrar solo los índices alterados (naranja/rojo/azul) y ocultar los normales. Vive en el componente `ModReporteHC` del HTML, sección 4. No toca la matemática. El módulo de Diagnóstico/composición NO se filtró. Es UI a portar, no ciencia.

### 2.3 Contra los 4 pedidos de `FROZEN_EXPORTS_REQUEST.md`

Lo entregado **no es** el paquete de custodia que pedimos (un `engine.core.js` nuevo con los nombres agregados a `module.exports`). Es una **re-extracción más amplia** en 7 módulos ES para migrar el HTML a software en línea. Cobertura de los 4 pedidos:

| Pedido | Estado en la entrega |
|---|---|
| 1. `efrProf` (abordaje por profesión) | **NO expuesto** como export dedicado. PERO la función existe en nuestro frozen (`engine.core.js` L807), ver punto 6. |
| 2. 6 funciones (`efrProf`,`cSMM`,`cMMEM`,`cASMI`,`cFFW`,`cEISG`) | En la entrega solo `cSMM`,`cASMI` (en `atlas-core-indices.js`). PERO las 6 existen en nuestro frozen `engine.core.js`, ver punto 6. |
| 3. Patrón alimentario | **SÍ llegó** (`atlas-encuesta-patron.js`: `FREQ_GROUPS` 15 grupos, `calcPatron`). |
| 4. Función de rangos (lo/hi por indicador×sexo) + decisión Δ | **NO llegó.** Los clasificadores devuelven `{label,color}` con los umbrales como literales embebidos, no exponen lo/hi. Ver punto 6c. |
| Extra: `dAECMCA` (AEC/MCA) | **NO llegó.** Sigue render-only inline en el HTML (`ATLAS.html` ~L12297), no está en ningún módulo ni en el frozen. Ver punto 6c. |

### 2.4 Lo EXTRA que trajo (necesario para Diagnóstico/Tratamiento)

Además de lo pedido, la entrega trae piezas nuevas para otras pestañas:
- **DFI:** `computeDFI` ahora devuelve `parrafo` (DFI redactado) y `metas` por rol.
- **4 motores de tratamiento** (`motorTratNutri/Medico/Ejercicio/Psico`): modelo calórico Mifflin-St Jeor × factor de actividad **prescrito**, déficit editable, FITT-VP, clearance ACSM, SCOFF/PHQ-9/GAD-7. Es el rediseño de la pestaña Tratamiento.
- **Resumen clínico** por profesión (4 párrafos).
- **Lista de intercambio** (UdeA/ICBF 2025) y **ciclo de 21 menús** en medidas caseras.

Todo esto son bloques propios posteriores (Tratamiento, Diagnóstico de encuesta), ahora con especificación en mano.

---

## 3. Cambios del HTML vs `ATLAS_v7.html`

### (a) Lista de condiciones de la toma BIS (impacta el bloque B en curso)

Fuente autoritativa: `ATLAS.html` L10444-10480 (componente `ModVerificacionCondiciones`). La lista real **difiere de la v1 que íbamos a sembrar**:

**8 generales:**
1. `placasMetalicas` — "¿Cuenta con placas metálicas?"
2. `protesisManosPies` — "¿Tiene prótesis de manos o pies?"
3. `marcapasos` — "¿Tiene marcapasos o equipos de soporte vital?"
4. `cafeAlimentos3h` — "¿Tomó café o alimentos hace menos de 3 horas?"
5. `banoPrevio` — "¿Fue al baño antes de ingresar a la consulta?"
6. `ejercicioIntenso4h` — "¿Hizo ejercicio intenso hace menos de 4 horas?"
7. `diuretico` — "¿Consume algún medicamento diurético?" **con texto libre `diureticoCual` "¿Cuál?"** cuando responde Sí (no lo teníamos en la v1).
8. `accesoriosMetalicosRetirados` — "¿Se retiraron los accesorios metálicos en contacto con la piel antes de la BIA?"

**3 femeninas (solo mujeres):** confirma que son 3, no 2.
1. `embarazo` — "¿Está en embarazo?" (Sí/No). En el HTML **NO captura mes de gestación**.
2. `menstruando` — "¿Está menstruando?" + **número `diaPeriodo` "Día"** cuando responde Sí.
3. `semanaCiclo` — "¿En qué semana de su ciclo se encuentra?": **número 1-6, siempre visible, NO es Sí/No.**

**Dos divergencias con lo planeado y su decisión (aprobada por Santiago 2026-07-24):**
- El HTML **no** captura "mes de gestación" en embarazo. Atlas lo agrega como **mejora nuestra** (detalle informativo, no altera cálculos).
- La menstruación captura **día del periodo** (no semana). La semana del ciclo es un campo numérico **separado**, siempre visible. La v1 de Atlas sigue el HTML: `menstruacion` (día) + `semana_ciclo` (numérico 1-6) como condiciones distintas.

### (b) Pestaña de Tratamiento

Rediseño grande (`CHANGELOG.md` sección 2 + `atlas-motores-tratamiento.js`): motor calórico nuevo, 4 motores deterministas, Reporte/HC reordenado sin duplicados, y **mucho `localStorage`** (`atlas:plan_pn`, `atlas:nutra`, `atlas:citas`, `atlas:obj_nutri`, `atlas:plan_inter`) que el backend debe modelar cuando se construya Tratamiento. Bloque futuro, no toca B.

### (c) Encuesta (P63, Otros/Otras, grupos D1)

- Nuevo grupo `d1_15` "Carnes rojas" en el patrón (`FREQ_GROUPS` pasa a 15 grupos).
- Texto libre "Otros/Otras" en preguntas de multiselección.
- "P63" = una pregunta 63 nueva (hoy hay 62). Es **contenido de encuesta** (dominio de Gildardo, se acepta); se re-implementa en cnv-atlas con nuestros patrones, vía UPSERT no destructivo (ver punto 7).

---

## 4. Verificación del ciclo menstrual: solo registro clínico (con evidencia)

**El dato de semana/día del ciclo NO alimenta ningún cálculo del motor congelado.** Es registro clínico. Evidencia:
- `grep` en `src/clinical-engine/**`: **cero** referencias a menstruación/ciclo/semana.
- `atlas-dfi.js` (módulo DFI entregado): **cero** referencias.
- En el HTML, esos datos viven en un objeto `qc` (condiciones de calidad, camelCase: `menstruando`, `diaPeriodo`, `semanaCiclo`), completamente aparte de los `d-fields` (`d1_*`...`d8_*`) que el motor consume.

Conclusión: guardarlo en `evaluation_bis_intake` como dato es correcto; no toca golden ni motor.

---

## 5. Bundle atlas-gil: intención de los 3 commits (para portar, NO integrar)

Es para `CNV-SAS/atlas-gil` (repo divergente). El bundle es "thin" (le falta la base `80e9513`), así que no se extrae el diff aislado; se trata como especificación. Intención de cada commit (según `atlas-gil-encuesta-INSTRUCCIONES-Santiago (2).txt`):
- `74b692d` — alinea el **contenido** de la encuesta con `ATLAS_v7` (P63, "Otros", grupos D1). Solo cambia `supabase/seed.ts` de atlas-gil. Contenido en BD, se re-hace por UPSERT.
- `9a1b885` — UI del intake: sexo como desplegable Hombre/Mujer + texto libre para "Otros".
- `d4fe92c` — rebrand de la superficie del paciente como "Atlas Patients" (cosmético).

El propio instructivo repite: el deploy **no** aplica el contenido de la encuesta (vive en BD); hay que UPSERT no destructivo, nunca `pnpm db:seed`.

---

## 6. Mecanismo de custodia (archivo derivado) — planeación, NO ejecutado

Autorizado por Santiago para resolver de nuestro lado los pedidos que no llegaron por la vía definida, **preservando la regla dura 16** (Atlas no edita el `.js` frozen). Pendiente de ejecución (planning-first).

### 6a. Viabilidad

**Viable.** Nuestra app importa el frozen con `import * as core from "./frozen/engine.core.js"` en 4 archivos (`engine.ts`, `analysis.ts`, `severity.ts`, `registry-data.ts`). El mecanismo:
- El `engine.core.js` original queda **intacto** en `frozen/` (artefacto de referencia).
- Un script determinista genera un derivado = **copia byte a byte del original + una línea final aditiva** que hace `Object.assign(module.exports, { ... })` con los nombres que faltan.
- Un test verifica que el derivado es exactamente `original + esa única línea` (diff de una sola línea, aditiva). Si falla, falla el build.
- Los 4 imports pasan a apuntar al derivado.
- Solo líneas de export aditivas. NUNCA lógica ni fórmulas.

### 6b. Qué se puede exponer así (todo ya definido en el frozen, solo falta exportarlo)

Las 6 funciones **ya existen** en `src/clinical-engine/frozen/engine.core.js` y **ninguna** está en su `module.exports` (L936). Se exponen con el export aditivo:

| Función | Dónde (frozen `engine.core.js`) |
|---|---|
| `efrProf` (abordaje por profesión, pedido 1) | L807 |
| `cSMM` | L151 |
| `cMMEM` | L171 |
| `cASMI` | L185 |
| `cFFW` | L222 |
| `cEISG` | L233 |

Esto resuelve los **pedidos 1 y 2** completos (la 6ª card de abordaje por profesión y la columna de Diagnóstico de composición).

### 6c. Qué NO se resuelve exponiendo (sigue requiriendo a Gildardo)

- **Pedido 4 (función de rangos lo/hi):** los clasificadores tienen los umbrales como **literales embebidos** dentro de cada función (`v < 27`, `v < 5.7`...), no como datos expuestos. Sacar lo/hi por indicador×sexo exige **escribir una función nueva** que devuelva esos rangos. Eso es autoría/ciencia, NO un export aditivo. Se para y vuelve a Gildardo.
- **`dAECMCA`:** no está en el frozen (es render-only inline en el HTML). No hay nada que exportar; exponerlo exigiría autoría. Vuelve a Gildardo / decisión.
- **Pedido 3 (patrón alimentario):** ya llegó como módulo (`atlas-encuesta-patron.js`); su port es otro asunto, no el mecanismo de custodia.

### 6d. Al ejecutar (cuando Santiago dé el visto)
- Documentar el mecanismo en `ARCHITECTURE.md` junto a la regla dura 16, como patrón sancionado para exponer sin editar, con la restricción "solo exports aditivos, nunca lógica".
- Golden en verde antes y después como criterio de aceptación.

---

## 7. Nota del seed no-destructivo: confirmada

`docs/BACKLOG.md` documenta que `pnpm db:seed` es destructivo (borra `survey_answers` → `survey_responses` → `survey_questions`), y que el ajuste de Q6 se aplicó con `UPDATE` puntual, no re-seedeando. Todo cambio de contenido de encuesta (P63, Otros, grupos D1) va por UPSERT no destructivo. Alineado con el instructivo de Gildardo.
