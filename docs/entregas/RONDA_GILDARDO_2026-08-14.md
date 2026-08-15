# Ronda para Gildardo, 2026-08-14 (consolidada)

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 14 de agosto de 2026

Esta ronda junta todo lo que quedó abierto, en orden de prioridad: primero lo clínico (afecta lo que ve el profesional y el tratamiento), después la etnia (la que más te va a hacer pensar), y al final las técnicas de números. Verificamos cada punto contra tus respuestas del 9, 12 y 13; lo que ellas ya cerraron no vuelve aquí.

---

# A. Preguntas

## 1. El veto conductual: ¿aviso o candado? (lo más urgente, es clínico)

Cuando el dominio conductual activa el veto, tu HTML muestra dos instrucciones: en la tarjeta, *"Veto conductual: no iniciar intervención nutricional restrictiva"*, y en el encabezado del DFI, *"Alerta conductual activa: la prioridad es el abordaje psicológico. Queda excluida toda intervención nutricional restrictiva"*. Ya las portamos con tus cadenas exactas (antes Atlas solo mostraba un badge "Veto activo" sin decir qué significaba; un aviso sin su contenido no orienta).

Falta una decisión que es tuya, porque cambia el flujo de tratamiento:

**¿El veto es un AVISO o un CANDADO?** Es decir, ¿alcanza con mostrarle al profesional la instrucción (y él decide), o el sistema debe **bloquear** la prescripción de una intervención nutricional restrictiva mientras el veto esté activo?

El dato que lo hace respondible: **hoy el veto NO se consume en el módulo de tratamiento.** Solo aparece la ruta conductual como prioritaria y se muestra el aviso. Si quieres que "queda excluida" sea una barrera dura (que el sistema impida guardar un protocolo restrictivo), hay que construirla; no existe todavía.

## 2. El riesgo integrado con la encuesta incompleta: ¿suspender o conservar? (clínico, P-21)

Cuando implementamos la suspensión por encuesta incompleta (lo que nos indicaste: con la encuesta incompleta no se emiten la edad bioeléctrica, el índice contextual ni las rutas que dependen de ella), medimos el efecto sobre un mismo paciente: la edad bioeléctrica se inflaba 14 años y **el riesgo integrado del DFI subía un nivel (de MEDIO a ALTO)**.

El riesgo integrado es un promedio ponderado de los cinco dominios, y dos de ellos (envejecimiento y contextual) se calculan sobre esas mismas salidas suspendidas, así que hereda la inflación. No lo nombraste entre las tres que se suspenden.

**¿Debe suspenderse también con la encuesta incompleta, o se conserva como orientación con su rótulo?**

En el interín, Atlas hace lo conservador: con la encuesta incompleta NO mostramos el nivel concreto (marcamos "Provisional, se recalcula al completar la encuesta") y los dos dominios inflados se marcan "No evaluable". Si respondes que se conserva como orientación, relajamos el display; si respondes que se suspende, ya estamos ahí.

## 3. Categorías de etnia: son dos variables distintas (la que más pensarás)

Planteaste que las categorías de etnia de Atlas no incluyen "mestizo", y que en Latinoamérica la mayoría lo somos. Llevamos la observación al asesor legal (las categorías DANE las adoptamos por su recomendación previa de comparabilidad, no era algo que pudiéramos revertir solos). Su respuesta cambió el marco.

**El fondo:** hay dos variables distintas, y hoy le pedimos a una sola casilla que responda las dos.
- **Pertenencia étnica (DANE):** ¿a qué grupo étnico reconocido perteneces? Categoría jurídico-política, ligada a derechos diferenciales. **No** estratifica composición corporal.
- **Ascendencia (mestizo, blanco, afrodescendiente...):** ¿de qué poblaciones desciendes? Aproxima variabilidad biológica. **No** compara con estadística oficial.

Por eso "mestizo" no está en el DANE: el DANE mide pertenencia, no ascendencia.

**Las opciones, con lo que se gana y se pierde:**

| Camino | Se gana | Se pierde | Riesgo |
|---|---|---|---|
| Solo DANE (lo de hoy) | Comparabilidad oficial; enfoque diferencial | Estratificar (la mayoría cae en "ninguno") | Ninguno legal |
| DANE + "mestizo" | Solución aparente | Interpretabilidad del dato | Metodológico alto |
| Lista de ascendencia | Variable útil para estratificar | Comparabilidad oficial | Legal bajo; científico moderado |
| Ambas, separadas | Las dos funciones | Una pregunta más | Ninguno adicional |

El asesor **descarta agregar "mestizo" al DANE**: mezclaría dos taxonomías en una pregunta de opción única y las categorías dejarían de ser excluyentes (una persona afrodescendiente que también se reconoce mestiza, ¿qué marca?). Y aclara que **apartarse del DANE no tiene riesgo legal**: no hay obligación de usarlo en un instrumento privado; mientras el dato sea voluntario y no condicione el servicio, la lista es una decisión metodológica, no normativa. La decisión, entonces, es científica y es tuya.

