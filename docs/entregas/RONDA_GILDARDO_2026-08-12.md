# Ronda para Gildardo, 2026-08-12 (consolidada)

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 12 de agosto de 2026

Gracias por la respuesta de hoy: cierra la ronda del 10 y desbloquea EA1 (cableamos las dos referencias del §9). Nos quedan tres preguntas, y una de ellas sale justo de haber aplicado tu respuesta de hoy. Van consolidadas, de la que más bloquea a la que menos. Al final, dos confirmaciones que no necesitan que decidas nada, solo que sepas.

Verificamos cada punto contra tus respuestas anteriores para no repetir algo ya cerrado.

---

## 1. La más bloqueante · Encuesta PARCIAL: tu fórmula, aplicada, calcula sobre ceros

Esta sale de tu §6 de hoy. Tu argumento es correcto y lo adoptamos: no hay que suspender por encima de la fórmula. Pero al ir a quitar la suspensión encontramos un detalle de tu propio código que cambia la conclusión, y preferimos confirmarlo contigo antes de tocar nada.

**El hallazgo:** tu `calcLE8` rellena cada respuesta faltante con cero:

```js
const calcLE8 = enc => {
  ...
  const dias  = parseInt(enc.d3_23) || 0;   // falta -> 0
  const agua  = Number(enc.d7_agua) || 0;   // falta -> 0
  const tabaco = enc.d3_30 || "";           // falta -> ""
  ...
};
```

Esto importa por la diferencia entre **encuesta ausente** y **encuesta parcial**:

- **Ausente** (el paciente no llenó nada): no hay ICEC, tu ecuación EB-BIS v5 devuelve `null`, y todo lo que depende de ella también. Aquí tu §6 es exacto: la fórmula ya resuelve sola, no hace falta suspender.
- **Parcial** (el paciente llenó la mitad): como `calcLE8` rellena lo que falta con 0, **sí produce un LE8, sí produce un ICEC, y entonces tu ecuación EB-BIS sí calcula una edad bioeléctrica, pero sobre esos ceros.** Lo mismo el riesgo integrado: es el promedio ponderado de los cinco dominios (tu `analizarDFI`), y los dominios sin responder entran con la severidad que sale de esos ceros, no se excluyen.

Es decir: con encuesta parcial, "aplicar la fórmula del archivo" **sí emite** una edad bioeléctrica y un riesgo integrado, calculados sobre respuestas que el paciente no dio. Y eso es justo lo que tu propio principio prohíbe: "no calcula con supuestos: no calcula".

**Por eso preguntamos, en vez de decidirlo nosotros** (toca tu matemática de riesgo, no la tocamos sin ti):

Con encuesta **parcial** (no ausente):

- **a) Riesgo integrado:** ¿lo mostramos con el número del archivo (los cinco dominios, con los no respondidos sobre ceros), o recalculado solo sobre los dominios que sí se pudieron evaluar (los dos bioeléctricos, d1/d2), indicando cuáles no entraron? Tu §6 dice "con los dominios que sí se pudieron evaluar", pero la fórmula del archivo promedia los cinco con ceros. Son cosas distintas: necesitamos saber cuál.
- **b) Edad bioeléctrica e índice contextual (ICEC):** ¿se emiten sobre esos ceros, o el ICEC se trata como ausente (`null`) hasta que la encuesta esté completa, y así la EB no se calcula? (Esta es la que hace que "parcial" se comporte como "ausente".)
- **c) Rutas de atención que dependen de la encuesta (R3, R4, R5):** tu §6 no las nombra; tu §8 del 9 de agosto sí las incluía en la suspensión. ¿Se muestran sobre ceros o se suspenden como el 9?

**Mientras respondes, dejamos la suspensión puesta:** es la dirección conservadora (no emite sobre supuestos). No hay nada que corregir con urgencia; solo esperamos tu criterio para relajar exactamente lo que decidas.

---

## 2. La opción "Otro" en la encuesta, y el texto libre de antecedentes

Dos preguntas de instrumento que quedaron listas para preguntarte y no te habían llegado. Ninguna la has respondido antes (la verificamos).

**a) ¿A qué preguntas les agregamos "Otro"?** Varias preguntas de opción cerrada no tienen una salida para el paciente que no encaja. Hoy solo dos la tienen (diagnósticos personales y medicamentos). Te proponemos la lista; tú apruebas la final. "Otro" abre un campo de texto libre que se guarda como registro y no cambia ningún cálculo.

Candidatas fuertes (enumeraciones donde el paciente puede no encajar):

