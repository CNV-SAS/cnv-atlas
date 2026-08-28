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

Con eso se cae también la pregunta que traíamos sobre el alérgeno de LUVIA, así que esta ronda empieza en
la 2: tu punto 10 la contestó antes de que te llegara.

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

## Y tercero: cuatro defectos de tu archivo, y tres preguntas de forma

Los puntos **4 a 7** son defectos que encontramos cotejando pantalla contra pantalla. El 4 y el 5 tienen
cifras clínicas de por medio y los reprodujimos al decimal contra tus propias fórmulas antes de
escribirte; el 4 es el que más nos preocupa.

Los puntos **8 a 11** son de forma, y en los cuatro tu archivo no decide por nosotros: los colores del
radar, los rótulos que tú pones y nosotros perdemos, si tu bloque de datos crudos va uno o cuatro, y cómo
se acota el resumen de condiciones sin volverlo la lista de mercado que no quieres.

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

# 9 · Dos sitios donde tú rotulas y nosotros no: el radar y la Diana

## Qué hicimos

En tu radar, el nivel de cada dominio va **coloreado**: "Alto" bajo Enveje. sale
en rojo, "Bajo" en verde. El estado malo salta a la vista sin leer. En Atlas los
cinco van en gris parejo.

## Por qué importa

No es una diferencia de gusto: es información que tu versión entrega y la nuestra
no. Con cinco dominios en gris, encontrar cuál está mal exige leer los cinco.

Probablemente esto sea simplemente un porte que nos faltó, no una decisión, pero
preferimos confirmarlo antes de tocar el radar.

## Y el mismo caso en la Diana

En tu Diana, cada sector lleva debajo del código lo que significa: bajo **E9** dice *"FMI Alto · FFMI
Bajo"*, bajo **E1** *"FMI Bajo · FFMI Alto"*, bajo **E4** *"FFMI Normal · FMI Normal"*, y así los nueve.
En Atlas los sectores salían con el código solo: **E1, E2, E3...** sin nada debajo.

Es la misma pérdida y pesa más aquí, porque son 81 celdas: sin el rótulo, `E4` es un código opaco y hay
que saberse el mapa de memoria para leer la posición del paciente. Tu centro además dice *"EFR · #1
centro"* y el nuestro solo *"EFR"*.

> **Pregunta 9.** ¿Confirmamos que los subrótulos van, en los dos sitios: coloreados por severidad en el
> radar, y con el par FMI/FFMI en cada sector de la Diana? Los portamos ya, por lo que sigue.

**Y dos cosas de la tabla de intercambio, que declaramos sin preguntarte porque no cambian cifra,
corte ni rótulo clínico, solo cómo se leen:** los números van alineados a la **derecha** con cifras
tabulares y no centrados como en tu tabla (centrar impide que los dígitos se alineen entre filas), y las
porciones van **prellenadas** en vez de tras un botón "Sugerir" (el valor prellenado sale de tu propio
`computeIntercambio`, así que no es una sugerencia nuestra). **Las dos se revierten si prefieres las
tuyas.**

**Este SÍ lo adelantamos, y te decimos por qué:** es "no puede tener menos" puro, tu archivo ya los tiene
y el criterio no cambia con la entrega nueva. En el radar el nivel va con el mismo semáforo de los badges
(no con la escala de los anillos, que es otra cosa); en la Diana el par sale DERIVADO de tu propio
`EFR_RISK_ORDER`, el mismo que decide la posición y el color de la celda, así que rótulo y posición no se
pueden desincronizar. Cotejamos los seis sectores cuyos rótulos se leen en tu captura y coinciden los
seis. **Si alguno te parece mal, se revierte.**

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

**Qué hacemos mientras respondes:** esperamos, y por una razón concreta: el bloque conviene portarlo
contra tu archivo nuevo, no contra el del 26, para no portar dos veces una pieza que acabas de tocar. En
cuanto llegue, lo portamos como bloque único salvo que nos digas otra cosa.

---

# 11 · El resumen de condiciones: tus tres fuentes son tuyas, el bloque único no

Nos diste la instrucción en tu punto 11: el resumen del tratamiento son **las alertas de la encuesta, más
las de la composición corporal, más las autodeclaradas**, y **un resumen, no una lista de mercado**.

