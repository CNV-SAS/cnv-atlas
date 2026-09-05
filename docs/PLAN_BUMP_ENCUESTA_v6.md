# Plan del bump de la encuesta a v6

**Para Santiago. 2026-09-04. Aprobado y ejecutado.**

Cambia el instrumento que responde el paciente y hay respuestas existentes, así que se planeó antes de
tocar nada. Este documento queda como el registro de por qué se hizo así.

**Las cifras están medidas contra la NUBE**, no contra local, y esa distinción cambió una decisión: ver la
sección (b). La medición local decía cero donde la nube decía cuatro.

---

## Qué entra

| # | Cambio | De quién | ¿Confirmación pendiente? |
| --- | --- | --- | --- |
| 1 | **P23**: la opción `0` pasa a **"No hago ejercicio"** | Suyo, ya en su archivo | No |
| 2 | **P24**: entra **"0 minutos a la semana"** al principio | Suyo, ya en su archivo | No |
| 3 | **P23**: quitar el `(≥30 min)` del enunciado | Suyo, escrito palabra por palabra | **Sí, una línea** |
| 4 | **P44**: `Lactosa (leche y lácteos)`, `Gluten (trigo, pan, pasta)`, `Fructosa (frutas, miel)` | Suyo, escrito palabra por palabra | **Sí, una línea** |
| 5 | **P43**: `Otra` se queda, y se DECLARA como divergencia | Decisión de Santiago | No |

**Los cinco en un solo bump**, que es el punto de esperar: cada bump cuesta lo mismo (deja las
evaluaciones anteriores sin corrección), así que hacer tres cuesta el triple sin comprar nada.

### Por qué el 3 y el 4 necesitan una línea suya, y no una ronda

Los dos los escribió **él**, textualmente, en su respuesta del 3 de septiembre, y los dos dicen *"va en la
próxima entrega"*. La entrega del 4 llegó **sin ellos**, y dijo que no habrá más cambios.

No hace falta que escriba nada nuevo: el texto ya está redactado por él. Basta que confirme que lo
apliquemos nosotros. Es distinto de inventar contenido, y por eso no va como pregunta de ronda.

**Si no contesta, el bump se hace igual con 1, 2 y 5**, y el 3 y el 4 quedan para después. Pero conviene
preguntar antes, porque es la diferencia entre un bump y dos.

### El 5, que no es la palabra sino la afirmación

Su archivo dice **`Otras`** en las alergias (P43). Nuestro seed dice `Otra`. Y el comentario de nuestro
propio seed afirma que se portó *"VERBATIM de su archivo (el token es suyo)"*, **cuando no lo es**.

**Lo que había que corregir no era la palabra, era la afirmación falsa.** Se puede llegar ahí por dos
caminos: portar `Otras` y que el comentario diga la verdad, o dejar `Otra` y declararla como divergencia
nuestra con su razón.

**Va la segunda**, por decisión de Santiago, y con dos argumentos detrás:

1. **El sentido.** La pregunta es "¿alergias alimentarias diagnosticadas?" y las opciones son alimentos en
   singular (Leche, Huevo, Maní). `Otra` concuerda; `Otras` no.
2. **Ya hay ocho declaradas del mismo tipo.** Las otras ocho preguntas de opción múltiple llevan `Otra`
   por la modificación autorizada del 13 de agosto. Portar `Otras` solo en esta dejaría el instrumento
   diciendo dos cosas.

Y hay un tercer argumento que apareció al medir la nube: **cinco pacientes ya respondieron `"Otra: ..."`**
con su texto libre (Apio, Penicilina, grasas). El token no es teórico, está en uso.

Funcionalmente da igual: el detector reconoce las cuatro flexiones desde el arreglo del 2026-09-02.

---

## a) La migración, que reemplaza al seed contra la nube

**El seed NO sirve para esto.** Su propia cabecera lo dice: borra y re-inserta las preguntas, opciones y
**respuestas** de la versión vigente. Contra la nube destruiría datos reales.

Contra la nube va una **migración aditiva forward-only**, y sería la primera vez que hacemos un bump así
(el precedente `0092` fue un cambio de orden en sitio, no un bump).

**Qué hace la migración, en orden:**

1. **Inserta una fila nueva en `survey_versions`** (id nuevo, `version_number` 6), sin tocar la v5.
2. **Inserta las ~64 preguntas** con los ids deterministas de la v6 y el contenido nuevo.
3. **Inserta las opciones** de cada una.
4. **No toca `survey_responses` ni `survey_answers`.** Ni una fila. Las respuestas viejas siguen colgando
   de la v5, que queda intacta.

**Por qué esto es seguro y el seed no:** los ids se derivan de `(tipo, SURVEY_VERSION_ID, clave)`, así que
un id nuevo de versión produce filas **nuevas**. La v5 no se mueve ni se pisa. Esa propiedad ya está en el
código y es la que hace el bump barato; sin ella, un bump movería las filas y dejaría las evaluaciones
viejas apuntando al vacío.

**Y el seed se actualiza en el mismo commit** (`SURVEY_VERSION_ID` y `SURVEY_VERSION_NUMBER` juntos, como
dice su propio comentario), para que local y nube no diverjan. Local se re-siembra; la nube recibe la
migración.

**Riesgo conocido, del que ya tenemos incidente:** una migración nueva **no se despliega sola**. Después
del push hay que correr `pnpm db:check:cloud` y `pnpm db:migrate` contra la nube, y después
`pnpm db:types`. Pasó el 2026-08-08 y está en la memoria del proyecto.

---

## b) Quién ya respondió "0": en la nube, cuatro personas

**Esta sección se reescribió el 2026-09-04 después de medir contra la nube, y el cambio es la mejor
defensa del paso 3 del plan.**

