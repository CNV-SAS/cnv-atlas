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
| **`cAF`**, que devolvía "Normal" con el color de alerta | Portado. **Estaba vivo en pantalla** |
| **La salvaguarda de TCA**, tu texto del 19 de agosto | Portado. Retiramos nuestra versión |

**Dos que estaban vivas en pantalla, ya corregidas, y las dos por la misma causa nuestra: teníamos
candados mirando una entrega tuya anterior, así que pasaban verdes contra un archivo de hace días.**

**`cAF` pintaba de ámbar un ángulo de fase NORMAL.** Tu corrección (la quinta de tus cinco defectos)
estaba sin portar: la etiqueta decía "Normal" y el color decía alerta, sobre el mismo número. Es el tipo
de contradicción que hace dudar al profesional de la pantalla entera.

**Y la salvaguarda de TCA seguía diciendo lo nuestro.** La habíamos corregido por tu instrucción del 13 de
agosto, tú la corregiste en tu archivo el 19 con tus palabras, y durante diez días nuestro texto siguió
sobrescribiendo el tuyo. Decían lo mismo, pero sobre lo clínico manda tu archivo: retirada la nuestra.

**Y la tercera, del mismo origen.** Al cambiar los
cortes del IRC cambiamos `cIRC`, que es quien **clasifica**, pero el DFI imprime aparte una cadena con
los cortes escritos a mano, y esa se quedó en los viejos. La pantalla decía *"IRC 1,9 (Normal, corte H:
<1,68 bajo · 1,68–2,11 normal)"* cuando el corte real ya era 1,7–2,1. El número y su explicación se
contradecían sobre el mismo paciente. Tu archivo del 29 ya la traía corregida; nosotros la habíamos
portado a medias.

---

# 1 · Tus alertas: aplicada tu corrección, y una sola pregunta encima

**Esta sección cambió después de escribirla, y el cambio es nuestro error.** La habíamos redactado
preguntándote por los campos `d1_14`, `d1_15` y `d1_16`. **Ya nos habías contestado**, el 28, punto
11b, y con instrucción explícita de no volver a preguntar:

> *"Las dos leen el grupo equivocado y las dos deben leer `d1_13`, azúcares añadidos y bebidas
> azucaradas. Pórtenla ya con la corrección; no la porten literal para que yo la arregle después."*

**Aplicado.** Las dos de azúcares leen `d1_13_i`. Y el agua lee `d7_agua`, que es tu propio
mapeo del 28 de julio: *"Hidratación → `enc.d7_agua`, vasos de 200 ml, la misma unidad que esperaba
`d1_16`"*. Con eso **corren cinco** de tus quince reglas: TCA activo, riesgo glucémico, estrés más
azúcares, deshidratación probable e hidratación adecuada.

**Un detalle de forma que resolvimos y te declaramos**, por si lo lees distinto: tus condiciones de
azúcares son `>= 2`, y en tu objeto demo esos campos valen 1 y 2, así que las leímos como el
**índice 0–4** de `FREQ_OPC` ("Nunca" … "Todos los días"). Umbral 2 = "3–4 días" o más. El agua no
es índice: son vasos contados, porque tus cortes son `<= 3` y `>= 8`.

## Lo único que sí preguntamos aquí

**Tu regla de deshidratación se disparaba sola, y sigue pudiendo hacerlo si el paciente no responde.**

`agua <= 3` con el dato ausente es verdadero **siempre**: la regla quedaba reducida a "orina
oscura" y el texto afirmaba *"Agua: 0 vasos"* sobre una pregunta sin responder. **Lo resolvimos como tú
resolviste el ISCM en tu punto 4:** sin el insumo, la regla no se evalúa. Un 0 respondido sí cuenta y sí
alerta; lo que frena es la ausencia.

**¿Es la conducta que quieres?** Es una decisión nuestra sobre una regla tuya, y por eso te la
declaramos en vez de dejarla pasar.

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

# 3 · El ICEC: no encendimos el mapeo, y la razón es tuya

**Nos diste dos instrucciones que comparten un mismo interruptor, y una de las dos todavía no se puede
cumplir.**

**La primera:** *"Enciendan `LE8_MAPEO_CORREGIDO`. El defecto es real, está documentado en mi propio
archivo desde el 28 de julio, y el campo correcto es `d1_9_i`, no `d1_9`."* Clara, y la aplicaríamos hoy.

**La segunda está escrita en tu propio archivo, al lado del interruptor**, y es la que nos frena:

> *"DESACTIVADO A PROPÓSITO. NO PONER EN true SIN RESOLVER LO SIGUIENTE. Activarlo baja la EB-BIS de TODOS
> los pacientes entre 1 y 8 años (más cuanto más sano está el paciente), porque el ICEC deja de estar
> artificialmente deprimido. Antes hay que establecer de dónde salieron la media 58,578 y la desviación
> 13,332 del ICEC en la ecuación EB-BIS v5."*

**El mapeo y la recalibración van en el mismo acto, y la recalibración no ha llegado.** Encender solo la
mitad que tenemos dejaría a todos los pacientes con una edad biológica movida entre uno y ocho años,
calculada con una media y una desviación que tú mismo marcaste como sin establecer.

**Así que está sin encender, y esperando una de estas dos:**

1. **La recalibración:** de dónde salen μ = 58,578 y σ = 13,332, y si se conservan o se recalculan al
   corregir el mapeo.
2. **O partir el interruptor en dos**, si el DFI clavado en 30 y 20 se puede corregir sin tocar la EB-BIS.
   Hoy es uno solo y mueve las dos cosas.

**Y una tercera, que se deriva de tu propia respuesta.** Dijiste que lo ya evaluado *"se recalcula, y que
quede anotado en la historia que el DFI cambió de versión"*. ¿Esa misma conducta aplica a la EB-BIS, que
es la que se mueve entre uno y ocho años?

---

# 4 · Un dominio sin dato sigue puntuando severidad 1

Al aplicar tu punto 4, el ISCM ausente ya no se clasifica: el dominio 2 muestra "ISCM –" en vez de
"Leve". Pero la **severidad** del dominio la fija tu `?? 1`, escrito para el caso de una clasificación
fuera del mapa, así que **queda en 1 (Leve)** aunque no haya dato.

No lo cambiamos: es tu decisión, escrita, y para exactamente este caso. Pero deja el radar dibujando un
vértice de "susceptibilidad leve" sobre un dominio que no se midió, que es la misma familia de lectura
favorable que tú señalaste. **¿El dominio debe puntuar 1, o no debe puntuar?**

---

# 5 · Las tres reglas "positivo", junto a las críticas

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

**Lo único que sí depende de ti son las diez alertas de consumo** (pregunta 2: el puente de frecuencia a
porciones, más el omega-3) y **el ICEC** (pregunta 3). La pregunta 1 ya no bloquea nada: tu corrección
está aplicada y lo que queda ahí es una declaración.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
