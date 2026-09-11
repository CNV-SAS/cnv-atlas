# Respuesta a la consulta sobre equivalencias de alérgenos

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 11 de septiembre de 2026

---

## 0. No hay tabla que firmar: la retiraron ustedes el 28 de agosto

**Esta consulta pregunta por una decisión tomada, aceptada y ejecutada.** Es la tercera vez que la pieza
vuelve, esta vez con otro producto de ejemplo.

| Fecha | Documento | Qué dice |
| --- | --- | --- |
| 26-ago | Ronda, §10 | Construyen el filtro de alergias y dos tablas redactadas por el equipo |
| **27-ago** | **Mi respuesta, §10** | *«Nada de tablas de alérgenos, ni de equivalencias, ni de filtros. Retiren las dos tablas.»* |
| 28-ago | Ronda, apertura | *«Retirado y commiteado»*: las tablas, el filtro en código, el bloqueo del menú y el descarte con motivo. Y: *«se cae también la pregunta que traíamos sobre el alérgeno de LUVIA»* |
| 1-sep | Ronda, cierre | *«Sigue esperando… el bloqueo activo del alérgeno frente a la opinión del asesor legal (ronda del 28)»* |
| 11-sep | Esta consulta | La tabla vuelve, ahora con bloqueo activo y con LUVIA retenido hasta que yo la firme |

**Sobre la fila del 1 de septiembre.** La ronda del 28 no contiene esa pregunta: contiene lo contrario,
que la de LUVIA se había caído. Y en ninguna ronda hay una opinión del asesor legal sobre el alérgeno; la
única consulta legal de la ronda del 1 es la del 10.2, sobre el acceso del paciente a su historia clínica.
**Si esa opinión existe, envíenla por escrito. Si no existe, retiren la referencia**, porque así es como
una pregunta cerrada vuelve a figurar como pendiente.

---

## 1. Lo que el sistema hace con las alergias, otra vez

Lo mismo que el 27 de agosto, sin cambios:

- **Aparece que el paciente tiene alergias o intolerancias**, tal como las declaró en la P43 y la P44.
- **El profesional indaga cuáles en la consulta y decide cómo las trata.** Esa es su función, no la del
  software.
- **La pantalla no dice que nada fue verificado contra las alergias**, porque no lo será.

**No se bloquea nada, no se exige confirmación y no se registra quién la dio.** El mecanismo que describe
la consulta es el del 10.4 del 26 de agosto, y se cayó con las tablas.

---

## 2. Las tres preguntas

**1. La regla de la avena.** No hay regla. Ni «avena implica gluten», ni directa, ni con excepción por
certificación. **Traducir ingredientes a alergias es contenido clínico que mi archivo no tiene**, y es
exactamente lo que este software no debe hacer.

**2. Leche contra lactosa.** Son dos preguntas distintas y el paciente contesta cada una, como dije el 3
de septiembre. Esa respuesta se cita en la consulta para sostener la tabla, y dice lo contrario: **la
distinción es del paciente**, no de un cruce entre la encuesta y la ficha de un producto.

**3. Frutos secos.** **La P43 queda como está.** Lo que no está en la lista, el paciente lo escribe en
«Otras», y aparece tal como lo escribió.

---

## 3. «Otra» y la nota del 30 de agosto

La nota del 30 dice que **un dato que falta** no puede entrar al cálculo como si fuera una respuesta
favorable. **«Otra» con su texto no es un dato que falta: es un dato que el paciente dio**, con
consentimiento firmado e identidad verificada. Y no hay cálculo al que entre, porque no hay filtro.

Se muestra lo que escribió. **No va confirmación.**

---

## 4. LUVIA

**La retención de LUVIA estaba atada a esta firma. Sin firma pendiente, no hay nada que esperar**: se
porta como está en mi archivo, con `disponible: true` y el alérgeno que declara su ficha.

Sobre la responsabilidad que plantea la consulta: el plan lo revisa el profesional antes de entregarlo,
como cualquier documento que él firma. Ustedes mismos escribieron el 26 de agosto lo que un filtro así no
detecta: *un alimento que contiene el alérgeno sin nombrarlo*. Un bloqueo que parece proteger y no
protege no le quita la responsabilidad a CNV; **la esconde detrás de una pantalla que el profesional
aprende a creerle.**

---

## Resumen

| # | Decisión |
| --- | --- |
| **0** | **No hay tabla que firmar.** Se decidió el 27 de agosto y ustedes la retiraron el 28. La referencia a una opinión del asesor legal sobre el alérgeno **no aparece en ninguna ronda**: se envía por escrito o se retira |
| **1** | Las alergias e intolerancias **aparecen como el paciente las declaró**; el profesional indaga. **Sin bloqueo, sin confirmación, sin registro de quién la dio** |
| **2.1** | **Avena: no hay regla**, ni directa ni con certificación |
| **2.2** | Leche y lactosa **siguen siendo dos preguntas del paciente**. No se cruzan con productos |
| **2.3** | **La P43 queda como está.** Lo que falta va en «Otras» |
| **3** | «Otra» con texto **es un dato dado, no un dato que falta.** Se muestra; no exige confirmación |
| **4** | **LUVIA se porta como está en mi archivo**, con el alérgeno que declara su ficha |

---

## Lo que va aplicado en el `ATLAS_v8.html` de esta entrega

| Cambio | Antes | Ahora |
| --- | --- | --- |
| Tarjeta de LUVIA, campo `alergenos` | «Contiene avena (gluten)» | **«Contiene avena»**, como la ficha |
| Comentario de `OTROS_PRODUCTOS` | «Contiene avena, o sea gluten… el sistema no lo cruza **todavía** con las alergias de la encuesta» | «Contiene avena: el alérgeno se muestra en la tarjeta tal como lo declara la ficha. El sistema no lo cruza con las alergias de la encuesta» |

**El error era de mi archivo**: el «(gluten)» y el «todavía» sugerían un cruce pendiente que nunca
aprobé. Porten el texto nuevo.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
