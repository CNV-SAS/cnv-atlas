# Tres preguntas cortas antes de portar `motorTratNutri` · 2026-08-24

**De:** Equipo Atlas · **Para:** Gildardo Uribe

Recibida tu respuesta del 23. **Vamos a portar `motorTratNutri` con las tres correcciones**, y antes de hacerlo necesitamos confirmar tres cosas, porque **las tres cambian QUÉ se porta, no cómo**. Portar y rehacer después no es opción: es el motor de toda la prescripción nutricional.

Son cortas. Van sueltas y no en la ronda acumulada, para que puedas responderlas hoy si quieres.

Y al final, **la respuesta a tu pregunta** sobre salud celular.

---

## 1. "Por grupo": tu tabla tiene tres niveles, y creemos que hablamos de dos cosas distintas

Respondiste que **las porciones van por grupo** y que los alimentos aparecen dentro "para que el nutricionista los despliegue, no para que reparta porciones entre ellos".

**Tu tabla tiene tres niveles, no dos:**

| Nivel | Qué es | Cuántos | ¿Lleva casilla de porciones en tu archivo? |
|---|---|---|---|
| 1 | **Grupo** (Harinas, Lácteos, Carnes...) | 12 | **no**, es la fila de encabezado |
| 2 | **Subgrupo** (Leche entera, Leche descremada, Carnes magras...) | 21 | **SÍ**, una casilla por subgrupo |
| 3 | **Alimentos** (Kumis, Leche de cabra, Arroz blanco...) | 350 | no, se despliegan con "ver N alimentos" |

Tu frase describe el **nivel 3** exactamente cuando dice "se despliegan para verlos". Pero "por grupo", leído al pie, es el **nivel 1**.

**Y aquí está el problema:** en tu archivo la casilla de porciones está en el **nivel 2**, una por subgrupo. Es lo que portamos.

**Creemos que es un asunto de vocabulario**: nosotros te preguntamos por "los 21 alimentos" cuando en realidad son subgrupos, y tú respondiste llamando "alimentos" a los 350. Si es eso, **lo que tenemos ya es fiel a tu archivo y no hay nada que cambiar**.

**Lo que necesitamos:** ¿la casilla de porciones va en el nivel 1 (12 casillas) o en el nivel 2 (21, como está hoy en tu archivo)?

No lo cambiamos hasta que respondas: si es el nivel 2, tocarlo sería alejarnos de tu archivo, no acercarnos.

---

## 2. El déficit quedaría contado dos veces

Nos pides dos cosas que, juntas, se suman sin querer:

- **(1.2)** que el gasto se calcule sobre el **peso de referencia** (el peso meta), no sobre el actual;
- **(1.1)** que el **déficit de 500** se conserve como sugerencia editable.

**El gasto calculado sobre el peso meta ya es, por definición, la ingesta que lleva a ese peso.** Es un objetivo con el déficit dentro. Restarle además 500 kcal aplica un segundo déficit sobre el primero.

**El efecto concreto en un paciente con obesidad:** su gasto se calcula sobre un peso menor que el suyo (primera bajada), y luego se le restan 500 (segunda bajada). El objetivo puede terminar **en el piso de 1.500 / 1.200 kcal por dos vías sumadas**, no porque lo hayas prescrito así sino porque las dos correcciones se acumulan.

**Lo que necesitamos:** con el gasto ya sobre el peso de referencia, ¿el déficit sugerido sigue siendo 500, es otro número, o pasa a cero y el peso meta es el único que fija el objetivo?

---

## 3. La proteína de 1,25 no baja solo en cáncer: también en desnutrición

Anotaste 1.3 como "la fila de cáncer". **La línea de tu motor es esta:**

```js
if (hasCancer || desnutricion) { tipoEnergia = "Hipercalórica"; protKg = 1.25; ... }
```

`desnutricion` es **IMC < 18,5**. Así que al mandar `motorTratNutri`, la proteína baja de 1,5–2,0 a **1,25 g/kg también para los pacientes desnutridos**, que son los fenotipos F7 y F10 y **el perfil con riesgo de síndrome de realimentación**, donde la proteína es parte del soporte.

No es una fila: **son dos poblaciones**, y la segunda es la más frágil de las dos.

**Lo que necesitamos:** ¿1,25 aplica también al desnutrido, o esa rama debería separarse y conservar el rango más alto para desnutrición?

---

## Y una cuarta, de una línea: el par de ECM/BCM

Aplicamos tu regla ("toda la composición corporal se estratifica por sexo; si encuentran uno que no lo hace, corríjanlo y repórtenlo"). Barrimos todos los umbrales de composición del motor. **Todos la cumplen menos uno:**

> **`ECM/BCM > 1,4`**, la badge de "ECM/BCM elevado" de salud celular. No distingue sexo.

**No lo corregimos**, porque corregirlo aquí sería inventar un umbral clínico: tú diste el par para FFMI (17/15) y para FMI (6/9), pero no para este. **Danos los dos valores y lo aplicamos.**

*(Verificamos también `MCA_dif < −1`, que tampoco distingue sexo. Ahí creemos que no hace falta: es un residuo contra `MCA_ref`, que el Biody ya entrega por sexo y edad, así que la estratificación está dentro de la referencia. Si lo ves distinto, dinos.)*

---

## Tu pregunta: de dónde salió salud celular en Tratamiento

**De tu propio archivo, y no por interpretación.**

`celBadges` está en la entrega que confirmaste vigente (`ATLAS_v8.html` del 2026-08-19), en la **línea 17126**. Esa línea cae **dentro de la subpestaña del nutricionista de Tratamiento**: el bloque `tabTrat === "plan_nutricional"` abre en la línea 16595 y el del médico empieza en la 17184.

Nuestro comentario de porte cita `ATLAS_v7.html:15702-15706`, el mismo bloque en la entrega anterior. **Lo portamos de donde estaba.**

**Y eso responde lo que de verdad preguntabas:** no hay más piezas movidas de sitio por interpretación, porque esta no se movió. Lo movemos a Diagnóstico como pides, y queda claro que es un cambio tuyo y no una corrección nuestra.
