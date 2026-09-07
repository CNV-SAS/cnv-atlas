# Lo que queda abierto contigo, Gildardo

**Connected Nutrition Ventures · Atlas · 2026-09-06, actualizado el 2026-09-07** con lo que salió de tu revisión de Atlas.

Este es **el documento único**: todo lo que quedó abierto de tu lado después del cotejo visual completo de
Atlas contra tu HTML. Antes estaba repartido en dos sitios y eso hacía que algo se quedara sin llegarte;
ahora es uno solo.

**Está ordenado por lo que te cuesta responder:**

| | Qué es | Cuántas |
| --- | --- | --- |
| **Primero** | Un aviso de **datos personales** que no podíamos guardarnos | 1 |
| **Después** | Lo que se responde **en una línea**, sin abrir tu archivo | 7 |
| **Al final** | Lo que necesita que **mires tu archivo** | 10 |
| **Y aparte** | Lo que **decidimos nosotros** y solo te declaramos | 15 |

**Nada de esto frena a Atlas.** Todo está construido y funcionando con la decisión que tomamos en cada
caso; lo que te preguntamos es si la decisión fue la que tú habrías tomado. Donde dice *"se cambia en una
línea"* es literal.

---

# PRIMERO · El ejemplo de tu prompt lleva el nombre de una persona, y viaja al proveedor de IA en cada llamada

Dentro de tu **prompt de sistema** del Análisis IA hay un EJEMPLO de tono que empieza así:

> *"El paciente, [nombre y dos apellidos], un hombre de 61.2 años, con antecedentes familiares de Cáncer,
> Obesidad, HTA y Enfermedad de tiroides, con diagnóstico personal de insuficiencia renal..."*

y sigue con estrato, estado civil, hábitos, composición corporal y valores bioeléctricos. **Es una
historia clínica corta, con nombre y apellidos.**

**Va en el mensaje de SISTEMA.** Eso significa que se envía al proveedor de IA **en cada llamada del
Análisis IA, para todos los pacientes**: no una vez, no en pruebas.

**La pregunta es una: ¿es una persona real?**

Si lo es, son datos de salud de alguien que no es el paciente que se está atendiendo, saliendo hacia un
tercero sin su autorización, y **hay que retirarlo del archivo**. El ejemplo sirve igual sin identidad: lo
que enseña es el **tono** y el nivel de detalle, no quién es la persona. Nosotros ya lo portamos así.

**Y lo decimos también por nosotros:** ese archivo está guardado en nuestro repositorio (**once entregas
tuyas archivadas lo contienen**), así que si el caso es real también lo estamos custodiando nosotros, y
tenemos que decidir juntos qué hacemos con esas copias.

---
// Respuesta: No envien el nombre del paciente, y si hay datos de identificación como cedula o similarestTampoco los envien. En caso de ser posible, traten de enviar edad, diagnostico, todo lo del prompt completo que tiene el html, para que no pierda la sustancia, pero NO enviar el nombre.

# DESPUÉS · Lo que se responde en una línea

## 1 · ¿Cómo quieres que abra el párrafo de IA, sin el nombre?

Tu **"Análisis IA"** produce un diagnóstico integral estructurado por los cinco dominios del DFI, y el
nuestro producía un párrafo corto. **Comparamos los dos prompts: tienes razón tú, y lo estamos portando**
(el esqueleto del DFI, los cortes por sexo, las reglas de la PABU y del IFC frente al ángulo de fase, y el
formato en prosa).

**Con una diferencia que no podemos evitar: el NOMBRE del paciente no viaja al modelo.** Tu bloque abre
con `Nombre: ...`; el nuestro no lo lleva. No es preferencia: la Ley 1581 y el consentimiento que el
paciente firma dicen que los sistemas automatizados trabajan *"a partir de variables clínicas
seudonimizadas, sin sus datos de identificación"*. Sí viajan edad, sexo, ocupación, estado civil y
estrato, que son los determinantes del dominio Epigenético-Contextual.

