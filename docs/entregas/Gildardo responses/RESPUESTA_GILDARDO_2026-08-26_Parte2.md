# Respuesta a la ronda del 2026-08-24 · Parte 2

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 26 de agosto de 2026

Va el resto de la ronda. Empiezo por el 3.1 porque **su inventario está equivocado**, y de eso depende
buena parte de lo que iban a construir.

---

## 3.1 · Las 64 preguntas entran todas al modelo. Y su auditoría tiene un error

**Todas las preguntas hacen parte del modelo. Sin ellas no hay DFI.** El instrumento no tiene preguntas
de adorno: cada dominio existe porque el diagnóstico funcional integrado se construye sobre los ocho.
Ninguna se retira de la encuesta.

### Su tabla dice «nadie las usa» y eso no es cierto

Verifiqué las 25 en el archivo. **Veintidós tienen consumidores reales**, más allá de la declaración, la
pantalla y el contador de completitud. Dos ejemplos completos, para que puedan reproducirlo:

**El alcohol (`d3_31`)**, que su tabla marca como «nadie», aparece en cinco sitios. Dos son consumo real:

```js
// L13172 — constructor de texto clínico
var alc = String(enc.d3_31||"").toLowerCase();
if (alc.indexOf("semana")>=0 || alc.indexOf("todos")>=0) cl.push("consume alcohol con frecuencia");

// L17643 — dentro de motorTratEjercicio
var _alcohol = e_.d3_31 || "";
```

El ronquido tiene tres consumidores; los síntomas digestivos, entre dos y tres cada uno; las alergias e
intolerancias, cinco cada una.

**Dónde creo que se equivocaron:** auditaron el contrato de los cuatro motores de tratamiento y dieron
por no consumido todo lo que no estuviera ahí. Pero el modelo consume en más sitios que esos cuatro —el
constructor de texto clínico y `motorTratEjercicio`, al menos—. **Rehagan el inventario incluyendo todo
el archivo, no solo los motores**, y me lo mandan corregido.

### Lo que sí es cierto, y es el hallazgo que se les perdió detrás del error

Los motores de tratamiento leen **muy poco** de la encuesta:

| Motor | Campos que consume |
|---|---|
| `motorTratNutri` | `d2_21` · `d5_36` · `d5_38` · `d5_39` · `d7_57` |
| `motorTratMedico` | `d5_36` · `d5_39` · `d5_40` |
| `motorTratEjercicio` | `d5_36` · `d5_39` |

**Cinco, tres y dos campos.** Ese sí es el problema: no que las preguntas no se usen, sino que **la
prescripción se apoya en una fracción mínima de lo que el paciente respondió**. Es lo que hay que
cerrar, y lo detallo en el punto siguiente.

---

## 3.2 · Las alergias van a los cuatro profesionales, y al plan

**Si hay alergias alimentarias, deben reportarse en el diagnóstico de los cuatro profesionales y
tenerse en cuenta en los objetivos del plan nutricional.**

Con una distinción que importa: **en el nutricionista entran como restricción del plan; en los otros
tres, como dato de contexto.** No es lo mismo que una alergia condicione lo que se prescribe a que el
profesional la conozca. Las dos cosas son necesarias, pero no son la misma cosa.

### Y antes de eso: el menú no sabe si el paciente es vegano

Buscando lo anterior encontré algo peor que el marisco. El campo del patrón alimentario —`d4_34`:
vegetariano, vegano, keto, sin gluten, sin lácteos, bajo en sal— **no aparece ni una vez en la zona
donde se arma el menú.** Está en la declaración, en la pantalla y en el contador, y ahí se queda.

Hoy el generador **le puede proponer carne a un vegano y lácteos a quien los evita**. Y es más grave que
la alergia al marisco por una razón: una alergia excluye un alimento, un patrón alimentario **condiciona
todas las comidas del plan**. Un plan que se lo salta no es un plan con un error: es un plan que el
paciente no va a poder seguir ni un día.

