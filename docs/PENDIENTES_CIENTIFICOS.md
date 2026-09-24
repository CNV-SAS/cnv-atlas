# Lo que queda abierto contigo, Gildardo

> **AQUÍ SOLO VA LO QUE DECIDE ÉL** (Santiago, 2026-09-24). Fórmulas, umbrales, clasificaciones, redacción
> de lo clínico, contenido de la encuesta y de las rutas. Lo de PRODUCTO (una pantalla que falta, un botón
> sin superficie, una redacción de interfaz) va a `BACKLOG.md`, aunque toque algo clínico: mezclarlas hace
> que esta cola deje de ser una lista de decisiones suyas y se vuelva un inventario de trabajo nuestro, y
> entonces nadie sabe qué está esperando a quién. Ya pasó una vez y se corrigió el mismo día.

> **ANTES DE PLANEAR SOBRE ESTE DOCUMENTO, lee `docs/BARRIDO_CIENTIFICO_2026-09-18.md`.** Ese barrido verifico contra el CODIGO lo que aqui se daba por pendiente, y varias cosas ya estaban hechas: el gate de "Otra" vacia, las nueve preguntas con "Otra", el borrador de la encuesta, el envio de la HC al paciente, P-109, los cuatro bloques de Seguimiento, el cierre de la consulta y el prompt de IA por los cinco dominios. Planear sobre una lista que envejecio fue justo el error que ese barrido corrigio.

**Connected Nutrition Ventures · Atlas · 2026-09-06, actualizado el 2026-09-07** con lo que salió de tu revisión de Atlas.

> **BARRIDO CONTRA EL ATLAS_v9 Y CONTRA TODAS TUS RESPUESTAS (2026-09-21).** Se buscó cada pregunta en tus
> respuestas inline de este documento, en los `RESPUESTA_GILDARDO_*` posteriores a cada una y en el v9. **El
> v9 no responde ninguna por sí mismo:** el diff contra la entrega del 4 contiene exactamente los cuatro
> cambios de tu guía (y un comentario sobre la avena), así que todo lo que tu archivo hacía el 4 lo sigue
> haciendo igual. Lo que cambió de estado lo cambiaron tus respuestas escritas.
>
> | # | Estado | Dónde |
> |---|---|---|
> | Primero (el ejemplo con nombre) | **SIGUE ABIERTA a medias** | Respondiste que no se envíe el nombre (inline) y así está en Atlas. La pregunta de fondo, **si es una persona real**, no tiene respuesta, y **el ejemplo sigue en el v9** |
> | 1 · Apertura del párrafo de IA | RESPONDIDA | Inline, 2026-09-07 |
> | 2 · Criterio en la HC | RESPONDIDA | Inline: "de momento no" |
> | 3 · Fila PABU | RESPONDIDA | Inline, 2026-09-07: *"está bien como lo tienen"*. **El barrido de rótulos del 9-sep la había reabierto sin tu instrucción; restituida el 21** |
> | 4 · Tres entradas en Leche semidescremada | RESPONDIDA | RESPUESTA 09-05, cierre del §8: *"Queda señalado, sin tocar"*. Se quedan como están |
> | 5 · Revisión ortográfica de los 350 | RESPONDIDA | RESPUESTA 09-05 §8: hecha, dieciséis nombres. Portada |
> | 6 · P23 y P44 | RESPONDIDA | Inline: *"No importa. Ya lo tienen bien en Atlas"* |
> | 7 · Los dos guiones | RESPONDIDA | No pedía respuesta; inline: *"ANI-BIS-E es correcto"* |
> | Aviso del LE8 | RESPONDIDA | Inline |
> | 8 · ICA-BIS, dos reglas | SIGUE ABIERTA | |
> | 9 · % de grasa, dos cortes | SIGUE ABIERTA | |
> | 10 · Dos clasificadores del ICC | SIGUE ABIERTA | |
> | 11 · `clasifLancet` | SIGUE ABIERTA | |
> | 12 · Fórmula sintética | SIGUE ABIERTA | |
> | 13 · Estado PBI | SIGUE ABIERTA | |
> | 14 · Qué más alimenta el menú | SIGUE ABIERTA | Acceso y distribución por tiempos. **Las alergias no están en la pregunta**, porque ya las respondiste (27-ago §10 y 11-sep §1) |
> | 15 · IAE "Concordante" en ámbar | SIGUE ABIERTA | |
> | 16 · Casilla de la matriz IFC×IRC | SIGUE ABIERTA | Tu §1 del 09-05 cambió los rótulos de los nueve sectores, no los colores |
> | 17 · Badges del Nivel III | SIGUE ABIERTA | |
> | 18 · "Otros medicamentos" en el prompt | SIGUE ABIERTA | |
> | 19 · Pasos 1 a 3 que no llegan al 4 | SIGUE ABIERTA | |
> | 20 · Observaciones en la HC | SIGUE ABIERTA | |
> | 21 · Diez alertas que leen `cons` | SIGUE ABIERTA | Tu §4 del 09-05 dice DÓNDE van las alertas, no qué hacer con las diez que no pueden salir. Los colores del v9 tampoco la cierran |
> | 22 · El PABU con dos veredictos | **YA NO APLICA** | Preguntaba lo que ya respondía la 3. Con la tabla restituida, la tabla y la HC dicen lo mismo |
> | Nueva 09-19 · Las rutas y el paciente | SIGUE ABIERTA | |
> | Nueva 09-21 · La banda media con tres nombres | ABIERTA (de hoy) | |