**Tu instrucción de apertura dice** *"identifica al paciente y enmarca todo con el riesgo funcional
integrado"*. **Sin nombre, ¿cómo quieres que abra?** Nuestra propuesta es *"El paciente, un hombre de 22
años..."*, o sea tu misma frase sin el nombre. Si prefieres otra, dínosla y la ponemos textual.

// Respuesta: Elijan como abre el parrafo de la IA. Puede ser algo tan simple como "el paciente" como ustedes dicen. Lo importante es que sea igual al html pero sin el nombre del paciente.

## 2 · ¿El criterio del profesional debe ir a la historia clínica?

En Atlas el profesional escribe un **criterio propio** sobre el diagnóstico, en el bloque que tu archivo
encabeza como *"Diagnóstico Integrado ANI BIS-E"* (en el tuyo ese panel es de solo lectura, con el texto
que escribe la IA; el nuestro es donde el profesional escribe).

**Hoy ese texto no va a ninguna parte**: ni al reporte del paciente, ni al PDF, ni a la historia clínica.
Es interno de la evaluación.

**Es el único texto que el profesional escribe sobre el diagnóstico.** ¿Debe constar en la historia
clínica?

// Respuesta: de momento no, puede cambiar a futuro.

## 3 · La fila PABU de tu tabla usa un clasificador distinto del congelado

En tu tabla de Composición, la fila **PABU** rotula **"PABU bajo"**, que viene de un clasificador local de
la tabla y no de `cPABU`. Nosotros usamos `cPABU` (**"Desviación por exceso"**), porque es el del motor y
tu instrucción del 17 de agosto fue literal: *"cPABU: pórtenlo tal cual, y no lo gradúen"*.

**El color coincide** (ámbar los dos), así que en pantalla se lee igual. Solo cambia la palabra. **Si
prefieres el rótulo de tu tabla, se cambia en una línea.**

// Respuesta: Ya revisé ATLAS y está bien como lo tienen.

## 4 · Tres entradas mal clasificadas en Leche semidescremada

*Avena líquida con leche de vaca descremada*, *Yogurt de leche entera - Yox* y *Yogurt de leche entera
cuchareable* están en el subgrupo de **semidescremada** y su propio nombre dice otra cosa. Las dejaste
señaladas sin corregir.

**No las tocamos**, por lo mismo de siempre: es tu tabla, y corregirla por nuestra cuenta abre la puerta a
"corregirte" cosas que no son errores. **Con un "corríjanlas" se corrigen y quedan con candado.**

## 5 · ¿Hacemos la revisión ortográfica completa de la tabla de intercambio?

Cuando encontramos las cuatro erratas que ya corregiste (*instántaneo*, *azticar*, *panels*), el alcance
fue honesto y limitado: salieron de la lista de **un** paciente, o sea **80 de los 350 alimentos**. **No
se revisaron los otros 270.**

**Te lo ofrecimos y quedó sin respuesta:** podemos hacer la revisión completa de una vez, en vez de que
vayan apareciendo por goteo en el PDF de cada paciente. **Dinos si la hacemos y te la mandamos como
lista**, para que corrijas tú y nosotros re-portemos.

## 6 · Dos cambios de la encuesta que prometiste y no llegaron en la entrega del 4

Los dos verificados en tu archivo del 4 de septiembre, uno por uno, antes de escribirlos.

**(a) La P23 sigue diciendo `(≥30 min)`.** Su texto es *"¿Cuántos días/semana hace actividad física
(≥30 min)?"*, y **contradice lo que tú mismo añadiste**: la opción *"No hago ejercicio"* en esa misma
pregunta y *"0 minutos a la semana"* en la P24. Si la duración se pregunta aparte en la P24, el `≥30 min`
de la P23 sobra y confunde. Dijiste que lo quitabas *"para la próxima entrega"*.

**(b) Las opciones de la P44 (intolerancias) siguen desnudas.** Hoy son `Ninguna · Lactosa · Gluten ·
Fructosa`, y dijiste que las acompañabas con el alimento, del tipo *"Lactosa (leche y lácteos)"*.

**Los dos necesitan un bump de versión de la encuesta de nuestro lado**, así que conviene que entren
juntos y no de a uno. **Dinos si van y los tomamos con la próxima entrega.**