Fuimos a tu archivo a buscar qué cuenta como "alerta" en cada una, en vez de decidirlo nosotros. Las tres
tienen criterio y **las tres son tuyas**:

| Fuente | Criterio | Dónde |
|---|---|---|
| Autodeclaradas | diagnósticos salvo "Ninguno", antecedentes solo los de tu `AF_MAP`, TCA prioritario, HTA por campo si no está en el listado | tu bloque de la franja de alertas |
| Composición | clasificación alterada (`sev ≥ 1`) | tu tabla, como tu HC |
| Encuesta | `generarAlertas`, 15 reglas con su nivel | tu `generarAlertas` |

Y sobre la última hay dos cosas que tenemos que decirte antes de portarla.

## 11a · `generarAlertas` está escrita pero nunca se ejecuta

**No la llama nadie.** Ni en el archivo del 19 ni en el del 26: la función se define y ahí termina. Cada
uno de sus quince títulos aparece **exactamente una vez** en todo el archivo, dentro de la definición.

Lo verificamos porque nos pasó justo lo contrario de lo que esperábamos: fuimos a buscar el criterio, lo
encontramos, y al ir a portarlo vimos que tu software **no emite ninguna de esas quince alertas hoy**.

Por eso no la portamos todavía. Portarla haría que Atlas muestre quince avisos que tu pantalla no muestra,
y eso es exactamente el "no puede tener más" de tu punto 0. **Es una decisión tuya, no nuestra.**

> **Pregunta 11a.** ¿`generarAlertas` es una pieza que quedó pendiente de conectar, o quedó fuera a
> propósito? Si la quieres viva, la portamos con sus quince reglas tal cual. Si quedó fuera, la dejamos
> donde está.

## 11b · Y si la conectas, dos de sus quince reglas leen el grupo equivocado

