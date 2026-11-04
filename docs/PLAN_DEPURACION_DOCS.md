# Plan de depuración de `docs/`: para aprobar, nada movido todavía

**Connected Nutrition Ventures · Atlas · 4 de noviembre de 2026**
**Estado:** PROPUESTA. No se ha movido ni borrado ningún archivo.

---

## De dónde sale

Santiago, 2026-11-04: *"creería que es hora de empezar a depurar los otros archivos... ya que tenemos
gran cantidad de archivos que a día de hoy no utilizamos y pienso que si cerramos lo científico los
podemos ir eliminando y las respuestas/decisiones de Gildardo las vamos plasmando muy resumidamente... Lo
único sería resumir y «podar» muy bien las decisiones para no hacer un documento tan largo, sino uno
concreto y que se le pueda hacer seguimiento fácil."*

**Lo que hay hoy, medido:**

| | |
|---|---|
| Documentos en `docs/` | **91** archivos `.md`, 44 MB con las entregas |
| Documentos en `docs/entregas/` | **89** `.md` más 15 carpetas (39 MB: ahí viven los HTML de Gildardo y los XLSX) |
| Respuestas suyas en `docs/entregas/Gildardo responses/` | **19** `.md` más los HTML por fecha |
| De los 91 de `docs/`, **citados por código o por un candado** | **27** |
| De los 91, citados por otro documento pero no por código | **37** |
| De los 91, **no citados por nada** | **27** |

---

## Las cuatro reglas del plan

1. **NADA SE BORRA. Se mueve a `docs/archivo/`.** Git conserva el historial igual, pero un archivo movido
   se puede volver a abrir sin saber buscar en el historial, y un archivo borrado solo existe para quien
   sepa que existió. La depuración es para que `docs/` se pueda recorrer, no para liberar disco.
2. **Antes de mover uno, se mira quién lo cita** (está medido abajo). Un documento citado por el CÓDIGO no
   se mueve solo: hay que actualizar la cita en el mismo commit, o la referencia queda rota y el siguiente
   que la siga no encuentra nada. Y si lo cita un CANDADO que lo lee por ruta, moverlo pone el candado en
   rojo, que es lo correcto: el candado es la prueba de que esa cita importaba.
3. **Lo que está esperando a Gildardo no se mueve hasta que responda.** Son documentos abiertos, no
   históricos.
4. **Se mueve en tandas pequeñas, y cada tanda es un commit** con la lista de lo movido. Una tanda grande
   es imposible de revisar y, si algo se echa de menos, no hay forma de saber en qué commit se fue.

---

## Paso 1 · `DECISIONES_DE_GILDARDO.md`, el documento que hace posible archivar el resto

**Es el primer paso y no es opcional.** Archivar las respuestas de Gildardo sin esto perdería el hilo: las
decisiones viven dentro de 19 documentos de respuesta y de las resoluciones de `GILDARDO_QUERIES.md`, y lo
que se consulta de ellas es siempre lo mismo, **qué decidió y cuándo**.

**Archivo nuevo, NO se reusa `GILDARDO_QUERIES.md`** (ese es el histórico retirado de la conversación
Q1-Q36, y mezclar la bitácora con el índice es lo que lo volvió inútil como índice).

**Formato: una línea por decisión, cuatro columnas, y nada más.**

| Fecha | Qué decidió | Dónde está el texto | Estado en Atlas |
|---|---|---|---|
| 2026-07-15 | El `index.ts` de conveniencia era un ejemplo, no la vía oficial; el ISCM va con FMI | `GILDARDO_QUERIES.md` Q1 | Aplicado, golden ancla −2,072 |
| 2026-07-21 | El DFI es el único origen de R1-R6; `RUTA_COND` es referencia | `GILDARDO_QUERIES.md` Q11 | Aplicado |
| 2026-08-13 | Sin encuesta completa no se emite diagnóstico | `RESPUESTA_GILDARDO_2026-08-13` §1 | Aplicado (gate) |
| 2026-08-27 | Se retiran las tablas de alérgenos y los cruces | `RESPUESTA_GILDARDO_2026-08-27` §10 | Retiradas (0126) |
| 2026-09-07 | La fila PABU: *"Ya revisé ATLAS y está bien como lo tienen"* | inline en `PENDIENTES_CIENTIFICOS.md` | Aplicado, con candado |
| 2026-10-26 | La EB-BIS v5 se retira y la sustituye la v7 | Especificación param 7.1.0 §2 | **A medias: el DFI sigue en v5** (pregunta 4) |

