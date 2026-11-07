# Lo que queda abierto con usted, Gildardo

**Connected Nutrition Ventures · Atlas · 6 de noviembre de 2026** (las 31 del 4 de noviembre, más las cinco de la v15 y la v16, más la cadera mal tecleada del 6)
**De:** Santiago (equipo técnico de Atlas) · **Para:** Gildardo de Jesús Uribe Gil

> **Este documento no identifica a ningún paciente.** Donde hace falta señalar un caso va el id de
> evaluación abreviado a ocho caracteres, el mismo que usted usa en su anexo A.

**Es el único documento de dudas.** Hasta ayer eran dos (esta cola, del cotejo visual de septiembre, y las
*Dudas de EB-BIS v7 y ATLAS v12* del 30 de octubre); tener dos hacía que algo se quedara sin llegarle, y ya
había pasado antes. Al unirlos se quitó lo repetido y lo que usted ya respondió, y se verificó pregunta por
pregunta contra sus entregas de octubre (v10, v11, v12 y los parámetros 7.1.0): ninguna de las de septiembre
quedó contestada por ellas.

**Cómo leerlo.** Primero están **las preguntas**, todas, en dos o tres líneas cada una: qué se decide y qué
recomendamos. Si con eso puede contestar, no necesita el resto. Debajo está **el detalle** de cada una, con
el mismo número, para las que quiera mirar despacio.

**Nada de esto frena a Atlas**, salvo las cuatro de abajo (y una de ellas, la **37**, ya dejó a una
paciente real sin diagnóstico). Todo lo demás está construido y funcionando con
la decisión que tomamos en cada caso; lo que le preguntamos es si fue la que usted habría tomado. Lo
marcado **[aplicado]** ya está hecho: si su respuesta es otra, se cambia. Donde dice *"se cambia en una
línea"* es literal.

---

## Si solo responde cuatro, que sean estas

Son las que **frenan trabajo**: no se construyen sin su respuesta porque construirlas exige elegir por
usted.

| | Qué se decide | Qué se desbloquea |
|---|---|---|
| **37** | Si una cintura o una cadera mal tecleada se puede corregir en Atlas, o se repite la toma | **Hay una consulta de una paciente real sin diagnóstico por esto**, de hoy |
| **1** | Cuál Harris-Benedict manda (1919 o 1984) y sobre qué se aplica el 10 % | El motor calórico nuevo, y con él el flujo guiado del nutricionista |
| **2** | Los rangos del control de calidad biológico | El control de calidad entra (sus once identidades imposibles ya están) |
| **3** | Qué pasa con las consultas que el recálculo no puede tocar | Se cierra el recálculo del histórico con la v7 |

**Y la 4 salió de esta lista el 6 de noviembre, porque su v15 ya la contestó.** Era la más importante de
las cuatro y pedía decidir si el DFI y las rutas pasaban a leer el IAE de la v7. Su archivo dice que sí
(`computeDFIFromData` L11834 · `atlasMigrarEbV7` L4458 · dominio 3 L13965 · §1.4), así que **ya está
aplicado**: ver el anexo, al final. Lo que queda de la 4 es su segunda mitad, que no frena nada.
**Medido el 6 de noviembre, con la cifra al día: eran 60 de 389 informes frenados y hoy son 70 de 422.**

---

## Lo que sus dos entregas nuevas ya contestan (revisado el 5 de noviembre)

La v15 del 30 de octubre y la v16 del 2 de noviembre llegaron después de escribir esta lista, y las cotejamos
pregunta por pregunta. **Esto es lo que ya no necesita contestar, con la línea de su archivo que lo decide.**
Las preguntas siguen abajo con su número y su texto, para que pueda corregirnos si leímos mal.

| # | Qué contesta su entrega | Dónde |
|---|---|---|
| **4** | **Su primera mitad, y era la más importante: el DFI y las rutas leen el IAE de la v7.** En v15 hay un solo IAE por consulta, el de la v7, y el dominio 3 lee ese mismo. Es nuestra salida 1 | `computeDFIFromData` L11834 · `atlasMigrarEbV7` L4458 · dominio 3 L13965 · §1.4 |
| **3** | **Contestada entera**, y en la dirección que recomendábamos: *"Si una consulta no tiene los datos crudos, queda «pendiente»: nunca se muestra el v5"* | §1.4 de su documento de v15 |
| **31** | **Su primera mitad:** menor de 18 o edad no válida devuelve "pendiente" y no se calcula. Queda la segunda: si CNV atiende pediatría, con qué ecuaciones | Error 7 de su especificación · rango 18 a 100 |
| **5** | Vale como confirmación: su tabla 3 usa "edad biológica estimada" y v15 la mantiene | Tabla 3 |
| **12** | **A medias:** la quiere obligatoria y no dice nada de la salida registrada. Y el dato refuerza la salida: hoy la traen **92 de 492** consultas (18,7 %) | Error 8 |
| **7** | **No se cierra, se mueve:** `cIAE` pasó a cortes cerrados, pero el Δ de al lado sigue abierto. **Pasa a ser la 36** | L4487 contra L15628 |
| **15** | **Cambia de forma:** su `dIAE` nuevo ya pinta la banda central en azul, y el `cIAE` sigue en ámbar. **Pasa a ser la 35** | L15443 contra L4487 |
| **2** | **Aporta un ejemplo del criterio, no los rangos:** PSSG/peso fuera de 0,05 a 0,40 devuelve "revisar", con su fuente. Los nueve rangos del cinturón siguen sin fuente, y entre tanto frenaron **una medición más**: un ángulo de fase de 0,6°, el 19 de octubre, dos veces | §1.2 |
| **6** | **No la contesta, y su regla queda reafirmada sin decirlo:** la línea 15628 sigue imprimiendo "0,0" dentro de la banda. Nuestra raya sigue siendo preferencia nuestra contra su regla escrita | L15628 |
| **24** | **La confirma por el otro lado:** el Módulo S de la CNV-S no captura porciones, así que las diez alertas siguen sin poder salir | §2.3 |
| **28** | **No la contesta, y ahora se ve más:** v15 añade el filtro digestivo y la regla de salto, y sigue sin decir en qué dominio se leen esos síntomas | §7.2 |

Las otras 20 siguen esperándolo. **Y dos cosas que le decimos, no se las preguntamos:** la §6 de su v16 pide
separar carnes rojas de embutidos y migrar el instrumento, y **en Atlas ya están los 15 grupos con sus
textos, en las cinco versiones publicadas de la encuesta** (633 de 634 encuestas traen el grupo 15); y su §7
acierta de pleno: el componente Alimentación del ICEC **vale 30 para todos**, porque la fórmula lee dos
claves que la encuesta no guarda, y eso ya estaba anotado de nuestro lado desde el 28 de julio.

---

## Las 37 preguntas

> **Puede responder por número en un solo mensaje** (por ejemplo: *"4: opción 1 · 9: sí, el degradado hacia
> rojo"*). Si está de acuerdo con nuestra recomendación, basta con **"de acuerdo"**.

> **0 · Un aviso, antes de las preguntas.** El ejemplo de formato de su prompt de IA lleva **el nombre de
> una persona y su edad**, y viaja al proveedor del modelo en cada llamada. En Atlas no se envía (usted ya
> nos dijo que no fuera). Lo que falta es saber **si es una persona real**; si lo es, hay un dato personal
> suyo saliendo de su archivo cada vez que alguien lo usa. *Recomendamos reemplazarlo por `[NOMBRE]` en su
> copia: es un cambio de una palabra.*

### A · Las que frenan trabajo

**37 · Una cadera mal tecleada: ¿se repite la toma, o Atlas deja corregirla?** Una profesional escribió
**1020** en la cadera (un dedo de más en el teclado), Atlas frenó la importación, y no hay forma de
corregir ese número sin volver a tomar la bioimpedancia: **la paciente ya se había ido y la consulta quedó
sin diagnóstico.** En el archivo del equipo no hay nada derivado de esas dos medidas, pero en Atlas sí: el
ICC es uno de los seis disparadores de la ruta R2, y con 1020 el disparador se apagaría sin que nadie lo
note. · **A)** Siempre se repite la toma. · **B)** Atlas deja corregir o completar cintura y cadera después
de importar, con motivo y guardando el valor original. · **C)** Se corrige en el Biody Manager, se
reexporta, y en Atlas se reemplaza la medición con motivo.
*Recomendamos C si el Biody Manager deja editar y reexportar sin volver a medir; si no deja, B. **La C ya
está construida** y no cuesta nada: desde el 5 de noviembre el freno de huella repetida avisa, pide motivo
y deja seguir.*

**1 · ¿Cuál Harris-Benedict manda, y sobre qué se aplica el 10 %?** Su v12 pide Harris-Benedict sobre el
peso meta más 10 % de termogénesis, y hay dos juegos de coeficientes posibles (1919 y 1984). Atlas ya tiene
el de 1919 portado para otra cosa, así que adoptar el de 1984 deja dos vivos, cada uno en su sitio.
*Recomendamos el de 1984 para la prescripción y el 10 % sobre TMB × actividad. Mueve el objetivo calórico
de toda la cohorte (+301 kcal/día en su propio ejemplo), así que entra con bump de motor o no entra.*

**2 · Los cortes del control de calidad biológico.** Sus once identidades imposibles están construidas.
Faltan los rangos, y sus límites provisionales rechazarían **cinco mediciones reales** (un peso de 22 kg,
una capacitancia de 16,22 nF, una Fo de 4,84 kHz y dos grasas negativas). *Recomendamos que el corte que
FRENA caiga fuera del mínimo y del máximo observados, y que la banda de percentiles sirva solo para decir
"mire esta medición". Y añadir a sus imposibles: masa grasa o porcentaje de grasa ≤ 0.*

**3 · Las consultas que el recálculo no puede tocar, ¿se quedan desfasadas para siempre?** Veinte
consultas tienen la medición compartida (y cuatro de esos grupos son entre pacientes distintos), así que no
se pueden recalcular hasta corregir de quién es cada toma. *Recomendamos marcarlas con su motivo y
recalcularlas cuando se resuelva. Díganos si eso es aceptable como estado permanente para las que nunca se
resuelvan.*

**4 · ¿Cómo deben leer el DFI y las rutas el IAE de la v7?** En el mismo informe, arriba dice *"−1,3 años:
acorde con sus pares"* y tres líneas abajo *"envejecimiento acelerado"*. La cifra que ve el paciente ya es
v7; la que alimenta el dominio 3, el riesgo y **las rutas** quedó en la v5. Coinciden 326 de 389 informes;
los 60 que no, no se entregan. **En su propio caso del anexo (`ed83ff97`): arriba 76,4 años con IAE +12,4,
el dominio 3 dice 31,4 años con IAE −32,6 y "Enlentecido", y en Tratamiento 0 rutas activas.** Cuarenta y
cinco años de diferencia dentro de una consulta, y a la paciente no se le prescribió nada para el
envejecimiento. *Recomendamos que lo decida usted entre tres salidas (el DFI lee el IAE de la v7 · el
dominio 3 tiene su propia escala y entonces hay que decirlo en el documento · otra cosa). Y la segunda
mitad: sus tres textos por banda, ¿sustituyen al texto de trayectoria o conviven?*