Este es **el documento único**: todo lo que quedó abierto de tu lado después del cotejo visual completo de
Atlas contra tu HTML. Antes estaba repartido en dos sitios y eso hacía que algo se quedara sin llegarte;
ahora es uno solo.

**Está ordenado por lo que te cuesta responder:**

| | Qué es | Cuántas |
| --- | --- | --- |
| **Primero** | Un aviso de **datos personales** que no podíamos guardarnos | 1 |
| **Después** | Lo que se responde **en una línea**, sin abrir tu archivo | 7 |
| **Al final** | Lo que necesita que **mires tu archivo** | 15 |
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

**Y ahora tiene una consecuencia que antes no tenía, y por eso vuelve a aparecer:** al portar tu prompt de
diagnóstico (tu punto 8) vimos que **tu propio bloque de datos crudos manda el estado PBI al modelo**
(`Estado PBI: ${motor.estadoPBI?.nombre}`). Nosotros no lo calculamos, así que **esa línea no la podemos
enviar**. Es el único dato de tu prompt que nos falta por decisión declarada, no por descuido. Si el PBI
vuelve, vuelve también ahí.

## 14 · ¿Qué MÁS debería alimentar al generador de menús?

**Esta pregunta estaba mal escrita y la corregimos el 11 de septiembre.** Decía que cuatro insumos "ya
están cableados", y nombraba entre ellos **las alergias e intolerancias**. No lo están, y no deben
estarlo: ese cruce lo retiraste el 27 de agosto y lo ejecutamos el 28. El párrafo era anterior a tu
instrucción y sobrevivió a la limpieza. Lo decimos aquí porque es el mismo defecto que nos señalaste con
la tabla de alérgenos, encontrado al barrer por él.

**Lo que HOY viaja de verdad al modelo**, verificado línea por línea en el prompt:

| Viaja | No viaja |
| --- | --- |
| Objetivo calórico y proteína objetivo | **Alergias e intolerancias** (retiradas el 28-ago) |
| Restricciones del modelo, con su referencia | Contexto de acceso e inseguridad alimentaria |
| Restricciones del profesional | Distribución por tiempos de comida |
| Patrón alimentario declarado (tu 3.2 del 26-ago) | **Datos de identificación**, nunca |
| Fenotipo estructural, sector funcional, rutas activas | |

**Y la pregunta que queda, ya sin el error:** de lo de la derecha, ¿algo debería entrar? **El acceso y la
distribución por tiempos son los dos candidatos**, y ninguno es un cruce de seguridad: el primero cambia
qué alimentos son realistas, el segundo cómo se reparte el día. **Las alergias no están en la pregunta**,
porque eso ya lo respondiste.

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

## 18 · Tu prompt manda el texto libre de "otros medicamentos" y el nuestro no tiene ese campo

