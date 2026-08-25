# Plan · Diseño del intake del paciente

**Preparado el 2026-08-25, sin construir.** Primera superficie del trabajo de diseño gráfico.

**Por qué esta primero:** es la superficie más larga que alguien recorre **sin nadie al lado**, la que menos hemos mirado, y **no tiene equivalente en el archivo de Gildardo**. No hay cotejo que reabrir ni fidelidad que respetar: el diseño es enteramente nuestro.

**La restricción que gobierna todo el trabajo de diseño:** el diseño no puede cambiar QUÉ se muestra, solo CÓMO. Aquí eso significa que el **instrumento es de Gildardo** (cuántas preguntas, su texto, sus opciones, el orden de los dominios) y **la presentación es nuestra**.

---

## 1. Cómo se ve hoy, de punta a punta

### (a) Las pantallas

**Dos fases**, separadas a propósito (reorganización del intake, 2026-08-10):

1. **Firma**: identidad, consentimiento, código por correo. Al firmar nace el `resume_token`.
2. **Encuesta**: un wizard de **nueve pasos**, "Sobre ti" (caracterización, opcional) más las ocho secciones del instrumento.

Las 64 preguntas están muy desigualmente repartidas:

| Paso | Preguntas | Tipos |
|---|---|---|
| **Alimentación** | **18** | 18 de opción única |
| **Alergias y digestión** | 10 | 7 opción, 3 multi |
| **Hábitos** | 9 | 7 opción, 1 multi, 1 escala |
| **Hidratación** | 8 | **6 contadores**, 2 opción |
| Antecedentes y estilo de vida | 7 | 3 opción, 4 multi |
| Percepción corporal | 4 | 3 opción, 1 multi |
| Conductas alimentarias | 4 | 2 opción, 2 multi |
| Contexto social | 4 | 4 opción |

Y hay **890 opciones** repartidas entre las 64 preguntas: unas **14 por pregunta** de media. Es mucho texto que leer, no solo muchas preguntas que responder.

### (b) El progreso: existe, y engaña

Hay tres indicadores, que es más de lo que esperábamos: **"Paso N de 9"**, una **barra** y una **navegación de nueve chips** con todas las secciones alcanzables.

**El problema no es que falte: es que mide la cosa equivocada.** Los pasos son muy desiguales, así que la barra avanza a saltos que no corresponden al trabajo. Un paciente en "paso 2 de 9" (22 %) acaba de terminar "Sobre ti" y tiene por delante las 18 preguntas de Alimentación; otro en "paso 7 de 9" (78 %) puede llevar menos de la mitad de las respuestas. **La barra promete un avance que no es real justo en el punto donde más se abandona.**

### (c) Pausar y volver: bien resuelto

- El **enlace de reanudación** se muestra desde el principio, colapsado, copiable, y el mismo enlace llega por correo.
- El texto es claro: dice que puede cerrar sin problema y volver cuando quiera.
- Hay **indicador de guardado** con reintento.

**El hueco:** se guarda **al pasar de sección**. Quien abandone a mitad de Alimentación pierde hasta 18 respuestas, que es justo la sección donde más probable es abandonar.

### (d) Móvil: aquí está el problema serio

**`survey-widgets.tsx` no tiene un solo punto de quiebre responsive.** Cero `sm:`, `md:` o `lg:` en todo el archivo.

Las opciones se pintan como pastillas en `flex-wrap`, con `px-3 py-1.5 text-sm`: unos **34 px de alto**, por debajo del mínimo táctil recomendado (44 px). Con 14 opciones de media envolviéndose en una pantalla estrecha, el resultado en un teléfono es una maraña de pastillas pequeñas y pegadas, donde es fácil tocar la de al lado.

**Si la mitad de los pacientes lo llenan en el teléfono en la sala de espera, esta es la peor parte de la aplicación**, y es la que ve alguien de fuera.

### (e) Las preguntas que cansan