### B · Están aplicadas y necesitan su confirmación

**5 · "Edad biológica estimada" [aplicado].** Su tabla 3 vuelve a usar la expresión que usted había
retirado en julio, ahora con el matiz "estimada". *Recomendamos que lo nuevo manda, y así está. Confirme,
porque cambia el rótulo de un documento clínico que ya salió once veces con el otro nombre.*

**6 · El Δ del IAE dentro de la banda [aplicado].** Su regla del 1 de septiembre dice **cero** mientras el
IAE esté entre −5 y +5; lo cambiamos a una raya porque el IAE ya es una diferencia y el "0,0" al lado del
valor se leía como si el IAE fuera cero. *Recomendamos dejar la raya, pero es preferencia nuestra contra su
regla escrita: dígalo.*

**7 · El borde exacto de ±5,0 del IAE.** Su tabla 3 usa cortes cerrados y su capa de display anterior los
usaba abiertos; en ±5,0 exacto las dos columnas de la misma fila se contradicen. *Recomendamos alinear el Δ
a su corte cerrado. No lo cambiamos todavía porque reintroduce un "0,0" que la 6 acaba de retirar.*

**8 · Los tres cortes de la Diana, y una objeción de estética.** Su v12 corrige bien un defecto real (los
estados leves caían en verde lima y se leían como "está bien"), pero pasar a **tres colores sólidos** parte
la Diana en anillos y le quita la superficie continua, que es lo que la hace legible. *Recomendamos que
considere correr el gradiente hacia el rojo, quitándole el verde lima a la zona leve, sin cortes duros. Y
con la respuesta hace falta saber si el radar y las tarjetas del DFI se igualan a la Diana.*

**9 · Los nombres llanos de tres de sus índices [aplicado].** En la historia clínica, IEHH pasó a
"Equilibrio hídrico", PABU a "Proporción bioeléctrica" e ICA-BIS a "Desviación bioeléctrica", con su sigla
al lado. Sus nombres oficiales no se tocan. *En la tercera nos apartamos de lo que se nos pidió
("Coherencia"): el número de al lado es una desviación y lo bueno es lo bajo, así que "coherencia" invierte
la lectura. Júzguelo usted.*

**10 · "La dirección científica" que elimina un perfil [aplicado].** Su v12 pide que la política sea
*"solo para el profesional dueño del paciente y para la dirección científica"*. En Atlas ejecuta el
**administrador**, porque el rol de dirección no accede a datos de paciente por diseño y esta bandeja
necesita el nombre. *Recomendamos dejarlo en administrador.*

**11 · El aviso de síndrome de realimentación sale del motor viejo.** Usted lo anotó en su v12 §8.2 y no lo
corrigió; en Atlas está idéntico, porque es porte fiel. *Recomendamos que diga si la condición se queda tal
cual o si el aviso pasa al motor nuevo. Cuando lo decida, es una línea.*

**12 · La fuerza prensil obligatoria, con salida.** Es el criterio primario del EWGSOP2 y hoy Atlas la pide
sin alternativa, pero muchas consultas no tienen dinamómetro. *Recomendamos obligatoria con una salida
registrada ("no se midió" más el motivo). Lo tiene que aprobar usted porque cambia la captura.*

### C · Textos y colores que solo puede escribir usted

**13 · Los cinco textos de dominio del informe [propuesto, NO aplicado].** El paciente lee hoy
*"Homeostasis celular: membranas íntegras y microambiente equilibrado"*. Hay una propuesta en lenguaje
sencillo para las cinco, sin aplicar. *Recomendamos que las escriba o las corrija usted: el informe
llevaría las suyas para el paciente y las de hoy para el profesional.*

**14 · Su banda media del IFC y del IRC tiene tres nombres, y uno dice «normal».** Sus clasificadores la
llaman "Alerta funcional" y "Riesgo moderado"; su `idx` del DFI la llama "Normal"; y su párrafo del DFI
escribe *"en rango normal"*. Un profesional leyó las dos cosas y entendió que el sistema se contradecía.
*La pregunta: para la banda media, ¿qué debe decir su párrafo? Y de paso, el criterio de egreso de la R1
(IFC ≥ 4,5) es un corte sin sexo con el que una mujer no sale nunca de la ruta.*

**15 · Su clasificador del IAE pinta "Concordante" en ámbar.** Lo preguntó usted, y la respuesta es que el
ámbar sale de su archivo: el IAE es su único clasificador de dos colas, lo bueno está en el centro, y sobre
una rampa verde-ámbar-rojo al centro le tocó el color de en medio. *Es una línea suya. Conviene cerrarla
junto con la 4.*

**16 · La casilla 3_3 de su matriz IFC×IRC lleva un cian.** "Función normal con riesgo" (la peor de su
fila) tiene el color que nuestra regla lee como óptimo. En Atlas no se pinta mal porque el motor descarta
ese color, pero en su archivo sí se ve. *La pregunta: ¿lo cambia, o el cian significa algo que no estamos
leyendo?*

### D · Dos reglas suyas para lo mismo (necesita mirar su archivo)

Las siete de aquí no son diferencias entre su archivo y Atlas: son diferencias **entre dos sitios de su
propio archivo**. En cada una portamos una de las dos y le decimos cuál.

**17 · La fila ICA-BIS tiene dos reglas, una por superficie.** En Composición gradúa la magnitud en cinco
escalones; en la historia clínica hace `icaBisClf = cPABU(t_pabu)`, con su nota *"cICABIS eliminado, usar
cPABU global"*. *La pregunta: ¿es deliberado (la historia resume, la pantalla detalla) o esa nota iba
también para la tabla de Composición?*

**18 · El % de grasa con dos cortes.** Su tabla de la HC y su tabla de composición dan **veredictos
distintos para el mismo número** (22,4 % en un hombre: "Límite" en una, "Sobrepeso adiposo" en la otra).
Atlas usa hoy el segundo, el que nos confirmó en agosto. *La pregunta: ¿cuál manda en la historia clínica?*

**19 · Dos clasificadores del índice cintura-cadera.** Mismos cortes, distinta redacción (`dICC`:
"Normal"/"Riesgo cardiovascular"; `clasifICC`: "Riesgo bajo"/"Riesgo alto, distribución central"). Atlas
porta el primero. *La pregunta: ¿cuál manda? El segundo dice más, así que puede que el nuestro se quede
corto.*

**20 · `clasifLancet` está declarado y nadie lo llama, ni usted.** Un clasificador completo de cuatro
niveles, rotulado "Propuesta The Lancet 2025", que aparece una sola vez en su archivo: la declaración. No lo
portamos, porque conectar lo que su archivo no conecta sería estrenar una clasificación clínica por nuestra
cuenta. *La pregunta: ¿es un resto, o algo que piensa usar?*

**21 · Las badges del Nivel III, y el ECM/BCM que se quedó sin sitio.** Su `celBadges` se llena y ningún
render la lee. Nosotros sí las mostrábamos, y ahí salió el choque que usted notó (su tabla decía
"hidratación adecuada" y la badge "deficiente": son dos indicadores suyos distintos). Están retiradas. *Lo
que se pierde es el ECM/BCM > 1,4, el único sin fila propia. ¿Debe verse? ¿Con qué corte y en qué fila?*

**22 · El estado PBI: su HC lo imprime y nosotros lo retiramos.** Por dos razones: la taxonomía real tomó
autoridad sobre `F1-F12 / PBI / EIEC`, y su `estadoPBI` usa un **tercer umbral de ángulo de fase**
(6,80/6,30) que contradice el `cAF` (6,5) que Atlas ya muestra en la misma pantalla. *La pregunta previa, si
el PBI vuelve: cuál de los dos umbrales de AF manda, porque no pueden convivir.*

**23 · La fórmula sintética: sus doce campos están todos, la disposición es otra.** Usted los presenta como
lista plana; nosotros como una cuenta (GEB × PAL = GET, menos el déficit, igual al objetivo). *La pregunta:
cuál quiere. Y una nueva: su v12 retira la tabla vieja, y con ella se va el ORIGEN del rótulo "Fórmula
sintética", que adoptamos por ser el suyo. ¿Cómo debe llamarse ese bloque?*

### E · El instrumento y el prompt

**24 · Diez de sus quince alertas clínicas no pueden salir nunca.** Leen el consumo de nutrientes en
porciones, y ese dato no lo captura ninguna encuesta, ni la suya ni la nuestra. **No es una pregunta nueva:
es la consecuencia de dos respuestas suyas** (*"ninguno es la traducción de otro"*, 30-ago; *"no va, y no
es que falte: es que no debe existir"*, 3-sep). Mientras tanto Atlas lo dice en pantalla. *La pregunta: ¿se
queda así, se retiran las diez del modelo, o la encuesta captura porciones?*

**25 · ¿Qué MÁS debería alimentar al generador de menús?** Hoy viajan el objetivo calórico, la proteína, las
restricciones del modelo y del profesional, el patrón alimentario, el fenotipo y las rutas. No viajan el
contexto de acceso ni la distribución por tiempos de comida. *La pregunta: de esos dos, ¿alguno debería
entrar? Las alergias no están en la pregunta, porque eso ya lo respondió.*

**26 · Sus pasos 1 a 3 del Análisis IA no llegan al paso 4.** Su Análisis hace cuatro llamadas al modelo, y
la validación **no la lee nadie**: el paso 4 solo recibe sus instrucciones, el bloque DFI y los datos
crudos. Portamos el paso 4; portar los otros tres sería copiar el corte y pagarlo tres veces. *La pregunta:
¿debían alimentar al cuarto? Si sí, lo cableamos.*

**27 · En la historia clínica, ¿van todas las observaciones o solo la vigente?** No se pueden borrar ni
editar, así que un profesional que se corrige deja dos. En pantalla la última se marca vigente; en el
documento salen todas. *Lo defendemos porque la historia clínica es probatoria y esconder la corrección es
justo lo que una auditoría querría ver, pero la objeción es nuestra también: una corrección de una palabra
deja dos párrafos casi iguales. Su archivo no lo resuelve: guarda una sola.*

**28 · ¿En qué dominio van los síntomas digestivos?** Su DFI no los lee en ninguno de los cinco y su paso 4
los manda en su propio bloque; el modelo, por su cuenta, los metió en el Epigenético-Contextual. *Por ahora
se le pide que no los use como evidencia de ningún dominio. Si prefiere que se lean en alguno, díganos en
cuál.*

**29 · La pregunta de amputación se queda, y usted no la nombró.** Nos dijo que quitáramos las preguntas
que no había puesto y nombró dos (edema y fiebre): las dos están fuera. La tercera del mismo lote,
*"¿Tiene amputación de algún segmento corporal?"*, tampoco está en su archivo, y la dejamos porque retirarla
sin que la señale sería tratar su silencio como una instrucción. *Y hay una razón para separarla: el edema
y la fiebre son transitorios, una amputación es permanente, y lo que compromete no es el estado del
paciente sino la ecuación, que estima sobre un cuerpo completo. ¿La retiramos también?*

### F · Data que conviene que sepa antes de leer sus propios casos

**30 · Dos de los ids de su anexo A son data de PRUEBA.** El grupo de tres (`5441fd96` / `b3e367cc` /
`6256b921`, el que la columna `Edad` no le cuadra a ninguno) son pacientes que creó el equipo para probar
el sistema. *O sea que el caso que describe ahí no es de un paciente. Y una corrección nuestra: le dijimos
cinco grupos entre pacientes distintos y son cuatro; usted tenía razón al dudar de la cifra.*

**31 · Los pacientes pediátricos: el equipo da grasa negativa y la v7 no los cubre.** En la cohorte hay
cuerpos de 22 kg y 29 kg; el Biody aplica ecuaciones de adulto y devuelve masa grasa negativa, y la EB-BIS
v7 está calibrada 18-100 años. *Recomendamos marcar esas consultas como fuera de rango de calibración y no
calcular. Si CNV va a atender pediatría, con qué ecuaciones es decisión suya.*

### G · Las cinco que salieron de leer la v15 y la v16

Las añadimos el 5 de noviembre, al revisar sus dos entregas nuevas. **Las cuatro primeras se contestan con
una letra.**

**32 · ¿Qué pasó con las versiones 13 y 14 del HTML?** Nosotros nos quedamos en la v12 del 12 de octubre, y
las dos siguientes que nos llegaron son la v15 y la v16. Entendemos que la 13 y la 14 fueron adelantos que
terminaron recogidos en estas dos. *No es una pregunta abierta, es una confirmación.*
 · **A)** Sí, v15 y v16 recogen todo lo de v13 y v14. · **B)** No, falta algo (díganos qué).