Al portar tu prompt (punto 8) cotejamos **campo por campo** los 58 de encuesta que envías. **Los tenemos
todos menos uno**, y la diferencia es de forma nuestra, no tuya:

- **Tú** mandas `d5_40_otro`: el texto libre de la opción "Otros" de medicamentos, aparte de la pregunta.
- **Nosotros** guardamos `d5_40` como una sola pregunta de opción múltiple con "Otros" entre las opciones,
  y el texto libre viaja **dentro** de la respuesta, no en un campo aparte.

**No es que falte el dato:** es que en Atlas vive en otro sitio. Lo enviaremos igual, dentro de la lista de
medicamentos, y así el modelo lee lo mismo que en el tuyo. **Te lo decimos por si prefieres que vaya como
línea propia**, que también se puede.

## 19 · Tus pasos 1 a 3 del Análisis IA no llegan al paso 4

**Esto probablemente no lo sabes, y por eso te lo decimos antes de portar nada.**

Tu Análisis IA hace **cuatro** llamadas al modelo: patrones, hipótesis causal, validación y síntesis. Al
trazarlas para portarlas encontramos que la cadena **se corta**:

| paso | qué produce | quién lo lee |
| --- | --- | --- |
| 1 · patrones | JSON | los pasos 2 y 3 |
| 2 · hipótesis causal | JSON | el paso 3 |
| 3 · validación | JSON | **nadie** |
| 4 · síntesis (el texto que sale) | el diagnóstico | es lo que se muestra |

**Y el paso 4 no recibe ninguno de los tres.** Su mensaje lleva sólo tus instrucciones, el bloque DFI y los
datos crudos del paciente. Los patrones, la hipótesis y la validación **se calculan y se descartan**: son
tres llamadas al modelo cuyo resultado no llega a ninguna parte.

**Qué hacemos, y por qué:** portamos **el paso 4**, que es donde viven la estructura de los cinco dominios
y los datos. Portar los otros tres sería copiar el corte y pagarlo tres veces en coste y en espera.

**Si los tres primeros debían alimentar al cuarto, dínoslo y lo cableamos.** Es tu diseño y puede que la
intención fuera que la validación entrara en la síntesis; hoy no entra.

## 20 · En la historia clínica, ¿van TODAS las observaciones o solo la vigente?

**Contexto, en dos líneas.** Tú pediste que las observaciones del profesional aparezcan en la historia
clínica y **por consulta** (§8.3, 26 de agosto), y que cada profesión escriba la suya sin pisar la de otra
(§8, 30 de agosto). Las dos cosas están hechas: se guardan sin poder borrarse ni editarse, agrupadas por
profesión, y salen en la historia.

**Lo que apareció al usarlas:** un profesional que se corrige escribe una segunda observación, y como no
se puede borrar la primera, **quedan las dos**.

**Lo que hicimos:** en la PANTALLA la última se marca como *vigente* y las anteriores quedan plegadas, para
que el profesional sepa cuál manda. **En el DOCUMENTO salen todas**, con la última marcada como vigente.

**Por qué todas en el documento, y aquí es donde queremos tu criterio:** la historia clínica es un
documento probatorio, y el hecho de que las observaciones no se puedan borrar existe precisamente para que
no se pierda lo que se escribió. Si el documento mostrara solo la última, escondería que hubo una
corrección, que es justo lo que alguien querría ver en una auditoría.

**La objeción, dicha por nosotros mismos:** una corrección de una palabra deja dos párrafos casi iguales en
la historia del paciente.

**¿Van todas, o solo la vigente?** Tu archivo no lo resuelve: tu campo de observaciones guarda una sola
(cada control sobrescribe la anterior) y no se muestra en ningún documento.

## 21 · Diez de tus quince alertas clínicas no pueden salir nunca, y es consecuencia de dos respuestas tuyas

**AÑADIDO EL 2026-09-10**, después de que empezaras a responder este documento. Si ya habías pasado por
aquí, este punto no lo has visto.

Tu `generarAlertas` tiene **quince reglas**. En Atlas corren **cinco**:

| Alerta | Nivel | Dominio |
| --- | --- | --- |
| TCA activo detectado | crítico | D2 |
| Riesgo glucémico crítico | crítico | D1+D5 |
| Deshidratación probable | alto | D1+D7 |
| Estrés alto + azúcares elevados | moderado | D3+D1 |
| Hidratación adecuada | positivo | D1+D7 |

**Las otras diez leen `cons`**, el consumo de nutrientes por porciones al día (sodio, kcal, fibra, hierro,
calcio, proteína, omega-3). Y ese dato **no lo captura ninguna encuesta**, ni la tuya ni la nuestra: los
campos `d1_1`..`d1_18` que `calcConsumo` lee viven solo en tu objeto demo.

**Y aquí está lo que te queremos decir, que no es una pregunta nueva sino una consecuencia de dos que ya
respondiste:**

- **2026-08-30:** *"Ninguno es la traducción de otro"*. La frecuencia de consumo, la tabla de composición y
  la lista de intercambio son tres instrumentos distintos, y la frecuencia no se convierte en porciones
  **porque es un patrón, no una cuantificación**.
- **2026-09-03:** sobre dónde se capturan las porciones por grupo, *"No va, y no es que falte: **es que no
  debe existir**"*.

Las dos respuestas son claras y las aplicamos. **Lo que quizá no estaba a la vista al responderlas es que
entre las dos dejan diez de tus propias alertas sin insumo posible.** No es que falte desarrollo nuestro:
hoy no hay vía.

**Mientras tanto, Atlas lo dice en pantalla**, debajo de las alertas: *"De las quince alertas del modelo,
10 necesitan el consumo de nutrientes en porciones, que la encuesta no captura. La ausencia de avisos no
equivale a ausencia de riesgo."* Sin esa línea, "ninguna alerta" se lee como "el paciente está bien" cuando
significa "de lo nutricional no estamos evaluando nada".

**Lo que te preguntamos es solo esto: ¿lo dejamos así?** Las tres salidas que vemos, y ninguna la tomamos
por nuestra cuenta:

1. **Se queda como está**, con el aviso permanente. Es lo que hay hoy.
2. **Las diez se retiran** del modelo, y entonces el aviso desaparece porque las alertas del modelo pasan a
   ser cinco.
3. **La encuesta captura porciones** (un instrumento nuevo, tuyo), y las diez se encienden.

Nosotros no podemos elegir: la opción 2 borra reglas tuyas y la 3 toca el instrumento, que está congelado y
es tuyo.

---

## 22 · El PABU sale con dos veredictos distintos según dónde se lea, y los dos son tuyos

> **YA NO APLICA (2026-09-21).** Preguntaba lo que ya estaba respondido en la 3 (*"está bien como lo tienen"*, 2026-09-07). La tabla se había pasado a `dPABU` en un barrido nuestro del 9-sep sin tu instrucción; se restituyó a `cPABU`, y la tabla y la historia clínica vuelven a decir lo mismo.

**AÑADIDO EL 2026-09-10**, después de que empezaras a responder este documento.

Un profesional vio esto en el mismo paciente, en la misma consulta:

| Dónde | Qué dice | Con qué función |
| --- | --- | --- |
| Historia clínica | *Desviación por exceso* | `cPABU` (L15473 de tu archivo) |
| Tabla de índices del diagnóstico | *PABU bajo* | `dPABU` (L14622) |