**Alimentación (18)** es un cuestionario de frecuencia clásico: la **misma pregunta 18 veces** con el mismo juego de opciones, una debajo de otra. Cada bloque se lee entero aunque las opciones no cambien.

**Hidratación (8)**, con seis contadores seguidos. El contador arranca en guion y no en 0 a propósito (un contador sin tocar es ausencia, no cero), lo cual es correcto pero **hay que explicarlo**, porque un guion invita a dejarlo así.

---

## 2. Qué es diseño y qué sería cambiar el instrumento

### Diseño (nuestro, se puede hacer)

| Propuesta | Qué resuelve |
|---|---|
| **Progreso por PREGUNTAS respondidas, no por paso** | la barra deja de mentir; "34 de 64" es verdad, "paso 3 de 9" no |
| **Matriz para Alimentación**: los 18 alimentos en filas, las frecuencias en columnas, con las opciones escritas UNA vez | 18 bloques idénticos pasan a una tabla que se recorre; en móvil, filas apiladas |
| **Tamaño táctil de 44 px** en todas las opciones, y una columna en pantalla estrecha | deja de ser difícil de tocar |
| **Guardar dentro de la sección**, no solo al cambiar | quien abandona en Alimentación no pierde 18 respuestas |
| **Decir cuánto falta en tiempo**, no solo en preguntas | "unos 10 minutos" sostiene mejor que una barra |
| **Explicar el guion de los contadores** | el paciente sabe que dejarlo vacío es distinto de poner 0 |

### Instrumento (de Gildardo, no se toca sin preguntarle)

- Cuántas preguntas son y cuáles.
- El texto de cada pregunta y de cada opción (están acopladas carácter a carácter al motor congelado).
- El orden de los ocho dominios.
- Que Alimentación tenga 18 ítems.

**Un caso de frontera que conviene tener claro:** partir Alimentación en dos pasos parece diseño, pero cambia cómo se recorre el instrumento y afectaría al indicador de completitud. Lo trataría como diseño **solo si** no cambia el orden ni el agrupamiento clínico; si lo cambia, es pregunta.

---

## 3. Referencias para mirar

Cortas a propósito: una lista larga no se revisa.

### Formularios largos que no cansan

| Referencia | Qué mirar |
|---|---|
| **Typeform** | una pregunta por pantalla, con avance constante. Lo contrario de nuestro wizard: mirar si el ritmo compensa las pantallas de más |
| **GOV.UK Design System** | el estándar de formularios largos accesibles: una cosa por página, lenguaje llano, controles grandes. Su guía es pública y está razonada |
| **Un cuestionario de salud real: Nutrium, Cronometer o el onboarding de Oura** | cómo resuelven la frecuencia de consumo, que es exactamente nuestro D1 |

### Tablas clínicas densas (grupo B)

| Referencia | Qué mirar |
|---|---|
| **Epic MyChart** | densidad clínica real, con resultados de laboratorio en tabla: jerarquía, valores fuera de rango, referencia |
| **Un informe de laboratorio (Synlab, Colcan)** | cómo presentan valor, referencia y desviación en papel, que es nuestro problema en la tabla de Wang |
| **Linear o Height** | no es clínico, pero resuelven densidad con tipografía y espaciado, sin color decorativo. Cerca de nuestra restricción de BRAND |

**Qué buscar en todas, más que "cuál gusta":** cómo separan lo que hay que leer de lo que hay que hacer, y cuánto espacio le dan a cada cosa. Eso es lo que nos falta, no la paleta.

---

## 4. Orden propuesto

1. **Móvil primero**, porque es lo peor y es lo que ve alguien de fuera: tamaño táctil y una columna.
2. **El progreso**, que es barato y cambia la sensación de toda la encuesta.
3. **La matriz de Alimentación**, que es la pieza grande y la que más cansa.
4. **El guardado dentro de la sección.**
5. Y lo demás.

**Lo que NO entra:** el PDF del reporte, congelado hasta que Gildardo responda el 7.1. Diseñar ahora un documento cuyo contenido va a cambiar sería trabajo perdido.
