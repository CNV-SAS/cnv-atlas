# Respuesta a la ronda del 2026-08-28

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 28 de agosto de 2026

---

## 0. Acepto la petición de proceso, y va el archivo en esta entrega

Tienen razón y el punto es válido: mi respuesta y el archivo tienen que caer juntos. **Va elATLAS_v8.html con esta carta**, con el IRC corregido, el rescate del MCA y la columna Δ del ISCM y del
IAE. De aquí en adelante, siempre en la misma entrega.

---

## 1. Dos de estas ya estaban contestadas

Los puntos 2 y 3 no son preguntas nuevas: los contesté el 26, y la respuesta no cambia. Las repito abajo
para que queden en un solo sitio, pero quiero que quede dicho: cuando una decisión ya está tomada, el
camino no es volver a preguntarla, es aplicarla.

### 2 · El peso meta lo fija el profesional, al inicio, en mod antropometría

Ya lo dije el 26, con estas palabras: *"el peso meta es el único que fija el objetivo. Es la palanca, y es
la que el profesional mueve: si acuerda con el paciente un peso meta menos ambicioso, el objetivo sube
solo."*

**El campo va en la entrada, en mod antropometría.** Y su preocupación de fondo es la correcta, solo que
la conclusión es la contraria a la que sacaron: **no son dos pesos meta, es uno**. El campo de la entrada
y el ajuste del tratamiento son **el mismo dato en dos superficies de edición**, no dos datos que puedan
discrepar. Si los construyen como campos separados, el defecto lo crean ustedes.

Y el obstáculo que plantean —que el tratamiento no existe todavía cuando se mira esa pantalla— se
resuelve al revés de como lo leen: **el peso meta no pertenece al tratamiento, pertenece al paciente**. El
motor lo calcula como punto de partida, el profesional lo fija, y el tratamiento lo **lee**. No lo crea.

### 3 · Todo lo del diagnóstico es editable por el profesional

También estaba dicho. **Se cae el sellado.** El profesional corrige cuando tiene que corregir, antes y
después del diagnóstico. Si eso obliga a versionar el documento, se versiona: el registro es problema del
sistema, no del profesional.

**Y la fuerza prensil no estaba duplicada: la sacaron del único sitio donde vive.** Nunca la puse en las
condiciones del BIS. En mi archivo está en **Datos Personales** (`DPEdit('Fuerza prensil'…`) y alimenta el
**diagnóstico de sarcopenia EWGSOP2 junto con el ASMI y el ángulo de fase** —fuerza como criterio
primario (bajo: H <27 · M <16 Kgf), masa por ASMI, calidad celular por AF—, que se pinta en ese mismo
módulo. Sin ella el diagnóstico no se emite: dice *"ingrese la fuerza prensil"*.

Los tres criterios se capturan y se leen juntos **porque son un diagnóstico, no tres datos sueltos**.
Devuélvanla a mod antropometría.

La tercera diferencia —que se vea cuál valor midió el equipo cuando el profesional corrige— **esa sí se
queda**. No añade contenido clínico y conserva el dato del aparato.

---

## 2. Los defectos de mi archivo: cuatro corregidos, uno con la causa localizada

### 4 · El ISCM no debe calcularse sin el MCA. Confirmado

**Tienen razón, y el razonamiento es exacto:** en una desviación respecto del teórico, el 0 no es "no sé",
es *"el paciente está en su masa celular esperada"*. Un dato ausente entrando como dato favorable es el
peor de los defectos posibles, y en un déficit real subestima el riesgo. **Atlas hace lo correcto
devolviendo null: no lo cambien.**

**Y sé por qué el MCA no llegaba a mi pantalla.** No es el export: es mi importador. El valor del MCA se
rescata por búsqueda tolerante y su referencia también, pero **la desviación teórica (MCA_dif) no la
rescataba nadie** —solo existía esa línea para el `FFW_dif`—. Con un export cuyos encabezados no vienen
literales, el MCA entra solo, la fila sale "Sin dato" y el índice sigue calculándose con la desviación en
cero. **Corregido en el archivo adjunto.**

