# Ronda del 2026-08-28

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 28 de agosto de 2026

## Primero: aceptamos el punto 0, y ya estamos retirando

**Retirado y commiteado:**

- **Las dos tablas**, de alérgenos y de patrón, con todo lo que colgaba: el filtro en código, el bloqueo
  del menú, el descarte con motivo y sus columnas en base de datos.
- **El bloque de alergias del prompt.** Nos pediste que la pantalla no afirme verificación; pasarle las
  alergias al modelo es una forma parcial de lo mismo, y no la podemos sostener. El plan lo revisa el
  profesional, como dices.
- **Los seis techos y pisos** de la prescripción: proteína 0-4 g/kg, factor de actividad 1-2,5, gasto
  basal, objetivo calórico y peso meta.
- **La apnea**, y su tarea.

Todo eso era contenido clínico que redactamos nosotros y no debía estar. **Verificado además: la pantalla
no dice en ningún sitio que el menú fue verificado contra las alergias**, ni lo decía antes.

**Lo que queda, que es lo que pediste:** que aparezca que el paciente tiene alergias, tal como la encuesta
las capturó.

### Y una consecuencia buena de tu punto 0: tu lista del 26 no hay que construirla

Aplicamos tu regla de las dos condiciones (el dato en la encuesta **y** el criterio en el archivo) a la
lista de "lo que debe aparecer en el diagnóstico de cada profesional" que aprobaste el 26. El resultado:

**Los diez ítems restantes ya están en tu archivo**, en el bloque `=== DATOS CRUDOS DEL PACIENTE
(evidencia de respaldo) ===` que alimenta el diagnóstico (L13785-13830): medicación antihipertensiva
(`d5_37`), alcohol y tabaco, alergias e intolerancias, patrón alimentario, los siete síntomas digestivos,
suplementos, número de comidas y desayuno, tipo de actividad, sueño y ronquido, e inseguridad alimentaria.

**El único ausente de tu archivo es el tamizaje de apnea**, que es justo el que retiraste. Y no es
casualidad: los diez que están son **datos mostrados**; la apnea era el único que exigía **cruzar** datos
en una conclusión nueva.

Así que no construimos nada: **portamos tu bloque**. Una sola pregunta sobre eso, al final (punto 10).

---

## Segundo: un grupo distinto, que queremos que veas antes de retirar

Hay piezas nuestras que **no son contenido clínico**. Son decisiones que existen porque **Atlas guarda lo
que tu prototipo recalcula.**

Tu archivo vive en el navegador y se rehace en cada carga. El nuestro persiste, lo usan varios
profesionales a la vez, y **lo que se guarda mal queda mal**. De ahí salen los candados de concurrencia,
el sellado de versiones y la fuente única del peso meta.

**Retirarlos no nos acercaría a tu archivo: nos daría sus limitaciones sin sus ventajas, porque las suyas
vienen de ser transitorio.**

Las que están en juego en esta ronda son tres, y van como preguntas 2 y 3. No las tocamos sin tu
respuesta.

---

# 2 · El "Meta kg": no es contenido clínico, es DÓNDE VIVE un dato

Esta entra en el grupo de arriba, y por eso te la preguntamos en vez de resolverla con el punto 0. Tu
archivo lo tiene y Atlas no, así que por la regla "no puede tener menos" tocaría portarlo. Pero **el peso
meta no es contenido clínico: es un dato que ya existe, y la pregunta es en cuántos sitios se puede
editar.** Tener el mismo dato en dos sitios editables es un defecto de ingeniería que tu archivo no tiene
porque no guarda nada.

## Qué es

En tu tabla de composición, la fila de **Peso** no tiene la referencia vacía: tiene un campo **"Meta
kg"** que el profesional escribe. En Atlas esa celda queda en blanco.

## Por qué no lo portamos

**Porque en Atlas el peso meta ya tiene una fuente, y este sería una segunda.**

En tu archivo el campo tiene todo el sentido: allí **todo el bloque de datos es editable y no hay motor
que lo calcule**, así que alguien tiene que escribirlo. En Atlas no es así:

- El peso meta lo **calcula tu propio `motorProtocolo`** a partir del peso, el IMC, el peso ideal y las
  comorbilidades (IRC y cáncer usan el peso actual; el resto, el ajustado).
