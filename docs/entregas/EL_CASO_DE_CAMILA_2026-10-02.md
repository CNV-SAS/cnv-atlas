# El caso de Camila, y la pregunta que abre

**Para Santiago, 2026-10-02.** Camila dijo de una paciente importada del HTML: *"no sé por qué no me quiere
generar bien como todo"*.

---

## 1 · Lo que la base dice de esa paciente

La consulta salió **completa**: medición con 108 valores, ningún insumo del motor faltante, cintura 85,8 y
cadera 116, condiciones registradas, 64 respuestas de encuesta, **y el diagnóstico ya generado**.

**Así que no es un bloqueo por faltantes.** Eso cambia la pregunta: lo que ella llama "no genera bien" es otra
cosa.

### Lo que la captura muestra, y no es un defecto

Los guiones de la captura están en las filas con **icono de rayo**: Resistencia 50 kHz, Reactancia 50 kHz, las
tres impedancias, Re, Ri, R∞, C y Fo. Esas filas **no tienen valor de referencia para ningún paciente**: están
declaradas sin referencia en el código (`composition-map.ts`), porque son el crudo bioeléctrico y no hay rango
poblacional contra el cual compararlas. La tabla de Gildardo hace lo mismo, y tú lo confirmaste contra el HTML.

**La única fila con guion que sí varía entre pacientes es FFW (agua libre de grasa).** Su referencia no viene
del equipo: se calcula como `FFW - FFW_dif`, y si el export no trae esa columna, la celda queda vacía. Es una
celda de referencia, no un dato que falte para el diagnóstico.

### Las tres cosas que pueden ser, en orden de sospecha

La parte **(C)** de `scripts/QUE_LES_FALTA_A_LOS_IMPORTADOS.sql` las mira todas de una vez:

1. **Que esté mirando OTRA consulta de la misma paciente.** Un paciente importado suele traer varias (una
   inicial y sus seguimientos). La que tú consultaste generó; otra puede no haberlo hecho. La parte (C)
   devuelve **una fila por evaluación**, así que esto se ve de inmediato.
2. **Que el resumen de IA esté vacío.** El diagnóstico existe, las cifras están, y el párrafo que lo explica
   no. La pantalla se ve a medias sin que falte ningún dato, y "no genera bien como todo" describe eso mejor
   que cualquier otra cosa.
3. **Que el diagnóstico esté sin confirmar.** Sin la firma no hay tratamiento ni reporte, y desde la pantalla
   parece que el proceso no terminó.

**Antes de responderle conviene pedirle una captura de lo que SÍ ve, y de qué pantalla.** Su frase es vaga y
las tres cosas se arreglan distinto.

---

## 2 · La respuesta para Camila, para mandársela ya

> El archivo de esa consulta no perdió nada en la importación: **en el HTML esa consulta tampoco traía los
> datos del equipo**, lo verificamos por los dos lados. Por eso Atlas te pide el archivo del Biody de esa
> toma: si lo tienes, se monta la medición con él y la consulta genera normal. **Si no lo tienes, esa consulta
> queda como registro, sin diagnóstico, y eso es lo que hay**: son resultados del equipo y no se pueden
> escribir a mano.
>
> Y una cosa antes de montar el archivo: **montarlo reemplaza la medición entera**. Si la consulta ya tenía
> cintura y cadera y el archivo del Biody no las trae, hay que volver a escribirlas en Antropometría.

*(Si el caso de ella resulta ser el del diagnóstico ya generado, esta respuesta no aplica y hay que mandarle
otra. Por eso conviene la captura primero.)*

---

## 3 · La pregunta para Gildardo, para cuando tengas el número

**No se la lleves todavía:** primero corre la consulta (A) y el script de la encuesta. Si el número sale bajo,
los casos se resuelven uno a uno y no hay nada que preguntar.

> **Gildardo: qué hacemos con una consulta de hace meses que no tiene medición del equipo.**
>
> Al traer las historias del HTML encontramos consultas que **nunca tuvieron una medición de bioimpedancia**:
> se registraron sin que se corriera el equipo, o su archivo se perdió. No es que la importación las haya
> dañado, el HTML tampoco las tiene.
>
> Esas consultas **no pueden producir diagnóstico**, porque el modelo necesita los datos del equipo y no se
> pueden escribir a mano sin inventarlos. Son [N] de [M] consultas, de [P] pacientes.
>
> La pregunta es qué debe hacer el software con ellas:
>
> 1. **Dejarlas como registro, sin diagnóstico.** La consulta existe, se puede leer lo que sí se anotó, y
>    queda explícito que no hay diagnóstico porque no hubo medición.
> 2. **Cerrarlas de otra forma**, si en tu modelo hay una manera de dar por terminada una consulta sin
>    bioimpedancia.
>
> No la decidimos nosotros: el software representa tu archivo, y esto es qué significa una consulta sin
> medición dentro del modelo. Si la respuesta es (1), no hay nada que construir. Si es (2), dinos qué es ese
> cierre y lo construimos.

---

## 4 · Las tres piezas, y qué responde cada una

| Pieza | Qué responde | Cómo se corre |
| --- | --- | --- |
| `scripts/QUE_LES_FALTA_A_LOS_IMPORTADOS.sql` **(A)** | Cuántas importadas pueden generar y cuántas no, agrupadas por lo que les falta | En el editor SQL de Supabase |
| El mismo archivo, **(B)** y **(C)** | Qué le pasa a UNA paciente: qué le falta, y qué se generó y qué no | Igual, cambiando el id |
| `scripts/encuesta-de-los-importados.mjs` | Cuántas tienen la encuesta incompleta, con cuántas respuestas faltan y por dominio | `$env:DATABASE_URL="<nube>"; pnpm tsx scripts/encuesta-de-los-importados.mjs` |

**Las tres son de solo lectura.** Ninguna escribe nada, y el script no imprime ningún dato de paciente: solo
conteos y, como mucho, el id de una evaluación para poder buscarla.

**Por qué la encuesta va en un script y no en la consulta SQL:** "respondida" no es "hay una fila". El
predicado real distingue ausente de vacío, trata `[]` como sin responder, `0` como respuesta válida, y marca
como incompleta una pregunta que eligió "Otra" sin escribir el texto. Reescribirlo en SQL sería crear una
**segunda definición de completitud**, y la diferencia entre las dos se vería como un paciente que la pantalla
deja pasar y el conteo no. El script importa la función de la aplicación, así que el número sale del mismo
código que decide en la pantalla.