*Recomendamos A: su v15 declara su base en `ATLAS_v12.html` y su v16 en `ATLAS_v15.html`, sin mencionar las
otras dos.*

**33 · La reconfirmación al cierre de una ruta**, que su §5.5 del 30 de octubre dejó pendiente. Hoy solo
aplica la regla anual.
 · **A)** Solo la anual. · **B)** El cierre de una ruta dispara la reconfirmación completa. · **C)** Solo
 los ítems de esa ruta.
*Recomendamos A: B añade un bloque de confirmación largo justo en la consulta de cierre, que es cuando el
profesional tiene menos tiempo. Si después se ve que hace falta, se añade.*

**34 · El S1 del Módulo S cuando no hay nutracéuticos indicados.** El S1 sale de los nutracéuticos de la
consulta anterior, y **de los 30 pacientes que hoy tienen dos o más consultas, 18 no tienen ninguno en la
anterior**: a esos el Módulo S les nace con su primera pregunta vacía.
 · **A)** Si no hay ninguno indicado, S1 y S2 no se presentan y la adherencia se calcula con el S3 (plan de
 alimentación) solo. · **B)** Se presenta S1 con una línea que diga "no se le indicó ninguno", para que
 quede registrado. · **C)** Otra cosa.
*Recomendamos A: una pregunta sobre un producto que nadie le indicó no tiene respuesta correcta, y
`cnvsAdherenciaAdecuada` ya se resuelve con el S3.*

**35 · En la v15, "Acorde con sus pares" tiene dos colores en su propio archivo.** Su `cIAE` (línea 4487)
la pinta en ámbar (`#f59e0b`) y el `dIAE` nuevo (línea 15443) en azul (`#3b82f6`). Es la misma banda.
 · **A)** Manda el azul: la banda central es lo esperado, no una alerta. · **B)** Manda el ámbar.
 · **C)** Son distintos a propósito (una superficie avisa, la otra informa), y díganos cuál va en cuál.
*Recomendamos A, que es lo que ya proponíamos en la 15: en una rampa de dos colas, pintar de ámbar lo que
está bien invierte la lectura. Su `dIAE` nuevo ya lo hace.* **Esta sustituye a la 15 si contesta A.**

**36 · El Δ del IAE en el borde exacto de ±5,0, en la v15.** Su documento dice que los cortes pasan a ser
inclusivos, y su `cIAE` lo cumple; pero el Δ de la línea 15628 sigue con el corte abierto
(`iae_d > 5 ? ... : iae_d < -5 ? ... : '0,0'`). Con un IAE de **exactamente +5,0**, la misma fila dice
*"Envejecimiento acelerado estimado"* y un Δ de **"0,0"**. Es la pregunta 7, dos líneas más abajo.
 · **A)** El Δ también pasa a cerrado, y en +5,0 muestra "+0,0". · **B)** El Δ se queda abierto y en el
 borde muestra la raya, no el cero. · **C)** Otra cosa.
*Recomendamos B, que junta esta con la 6: el IAE ya es una diferencia, y un "0,0" al lado del valor se lee
como si el IAE fuera cero.*

**Y hay un SEGUNDO sitio con el corte abierto en su v16** (medido el 7 de noviembre, al cerrar el borde en
Atlas): la sugerencia del nutracéutico y la del protocolo de telómeros, las dos con `iae > 5`. Así que con
un IAE de **exactamente +5,0** su archivo activa la ruta R4 (corte cerrado), llama al envejecimiento
acelerado en la banda (corte cerrado) y **no** sugiere la Coenzima Q10 (corte abierto): el documento nombra
el problema, prescribe la ruta y deja fuera el nutracéutico que esa misma ruta justifica. En Atlas está
portado byte a byte, así que hace exactamente lo mismo. **Hoy son dos consultas reales** (las dos en +5,0
exacto, de la simulación del recálculo).
 · **D)** El corte del nutracéutico y del protocolo de telómeros también pasa a `>= 5`. · **E)** Se queda
 abierto a propósito, porque la sugerencia pide más margen que la banda. · **F)** Otra cosa.
*Recomendamos D: en la misma consulta no pueden regir dos cortes para la misma cifra.*

---

# EL DETALLE DE CADA PREGUNTA

Con el mismo número de arriba. No hace falta leerlo para contestar: está para las que quiera mirar despacio.

---

## 0 · El ejemplo de su prompt lleva el nombre de una persona, y viaja al proveedor de IA

En el prompt del Análisis IA de su archivo, el ejemplo de formato de salida lleva un nombre propio y una
edad. El ejemplo viaja al proveedor del modelo **en cada llamada**, junto a los datos del paciente que se
esté analizando.

**En Atlas el nombre no se envía:** usted ya nos respondió inline, en septiembre, que no debía ir, y así
está. Lo que **sigue sin respuesta es la pregunta de fondo: ¿es una persona real?** Si lo es, hay un dato
personal suyo saliendo de su archivo cada vez que alguien usa su prototipo, y eso lo tiene que saber usted,
no nosotros.

**Y el ejemplo sigue en su archivo**, verificado en la entrega de octubre. Nuestra recomendación es
reemplazar el nombre por un marcador (`[NOMBRE]`, `Paciente 1`) en su propia copia. Es un cambio de una
palabra y cierra el asunto para siempre.

---

# A · LAS QUE FRENAN TRABAJO

Sin su respuesta, estas no se construyen. No es una forma de decir que son importantes: es que
construirlas exige elegir por usted.

## 37 · Una cadera mal tecleada: ¿se repite la toma, o Atlas deja corregirla? **[FRENA UNA CONSULTA REAL]**

**El caso, del 6 de noviembre.** Una profesional escribió **1020** en la cadera (un dedo de más en el
teclado). Atlas frenó la importación, que es lo correcto. Pero no hay forma de corregir ese número sin
volver a tomar la bioimpedancia, y **la paciente ya se había ido**. La consulta quedó sin diagnóstico.

**Lo que medimos antes de preguntarle, para que decida con datos:**

**1 · En el ARCHIVO del Biody Manager no hay nada derivado de cintura ni de cadera.** Revisamos las 117
columnas del export de esa paciente: `Hips Size cm` y `Waist Size cm` son datos hoja. No existe una
columna de índice cintura-cadera, ni ninguna otra que cambie si se corrige una de las dos. (Las tres
columnas con la palabra *ratio* son bioeléctricas: impedancia, ECW/ICW y ECM/BCM.)

**Lo que no podemos saber desde aquí es si el Biody Manager las usa por dentro** para algo que no exporta:
su propio informe, su interpretación, o un indicador que usted lea allá. Esa mitad es suya, y es la que
decide entre B y C.

**2 · En ATLAS sí dependen dos razones, y una es clínica.** Atlas calcula `ICC = cintura/cadera` y
`ICT = cintura/talla`. **El ICC es uno de los seis disparadores de la ruta R2** (corte 0,90 en hombres y
0,85 en mujeres). Con la cadera en 1020 el ICC da 0,08: ese disparador quedaría apagado y nadie lo notaría.
O sea que la cadera **no es un dato de adorno en Atlas**, y por eso el freno acertó.

**Las tres salidas:**

| | Qué pasa | Qué queda en el Biody Manager |
|---|---|---|
| **A** | Siempre se repite la toma. | Igual que Atlas. |
| **B** | Atlas deja corregir o completar cintura y cadera después de importar, con motivo y guardando el valor original. | **Con el dato viejo.** Para investigación, la fuente pasa a ser Atlas. |
| **C** | Se corrige en el Biody Manager y se reexporta; en Atlas se reemplaza la medición con motivo. | Igual que Atlas. |

**Nuestra recomendación: C**, si el Biody Manager deja editar y reexportar sin volver a medir (Santiago lo
verifica en el programa). Si no deja, **B**.

**Y la C ya está construida**, que es lo que la hace barata: un archivo reexportado trae las mismas
lecturas eléctricas, así que el freno de huella repetida lo reconocería. Desde el 5 de noviembre ese freno
**avisa, pide un motivo y deja seguir**, y el acto queda en el rastro clínico donde dirección lo ve. No
hay que construir nada para la C: solo decir que se puede usar así.

**Mientras tanto** la consulta de esa paciente queda como está, y la guía de profesionales no se toca
hasta que usted responda.

## 1 · ¿Cuál Harris-Benedict manda, y sobre qué se aplica el 10 %?

Su v12 §6.1 prescribe Harris-Benedict sobre el peso meta más 10 % de termogénesis, y usted mismo marcó dos
precisiones por confirmar: que `gebHarris` trae los coeficientes de **1984** (88,362 / 447,593) y no los de
**1919**, y que el 10 % se aplica sobre TMB × actividad.

**Y hay un detalle que conviene que sepa:** Atlas ya tiene la de **1919** portada desde el 2 de septiembre,
como respaldo del basal medido. Adoptar la de 1984 deja **dos Harris-Benedict** vivos en el sistema, cada
uno en su sitio; no es un problema, pero tiene que ser una decisión y no un accidente.

**Nuestra recomendación:** la de **1984** para la prescripción (es la que usted portó) y el 10 % sobre
TMB × actividad (es lo que su código hace), dejando la de 1919 **solo** donde ya está. El cambio mueve el
objetivo calórico de toda la cohorte (**+301 kcal/día** en su propio ejemplo verificado), así que entra con
bump del motor y golden tests, o no entra.

**Y arrastra una pieza entera:** el flujo guiado de seis pasos del nutricionista (su v12 §6.2) empieza por
las cifras del motor calórico, así que mientras esto no se decida, ese flujo tampoco se construye.

## 2 · Los cortes del control de calidad biológico, con una advertencia de método

Sus once identidades imposibles están construidas y no dependen de ningún umbral. Lo que falta son los
**rangos** (`QC_BIO_LIMITES`), y sus límites provisionales, aplicados sobre la cohorte limpia (352
mediciones), **rechazarían cinco mediciones reales**.