El riesgo es real y estructural: la respuesta se guarda como **texto**, no como id de opción. Si alguien
respondió `"0"` y la opción pasa a llamarse `"No hago ejercicio"`, ese valor deja de coincidir con
ninguna opción: la pantalla no seleccionaría nada, pero `isAnswered` lo cuenta como respondido. **Dos
partes de la pantalla diciendo lo contrario.**

### Lo que decía esta sección, y por qué estaba mal

Medí contra la base **local** y salió cero en las tres preguntas. Escribí que ninguna respuesta quedaría
huérfana "ni siquiera haciendo el cambio en sitio", y que hoy no hay huérfanos **por casualidad**.

**La nube dice otra cosa:**

| Pregunta (versión 5) | Respuestas en la nube | Con el valor en riesgo |
| --- | --- | --- |
| **P23** días de ejercicio | 60 | **4 responden `"0"`** |
| **P24** duración | 57 | cero |
| **P43** alergias | 59 | **5 responden `"Otra: ..."`** (Apio, Penicilina, grasas...) |

O sea que **el cambio en sitio habría dejado a cuatro pacientes reales con la pantalla en blanco** en una
pregunta que el sistema cuenta como respondida. Y el token `"Otra"` de la P43 no es teórico: hay cinco
respuestas con texto libre detrás.

### Y por eso el bump es la opción correcta, no solo la ortodoxa

Con el bump esas respuestas **no se tocan**: siguen colgando de la v5, cuyas opciones no cambian, así que
siguen coincidiendo con su instrumento. El problema no se resuelve, **se vuelve imposible**.

La lección para el resto del plan: **una medición local no vale para decidir sobre datos de la nube.** El
paso 3 no es un trámite.

## c) Las evaluaciones viejas quedan sin corrección, y sí importa

**Sí quedan bloqueadas, y el mecanismo es explícito.** `getCorrectionAvailability` compara la versión de
encuesta de la evaluación con la vigente; si difieren, devuelve:

> *"Esta evaluación se hizo con una versión anterior del cuestionario; no puede recalcularse con el modelo
> actual. Escríbele a soporte."*

No es un error al pulsar: el botón sale deshabilitado con esa razón. La superficie está bien hecha; lo que
hay que decidir es a cuántos afecta.

**Medido contra la NUBE, que es donde están los datos que importan:**

| | Nube | Local |
| --- | --- | --- |
| Evaluaciones | **107** | 85 |
| Respuestas de encuesta | **102** | 70 |
| Diagnósticos confirmados | **14** | 12 |
| Tratamientos aprobados | **0** | 0 |

Así que el bump deja **14 diagnósticos confirmados sin camino de corrección**. Ninguno tiene tratamiento
aprobado, que es la señal de que son de prueba y no de un paciente en atención.

**Cero tratamientos aprobados era la condición de parada del plan**, y se cumple: si hubiera aparecido
alguno, esto se detenía aquí y se reportaba.

**Y aquí está el argumento, que es el mismo que el del LE8:** este costo es hoy el más bajo que va a ser
nunca. Cada paciente real que entre después del hito 2 suma una evaluación que perdería la corrección.
**Si se va a bumpear alguna vez, el momento es antes del hito 2.**

---

## d) Qué más conviene meter, y cómo lo verifiqué

No lo decidí de memoria: comparé **nuestro instrumento entero contra el suyo**, pregunta por pregunta y
opción por opción, por script. De 32 preguntas comparables salieron 12 diferencias:

- **Dos son el porte que falta** (P23 y P24): entran.
- **Ocho son el `"Otra"` que agregamos nosotros** en preguntas de opción múltiple. Es la modificación
  autorizada del 13 de agosto, documentada. **No entran: no son un hueco.**
- **Una es P43** (`Otra` vs `Otras`): entra como DECLARACIÓN, no como cambio de texto (ver arriba).
- **Una es P29**, el nivel de estrés: nuestro enunciado agrega *"(1 = sin estrés, 10 = máximo)"* y el suyo
  no lo lleva. **Es una divergencia nuestra que NO está declarada** en `DIVERGENCIAS.md`.

**Sobre la P29 no propongo tocar nada**, y el motivo importa: la aclaración es correcta (una escala sin
sus extremos no se puede responder bien) y quitarla empeoraría la pregunta. Lo que falta no es el cambio,
es **declararla**, que es barato y va en el mismo commit.

**Lo que NO entra, y por qué:** la pregunta de método anticonceptivo que él mencionó el 3 de septiembre
(*"no alcanzó a entrar hoy"*) tampoco llegó en la del 4. Es contenido nuevo que él no ha escrito, así que
no se inventa. Si la manda, va en el bump siguiente.

---

## El orden de ejecución

1. **Preguntarle las dos líneas** (el `(≥30 min)` y el lenguaje de la P44). Va junto con la del LE8.
2. Escribir la migración aditiva `0099_encuesta_v6.sql` y actualizar el seed en el mismo commit.
3. **Volver a medir las tres cifras contra la nube** antes de aplicar: respuestas por versión,
   diagnósticos confirmados y tratamientos aprobados. Si en la nube hay tratamientos aprobados, esta
   decisión cambia y hay que rehacerla.
4. Candado: que ninguna opción de la v6 quede sin su equivalente en su archivo, y que la v5 conserve sus
   64 respuestas después de migrar.
5. Aplicar en local, re-sembrar, y smoke de la encuesta completa (es un instrumento, necesita navegador).
6. Push, y después `db:check:cloud` + `db:migrate` + `db:types` contra la nube.

**Tamaño:** un bloque. La migración es mecánica; lo que lleva tiempo es el candado y el smoke.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
