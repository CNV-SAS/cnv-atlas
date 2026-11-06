# La tarjeta del informe preguntaba por una columna que no existe

**Estado: CERRADO** (2026-11-06). Arreglado, con dos candados nuevos y una deriva de esquema cerrada.

| | |
|---|---|
| **Detectado** | Sentry, 2026-11-06 15:45 UTC, 139 eventos, *Escalating* |
| **Mensaje** | `reports-repository: conPlan: column treatments.protocol_snapshot does not exist` |
| **Superficie** | `GET /ani-bis-e/[id]`, pestaña del informe |
| **Introducido** | 2026-10-30, commit `920f11a3` (*the patient report is transversal, and the plan travels as its own sheet*) |
| **Visible** | 2026-11-03, cuando se empezó a leer el error de esa consulta |
| **Pacientes afectados** | ninguno en lo que recibió: los correos y los PDF salieron correctos |
| **Profesionales afectados** | todos, en las 483 consultas con tratamiento |

---

## Qué pasó

La tarjeta del informe ofrece un segundo enlace, la hoja del plan, **solo cuando hay prescripción
emitida**, para que lo que la tarjeta ofrece y lo que el correo adjunta no puedan decir cosas distintas.
Para saberlo consultaba `treatments.protocol_snapshot`.

**Esa columna nunca existió.** Las reales son `protocol_suggested` (el set que sella el motor al
diagnosticar) y `protocol_approved` (el que sella el profesional al prescribir). Postgres contestaba
`42703` y PostgREST lo devolvía como un 400, en **todas** las cargas desde el 30 de octubre.

## Por qué tardó siete días en verse

Porque el 30 de octubre el error se descartaba con un `const { data } =`: un fallo quedaba
**indistinguible de "no hay plan"**, así que la tarjeta simplemente no ofrecía el enlace y nadie podía
notar la diferencia entre "esta consulta no tiene plan" y "no se pudo averiguar".

El 3 de noviembre se cambió para leer ese error, con esta razón escrita en el código: *"un fallo quedaba
indistinguible de 'no hay plan' y la tarjeta escondía el enlace en silencio"*. **Ese cambio funcionó
exactamente como se esperaba**: encendió los 139 eventos y sacó a la luz un defecto que llevaba cuatro
días escondido. Lo que se ve en Sentry no es una regresión del 3 de noviembre, es su resultado.

## El daño, medido

- **Del 30-oct al 3-nov:** el enlace a la hoja del plan **no se ofreció en ninguna consulta**. El
  profesional aprobaba el envío viendo un documento de los dos.
- **Del 3-nov al 6-nov:** la tarjeta mostró el tercer estado, *"No se pudo comprobar si hay hoja del plan.
  Abrirla para ver"*, que **sí abre el documento bueno**. Esa degradación amable es la que evitó que el
  defecto bloqueara a nadie.
- **Lo que recibió el paciente no se tocó nunca:** el correo decide el adjunto con `getPlanPaciente`, que
  es otra lectura y siempre funcionó. Ningún informe ni ningún plan salió mal.
- **La respuesta correcta era "sí hay plan" en las 483**: medido el 2026-11-06, las 483 consultas con
  tratamiento tienen `protocol_suggested` sellado.

## Un segundo defecto en la misma consulta, que no alcanzó a morder

La consulta tampoco tenía `order by`, así que preguntaba *"¿existe **algún** tratamiento con protocolo?"*
cuando la condición de `getPlanPaciente` es *"¿el tratamiento **más reciente** tiene protocolo?"*. Hoy no
se distinguen (**483 tratamientos en 483 consultas**, uno por consulta), pero el bloque de corrección crea
un tratamiento nuevo para cambiar una prescripción aprobada: el día que exista el segundo, las dos
preguntas dejan de dar lo mismo. Arreglado ahora, no cuando pase.

## Por qué ningún test lo vio

**Sí había candado, y comprobaba el cable en vez del valor.** `plan-paciente.test.ts` exige que la tarjeta
ofrezca el enlace (`report.conPlan ?`) y que el correo adjunte según lo mismo. Ninguna de sus aserciones
ejecuta la consulta ni mira el esquema, así que el cable estaba perfectamente atado a una fuente que
devolvía siempre lo mismo. Y los 72 archivos de pruebas contra BD no tienen ni un caso de
`getReportCardForEvaluation`.