**Esto entra al generador antes que cualquier otra cosa que estemos discutiendo.**

---

## Lo que debe aparecer en el diagnóstico de cada profesional

Revisé qué captura la encuesta contra lo que consume cada motor. Esto es lo que falta, por disciplina.
**Apruebo la lista completa; constrúyanla.**

### Médico

- **Tamizaje de apnea del sueño.** Ronquido, calidad del sueño, horas de sueño e IMC: los cuatro datos
  están capturados y **nadie los cruza**. En una consulta de obesidad la apnea es de lo más prevalente y
  de lo que más cambia el pronóstico. Hoy no se tamiza. Es la omisión más grande de las que encontré.
- **Medicación antihipertensiva.** El motor sabe que hay hipertensión y no sabe si está tratada. Es la
  diferencia entre una HTA controlada y una que no lo está, y cambia la conducta.
- **Alcohol y tabaco.** Riesgo hepático y cardiovascular, y modifican la lectura de la dislipidemia.
- **Cirugía digestiva o metabólica.** Un bypass obliga a vigilancia de por vida de B12, hierro y
  vitamina D.

### Nutricionista

- **Alergias e intolerancias**, como restricción del plan.
- **Patrón alimentario**, con la urgencia del punto anterior.
- **Cirugía digestiva o metabólica.** Cambia absorción y requerimiento proteico. No es un antecedente
  más: es un factor de cálculo.
- **Los siete síntomas digestivos.** Determinan fibra, lactosa y tolerancia. Ninguno llega al plan.
- **Suplementos que ya toma.** Para no duplicar: si el paciente ya toma vitamina D y el plan se la
  vuelve a recomendar, el riesgo es de sobredosificación, no de redundancia.
- **Número de comidas y desayuno habitual.** El reparto por tiempos debe partir de lo que el paciente ya
  hace, no de un reparto teórico.

### Entrenamiento

- **Tipo de actividad que realiza.** Hoy el motor prescribe ejercicio conociendo solo el diagnóstico y
  la hipertensión: **no sabe si el paciente camina, levanta pesas o no hace nada.** Es el input más
  evidente que le falta a esa disciplina.
- **Sueño y ronquido**, por recuperación y por lo del tamizaje.

### Psicología

- **Alcohol**, como consumo de sustancias.
- **Calidad del sueño**, marcador de ansiedad y depresión.
- **Inseguridad alimentaria.** Es de las asociaciones más fuertes con conducta alimentaria alterada.

---

## 3.3 · El menú respeta el reparto, y el nutricionista lo edita

**Sí, y esto ya estaba resuelto.** Se lo respondí en el P-25: todo lo nutricional lo ajusta el
nutricionista. Si él mueve el reparto por tiempos y el menú lo ignora, el ajuste es decorativo.

**El menú respeta el reparto, y el reparto es editable.** No hace falta volver a preguntarlo cada vez
que la regla toca una pieza nueva: aplíquenla.

## 7.1 · Lo que recibe el paciente

**El paciente recibe el plan completo**, no solo el informe de composición:

- el **diagnóstico**
- la **meta** y los **objetivos**
- el **plan dietético**
- el **ejemplo de menú**
- la **distribución por porciones**
- las **recomendaciones automáticas** según el caso
- la **lista de intercambio**, con la salvedad de siempre: **no la lista completa, sino los alimentos
  principales por región o ciudad**

Esa última salvedad es la misma del P-26 y no es un detalle de presentación: entregarle 350 alimentos a
un paciente no es informarlo, es abrumarlo. Van los representativos de donde vive.

**Y confirmo lo que dedujeron:** lo que hoy le mandan —IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el código
`N_N_N_A`— **no debe salir así.** Ningún índice del modelo va al paciente. Eso es el documento del
profesional.

**La historia clínica no la recibe el paciente.** Su lectura es correcta: es el documento del
profesional y de la institución. Con eso queda resuelto también su 7.4: la EB-BIS se queda en la
historia clínica y no sale de ahí.