// Respuesta: No importa. Ya lo tienen bien en Atlas.

## 7 · El nombre del modelo lleva DOS guiones: ANI-BIS-E

Cosa menor, pero se repite: en varios sitios de tu archivo el modelo aparece como *"ANI BIS-E"*, sin el
primer guión, y en otros como *"ANI-BIS-E"*.

**Unificamos Atlas en `ANI-BIS-E`** en todas las pantallas. Quedan sin cambiar las cadenas que están
DENTRO de tu código congelado (el resumen clínico del protocolo y dos textos del motor nutricional),
porque esas no las editamos por regla. Si quieres, las cambias tú en la próxima entrega y las tomamos con
ella. **No pide respuesta.**

## Y un aviso que no pide nada: el comentario encima del interruptor del LE8

El comentario que está justo encima de `LE8_MAPEO_CORREGIDO` **sigue diciendo que la bandera "se queda en
`false`"**, y debajo el valor es `true`. Ya entendimos con tu respuesta que manda la decisión del 2 de
septiembre y que la nota del 30 quedó superada; el interruptor ya está encendido en Atlas y el ICEC
coincide con tu archivo.

Lo decimos porque **ese comentario nos frenó dos veces** y le va a pasar igual a la próxima persona que
abra el archivo. No hace falta que lo cambies: queda dicho.

// Respuesta: Mis respuestas son las que importan. Ya les di una instruccion, dejenla exactamente como les dije. Y ANI-BIS-E es correcto.

---

# AL FINAL · Lo que necesita que mires tu archivo

## 8 · La fila ICA-BIS tiene DOS reglas en tu archivo, una por superficie. ¿Es a propósito?

**En Diagnóstico → Composición Corporal**, la fila ICA-BIS usa un clasificador que **gradúa la magnitud**
en cinco escalones (Zona φ / Desviación leve / moderada / severa / Zona crítica).

**En Reporte / Historia Clínica** haces `icaBisClf = cPABU(t_pabu)`, y dejaste la nota al lado:
*"cICABIS eliminado, usar cPABU global"*.

**Atlas porta las dos, cada una en su superficie**, porque las dos son tuyas. **La pregunta es si la
diferencia es deliberada** (la historia resume y la pantalla detalla) **o si esa nota de la historia iba a
aplicarse también a la tabla de Composición y quedó a medias.**

Y de paso, algo que sí era nuestro y ya corregimos: el escalón **"Desviación leve"** va en **ámbar** en tu
archivo y nosotros lo teníamos en **verde**. Un ICA-BIS desviado se pintaba como si estuviera bien.

## 9 · Tu historia clínica y tu tabla de composición clasifican el % de grasa con cortes distintos

Esta salió del cotejo de la pestaña Reporte/HC, y **no es una diferencia entre tu archivo y Atlas, sino
entre dos sitios de tu propio archivo**.

| Dónde | Referencia | Con 22,4 % en un hombre |
| --- | --- | --- |
| **Tabla de la historia clínica** | H: 8-19,9 % / M: 21-32,9 %, con un criterio escrito ahí mismo (déficit < 8 · normal < 20 · límite < 25 · obesidad ≥ 25) | **"Límite"** |
| **Tabla de composición** | 10-22 % (borde superior 22 en hombres, 32 en mujeres) | **"Sobrepeso adiposo"** |

Mismo paciente, mismo número, dos veredictos. **Atlas usa hoy el segundo**, porque es el borde que nos
confirmaste el 18 de agosto.

**¿Cuál manda en la historia clínica?** Si es el de tu tabla de la HC, lo portamos tal cual; si es el que
nos diste en agosto, tu HC es la que quedó con el criterio viejo.

## 10 · Tienes dos clasificadores del índice cintura-cadera, con etiquetas distintas

Los mismos cortes (0,90 en hombre, 0,85 en mujer) y **distinta redacción**:

| Dónde | Debajo del corte | Encima |
| --- | --- | --- |
| `dICC` | "Normal" | "Riesgo cardiovascular" |
| `clasifICC` | "Riesgo bajo" | "Riesgo alto — distribución central" |

