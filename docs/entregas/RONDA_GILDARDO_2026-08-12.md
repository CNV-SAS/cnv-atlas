# Ronda para Gildardo, 2026-08-12 (consolidada)

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 12 de agosto de 2026

Gracias por la respuesta de hoy: cierra la ronda del 10 y desbloquea EA1 (cableamos las dos referencias del §9). Nos quedan unas preguntas, dos de ellas salen justo de haber aplicado tus respuestas de hoy (el déficit y la encuesta parcial). Van consolidadas, de la que más bloquea a la que menos. Al final, las confirmaciones que no necesitan que decidas nada, solo que sepas. Esta ronda sigue ABIERTA: acumulamos lo clínico que falta antes de enviarla, no la mandamos por partes.

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

## 2. El déficit calórico por fenotipo (§1): ¿se retira en todos, o solo en obesidad sarcopénica?

Tu §1 es claro en el principio: el sistema no debe derivar el déficit de nada, lo decide el nutricionista. Al ir a aplicarlo encontramos dos cosas de nuestro código que cambian cómo conviene responderlo.

**a) En Atlas el profesional NO escribe un "déficit", escribe el objetivo calórico.** Tu cita `if (edit.deficit !== undefined) deficit = Number(edit.deficit)` es de tu `motorTratNutri`; en Atlas ese campo no existe. El campo que ya manda sobre todo es el **objetivo calórico (kcalObj)**, que el profesional fija directo y sobreescribe el sugerido. El déficit por fenotipo solo fija el kcalObj **sugerido** (= gasto − déficit).

**b) No es un solo valor: la tabla tiene cinco.** Citas el 500, pero el fenotipo impone cinco déficits distintos:

| Fenotipo | déficit sugerido | etiqueta actual |
|---|---|---|
| F7/F10 o cáncer | −300 (hipercalórico) | Hipercalórico +300 kcal/día |
| F1 u obesidad sarcopénica | 500 | Hipocalórico moderado −500 kcal/día |
| F2/F3 | 600 | Hipocalórico −600 kcal/día |
| F4/F5 | 300 | Hipocalórico leve −300 kcal/día |
| F11 o resto | 0 | Mantenimiento |

**Pregunta 1:** ¿se retira el déficit sugerido en TODOS los fenotipos (el sugerido pasa a mantenimiento y el profesional escribe el objetivo), o solo en obesidad sarcopénica (el 500)? Tu principio ("ni de una tabla por magnitud") apunta a todos; el ejemplo que citas es solo el 500. Las dos prescriben distinto a un paciente con obesidad, por eso no lo decidimos nosotros.

**Pregunta 2 (sale de la anterior):** hoy la etiqueta dice "Hipocalórico moderado −500 kcal/día". Si el déficit sugerido pasa a 0, ese texto deja de ser cierto. ¿Qué debe mostrar la etiqueta cuando ya no hay déficit sugerido? ("Mantenimiento; ajusta según tu criterio", o un texto orientativo del fenotipo sin el número.)

---

## 3. La opción "Otro" en la encuesta, y el texto libre de antecedentes

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

## 4. Carnes rojas (§5): ¿el archivo que tenemos ya trae tu corrección?

Tu §5 de hoy dice que las dos rarezas ya están corregidas en el prototipo. Revisamos el `ATLAS_v8.html` que nos entregaste el **4 de agosto de 2026** para ver si trae la corrección o si nos vas a mandar un archivo nuevo. Lo que encontramos:

- **La entrada al promedio: parece que sí.** El grupo 15 (Carnes rojas) está en `FREQ_GROUPS` como `cat: "neutro"`, y `calcPatron` filtra por categoría de forma dinámica (`FREQ_GROUPS.filter(g => g.cat === cat)`), no por una lista escrita a mano. Así que el grupo 15 ya entra al promedio de "Moderados".
- **La lógica de color propia de "Moderados": no la vemos.** En ese archivo, la inversión de color solo se aplica a la categoría de riesgo (`esAlerta = esRiesgo && i >= 2`). Para los moderados, más frecuencia sigue pintando el color de la categoría, no ámbar ni rojo. La tabla que describes hoy (3 = ámbar, 4 = rojo para moderados) no está en este archivo.

**Pregunta corta:** ¿el `ATLAS_v8.html` del 4 de agosto es anterior a tu corrección, y nos vas a mandar el archivo con la lógica de color de moderados ya puesta? Si prefieres, con el fragmento de `calcPatron` y la función de color corregida nos basta; lo portamos verbatim.

---

## 5. ¿Nos mandas el archivo al día?

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

## 6. El radar de severidad: ¿4 niveles o 5?

Tu respuesta del 9 de agosto (11a) resolvió la severidad POR DOMINIO: "Leve / Moderado / Alto, descarten Vigilancia / Crítico". Atlas ya usa Óptimo / Leve / Moderado / Alto en las tarjetas de dominio (Óptimo es el nivel sin alteración). Bien.

Lo que esa respuesta no nombró es el **radar funcional**: en tu HTML tiene 5 niveles distintos ("Excepcional / Muy bien / En la norma / A vigilar / A tratar"). Atlas lo unificó a la MISMA escala de dominio (4 niveles), para que radar y tarjetas no puedan divergir. **Pregunta corta:** ¿confirmas que el radar use la escala de dominio (Óptimo / Leve / Moderado / Alto), o querías conservar las 5 gradaciones del radar? Es solo forma; no cambia ningún cálculo.

---

## Confirmaciones (no requieren que decidas nada)

- **§9 aplicado.** Cableamos `hidSG_ref = 73,2 %` y `MCA_ref = 52,4 % de la MLG`, sin estratificar por sexo ni edad, con la procedencia anotada en el código. Levantamos la marca de "pendiente de entrega". Cierra EA1.
- **§2 pesoAjust: confirmado, ya está como lo pediste.** En Atlas el peso efectivo es "peso del profesional, y si no hay, el ajustado": el peso de referencia que coloca el profesional manda, y el ajustado automático solo actúa cuando no hay ninguno escrito. Ningún paciente con peso de referencia registrado ve cambiar su prescripción. No hay nada que hacer de tu lado; te lo confirmamos para cerrar el punto.
- **§3 y §4 aplicados.** Suprimimos la línea de remisión cuando el destinatario coincide con quien atiende (conducta propia), y el rótulo del ejercicio pasa a "Educador físico, entrenador, deportólogo".
- **§7 entendido.** Sin poda: las 63 variables se toman, también en el seguimiento.
- **§8 (C1, C2) aplicado.** "Sectores E1-E9", "Anillos A1-A9", y las etiquetas de `catLabel`.
- **§1 déficit: es la pregunta 2 de arriba** (no lo tocamos aún; hoy Atlas sugiere el déficit por fenotipo y el profesional ya puede sobreescribirlo).

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