| variable | mín real | p0,5 | p99,5 | máx real | su límite | ¿rechaza? |
|---|---|---|---|---|---|---|
| peso (kg) | **22** | 42,59 | 122,81 | 134 | 25-300 | **sí: 1** |
| C (nF) | 0,54 | 0,67 | 4 | **16,22** | 0,3-10 | **sí: 1** |
| Fo (kHz) | **4,84** | 24,9 | 60,74 | 66,41 | 10-150 | **sí: 1** |
| grasa (%) | **−15,6** | 7,05 | 44,57 | 45,77 | 2-70 | **sí: 2** |
| talla, IMC, cintura, cadera, Re, Ri, R∞, AF, hidratación, prensil | | | | | | no |

**La advertencia de método, que es suya de decidir y nuestra de decir:** adoptar p0,5 y p99,5 como **cortes
duros** rechaza por construcción cerca del **1 %** de las mediciones reales (medio por cola). Para un filtro
que existe para atrapar un error de digitación, eso es al revés: sacaría de la cohorte a pacientes que
midieron bien. Y con n = 352, el p0,5 lo deciden las dos mediciones más bajas.

**Nuestra recomendación:** la banda de percentiles sirve para decir *"mire esta medición"*; **el corte que
FRENA debería caer fuera del mínimo y del máximo reales observados**. Es la regla que este repositorio ya
aplica desde el caso de la capacitancia de 16,22 nF, que con su rango 0,3-10 volvería a quedar fuera y ya
dejó una vez a una paciente sin diagnóstico. Y una propuesta para su lista de imposibles: **"masa grasa o
porcentaje de grasa ≤ 0"**, que es el único que atrapa las dos grasas negativas.

## 3 · Las consultas que quedan fuera del recálculo, ¿se quedan desfasadas para siempre?

Su §5 pide recalcular el histórico con la v7, y la lista no puede ser "todas".

**Las cifras de hoy, 3 de noviembre, ya depuradas:** quedan **diez** grupos de mediciones repetidas, que
afectan a **veinte** consultas, y **cuatro** de esos grupos son entre **pacientes distintos** (los otros seis
son del mismo paciente, que es un problema menor: la toma es suya, solo está colgada de la consulta
equivocada). Las de pacientes distintos no se pueden recalcular hasta que se corrija de quién es cada toma.
Y las que no tienen encuesta completa no emiten diagnóstico por su propio gate.

**La pregunta es qué pasa con ellas después.** Si se recalcula el resto, esas quedan con la EB-BIS de la v5
y las demás con la v7, y la banda de trayectoria no compara entre versiones mayores del motor, así que el
seguimiento de esos pacientes queda partido en dos.

**Nuestra recomendación:** que queden **marcadas con su motivo** y entren al recálculo en cuanto se resuelva
lo que las frena, en vez de recalcularlas a la fuerza con un dato que sabemos que no es del paciente. Pero
díganos si eso es aceptable como estado **permanente** para las que nunca se resuelvan: son pacientes que
quizá no vuelven, y su historia se queda en la v5.

## 4 · NUEVA · ¿Cómo deben leer el DFI y las rutas el IAE de la v7?

**Esta es la más importante del documento, y salió de un informe real suyo.** Santiago leyó el informe de
una paciente y encontró esto, en la misma hoja:

> Arriba: *"Edad biológica estimada: 24,7 años · **−1,3 años: acorde con sus pares**."*
> Tres líneas más abajo: *"Envejecimiento · A trabajar. **Envejecimiento acelerado**: intervenir sobre
> función y masa."*

**La causa es un porte a medias nuestro, y lo decimos primero para que no se busque en su archivo.** Su §2
del 26 de octubre es literal: *"La EB-BIS v5 se retira del motor de ATLAS y se sustituye por la EB-BIS v7."*
El camino que calcula la cifra que el paciente lee **sí** se migró a la v7. El camino que alimenta el
**dominio 3 del DFI, el riesgo integrado y las rutas** quedó en la v5. Así que en la misma consulta conviven
dos edades biológicas: **la que se le dice al paciente y la que decide lo que se le prescribe.**

**Y hay un caso que usted puede comprobar, porque es suyo: la evaluación `ed83ff97`** (la mujer de 64
años de su anexo). En el mismo documento, leído hoy:

| Dónde | Qué dice |
|---|---|
| La cifra que ve el paciente (EB-BIS v7, parámetros 7.1.0) | **76,4 años · IAE +12,4** |
| El dominio 3 del DFI, que alimenta el riesgo y las rutas | **31,4 años · IAE −32,6 · "Enlentecido"** |
| La pestaña de Tratamiento de esa misma consulta | **0 rutas activas** |

**Cuarenta y cinco años de diferencia en la misma consulta**, y las dos cifras salen del mismo sistema:
la de arriba del motor nuevo, la de abajo del que su §2 retiró.

**La tercera fila es la que cierra el caso, y Santiago la comprobó en pantalla el 5 de noviembre.** No es
una contradicción de texto: es que a esa paciente **no se le prescribió nada** para el envejecimiento. La
ruta de desaceleración no se activó porque el DFI lee el −32,6 de la v5, que dice que su envejecimiento va
*enlentecido*. Arriba, en el documento que ella recibe, dice que lleva doce años de más.

Es exactamente el caso de los 43 de la tabla de abajo, con nombre: **el documento le nombra el problema y
no trae nada que hacer con él.**

**Cuánto, medido sobre los 389 informes vigentes:**

| | |
|---|---|
| Coinciden | **326** (84 %) |
| Dicen "acorde con sus pares" arriba y **activan** la ruta de desaceleración del envejecimiento | **17** |
| Dicen **acelerado** arriba y **no activan** esa ruta | **43** |
| De esos 60, enviados al paciente | **ninguno** |

Los 43 son el peor de los dos casos: al paciente se le nombra el problema y el documento no prescribe nada
para él.

**Lo que hicimos mientras usted decide, y lo que NO hicimos.** Un documento que se contradice **ya no se
entrega**: el servicio de entrega lo frena y le dice al profesional por qué, igual que el freno del cambio
desfavorable. Lo que **no** tocamos es el motor, y es deliberado: arreglar el camino del DFI cambia el
dominio 3, el riesgo integrado y **las rutas activas de toda la cohorte**. Eso es un bump del motor, con sus
goldens y un recálculo nuevo, y **cuál criterio debe regir es suyo.**

**Las tres salidas que vemos:**

1. **El DFI pasa a leer el IAE de la v7**, y entonces el dominio 3, el riesgo y las rutas se recalculan con
   la escala nueva. Es lo que su §2 parece pedir si se lee entero.
2. **El dominio 3 tiene su propia escala**, distinta de la banda de ±5 que lee el paciente, y entonces no
   hay contradicción que arreglar: hay dos lecturas con dos propósitos, y lo que falta es **decirlo** en el
   documento.
3. **Otra cosa que usted vea** y nosotros no.

**Y una segunda mitad de la misma pregunta, que ya estaba apuntada desde el 24 de octubre:** su tabla 3
define **tres textos por banda de ±5**, y hoy el texto que el paciente lee va por la **trayectoria**
(mejoró / sin cambio / empeoró, con corte de dos años), no por el nivel del IAE. **Son dos cosas distintas y
las dos son suyas.** Si conviven, el paciente puede leer *"acorde con sus pares"* junto a *"evolución
favorable"*, que no se contradicen pero tampoco se explican solos. ¿El texto de banda **sustituye** al de
trayectoria, o **conviven**, y en ese caso en qué orden?

# B · LAS QUE ESTÁN APLICADAS Y NECESITAN SU CONFIRMACIÓN

## 5 · "Edad biológica estimada": adoptamos su tabla 3, que retira una decisión suya **[aplicado]**

Su tercera ronda del 30 de julio decidió que *"la expresión 'edad biológica' no se usa en ningún contenido
del sistema: ni en pantalla, ni en reportes"*, y el indicador se llamó "Edad Bioeléctrica (EB-BIS)". Quedó
registrado como divergencia deliberada.

Su **tabla 3 del 26 de octubre** vuelve a usar la expresión, ahora como *"Edad biológica estimada"*, y marca
la fila como "Profesional y paciente". Entendemos que ese matiz ("estimada") es justo lo que su objeción
pedía: le molestaba afirmar la edad del cuerpo, no estimarla.

**Nuestra recomendación:** lo nuevo manda, y así está aplicado, en el registro del motor, en la pantalla de
resultados y en la historia clínica, con su sigla al lado. **Confirme**, porque cambia el rótulo de un
documento clínico que ya salió once veces con el otro nombre. Los informes ya enviados **no** se tocan.

## 6 · El Δ del IAE dentro de la banda: lo cambiamos **nosotros**, contra su regla **[aplicado]**

Su entrega del **1 de septiembre §5** define el Δ del IAE como *"la distancia al límite del rango que se
cruzó, y **cero** mientras esté dentro de −5 a +5"*. El cero es suyo.

**Lo cambiamos a "—" (raya) dentro de la banda, y la razón es propia de esa fila y de ninguna otra:** el IAE
**ya es** una diferencia, así que la fila ponía dos números con signo uno al lado del otro ("+3,5" en Valor
y "0,0" en Δ), y el "0,0" se leía como si el IAE fuera cero. Conservamos la otra mitad de su regla: cuando
sí cruzó, el Δ da la distancia al límite.

**Nuestra recomendación:** dejar la raya. **Pero es preferencia nuestra contra su regla escrita, así que
dígalo:** ¿está de acuerdo, o vuelve el cero? Es una celda que ya se movió tres veces y conviene cerrarla.

## 7 · El borde exacto de ±5,0 del IAE, donde hoy Atlas se contradice consigo mismo

Su tabla 3 usa cortes **cerrados** (`≥ +5` acelerado, `≤ −5` desacelerado), y su capa de display anterior
(`dIAE`) los usaba **abiertos**. Atlas adoptó los cerrados de la tabla 3 para la banda.

**El problema está exactamente en ±5,0:** la banda dice "envejecimiento acelerado estimado" (porque 5 ≥ 5) y
el Δ, que usa el corte abierto, dice que está **dentro** del rango. En ese único valor, las dos columnas de
la misma fila se contradicen.

**Nuestra recomendación:** alinear el Δ a **su** corte cerrado, y entonces un IAE de exactamente +5,0
saldría con banda "acelerado" y Δ "+0,0 años" (está justo en el límite, a cero de distancia). **No lo
cambiamos todavía** porque es su corte y porque reintroduce un "0,0" que la pregunta 6 acaba de retirar.

## 8 · Los tres cortes de la Diana, y una objeción de estética que no habíamos dicho

**REESCRITA.** La versión anterior de esta pregunta le pedía solo los tres números. Falta la objeción.

El defecto que su v12 corrige (*"los estados leves caían en verde lima y se leían como bien"*) **está en
Atlas igual**, y por la misma causa: es el gradiente de su propia `rc()`, portado verbatim. Y la corrección
que su v12 propone es pasar a **tres colores sólidos** con cortes en 0,19 · 0,45 · 0,62.