La otra mitad —que el índice no se emita cuando falte un insumo— queda anotada en el código y la hago con
la aplicación corriendo: obliga a tocar las siete pantallas que consumen el ISCM y ninguna de ellas
distingue hoy un cero de un vacío. No lo mando a medias.

### 5 · Las siete filas "sin grasa" deben derivarse. Ninguna va al valor con grasa

**Confirmado, y no hay excepción entre las siete.** Que las referencias declaren magnitudes distintas
(20,39 L en una, 35–40 % en la otra) lo dice solo: están pensadas como distintas.

**La causa también está localizada, y es una sola, como sospecharon.** Mi bloque de derivaciones tiene la
regla de precedencia *"un valor que venga en el Excel jamás se sobrescribe"*: solo rellena lo ausente. Las
fórmulas están todas y son correctas —`FFW = ACT − 0,15 × FM`, `AEC_sg = AEC − 0,1125 × FM`,
`AIC_sg = AIC − 0,0375 × FM`—, pero **el mapeo de encabezados está entregando la columna "con grasa" a los
campos "sin grasa"**. Llegan marcados como medidos, la derivación los ve ocupados y no los toca. De ahí
que las siete parejas salgan idénticas.

Lo corrijo contra un export real, no a ciegas. **Atlas está bien: no alineen nada con mi pantalla.**

### 6 · El IRC: corregido, con los cortes que mandan

**Los puntos de corte son los del artículo** (`Articulo_IRC_vs_IR`, Tabla 3, cohorte n=6.063, P25/P75), y
son **por sexo**:

| | Bajo | Normal | Alto |
|---|---|---|---|
| **Hombres** | <1,7 | 1,7–2,1 | >2,1 |
| **Mujeres** | <2,3 | 2,3–2,8 | >2,8 |

Y **el IRC no se multiplica por diez al mostrarlo**, porque el ×10 ya está dentro de la fórmula:
`IRC = (Re/(Ri×C))×10`. Ahí estaba el 16,222: la tabla multiplicaba lo que ya venía multiplicado, y lo
comparaba contra una referencia que no lo estaba.

En el archivo adjunto quedó así:

- **El clasificador** toma los cortes del artículo. Se retiró el respaldo sin sexo (2,0/3,4), que no sale
  de ninguna parte. Sin sexo se aplica el corte masculino, que es el más exigente: usar el femenino
  subestimaría el riesgo de un hombre.
- **La tabla de composición** ya no lleva clasificador propio: delega en el oficial. Tenía uno duplicado,
  con el ×10 y con los cortes 2,0/2,8 sin sexo, y de ahí salía el rojo.
- **Retirados** los cortes 2,0–2,8 (×10), 1,68/2,11 y 2,27/2,85 de todas partes donde aparecían: tarjeta,
  tabla, referencias por sexo y el texto que se le entrega a la IA.

Verificado con su propio caso: **Nico, IRC 1,62, hombre → bajo riesgo, verde, en las dos pantallas.**

### 7 · Los tres menores: los tomo los tres

1. **La columna Δ, corregida** en el archivo adjunto. El ISCM contra ≤−1 da **−0,75**, como calcularon. El
   IAE ahora da la distancia al límite del rango que se cruzó, y cero mientras esté dentro de −5 a +5.
2. **La referencia del ICA-BIS**: ya estaba corregida aquí. Es 0, no φ: el ICA-BIS *es* la desviación
   respecto de φ.
3. **El AEC/MCA** se resuelve con el punto 4, y ya está resuelto con el rescate del `MCA_dif`.

---

## 3. Lo de forma

### 8 · No hay una escala, hay dos, y cada una tiene su vocabulario

**El semáforo es verde, amarillo y rojo**: verde está bien, amarillo alerta, rojo problema. Ese es el de
los badges y no se toca.

