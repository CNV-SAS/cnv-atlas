# Respuesta a la ronda del 2026-08-29

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 30 de agosto de 2026

---

## 0. La confusión de fondo, y es la que produce el punto 2 entero

**Están confundiendo el patrón usual de consumo de alimentos de la encuesta con la lista de intercambio
del plan nutricional. Son dos cosas distintas y no tienen por qué ser iguales.**

En el archivo hay tres instrumentos, cada uno con su propósito, su numeración y su unidad:

| Instrumento | Qué es | Qué mide |
| --- | --- | --- |
| **FREQ_GROUPS** | El patrón usual de consumo de la encuesta | Frecuencia semanal, quince grupos, en el orden clínico que ve el paciente |
| **TCAC** | La tabla de composición de alimentos | Nutrientes por porción, con su propia numeración |
| **INTER_TABLA_A/B** | La lista de intercambio | Porciones del plan nutricional |

**Ninguno es la traducción de otro.** Que el número 15 sea una cosa en uno y otra en otro no es un
defecto: es que son tablas distintas, como lo son en cualquier texto de nutrición. La numeración es un
identificador interno de cada tabla, no una clave común.

**No hay que unificarlos, ni ponerlos de acuerdo, ni construir puentes entre ellos.** Cada uno se porta
como está en el archivo, y cada regla se lee contra la tabla para la que fue escrita.

**Y lo digo por última vez, porque llevo varias: hagan las cosas como están en el HTML.** Cuando una
pieza del archivo no coincide con otra, la primera pregunta no es cuál corregir, sino si están mirando
dos instrumentos distintos. Casi siempre lo son.

---

# 1 · La conducta sin dato: confirmada

**Sí, es la que quiero.** Sin el insumo, la regla no se evalúa. Un cero respondido es un dato y alerta;
la ausencia no es un cero.

Es exactamente el principio del punto 4 del 28, y aplica a todo el sistema, no solo a esa regla: **un dato
que falta no puede entrar al cálculo como si fuera una respuesta**, y menos como una respuesta favorable.
No me lo pregunten regla por regla: es la conducta general.

---

# 2 · No hay puente que construir

Ver el punto 0. **La equivalencia que piden no existe porque no debe existir.**

El patrón usual de consumo mide **frecuencia**, y su lectura es la que ya está en el archivo: protector,
neutro y de riesgo, con su umbral por categoría. Eso alimenta el DFI y el patrón alimentario, y ahí se
agota. **No se convierte en porciones diarias, porque no es una cuantificación dietética: es un patrón.**

Las reglas que necesitan nutrientes se leen contra la tabla de composición, con la numeración y las
unidades de esa tabla, que es contra la que están escritas. **Pórtenlas así, tal como están.**

## El omega-3 no se retira, y no hay que agregarlo

**Ya está en el archivo**, con su valor para cada grupo de la tabla de composición. Lo buscaron en la
lista de intercambio, que es el instrumento equivocado por lo dicho arriba.

---

# 3 · El ICEC: sigue sin encender, y la que falta es mía

**Hicieron bien en no encenderlo, y la nota que los frenó es mía.**

La media 58,578 y la desviación 13,332 del ICEC **no están establecidas**, y por eso escribí esa
advertencia al lado del interruptor. **Encender el mapeo sin la recalibración movería la edad biológica de
todos los pacientes entre uno y ocho años contra dos constantes que yo mismo marqué como no
verificadas.** Eso no se hace.

**La recalibración va por mi lado y llega con el dato, no con una instrucción.** Hasta entonces el
interruptor se queda en `false`. **No lo enciendan por partes ni por su cuenta.**

**Y sí: la conducta de reemisión aplica igual a la EB-BIS.** Es la misma regla del 12b, y con más razón
aquí, porque una recalibración poblacional mueve a todos por definición: reemisión obligatoria si el
paciente cambia de banda, y aviso cuando le cambie el tratamiento.