**Por qué esas cuatro columnas y no más:** la fecha ordena, el qué es lo que se busca, el dónde permite ir
al texto exacto cuando hace falta (que es raro, y es justo lo que hace archivable el original), y el
estado dice si eso ya está en Atlas, que es la pregunta que aparece siempre y hoy no tiene respuesta
corta en ningún sitio.

**Lo que cuesta:** barrer los 19 documentos de respuesta más las resoluciones de `GILDARDO_QUERIES.md` y
las de `DECISIONES_ANIBISE.md`. Es una tanda entera de trabajo, y es la que de verdad vale: sin ella
archivar es perder el hilo, y con ella el resto del plan es mecánico.

---

## Paso 2 · Lo que se puede archivar YA (todo cerrado, nada lo cita)

**Las 25 que no cita ni el código ni ningún otro documento.** Son smokes ya corridos, planes ya
ejecutados y cotejos ya cerrados: su contenido o está construido o está recogido en otro documento vivo.

| Archivo | Qué es | Por qué está cerrado |
|---|---|---|
| `PLAN_BLOQUES_INVENTARIO_VENTAS.md` (133 KB) | El plan de los bloques de inventario y ventas | Los bloques están construidos; lo vivo está en `BACKLOG.md` |
| `cotejo_final_humano.md` (106 KB) | El cotejo visual completo contra su HTML | Lo abierto se mudó a `PENDIENTES_CIENTIFICOS.md` |
| `COTEJO_GILDARDO.md` (35 KB) | Cotejo anterior | Igual: lo abierto está en la cola única |
| `OBSERVACIONES-PENDIENTES.md` (18 KB) | Lista de observaciones | Cerradas o mudadas al backlog |
| `PLAN_NUTRACEUTICOS_Y_CIERRE.md`, `PLAN_SECCION_2.md`, `PLAN_PORTE_MOTOR_TRAT_NUTRI.md`, `PLAN_REMESA.md`, `PLAN_DIAGNOSTICO.md` | Planes de bloque | Construidos |
| `PAQUETE_GILDARDO_2026-08-08.md` | Lo que se le pidió en agosto | Entregado y procesado |
| `SMOKE_ENCUESTA_2026-09-04.md`, `SMOKE_ENCUESTA_v6_2026-09-04.md`, `SMOKE_LE8_ENCENDIDO_2026-09-05.md`, `SMOKE_PANEL_REFERENCIA_2026-09-04.md`, `SMOKE_LISTA_REGION_2026-09-04.md`, `SMOKE_GRASA_2026-09-04.md`, `SMOKE_PROTEINA_2026-09-03.md`, `SMOKE_DIAGNOSTICO_2026-08-15.md`, `SMOKE_RESTRUCTURE_DIAGNOSTICO_2026-08-15.md` | Nueve smokes de pantalla | Corridos; lo que dejaron vivo son candados, no documentos |
| `COTEJO_ARRANQUE_2026-09-05.md`, `ESTADO_2026-08-09.md`, `ESTADO_E2_2026-08-08.md` | Fotos de estado con fecha | Envejecidas por construcción |
| `MAPA_ENCUESTA.md`, `CONSENT_HASH_PROCEDURE.md`, `LEEME.md` | Referencias que otro documento ya recoge | `MVP.md`, `DELTA.md` y `README.md` |

**Tamaño de la tanda:** pequeña. Es mover archivos y, en los pocos casos en que un documento VIVO los
mencione de pasada, dejar la mención apuntando a `docs/archivo/`.

---

## Paso 3 · Lo que se archiva cuando Gildardo responda

No se tocan hasta entonces: son la evidencia de las preguntas abiertas.

| Archivo | Qué espera |
|---|---|
| `docs/entregas/DUDAS_PARA_GILDARDO_EBBIS_V7_Y_V12_2026-10-30.md` | Ya está retirado y apunta al vivo; se archiva cuando las 33 estén respondidas |
| `docs/entregas/REVISION_ATLAS_V10/V11/V12_*.md` | Son el cotejo contra sus entregas de octubre; las preguntas 1, 2, 9, 12 y 13 salen de ahí |
| `docs/entregas/BARRIDO_V11_V12_2026-11-03.md` | Idem |
| `docs/entregas/EB_BIS_V7_LO_QUE_TOCA_ANTES_DE_CONSTRUIR_2026-10-24.md` | La v7 está a medias (pregunta 4) |
| `FROZEN_EXPORTS_REQUEST.md` | Dos pedidos suyos siguen sin llegar (la función de rangos y `dAECMCA`) |
| `BARRIDO_CIENTIFICO_2026-09-18.md` | Lo cita `PENDIENTES_CIENTIFICOS.md` como "leer antes de planear" |

---

