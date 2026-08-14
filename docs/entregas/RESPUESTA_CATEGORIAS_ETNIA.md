# Respuesta: categorías de etnia (¿DANE o lista propia?)

**Para:** el equipo de Atlas y la dirección científica.
**Antecedente:** dictamen previo sobre captura de etnia. Esta consulta revisa únicamente el vocabulario de categorías.

---

## Respuesta corta

La objeción de la dirección científica es correcta, pero el diagnóstico apunta a algo más profundo que una lista mal elegida: **son dos variables distintas midiendo cosas distintas, y hoy están intentando que una sola sirva para ambas.**

- **Pertenencia étnica (DANE)** responde a: ¿a qué grupo étnico reconocido pertenece usted? Es una categoría jurídico-política, ligada a derechos diferenciales.
- **Ascendencia (mestizo, blanco, afrodescendiente…)** responde a: ¿de qué poblaciones desciende usted? Es una aproximación a la variabilidad biológica.

La primera no estratifica composición corporal, y nunca fue diseñada para eso. La segunda no sirve para comparar con estadística oficial ni para enfoque diferencial.

**Recomendación: capturar las dos como preguntas separadas, ambas opcionales.** Si solo pueden capturar una, que sea la de ascendencia, asumiendo que pierden comparabilidad oficial.

---

## Lo que NO recomiendo: agregar "mestizo" a la lista del DANE

Esta es la opción que parece más simple y es la peor de las tres, por una razón metodológica: **mezclaría dos taxonomías distintas en una sola pregunta de opción única**, produciendo categorías que no son mutuamente excluyentes.

Un ejemplo concreto: una persona afrodescendiente que también se reconoce como mestiza, ¿qué marca? Una persona indígena de ascendencia mixta, ¿qué marca? Al forzar la elección entre categorías de dimensiones distintas, el dato resultante no es interpretable: no se sabe si quien marcó "mestizo" lo hizo porque no pertenece a ningún grupo étnico reconocido, o porque priorizó su ascendencia sobre su pertenencia.

Eso no solo daña la comparabilidad con el DANE; **daña la variable en sí misma**, que era el problema que se quería resolver.

---

## Qué se pierde y qué se arriesga en cada camino

| Camino | Se gana | Se pierde | Riesgo |
|---|---|---|---|
| **Solo DANE** | Comparabilidad con estadística oficial; alineación con enfoque diferencial | Capacidad de estratificar (la mayoría cae en "ninguno de los anteriores") | Ninguno legal. El riesgo es que el dato no sirva para su finalidad declarada |
| **DANE + mestizo** | Aparente solución | Coherencia metodológica; interpretabilidad del dato | Metodológico alto. Reputacional si se publica con esa variable |
| **Lista de ascendencia** | Variable útil para estratificar | Comparabilidad oficial; enfoque diferencial | Legal bajo. Científico moderado (ver abajo) |
| **Ambas, separadas** | Las dos funciones | Una pregunta más en el formulario | Ninguno adicional |

**Sobre el riesgo regulatorio de apartarse del DANE: es bajo.** No existe obligación legal de usar las categorías del DANE en un instrumento privado. Esa obligación aplica a operaciones estadísticas oficiales y a reportes al Estado, no a la captura de un dato voluntario en una plataforma clínica privada. Mientras el dato sea autodeclarado, voluntario y no condicione el servicio, la lista de categorías es una decisión metodológica de CNV, no una exigencia normativa.

**El riesgo reputacional sí merece atención**, y no por la lista en sí sino por el uso. Publicar diferencias biológicas entre categorías raciales autodeclaradas es terreno sensible. Volveré sobre esto.

---

## Una advertencia científica que conviene que ObBIA considere

Esto excede lo jurídico, pero es relevante para el diseño del estudio y prefiero decirlo que callarlo.

**La ascendencia autodeclarada es un predictor débil de variabilidad biológica.** "Mestizo" en Colombia abarca proporciones ancestrales que van desde predominantemente indígena hasta predominantemente europea, y esa heterogeneidad interna suele ser mayor que la diferencia entre categorías. Una persona que se declara mestiza en Nariño y otra en Santander pueden tener composiciones ancestrales muy distintas.