---

# 4 · Un dominio sin dato NO puntúa

**No debe puntuar 1.** Un vértice de "susceptibilidad leve" dibujado sobre un dominio que no se midió es
la misma lectura favorable de un vacío que corregimos en el ISCM, y en el radar pesa más porque se ve de
un golpe.

Ese `?? 1` está escrito para una clasificación fuera del mapa, que es otra cosa: ahí sí hay dato y no lo
reconoce el clasificador. **Sin dato, el dominio no puntúa y el radar no dibuja ese vértice.**

---

# 5 · Las felicitaciones, en bloque aparte

**Aparte.** Una hidratación adecuada y un TCA activo no pueden compartir lista ni peso visual. Lo que la
alerta hace es dirigir la mirada del profesional, y mezclarlas gasta esa atención en lo que ya está bien.

---

# 6 · Tu punto 3: bien dimensionado

**6a y 6b: correcto, y el 6b es el importante.** Que la dinamometría se capture y no llegue al motor
significa que `dxSarcopenia` devolvía *"ingrese la fuerza prensil"* **siempre**, incluso con el dato
registrado, y que la rama que emite sarcopenia probable, confirmada o severa **nunca se ejecutó**.
Conéctenla.

Y una cosa que no señalaron: esa es la razón por la que la fuerza prensil no puede vivir separada del
ASMI y del ángulo de fase. **Los tres son un diagnóstico**, y un criterio que se captura lejos del cálculo
termina no llegando a él.

**6c: su lectura es la correcta.** La prescripción aprobada se puede reabrir, y reabrirla dispara la
regla de reemisión del 12b. **El sellado no es un candado: es una consecuencia registrada.** Un
profesional que necesita corregir un plan aprobado tiene que poder hacerlo; lo que no puede es que el
cambio no deje rastro ni le llegue al paciente que ya se lo llevó.

---

# 7 · El orden de la matriz: recibido

**Nada que responder, y bien encontrado.** El orden es el mensaje: con las carnes rojas al final, la
encuesta le decía al paciente que son alimento de riesgo cuando en el modelo son neutras.

Y su propia conclusión es la que hay que guardar: **la consistencia interna no prueba fidelidad.** Un
sistema coherente consigo mismo puede estar entero equivocado respecto del archivo.

---

# 8 · Una nota por profesión

**Una por profesión, tres campos distintos.** Cada rol escribe lo suyo y no se pisan: el nutricionista no
edita la nota del médico. Por eso son tres en el archivo y no uno repetido.

---

## Resumen

| # | Decisión |
| --- | --- |
| **0** | **El patrón de consumo de la encuesta, la tabla de composición y la lista de intercambio son tres instrumentos distintos.** No se unifican ni se traducen entre sí. **Hagan las cosas como están en el HTML** |
| **1** | **Confirmado: sin el insumo, la regla no se evalúa.** Es la conducta general del sistema, no una excepción de esa regla |
| **2** | **No hay puente que construir.** La frecuencia no se convierte en porciones: es un patrón, no una cuantificación. **El omega-3 ya está** en la tabla de composición |
| **3** | **El interruptor se queda en false.** μ y σ del ICEC no están establecidas y la recalibración va por mi lado. **La conducta de reemisión aplica igual a la EB-BIS** |
| **4** | **Un dominio sin dato NO puntúa.** El ?? 1 era para una clasificación fuera del mapa, que es otra cosa |
| **5** | **Las tres positivas, en bloque aparte** de las críticas |
| **6** | **6a y 6b correctos: conecten la dinamometría al motor**, que hoy nunca emite sarcopenia. **6c: se reabre, y dispara la reemisión del 12b** |
| **7** | **Recibido.** La consistencia interna no prueba fidelidad |
| **8** | **Una nota por profesión**, tres campos distintos |

© Connected Nutrition Ventures SAS, 2026. Documento interno.