Esto lo encontramos al portarla, y por tu propia regla del punto 8 ("nunca rotulen por posición, siempre
por `n`"). Contra tu `FREQ_GROUPS`:

- `n: 13` = **Azúcares añadidos y bebidas azucaradas**
- `n: 14` = **Ultraprocesados (PCBU)**
- `n: 15` = **Carnes rojas**

Y las reglas:

| Regla | Lee | Debería leer | Consecuencia |
|---|---|---|---|
| **"Riesgo glucémico crítico"**, cuyo texto dice *"N porciones de **bebidas azucaradas** con DM2"* | `d1_15` = **carnes rojas** | `d1_13` | Un diabético con alto consumo de bebidas azucaradas **no dispara la alerta**; uno que come carne roja, sí |
| **"Estrés alto + azúcares elevados"** | `d1_14` = **ultraprocesados** | `d1_13` | La alerta se llama de azúcares y mide otra cosa |

La primera es la que nos preocupa: es una alerta de nivel **crítico**, y hoy está invertida respecto de lo
que su propio texto anuncia.

**Y creemos que las dos siguen ahí justamente porque la función no corre.** Nunca han producido una salida
que alguien pudiera contrastar. Es el argumento más fuerte que se nos ocurre para conectarla o retirarla,
pero no para dejarla como está.

> **Pregunta 11b.** ¿Confirmas que son `d1_13` en los dos casos? Si la conectamos, la portamos con la
> corrección; si prefieres que la portemos literal y la arregles tú en el archivo, dinos y lo hacemos así.

## 11c · Lo que no está en tu archivo es el bloque único, y ahí está el riesgo que tú señalaste

Tus tres fuentes viven **en tres sitios distintos**: la franja de autodeclaradas es un encabezado,
`generarAlertas` es una función aparte, y la composición es tu tabla. **El bloque único que las funde
está en tu instrucción, no en tu archivo.** Así que la forma la elegimos nosotros, y preferimos no hacerlo
solos porque es donde aparece la lista de mercado que no quieres.

Con tu propio paciente de demo (`d5_39: ["Diabetes tipo 2", "HTA", "Dislipidemia"]`) la cuenta da así:

- 3 diagnósticos declarados
- los antecedentes familiares que estén en tu `AF_MAP`
- las alertas de encuesta que disparen
- las filas de composición con clasificación alterada

**Entre diez y catorce líneas.** Eso ya no es un resumen, y es tu propio caso de prueba, no uno extremo
que hayamos construido.

> **Pregunta 11c.** ¿Cómo lo acotamos? Se nos ocurren tres formas y cualquiera nos sirve: **(1)** solo
> `crítico` y `alto`, dejando lo moderado fuera; **(2)** agrupado por dominio, con un renglón por dominio
> y el detalle plegado; **(3)** un tope de N líneas por prioridad. Pero elegir cuál **es criterio clínico
> y es tuyo**: la diferencia entre las tres es qué deja de ver el profesional.

**Qué hacemos mientras respondes:** nada de las tres. La composición ya muestra sus alteradas en su tabla,
que es donde tu archivo las tiene.

---
---

# 12 · Qué pasa con lo ya emitido cuando cambia la ciencia

Tu instrucción sobre el LE8 abrió esto, y es la más grande de la ronda:

> *"Sobre lo ya evaluado: recalcular, y que quede anotado en la historia que el DFI cambió de versión.
> Recalcular en silencio borra el rastro; no recalcular deja en pie diagnósticos que sabemos mal."*

Estamos construyendo las dos mitades. Ya está la primera: el sistema **detecta y marca** los documentos
emitidos con una versión anterior, sin invalidarlos (siguen siendo válidos: se emitieron correctamente con
lo que regía entonces). Lo que falta es quién decide reemitir, y eso es tuyo.

## Antes de las preguntas, el dato que las hace concretas

**No es hipotético: ya pasó.** Lo medimos sobre nuestra base:

- **23 de 40 diagnósticos** siguen emitidos con el motor anterior, tras el cambio de versión del 19 de
  agosto.
- **Y 7 de los 8 diagnósticos CONFIRMADOS**, que son los sellados, los que un profesional firmó.

Nadie se enteró, porque hasta ahora no había nada que lo dijera. Y eso fue con **un** cambio de versión.
El del LE8 va a mover más.

## Y una distinción que cambia la urgencia, aunque el mecanismo sea el mismo

Los casos que esperan esto son de dos clases:

- La **calibración de la EB-BIS** y el **LE8** cambian el **diagnóstico**.
- El porte de `motorTratNutri` cambia el **tratamiento**: el sodio del hipertenso pasa de 2.300 a 1.500,
  y un plan aprobado antes sigue prescribiendo lo anterior.

**Un diagnóstico reemitido cambia una lectura; un tratamiento reemitido cambia lo que alguien come hoy.**
La máquina puede ser la misma; a quién se le avisa y con qué prisa, no.

---

> **Pregunta 12a (la que decide la forma).** Una recalibración poblacional **afecta a todos por
> definición**. Si la reemisión queda en manos de cada profesional, uno por uno, **garantiza que quede
> parcial**: unos pacientes con la ciencia nueva y otros con la vieja, sin criterio, según quién entró a
> mirar. ¿Quieres que una recalibración se dispare **en bloque desde la Dirección Científica**, y que el
> profesional se entere en vez de decidir? ¿O prefieres que decida siempre él, aceptando que quede
> parcial?

> **Pregunta 12b (la que la complementa).** Si siempre queda en manos del profesional, **un diagnóstico
> que sabemos mal puede quedarse en pie para siempre**, que es exactamente lo que dices que no quieres.
> ¿Hay casos en que la reemisión debe ser **obligatoria** y no opcional? Y si los hay, ¿cuál es el
> criterio: el tipo de cambio (calibración sí, clasificador no), o cuánto se mueve el resultado?

> **Pregunta 12c (el paciente).** Aquí el dato que la hace decidible: **el paciente ya recibió el reporte
> anterior.** Así que no es "¿le mandamos el nuevo?", es **"¿le decimos que el anterior cambió?"**. Un
> reporte reemitido en silencio deja al paciente con dos documentos distintos y sin saber cuál manda;
> avisarle de un cambio que no altera su conducta puede alarmarlo sin motivo. ¿Qué prefieres, y cambia
> según si es diagnóstico o tratamiento?

**Qué hacemos mientras respondes:** la detección y el marcado, que no dependen de tu respuesta y son útiles
igual (hoy nadie sabe qué documentos quedaron atrás). **No construimos la reemisión** hasta que contestes
la 12a: es la que decide si el mecanismo es masivo o uno por uno, y construirlo al revés sería rehacerlo
entero.

---
---

# 13 · Tú tienes UN menú y nosotros dos: ¿los unimos?

## Lo que hace tu `generarMenuGroq`

```
1. Elige un día de arranque al azar en el ciclo de 21
2. Arma un menú base de 7 días desde CICLO_MENU_21
3. Si NO hay restricciones → usa el ciclo tal cual y termina. No llama a la IA.
4. Si las hay → manda el menú base + las restricciones + la ciudad, y pide ADAPTARLO
5. Si la IA falla o el JSON no parsea → vuelve al ciclo base
```

**La IA no inventa un menú: adapta uno que ya existe**, y solo entra cuando hay restricciones. En tu
archivo hay **un solo menú**: la grilla de 7 días, llena por el ciclo y opcionalmente adaptada.

## Lo que hay en Atlas, y es la divergencia de fondo

**Nosotros tenemos DOS cosas donde tú tienes una:**

1. **La grilla semanal editable**, precargada desde tu ciclo de 21 días (portado verbatim, con golden
   test). Esta funciona hoy y no depende de la IA.
2. **Una tarjeta de "sugerencia de menú" aparte**, generada por IA **desde cero**: no parte de tu ciclo,
   le manda objetivo, proteína, restricciones del modelo y del profesional, fenotipo, sector funcional,
   rutas y patrón, y le pide componer un menú estructurado.

Las dos conviven en la misma pantalla y **no se hablan**.

## Por qué te lo preguntamos en vez de resolverlo

Porque **hacemos más que tú, y es justo lo que tu punto 0 mira con lupa.** Un modelo de lenguaje
componiendo un menú a partir del contexto clínico **es otro instrumento** que un adaptador de un ciclo
fijo. No es el caso de `generarAlertas` (aquella no se ejecuta nunca), pero es la misma familia:
construimos de más sin preguntarte.

Y porque unirlas no es un ajuste: las dos tienen formas distintas (la tuya son textos por tiempo de
comida, la nuestra una lista de alimentos con porción), así que alinearlas es rehacer el contrato de
salida, no cambiar tres líneas.

> **Pregunta 13.** ¿Unimos las dos en una sola, como en tu archivo, con el ciclo como base y la IA solo
> para adaptarlo cuando hay restricciones? ¿O prefieres conservar la sugerencia aparte, y entonces
> dinos qué debe hacer que la grilla no haga?
>
> Y una que cambia cómo lo explicamos en pantalla: **¿partir del ciclo es criterio clínico o economía?**
> Si es porque el paciente debe recibir comida colombiana conocida y no lo que un modelo componga, eso
> hay que decirlo en la pantalla, no solo hacerlo.

**Qué hacemos mientras respondes:** nada. Las dos siguen como están. La grilla, que es la que el
profesional usa para trabajar, funciona con tu ciclo y no depende de la IA.


# Resumen: las dieciséis, por si prefieres responder por prioridad

| # | Qué es | Qué necesitamos de ti | ¿Bloquea? |
|---|---|---|---|
| **4** | Tu ISCM se calcula con **MCA = 0** cuando el MCA falta, y ahí el 0 significa "está en su teórico" | Confirmar que no debe calcularse sin MCA. Y por qué el MCA no llega a tu pantalla | **No.** Atlas ya devuelve null si falta un insumo |
| **5** | **Siete filas "sin grasa"** de tu tabla muestran el valor "con grasa". Alimenta IEHH e ISCM | Confirmar que deben derivarse, o decirnos en cuál el valor con grasa es el correcto | **No.** Atlas ya las deriva con tus fórmulas |
| **6** | El mismo IRC sale **"Alto riesgo" en rojo** en tu tabla y **"Bajo" en verde** en tu tarjeta | Cuál es la referencia correcta y en qué escala | **No.** Atlas usa el corte de tu clasificador |
| **7** | Tres menores: Δ del ISCM y del IAE, referencia del PABU en el ICA-BIS, AEC/MCA sin dato | Si los tomas los tres o alguno es deliberado | **No.** El del ICA-BIS ya está corregido aquí |
| **11a** | **`generarAlertas` está escrita y nunca se ejecuta.** Cero llamadores en tus dos entregas | Si quedó pendiente de conectar o quedó fuera a propósito | **No.** No la portamos hasta que lo digas |
| **11b** | Dos de sus quince reglas leen el grupo equivocado. La de **riesgo glucémico es de nivel crítico** | Confirmar que son `d1_13` las dos | **No.** El cambio está listo y sin aplicar |
| **11c** | El **bloque único** que funde tus tres fuentes no está en tu archivo. Con tu paciente demo: 10 a 14 líneas | Cómo se acota: solo crítico y alto, agrupado por dominio, o tope por prioridad | **No.** No construimos ninguna de las tres |
| **2** | El **"Meta kg"**: no es contenido clínico, es en cuántos sitios se puede editar un dato | Si lo portamos a la entrada o se queda solo en el tratamiento | **No.** No lo portamos mientras tanto |
| **3** | Las **tres diferencias** de tu bloque de medidas editables: sellado, fuerza prensil, traza del valor | Si las mantenemos o revertimos alguna | **No.** Se quedan como están, y cualquiera se revierte |
| **8** | Nuestro radar usa los colores de tu radar **retirado**: "Bajo" sale azul aquí y verde en tu semáforo | Si retiramos el azul o cambian las etiquetas | **No.** No lo tocamos por nuestra cuenta |
| **9** | Los **subrótulos** del radar y de la Diana, que tú pones y nosotros perdíamos | Confirmar. **Este ya lo adelantamos**, y se revierte si lo ves mal | **No.** Hecho y reversible |
| **10** | Tu bloque de datos crudos: **¿uno solo o cuatro** vistas por profesión? | Confirmar que va uno, como en tu archivo | **No.** Pero **espera tu archivo** |
| **12a** | Una **recalibración afecta a todos por definición**. Uno por uno garantiza que quede parcial | Si se dispara en bloque desde Dirección Científica o decide cada profesional | **No.** Pero **decide la forma del bloque**, así que no lo construimos |
| **12b** | Si siempre decide el profesional, un diagnóstico que sabemos mal puede quedarse en pie para siempre | Si hay casos de reemisión obligatoria, y con qué criterio | **No** |
| **12c** | **El paciente ya recibió el reporte anterior**: no es si le mandamos el nuevo, es si le decimos que cambió | Qué prefieres, y si cambia entre diagnóstico y tratamiento | **No** |
| **13** | Tú tienes UN menú (la grilla, llena por el ciclo); nosotros DOS que no se hablan, y la segunda la compone la IA desde cero | Si las unimos como en tu archivo, y si partir del ciclo es criterio clínico o economía | **No.** Las dos siguen como están |

## Lo que esto quiere decir, y por eso va la petición que sigue

**Ninguna de las dieciséis bloquea construcción.** Las dieciséis dicen lo mismo en la última columna, y no es
casualidad: cada punto está escrito para que podamos seguir mientras respondes, y en todos el estado
provisional es el que ya tenemos, no uno inventado a la espera.

**Lo que nos tiene detenidos no son tus respuestas: es tu archivo.** El piso calórico corregido, los cinco
defectos, el cableado de `CAP_REF` y el porte de tu bloque de datos crudos están los cuatro parados, y de
los cuatro ya sabemos exactamente qué hay que hacer. Solo falta el `ATLAS_v8.html` que anuncia tu
respuesta del 27.

Por eso lo que sigue no es una queja de proceso: es lo único de esta ronda que de verdad nos frena.


# Una petición de proceso, y la razón

**Cuando respondas y ajustes tu archivo, mándanos la versión modificada en la misma entrega.**

No es un reclamo: es que casi cada ronda produce correcciones en tu HTML, y en el intervalo entre tu
respuesta y el archivo nuevo **quedamos portando una versión que tú ya cambiaste**. Esta misma ronda es el
ejemplo: tu respuesta del 27 dice *"va el `ATLAS_v8.html` de hoy, con el piso corregido y los cinco
defectos"*, y el archivo no venía. Mientras tanto, el piso, los cinco defectos y el cableado de `CAP_REF`
están detenidos, aunque ya sabemos exactamente qué hay que hacer con los tres.

Lo que perdemos no es tiempo de trabajo: es que **portar contra la versión anterior nos obliga a portar
dos veces**, y la segunda vez el riesgo no es repetir el esfuerzo, es que quede una mezcla de las dos
versiones sin que nadie lo note. Un rango de un archivo con una fórmula del otro no da un error: da un
número plausible y equivocado.

Con el archivo en la misma entrega, tu respuesta y su implementación quedan en el mismo acto, que es lo
mismo que tú nos pediste para el LE8: **dos cosas que tienen que caer juntas o ninguna.**

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
