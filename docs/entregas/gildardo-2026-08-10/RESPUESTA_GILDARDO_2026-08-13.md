# Respuesta a la ronda del 2026-08-12

**De:** Gildardo Uribe — Dirección Científica CNV
**Para:** Equipo Atlas
**Fecha:** 13 de agosto de 2026

Respondo los cinco puntos. Empiezo por una corrección mía, porque afecta a lo que les dije ayer.

---

## 0. Corrección · mi §6 de ayer estaba equivocado en la práctica

Ayer les escribí que mi ecuación EB-BIS ya resolvía sola el caso de encuesta incompleta, porque devuelve `null` sin ICEC, y que por eso no hacía falta suspender nada por encima.

**La guarda existe pero casi nunca puede dispararse, y ustedes lo cazaron bien.** `calcLE8` termina en:

```js
const total = Math.round(scores.reduce((s, x) => s + x.v, 0) / scores.length);
return { scores, total };
```

Siempre devuelve un número. Los ceros con que se rellena lo que falta entran al promedio como si fueran respuestas del paciente. Es peor de lo que plantean: con una encuesta **vacía**, el dominio "Presión arterial" puntúa **100** —porque no hay HTA registrada— e "Hidratación" puntúa **20**. Datos inventados en las dos direcciones.

Leí la guarda sin comprobar si podía cumplirse. Bien visto.

Dicho eso, la respuesta correcta no es arreglar la matemática. Es otra.

---

## 1. La encuesta parcial no debe existir · el modelo la bloquea

**Ninguna de las tres opciones que plantean es la respuesta, porque las tres asumen que el sistema debe saber qué hacer con una encuesta a medias. No debe: debe impedir que se llegue a ese punto.**

Es una condición del modelo de atención: **el profesional no puede atender a ningún paciente si la encuesta no está completa.** Y si le falta, la llena con el paciente delante, en la consulta. Eso no es una restricción técnica, es cómo se atiende.

### El flujo que debe implementarse

Cuando el profesional hace clic sobre un paciente, **lo primero que ve, antes que cualquier otra cosa**, es:

1. **Cuántas preguntas contestó y el porcentaje de completitud.**
2. **Qué preguntas faltan**, enumeradas.
3. Al hacer clic sobre lo que falta, **el sistema lo lleva a esa pregunta**, la llena con el paciente ahí mismo, guarda y vuelve al módulo profesional.
4. Lo mismo con el **consentimiento informado**: si no está diligenciado, se diligencia antes.

Solo cuando la encuesta está completa y el consentimiento firmado se habilita la atención.

### Qué implica para sus tres subpreguntas

Con ese bloqueo, **a), b) y c) dejan de tener caso**. No hay riesgo integrado sobre ceros, ni edad bioeléctrica sobre ceros, ni rutas sobre ceros, porque no hay consulta con encuesta incompleta. La encuesta parcial deja de ser un estado clínico y pasa a ser una tarea pendiente en la puerta de la consulta.

### Una salvaguarda que les pido igual

El bloqueo vive en la interfaz, y el cálculo no debería depender de que la interfaz funcione. **Hagan además que `calcLE8` deje de rellenar con ceros en silencio**: que distinga "el paciente respondió 0" de "el paciente no respondió". Si algún día el bloqueo falla o alguien llega por otra ruta, el sistema no emitirá una edad bioeléctrica inventada.

Son dos cosas distintas y quiero las dos: **el bloqueo porque es el modelo de atención, y la guarda en el cálculo porque es higiene.**

---

## 2. El déficit por fenotipo · se retira en los cinco

**En todos los fenotipos.** El objetivo calórico sugerido pasa a mantenimiento y el nutricionista escribe el que corresponda, en los cinco casos: el hipercalórico de −300, el 500, el 600, el 300 y el de mantenimiento.

Mi principio no admite excepciones por fenotipo: el sistema no deriva de nada cuántas calorías subir o bajar. Ni de una tabla por magnitud, ni de una tabla por fenotipo. El ejemplo que cité era solo eso, un ejemplo.

Gracias por la precisión sobre su código: tienen razón en que en Atlas el profesional escribe el **objetivo calórico** y no un déficit, y que mi cita de `edit.deficit` era de mi motor. La instrucción es la misma traducida a su campo: **el objetivo calórico sugerido deja de llevar déficit incorporado.**

### La etiqueta

Tienen razón en que "Hipocalórico moderado −500 kcal/día" deja de ser cierto. Propongo:

> **Mantenimiento · el objetivo calórico lo define el profesional**

Y por debajo, si quieren conservar la orientación del fenotipo, el texto **sin número**: por ejemplo *"Perfil de obesidad sarcopénica: preservar masa magra"*. Lo que no debe aparecer es una cifra que el sistema no tiene por qué proponer.

---