## 7.2 · Apruebo el bloqueo

**Sí: solo se envía si el profesional lo confirma.** Su versión es más estricta que mi regla del 3 de
agosto y es la correcta. Mandarle a alguien una mala noticia sin decirle cuándo lo vuelven a ver es peor
que no mandarla.

Y sobre la consulta que quedó abierta: **«cita agendada» se cumple con la fecha de próxima consulta
registrada**, con posibilidad de edición del profesional. No exige nada más.

## 8.1 · NO fundan los dos bloques

**Son dos cosas distintas y deben seguir separadas.**

La razón es la que ustedes mismos intuyeron y luego descartaron: **la fórmula desarrollada depende de la
decisión del nutricionista de subir o bajar las calorías.** Primero se decide la meta; después se ve la
cadena que la produce. Fundirlas invierte el orden y empuja al profesional a mover la calculadora cuando
lo que quería era fijar un objetivo.

Los tres beneficios que enumeran son reales y los quiero, pero se pueden tener sin fundir: el cuadre de
macros puede mostrarse en el bloque de la fórmula, la distinción entre calculado y ajustado también, y
lo del objetivo que aparece en los dos bloques se resuelve dejándolo editable en uno solo y en lectura
en el otro.

**Y tienen razón en el desliz:** «Actividad prescrita (FA)» y «Factor actividad (PAL)» son el mismo
factor con dos nombres. Unifíquenlo en el suyo.

## 8.2 · El resumen clínico, editable

**Editable.** Que aterrice en las guías dietarias y que el profesional pueda ajustarlo está bien: es la
misma regla de siempre, el motor propone y el profesional dispone. **La caja se queda.**

## 8.3 · Las observaciones, a la historia clínica

**Deben aparecer en la historia.** Y por consulta, no por paciente.

Lo que encontraron es correcto y lo verifiqué: `notas_profesional` aparece **una sola vez en todo el
archivo, escribiendo**. Nadie la lee, y con `onConflict: 'documento'` cada control borra el anterior. Lo
que el profesional escribe hoy se pierde dos veces: se sobrescribe y no se muestra.

## 8.4 · Sí

Su orden queda, incluidos los tiempos de comida antes de la tabla de distribución. Los tiempos activos
gobiernan el reparto; ponerlos después obliga a subir a corregir.

## 9.3 · Sí, con edición del profesional

Es la fecha de próxima consulta, y el profesional puede cambiarla. Su cambio es correcto: **que se
guarde solo al confirmar**, no al proponerse. Si el sistema la agendara solo, mi regla del «empeoró»
quedaría cumplida sin que nadie decidiera nada.

---

## 9.1 · El cambio mínimo detectable: 0,1 nF

**Quiten el ruido del dispositivo. Que se reporte solo a partir de 0,1 nF de cambio.** Por debajo de eso
no se afirma nada: ni mejora, ni empeoramiento, ni estabilidad.

### Y va con una entrega: la capacitancia ya tiene referencia por sexo y edad

Añadí al archivo la tabla de percentiles de nuestro artículo de valores de referencia (5.181 adultos
latinoamericanos y europeos), estratificada **por sexo y por década de edad**:

- **`CAP_REF`** — doce filas: dos sexos por seis décadas, con P5, P10, P25, P50, P75, P90, P95 y el n de
  cada grupo.
- **`capRef(sexo, edad)`** y **`cC(v, sexo, edad)`** — el clasificador, que devuelve la etiqueta y
  además la **banda de percentil**, para que la pantalla diga dónde cae el paciente.
- La tarjeta de Seguimiento dibuja la mediana del grupo como línea de referencia. Antes iba con
  `ref: null`: no tenía ninguna.

**Por qué la estratificación no era opcional:** la mediana de un hombre de 18-29 años es **2,40 nF** y
la de una mujer de la misma edad **1,37**. Casi la mitad. Un mismo valor de 2,40 es *normal* en él y
*por encima del percentil 95* en ella.

