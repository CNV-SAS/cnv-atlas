# El alérgeno de LUVIA: dos criterios opuestos, y la decisión no es clínica

**De:** Equipo Atlas · **Para:** asesor legal de CNV, vía Santiago Uribe
**Fecha:** 11 de septiembre de 2026

---

## Para qué es este documento

Atlas tiene delante **dos instrucciones que se contradicen** sobre un mismo control, y las dos vienen de
dentro de CNV. Una es de Dirección Científica y gobierna el contenido clínico. La otra está en un
documento nuestro que pasó revisión legal.

**No la estamos resolviendo nosotros, y queremos decir por qué:** lo que está en juego no es qué es
correcto clínicamente, sino **hasta dónde responde CNV frente al consumidor** si un paciente con
intolerancia declarada recibe un producto que contiene su alérgeno. Eso es tu terreno, no el nuestro.

**Mientras tanto Atlas opera con el criterio de Dirección Científica**, que es la autoridad sobre el
contenido clínico del modelo. Si tu respuesta va en el otro sentido, el cambio está acotado y lo decimos
al final.

---

## El hecho, en cuatro líneas

- **LUVIA** es un producto de tercero (Centro de Nutrición Integral Katherine Ruiz S.A.S.), en
  consignación, ya en poder de siete Integrantes: **84 unidades**.
- **Su ficha declara avena.**
- **Atlas captura las alergias e intolerancias que el paciente declara**, en dos preguntas de la encuesta
  (P43 alergias alimentarias, P44 intolerancias), firmadas con consentimiento e identidad verificada.
- O sea: **el sistema tiene los dos datos** y hoy **no los cruza**.

---

## Lo que dice el modelo comercial, y con qué razón

`MODELO_COMERCIAL_NUTRACEUTICOS_ATLAS.md`, §7.7, documento que pasó revisión legal:

> **Alérgenos.** LUVIA contiene avena, y por tanto gluten. Atlas ya captura las alergias declaradas del
> paciente, de modo que existe un deber reforzado: no basta mostrar el alérgeno, el sistema debe
> **bloquear activamente** la recomendación a un paciente con intolerancia declarada, exigiendo
> confirmación afirmativa del profesional para continuar y registrando quién la dio. Este control debe
> ser obligatorio para todo producto de tercero con alérgenos declarados.

**La razón que lo sostiene** es la responsabilidad solidaria de la Ley 1480 en una cadena de cuatro
eslabones, agravada por la doctrina del fabricante aparente: CNV entrega el producto, lo factura y lo
presenta dentro de su propio plan de tratamiento. El argumento de fondo es que **un sistema que tenía el
dato y no lo usó es más difícil de defender que uno que nunca lo tuvo**.

**Una precisión honesta sobre esa frase, porque nos importa que llegue limpia:** durante dos semanas
circuló internamente atribuida a ti, y **no la dijiste**. La verificamos a petición de Dirección
Científica: no aparece en ninguna consulta legal ni en el registro de decisiones legales. Es un argumento
**nuestro**, escrito en el modelo comercial. Te lo pasamos como lo que es, una tesis que te pedimos que
confirmes o corrijas, no como algo que ya hubieras dicho.

---

## Lo que dice Dirección Científica, y con qué razón

Gildardo Uribe, respuesta del 11 de septiembre de 2026, ratificando su instrucción del 27 de agosto:

> **No se bloquea nada, no se exige confirmación y no se registra quién la dio.**

Su criterio, en tres piezas:

1. **Traducir un ingrediente a una alergia es contenido clínico que su archivo no tiene.** «Avena implica
   gluten» no es una regla del modelo ANI-BIS-E; sería una regla que nos inventamos nosotros.
2. **El reparto de funciones es deliberado.** El sistema muestra las alergias tal como el paciente las
   declaró; **el profesional indaga cuáles y decide cómo las trata**, y revisa el plan antes de
   entregarlo, como cualquier documento que firma.
3. **Y el argumento que hay que leer dos veces, porque es el bueno**, y es nuestro, de un análisis que
   escribimos el 26 de agosto y que él nos devuelve:

> Un filtro así **no detecta un alimento que contiene el alérgeno sin nombrarlo**. Un bloqueo que parece
> proteger y no protege no le quita la responsabilidad a CNV: **la esconde detrás de una pantalla que el
> profesional aprende a creerle.**

**Por qué esto no es una objeción menor.** El control que describe la §7.7 cruzaría el alérgeno
**declarado en la ficha** contra la alergia **declarada por el paciente**. Es decir: funciona cuando el
producto nombra el alérgeno, y no funciona cuando no lo nombra, que es precisamente el caso peligroso. Y
un control que salta en muchas consultas se contesta en automático a los quince días. **La pregunta
jurídica no es solo si el control existe, es si un control parcial mejora o empeora la posición de CNV
frente a un juez.**

---

## Las tres preguntas concretas

1. **¿Un cruce parcial mejora la posición de CNV, o la empeora?** Concreto: si Atlas bloquea cuando la
   ficha nombra el alérgeno y no bloquea cuando no lo nombra, ¿esa diferencia protege a CNV o construye
   la expectativa de un control que después no cumplió?

2. **¿Basta la revisión del profesional?** Él revisa y firma el plan, con nombre, fecha y trazabilidad en
   Atlas. ¿Ese acto profesional traslada la responsabilidad, o CNV responde igual como expendedor?

3. **Si la respuesta es que el bloqueo es exigible, ¿sobre qué se construye la equivalencia?** Esta es la
   que nos bloquea a nosotros. Dirección Científica no firma «avena implica gluten» porque no es contenido
   de su modelo, y **nosotros no podemos inventar contenido clínico**. Si el bloqueo se exige, hace falta
   una fuente de las equivalencias que no seamos ni nosotros ni él: norma técnica, ficha del fabricante
   con certificación, o concepto externo. **Sin esa fuente, el control no se puede construir aunque se
   decida construirlo.**

---

## Lo que Atlas hace hoy, y lo que costaría cambiarlo

**Hoy, aplicando el criterio de Dirección Científica:**

| | |
| --- | --- |
| Las alergias e intolerancias del paciente | Se muestran al profesional tal como las declaró |
| El alérgeno de LUVIA | Se muestra como lo dice su ficha: **"Contiene avena"** |
| El titular de marca del producto de tercero | Se muestra en ficha, reporte y factura (§7.7, **esto no está en disputa y sí se cumple**) |
| El cruce entre los dos | **No existe.** Ni bloqueo, ni confirmación, ni registro |
| LUVIA | **Habilitada para venta** desde hoy |

**Si la respuesta es que el bloqueo es exigible**, el cambio es acotado y está a la mano: las tablas
existen construidas y vacías de reglas (`allergens` con sus 13 nombres, `allergen_relations` sin filas y
con campo de firma, y el puente que ya reconoce qué opción de la encuesta es qué alérgeno, en **todas**
las versiones). Lo que faltaría es **quién firma las equivalencias**, que es la pregunta 3.

**El riesgo de esperar es real y conviene decirlo:** las 84 unidades ya están repartidas y LUVIA se puede
vender desde hoy. La ventana entre esta consulta y tu respuesta es una ventana con producto vendiéndose.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
