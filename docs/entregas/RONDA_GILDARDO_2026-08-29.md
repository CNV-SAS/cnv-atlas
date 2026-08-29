# Ronda del 2026-08-29

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 29 de agosto de 2026

---

## Antes de las preguntas: qué quedó aplicado de tu respuesta y tu archivo

Tu respuesta del 27 y el `ATLAS_v8.html` del 29 están **portados**, salvo lo que aquí se pregunta. En
orden de lo que cambia un veredicto:

| Lo tuyo | Estado |
| --- | --- |
| **El piso calórico** (`if(deficit>0)` → `if(!hasCancer && !desnutricion)`) | Portado verbatim, con la salvedad de cáncer y desnutrición fuera del piso |
| **Los cortes del IRC** por sexo (1,7/2,1 y 2,3/2,8) | Portado, con golden |
| **El orden de la matriz** por categoría clínica | Corregido en base de datos, con los tres encabezados de grupo |
| **El punto 4**, que el ISCM no se emita sin MCA | Aplicado |
| **La dirección de la capacitancia** (acercarse a la mediana) | Ya estaba portada |
| **El motivo de consulta** con separador | Ya estaba, como divergencia declarada |

**Y una cosa que encontramos al portar, ya corregida, porque estaba viva en pantalla.** Al cambiar los
cortes del IRC cambiamos `cIRC`, que es quien **clasifica**, pero el DFI imprime aparte una cadena con
los cortes escritos a mano, y esa se quedó en los viejos. La pantalla decía *"IRC 1,9 (Normal, corte H:
<1,68 bajo · 1,68–2,11 normal)"* cuando el corte real ya era 1,7–2,1. El número y su explicación se
contradecían sobre el mismo paciente. Tu archivo del 29 ya la traía corregida; nosotros la habíamos
portado a medias.

---

# 1 · Tus alertas leen tres campos de la encuesta anterior

**Esta es la que más te pedimos que mires, porque bloquea diez reglas y deja una emitiendo un texto
falso.**

`generarAlertas` tiene quince reglas. Las portamos todas, verbatim. Hoy **corre una**.

**Diez necesitan `cons`** (el consumo de nutrientes: kcal, sodio, fibra, hierro, calcio, proteína,
omega-3). No lo calculamos nosotros y no lo calcula tu archivo. Es la pregunta 4 de abajo.

**Cuatro leen `d1_14`, `d1_15` y `d1_16`,** que son de la matriz de **18 ítems** y no existen en la de
15. No es sospecha nuestra: es tu propia nota, sobre el mismo grupo de campos, unas líneas más arriba en
el archivo:

> *"Los campos d1_9, d1_10 y d1_16 que lee calcLE8 NO existen en la encuesta: solo viven en el objeto
> DEMO, y por eso el defecto pasó inadvertido."*

**Y una de esas cuatro no está muerta: miente.** "Deshidratación probable" pide `agua <= 3` sobre
`d1_16`. Como `agua` es siempre 0, esa mitad de la condición **se cumple siempre**: la regla queda
reducida a "orina oscura" y el texto le afirma al profesional *"Agua: 0 vasos"* sobre una pregunta que
el paciente nunca respondió. La excluimos explícitamente mientras respondes.

**Lo que necesitamos de ti son las equivalencias:**

| Tu regla lee | Es | ¿El equivalente en la encuesta de 15 es…? |
| --- | --- | --- |
| `d1_15` | bebidas azucaradas | `d1_13_i` (azúcares añadidos y bebidas azucaradas) |
| `d1_14` | azúcares | ¿el mismo `d1_13_i`, o se separaron? |
| `d1_16` | vasos de agua | `d7_agua`, que es el mapeo que **tú mismo** diste el 28-jul |