## Paso 4 · Lo que NO se archiva nunca (y por qué está escrito aquí)

**Los doce canónicos de `CLAUDE.md`**, que son los que se leen al empezar una sesión: `README.md`,
`ARCHITECTURE.md`, `MVP.md`, `DATABASE.md`, `SECURITY.md`, `DATA_GOVERNANCE.md`, `CONSENT_ATLAS.md`,
`CLINICAL_ENGINE.md`, `SCIENTIFIC_MODEL.md`, `BRAND.md`, `API_INTEGRATIONS.md`, `DEPLOY.md`.

**Y los nueve que gobiernan algo vivo:** `BACKLOG.md`, `PENDIENTES_CIENTIFICOS.md`, `DECISIONES_LEGALES.md`,
`DECISIONES_ANIBISE.md`, `DIVERGENCIAS.md`, `VERSIONES.md`, `TESTING.md`, `BOUNDARIES.md`, `LANZAMIENTO.md`.

**`GILDARDO_QUERIES.md` tampoco se archiva**, aunque esté retirado: es la bitácora de cómo se llegó a cada
decisión, la citan cinco archivos de código, y el `DECISIONES_DE_GILDARDO.md` nuevo va a apuntar a ella.

---

## Paso 5 · Los 27 citados por el código: qué hacer con cada clase

Esto es el punto (c) de Santiago, y es el que puede romper algo. Medido con un barrido de `src/`,
`scripts/` y `drizzle/`:

**Clase A · Citados en un COMENTARIO que explica una decisión.** La mayoría (`ARCHITECTURE.md` en 13
archivos, `BRAND.md` en 18, `DATA_GOVERNANCE.md` en 16, `DATABASE.md`, `CONSENT_ATLAS.md`,
`MODELO_COMERCIAL_*`, `MVP.md`, `PLAN_EA1.md`, `PLAN_DISENO_DOCUMENTOS.md`, `DELTA.md`, `DIVERGENCIAS.md`).
**Todos son canónicos o vivos, así que no se mueven y no hay nada que hacer.**

**Clase B · Leídos POR RUTA por un candado.** Son los que de verdad se rompen al mover, y son pocos:

| Documento | Candado que lo lee |
|---|---|
| `PENDIENTES_CIENTIFICOS.md` | `rotulos-display-de-su-archivo.test.ts`, `alertas-disponibles.test.ts`, `un-solo-documento-de-dudas.test.ts`, `html-vigente-lock.test.ts` |
| `BACKLOG.md` | `un-solo-documento-de-dudas.test.ts` |
| `docs/entregas/DUDAS_PARA_GILDARDO_EBBIS_V7_Y_V12_2026-10-30.md` | `un-solo-documento-de-dudas.test.ts` |
| `docs/entregas/CAMBIOS_AUTORIZADOS.md` | el candado de modificaciones autorizadas |
| Los HTML de `Gildardo responses/` y `gildardo-2026-07*/` | `html-vigente-lock.test.ts`, los `frozen-*-diff.test.ts` y `eb-bis-v7.golden.test.ts` |

**Ninguno de estos está en la lista del paso 2.** O sea que la tanda de archivo propuesta **no pone ningún
candado en rojo**, y eso está verificado, no supuesto.

**Clase C · Entregas de Gildardo citadas por los golden.** `docs/entregas/gildardo-2026-07/ATLAS.html`,
`gildardo-2026-07-30/ATLAS_v7.html`, los `ATLAS_v8/v9.html` y la especificación de la v7 con sus
`casos.json` y `ebBisV7.js`. **Esos no se mueven mientras exista un golden que los compare**, y el día que
se muevan hay que re-anclar el golden en el mismo commit. Son 39 MB, que es casi todo el peso de `docs/`;
el peso no es razón para tocarlos.

---

## Lo que se pide aprobar

1. **El paso 1** (`DECISIONES_DE_GILDARDO.md` con su barrido de los 19 documentos de respuesta). Es una
   tanda de trabajo y es la que habilita el resto.
2. **El paso 2** (mover los 25 a `docs/archivo/`, en una o dos tandas, cada una con su lista en el
   commit). Verificado que no rompe ningún candado.
3. **Dejar los pasos 3, 4 y 5 como están**, que es no tocar nada todavía.

Y una pregunta que es de Santiago, no nuestra: **si `docs/archivo/` debe quedar en el repositorio o salir
a otro sitio.** En el repositorio pesa pero se busca con `grep`; fuera, se deja de encontrar. La
recomendación es dejarlo dentro: el problema que se está resolviendo es que `docs/` no se puede recorrer,
y una carpeta `archivo/` lo resuelve igual que sacarlo.
