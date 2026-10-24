# Las mediciones repetidas: qué son exactamente, y cómo se corrigen sin borrar

**2026-10-24. Medido contra producción.** Santiago, sobre esto: *"Hoy hay historias clínicas con la
bioimpedancia de otra persona. Es más grave que la EB-BIS."* Y la instrucción: *"NO CONSTRUYAS (b)
TODAVÍA: reporta primero."*

El freno de importación (punto 2a) **ya está construido** y va en los dos caminos: ver
`src/modules/bis/services/huella-de-la-medicion.ts` y su candado
`src/tests/la-misma-medicion-no-entra-dos-veces.test.ts`. Este documento es el (2b): el inventario exacto y
la propuesta de corrección.

---

## 0 · Primero, dos cosas que yo dije mal esta mañana

No son matices: cambian a quién hay que mirar y por dónde entró el defecto.

### a) No son 11 grupos con 5 cruzados. Son 10 grupos, 4 cruzados, y es EXACTAMENTE la lista de Gildardo

El barrido de la mañana contó grupos sin separar los pacientes de prueba. Rehecho con el marcador
(`cuenta_como_de_prueba`, que ya incluye las dos formas de serlo):

| | |
|---|---|
| Grupos con los cuatro crudos del equipo idénticos | **15** |
| De ellos, **enteramente de pacientes de prueba** | 2 |
| **Mezclados** con pacientes de prueba (el archivo del demo) | 2 |
| **Copia legítima del flujo de corrección** (dos evaluaciones unidas en `clinical_corrections`) | 1 |
| **Reales, y a corregir** | **10** |

De esos 10: **4 entre pacientes DISTINTOS** y **6 dentro del mismo paciente**. Es, cifra por cifra, lo que
Gildardo reportó. **Él tenía razón y mi "uno que se le pasó" no existía:** el grupo extra que conté era el
archivo de la cuenta de demostración, y el grupo de tres evaluaciones que mencioné son 28 evaluaciones de
prueba compartiendo el mismo Biody del demo.

### b) El lote del HTML NO importó esas mediciones

Dije que 13 de ellas llevaban el lote del HTML. **Falso, y la confusión fue mía entre dos columnas que no
afirman lo mismo:**

- `bis_measurements.import_batch_id`: **2 de 406** mediciones en toda la base vienen de un lote.
- `evaluations.import_batch_id`: 166 de 596 evaluaciones vienen de un lote, y 13 de las 22 implicadas aquí.

O sea: **la consulta vino del HTML, la medición no.** Esas consultas entraron sin medición (el HTML casi
nunca las trae) y después alguien le importó el XLSX desde la pantalla de importar. **El mecanismo es uno
solo: el mismo archivo importado dos veces, o importado al paciente equivocado, desde la pantalla.** Dos
grupos se crearon con 2 y 4 minutos de diferencia.

El freno construido cubre los dos caminos igual, porque el del lote sigue siendo posible. Pero la frase
"por aquí entraron" solo vale para la pantalla de importar.

---

## 1 · Las diez, una por una. Todas son de Angela

**Las 20 evaluaciones a corregir son de una sola profesional.** La única otra que aparece (María Teresa, el
23 de octubre) es una copia legítima del flujo de corrección, y no hay nada que hacer con ella.

La lista identificada, con nombre y documento para poder llamar a cada paciente, está en
`docs/entregas/dudas/mediciones-repetidas-por-profesional.md` (esa carpeta está entera en `.gitignore`).
Aquí van seudonimizadas.

### Las 4 entre pacientes distintos: la `Edad` del equipo resuelve 3

El equipo graba la edad con decimales y la calcula él. Cuadra con un paciente y no con el otro:

| grupo | medida | paciente A | paciente B | `Edad` del equipo | de quién es |
|---|---|---|---|---|---|
| 5 | 2026-09-28 | `034869dd` (43 años) | `63b5ef49` (46 años) | **43,513** | **de A**. B la pierde |
| 7 | 2026-10-05 | `18bb53a2` (30 años) | `c07023a1` (38 años) | **30,177** | **de A**. B la pierde |
| 12 | 2026-09-16 | `238c6fe5` (58 años) | `32cd9ecb` (**sin fecha de nacimiento**) | **58,598** | **probablemente de A**, pero B no se puede cotejar |
| 13 | 2026-10-13 | `2291b8da` (39 años) | `af65a72e` (41 años) | **41,878** | **de B**. A la pierde |

**El grupo 12 es el único que no cierra con los datos**, y por una razón que ya conocemos: a `32cd9ecb` le
falta la fecha de nacimiento (es uno de los 15 que la pantalla nueva de la ficha permite completar). Dos
caminos: completarla y el cotejo decide, o preguntarle a Angela a quién atendió ese día.