**El DFI tiene su propia escala, de cinco:** blanco excepcional, azul muy bien, verde en la norma, naranja
a vigilar, rojo a tratar. Esa tampoco se toca. **¿Para qué la vamos a cambiar?**

El defecto no es el azul: son **las etiquetas prestadas**. Le pusieron al radar del DFI las palabras del
semáforo (Bajo, Leve, Moderado, Alto), que son de otra escala, y por eso "Bajo" les sale con dos colores.
**Pongan las etiquetas del DFI en el radar del DFI** y la contradicción desaparece sin mover un color.

### 9 · Los subrótulos: confirmados, en los dos sitios

Bien hecho, y bien adelantado. El nivel de cada dominio va coloreado en el radar y el par FMI/FFMI va bajo
cada sector de la Diana. Que salga derivado del `EFR_RISK_ORDER` es lo correcto: rótulo y posición no se
pueden desincronizar.

Las dos de la tabla de intercambio —números a la derecha y porciones prellenadas— **también van**.

### 10 · Los datos brutos van en mod antropometría, uno solo, para todos

No hay cuatro versiones. **Los datos brutos van en mod antropometría, igual que los demás módulos, y los
ven los cuatro profesionales.** Lo que se separa por profesión es **el tratamiento**, y solo el
tratamiento.

---

## 4. El resumen de condiciones y las alertas

### 11a · generarAlertas va, pero no donde la iban a poner

**No quedó fuera a propósito: quedó sin conectar**, y el sitio correcto no es el diagnóstico. **Esas
alertas aparecen al inicio, cuando el profesional abre la información de la encuesta del paciente.** Son
lo que le dice qué mirar antes de evaluar, no una conclusión del diagnóstico.

Pórtenla con sus quince reglas, y conéctenla ahí.

### 11b · Confirmado: son d1_13 las dos

**Las dos leen el grupo equivocado y las dos deben leer d1_13**, azúcares añadidos y bebidas azucaradas.
Pórtenla ya con la corrección; no la porten literal para que yo la arregle después.

Y tienen razón en el diagnóstico de fondo: **siguen ahí porque la función nunca corrió.** Ninguna de las
dos ha producido jamás una salida que alguien pudiera contrastar. Es el mejor argumento para conectarla.

### 11c · Son dos resúmenes distintos, no uno

Aquí está el malentendido, y por eso les daba entre diez y catorce líneas: **estaban fundiendo en un solo
bloque dos resúmenes que van en sitios distintos y responden preguntas distintas.**

- **En mod ruta de atención:** el resumen del diagnóstico, como lo definimos en ATLAS. **Las condiciones
  alteradas del DFI.** Nada más.
- **En profesional:** el resumen de **todas las condiciones clínicas a las que se tiene acceso con la
  encuesta y la composición corporal.**

Separados, ninguno de los dos es una lista de mercado: el primero es corto por definición, y el segundo
está donde el profesional sí necesita el detalle completo.

---

## 5. La reemisión y el menú

### 12 · Se dispara según el protocolo del modelo ANI BIS

**La recalibración se dispara desde la Dirección Científica, en bloque, y el profesional se entera.** No
la decide él. Está en el **Reglamento Operativo ANI-BIS-E, §11**: CNV actualiza con **preaviso de quince
(15) días hábiles**, y cada versión queda archivada en ATLAS con **fecha de vigencia y resumen de
cambios**. Ese es el mecanismo, y ya existe: no hay que inventarlo.

Su cifra —23 de 40, y 7 de los 8 confirmados— es exactamente el argumento de por qué esto no puede quedar
en manos de cada uno. Una recalibración poblacional afecta a todos por definición.

Sobre las dos que el Reglamento no cubre todavía, y que quedan como adición a él:

- **12b · Reemisión obligatoria** cuando el cambio es de **calibración poblacional** y el paciente
  **cambia de banda**. Si el número se mueve pero la clasificación no, se marca en la historia y no se
  reemite. El criterio es el resultado, no el tipo de cambio: una calibración que no mueve a nadie de
  banda no obliga a nada, y un clasificador que sí los mueve, obliga.