Es la **misma forma** del problema que arreglaste en los nueve sectores: dos sitios de tu archivo nombrando
lo mismo de dos maneras. **En Atlas no tiene consecuencia visible:** portamos solo `dICC`, byte a byte, y
el índice se pinta en un único sitio.

**¿Cuál manda?** La segunda dice más (*"distribución central"* explica **por qué** es riesgo), así que
puede que la nuestra se quede corta.

## 11 · `clasifLancet` está declarado en tu archivo y nadie lo llama, ni tú

Es un clasificador de cuatro niveles que cruza IMC con masa grasa y masa magra, rotulado *"Propuesta The
Lancet 2025"*. Está completo, con sus etiquetas y sus colores. **Y en tu archivo aparece una sola vez: la
declaración.**

Es la misma situación de las tres piezas que declaraste muertas en septiembre (*"quedan marcadas para
borrarse, no para conectarse"*), **con una diferencia: esta nunca la has mencionado.**

**No lo portamos**, y no por pereza: conectar una pieza que tu propio archivo no conecta sería estrenar una
clasificación clínica por nuestra cuenta. **¿Es un resto, o algo que piensas usar?**

## 12 · La fórmula sintética: tus doce campos están todos, pero la disposición es otra

Los cotejamos uno por uno: **los doce campos de tu fórmula sintética están en Atlas, ninguna cifra
cambia.** Lo que cambia es la forma:

- **Tú** los presentas como **lista plana**, todos al mismo nivel.
- **Nosotros** como **una cuenta**: GEB × PAL = GET, menos el déficit, igual al objetivo, y de ahí el
  reparto de macros.

**Que revises las dos disposiciones y digas cuál quieres.** La tuya se lee de un vistazo; la nuestra
enseña de dónde sale cada número, que es lo que el nutricionista necesita cuando ajusta uno.

## 13 · El estado PBI: tu HC lo imprime y nosotros lo retiramos

La cabecera de tu tabla de la historia clínica imprime, junto al fenotipo MCCB, una segunda línea:
**"PBI: Riesgo celular"**.

**Atlas no lo calcula ni lo muestra**, y hay dos razones independientes:

1. Cuando reconciliamos la taxonomía con tu prototipo, la real (81 estados EFR / 9 estructural / 9 sectores
   FyR / DFI de 5 dominios) tomó autoridad sobre `F1-F12 / PBI / EIEC`, que son de una **versión anterior
   del modelo**.
2. Y al medirlo: tu `estadoPBI` es AF × IR y usa **un tercer umbral de ángulo de fase** (6,80 / 6,30) que
   **contradice el `cAF` (6,5)** que Atlas ya muestra en la misma pantalla. Portarlo pondría dos cortes del
   mismo ángulo de fase a la vista al mismo tiempo.

**Si el PBI vuelve a ser parte del modelo vigente, la pregunta previa es cuál de los dos umbrales de AF
manda**, porque no pueden convivir.

## 14 · ¿Qué MÁS debería alimentar al generador de menús?

Buscando otra cosa encontramos **cuatro** insumos que el menú debería considerar y no consideraba: las
restricciones del modelo, las alergias e intolerancias, el contexto de acceso e inseguridad alimentaria,
y la distribución por tiempos. **Los cuatro ya están cableados.**

**Que aparecieran cuatro buscando otra cosa sugiere que hay más**, y eso no lo podemos decidir nosotros:
qué entra al prompt es criterio clínico.

**Lo que HOY viaja al modelo:** objetivo calórico, proteína objetivo, restricciones del modelo y del
profesional, patrón alimentario declarado, fenotipo estructural, sector funcional y rutas activas.
**Nunca viajan datos de identificación.**

**¿Qué falta de esa lista?**

---

## 15 · Tu clasificador del IAE pinta "Concordante" en ámbar, y lo bueno está en el medio

**Lo preguntaste tú**, en el punto 14 de tu revisión: *"si es concordante, ¿no debería estar en verde?"*

**Sí, y el ámbar sale de tu archivo, no de nuestra interpretación.** Tu `cIAE` es así:

| Valor | Etiqueta | Color |
| --- | --- | --- |
| < −5 | Desacelerado | `#10b981` verde |
| −5 a +5 | **Concordante** | `#f59e0b` **ámbar** |
| > +5 | Acelerado | `#ef4444` rojo |

Atlas no escribe severidades a mano: **lee el color que emite tu clasificador**. El ámbar entra como
"alerta" porque tú lo pusiste ahí.

**Por qué pasó, y es una trampa que no tiene nada de descuido:** el IAE es tu **único clasificador de dos
colas**. Lo bueno está en el CENTRO, no en un extremo. Sobre una rampa de tres pasos verde-ámbar-rojo, el
verde se lo llevó "Desacelerado" y al centro le tocó el color de en medio.

**No lo tocamos nosotros** (tu archivo manda en lo clínico). **Es una línea tuya.**

**Y de paso, la otra mitad de tu pregunta:** la fila IAE **sí** muestra 4,4 como su valor. Su Δ sale 0,0
porque **tú lo definiste así** el 1 de septiembre (§5): *"el IAE da la distancia al límite del rango que se
cruzó, y cero mientras esté dentro de −5 a +5"*. El **+4,4** que viste está en la fila **EB**, donde la
referencia es la edad cronológica y el Δ **es** el IAE. Las dos filas dicen lo mismo con números distintos.
**Si esa repetición confunde, dinos y la quitamos de una de las dos.**

## 16 · Y hay una casilla más de tu matriz IFC×IRC con el mismo problema de color

Barriendo tus quince clasificadores por lo del punto anterior, apareció esta. En `FYR_LABELS`, la casilla
**3_3** (IFC alto, IRC alto) se llama **"Función normal con riesgo"** y lleva el color `#22d3ee`, un cian.

**Nuestra regla lo lee como ÓPTIMO.** Es la peor casilla de esa fila con el color de la mejor.

**Hoy no tiene consecuencia en Atlas:** el motor se queda con la etiqueta y descarta ese color, así que
nada se pinta mal. Te lo decimos porque **en tu archivo sí es el color que se ve**, y es la misma forma que
el ámbar del IAE. Un barrido nuestro de agosto no lo encontró porque buscaba azules y el cian no es azul.

**¿Lo cambias, o el cian significa algo que no estamos leyendo?**

## 17 · Retiramos tus badges de "Nivel III · Salud celular" porque tu archivo las calcula y no las pinta

**Lo pediste tú**, en el punto 10 de tu revisión, y al ir a moverlas encontramos esto:

**Tu `celBadges` se llena y nunca se muestra.** En tu entrega del 4 de septiembre aparece cinco veces: la
declaración y los cuatro `push`. Ningún render la lee. Lo mismo `alimentBadges`. (Y no es que las badges
se pinten de otro modo: `condBadges`, en el mismo archivo, **sí** se pinta.) **Es la misma situación que el
`clasifLancet` del punto 11.**

**Nosotros la habíamos portado y sí la mostrábamos**, y ahí salió lo que a ti te chirrió: para el mismo
paciente, tu tabla de Wang decía *"Hidratación celular adecuada"* en tres filas y la badge decía
*"Hidratación celular deficiente"*. **No es un error de cálculo: son dos indicadores tuyos distintos con
nombres que chocan.** Las filas son el AIC como porcentaje (referencia 60-65%) y la badge es la hidratación
de la masa libre de grasa (referencia 73,2%), que además ya tiene **su propia fila** en la misma tabla.

**Está retirado.** Y esto **no toca tu instrucción del 23 de agosto** (*"salud celular va en Diagnóstico"*):
la hidratación, el ángulo de fase y la masa celular activa siguen en Diagnóstico, cada uno con su fila y su
clasificador. Lo que se fue era el duplicado.

**Lo que sí se pierde, y por eso te lo preguntamos:** el **ECM/BCM > 1,4** era el único de las cuatro
badges **sin fila propia** en la tabla, así que ya no se ve en ninguna parte. Tu archivo tampoco lo muestra.

**¿El ECM/BCM debe verse? Si sí, ¿con qué corte y en qué fila?**

# Y APARTE · Lo que decidimos nosotros y solo te declaramos

**No pide nada.** Son las divergencias que tomamos por nuestra cuenta para no dejarte preguntas abiertas
que frenaran el cotejo. Cada una lleva su razón y **su puerta de salida: si prefieres otra cosa, se
cambia.**

## Del INSTRUMENTO, que es tuyo y por eso va primero

**La pregunta de amputación se queda, y tú no la nombraste.** En el punto 3 nos dijiste que quitáramos las
preguntas que no habías puesto, y nombraste dos: el edema/anasarca y el estado febril. **Las dos están
fuera.** Pero entraron en el mismo lote de tres, y la tercera es *"¿Tiene amputación de algún segmento
corporal?"*, que tampoco está en tu archivo. **La dejamos, porque retirarla sin que la señales sería tratar
tu silencio como una instrucción.** Y hay una razón para separarla de las otras dos: el edema y la fiebre
son **transitorios** (la medición se repite otro día), y una amputación es **permanente**: lo que compromete
no es el estado del paciente, es la ecuación, que estima sobre un cuerpo completo. **¿La retiramos también?**

| Qué hicimos | Por qué | Revertir cuesta |
| --- | --- | --- |
| La **P43 (alergias)** dice **"Otra"**; tu archivo dice "Otras" | Las opciones de esa pregunta son alimentos en singular, las otras ocho preguntas ya dicen "Otra", y en la base hay cinco respuestas *"Otra: ..."* con su texto libre | Un bump de encuesta. **No es gratis** |
| La **P29 (estrés)** añade **"(1 = sin estrés, 10 = máximo)"** | Una escala de 1 a 10 sin sus extremos no se puede responder bien, y ese valor alimenta el motor. No cambia lo que se pregunta, solo cómo se entiende la escala | Un bump de encuesta |
| La **lista de intercambio imprime la medida** además de los gramos | Es la **(a)** de las tres salidas que planteaste para las doce medias porciones de Leguminosas, y la única que **no pierde información**: agrupar por nombre esconde que son dos tamaños, y retirarlas le quita al nutricionista media escala de reparto. El dato ya estaba en tu tabla | **Una línea** |

## De la PRESENTACIÓN, que es nuestra, pero conviene que la sepas

| Qué hicimos |
| --- |
| El administrador no ve las cuatro pestañas de tratamiento por profesión |
| El diagnóstico de encuesta usa colapsables, no sub-pestañas |
| El patrón alimentario no muestra el puntaje ni el nivel |
| El radar usa cuatro colores con ancla azul, no tu paleta |
| El diagnóstico abre en Funcional, con franja de veredicto persistente |
| La tabla de composición junta lo bioeléctrico crudo en un bloque |
| La tabla conserva GEB y GET, que tu HTML no lista |

## Donde Atlas va POR DELANTE de tu archivo

| Qué hicimos | Por qué |
| --- | --- |
| Señalamos cuando un **grupo nuclear queda en 0 porciones** | Tu HTML lo muestra en 0 sin avisar |
| **No pisamos** la lista guardada al cambiar el objetivo: avisamos | En tu HTML las porciones viven en el navegador y pisarlas es inofensivo; **nosotros las persistimos**, así que copiarlo borraría el trabajo del profesional en silencio |
| La cadena calórica **cuadra macros**, distingue calculado de ajustado, avisa el borde y lleva candado de concurrencia | Cuatro cosas que tu HTML no hace y que no tocan la ciencia del reparto |
| La distribución por tiempos **exige al menos un tiempo activo** | Tu HTML permite dejarlos todos apagados, y eso reparte cero |

---

## Lo que ya está cerrado contigo y no vuelve a aparecer aquí

Para que no lo busques: **el interruptor del LE8** (encendido, el ICEC coincide con tu archivo), **los tres
colores de los clasificadores**, **las opciones de ejercicio**, **las cuatro erratas de la tabla de
intercambio**, **los seis rótulos de los sectores**, **Tumaco y Cartago**, **el núcleo de 66 alimentos**,
**la caída campo por campo de `getDX`** y **la referencia del IFC** (revisada: ya nos habías dicho que
corrigiéramos tus alertas cuando estuvieran desactualizadas, así que se corrigió y no se pregunta).