**En los cuatro casos el dueño ya tiene su propia evaluación con esa medición, así que no hay que mover
nada: lo que hay que hacer es quitársela a quien no es su dueño.** Eso simplifica mucho la corrección.

### Las 6 del mismo paciente: no hay paciente equivocado, hay consulta equivocada

| grupo | paciente | medida | las dos consultas | creadas |
|---|---|---|---|---|
| 4 | `5f401599` | 2026-09-03 | inicial + seguimiento | 27-sep y 9-oct |
| 6 | `c1f5600e` | 2026-10-01 | inicial + seguimiento | 1-oct y 6-oct |
| 9 | `965328b8` | 2026-09-03 | seguimiento + inicial | **con 2 minutos de diferencia** |
| 10 | `51a38688` | 2026-09-15 | inicial + seguimiento | 9-oct y 11-oct |
| 11 | `4aaab7cb` | 2026-09-10 | inicial + seguimiento | **con 2 minutos de diferencia** |
| 14 | `f756212c` | 2026-10-16 | inicial + seguimiento | **con 2 minutos de diferencia** |

El patrón es el mismo en las seis: **un seguimiento al que se le montó la medición de la inicial.** Aquí no
hay un dato de otra persona, pero sí hay un seguimiento con un diagnóstico sellado calculado sobre la
medición de meses antes, y una trayectoria que compara al paciente consigo mismo en el mismo instante.

**Y dos de ellas traen algo más, que no es de este problema pero aparece aquí:** en los grupos 10 y 11 la
`Edad` del equipo difiere de la de la ficha en **9 años** en las DOS evaluaciones (34 contra 43,176 y 58
contra 67,313). Como el desfase es igual en las dos, no es que la medición sea de otro paciente: o la fecha
de nacimiento de la ficha está mal, o la ficha del paciente en el Biody Manager está mal. Hay que mirarlo
aparte, y es justo lo que la alerta de desfase de edad (el error 5 de Gildardo) destaparía sola.

---

## 2 · Cómo se corrige SIN borrar nada. Propuesta

### El acto que falta es el caso 6 del `PLAN_FLUJO_CORRECCION`, y nunca se construyó

Tres mecanismos existen y ninguno sirve solo:

| mecanismo | por qué no alcanza |
|---|---|
| Borrar la medición | **Descartado**: es un registro clínico y el diagnóstico sellado cuelga de ella. Y Santiago lo pidió explícito: sin borrar |
| Retirar la evaluación (`retirada_at`, 0212) | Es "la consulta que NO ocurrió". **Aquí la consulta sí ocurrió**: lo que está mal es la medición. Usarlo diría una mentira distinta |
| El flujo de corrección (`clinical_corrections`) | **Es el único que puede dejar atrás un diagnóstico sellado**, y es el que hay que usar. Lo que le falta son tres piezas |

### Las tres piezas que le faltan al flujo de corrección

1. **Un `trigger_type` para este caso.** Hoy el vocabulario no tiene "la medición no es de esta consulta".
   Sin él, la corrección quedaría archivada con un motivo que no es el suyo, y dentro de un año nadie podría
   contar cuántas veces pasó esto.
2. **Corregir SIN arrastrar la medición.** El flujo actual copia la medición a la versión nueva, y tiene que
   hacerlo: la toma física ocurrió una vez. Aquí hace falta lo contrario: la versión nueva nace **sin
   medición**, y entonces su puerta de diagnóstico dice sola lo que falta ("Montar BIS"). Eso es mejor que
   cualquier aviso que escribiéramos, porque es el mismo mensaje que ve cualquier consulta sin medición.
3. **Marcar la medición huérfana.** La fila se queda (no se borra), pero deja de ser la medición de esa
   evaluación. Si no se marca, el freno nuevo la vería como un choque para siempre y bloquearía una
   importación legítima del dueño real.

### Lo que le pasa al diagnóstico sellado, y al informe que ya recibió el paciente

**El diagnóstico no se edita: se reemplaza.** La versión vieja queda con `superseded_at`, así que sale de
todas las cifras, de la trayectoria y de la vista de investigación, pero sigue en la historia con su fecha y
su firma. Eso es correcto: ese diagnóstico se emitió de verdad, y el paciente lo recibió.

**Y esto hay que medirlo antes de alarmar, así que lo medí.** De las 20 evaluaciones:

| | |
|---|---|
| Con diagnóstico **firmado** | **20 de 20** |
| Informes en estado `draft` | **20 de 20** |
| Informes **enviados** (`sent_at`) | **0** |
| Informes con PDF generado (`storage_path`) | **0** |
| Informes con banda de trayectoria sellada | **0** |