**Atlas es fiel a las dos**: cada superficie usa la función que tú usas en esa superficie. Lo mismo pasa
con el ICA-BIS, donde tu HC toma la clasificación del PABU y lo dejaste anotado (*"cICABIS eliminado, usar
cPABU global"*).

**Y las dos son coherentes por separado.** `cPABU` nombra el **mecanismo** (por debajo de φ hay exceso de
adiposidad, por encima déficit estructural, que es lo que dice tu propio prompt); `dPABU` nombra la
**dirección del número** (bajo o elevado respecto de φ).

**El problema no es cuál está bien: es que el profesional no tiene cómo saber que son el mismo hallazgo
dicho de dos maneras.** Lee "PABU bajo" en la pantalla de trabajo y "Desviación por exceso" en el
documento que firma y archiva, y las dos palabras se contradicen en la lectura corriente ("bajo" contra
"exceso"), aunque no en el modelo.

**No lo unificamos por nuestra cuenta:** son dos clasificadores clínicos tuyos y elegir cuál manda es
contenido clínico. **¿Qué prefieres?**

1. **Se quedan las dos**, como están hoy, y nosotros añadimos una línea que explique la equivalencia donde
   convivan.
2. **Manda `cPABU`** (el mecanismo) en las dos superficies.
3. **Manda `dPABU`** (la dirección) en las dos superficies.

Y si eliges 2 o 3, dinos también qué pasa con el ICA-BIS, que hoy hereda la clasificación del PABU solo en
la historia clínica.

---

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

| La tabla de la historia clínica muestra **más índices que la tuya** | Tu HC lista **veinte** índices concretos (doce de composición y los ocho ANI-BIS-E). La nuestra parte de las ~30 filas de la tabla de Wang y les aplica **tu** regla de filtrado (mostrar lo alterado, ocultar lo normal y lo sin clasificar), así que puede salir un índice alterado que la tuya no lista. **El filtro es tuyo; el inventario de filas es nuestro.** No lo recortamos a tus veinte porque son datos medidos con tu clasificador, y quitarlos de un documento clínico sería esconder algo que el profesional midió. **Solo te lo declaramos; si prefieres las veinte exactas, se acota** |

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

**Y desde el 11 de septiembre, con su fecha y su número para que no vuelva: las ALERGIAS.** Lo decidiste
el 27 de agosto, lo ejecutamos el 28, y aun así te llegó una tercera vez. Queda escrito así:

| Qué | Desde | Estado en Atlas |
| --- | --- | --- |
| Tablas de alérgenos, equivalencias y filtros | 27-ago, §10 | Retiradas. Las cinco equivalencias borradas de la base el 11-sep (`0126`) |
| «Avena implica gluten» | 11-sep, §2.1 | **No hay regla.** Ni directa ni con certificación |
| Leche contra lactosa | 11-sep, §2.2 | Dos preguntas del paciente. No se cruzan con productos |
| P43 y P44 | 11-sep, §2.3 | **Quedan como están** |
| «Otra» con texto | 11-sep, §3 | Es un dato dado. Se muestra; **no va confirmación** |
| LUVIA | 11-sep, §4 | **Habilitada**, con el alérgeno que declara su ficha |
| Bloqueo activo con confirmación y registro | 27-ago / 11-sep | **No se construye** |

**Y la referencia a la opinión del asesor legal: la buscamos como pediste, dijimos que no existía, y nos
equivocamos.** Sí existe. La escribió en una consulta sobre responsabilidad en la venta de producto de
tercero, que no habíamos indexado con las consultas legales porque el índice solo cubría las de datos.
**Nuestra verificación falló; no es que el documento mintiera.** Ya está indexada, y el índice cambió de
regla para que no vuelva a pasar.

**Lo que sí era un error nuestro, y es el que te tocó a ti:** la nota se escribió como *pendiente de
Gildardo*, y no lo era. Era un conflicto entre tu instrucción y un dictamen legal, o sea una decisión de
CNV. Escrita como pendiente tuyo, viajó sola hasta tu bandeja tres veces.

**Cómo cerró, y te lo contamos porque el resultado es el tuyo.** El asesor rectificó su propia
recomendación: advirtió que su principio confundía **usar** el dato con **bloquear** con el dato, y que un
Atlas que bloquea sobre una inferencia clínica contradice el consentimiento que los pacientes ya
firmaron, donde dice que Atlas no diagnostica y el profesional interpreta. **Sin bloqueo, sin confirmación
y sin registro**, como dijiste tú. Lo que sí se construye es poner las dos declaraciones **juntas en
pantalla** (lo que el paciente declaró, textual, y la lista completa de lo que el producto declara), sin
clasificar ninguna ni deducir nada entre ellas. **No es un cruce: es mostrar dos hechos, que es lo que tu
punto 1 ya mandaba.** Si lo lees de otra manera, dilo y se retira.

---

## Nueva (2026-09-19) · Las rutas están escritas para el profesional, y ahora las lee el paciente

**Qué cambió de nuestro lado.** El documento que recibe el paciente pasó a ser un **informe completo**
(diagnóstico en lenguaje llano, plan, rutas, suplementos, remisiones y seguimiento), por decisión de
Santiago. Hasta ahora las rutas solo las veía el profesional en pantalla.

**El problema, con un ejemplo de tu propio contenido.** En la ruta R1 conviven estas dos indicaciones:

> «Omega-3 dietario: ≥2 porciones pescado graso/semana» — la entiende cualquier paciente y puede actuar.
>
> «Valoración médica si IRC > 5.0 — descartar patología inflamatoria subyacente» — es para el profesional,
> y además nombra un índice del modelo, que tu instrucción §7.1 prohíbe expresamente mandarle al paciente.

**Qué hicimos mientras tanto, y por qué no más.** Filtramos: al informe del paciente viajan las
indicaciones de **alimentación, actividad física y manejo del estrés** que no nombran ningún índice, y el
componente **médico** no viaja como texto sino como **remisión** («a quién acudir y con qué urgencia»), que
es lo accionable para él. **No reescribimos ninguna línea tuya:** suprimir es representar menos; reescribir
sería atribuirnos un cambio en tu contenido clínico, y eso no nos toca.

**La pregunta es la que manda la Regla 0: ¿por qué no está?** No existe en tu archivo una versión de las
rutas escrita para el paciente. Puede ser deliberado (las rutas son del profesional y al paciente le basta
el plan) o puede ser un hueco.

**Lo que necesitamos de ti, una de dos:**

1. **Que las rutas no vayan al paciente**, y entonces el informe lleva solo plan, suplementos, remisiones y
   seguimiento. Se retira el bloque y no queda nada a medias.
2. **Tu redacción de las rutas para el paciente**, y la ponemos verbatim, como todo lo demás.

Mientras decides, el filtro se queda: es lo único que respeta tu §7.1 sin inventar texto tuyo.


---

## Nueva (2026-09-21) · Tu banda media del IFC y del IRC tiene tres nombres, y uno dice «normal»

**Qué pasó.** Una integrante vio, en la misma paciente (mujer, IFC 2,11, IRC 2,79), que el diagnóstico y
el SOAP se contradecían: la tabla decía «Disfunción celular establecida» y el párrafo del análisis decía
«presenta una función celular en rango normal con riesgo celular en rango normal».

**Lo que era NUESTRO, y ya está corregido.** La tabla estaba mal. Su rótulo del IFC reclasificaba con
**3,5/6,0**, los cortes históricos únicos que tu prompt prohíbe expresamente («desplazaban
sistemáticamente la lectura de las mujeres»). Con tu `cIFC` (2,08/3,28 en mujeres), 2,11 es la banda
**media**, y el color de la fila ya lo decía (ámbar). Ahora la tabla dice «Alerta funcional», que es lo
que dice tu clasificador sellado. Conservamos tu palabra «establecida» para el escalón malo; lo que cambió
es quién decide el escalón.

**Lo que es TUYO, y por eso te lo preguntamos.** Aun corregida la tabla, queda una contradicción de
PALABRAS, no de banda. Tu archivo llama a la banda media de tres maneras:

| Dónde | IFC 2,11 (mujer) | IRC 2,79 (mujer) |
|---|---|---|
| Tus clasificadores `cIFC` / `cIRC` (tabla, índices alterados de la HC, IA) | Alerta funcional | Riesgo moderado |
| Tu `idx` interno del DFI (el que alimenta el párrafo) | Normal | Normal |
| Tu párrafo `_seg1` del DFI (HC y análisis del SOAP) | «en rango normal» | «en rango normal» |

Es la **misma banda** en los tres, así que no hay un error de clasificación. Pero un profesional que lee
«Riesgo moderado» en una línea y «riesgo celular en rango normal» dos párrafos más abajo entiende que el
sistema se contradice, y fue exactamente lo que pasó.

**Buscado antes de preguntarte, para no traerte algo ya decidido.** No hay respuesta tuya sobre esto en
ningún documento. Lo más cercano es tu §1 del 5 de septiembre, que para los nueve sectores cruza IFC
Alto/Normal/Bajo (*función normal · función · disfunción*) con IRC Bajo/Normal/Alto (*con bajo riesgo ·
sin riesgo · con riesgo*). O sea que en tu vocabulario más reciente la banda media del IRC se lee **"sin
riesgo"**, y tu `cIRC` la rotula **"Riesgo moderado"**. Es la misma tensión, y es tuya.

**La pregunta:** para la banda media, ¿qué debe decir tu párrafo? ¿«en rango normal», como hoy, o algo
alineado con tus clasificadores («en alerta funcional», «con riesgo celular moderado»)? El texto es tuyo y
se pone verbatim; no lo cambiamos por nuestra cuenta.

**Y una del mismo tema, más pequeña.** El criterio de egreso de tu ruta R1 dice *«IFC ≥ 4.5 y IRC < 3.5
sostenido 2 controles»*. Son cortes únicos, sin sexo. Para una mujer, tu corte superior del IFC es 3,28:
con ese criterio **no sale nunca** de la ruta, aunque su función celular sea óptima. ¿Es a propósito, o se
quedó con los cortes viejos?

---

## Nueva (2026-09-21) · Te declaramos una regla que le pusimos a tu prompt del resumen de IA

**No pide respuesta, salvo que no estés de acuerdo.** Tu estructura pide *"redactar clínicamente conectando
causas entre dominios"*, y eso se conserva tal cual. En la prueba con un paciente cargado de alertas, el
modelo usó esa instrucción para escribir cosas que ningún dato respalda: *"falta de nutrientes esenciales"*,
*"deterioro celular"*, *"exposición crónica a factores de riesgo"*.

**Le añadimos el límite:** cada causa y cada efecto que conecte tienen que estar en los datos que se le dan,
y tampoco puede introducirlos como hipótesis ("sugiere", "podría", "a largo plazo"). Es la misma familia
que la regla del laboratorio que ya te declaramos: *todo lo que escriba tiene que poder señalarse en los
datos*. Si prefieres otra redacción, se cambia en una línea.

**Y dos precisiones de lectura,** que son tuyas y el modelo no respetó: una PABU por debajo de φ se lee como
exceso de adiposidad (la describió como "sobrecarga estructural"), y las respuestas en rojo se mencionan
todas y solo esas.

**Añadido el mismo día (v7).** El cierre de tu estructura pide *"las rutas de atención y la prioridad de
intervención"*. En la segunda prueba, el modelo aprovechó el cierre para recomendar (*"reducción de la
exposición a alimentos ultraprocesados y a la sal"*). Le añadimos que nombre cada ruta con su prioridad y
nada más, sin conductas: es la misma frontera que tu prohibición de prescribir. Si prefieres que el cierre
diga algo más, se cambia en una línea.

**Añadido el mismo día (v8).** En la tercera prueba el modelo volvió a fallar la lista de alertas: dejó por
fuera la alerta crítica de TCA y metió respuestas que no estaban en rojo. Tras tres versiones del prompt,
ese párrafo ya no lo escribe el modelo: **lo compone Atlas** con la misma lista de alertas y respuestas en
rojo que alimenta el SOAP, y lo pone después de la presentación, que es donde lo pediste. El modelo sigue
escribiendo todo lo demás y sigue viendo las alertas para leer cada dominio. Además se le pide citar en cada
dominio los datos que lo sustentan (como hace tu análisis), y la dirección de la PABU respecto de φ le llega
ya resuelta, porque leyó el "+" de la desviación como "por encima".

**Añadido el 2026-09-22 (v9).** Dos precisiones más, en la misma familia. Tu estructura pide *conectar causas
entre dominios*, y eso sigue: lo que se le prohíbe es **anticipar consecuencias** ("susceptibilidad futura",
"si no se abordan"), porque eso no está en los datos de hoy. Y el cierre queda como el tuyo, **un párrafo**
que nombra las rutas con su prioridad (salía como una lista suelta), sin la parte de conductas.

**Añadido el 2026-09-22 (v10).** El cierre ya no lo escribe el modelo: en la cuarta prueba volvió a poner los
códigos de las rutas y una conducta ("para abordar las conductas de riesgo"). Lo compone Atlas con la misma
frase de rutas y prioridades con la que cierra tu resumen funcional (`_prW`: crítica, prioritaria,
complementaria), y, si hay veto, con tu instrucción del paso 4 (*"antepón el abordaje psicológico y excluye la
restricción calórica"*). Y al modelo le llegan hechas tres lecturas que confundía: la composición con la
clasificación de tu tabla (escribió que un IMC de 25,7 "roza el sobrepeso"), el ICEC con su escala (en LE8 más
alto es mejor, así que 33 es carga alta; lo leyó al revés) y la PABU con su dirección y su lectura, que son las
de tu `cPABU` (v9, L3971-3988): por debajo de φ, *"Desviación por exceso"*, que es exceso de adiposidad.

**Añadido el 2026-09-22 (v11).** Dos reglas más, y una pregunta.
- **Una alerta se nombra como alerta, no como diagnóstico.** Tu regla dice *"TCA activo detectado"*: es una
  bandera de la encuesta. El modelo escribió *"el paciente presenta un TCA activo"*, que ya es un diagnóstico
  que nadie hizo.
- **El IEHH gradúa la hidro-homeostasis** (tu `cIEHH`: Óptimo, Leve, Moderado, Severo), y así le llega. El
  modelo había escrito "Leve, lo que sugiere una leve deshidratación".
- **La pregunta, sin urgencia: ¿en qué dominio van los síntomas digestivos?** Tu DFI no los lee en ninguno de
  los cinco dominios (sus ítems no usan `d6_45` a `d6_51`), y tu paso 4 los manda en el bloque "D6 · Síntomas
  digestivos". El modelo los metió en el Epigenético-Contextual. Por ahora le pedimos que no los use como
  evidencia de ningún dominio: ya salen en el párrafo de respuestas en rojo. Si prefieres que se lean en
  alguno, dinos en cuál.

**Añadido el 2026-09-22 (v14).** Dos cambios de mecanismo, sin reglas nuevas.
- **Tu regla "si el IFC y el ángulo de fase discrepan, prevalece el IFC" ahora llega solo cuando discrepan.**
  Iba siempre en las instrucciones y el modelo la aplicaba siempre, también con un AF normal ("a pesar de la
  deshidratación, el IFC prevalece sobre el ángulo de fase"). Discrepan cuando tus clasificadores dan colores
  opuestos: IFC en verde ("Función óptima") con AF en rojo ("Bajo"), o IFC en rojo ("Disfunción celular") con
  AF en verde. El ámbar ("Alerta funcional") no discrepa con nada. Si prefieres otro criterio, dinos cuál.
- **Lo que el modelo seguía rompiendo lo corrige Atlas después de generar**: quita comillas y cadenas internas
  (como "k=0,78 (H)"), y si el texto trae una hipótesis o una recomendación ("sugiere", "posible", "podría",
  "requiere atención") lo genera otra vez. Si vuelve, lo guarda y le avisa al profesional.

## Nueva (2026-09-22) · Atlas toma el ICC y el ICT del equipo; tú los recalculas

**No pide respuesta urgente, pero conviene que la sepas.** Tu HTML **recalcula** los dos índices desde lo que
el profesional teclea: `ICC = cintura / cadera` y `ICT = cintura / talla` (v9, L7154-7155). Atlas, en cambio,
los **lee del export del Biody** (las columnas `Ratio Altura/Cadera` y `Ratio Cintura/Altura`, que calcula el
equipo). Mientras la cintura y la cadera se tecleen en el Biody antes de medir, los dos caminos coinciden; si
se teclean después, solo el tuyo se corrige.

**Lo que hicimos por ahora:** en las consultas que se importan del HTML se guarda **tu** valor, el que tu
archivo calculó, no el del equipo. Y el diagnóstico ahora exige cintura y cadera por cualquier camino.

**Lo que queda por decidir (es de Santiago, con tu criterio si quieres darlo):** si Atlas debe recalcularlos
como tú, para que teclear una cintura después arregle los dos índices. Verificamos que la cintura y la cadera
**no entran en ninguna otra fórmula del modelo**: ni en el ISCM (que sale de IFC, MCA, E/I, FMI y FFW), ni en
los índices bioeléctricos. Solo en el ICC, el ICT y, a través de ellos, en el predicado de la ruta R2.