- Y el nutricionista **puede sobrescribirlo** en el tratamiento, donde ese ajuste entra a toda la
  cadena calórica.

Si además lo dejáramos escribir en la pantalla de entrada, habría **dos pesos meta**: el escrito antes
del diagnóstico y el que el motor calcula después. **Es exactamente el problema de los dos objetivos
calóricos que tú mismo nos hiciste colapsar** ("el objetivo ya no es un input manual: sale de la
cadena"). No queremos repetirlo con el peso.

Y hay un obstáculo práctico encima: el ajuste del profesional vive en el tratamiento, que **no existe
todavía** cuando se está mirando esa pantalla.

> **Pregunta 2.** ¿Estás de acuerdo con dejarlo solo en el tratamiento, donde ya se puede ajustar? ¿O
> hay una razón clínica para que el profesional lo fije **desde la entrada**, antes del diagnóstico? Si
> es lo segundo lo construimos, pero entonces ese campo tiene que SER el mismo ajuste del tratamiento y
> no otro dato.

**Si nos dices que lo portemos, lo portamos**; solo queremos que sea con esto a la vista, porque el día
que los dos números discrepen en un paciente real nadie va a saber cuál mandaba.

---

# 3 · Una pieza tuya que sí portamos, para que sepas que está

Tu bloque de **"Datos Personales"** con las medidas editables, y tu nota:

> *"Peso, estatura, cintura y cadera son editables (si faltan en el archivo o llegaron mal). Los índices
> IMC, ICC, ICT, ASMI y las clasificaciones de AF/FFMI/FMI se recalculan automáticamente al editar."*

**No lo teníamos**, y hacía falta: si el archivo del equipo traía la cintura mal, la única salida era
cerrar la evaluación y rehacerla entera. Para un dígito, desproporcionado.

Tres diferencias con el tuyo, todas deliberadas:

1. **Solo antes del diagnóstico.** Después la medición queda sellada y el camino es corregir la
   evaluación, que genera una versión nueva. Cambiar una medida sobre la que ya se emitió un
   diagnóstico no es editar: es corregir, y tienen que quedar las dos versiones.
2. **La fuerza prensil no está ahí**, aunque tu bloque la tenga: en Atlas ya se captura en las
   condiciones del BIS, y dos sitios para el mismo dato es peor que uno.
3. **Se ve cuál valor es cuál.** Si se corrige la cintura, la pantalla dice "el equipo midió 84". El
   dato del aparato no se pierde ni se disimula.

**Las tres son del grupo de arriba: ninguna añade contenido clínico, las tres existen porque guardamos.**
La primera protege un diagnóstico ya emitido de cambiar bajo sus pies. La segunda evita dos capturas del
mismo dato que puedan contradecirse. La tercera conserva el valor del aparato, que en tu archivo no hace
falta conservar porque no se guarda nada.

**Y la decisión es tuya igual.** Son juicios nuestros sobre una pieza tuya, y cualquiera se revierte.

> **Pregunta 3.** ¿Las mantenemos o revertimos alguna? En concreto: ¿el sellado tras el diagnóstico te
> parece bien, o el profesional debería poder corregir también después? ¿Y la fuerza prensil se queda
> donde está (condiciones del BIS) o la quieres también aquí, aunque sean dos sitios? Si revertimos
> algo, dinos qué prefieres en su lugar.

---

# 4 · El MCA que falta se está calculando como 0, y el 0 ahí significa "normal"

Es el más grave de los defectos que encontramos en tu archivo, y por eso abre ese grupo.

## Qué encontramos

Tu tabla de composición, Nivel III, primera fila:

> **MCA — Masa celular activa (kg): —   ·   referencia 34,76   ·   Sin dato**

Tu pantalla es honesta ahí: dice que no hay dato. El problema está una pantalla
más allá. El **ISCM-BIS** consume el MCA, y cuando falta, tu `computeISCM` cae en
el `: 0` del final:

```js
const mcaZ = _zBis(bis.MCA_dif != null ? bis.MCA_dif : (bis.MCA && bis.MCA_ref ? bis.MCA - bis.MCA_ref : 0), 0.3261, 1.3467);
```

## Por qué importa

**Porque en esa fórmula el 0 no es "no sé": es una afirmación clínica favorable.**
`MCA_dif` es la desviación respecto del teórico, así que 0 quiere decir
*"el paciente está exactamente en su masa celular teórica"*. Un dato **ausente**
entra al índice como un dato **normal**, y el índice sale con un número y una
clasificación, sin ninguna marca de que le faltaba un insumo.

En este paciente no cambió la banda (los dos caen en ISCM-1), pero el mecanismo
sí puede cambiarla: el término aporta hasta +0,24 respecto de la media, y en un
paciente con déficit real de masa celular el 0 **subestima** el riesgo, que es la
dirección peligrosa.

## Cómo se ve el contraste

Atlas hace lo contrario, y por diseño: si falta **cualquiera** de los cuatro
insumos secundarios (FFW, MCA_dif, ECW_sg, ICW_sg), el ISCM sale **null** y no se
muestra. Preferimos una celda vacía que un número que parece completo. En Nico,
Atlas sí tiene el dato (**MCA 39,62 · ref 34,76 · Δ +4,86 · Adecuado**) y por eso
lo calcula.

> **Pregunta 4.** ¿Confirmas que el ISCM no debe calcularse cuando falta el MCA?
> Si prefieres que se calcule igual, dinos con qué valor y cómo debe marcarse en
> pantalla, porque hoy no se distingue de uno completo. Y por separado: ¿sabes por
> qué el MCA no está llegando a tu pantalla? En Atlas sí llega, del mismo export.

**Qué hacemos mientras respondes:** nada. Atlas ya devuelve null cuando falta un
insumo, así que se queda como está; si nos dices otra cosa, lo cambiamos.

---

# 5 · Siete filas "sin grasa" de tu archivo están mostrando el valor "con grasa"

Esto empezó como dos filas (te lo iba a mandar así) y al cotejar la tabla
completa resultaron **siete**, todas con la misma causa.

## Las siete parejas

Mismo paciente, misma medición (Nico, ACT 44,66 · masa grasa 18,04 · peso 80,40):

| Pareja | Tu pantalla | Atlas |
|---|---|---|
| ACT / **FFW** | 44,66 / **44,66** | 44,66 / **41,95** |
| Hidratación sin grasa / ACT/MLG | **71,6** / 71,6 | **70,33** / 71,60 |
| AEC con grasa (L) / **sin grasa (L)** | 17,33 / **17,33** | 17,33 / **15,30** |
| AEC % de ACT / **% de MLG** | 38,8 / **38,8** | 38,81 / **36,47** |
| AIC con grasa (L) / **sin grasa (L)** | 27,33 / **27,33** | 27,33 / **26,65** |
| AIC % de ACT / **% de MLG** | 61,2 / **61,2** | 61,19 / **63,53** |
| E/I con grasa / **sin grasa** | 0,634 / **0,634** | 0,63 / **0,57** |

**En tu archivo las siete parejas son idénticas. En Atlas las siete difieren.**

No son siete defectos sueltos: es que **la familia "sin grasa" no se está
derivando y cada fila cae en su contraparte "con grasa"**. Que tus propias filas
declaren referencias distintas (20,39 L en una, 35–40 % en la otra) confirma que
están pensadas como distintas; lo que colapsa son los valores.

## Por qué importa: no es cosmético, alimenta dos índices

**IEHH.** Tu pantalla muestra 0,885 y Atlas 0,81. La diferencia es exactamente el
FFW, y da la cuenta al decimal:

```
0,25 × (z(44,66) − z(41,95)) = 0,25 × 0,3206 = 0,0802
0,885 − 0,080 = 0,805  →  0,81
```

Ese 0,81 es el número de Atlas. Y tu 0,885 lo clasificas como "Desequilibrio
leve" contra referencia ≤0, o sea que el error llega hasta el veredicto.

**ISCM.** Reproducimos los dos valores completos, con tus constantes:

```
Tuyo    −0,929 + 0,242 + 0,727 − 0,706 − 1,078 = −1,744   (MCA = 0, FFW = 44,66)
Atlas   −0,929 − 3,367 + 0,660 − 0,706 − 0,757 = −5,098   (MCA_dif = 4,86, FFW = 41,95)
```

Los dos cierran a la centésima contra lo que muestra cada pantalla (−1,75 y
−5,09). Lo decimos así porque es lo que hace la conclusión irrebatible: **las
fórmulas son idénticas** (las comparamos línea a línea entre tu v7 y tu archivo
del 26, sin una diferencia), así que la divergencia entera está en los insumos, y
son estos dos: el MCA del punto anterior y el FFW de este.

**Atlas está bien, y lo está por usar tus fórmulas.** La derivación usa tus
identidades congeladas, verificadas sobre 5.073 registros.

> **Pregunta 5.** ¿Confirmas que las siete filas deben derivarse y hoy no lo
> están? Lo preguntamos porque el arreglo no es fila por fila: si es la derivación
> de la familia, se corrige una vez. Y si en alguna de las siete el valor "con
> grasa" es el correcto a propósito, dinos en cuál y por qué.

**Qué hacemos mientras respondes:** nada. Atlas ya deriva las siete con tus
fórmulas y no vamos a alinearlas con tu pantalla; si nos dices que alguna debe ir
al valor con grasa, la cambiamos.

---

# 6 · El mismo IRC sale "Alto riesgo" en rojo en una pantalla tuya y "Bajo" en verde en la otra

## Qué encontramos

| Dónde | Valor | Referencia | Δ | Veredicto |
|---|---|---|---|---|
| **Tu tabla de composición** | 16.222 | 2,0–2,8 (×10) | 14.222 | **Alto riesgo celular** (rojo) |
| **Tu tarjeta Celular-Eléctrico** | 1,62 | corte <1,68 bajo | | **Bajo** (verde) |
| **Atlas** | 1,62 | <1,68 | −0,06 | Bajo riesgo (verde) |

Mismo paciente, misma medición, mismo indicador: 16.222 es 1,6222 × 10.

## Por qué importa

Tu tabla multiplica el valor por 10 y lo compara contra una referencia rotulada
"(×10)" que **no está multiplicada**. El resultado es un rojo de "alto riesgo
celular" en un paciente que tu otra pantalla clasifica en verde. Un profesional
que abra las dos pestañas ve dos veredictos opuestos del mismo número, y no tiene
cómo saber cuál manda.

## Lo que NO hacemos

**No resolvemos cuál referencia es la buena**, y queremos ser explícitos en eso:
el 2,0–2,8 tampoco coincide con tu corte 1,68–2,11, así que no es solo que falte
multiplicar por 10. Son tres juegos de números y el que sobra no lo elegimos
nosotros.

> **Pregunta 6.** ¿Cuál es la referencia correcta del IRC y en qué escala? Con eso
> ajustamos si hace falta. Y de paso: ¿la tabla debe mostrar el IRC ×10 o sin
> multiplicar? Atlas lo muestra sin multiplicar, como tu tarjeta.

**Qué hacemos mientras respondes:** nada. Atlas usa tu corte del clasificador
(<1,68), que es el que coincide con tu propia tarjeta.

---

# 7 · Tres detalles menores de la misma tabla

Los agrupamos porque ninguno cambia un diagnóstico, pero los tres se ven.

1. **La columna Δ del ISCM y del IAE repite el valor en vez de la diferencia.** El
   ISCM muestra Δ −1,75 contra referencia ≤−1; debería ser −0,75. El IAE muestra
   Δ 12,3 contra referencia −5 a +5. Las demás filas sí calculan la diferencia
   (EB-BIS: 34,3 − 22,0 = 12,3, correcto).
2. **El ICA-BIS lleva la referencia del PABU.** Tu fila dice "φ = 1,618", pero el
   ICA-BIS ya *es* la desviación respecto de φ, así que su referencia es 0. Es la
   misma que nosotros corregimos hace unas semanas, la mencionamos por si viene
   de la misma línea.
3. **El AEC/MCA queda "Sin dato"** por la misma causa del punto 4 (el MCA que no
   llega). Se resuelve solo cuando se resuelva aquel.

> **Pregunta 7.** ¿Los tomas los tres, o alguno es deliberado?

**Qué hacemos mientras respondes:** el 2 ya está corregido en Atlas; el 1 y el 3
no nos aplican.

---

# 8 · El radar: los colores que usamos son los de tu radar retirado

Este es **nuestro** y lo devolvemos para que decidas, porque toca cómo se lee el
instrumento.

## Qué hicimos

|  | Anillos, del centro al borde | Leyenda |
|---|---|---|
| **Tu radar actual** | verde → ámbar → naranja → rojo | Bajo · Leve · Moderado · Alto |
| **Tu radar anterior** | blanco → **azul** → verde → amarillo → rojo | Excepcional · Muy bien · En la norma · A vigilar · A tratar |
| **Atlas hoy** | blanco → **azul** → verde → ámbar → rojo | Bajo · Leve · Moderado · Alto |

Atlas quedó como un híbrido: tomamos **las etiquetas de tu radar vigente y los
colores del que retiraste**.

## Por qué importa

Porque produce una contradicción **dentro de una misma pantalla nuestra**: el
badge de la tarjeta Conductual-Perceptual dice **"Bajo" en verde**, y unos
centímetros más abajo la leyenda del radar dice **"Bajo" en azul** y le da el
verde a **"Leve"**. La misma palabra con dos colores, y quien lea el anillo verde
como "el bueno" está leyendo Leve.

La decisión de dejar el azul solo en el radar (porque ahí es escala y no
clasificación) es defendible, pero se tomó sin ver que las dos superficies
conviven en la misma pantalla con el mismo vocabulario.

> **Pregunta 8.** ¿Retiramos el azul del radar y usamos tu semáforo actual
> (verde/ámbar/naranja/rojo), o prefieres que el radar conserve su escala propia y
> cambien las etiquetas para que no repitan las de los badges? Cualquiera de las
> dos la aplicamos; lo que no queremos dejar es la misma palabra con dos colores.

**Tu punto 0 ya apunta a la respuesta** (tu archivo manda, y tu radar usa el semáforo), pero preferimos
que la des tú: el azul lo pusimos por una razón que puede seguir valiendo, y cambiar la pieza más mirada
del sistema sin que lo digas no nos parece.

**Qué hacemos mientras respondes:** nada, se queda como está. Es un cambio visual
en la pieza más mirada del sistema y no lo tocamos por nuestra cuenta.

---

# 9 · Los subrótulos del radar: información que tú das y nosotros perdemos

## Qué hicimos

En tu radar, el nivel de cada dominio va **coloreado**: "Alto" bajo Enveje. sale
en rojo, "Bajo" en verde. El estado malo salta a la vista sin leer. En Atlas los
cinco van en gris parejo.

## Por qué importa

No es una diferencia de gusto: es información que tu versión entrega y la nuestra
no. Con cinco dominios en gris, encontrar cuál está mal exige leer los cinco.

Probablemente esto sea simplemente un porte que nos faltó, no una decisión, pero
preferimos confirmarlo antes de tocar el radar.

> **Pregunta 9.** ¿Confirmas que los subrótulos deben ir coloreados por severidad,
> como en tu archivo? Si es sí, lo portamos tal cual.

**Qué hacemos mientras respondes:** nada, por lo mismo del punto anterior.

---

# 10 · Tu bloque de datos crudos: ¿uno o cuatro?

Al aplicar tu regla de las dos condiciones encontramos que tu bloque `=== DATOS CRUDOS DEL PACIENTE ===`
ya trae los diez ítems de la lista del 26. Lo portamos tal cual. Una sola duda antes:

**Tu bloque es UNO SOLO**, el mismo para todo el diagnóstico. La lista del 26 estaba organizada por
profesión (médico, nutricionista, entrenamiento, psicología). Armar cuatro versiones sería inventar una
estructura que tu archivo no tiene, así que no lo hacemos.

> **Pregunta 10.** ¿Confirmas que va un bloque único, igual para los cuatro profesionales, como en tu
> archivo? Si querías cuatro vistas, dinos qué lleva cada una y lo hacemos con tu criterio, no con el
> nuestro.

**Qué hacemos mientras respondes:** portamos el bloque único, que es lo que tu archivo tiene.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