**Y una advertencia sobre los umbrales, que no es un detalle de forma.** Tus condiciones son `>= 2` sobre
una escala de porciones. Los `_i` guardan un **índice de frecuencia de 0 a 4** ("Nunca" … "Todos los
días"), que no es la misma magnitud. Si respondes solo el campo, aplicaremos el umbral sobre una escala
distinta de la que pensaste. **Necesitamos el campo y el umbral juntos.**

**No arreglamos ninguna por nuestra cuenta,** aunque el mapeo del agua ya lo diste. Dos razones, y la
segunda pesa más que la primera: sería sustituir tu diseño por el nuestro en contenido clínico; y
Santiago está por cotejar Atlas contra tu archivo, así que una regla que nosotros "mejoremos" hace que
los dos dejen de coincidir y **tú la reportarías como defecto**.

---

# 2 · El puente que falta: de frecuencia a porciones

Es lo que bloquea las diez reglas de arriba, y **es más chico de lo que parece**, porque el resto ya
está.

- **`INTER_TABLA_A` ya trae los nutrientes.** Seis de los siete que piden tus alertas: kcal, proteína,
  sodio, fibra, hierro y calcio.
- **`validacion.ts` ya calcula "porciones × nutriente".** La aritmética existe y funciona.
- **Lo único que falta es la conversión:** el paciente responde *"3–4 días por semana"* y el cálculo
  necesita *"tantas porciones al día"*.

**La pregunta es sola una:** ¿cuál es la equivalencia entre cada una de las cinco frecuencias y una
cantidad diaria de porciones? Con esa tabla, las diez reglas se encienden.

**El séptimo nutriente, el omega-3, no está en `INTER_TABLA_A`.** Tu regla "Buena ingesta de Omega-3"
pide `>= 1,0 g/día` y no tenemos de dónde sacar el gramaje. ¿Lo agregamos a la tabla con tus valores, o
esa regla se retira?

---

# 3 · El ICEC: si cambia de mecanismo, cambia un diagnóstico

Tu nota en el archivo dice que encender `LE8_MAPEO_CORREGIDO` **baja la EB-BIS de todos los pacientes
entre 1 y 8 años**, y que antes hay que establecer de dónde salieron la media 58,578 y la desviación
13,332 del ICEC en la EB-BIS v5.

Tu respuesta del 27 dice *"enciendan el mapeo"*, y lo entendemos referido al DFI clavado en 30 y 20.
**No lo hemos encendido**, porque las dos cosas comparten el mismo interruptor y una de ellas mueve una
edad biológica en toda la base.

**Lo que preguntamos:**

1. ¿La media y la desviación del ICEC se conservan al corregir el mapeo, o hay que recalcularlas?
2. ¿Encendemos el interruptor completo, o hay que separarlo en dos?
3. Ya dijiste que lo evaluado **se recalcula y queda anotado en la historia que el DFI cambió de
   versión**. ¿Esa misma conducta aplica a la EB-BIS, que es la que se mueve entre 1 y 8 años?

---

# 4 · Un dominio sin dato sigue puntuando severidad 1

Al aplicar tu punto 4, el ISCM ausente ya no se clasifica: el dominio 2 muestra "ISCM –" en vez de
"Leve". Pero la **severidad** del dominio la fija tu `?? 1`, escrito para el caso de una clasificación
fuera del mapa, así que **queda en 1 (Leve)** aunque no haya dato.

No lo cambiamos: es tu decisión, escrita, y para exactamente este caso. Pero deja el radar dibujando un
vértice de "susceptibilidad leve" sobre un dominio que no se midió, que es la misma familia de lectura
favorable que tú señalaste. **¿El dominio debe puntuar 1, o no debe puntuar?**

---

# 5 · Las tres reglas "positivo" y el umbral de la escala

Tres de tus quince alertas son felicitaciones: fibra suficiente, buen omega-3, hidratación adecuada.
Aparecen en la misma lista y con el mismo peso visual que un TCA activo.

**¿Van en la misma lista que las críticas, o en un bloque aparte?** Lo preguntamos como forma, no como
ciencia: si la respuesta es "van juntas", las dejamos juntas.

---

# 6 · Tu punto 3, sin dimensionar

Tu punto 3 quedó enunciado pero sin alcance, y no sabemos si es un ajuste o un bloque. **¿Qué esperas que
construyamos y sobre qué pantallas?**

---

# 7 · Declaración: corregimos el orden de la matriz, y era nuestro

**No es pregunta, es aviso, y el error era de Atlas.**

Tu `FREQ_GROUPS` ordena los quince grupos por categoría: 1–7 protector, 8–11 neutro, 12–15 riesgo. Las
**carnes rojas** ocupan la posición 11 (neutro) aunque su campo sea `d1_15_i`, porque el 15 es el
identificador y no el lugar. Nuestra encuesta ordenaba por el **número del campo**, así que las carnes
rojas salían las últimas, después de ultraprocesados, **entre las de riesgo**.

Con tu regla, textual: *"nunca roten por posición, siempre por `n`"*, y *"la agrupación que ve el
paciente es esa misma: el orden es el mensaje"*. Con el orden viejo le decíamos al paciente que las
carnes rojas son alimento de riesgo cuando tu modelo las clasifica como neutras.

**Corregido**, sin cambio de versión de la encuesta: ninguna pregunta cambia de enunciado, de opciones ni
de campo. Solo cambia la secuencia, y las respuestas ya guardadas apuntan al identificador, no a la
posición. **Y añadimos los tres encabezados de grupo**, que solo se podían poner después de corregir el
orden: con las carnes rojas al final, un encabezado "procesados a reducir" habría quedado encima de
ellas, haciendo **visible** un error que hasta entonces solo estaba implícito.

**Por qué no lo vimos antes, que es lo que nos importa:** nuestro orden era coherente **consigo mismo**.
El motor leía por campo, las respuestas se guardaban bien y el patrón usaba tu orden. Lo único mal era la
secuencia que veía el paciente. Lo encontró Santiago respondiendo la encuesta con tu archivo al lado. La
consistencia interna no prueba fidelidad.

---

# 8 · Tres notas de tu archivo que no supimos dónde poner

En el panel por profesión hay tres campos de nota, uno por profesión, y no encontramos en tu archivo la
regla de qué va en cada uno ni si son el mismo campo repetido o tres distintos. Los citamos donde los
vimos: son los del bloque de tratamiento, uno por cada rol.

**¿Es una nota por profesión, o una sola nota compartida que cada quien edita?**

---

## Lo que sigue de nuestro lado, sin esperarte

La separación de la cadena calórica en tus dos bloques, la unificación del menú, la reemisión obligatoria
cuando el paciente cambia de banda y los dos resúmenes. Ninguna depende de estas respuestas.

**Lo único que sí depende de ti son las diez alertas** (preguntas 1 y 2) y **el ICEC** (pregunta 3).

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