## 3. La opción "Otro" · apruebo las nueve

Añadan "Otro" con campo de texto libre a las nueve que proponen:

| | Pregunta |
|---|---|
| d2_21 | métodos usados para cambiar de peso |
| d3_25 | tipo de actividad física |
| d4_34 | patrón alimentario que sigue |
| d4_35 | suplementos que toma |
| d5_38 | antecedentes familiares |
| d5_42 | exposición a contaminantes |
| d6_43 | alergias alimentarias |
| d6_44 | intolerancias alimentarias |
| d8_59 | quién prepara sus alimentos |

Y coincido en que las escalas, los sí/no y las frecuencias cerradas **no la necesitan**.

Esto no contradice mi §7 de ayer. Allí dije que no se podan variables ni se recortan del intake; añadir una salida para el paciente que no encaja no quita nada, y evita que un dato real se pierda por no tener casilla.

---

## 4. El texto libre de diagnósticos (d5_39) · **sí alimenta el motor**

Es una condición real del paciente y debe pesar en el plan.

### Con una condición: todo lo que resulte debe ser editable por el profesional

Conéctenlo sin pedir confirmación previa. El protocolo se aplica y ya. **Pero todos los datos que resulten tienen que poder ser cambiados por el profesional**, que es quien tiene el criterio y el paciente delante.

Esto importa porque el reconocimiento es **por coincidencia de subcadena**, y con texto libre eso tiene un filo que conviene que conozcan:

- *"diabetes gestacional en el embarazo"* activa el protocolo de DM2
- *"antecedente de cáncer, en remisión hace 10 años"* activa el protocolo oncológico completo: 27,5 kcal/kg, hiperproteica, densidad energética alta
- *"sin enfermedad renal"* contiene la palabra renal y activa la restricción proteica a 0,7 g/kg

**El motor no distingue un antecedente resuelto de una condición activa, ni una negación de una afirmación, y no tiene por qué hacerlo.** Para eso está el profesional.

Así que la regla es la misma que gobierna el resto del sistema, y conviene enunciarla una vez para todo: **el motor propone, el profesional dispone.** Si el texto libre activa un protocolo que no corresponde, el nutricionista corrige el objetivo calórico, la proteína o lo que sea, y su decisión manda. No hace falta un diálogo de confirmación; hace falta que nada de lo que produce el motor quede bloqueado.

---

## 5. El archivo · tienen razón, el suyo es viejo

**El `ATLAS_v8.html` del 4 de agosto es anterior a la corrección.** Va adjunto el actualizado.

Lo que cambió desde esa versión:

| Cambio | Fecha |
|---|---|
| Carnes rojas: lógica de color propia para los moderados | 12-ago |
| `MCA_ref` de 50 % a **52,4 %** de la MLG, con procedencia anotada | 12-ago |
| `hidSG_ref` marcada como REFERENCIADA (Pace-Rathbun / Wang) | 12-ago |
| Salvaguarda de TCA: avisa, ya no bloquea el déficit | 9-ago |
| Renombre del eje estructural a E1-E9 y unificación en A1-A9 | 9-ago |
| Condición de activación del ICEC anotada junto a la bandera | 9-ago |

### Sobre las carnes rojas, una precisión

Tienen razón en las dos observaciones, y se explican así: **el grupo 15 sí entraba al cálculo** —en mi `calcPatron` la categoría neutra es `[8, 9, 10, 15]`— pero **la tarjeta de pantalla tenía su propia lista escrita a mano, sin el 15**. Por eso al mirar `calcPatron` les pareció correcto y al mirar la pantalla no cuadraba: eran dos sitios distintos.

La lógica de color de los moderados sí es nueva, del 12 de agosto, y por eso no está en el archivo que tienen. Queda así:

| Frecuencia | Antes | Ahora |
|---|---|---|
| 0–2 · de nunca a semanal | verde | verde |
| 3 · varias veces por semana | verde | ámbar |
| 4 · casi a diario | **verde** | **rojo** |

Comer carne roja casi a diario pasa de mostrarse como adecuado a mostrarse como elevado.

---

## Resumen

| Punto | Decisión |
|---|---|
| §0 | Mi §6 de ayer estaba mal: `calcLE8` nunca devuelve null. Corregido aquí |
| §1 | **La encuesta parcial se bloquea, no se calcula.** Sin encuesta completa y consentimiento firmado no hay consulta. Más la guarda en `calcLE8` |
| §2 | Déficit sugerido retirado en **los cinco** fenotipos. Etiqueta sin cifra |
| §3 | "Otro" aprobado en las **nueve** preguntas |
| §4 | El texto libre **sí alimenta el motor**. Aplica directo, y todo lo que resulte debe ser editable por el profesional |
| §5 | Va el archivo al día |

© Connected Nutrition Ventures SAS, 2026. Documento interno.
