# Ronda para Gildardo · 2026-08-24

**De:** Equipo Atlas · **Para:** Gildardo Uribe, Dirección Científica CNV

**Recibida tu respuesta del 23.** Ya aplicamos lo que cerraba sin ambigüedad: retiramos la residencia prolongada y sus dos columnas, movimos **salud celular a Diagnóstico**, y rotulamos la lista de intercambio como **lista base**, diciendo en pantalla que la selección por ciudad está pendiente, para que ningún profesional la entregue creyendo que ya está adaptada a su paciente. Y **descartamos de esta ronda todo lo que tu respuesta ya resolvió**, por eso es más corta de lo que iba a ser.

**Vamos a portar `motorTratNutri` con tus tres correcciones.** Antes necesitamos las cuatro respuestas de la Parte 1: **las cuatro cambian QUÉ se porta, no cómo**, y portar y rehacer no es opción en el motor de toda la prescripción.

---

# Parte 1 · Cuatro cosas cortas, antes de portar

## 1.1 · "Por grupo": tu tabla tiene tres niveles y creemos que hablamos de dos cosas distintas

Respondiste que las porciones van **por grupo**, y que los alimentos aparecen dentro "para que el nutricionista los despliegue, no para que reparta porciones entre ellos".

**Tu tabla tiene tres niveles, no dos:**

| Nivel | Qué es | Cuántos | ¿Lleva casilla de porciones en tu archivo? |
|---|---|---|---|
| 1 | **Grupo** (Harinas, Lácteos, Carnes...) | 12 | **no**, es la fila de encabezado |
| 2 | **Subgrupo** (Leche entera, Leche descremada, Carnes magras...) | 21 | **SÍ**, una casilla por subgrupo |
| 3 | **Alimentos** (Kumis, Leche de cabra, Arroz blanco...) | 350 | no, se despliegan con "ver N alimentos" |

Tu frase describe el **nivel 3** exactamente cuando dice "se despliegan para verlos". Pero "por grupo", leído al pie, es el **nivel 1**. Y en tu archivo la casilla está en el **nivel 2**: una por subgrupo. Es lo que portamos.

**Creemos que es vocabulario:** nosotros te preguntamos por "los 21 alimentos" cuando en realidad son subgrupos, y tú respondiste llamando "alimentos" a los 350. Si es eso, lo que tenemos ya es fiel y no hay nada que cambiar.

**¿La casilla de porciones va en el nivel 1 (12) o en el nivel 2 (21, como está hoy en tu archivo)?**

No lo tocamos hasta que respondas: si es el nivel 2, cambiarlo sería alejarnos de tu archivo, no acercarnos.

## 1.2 · El déficit quedaría contado dos veces

Nos pides dos cosas que, juntas, se suman sin querer:

- **(1.2)** que el gasto se calcule sobre el **peso de referencia** (el peso meta), no sobre el actual;
- **(1.1)** que el **déficit de 500** se conserve como sugerencia editable.

**El gasto calculado sobre el peso meta ya es, por definición, la ingesta que lleva a ese peso.** Es un objetivo con el déficit dentro. Restarle además 500 aplica un segundo déficit sobre el primero.

**El efecto concreto en un paciente con obesidad:** su gasto se calcula sobre un peso menor que el suyo (primera bajada) y luego se le restan 500 (segunda bajada). El objetivo puede terminar **en el piso de 1.500 / 1.200 kcal por dos vías sumadas**, no porque lo hayas prescrito así sino porque las dos correcciones se acumulan.

**Con el gasto ya sobre el peso de referencia, ¿el déficit sugerido sigue siendo 500, es otro número, o pasa a cero y el peso meta es el único que fija el objetivo?**

## 1.3 · La proteína de 1,25 no baja solo en cáncer: también en desnutrición

Anotaste 1.3 como "la fila de cáncer". **La línea de tu motor es esta:**

```js
if (hasCancer || desnutricion) { tipoEnergia = "Hipercalórica"; protKg = 1.25; ... }
```

`desnutricion` es **IMC < 18,5**. Así que al mandar `motorTratNutri` la proteína baja de 1,5–2,0 a **1,25 g/kg también para los desnutridos**, que son los fenotipos F7 y F10 y **el perfil con riesgo de síndrome de realimentación**, donde la proteína es parte del soporte.

No es una fila: **son dos poblaciones**, y la segunda es la más frágil.