**Su recomendación: dos preguntas separadas, ambas opcionales.**
- *Pertenencia (DANE):* Indígena · Gitano o Rrom · Raizal · Palenquero · Negro, mulato, afrodescendiente o afrocolombiano · Ninguno de los anteriores · Prefiero no responder.
- *Ascendencia:* Predominantemente indígena · Predominantemente europea · Predominantemente africana · Mezcla de dos o más de las anteriores · No sé · Prefiero no responder (precedida de "Independientemente de lo anterior").

**Y una advertencia científica que es de tu terreno y puede cambiar tu respuesta (te la damos entera):**

- La ascendencia autodeclarada es un predictor débil de variabilidad biológica. "Mestizo" en Colombia abarca proporciones ancestrales que van desde predominantemente indígena hasta predominantemente europea, y esa heterogeneidad interna suele ser mayor que la diferencia entre categorías. Una persona que se declara mestiza en Nariño y otra en Santander pueden tener composiciones ancestrales muy distintas.
- La medicina viene retirando activamente las correcciones raciales de sus algoritmos. El caso más conocido es la tasa de filtración glomerular estimada: durante décadas incluyó un coeficiente racial que fue eliminado en 2021, tras concluirse que carecía de fundamento biológico sólido y producía retrasos en el acceso a trasplante para pacientes negros. Algo similar ocurre con las correcciones raciales en espirometría. La tendencia es clara: usar categorías raciales como proxy de biología es cada vez menos defendible, científica y éticamente.
- Su alternativa: si el objetivo es estratificar por variabilidad poblacional, hay variables que capturan mejor lo que importa para composición corporal, sin ese problema: región de origen o de residencia prolongada, altitud, ascendencia de los cuatro abuelos si se quiere precisión, o las variables antropométricas y de estilo de vida que ya se recogen.
- Advertencia editorial: publicar diferencias biológicas entre categorías raciales autodeclaradas es terreno sensible; un revisor de una revista indexada va a hacer exactamente esta objeción.

**Lo que necesitamos de ti:** ¿qué camino tomamos? (dos preguntas separadas, una sola, una lista distinta, o incorporar alguna de las variables alternativas). El cambio de vocabulario no toca el consentimiento ni la gobernanza de datos (lo verificamos), así que ajustamos la lista sin fricción cuando definas.

## 4. La opción "Otro" en la encuesta: las siete restantes (ECA4b)

Propusimos agregar la opción "Otro" (con texto libre) a nueve preguntas: d2_21, d3_25, d4_34, d4_35, d5_38, d5_42, d6_43, d6_44, d8_59.

Vimos que en tu archivo al día ya implementaste **dos**: d4_35 (suplementos, "Otros") y d6_43 (alergias, "Otras"). Las portamos (encuesta v4).

**Pregunta:** ¿las otras siete también llevan "Otro", o solo esas dos? Ojo con d5_38 y d6_44: alimentan el motor, así que si llevan "Otro" con texto libre, ese texto no mapea a un valor del motor (quedaría como registro). ¿Cómo quieres que se maneje ahí?

## 5. La MCA derivada y el ISCM (P-22), con el hilo de la FFW

Cotejando un caso real (masculino, 22 años, mismo archivo Biody BIS), la composición, los indicadores, el fenotipo (los 81 estados) y toda la cadena LE8 (ICEC 69 · EB-BIS 34,3 · IAE +12,3) coinciden componente por componente. Hay una sola divergencia de valor: el ISCM. El nuestro da **−5,09**, el tuyo **−1,75**.

Tu `computeISCM` es byte-idéntico al nuestro; la diferencia es un solo insumo, la **MCA_dif**. Tu HTML la lee de una columna del export (`...ECARTTHEORIQUEEXPORT kg`) que el export corto del Biody NO trae, así que tu MCA queda "—" y tu ISCM usa ese término en 0. Nuestro import SÍ deriva la MCA con tu propia fórmula (`MCA = 1,0162 × AIC + MPM`) y de ahí MCA_dif = 4,86, que entra al ISCM y lo lleva a −5,09. Anular ese término deja ≈ −1,75.

Los dos valores clasifican igual aquí (ISCM-1, Bajo riesgo), así que el profesional ve lo mismo y ninguna ruta cambia. Pero en un paciente con MCA_dif negativo (déficit celular) el término podría cambiar la clase.

**Pregunta:** ¿la MCA debe derivarse cuando el equipo no la trae, y entrar al ISCM (como hacemos), o quedar sin valor y el ISCM calcularse sin ella (como tu HTML)?

**Hilo asociado (la FFW):** el IEHH también diverge poco (0,805 nuestro vs 0,89 tuyo). No usa MCA; viene de una diferencia en la FFW derivada (la tuya ~44,8, la nuestra 41,95 = ACT − 0,15 × FM). ¿Qué derivación de la FFW alimenta tus índices?

---

# B. Confirmaciones (no requieren que decidas nada)

- **El radar de severidad** (pregunta de la ronda anterior): verificamos en tu archivo del 13 que el radar ya usa cuatro niveles (Bajo / Leve / Moderado / Alto), la misma escala que la severidad por dominio. Damos por resuelto que el radar mide lo mismo que la severidad por dominio, salvo que nos corrijas.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