**Y aquí está lo que no le habíamos dicho, y es de Santiago:** pasar a colores sólidos **daña la estética y
la simetría de la Diana**. El gradiente no es solo decoración: es lo que hace que la figura se lea como una
superficie continua, y tres bandas sólidas la parten en anillos. La Diana es, además, la pieza que más se
mira de todo el sistema.

**El problema que usted señala es real y no lo discutimos:** un estado leve pintado de verde lima se lee
como "está bien", y eso es un veredicto clínico mal dicho. Lo que preguntamos es si hay una salida que
arregle la lectura **sin** perder la superficie continua:

1. **Correr el gradiente hacia el rojo**, quitándole el verde lima a la zona leve: que lo leve ya no sea
   verde de ningún tono, sin cortes duros. La figura sigue siendo continua y el estado leve deja de
   premiarse.
2. **Los tres colores sólidos** de su v12, tal cual, asumiendo lo que cuesta en la figura.
3. **Otra salida** que usted vea.

**Y lo que tiene que venir con la respuesta, en los tres casos: si el radar de cinco dominios y las tarjetas
del DFI se igualan a la Diana o se quedan como están.** Su v12 dice que igualarlos sería cambiar un color;
en Atlas son los mismos tokens clínicos, así que si se igualan, se igualan en todas las superficies a la
vez. Lo que no podemos es elegir los números: el color de un veredicto clínico sale de su clasificador, no
de nuestro criterio.

## 9 · Los nombres llanos de tres de sus índices **[aplicado]**

En la tabla ANI-BIS-E de la historia clínica, tres filas se nombraban con el rótulo técnico de su propia
tabla, y Santiago no los entiende como los entendería un paciente: *"se muestran «Hidro-Homeostasis IEHH»,
«PABU», «Desviación de φ ICA-BIS»... propongo que los cambiemos a definiciones que los pacientes puedan
entender y justo debajo la sigla, así como tenemos «Aceleración del Envejecimiento IAE», que me parece muy
bien hecho. **No estamos cambiando los indicadores**, solo la forma en como mostramos la info."*

| Código | Decía | Dice |
|---|---|---|
| IEHH | Hidro-Homeostasis | **Equilibrio hídrico** |
| PABU | (sin nombre) | **Proporción bioeléctrica** |
| ICA-BIS | Desviación de φ | **Desviación bioeléctrica** |

Sus **nombres oficiales** (los de su §10 del 9 de agosto) no se tocan: siguen en el registro de indicadores
y en la pantalla del profesional, al lado del llano. Las otras cinco filas no se mueven, porque sus nombres
ya son llanos o los fijó su tabla 3.

**Y en la tercera nos apartamos de lo que se nos pidió, con una razón que conviene que juzgue usted.** Se
propuso *"Coherencia bioeléctrica"*, y pusimos *"Desviación bioeléctrica"*: el número que va al lado **es
una desviación**, y su columna de referencia dice "0.00-0.15 Zona φ", o sea que cuanto más pequeño, mejor.
Rotular "coherencia" encima de un valor donde lo bueno es lo bajo invierte la lectura: un 0,15 se leería
como poca coherencia cuando es justo la zona buena.

**Nuestra recomendación:** dejar "Desviación bioeléctrica". Si prefiere "Coherencia", habría que mostrar el
complemento (1 − ICA-BIS) o la clasificación en vez de la cifra, y eso ya es una decisión suya sobre qué se
muestra.

## 10 · "La dirección científica" que elimina un perfil: en Atlas ese rol no ve pacientes **[aplicado]**

Su v12 §1.2 pide que eliminar un perfil tenga política, *"solo para el profesional dueño del paciente y para
la dirección científica"*. Está construido, con la asimetría que Santiago ya había fijado para esta clase de
acto: el profesional **pide** con motivo y otro **ejecuta**, escribiendo el documento del paciente.

**«Dirección científica» es SU palabra**, textual de su v12 §1.2. Lo decimos porque la traducción que sigue
es NUESTRA y conviene que se vea cuál es cuál: **quien ejecuta es el ADMINISTRADOR, no el rol de
dirección**, porque en Atlas `direccion` **no accede a datos de paciente** por diseño (su tablero se
construyó sin datos personales) y esta bandeja necesita el nombre y el documento para poder decidir.

**Nuestra recomendación:** dejarlo en administrador, que es quien ya resuelve esta clase de decisión y quien
ya ve esos datos. Si quiere que sea literalmente la dirección científica, lo primero que hay que decidir es
si ese rol pasa a ver datos de paciente, que es un cambio de alcance mucho mayor.

## 11 · El aviso de síndrome de realimentación sale del motor viejo

Usted lo anotó en su v12 §8.2 y no lo corrigió: *"el aviso lo emite `motorProtocolo`, el motor viejo, no
`motorTratNutri`. Dos motores opinando sobre el mismo paciente."*

**Verificado en Atlas: está idéntico.** `alertaSindRealim` sale de `atlas-protocolo.authorized.js` (ese
mismo motor viejo) con la condición `['F7','F10'].includes(fenotipo) && GEB < 1200 && IMC < 18.5`. Es porte
fiel, así que el defecto viajó con él.

**Nuestra recomendación:** díganos si la condición se queda tal cual (y entonces no hay nada que hacer, solo
dejarlo escrito) o si el aviso pasa al motor nuevo con otra condición. Cuando lo decida, es una línea.

## 12 · La fuerza prensil obligatoria, **con salida**

La dinamometría es el criterio **primario** del EWGSOP2 y hoy Atlas la pide sin ofrecer alternativa: si no
está, la tarjeta de sarcopenia avisa de que falta y ahí termina. En la práctica, muchas consultas no tienen
dinamómetro a mano.

**Nuestra recomendación:** hacerla obligatoria **con una salida registrada**: "no se midió" más el motivo,
que es el patrón que este repositorio ya usa para los frenos sin alternativa (un freno sin salida no es un
guard: detiene a una persona). **Lo tiene que aprobar usted porque cambia la captura**, y porque un "no se
midió" con motivo es un dato clínico, no un campo administrativo.

---

# C · LOS TEXTOS Y LOS COLORES QUE SOLO PUEDE ESCRIBIR USTED

## 13 · Los cinco textos de dominio del informe, en lenguaje sencillo **[propuesto, NO aplicado]**

La hoja 2 del informe del paciente trae sus cinco lecturas del DFI tal cual. Un paciente lee esto:

> *"Homeostasis celular: membranas íntegras y microambiente equilibrado."*
> *"Carga contextual amplificada por antecedentes o entorno."*

**No lo hemos tocado, y es a propósito:** son textos clínicos suyos, y la regla de esta casa es que no se
editan, no se resumen ni se reinterpretan desde nuestro lado. Lo que sigue es una **propuesta**:

| Dominio | Lo que dice hoy | Propuesta |
|---|---|---|
| Celular-Eléctrico | Homeostasis celular: membranas íntegras y microambiente equilibrado | Tus células están bien hidratadas y sus membranas en buen estado |
| Metabólico-Estructural | Perfil metabólico-estructural favorable | Tu músculo y tu grasa están en una proporción favorable |
| Envejecimiento | Envejecimiento biológico marcadamente acelerado | Tu cuerpo se está desgastando más rápido de lo que corresponde a tu edad |
| Conductual-Perceptual | Relación con el cuerpo y la comida sin alertas | Tu relación con la comida y con tu cuerpo no muestra señales de alarma |
| Epigenético-Contextual | Carga contextual amplificada por antecedentes o entorno | Tus antecedentes familiares y tu entorno te suman riesgo |

**Nuestra recomendación:** que las escriba o las corrija usted, y entonces el informe lleva **las suyas**
para el paciente y las de hoy para el profesional. Lo que no nos parece correcto es que las cambiemos
nosotros: son la lectura clínica de cada dominio.

## 14 · Su banda media del IFC y del IRC tiene tres nombres, y uno dice «normal»

**Qué pasó.** Una integrante vio, en la misma paciente (mujer, IFC 2,11, IRC 2,79), que el diagnóstico y el
SOAP se contradecían: la tabla decía «Disfunción celular establecida» y el párrafo del análisis decía
«presenta una función celular en rango normal con riesgo celular en rango normal».

