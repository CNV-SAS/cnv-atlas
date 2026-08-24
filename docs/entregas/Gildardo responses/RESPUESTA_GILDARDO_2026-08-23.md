# Respuesta a la ronda del 2026-08-23

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 23 de agosto de 2026

Respondo los tres puntos nuevos, la cola completa y lo que quedó del 20. **Hicieron bien en no portar
`motorTratNutri` antes de preguntar.** Meter un segundo motor que contradice al que ya prescribe habría
empeorado la incoherencia, y la comprobación pieza por pieza contra la entrega vigente es lo que hace
que esta ronda se pueda responder de una.

---

## 1. Manda `motorTratNutri`, con tres correcciones

**`motorTratNutri` gobierna la prescripción nutricional.** Es el que tiene la ciencia actualizada, y el
sodio lo demuestra: 1.500 mg en hipertensión es lo que sostienen OMS, DASH/NHLBI y AHA/ACC 2025. Los
2.300 del otro motor son el corte viejo.

Además ustedes ya lo habían detectado sin saberlo: **los bloques de recomendación de mi propia pantalla
imprimen el sodio de `motorTratNutri`**. En mi archivo, lo que se le dice al paciente ya sale de ese
motor mientras la tabla de restricciones decía otra cosa. La incoherencia no la trajeron ustedes; la
encontraron.

Porten las nueve filas de `motorTratNutri` **con estas tres correcciones**:

### 1.1 El déficit va como sugerencia editable, no como valor impuesto

El −500 en obesidad **se muestra como sugerencia y el profesional lo edita**. No lo imponga el sistema.

Esto no contradice lo que retiré el 19: lo que quité fueron los cinco déficits por fenotipo, que el
sistema aplicaba solos. Un valor sugerido y editable es otra cosa. **La regla de fondo es la de siempre:
el motor propone, el profesional dispone**, y vale para todo lo nutricional, no solo para el déficit.

### 1.2 El gasto se calcula sobre el peso de referencia, no sobre el peso actual

`motorTratNutri` calcula el gasto basal sobre `pesoAct`. **Debe calcularlo sobre el peso de
referencia**, que en mi archivo es el peso meta o esperado —así está anotado en el código, «el peso de
referencia/esperado (meta)»—.

Hoy la proteína sí sale del peso meta y la energía no. Es una inconsistencia interna del motor, no una
decisión: corríjanla al portar.

### 1.3 La proteína en cáncer queda en 1,25 g/kg — y lo anoto como cambio

Al mandar `motorTratNutri`, esta fila **baja** de 1,5–2,0 g/kg (ESPEN Oncología 2023, que es lo que citaba
el otro motor) a 1,25 g/kg. Lo dejo así por coherencia con la decisión, pero **queda anotado como el
único punto donde el motor que gobierna es el menos actualizado de los dos.** Regístrenlo en la
trazabilidad; lo reviso en su propia ronda.

### Una observación para más adelante, que no cambia nada ahora

`motorTratNutri` usa Mifflin siempre; el otro usaba Cunningham cuando había masa libre de grasa.
Cunningham es la ecuación que aprovecha esa masa, y nosotros siempre la tenemos porque medimos
bioimpedancia. **No lo cambien ahora** —manda `motorTratNutri`— pero anótenlo: medir la composición y
luego no usarla para el gasto es algo que habrá que mirar.

---

## 2. El bloque de exceso de grasa se activa por FMI

No se retira. **Se activa por el FMI**, medido o calculado por el BiodyXpert ZM III, **distinguiendo
sexo**: por encima de 6 en hombres y de 9 en mujeres, que son los bordes superiores del rango normal de
`cFMI`.

Y reescriban su texto: fuera el déficit con cifra y fuera el piso de calorías, que es justo lo retirado.
La orientación se conserva sin número, como en el resto.

## 3. Las tres copias del umbral de sarcopenia: 17 / 15, con sexo

Son **tres**, no dos. Además de las que encontraron, hay una tercera. Las tres quedan con **FFMI 17 en
hombres y 15 en mujeres, distinguiendo sexo**.

**Y la regla general, para que no vuelvan a preguntarla fila por fila: toda la composición corporal
depende del sexo.** Cualquier umbral de composición —FMI, FFMI, ASMI, SMM/W, grasa %— se estratifica.
Si encuentran uno que no lo hace, es un defecto: corríjanlo y repórtenlo, no lo consulten.

Lo de la copia sin distinción de sexo era exactamente eso: una mujer con FFMI 16 quedaba marcada como
sarcopénica cuando su frontera es 15.

---

## Cola acumulada

### P-25 · Distribución por tiempos de comida

Los porcentajes son **valor por defecto, no fijos del modelo**. **Todo lo nutricional lo ajusta el
nutricionista**: los tiempos, el reparto, el objetivo calórico, las porciones. El sistema propone un
punto de partida razonable y el profesional lo mueve.

### P-26 · Lista de intercambio · no es la versión final

**No es el dataset final y no se porta tal cual.** Los alimentos que entran a la lista de intercambio
**se escogen por representatividad según la ciudad donde vive el paciente, y esa selección se hace con
IA.** Un intercambio de cereales en Riohacha no se compone igual que en Bogotá.