- d2_21 métodos usados para cambiar de peso
- d3_25 tipo de actividad física
- d4_34 patrón alimentario que sigue
- d4_35 suplementos que toma
- d5_38 antecedentes familiares
- d5_42 exposición a contaminantes
- d6_43 alergias alimentarias
- d6_44 intolerancias alimentarias
- d8_59 quién prepara sus alimentos

Probablemente NO la necesitan (escalas, sí/no, o frecuencias cerradas y exhaustivas): d3_27, d3_28, d3_31, d4_32, d4_33, d5_37, d5_41, d7_57, d7_58, d8_60.

**b) El texto libre de "Otra" en diagnósticos personales (d5_39): ¿alimenta el motor o queda como registro?** El detalle importa porque el motor reconoce condiciones **por coincidencia de texto**: hoy lee d5_39 por substring (`renal`, `diabet`, `cáncer`, ...). Si el texto libre de "Otra" entra al motor, un paciente que escribe "diabetes" o "insuficiencia renal" ahí **dispararía el protocolo correspondiente** (restricción de carbohidratos, proteína renal). Puede ser lo que quieres (es una condición real) o no (texto no estructurado que no debería gatear un protocolo automático). Es decisión clínica tuya.

Estado actual: ya construimos la captura del texto libre, pero por defecto **no lo dejamos alimentar el motor** (se guarda como registro, se retira antes del cálculo). Si dices que solo es registro, se queda así; si dices que debe alimentar d5_39, lo conectamos.

---

## 3. Carnes rojas (§5): ¿el archivo que tenemos ya trae tu corrección?

Tu §5 de hoy dice que las dos rarezas ya están corregidas en el prototipo. Revisamos el `ATLAS_v8.html` que nos entregaste el **4 de agosto de 2026** para ver si trae la corrección o si nos vas a mandar un archivo nuevo. Lo que encontramos:

- **La entrada al promedio: parece que sí.** El grupo 15 (Carnes rojas) está en `FREQ_GROUPS` como `cat: "neutro"`, y `calcPatron` filtra por categoría de forma dinámica (`FREQ_GROUPS.filter(g => g.cat === cat)`), no por una lista escrita a mano. Así que el grupo 15 ya entra al promedio de "Moderados".
- **La lógica de color propia de "Moderados": no la vemos.** En ese archivo, la inversión de color solo se aplica a la categoría de riesgo (`esAlerta = esRiesgo && i >= 2`). Para los moderados, más frecuencia sigue pintando el color de la categoría, no ámbar ni rojo. La tabla que describes hoy (3 = ámbar, 4 = rojo para moderados) no está en este archivo.

**Pregunta corta:** ¿el `ATLAS_v8.html` del 4 de agosto es anterior a tu corrección, y nos vas a mandar el archivo con la lógica de color de moderados ya puesta? Si prefieres, con el fragmento de `calcPatron` y la función de color corregida nos basta; lo portamos verbatim.

---

## 4. ¿Nos mandas el archivo al día?

Al aplicar tus respuestas encontramos dos correcciones tuyas que no están en
el ATLAS_v8.html que tenemos (el del 4 de agosto):

  - La referencia de MCA: tu archivo tiene 50%, y tu respuesta de hoy la
    corrige a 52,4%.
  - Y la lógica de color de los grupos moderados (3 ámbar, 4 rojo), que
    mencionas como ya corregida en tu prototipo.

Usamos tu archivo como referencia para verificar que Atlas se comporta igual
que tu modelo. Si está desactualizado, podemos "corregir" cosas que ya
corregiste, o pasar por alto otras.

¿Nos puedes mandar la versión al día cuando te quede fácil? No urge para
esta ronda, pero sí antes de que hagamos la comparación completa de las
pantallas.

## Confirmaciones (no requieren que decidas nada)

- **§9 aplicado.** Cableamos `hidSG_ref = 73,2 %` y `MCA_ref = 52,4 % de la MLG`, sin estratificar por sexo ni edad, con la procedencia anotada en el código. Levantamos la marca de "pendiente de entrega". Cierra EA1.
- **§1, §2, §3, §4 en curso.** Retiramos el déficit por fenotipo (manda el campo del profesional); el peso ajustado queda como valor inicial; suprimimos la línea de conducta propia; el rótulo del ejercicio pasa a "Educador físico, entrenador, deportólogo".
- **§7 entendido.** Sin poda: las 63 variables se toman, también en el seguimiento.
- **§8 (C1, C2) aplicado.** "Sectores E1-E9", "Anillos A1-A9", y las etiquetas de `catLabel`.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