Además, la medicina viene retirando activamente las correcciones raciales de sus algoritmos. El caso más conocido es el de la tasa de filtración glomerular estimada: durante décadas incluyó un coeficiente racial que fue eliminado en 2021 tras concluirse que carecía de fundamento biológico sólido y producía retrasos en el acceso a trasplante para pacientes negros. Algo similar ocurre con las correcciones raciales en espirometría. La tendencia es clara: **usar categorías raciales como proxy de biología es cada vez menos defendible**, tanto científica como éticamente.

Si ObBIA quiere estratificar por variabilidad poblacional, hay variables que capturan mejor lo que realmente importa para composición corporal y que no cargan ese problema: región de origen o de residencia prolongada, altitud, ascendencia de los cuatro abuelos si se quiere precisión, o directamente las variables antropométricas y de estilo de vida que ya recogen.

**Esto no significa no capturar el dato.** Significa que si el objetivo declarado es "considerar las diferencias de composición corporal entre poblaciones", conviene que el protocolo de investigación sea explícito sobre qué se está midiendo y cuáles son sus límites, especialmente si se va a publicar. Un revisor de una revista indexada va a hacer exactamente esta objeción.

---

## Pregunta 2: ¿cambian las reglas de gobernanza?

**No. Son independientes del vocabulario.**

Las reglas que definimos (supresión de celdas por debajo del umbral, uso exclusivamente agregado, autorización de investigación como condición) dependen del **tamaño de cada grupo en la muestra**, no del nombre de las categorías. Si una categoría tiene menos observaciones que el umbral, se suprime, se llame "Rrom" o "mulato".

Dicho eso, hay un efecto secundario que conviene notar: **una lista de ascendencia probablemente produzca celdas más grandes** (si 80% se declara mestizo, esa celda no tendrá problema de reidentificación), lo que reduce la frecuencia con que la regla de supresión se activa. Eso no relaja la regla, solo la hace menos visible en la práctica. El riesgo se concentra entonces en las categorías minoritarias de esa lista, exactamente igual que antes.

Si capturan **ambas variables**, la regla de supresión debe evaluarse sobre el cruce, no sobre cada variable por separado. Alguien que se declare indígena y de ascendencia indígena en una cohorte pequeña puede ser identificable aunque cada variable aislada parezca segura.

---

## Sobre el consentimiento: su lectura es correcta

Confirmo lo que anotan: **cambiar la lista de categorías no dispara un nuevo consentimiento.** El texto vigente habla de "pertenencia étnica" sin enumerar categorías, y el artículo 5 de la Ley 1581 cubre tanto el origen racial como el étnico bajo la misma categoría de dato sensible. Cualquiera de las dos listas queda amparada por la autorización ya otorgada.

**Con una precisión, si adoptan ambas variables:** el texto del numeral 5 dice "su pertenencia étnica" en singular. Si van a capturar también ascendencia, conviene ajustar esa frase a algo como *"su pertenencia étnica y su ascendencia"* en la próxima revisión del documento. No es urgente ni invalida lo capturado mientras tanto, pero deja el texto alineado con lo que realmente se recoge.

---

## Recomendación operativa concreta

**Opción preferida: dos preguntas separadas, ambas opcionales.**

*Pregunta 1 (pertenencia étnica, categorías DANE):*
> ¿Usted se autorreconoce como perteneciente a alguno de estos grupos étnicos?
> Indígena · Gitano o Rrom · Raizal · Palenquero · Negro, mulato, afrodescendiente o afrocolombiano · Ninguno de los anteriores · Prefiero no responder

*Pregunta 2 (ascendencia, para análisis de composición corporal):*
> Independientemente de lo anterior, ¿cómo describiría principalmente su ascendencia?
> Predominantemente indígena · Predominantemente europea · Predominantemente africana · Mezcla de dos o más de las anteriores · No sé · Prefiero no responder

El "Independientemente de lo anterior" es deliberado: señala al paciente que no es la misma pregunta repetida, que es la confusión más probable al ver dos preguntas parecidas seguidas.

**Si solo puede haber una pregunta**, use la de ascendencia y documente en el protocolo que se renunció a la comparabilidad con estadística oficial a cambio de capacidad de estratificación. Es una decisión defendible siempre que sea consciente y esté documentada.

**En ambos casos se mantiene el principio de autorreconocimiento:** el dato lo declara la persona sobre sí misma, nunca lo asigna el profesional ni lo infiere el sistema.