**Lo que era NUESTRO ya está corregido.** La tabla estaba mal: su rótulo del IFC reclasificaba con
**3,5/6,0**, los cortes históricos únicos que su prompt prohíbe expresamente (*"desplazaban sistemáticamente
la lectura de las mujeres"*). Con su `cIFC` (2,08/3,28 en mujeres), 2,11 es la banda **media**, y el color de
la fila ya lo decía (ámbar). Ahora la tabla dice «Alerta funcional», que es lo que dice su clasificador
sellado.

**Lo que es SUYO, y por eso se lo preguntamos.** Aun corregida la tabla, queda una contradicción de
PALABRAS, no de banda. Su archivo llama a la banda media de tres maneras:

| Dónde | IFC 2,11 (mujer) | IRC 2,79 (mujer) |
|---|---|---|
| Sus clasificadores `cIFC` / `cIRC` (tabla, índices alterados de la HC, IA) | Alerta funcional | Riesgo moderado |
| Su `idx` interno del DFI (el que alimenta el párrafo) | Normal | Normal |
| Su párrafo `_seg1` del DFI (HC y análisis del SOAP) | «en rango normal» | «en rango normal» |

Es la **misma banda** en los tres, así que no hay error de clasificación. Pero un profesional que lee
«Riesgo moderado» en una línea y «riesgo celular en rango normal» dos párrafos más abajo entiende que el
sistema se contradice, y fue exactamente lo que pasó.

**Buscado antes de preguntarle, para no traerle algo ya decidido.** No hay respuesta suya sobre esto en
ningún documento. Lo más cercano es su §1 del 5 de septiembre, que para los nueve sectores cruza IFC
Alto/Normal/Bajo (*función normal · función · disfunción*) con IRC Bajo/Normal/Alto (*con bajo riesgo · sin
riesgo · con riesgo*). O sea que en su vocabulario más reciente la banda media del IRC se lee **"sin
riesgo"**, y su `cIRC` la rotula **"Riesgo moderado"**. Es la misma tensión, y es suya.

**La pregunta:** para la banda media, ¿qué debe decir su párrafo? ¿«en rango normal», como hoy, o algo
alineado con sus clasificadores? El texto es suyo y se pone verbatim.

**Y una del mismo tema, más pequeña.** El criterio de egreso de su ruta R1 dice *«IFC ≥ 4.5 y IRC < 3.5
sostenido 2 controles»*. Son cortes únicos, sin sexo. Para una mujer, su corte superior del IFC es 3,28: con
ese criterio **no sale nunca** de la ruta, aunque su función celular sea óptima. ¿Es a propósito, o se quedó
con los cortes viejos?

## 15 · Su clasificador del IAE pinta "Concordante" en ámbar, y lo bueno está en el medio

**Lo preguntó usted**, en el punto 14 de su revisión: *"si es concordante, ¿no debería estar en verde?"*

**Sí, y el ámbar sale de su archivo, no de nuestra interpretación.** Su `cIAE` es así:

| Valor | Etiqueta | Color |
|---|---|---|
| < −5 | Desacelerado | `#10b981` verde |
| −5 a +5 | **Concordante** | `#f59e0b` **ámbar** |
| > +5 | Acelerado | `#ef4444` rojo |

Atlas no escribe severidades a mano: **lee el color que emite su clasificador**. El ámbar entra como
"alerta" porque usted lo puso ahí.

**Por qué pasó, y no tiene nada de descuido:** el IAE es su **único clasificador de dos colas**. Lo bueno
está en el CENTRO, no en un extremo. Sobre una rampa de tres pasos verde-ámbar-rojo, el verde se lo llevó
"Desacelerado" y al centro le tocó el color de en medio.

**No lo tocamos nosotros** (su archivo manda en lo clínico). **Es una línea suya.** Y conviene resolverla
junto con la pregunta 4: su tabla 3 ya le pone **texto** a las tres bandas del IAE, pero no color.

## 16 · Y hay una casilla más de su matriz IFC×IRC con el mismo problema de color

Barriendo sus quince clasificadores por lo del punto anterior, apareció esta. En `FYR_LABELS`, la casilla
**3_3** (IFC alto, IRC alto) se llama **"Función normal con riesgo"** y lleva el color `#22d3ee`, un cian.

**Nuestra regla lo lee como ÓPTIMO.** Es la peor casilla de esa fila con el color de la mejor.

**Hoy no tiene consecuencia en Atlas:** el motor se queda con la etiqueta y descarta ese color, así que nada
se pinta mal. Se lo decimos porque **en su archivo sí es el color que se ve**, y es la misma forma que el
ámbar del IAE. Un barrido nuestro de agosto no lo encontró porque buscaba azules y el cian no es azul.

**¿Lo cambia, o el cian significa algo que no estamos leyendo?**

---

# D · DOS REGLAS SUYAS PARA LO MISMO (necesita mirar su archivo)

Las siete de este bloque tienen la misma forma: **no son diferencias entre su archivo y Atlas, sino entre
dos sitios de su propio archivo.** En cada una portamos una de las dos y le decimos cuál.

## 17 · La fila ICA-BIS tiene DOS reglas, una por superficie. ¿Es a propósito?

**En Diagnóstico → Composición Corporal**, la fila ICA-BIS usa un clasificador que **gradúa la magnitud** en
cinco escalones (Zona φ / Desviación leve / moderada / severa / Zona crítica).

**En Reporte / Historia Clínica** hace `icaBisClf = cPABU(t_pabu)`, y dejó la nota al lado: *"cICABIS
eliminado, usar cPABU global"*.

**Atlas porta las dos, cada una en su superficie**, porque las dos son suyas. **La pregunta es si la
diferencia es deliberada** (la historia resume y la pantalla detalla) **o si esa nota de la historia iba a
aplicarse también a la tabla de Composición y quedó a medias.**

Y de paso, algo que sí era nuestro y ya corregimos: el escalón **"Desviación leve"** va en **ámbar** en su
archivo y nosotros lo teníamos en **verde**. Un ICA-BIS desviado se pintaba como si estuviera bien.

## 18 · Su historia clínica y su tabla de composición clasifican el % de grasa con cortes distintos

| Dónde | Referencia | Con 22,4 % en un hombre |
|---|---|---|
| **Tabla de la historia clínica** | H: 8-19,9 % / M: 21-32,9 %, con un criterio escrito ahí mismo (déficit < 8 · normal < 20 · límite < 25 · obesidad ≥ 25) | **"Límite"** |
| **Tabla de composición** | 10-22 % (borde superior 22 en hombres, 32 en mujeres) | **"Sobrepeso adiposo"** |

Mismo paciente, mismo número, dos veredictos. **Atlas usa hoy el segundo**, porque es el borde que nos
confirmó el 18 de agosto.

**¿Cuál manda en la historia clínica?** Si es el de su tabla de la HC, lo portamos tal cual; si es el que
nos dio en agosto, su HC es la que quedó con el criterio viejo.

## 19 · Tiene dos clasificadores del índice cintura-cadera, con etiquetas distintas

Los mismos cortes (0,90 en hombre, 0,85 en mujer) y **distinta redacción**:

| Dónde | Debajo del corte | Encima |
|---|---|---|
| `dICC` | "Normal" | "Riesgo cardiovascular" |
| `clasifICC` | "Riesgo bajo" | "Riesgo alto, distribución central" |

Es la **misma forma** del problema que arregló en los nueve sectores: dos sitios de su archivo nombrando lo
mismo de dos maneras. **En Atlas no tiene consecuencia visible:** portamos solo `dICC`, byte a byte, y el
índice se pinta en un único sitio.

**¿Cuál manda?** La segunda dice más (*"distribución central"* explica **por qué** es riesgo), así que puede
que la nuestra se quede corta.

## 20 · `clasifLancet` está declarado en su archivo y nadie lo llama, ni usted

Es un clasificador de cuatro niveles que cruza IMC con masa grasa y masa magra, rotulado *"Propuesta The
Lancet 2025"*. Está completo, con sus etiquetas y sus colores. **Y en su archivo aparece una sola vez: la
declaración.**

Es la misma situación de las tres piezas que declaró muertas en septiembre (*"quedan marcadas para
borrarse, no para conectarse"*), **con una diferencia: esta nunca la ha mencionado.**

**No lo portamos**, y no por pereza: conectar una pieza que su propio archivo no conecta sería estrenar una
clasificación clínica por nuestra cuenta. **¿Es un resto, o algo que piensa usar?**

## 21 · Las badges de "Nivel III · Salud celular", y el ECM/BCM que se quedó sin sitio

**Lo pidió usted**, en el punto 10 de su revisión, y al ir a moverlas encontramos esto: **su `celBadges` se
llena y nunca se muestra.** En su entrega del 4 de septiembre aparece cinco veces, la declaración y los
cuatro `push`, y ningún render la lee. Lo mismo `alimentBadges`. (Y no es que las badges se pinten de otro
modo: `condBadges`, en el mismo archivo, **sí** se pinta.) **Es la misma situación que el `clasifLancet`.**

**Nosotros la habíamos portado y sí la mostrábamos**, y ahí salió el choque que usted notó: para el mismo
paciente, su tabla de Wang decía *"Hidratación celular adecuada"* en tres filas y la badge decía
*"Hidratación celular deficiente"*. **No es un error de cálculo: son dos indicadores suyos distintos con
nombres que chocan.** Las filas son el AIC como porcentaje (referencia 60-65 %) y la badge es la hidratación
de la masa libre de grasa (referencia 73,2 %), que además ya tiene **su propia fila** en la misma tabla.

**Está retirado.** Y esto **no toca su instrucción del 23 de agosto** (*"salud celular va en
Diagnóstico"*): la hidratación, el ángulo de fase y la masa celular activa siguen en Diagnóstico, cada uno
con su fila y su clasificador. Lo que se fue era el duplicado.

**Lo que sí se pierde, y por eso se lo preguntamos:** el **ECM/BCM > 1,4** era el único de las cuatro badges
**sin fila propia** en la tabla, así que ya no se ve en ninguna parte. Su archivo tampoco lo muestra.
**¿El ECM/BCM debe verse? Si sí, ¿con qué corte y en qué fila?**

## 22 · El estado PBI: su HC lo imprime y nosotros lo retiramos

La cabecera de su tabla de la historia clínica imprime, junto al fenotipo MCCB, una segunda línea: **"PBI:
Riesgo celular"**. **Atlas no lo calcula ni lo muestra**, y hay dos razones independientes:

1. Cuando reconciliamos la taxonomía con su prototipo, la real (81 estados EFR / 9 estructural / 9 sectores
   FyR / DFI de 5 dominios) tomó autoridad sobre `F1-F12 / PBI / EIEC`, que son de una **versión anterior
   del modelo**.
2. Y al medirlo: su `estadoPBI` es AF × IR y usa **un tercer umbral de ángulo de fase** (6,80 / 6,30) que
   **contradice el `cAF` (6,5)** que Atlas ya muestra en la misma pantalla. Portarlo pondría dos cortes del
   mismo ángulo de fase a la vista al mismo tiempo.

**Si el PBI vuelve a ser parte del modelo vigente, la pregunta previa es cuál de los dos umbrales de AF
manda**, porque no pueden convivir.

**Y tiene una consecuencia que antes no tenía:** al portar su prompt de diagnóstico (su punto 8) vimos que
**su propio bloque de datos crudos manda el estado PBI al modelo** (`Estado PBI: ${motor.estadoPBI?.nombre}`).
Nosotros no lo calculamos, así que **esa línea no la podemos enviar**. Es el único dato de su prompt que nos
falta por decisión declarada, no por descuido.

## 23 · La fórmula sintética: sus doce campos están todos, pero la disposición es otra

Los cotejamos uno por uno: **los doce campos de su fórmula sintética están en Atlas, ninguna cifra cambia.**
Lo que cambia es la forma:

- **Usted** los presenta como **lista plana**, todos al mismo nivel.
- **Nosotros** como **una cuenta**: GEB × PAL = GET, menos el déficit, igual al objetivo, y de ahí el reparto
  de macros.

**Que revise las dos disposiciones y diga cuál quiere.** La suya se lee de un vistazo; la nuestra enseña de
dónde sale cada número, que es lo que el nutricionista necesita cuando ajusta uno.

**Y hay algo nuevo del 3 de noviembre, que es la razón por la que esta pregunta vuelve.** Su v12 §6.4 retira
la tabla vieja de la fórmula. En Atlas esa tabla no existe, así que el retiro no nos toca, **pero se lleva el
ORIGEN del rótulo "Fórmula sintética"**, que adoptamos precisamente porque Santiago pidió usar el suyo. Si el
rótulo desaparece de su archivo, ¿cómo debe llamarse ese bloque en Atlas?

---

# E · EL INSTRUMENTO Y EL PROMPT

## 24 · Diez de sus quince alertas clínicas no pueden salir nunca, y es consecuencia de dos respuestas suyas

Su `generarAlertas` tiene **quince reglas**. En Atlas corren **cinco**: TCA activo detectado (crítico),
riesgo glucémico crítico (crítico), deshidratación probable (alto), estrés alto con azúcares elevados
(moderado) e hidratación adecuada (positivo).

**Las otras diez leen `cons`**, el consumo de nutrientes por porciones al día (sodio, kcal, fibra, hierro,
calcio, proteína, omega-3). Y ese dato **no lo captura ninguna encuesta**, ni la suya ni la nuestra: los
campos `d1_1`..`d1_18` que `calcConsumo` lee viven solo en su objeto demo.

**No es una pregunta nueva, es una consecuencia de dos que ya respondió:**

- **30 de agosto:** *"Ninguno es la traducción de otro"*. La frecuencia de consumo, la tabla de composición y
  la lista de intercambio son tres instrumentos distintos, y la frecuencia no se convierte en porciones
  **porque es un patrón, no una cuantificación**.
- **3 de septiembre:** sobre dónde se capturan las porciones por grupo, *"No va, y no es que falte: **es que
  no debe existir**"*.

Las dos respuestas son claras y las aplicamos. **Lo que quizá no estaba a la vista al responderlas es que
entre las dos dejan diez de sus propias alertas sin insumo posible.**

**Mientras tanto, Atlas lo dice en pantalla**, debajo de las alertas: *"De las quince alertas del modelo, 10
necesitan el consumo de nutrientes en porciones, que la encuesta no captura. La ausencia de avisos no
equivale a ausencia de riesgo."* Sin esa línea, "ninguna alerta" se lee como "el paciente está bien" cuando
significa "de lo nutricional no estamos evaluando nada".

**Lo que le preguntamos es solo esto: ¿lo dejamos así?** Las tres salidas, y ninguna la tomamos por nuestra
cuenta: **(1)** se queda como está, con el aviso permanente; **(2)** las diez se retiran del modelo, y el
aviso desaparece porque las alertas pasan a ser cinco; **(3)** la encuesta captura porciones (un instrumento
nuevo, suyo) y las diez se encienden. La 2 borra reglas suyas y la 3 toca el instrumento, que está congelado.

## 25 · ¿Qué MÁS debería alimentar al generador de menús?

**Lo que HOY viaja de verdad al modelo**, verificado línea por línea en el prompt:

| Viaja | No viaja |
|---|---|
| Objetivo calórico y proteína objetivo | **Alergias e intolerancias** (retiradas el 28 de agosto) |
| Restricciones del modelo, con su referencia | Contexto de acceso e inseguridad alimentaria |
| Restricciones del profesional | Distribución por tiempos de comida |
| Patrón alimentario declarado (su 3.2 del 26 de agosto) | **Datos de identificación**, nunca |
| Fenotipo estructural, sector funcional, rutas activas | |

**La pregunta:** de lo de la derecha, ¿algo debería entrar? **El acceso y la distribución por tiempos son
los dos candidatos**, y ninguno es un cruce de seguridad: el primero cambia qué alimentos son realistas, el
segundo cómo se reparte el día. **Las alergias no están en la pregunta**, porque eso ya lo respondió (27 de
agosto §10 y 11 de septiembre §1).

## 26 · Sus pasos 1 a 3 del Análisis IA no llegan al paso 4

**Esto probablemente no lo sabe, y por eso se lo decimos antes de portar nada.** Su Análisis IA hace
**cuatro** llamadas al modelo: patrones, hipótesis causal, validación y síntesis. Al trazarlas para
portarlas encontramos que la cadena **se corta**:

| paso | qué produce | quién lo lee |
|---|---|---|
| 1 · patrones | JSON | los pasos 2 y 3 |
| 2 · hipótesis causal | JSON | el paso 3 |
| 3 · validación | JSON | **nadie** |
| 4 · síntesis (el texto que sale) | el diagnóstico | es lo que se muestra |

**Y el paso 4 no recibe ninguno de los tres.** Su mensaje lleva solo sus instrucciones, el bloque DFI y los
datos crudos del paciente. Los patrones, la hipótesis y la validación **se calculan y se descartan**.

**Qué hacemos, y por qué:** portamos **el paso 4**, que es donde viven la estructura de los cinco dominios y
los datos. Portar los otros tres sería copiar el corte y pagarlo tres veces en coste y en espera.

**Si los tres primeros debían alimentar al cuarto, díganoslo y lo cableamos.** Es su diseño y puede que la
intención fuera que la validación entrara en la síntesis; hoy no entra.

## 27 · En la historia clínica, ¿van TODAS las observaciones o solo la vigente?

Usted pidió que las observaciones del profesional aparezcan en la historia clínica y **por consulta** (§8.3,
26 de agosto), y que cada profesión escriba la suya sin pisar la de otra (§8, 30 de agosto). Las dos cosas
están hechas: se guardan sin poder borrarse ni editarse, agrupadas por profesión, y salen en la historia.

**Lo que apareció al usarlas:** un profesional que se corrige escribe una segunda observación, y como no se
puede borrar la primera, **quedan las dos**. En la PANTALLA la última se marca como *vigente* y las
anteriores quedan plegadas; **en el DOCUMENTO salen todas**, con la última marcada como vigente.

**Por qué todas en el documento, y aquí es donde queremos su criterio:** la historia clínica es un documento
probatorio, y que las observaciones no se puedan borrar existe precisamente para que no se pierda lo que se
escribió. Si el documento mostrara solo la última, **escondería que hubo una corrección**, que es justo lo
que alguien querría ver en una auditoría.

**La objeción, dicha por nosotros mismos:** una corrección de una palabra deja dos párrafos casi iguales en
la historia del paciente.

**¿Van todas, o solo la vigente?** Su archivo no lo resuelve: su campo de observaciones guarda una sola
(cada control sobrescribe la anterior) y no se muestra en ningún documento.

## 28 · ¿En qué dominio van los síntomas digestivos?

**Sin urgencia.** Su DFI no los lee en ninguno de los cinco dominios (sus ítems no usan `d6_45` a `d6_51`),
y su paso 4 los manda en el bloque "D6 · Síntomas digestivos". En una prueba, el modelo los metió en el
Epigenético-Contextual por su cuenta.

Por ahora le pedimos al modelo que no los use como evidencia de ningún dominio: ya salen en el párrafo de
respuestas en rojo. **Si prefiere que se lean en alguno, díganos en cuál.**

## 29 · La pregunta de amputación se queda, y usted no la nombró

En el punto 3 nos dijo que quitáramos las preguntas que no había puesto, y nombró dos: el edema/anasarca y
el estado febril. **Las dos están fuera.** Pero entraron en el mismo lote de tres, y la tercera es *"¿Tiene
amputación de algún segmento corporal?"*, que tampoco está en su archivo. **La dejamos, porque retirarla sin
que la señale sería tratar su silencio como una instrucción.**

**Y hay una razón para separarla de las otras dos:** el edema y la fiebre son **transitorios** (la medición
se repite otro día), y una amputación es **permanente**. Lo que compromete no es el estado del paciente: es
la ecuación, que estima sobre un cuerpo completo.

**¿La retiramos también?** Es la única del bloque de declaraciones que pedía respuesta, y por eso sube aquí.

---

# F · DATA QUE CONVIENE QUE SEPA ANTES DE LEER SUS PROPIOS CASOS

## 30 · Dos de los ids de su anexo A son data de PRUEBA

El grupo de tres evaluaciones de su anexo (`5441fd96` / `b3e367cc` / `6256b921`, el que la columna `Edad` del
equipo no le cuadra a ninguno de los tres) es el **grupo de smoke**: pacientes creados por el equipo para
probar el sistema. Quedaron marcados como de prueba el 29 de octubre.

**Qué cambia con eso:** salen de las cifras, salen de la cohorte de investigación y dejan de aparecer como
alerta real. O sea que **el caso que usted describe ahí no es de un paciente.**

**Y una corrección nuestra, de hoy.** En el documento del 30 de octubre le dijimos "los otros diez grupos
siguen siendo reales, **cinco** de ellos entre pacientes distintos". Al contar otra vez separando la data de
prueba, son **cuatro**, no cinco. **Usted tenía razón al dudar de la cifra**; el error fue nuestro, por
contar sin separar lo de prueba. Los diez grupos sí son diez.

**Nuestra recomendación:** retírelos de su lista de errores 1 y 2, o reemplácelos por dos reales si quiere el
caso documentado. Nosotros mantenemos su anexo citado tal cual en nuestros documentos, con esta nota al
lado, para que las dos versiones se puedan cruzar.

## 31 · Los pacientes pediátricos: el equipo da grasa negativa y la v7 no los cubre

En la cohorte hay cuerpos de **22 kg y 29 kg**. El Biody aplica ecuaciones de adulto, y en esos cuerpos
devuelve **masa grasa negativa** (las dos grasas negativas de la tabla de la pregunta 2 vienen de ahí). No es
un error de digitación: es una fórmula aplicada fuera de su rango.

**Y la EB-BIS v7 está calibrada 18-100 años**, así que para esos pacientes no hay ni composición confiable ni
edad biológica que estimar.

**Nuestra recomendación:** decirlo en el sistema y no calcular: que esas consultas salgan **marcadas como
fuera de rango de calibración**, con la razón escrita, en vez de emitir cifras que no significan nada. Y si
CNV va a atender pediatría, hace falta decidir con qué ecuaciones, que es una decisión suya y no de
software.

---

---

# ANEXO · LO QUE DECIDIMOS NOSOTROS Y SOLO LE DECLARAMOS

**No pide nada, y por eso está al final y en una línea cada una.** Son las divergencias que tomamos por
nuestra cuenta para no dejarle preguntas abiertas que frenaran el cotejo. Cada una tiene **su puerta de
salida: si prefiere otra cosa, se cambia.** (La pregunta de amputación salió de aquí a la lista, como la
**30**: esa sí pide respuesta.)

### Lo que aplicamos LEYENDO SU v15, sin devolvérselo como pregunta (2026-11-06)

**La primera mitad de la pregunta 4: el diagnóstico funcional y las rutas ya leen el IAE de la v7.** No se
la preguntamos porque su archivo la decide, y preguntar por lo que usted ya escribió es lo contrario de lo
que nos pidió. Las líneas que lo dicen: `computeDFIFromData` **L11834** (el IAE del DFI sale del valor
guardado, uno solo) · `atlasMigrarEbV7` **L4458** (ese valor se recalcula con la v7 y el v5 se mueve a
`EB_BIS_v5`) · dominio 3 **L13965** (lee el mismo valor que ve el paciente) · **§1.4** (*"El valor v5 pasa
a `EB_BIS_v5` / `IAE_v5`, que no se muestran en ninguna pantalla"*).

**Qué cambió, medido:** en el caso de referencia el dominio de envejecimiento pasa de severidad 0 a 1 y el
riesgo integrado de 25 a 30; el golden de narrativa, que antes **difería de su archivo** en ese dominio
(Atlas lo dejaba sin puntuar y fabricaba una ruta R4 con metas a 24 semanas que su archivo no tiene), ahora
**coincide**. Y los **70 informes** que hoy no se pueden entregar por contradicción dejan de producirse.

**Aplicado según su v15; si no era eso, se revierte.** El registro completo, con lo que no se hizo y por
qué, está en `docs/entregas/CAMBIOS_AUTORIZADOS.md`, CA-3.

**Lo que SÍ sigue abierto de la 4 es su segunda mitad**, y por eso no sale de la lista: si sus tres textos
por banda sustituyen al texto de trayectoria que hoy lee el paciente, o si conviven, y en qué orden.

### Del instrumento, que es suyo

| Qué hicimos | Por qué | Revertir cuesta |
|---|---|---|
| La **P43 (alergias)** dice "Otra"; su archivo dice "Otras" | Sus opciones son alimentos en singular, las otras ocho preguntas ya dicen "Otra", y en la base hay cinco respuestas *"Otra: ..."* | Un bump de encuesta. **No es gratis** |
| La **P29 (estrés)** añade "(1 = sin estrés, 10 = máximo)" | Una escala de 1 a 10 sin sus extremos no se puede responder bien, y ese valor alimenta el motor | Un bump de encuesta |
| La **lista de intercambio imprime la medida** además de los gramos | Es la (a) de las tres salidas que usted planteó para las doce medias porciones, y la única que no pierde información | Una línea |
| El texto libre de **"otros medicamentos"** viaja dentro de la respuesta, no como campo aparte | En Atlas `d5_40` es una sola pregunta de opción múltiple. No falta el dato: vive en otro sitio, y el modelo lee lo mismo | Una línea |

### De la presentación, que es nuestra

El administrador no ve las cuatro pestañas de tratamiento por profesión · el diagnóstico de encuesta usa
colapsables, no sub-pestañas · el patrón alimentario no muestra el puntaje ni el nivel · el radar usa
cuatro colores con ancla azul, no su paleta · el diagnóstico abre en Funcional, con franja de veredicto
persistente · la tabla de composición junta lo bioeléctrico crudo en un bloque · la tabla conserva GEB y
GET, que su HTML no lista.

**Y una que merece su línea:** la tabla de la historia clínica muestra **más índices que la suya**. Su HC
lista veinte; la nuestra parte de las ~30 filas de la tabla de Wang y les aplica **su** regla de filtrado
(mostrar lo alterado, ocultar lo normal), así que puede salir un índice alterado que la suya no lista. **El
filtro es suyo; el inventario de filas es nuestro.** Si prefiere las veinte exactas, se acota.

### Del prompt del resumen de IA: los límites que le pusimos

Su estructura pide *"redactar clínicamente conectando causas entre dominios"*, y eso se conserva tal cual.
En las pruebas el modelo usó esa instrucción para escribir cosas que ningún dato respalda (*"falta de
nutrientes esenciales"*, *"deterioro celular"*). Le añadimos el límite: **cada causa y cada efecto que
conecte tiene que estar en los datos que se le dan**, sin hipótesis ("sugiere", "podría") y sin anticipar
consecuencias.

Y lo que el modelo rompía tantas veces que dejó de escribirlo, y ahora lo compone Atlas: el párrafo de
**alertas y respuestas en rojo** (dejaba fuera la alerta crítica de TCA) y el **cierre de rutas y
prioridades** (volvía a poner los códigos y a recomendar conductas, con su misma frase `_prW`). Además le
llegan ya resueltas tres lecturas que confundía: la composición contra su tabla, el ICEC con su escala (en
LE8 más alto es mejor; lo leía al revés) y la PABU con su dirección respecto de φ. Y su regla *"si el IFC y
el ángulo de fase discrepan, prevalece el IFC"* ahora llega **solo cuando discrepan**. *Si prefiere otro
criterio en cualquiera de estas, díganos cuál.*

### Donde Atlas va por delante de su archivo

Señalamos cuando un grupo nuclear queda en 0 porciones · no pisamos la lista guardada al cambiar el
objetivo, avisamos (en su HTML las porciones viven en el navegador; nosotros las persistimos) · la cadena
calórica cuadra macros, distingue calculado de ajustado y lleva candado de concurrencia · la distribución
por tiempos exige al menos un tiempo activo · y **un documento que se contradice consigo mismo no se
entrega** (la pregunta 4; es un freno, no un criterio: no decide nada clínico).

---

# LO QUE YA ESTÁ CERRADO Y NO VUELVE A APARECER AQUÍ

Para que no lo busque.

**Por sus respuestas de septiembre:** la apertura del párrafo de IA · el criterio del profesional en la HC
(*"de momento no"*) · las tres entradas de Leche semidescremada (*"queda señalado, sin tocar"*) · la
revisión ortográfica de la tabla de intercambio (hecha, dieciséis nombres, portada) · las dos preguntas de
encuesta que no llegaron en la entrega del 4 (*"no importa, ya lo tienen bien en Atlas"*) · los dos guiones
de ANI-BIS-E · el comentario encima del interruptor del LE8.

**La fila PABU, con su respuesta textual, porque un barrido nuestro ya la reabrió una vez.** El 7 de
septiembre respondió: *"Ya revisé ATLAS y está bien como lo tienen"*, con la tabla mostrando `cPABU`. Un
barrido de rótulos nuestro, el 9, la cambió a `dPABU` sin instrucción suya; se restituyó el 21 y hoy lleva
candado.

**Y las rutas al paciente, que respondió Santiago (2026-11-05).** Era la que decía *"si solo contesta una,
que sea esta"*, y se cerró por la primera de las dos salidas que le planteamos: **las rutas no van al
paciente.** Su razón es más general que la nuestra: *"el informe no puede recomendar algo que la profesional
no recomendó"*, y por eso salen también los suplementos y las remisiones. Las tres siguen donde sí son del
profesional: en la historia clínica y en la hoja del plan. **Ya está construido.** Así que la R4 deja de
estar muda, no porque le hayamos escrito sus frases, sino porque el documento del paciente ya no nombra
ningún área; si algún día quiere su redacción para el paciente, la pregunta vuelve a abrirse entera.

**Y una que salió de esta lista porque la decidimos nosotros (2026-11-05):** el ICC y el ICT. Su archivo
los recalcula desde lo que teclea el profesional; Atlas los leía del export del Biody, así que al corregir
una cintura el índice se quedaba con la anterior. **Decidido por Santiago y ya construido:** si se teclea la
cintura o la cadera, Atlas recalcula los dos con sus fórmulas (ICC = cintura / cadera, ICT = cintura /
talla); si no se teclea nada, manda el del equipo. Se lo decimos, no se lo preguntamos.

**Por la especificación 7.1.0 del 26 de octubre:** el parámetro `escalaAniosPorDE` y si la EB-BIS se
calcula sin encuesta completa.

**Antes:** el interruptor del LE8 · los tres colores de los clasificadores · las opciones de ejercicio ·
las cuatro erratas de la tabla de intercambio · los seis rótulos de los sectores · Tumaco y Cartago · el
núcleo de 66 alimentos · la caída campo por campo de `getDX` · la referencia del IFC.

**Y, con su fecha y su número para que no vuelva: las ALERGIAS.** Lo decidió el 27 de agosto, lo ejecutamos
el 28, y aun así le llegó una tercera vez. Las tablas de alérgenos, equivalencias y filtros están
retiradas (y las cinco equivalencias borradas de la base el 11-sep); no hay regla de «avena implica
gluten»; leche y lactosa son dos preguntas del paciente que no se cruzan con productos; P43 y P44 quedan
como están; «Otra» con texto se muestra sin confirmación; LUVIA está habilitada con el alérgeno de su
ficha; y el bloqueo activo con confirmación y registro **no se construye**.

**Cómo cerró el asunto del asesor legal, porque el resultado es el suyo.** Rectificó su propia
recomendación: su principio confundía **usar** el dato con **bloquear** con el dato, y un Atlas que bloquea
sobre una inferencia clínica contradice el consentimiento que los pacientes ya firmaron, donde dice que
Atlas no diagnostica y el profesional interpreta. **Sin bloqueo, sin confirmación y sin registro**, como
dijo usted. Lo único que se construye es poner las dos declaraciones juntas en pantalla, sin clasificar
ninguna ni deducir nada entre ellas. *(Y el error fue nuestro: esa nota se escribió como pendiente suyo
cuando era una decisión de CNV, y así viajó tres veces hasta su bandeja.)*

---

# DE DÓNDE SALE CADA PREGUNTA

Para cruzar este documento con los dos que lo precedieron, por si empezó a responder alguno.

| Aquí | Venía de |
|---|---|
| 0 (el aviso) | Cola del 6 de septiembre, "PRIMERO". Respondida a medias: el nombre no se envía, pero sigue sin saberse si es una persona real |
| 1, 2, 3 | Dudas del 30 de octubre, 3, 4 y 5. La 3 con las cifras de hoy |
| **4** | **Nueva del 3 de noviembre.** Sale del informe que leyó Santiago y de la nota del 24 de octubre sobre los tres textos de banda |
| 5, 6, 7 | Dudas del 30 de octubre, 6, 7 y 8 |
| **8** | Dudas del 30 de octubre, 9, **reescrita** con la objeción de estética y simetría de la Diana |
| 9 | Dudas del 30 de octubre, 15 |
| 10, 11, 12 | Dudas del 30 de octubre, 12, 10 y 11 |
| 13 | Dudas del 30 de octubre, 16 |
| 14 | Cola de septiembre, "Nueva (2026-09-21)" |
| 15, 16 | Cola de septiembre, 15 y 16 |
| 17, 18, 19, 20 | Cola de septiembre, 8, 9, 10 y 11 |
| 21, 22 | Cola de septiembre, 17 y 13 |
| 23 | Cola de septiembre, 12, **más** el §6.4 de su v12 (el rótulo se queda sin origen) |
| 24, 25, 26, 27 | Cola de septiembre, 21, 14, 19 y 20 |
| 28 | Cola de septiembre, dentro de una declaración del prompt: era una pregunta y estaba escondida |
| **29** | Cola de septiembre, bloque de declaraciones. **Sube a pregunta**: pedía respuesta y estaba donde no se pide ninguna |
| 30, 31 | Dudas del 30 de octubre, 13 y 14. La 30 con la corrección de cinco a cuatro |
| **32, 33, 34** | **Nuevas del 5 de noviembre**, de leer la v15: las versiones 13 y 14 que no nos llegaron · la reconfirmación al cierre de ruta que su §5.5 dejó pendiente · el S1 sin nutracéuticos indicados |
| **35, 36** | **Nuevas del 5 de noviembre**, y son la 15 y la 7 **con la evidencia de su v15**: el doble color de la banda central (`dIAE` azul contra `cIAE` ámbar) y el Δ en el borde exacto de ±5,0. Las dos viejas se quedan por su número; si contesta 35 y 36, aquellas quedan cerradas |
| **37** | **Nueva del 6 de noviembre**, y es de una consulta real que se quedó sin diagnóstico hoy. Se escribió primero en las Dudas del 30 de octubre, que están RETIRADAS, y con el número 19, que ya estaba ocupado por sus dos clasificadores del ICC. Corregido: ni se agregan preguntas a un documento retirado, ni se reusa un número |
| **Salieron** | Dudas 1 y 2 (respondidas en la 7.1.0) · Cola 22 (ya no aplica: preguntaba lo que respondía la fila PABU) · **la de las rutas al paciente** (Dudas 17 fundida con la Nueva del 19-sep: la respondió Santiago el 5 de noviembre, ver abajo) · **la del ICC y el ICT** (su propio texto decía que la decisión era de Santiago: la tomó él y ya está construida, ver abajo) |

**Verificado otra vez el 5 de noviembre contra la v15 y la v16**, pregunta por pregunta y citando la línea
de su archivo: el resultado está arriba, en "Lo que sus dos entregas nuevas ya contestan". De las 31, sus
dos entregas cierran una y media, confirman dos, contestan a medias dos y aportan a una; 20 siguen abiertas
sin que ninguna de las dos las toque. El cotejo completo, con lo que toca construir de cada punto suyo,
está en `docs/entregas/PLAN_V15_V16_2026-11-05.md`.

**Verificado el 4 de noviembre, pregunta por pregunta:** ninguna de las de septiembre quedó contestada por
sus entregas de octubre (revisiones de v10, v11 y v12, y los parámetros 7.1.0). Se buscó cada tema en las
cuatro: ICA-BIS, cPABU, clasifLancet, PBI, celBadges, ECM/BCM, las quince alertas, las observaciones de la
HC, los síntomas digestivos, el `cIAE`, la matriz IFC×IRC y los cortes del % de grasa no aparecen en
ninguna. Las que sí movieron sus entregas de octubre están arriba, en lo cerrado.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