**Así que ningún paciente recibió un informe de estas consultas por Atlas, y ninguna banda de "mejoró" o
"empeoró" se calculó sobre la medición repetida.** El daño está contenido en la historia clínica, que es
donde se puede corregir. Lo que los datos no pueden descartar es que alguna hoja se imprimiera y se
entregara en consulta: eso lo sabe Angela, no la base.

Corregir no deshace lo que ya se dijo en consulta. Qué se le cuenta a cada paciente **no es una decisión de
software**: es de Angela y de dirección, y el sistema solo tiene que dejar el rastro de qué se corrigió y
por qué.

### Quién lo decide: su lectura es la correcta, con un caveat

> *"mi lectura: el profesional asignado, con motivo, y admin no"*

**De acuerdo, y por la razón de fondo:** quien atendió es el único que sabe quién estaba en la silla. Admin
no estuvo, y una decisión clínica tomada por quien no estuvo es una invención con mejor permiso. Además el
flujo de corrección **ya es el acto del profesional, con motivo obligatorio**, así que no hay que inventar
autorización nueva.

**El caveat, para que no sorprenda después:** en los 4 grupos cruzados los dos pacientes son de Angela, así
que ella ve los dos lados y puede decidir. El día que un grupo cruce dos profesionales, **ninguno de los dos
podrá ver el otro lado** (la RLS se lo impide, y hace bien), y esa coordinación sí tendrá que pasar por
admin. No es el caso hoy; lo es en cuanto haya dos integrantes importando el mismo día.

---

## 3 · (2c) Que la v7 no recalcule estas, sin inventar una columna

> *"Y QUE LA v7 NO RECALCULE ESAS EVALUACIONES hasta que se corrijan."*

**No hace falta una lista ni una bandera.** El recálculo puede hacer exactamente la misma pregunta que hace
el freno: *¿esta medición comparte su huella con la de otra evaluación que no esté en su cadena de
corrección?* Si la respuesta es sí, esa evaluación no entra al recálculo.

Tiene tres ventajas sobre una lista:

1. **Se mantiene sola.** Corregido el grupo, la evaluación deja de estar excluida sin que nadie actualice
   nada. Una lista escrita a mano hoy habría que acordarse de vaciarla.
2. **Es la misma definición**, no una copia: la función de la huella ya existe y es la que usa el freno.
3. **Atrapa lo que todavía no sabemos.** Si mañana aparece un grupo nuevo, queda excluido el mismo día.

**Y hay una consecuencia que conviene mirar antes de cerrar:** estas 20 evaluaciones también están **dentro
de la cohorte de investigación** (`evaluaciones_para_investigacion`). Mientras no se corrijan, un dataset
para OB BIA LATAM saldría con hasta 20 registros cuya bioimpedancia puede no ser del paciente al que están
pegados. **Mi recomendación es excluirlas de la vista con el mismo criterio de la huella**, pero eso cambia
lo que la vista significa, así que lo decide Gildardo. Decirlo ahora es más barato que explicarlo después.

---

## 4 · Dos hallazgos de paso, los dos pequeños y los dos reales

1. **"Profesional Prueba" y "Profesional demo 2" NO están marcadas como cuentas de prueba** (`is_test`),
   así que sus pacientes cuentan como reales en todas las cifras. Tres de ellos cargan el Biody del demo. Se
   arregla con el botón que ya existe en la ficha del integrante, y de paso deja los 4 grupos de prueba
   claramente clasificados como lo que son.
2. **La `Edad` del equipo es el mejor desempate que tenemos**, y hoy no se usa para nada. La alerta de
   desfase (más de 1 año entre la edad de la ficha y la del equipo, al importar) sigue sin construir, y
   habría destapado estos diez grupos el día que ocurrieron en vez de dos meses después.

---

## 5 · Lo que pido para seguir

| decisión | de quién |
|---|---|
| Grupo 12: completar la fecha de nacimiento de `32cd9ecb`, o preguntarle a Angela | Santiago / Angela |
| Las 6 del mismo paciente: ¿la medición se queda con la inicial (mi propuesta: la primera creada, porque la segunda es la reimportación) o lo decide ella caso por caso? | Angela |
| Construir las tres piezas del flujo de corrección (trigger nuevo, corregir sin medición, marcar la huérfana) | Santiago da la orden; es nuestro |
| Excluir las 20 de la vista de investigación mientras no se corrijan | Gildardo |
| Qué se le dice a los pacientes con informe ya entregado | Angela y dirección |