**¿1,25 aplica también al desnutrido, o esa rama debería separarse y conservar el rango más alto para desnutrición?**

## 1.4 · El par de ECM/BCM

Aplicamos tu regla ("toda la composición corporal se estratifica por sexo; si encuentran uno que no lo hace, corríjanlo y repórtenlo"). Barrimos **todos** los umbrales de composición del motor. **Todos la cumplen menos uno:**

> **`ECM/BCM > 1,4`**, la badge de "ECM/BCM elevado" de salud celular. No distingue sexo.

**No lo corregimos**, porque corregirlo sería inventar un umbral clínico: diste el par para FFMI (17/15) y para FMI (6/9), pero no para este. **Danos los dos valores y lo aplicamos.**

*(Verificamos también `MCA_dif < −1`, que tampoco distingue. Ahí creemos que no hace falta: es un residuo contra `MCA_ref`, que el Biody entrega por sexo y edad, así que la estratificación ya está dentro de la referencia. Si lo ves distinto, dinos.)*

---

# Parte 2 · Tu pregunta: de dónde salió salud celular en Tratamiento

**De tu propio archivo, y no por interpretación.**

`celBadges` está en la entrega que confirmaste vigente (`ATLAS_v8.html` del 2026-08-19), en la **línea 17126**. Esa línea cae **dentro de la subpestaña del nutricionista de Tratamiento**: el bloque `tabTrat === "plan_nutricional"` abre en la 16595 y el del médico empieza en la 17184.

Nuestro comentario de porte cita `ATLAS_v7.html:15702-15706`, el mismo bloque en la entrega anterior. **Lo portamos de donde estaba.**

**Y eso responde lo que de verdad preguntabas:** no hay más piezas movidas de sitio por interpretación, porque esta no se movió. **Ya está en Diagnóstico**, junto a la composición, y queda claro en el código que el cambio es tuyo y no una corrección nuestra.

---

# Parte 3 · El menú: cuatro cosas que quizá debería mirar y no mira

Estábamos por rehacer el generador de menús para que **adapte** el menú base según las restricciones, como hace el tuyo. Antes de escribir ese prompt necesitamos saber qué debe mirar, porque cada versión queda registrada y no queremos versionarlo dos veces.

**Lo que el menú mira HOY en Atlas:** objetivo calórico · proteína objetivo · restricciones del modelo · restricciones que escribe el profesional · fenotipo estructural · sector funcional · rutas priorizadas.

## 3.1 · Las alergias y las intolerancias no llegan (esto es seguridad)

Un paciente que declaró **alergia a los mariscos puede recibir un menú con mariscos**, salvo que el profesional la teclee a mano.

La encuesta las captura con opciones cerradas: alergias (leche, huevo, maní, trigo, soya, pescado, mariscos) e intolerancias (lactosa, gluten, fructosa).

**Verificamos qué hace tu archivo:** las lee **en un solo sitio**, para el párrafo clínico ("presenta ... alergia a X"). En toda el área del plan y del menú no aparecen. **Tampoco llegan al menú en tu prototipo**, así que es probable que sea una conexión que no se pensó.

**Y hay algo que lo empeora, que apareció al armar la historia clínica.** Esa historia sí va a mostrar las alergias, porque salen de la encuesta. Es decir: el documento clínico que firma el profesional **va a decir que el paciente es alérgico al marisco**, en la misma consulta en la que el menú se lo puede servir. No es que el dato falte: es que el dato está a la vista en una hoja y ausente en la otra. Un plan que contradice a la historia clínica del mismo paciente es peor que un plan sin el dato, porque parece verificado.

**Nuestra propuesta:** que viajen al menú **en bloque propio y por encima de todo lo demás**. Una restricción médica se puede matizar; una alergia declarada, no. ¿La apruebas? ¿Y la intolerancia igual de dura, o con matiz (la lactosa admite grados, el maní no)?

## 3.2 · El menú no sabe cuántas porciones lleva cada comida

El desayuno del menú **no refleja las porciones que la distribución le asignó al desayuno**. La cadena va objetivo → intercambio → distribución → menú, y **se corta en el último eslabón**.

**Verificado también en tu archivo:** la distribución (`interDist`) solo la lee su propia tabla; ningún código del menú la toca.

Tu respuesta a P-25 nos dice que los porcentajes por tiempo son un valor por defecto que el nutricionista ajusta. Eso hace la pregunta más concreta: **si el profesional ajusta el reparto, ¿el menú debe respetarlo, o solo tenerlo en cuenta?** Hoy no hace ninguna de las dos.