Tres decisiones que van comentadas en el código:

- **Sin sexo o sin edad no se clasifica.** A diferencia de `calcPABU`, que cae a una k histórica, aquí
  no hay respaldo razonable: cualquier elección se equivoca en cerca de un nanofaradio.
- **Por encima de P75 se rotula «Alta», no «Óptimo».** El artículo sostiene el extremo bajo como
  hallazgo (AUC 0,890 para masa muscular reducida); el alto no lo presenta como bueno y además sube con
  el IMC.
- **No se usa azul**, a propósito. En el archivo el azul ya significa dos cosas distintas —«Óptimo» en
  `cSMM`, déficit en `cFMI`—, que es justo lo que les provocó el fallo del desnutrido en verde. Añadir
  un tercer significado lo habría empeorado.

Con esto, el ±2 años provisional de la EB-BIS sigue pendiente de su propia cifra, pero la capacitancia
ya no depende de una referencia que no existía.

---

## 8.5 y 3.5 · No puedo contestarlas sin ver el software

**Mándenme una copia o un acceso al Atlas actual.**

Su pregunta del 8.5 —qué otras salidas del modelo no están llegando a donde deberían— es buena y quiero
contestarla, pero **no tengo copia de cómo va el software**. Ustedes saben lo que consume cada pantalla;
yo sé lo que el modelo calcula. La pregunta solo se puede cerrar viendo las dos cosas a la vez, y hoy yo
solo veo una.

Lo mismo con el 3.5. Denme el acceso y las cierro las dos de una.

## 3.4 · Pendiente

El acceso a alimentos y la inseguridad alimentaria en el menú: lo dejo para la próxima. Es criterio
clínico y quiero pensarlo con calma, porque toca cómo se le presenta el plan a una persona. Sigan sin
tocarlo.

---

## Resumen

| # | Decisión |
|---|---|
| 3.1 | **Todas las preguntas entran al modelo; ninguna se retira.** Y **su inventario está equivocado**: 22 de las 25 tienen consumidores reales. Rehacerlo sobre todo el archivo, no solo los cuatro motores |
| 3.1b | Lo cierto: los motores leen **5, 3 y 2 campos**. Ese es el problema real |
| 3.2 | Alergias a **los cuatro profesionales** y a los objetivos del plan. En nutrición como **restricción**; en los demás como **contexto** |
| 3.2b | **El menú no sabe si el paciente es vegano** (`d4_34` no llega al generador). Entra antes que nada |
| — | **Contenido diagnóstico por profesión: aprobada la lista completa.** Lo mayor: **tamizaje de apnea** en médico y **tipo de actividad** en entrenamiento |
| 3.3 | El menú **respeta** el reparto; el reparto es editable. Ya estaba resuelto en el P-25 |
| 3.4 | **Pendiente**, lo decido con calma |
| 7.1 | El paciente recibe **el plan completo**. Ningún índice del modelo. **La historia clínica no la recibe** |
| 7.2 | **Apruebo el bloqueo.** «Cita agendada» = fecha de próxima consulta registrada, editable |
| 8.1 | **NO fundir.** Son dos cosas: la fórmula depende de si el nutricionista sube o baja las calorías. Unificar el nombre del factor de actividad |
| 8.2 | **Editable.** La caja se queda |
| 8.3 | **A la historia clínica, y por consulta.** Hoy se sobrescribe y no la lee nadie |
| 8.4 | **Sí**, su orden |
| 8.5 · 3.5 | **Mándenme copia del software.** Sin verlo no puedo contestarlas |
| 9.1 | **0,1 nF.** Por debajo no se afirma nada. Va **`CAP_REF`** en el archivo: percentiles por sexo y década |
| 9.3 | **Sí**, con edición del profesional. Se guarda al confirmar |

**Lo primero de todo:** el patrón alimentario al generador de menú. Lo segundo, rehacer el inventario
del 3.1.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