Los 12 grupos y los nutrientes por porción sí son estables. Lo que cambia por ciudad es **qué alimentos
representan cada grupo**.

**Requisito previo que deben conocer antes de planificarlo:** esa selección depende del proxy de IA, que
hoy está caído, y de modelos que la cuenta ya no tiene. Hasta que eso se resuelva, la función no se puede
construir. No es trabajo suyo, pero no lo descubran a mitad de camino.

### P-27 · Los micronutrientes SÍ se ajustan por enfermedad

**Corrijo su suposición: no es deliberado que sean fijos.** Un paciente hipertenso o renal no puede
tener las mismas necesidades de proteína y sodio que una persona sana. Sería absurdo mostrarle a un
renal un potasio de 3.400 mg como necesidad mientras la restricción del menú le dice otra cosa.

**Las necesidades se ajustan a lo que el tratamiento nutricional recomiende para cada patología.** Y la
patología que cuenta es **la declarada en la encuesta más el diagnóstico que pone el profesional**, no
solo una de las dos.

Con `motorTratNutri` gobernando (§1), el hipertenso ve **1.500 mg de sodio** como su necesidad ajustada,
no 2.300; y el renal, 2.000 y su proteína controlada.

### P-28 · Salud celular va en Diagnóstico

**En Diagnóstico, tal como está en el HTML.** No es negociable: hidratación celular, ángulo de fase y
masa celular activa son hallazgos, no conducta.

**En Tratamiento van las rutas de atención y el tratamiento de cada profesional**, que es otra cosa.

**Y les devuelvo la pregunta: ¿de dónde sacaron salud celular en Tratamiento?** En mi archivo no está
ahí. Quiero saber de dónde salió, porque si apareció por interpretación puede haber más piezas movidas
de sitio por el mismo camino.

### P-29 · Granularidad · las porciones van por grupo

**Se prescribe por grupo.** Cuando digo «número de porciones», es por grupo.

Los alimentos aparecen **dentro** de cada grupo para que el nutricionista los despliegue si quiere
verlos, no para que reparta porciones entre ellos. Y **qué alimentos aparecen ahí lo escoge la IA según
la ciudad**, que es el P-26.

### P-30 · El reparto que no cuadra: avisa y permite guardar

**Se avisa y se deja guardar.** Es la misma regla del §1.1: el motor señala, el profesional decide.

Si un profesional quiere guardar un plan a medio armar para terminarlo después, o repartir de una forma
que el sistema no anticipó, no es asunto del sistema impedírselo. El aviso en rojo cumple su función:
informar. Mantengan la fidelidad a mi archivo.

### P-31 · El GET del Biody es referencia

**La base es el calculado**, y va sobre el peso de referencia (§1.2). **El gasto que mide el Biody queda
como medida de referencia informativa**, visible pero sin gobernar el plan. Ya estaba resuelto de antes;
lo confirmo.

---

## Lo que quedó del 20 · la residencia prolongada se retira

**Retírenla definitivamente. No la parametricé nunca y no va.**

Lo que interesa es **dónde está la persona al momento de hacer la encuesta**, que es lo que la ciudad
actual ya captura. La altitud sale de ahí, con la tabla ciudad → altitud que ya existe, y con la regla de
siempre: «Otra» o texto libre → sin altitud, no se inventa.

Pueden retirar también la columna que la guardaba; no va a recibir nada.

---

## Resumen

| # | Decisión |
|---|---|
| 1 | **Manda `motorTratNutri`.** Sodio 1.500 / 2.000. Con tres correcciones: déficit **sugerido y editable**, gasto sobre **peso de referencia**, y proteína en cáncer en 1,25 anotada como cambio |
| 2 | Bloque de exceso de grasa: se activa por **FMI > 6 (H) · > 9 (M)**. Reescribir su texto sin déficit ni piso |
| 3 | Las **tres** copias de sarcopenia con **17 / 15 y sexo**. Regla general: **toda la composición corporal se estratifica por sexo** |
| P-25 | Porcentajes por tiempo: **valor por defecto**. Todo lo nutricional lo ajusta el nutricionista |
| P-26 | La lista **no es final**. Alimentos por **representatividad según ciudad, con IA**. Depende del proxy, hoy caído |
| P-27 | Micronutrientes **sí se ajustan por patología** (encuesta + diagnóstico del profesional) |
| P-28 | Salud celular en **Diagnóstico**. Tratamiento es rutas y tratamiento por profesional. **¿De dónde lo sacaron?** |
| P-29 | Porciones **por grupo**. Los alimentos se despliegan, no se reparten |
| P-30 | **Avisa y permite guardar.** El motor propone, el profesional dispone |
| P-31 | Base el **calculado sobre peso de referencia**. El del Biody, informativo |
| Ronda 20 | **Residencia prolongada retirada.** Vale la ciudad actual |

**La regla que atraviesa media ronda, para que no la vuelvan a preguntar:** el motor propone, el
profesional dispone. Aplica al déficit, al reparto por tiempos, a las porciones y a cualquier cifra
nutricional que aparezca de aquí en adelante.

**Lo que espero de vuelta:** el porte de `motorTratNutri` con las tres correcciones, y de dónde salió
salud celular en Tratamiento.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