Un nombre de columna equivocado en PostgREST es **invisible a `tsc`** (el tipo sale de una cadena de
texto), invisible a lint, e invisible a cualquier prueba que no toque la base.

## Lo que se hizo

1. **La condición vive en un solo sitio.** `hayProtocoloSellado` en `treatment-reader.ts`, al lado de
   `getTreatmentProtocol`, con la misma resolución paso por paso. La tarjeta la llama; ya no tiene copia.
   Dos fuentes de la misma condición no se mantienen sincronizadas por buena voluntad.
2. **Candado nuevo: `las-columnas-de-las-consultas-existen.test.ts`.** Lee las columnas reales de las 103
   tablas desde `@/db/schema` con `getTableConfig` y comprueba cada `.select(...)`, cada embed anidado y
   cada filtro u orden de todas las cadenas de PostgREST de `src/`. Incluye la prueba del defecto: le entra
   la consulta original y tiene que acusar sus dos mitades.
3. **Candado nuevo: `un-id-que-no-es-un-id-no-es-un-500.test.ts`**, por el segundo error de la misma ronda
   (abajo).
4. **El error se reporta por el camino estándar.** Antes se interpolaba `error.message` de Postgres con el
   comentario *"no lleva PHI (es el error de Postgres, no el dato)"*, **y eso es falso justo donde
   importa**: un mensaje de Postgres sí trae el valor de la fila. El segundo error de esta ronda era
   literalmente `invalid input syntax for type uuid: "<el valor>"`. Ahora va por `reportServerError`, que
   pasa por el scrub.

## Lo que el candado encontró de paso

Cuatro columnas que **existen en la base y no estaban en el esquema Drizzle**, o sea deriva entre la
definición y la realidad: `patients.test_proposed_at/_by/_reason` y `test_marked_at/_by` (migración 0180,
18 de octubre) y `nutraceuticals.manufacturer/dose_frequency` (migración 0184). Se agregaron al esquema
con los tipos exactos de su DDL, que es lo que vuelve a hacer verdad el esquema; exentarlas habría dejado
el candado ciego justo donde hace falta.

Y una que queda abierta, en BACKLOG: **`sale_reversals` es una tabla real creada en SQL crudo (0147) que
el esquema Drizzle no declara**, así que sus columnas no las vigila nada.

---

## El segundo error de la ronda: un `}` pegado a un id

| | |
|---|---|
| **Mensaje** | `supersession-reader: invalid input syntax for type uuid: "ed83ff97-...-7081761594f7%7D"` |
| **Eventos** | 2, *Unhandled* (pantalla caída, 500) |

Ese `%7D` es una llave de cierre pegada al final del id: un enlace mal copiado a mano.

**Atlas no genera ninguno así, verificado:** las quince superficies que construyen enlaces interpolan
`${id}` directamente y **no hay ni un marcador con llaves en todo `src/`**. Además `/ani-bis-e/[id]` nunca
sale de la app: lo que viaja al paciente son `/consentimiento/<token>`, `/encuesta/<token>` y
`/checkout/<id>`.

**Lo que estaba mal no era el enlace, era la respuesta.** Ninguna de las veinte rutas dinámicas comprobaba
su parámetro, así que el texto llegaba a Postgres y su `22P02` se relanzaba como un 500. Un id que no tiene
forma de id es una dirección que no existe: eso es un 404.

Se añadió `lib/routing/id-de-ruta.ts` y se aplicó a las **catorce** rutas que reciben un id de la base (diez
páginas con `notFound()`, cuatro route handlers con su propio 404). Las seis restantes están declaradas una
por una en el candado con su razón: cinco llevan tokens, que son `text` en la base y no revientan, y una no
lee su parámetro.

**Y el checkout del paciente, que es la superficie que más importa, ya estaba protegido**, en mejor sitio
que la ruta: su lector comprueba la forma antes de preguntar. Se le puso la guardia también y se **retiró**,
porque era protección duplicada y tapaba las pruebas que usan tokens raros a propósito. Queda declarada en
el candado para que nadie retire la buena creyendo que la cubre la otra.

## Nota sobre la geografía de Sentry

Los dos eventos salen de *Ashburn, United States*. **Es el servidor, no quien entra:** es la región
`us-east-1` (`iad1`) donde Vercel ejecuta las funciones de Atlas. Sentry geolocaliza la IP de la función que
lanzó el error, no el navegador del profesional.