## 3.3 · El contexto del paciente: acceso e inseguridad alimentaria

Un paciente con inseguridad alimentaria o acceso limitado **no debería recibir un menú con salmón**.

**El dato ya existe y ya lo usas:** tu párrafo del resumen dice "presenta inseguridad alimentaria frecuente" o "con acceso fácil a alimentos frescos". Lo portamos tal cual. Lo que no ocurre es que llegue al menú.

**Esto no lo proponemos: te lo preguntamos.** Que un menú se module por la situación socioeconómica es criterio clínico y toca cómo se le presenta el plan a una persona. ¿Debe considerarlo? Y si sí, ¿cómo lo dirías sin que el paciente lea un plan que le recuerda lo que no puede comprar?

## 3.4 · Y la pregunta de fondo: ¿qué más?

Las tres de arriba aparecieron **buscando otra cosa**. Si tres salen solas, probablemente haya más que no vemos porque no sabemos qué buscar. **Con la lista de lo que hoy viaja (arriba), ¿qué falta?**

---

# Parte 4 · Lo que aplicamos con tu regla, sin preguntarte

Tu regla del 23 (**el motor propone, el profesional dispone**) resolvió esto sin que haga falta una pregunta aparte. Lo declaramos para que lo sepas, no para que decidas:

**Una comida activa y vacía.** Se puede dejar el desayuno activo y repartirle cero porciones: el plan queda diciendo dos cosas a la vez. Tu archivo compara la suma **por alimento** (bien), pero no tiene verificación **por tiempo de comida**, así que ese caso pasa sin marca.

**Lo aplicamos como tu regla indica: avisa y deja guardar**, igual que el descuadre por alimento. El texto dice cuál es la salida: *"El desayuno está activo pero no tiene porciones asignadas. Si el paciente no hace esa comida, apaga la casilla."*

Si prefieres que no se avise, se quita en una línea.

---

# Parte 5 · Tres cosas que encontramos mirando tu archivo (informativo)

No requieren nada de ti. Van porque cambian qué tenemos que construir.

**Tu plan tiene dos caras.** La lista de intercambio del paciente está marcada como "solo impresión": no se ve en pantalla. Al mirarlo completo, lo que se imprime **excluye lo técnico** (fórmula sintética, tabla de trabajo, validación) y deja lo que el paciente usa. Nos parece bien y no lo teníamos modelado. **La dejamos visible en pantalla por ahora**, porque todavía no tenemos superficie de impresión; la moveremos cuando construyamos el envío. Lo decimos para que no parezca que la pusimos ahí por decisión propia.

**Hay cuatro salidas al paciente, no una:** el plan impreso, un correo que hoy manda una sola línea sin adjunto, el envío del informe de composición a la app del paciente, y la impresión de la pestaña completa. Son **tres documentos por dos canales**; nos sirve para ordenar el bloque de envío antes de construirlo.

**Tu historia clínica tiene once secciones** y nuestro reporte en PDF trae seis. No es una pregunta: es alcance que no teníamos dimensionado, y probablemente sea una pestaña propia.

---

# Resumen

| # | Qué | Tipo |
|---|---|---|
| 1.1 | ¿La casilla de porciones va en el nivel 1 o en el 2? | **Bloquea el porte** |
| 1.2 | ¿El déficit sigue en 500 con el gasto ya sobre el peso meta? | **Bloquea el porte** |
| 1.3 | ¿1,25 g/kg aplica también al desnutrido? | **Bloquea el porte** |
| 1.4 | El par H/M de ECM/BCM | Dato que falta |
| 2 | Salud celular salió de tu archivo, línea 17126 | **Respuesta a tu pregunta** |
| 3.1 | **Alergias e intolerancias al menú** | Propuesta, seguridad |
| 3.2 | ¿El menú debe respetar el reparto por tiempos? | Pregunta |
| 3.3 | ¿El menú debe considerar el acceso a alimentos? | Criterio tuyo |
| 3.4 | ¿Qué más debería alimentar el menú? | Pregunta abierta |
| 4 | Aviso de comida activa y vacía: aplicado con tu regla | Declaración |
| 5 | Dos caras, cuatro salidas, historia clínica | Informativo |

**Lo que bloquea es la Parte 1.** El resto lo seguimos construyendo mientras respondes.