- **12c · Al paciente se le avisa** solo si cambia su clasificación o su tratamiento. Si no cambia
  ninguna de las dos, queda el registro de versión en la historia y no se le manda nada: no se alarma a
  nadie por un decimal. Y sí cambia según el caso, como plantean: **un tratamiento reemitido se avisa
  siempre**, porque cambia lo que la persona come.

**La detección y el marcado que ya construyeron están bien.** Sigan con eso.

### 13 · Un solo menú. ¿Para qué dos?

**Únanlas.** El ciclo de 21 días es la base y la IA solo lo adapta cuando hay restricciones, como en mi
archivo. Un modelo componiendo un menú desde cero no es lo que este software hace.

Y respondo la que preguntan aparte, porque es la que importa: **partir del ciclo es criterio clínico.** El
paciente debe recibir comida colombiana conocida, de su ciudad y de su mercado, no lo que un modelo
componga. Que eso se lea en la pantalla.

---

## Resumen

| # | Decisión |
|---|---|
| 0 | **El archivo va en esta entrega**, y de aquí en adelante siempre |
| 2 | **El peso meta lo fija el profesional en mod antropometría.** Ya estaba dicho el 26. Es **un** dato con dos superficies de edición, no dos. El tratamiento lo lee, no lo crea |
| 3 | **Todo lo del diagnóstico es editable. Se cae el sellado.** La **fuerza prensil nunca estuvo duplicada**: vive en mod antropometría y alimenta el dx de sarcopenia EWGSOP2 con AF y ASMI. Devuélvanla |
| 4 | **El ISCM no se calcula sin MCA. Atlas hace lo correcto.** Causa localizada y corregida: el `MCA_dif` no se rescataba |
| 5 | **Las siete filas se derivan, sin excepción.** Causa: el mapeo entrega la columna "con grasa" a los campos "sin grasa" y la derivación no sobrescribe lo importado. **No alineen nada con mi pantalla** |
| 6 | **IRC: H <1,7 / 1,7–2,1 / >2,1 · M <2,3 / 2,3–2,8 / >2,8.** Corregido y adjunto. **No se multiplica por diez**: la fórmula ya lo hace. Retirados los demás cortes |
| 7 | **Los tres.** Δ corregido (ISCM −0,75); el ICA-BIS ya estaba; el AEC/MCA se resolvió con el 4 |
| 8 | **Dos escalas, no una.** Semáforo verde/amarillo/rojo · DFI blanco/azul/verde/naranja/rojo. El defecto son **las etiquetas prestadas**, no el azul |
| 9 | **Confirmados los subrótulos**, en el radar y en la Diana. Y las dos de la tabla de intercambio |
| 10 | **Datos brutos en mod antropometría, uno solo, para los cuatro.** Por profesión es **solo el tratamiento** |
| 11a | **generarAlertas va**, y va **al inicio**, cuando el profesional abre la encuesta. No en el diagnóstico |
| 11b | **d1_13 las dos.** Pórtenla con la corrección |
| 11c | **Son dos resúmenes distintos:** en ruta de atención, las condiciones alteradas del DFI; en profesional, todas las de encuesta y composición |
| 12 | **Se dispara en bloque desde la Dirección Científica**, por el **§11 del Reglamento ANI-BIS-E**: preaviso de 15 días hábiles y versión archivada. Reemisión **obligatoria si el paciente cambia de banda**; aviso al paciente **si cambia su clasificación o su tratamiento** |
| 13 | **Un solo menú.** El ciclo es la base, la IA solo adapta. **Partir del ciclo es criterio clínico**, y debe decirse en pantalla |

**Va el ATLAS_v8.html de hoy**, con el IRC corregido, el rescate del `MCA_dif` y la columna Δ del ISCM y
del IAE.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
