# Lo que queda abierto con usted, Gildardo

**Connected Nutrition Ventures · Atlas · 16 de noviembre de 2026**
**De:** Santiago (equipo técnico de Atlas) · **Para:** Gildardo de Jesús Uribe Gil

> **Este documento no identifica a ningún paciente.** Donde hace falta señalar un caso va el id de
> evaluación abreviado a ocho caracteres, el mismo que usted usa en su anexo A.

**Es el único documento de dudas**, y cierra todo lo científico de la v10 a la v17. Cada pregunta se
verificó contra el código o contra la base, no contra otro documento. **Cómo leerlo:** primero la **hoja
de respuesta**, una línea por pregunta abierta con sus opciones y nuestra recomendación; si con eso puede
contestar, no necesita el resto, y debajo está el detalle con el mismo número. Puede responder por número
en un solo mensaje ("37: C · 9: de acuerdo"). Los números no se reciclan, y lo marcado [aplicado] ya está
hecho: si su respuesta es otra, se cambia. **Nada de esto frena a Atlas**, salvo las tres de abajo.

## El estado, al 16 de noviembre

**Su v17 está aplicada y el histórico ya se recalculó.** Las 481 consultas que se podían recalcular
quedaron con la versión nueva; las 71 que no, tienen su motivo (34 de prueba, y de las 37
reales: 20 con la medición repetida, 13 sin fecha de nacimiento legible y 4 fuera del rango de
calibración de la EB-BIS v7).

**Y la Encuesta CNV-S está ACTIVA desde el 16 de noviembre, para todos los pacientes.** Las diez piezas
de su v15 §2 están hechas; estuvo encendida solo para pacientes de prueba desde el 8 de noviembre, y el
16, con el smoke de los tres casos pasando, Santiago la encendió para pacientes reales. **La decisión de
encenderla fue de Santiago, sin esperar su visto bueno.** Lo que acepta: si su respuesta a la **39** pide
una versión nueva del instrumento, las consultas que ya hayan aplicado la
CNV-S quedan selladas con la 1.0 y la nueva rige hacia adelante; un registro clínico sellado no se
reescribe. Cada consulta guarda qué instrumento se le mostró, sellado al abrirla.

## Si solo responde tres, que sean estas

Son las que **frenan trabajo**: construirlas exige elegir por usted. Revisado el 16 de noviembre, las
tres siguen siendo las mismas.

| | Qué se decide | Qué se desbloquea |
|---|---|---|
| **37** | Si una cintura o una cadera mal tecleada se puede corregir, y con qué datos | Hay una consulta de una paciente real sin diagnóstico por esto. Y con su respuesta se escribe la guía para las profesionales |
| **1** | Cuál Harris-Benedict manda (1919 o 1984) y sobre qué se aplica el 10 % | El motor calórico nuevo, y con él el flujo guiado del nutricionista |
| **2** | Los rangos del control de calidad biológico | El control de calidad entra (sus once identidades imposibles ya están) |

## Un pedido, no una pregunta: sus 94 pacientes

En su lista de Atlas hay 95 pacientes suyos sin marcar como de prueba, y el criterio automático (un
documento imposible, o un nombre que se dice de prueba) señala uno solo. Los otros 94 no se distinguen
desde aquí: tienen nombre y documento verosímiles, y varios son familiares suyos.

**Lo que le pedimos:** entre a su lista de pacientes en Atlas y díganos cuáles son suyos de prueba. No
hace falta que los marque usted. **Por qué importa:** un paciente de prueba sin marcar entra en la
cohorte de investigación, cuenta en /obbia y recibe los mismos avisos que uno real. Hoy hay 30 avisos
ámbar que son de pacientes de prueba, y ocupan el sitio de los que sí hay que mirar.

*La lista con nombres y documentos está en `dudas/`, fuera del repositorio: aquí solo van los conteos.*

## Lo que su v17 movió en la cohorte (informativo: no hay nada que responder)

Medido sobre las 532 consultas vigentes con informe, en la simulación del 15 de noviembre que autorizó
la operación. **Ya se recalculó, el 16 de noviembre.**

| Lo que cambia | Consultas | De la cohorte |
| --- | --- | --- |
| El nivel de riesgo (bajo / medio / alto / crítico) | 183 | 34,4 % |
| El sector de la Diana (sus cortes MCCB de la Tabla 10.2) | 325 | 61,1 % |
| La ruta R2 | 108 entran · 80 salen |  |
| Los nutracéuticos sugeridos | 75 | 14,1 % |
| El IEHH cambia de zona (sus tres de la Tabla 8.2) | 170 de 524 | 32,4 % |

**Lo único que hay que saber leyendo esto:** no es un ajuste de bordes, es una recalibración, y por eso
el histórico se reemitió una sola vez y con la simulación delante. **Nada de lo prescrito se tocó.**

## Lo que ya está contestado, y con qué

Lo que cerraron sus entregas y lo que cerraron los hechos. Las que siguen abiertas están más abajo.

| # | Tema | Con qué se cerró |
|---|---|---|
| **5** | "Edad biológica estimada" | Su tabla 3 y su v15 la mantienen. Es lo que Atlas aplicó |
| **17** | La fila ICA-BIS con dos reglas por superficie | Su v17 §4: `dICA` ya no existe y las dos superficies leen `cPABU` |
| **35** | Los dos colores de "Acorde con sus pares" | Absorbida en la **15** |
| **36** | El Δ en el borde de ±5,0 | Absorbida en la **7** |
| **38** | La R1 se activa por un criterio y su tarjeta anuncia otro | Su §10 retira `activar`, deja de evaluar `condicion` y reescribe los seis rótulos. Los seis portados. Sobre la cohorte ya recalculada la R1 entra en **256 de 482 (53,1 %)**: conviene que eso sea una decisión y no un efecto |
| **43** | "Lo suspendió" en el S1 | Aplicada la A el 9 de noviembre: cuenta como no adherencia, y el motivo queda en el S2 |
| **51** | Qué pasa cuando falta la cintura | Su propio código responde A: `_cint` cae a 0 y el modificador no suma. Construido así |
| **4** (1ª mitad) | El DFI y las rutas leen el IAE de la v7 | Su v15 §1.4. Aplicado, con el histórico recalculado |
| **31** (1ª mitad) | Menor de 18 o edad no válida | Devuelve "pendiente" y no se calcula (su error 7) |

**Y dos cosas que le decimos, no se las preguntamos:** la §6 de su v16 pide separar carnes rojas de
embutidos, y en Atlas ya están los 15 grupos en las cinco versiones publicadas de la encuesta (633 de 634
traen el grupo 15); y su §7 acierta en el diagnóstico pero ya no en el estado, porque el componente
Alimentación del ICEC se corrigió el 6 de septiembre por su propia instrucción.

## Las 50 preguntas abiertas (siete solo piden confirmar lo que ya está aplicado)

Una línea por pregunta; el detalle de cada una está debajo, con el mismo número.

> **Diez de ellas son la misma cosa, y conviene leerlo antes:** ninguna es un desacuerdo entre su archivo
> y Atlas. **Son dos sitios de SU PROPIO archivo diciendo cosas distintas sobre el mismo número**, o una
> pieza que su archivo declara y nadie conecta. Por eso su v17 no las cerró (concilia con el libro, y el
> libro no habla de colores de celda), **y por eso son baratas: cada una es elegir entre dos cosas que
> usted ya escribió.** Son la **7**, **14**, **15**, **16**, **18**, **19**, **20**, **21**, **22** y
> **46**. La **2** se les parece y no es igual: ahí falta un criterio que nunca se escribió.

| # | Tema | Opciones | Recomendamos |
|---|---|---|---|
| **0** | El ejemplo de su prompt de IA lleva el nombre de una persona y viaja al proveedor en cada llamada | ¿Es real? | Reemplazarlo por `[NOMBRE]` en su copia |
| **37** | Una cadera mal tecleada: ¿se repite la toma o se corrige? | A) repetir · B) corregir en Atlas · C) corregir en el Biody y reemplazar | **C**, y ya está construida |
| **37a** | Al editar en el Biody Manager, ¿el programa recalcula algo? | Respuesta libre | Solo usted puede saberlo |
| **37b** | ¿Qué se puede editar: solo cintura y cadera, o también el peso? | Respuesta libre | **Solo cintura y cadera** |
| **1** | Cuál Harris-Benedict manda y sobre qué va el 10 % | 1919 · 1984 | **1984**, y el 10 % sobre TMB × actividad |
| **2** | Los cortes del control de calidad biológico | Respuesta libre | Que el corte que FRENA caiga fuera del mínimo y del máximo observados |
| **3** | El estado de las consultas que el recálculo no puede tocar | ¿permanente? | Confirmar que sirve como estado permanente |
| **4** | Sus tres textos por banda del IAE, ¿sustituyen al de trayectoria o conviven? | sustituir · convivir | **Convivir**, con media línea suya que lo diga |
| **6** | El Δ del IAE dentro de la banda: raya o cero [aplicado] | raya · cero | **La raya**, pero es preferencia nuestra contra su regla |
| **7** | El borde de ±5,0 del IAE, en tres sitios de su archivo | A) todo cerrado · B) el Δ abierto con raya y el resto cerrado · C) otra | **B** |
| **8** | Los tres cortes de color de la Diana | 1) correr el gradiente · 2) tres sólidos · 3) otra | **Correr el gradiente hacia el rojo** |
| **9** | Los nombres llanos de tres índices [aplicado] | Respuesta libre | Dejar "Desviación bioeléctrica" |
| **10** | Quién ejecuta la eliminación de un perfil [aplicado] | dirección · administrador | **Administrador** |
| **11** | El aviso de realimentación sale del motor viejo | se queda · pasa al nuevo | Díganos cuál; es una línea |
| **12** | La fuerza prensil obligatoria, con salida | Respuesta libre | Obligatoria con salida registrada ("no se midió" más motivo) |
| **13** | Los cinco textos de dominio del informe [propuesto] | Respuesta libre | Que los escriba usted |
| **14** | Su banda media del IFC y del IRC tiene tres nombres, y uno dice "normal" | Respuesta libre | Texto suyo. Y decidir si la banda media cuenta como índice alterado |
| **15** | El IAE "Concordante" en ámbar y en azul | A) azul · B) ámbar · C) distintos a propósito | **A** |
| **16** | La casilla 3_3 de su matriz IFC×IRC lleva un cian | Respuesta libre | ¿Lo cambia, o el cian significa algo? |
| **18** | El % de grasa con dos cortes suyos | HC · composición | ¿Cuál manda en la historia clínica? |
| **19** | Dos clasificadores del índice cintura-cadera | `dICC` · `clasifICC` | ¿Cuál manda? El segundo dice más |
| **20** | `clasifLancet` declarado y sin llamar | resto · lo va a usar | ¿Cuál de las dos? |
| **21** | Las badges del Nivel III y el ECM/BCM sin fila | Respuesta libre | ¿El ECM/BCM debe verse, con qué corte y en qué fila? |
| **22** | El estado PBI y su tercer umbral de ángulo de fase | 6,80/6,30 · 6,5/6,0 | Si el PBI vuelve, cuál de los dos manda |
| **23** | La fórmula sintética: lista plana o cuenta, y cómo se llama | Respuesta libre | Díganos cuál quiere, y el nombre del bloque |
| **46** | Sus dos hidrataciones, 71 % contra 73 % | A) sube el piso · B) baja el piso · C) la tabla dice que son distintas · D) sale una fila | **C** |
| **24** | Diez de sus quince alertas no pueden salir nunca | 1) como está · 2) retirar las diez · 3) capturar porciones | Díganos cuál; ninguna la tomamos por nuestra cuenta |
| **25** | ¿Qué más debería alimentar al generador de menús? | acceso · tiempos de comida | ¿Alguno de los dos? |
| **26** | Sus pasos 1 a 3 del Análisis IA no llegan al paso 4 | cablear · dejar | ¿Debían alimentar al cuarto? |
| **27** | En la HC, ¿van todas las observaciones o solo la vigente? | todas · la vigente | **Todas**, y la objeción es nuestra también |
| **28** | ¿En qué dominio van los síntomas digestivos? | Respuesta libre | Hoy no se usan como evidencia de ninguno |
| **29** | La pregunta de amputación se queda y usted no la nombró | retirar · dejar | ¿La retiramos también? |
| **30** | Dos ids de su anexo A son data de prueba | Respuesta libre | Retírelos de su lista de errores 1 y 2 |
| **31** | Los pacientes pediátricos | Respuesta libre | Marcar fuera de rango de calibración y no calcular |
| **32** | ¿Qué pasó con las versiones 13 y 14? | A) v15 y v16 lo recogen · B) falta algo | **A** (es una confirmación) |
| **33** | La reconfirmación al cierre de una ruta [aplicado: A] | A) solo la anual · B) completa · C) solo esa ruta | **A** |
| **34** | El S1 cuando no hay nutracéuticos indicados [aplicado: A] | A) S1 y S2 no se presentan · B) con una línea · C) otra | **A**, y ya corre con el Módulo S |
| **39** | El marco de referencia: ¿presentación o instrumento? | A) presentación · B) instrumento (versiona) | **A**. Si contesta B, se hace |
| **40** | Los menores fuera de la cohorte [aplicado] | A) fuera, marcados · B) dentro · C) otra | **A** |
| **41** | Las 140 sin diagnóstico | A) se quedan · B) solo con medición · C) marcadas | **A con la marca de C** |
| **42** | La CNV-S si la primera consulta no tiene encuesta completa | A) encuesta completa otra vez · B) CNV-S con lo abierto · C) otra | **B para los ocho de confirmación y A para los cuatro retirados** |
| **44** | La reconfirmación anual cuando la línea base viene del HTML | A) la fecha importada · B) no hay confirmación · C) otra | **B** |
| **45** | `d7_agua` no está en su tabla 3 | A) repetir · B) confirmar · C) retirar | **A** |
| **47** | ¿El S1 pregunta por lo que el paciente compró por fuera? | A) como está · B) ítem nuevo · C) la profesional añade | **A** para el cálculo y **B** como ítem nuevo |
| **48** | El IEHH y el ISCM-BIS ya informados dejan de ser comparables | A) solo el nuevo · B) los dos · C) con aviso de recalibración | **C** |
| **49** | El ISCM-BIS sin lectura, ¿también al paciente? | A) con percentil · B) solo al profesional · C) retirar | **B** |
| **50** | La serie se parte donde el histórico no se puede recalcular | A) la tarjeta no aparece · B) aparece diciendo por qué | **B** |
| **52** | Sus nueve fenotipos del sector frente a los doce de Atlas | A) los nueve · B) conviven · C) se retiran los doce | **B** |
| **53** | El orden de prioridad de las rutas, que su §10 nombra y no escribe | A) el de `computeDFI` · B) con la R3 primera · C) otro | **B** |
| **54** | Qué cortes de FMI y FFMI lee el profesional [aplicado: B] | A) `cFMI`/`cFFMI` · B) los del libro · C) los dos | **B** |
| **55** | Su caso K dice "sin sexo no se clasifica" y el DFI lo vuelve femenino | A) vale el caso K · B) vale el código · C) otra | **A**, y no la aplicamos porque toca su código |
| **56** | Las indicaciones y las urgencias condicionales de las remisiones | A) resolver las tres evaluables y contar el resto · B) como hoy · C) otra | **A** |

# EL DETALLE DE CADA PREGUNTA

Con el mismo número de arriba. No hace falta leerlo para contestar: está para las que quiera mirar despacio.

## 0 · El ejemplo de su prompt lleva el nombre de una persona, y viaja al proveedor de IA

En el prompt del Análisis IA de su archivo, el ejemplo de formato de salida lleva un nombre propio y una
edad, y viaja al proveedor del modelo **en cada llamada**, junto a los datos del paciente que se esté
analizando. **En Atlas el nombre no se envía:** usted nos respondió en septiembre que no debía ir. Lo que
sigue sin respuesta es la pregunta de fondo: **¿es una persona real?** Si lo es, hay un dato personal
saliendo de su archivo cada vez que alguien usa su prototipo.

**Y el ejemplo sigue en su archivo**, verificado en la entrega de octubre. *Recomendamos reemplazarlo por
un marcador (`[NOMBRE]`) en su copia: es un cambio de una palabra y cierra el asunto.*

# A · LAS QUE FRENAN TRABAJO

Sin su respuesta no se construyen, y no es una forma de decir que son importantes: construirlas exige
elegir por usted.

## 37 · Una cadera mal tecleada: ¿se repite la toma, o Atlas deja corregirla? [FRENA UNA CONSULTA REAL]

**El caso, del 6 de noviembre.** Una profesional escribió **1020** en la cadera. Atlas frenó la
importación, que es lo correcto, pero no había forma de corregir ese número sin volver a tomar la
bioimpedancia, y la paciente ya se había ido: la consulta quedó sin diagnóstico. **Lo que medimos antes
de preguntarle:** en el archivo del Biody Manager **no hay nada derivado** de cintura ni de cadera (las
117 columnas las traen como datos hoja), pero en **Atlas sí**, porque el ICC (cintura/cadera) es uno de
los seis disparadores de la ruta R2 y con la cadera en 1020 da 0,08, así que el disparador quedaría
apagado sin que nadie lo notara. Por eso el freno acertó.

 · **A)** Siempre se repite la toma. · **B)** Atlas deja corregir cintura y cadera después de importar,
 con motivo y guardando el original (el Biody se queda con el dato viejo). · **C)** Se corrige en el
 Biody Manager, se reexporta, y en Atlas se reemplaza la medición con motivo.
*Recomendamos **C**. Santiago verificó el 7 de noviembre que el Biody Manager sí deja editar cintura,
cadera y peso de una medición ya tomada, sin volver a medir, así que la B deja de hacer falta. **Y la C
ya está construida:** un archivo reexportado trae las mismas lecturas eléctricas, así que el freno de
huella repetida lo reconoce, y desde el 5 de noviembre avisa, pide motivo y deja seguir.*

**37a · Al editar en el Biody Manager, ¿el programa recalcula algo?** Si rehace algún indicador propio,
el archivo reexportado no es el mismo con un número cambiado: es otra medición. No cambia la C; cambia
**qué se le dice a la profesional**. Desde Atlas no se puede saber.

**37b · ¿Solo cintura y cadera, o también el peso?** *Recomendamos **solo cintura y cadera**: se teclean
a mano con una cinta, así que corregirlas devuelve el dato que se midió. El peso entra en la composición
(masa grasa, masa libre de grasa, FMI, FFMI, el fenotipo, el dominio 2 y toda la cadena calórica), así
que cambiarlo no corrige un número: recalcula la medición entera, y ya no se sabe si lo que queda es lo
que el equipo midió ese día.*

## 1 · ¿Cuál Harris-Benedict manda, y sobre qué se aplica el 10 %?

Su v12 §6.1 prescribe Harris-Benedict sobre el peso meta más 10 % de termogénesis, y usted mismo marcó
dos precisiones por confirmar: que `gebHarris` trae los coeficientes de **1984** (88,362 / 447,593) y no
los de **1919**, y que el 10 % se aplica sobre TMB × actividad. **Y un detalle que conviene que sepa:**
Atlas ya tiene la de 1919 portada desde el 2 de septiembre, como respaldo del basal medido, así que
adoptar la de 1984 deja dos vivos, cada uno en su sitio. No es un problema, pero tiene que ser una
decisión y no un accidente.
*Recomendamos la de **1984** para la prescripción (es la que usted portó) y el 10 % sobre TMB × actividad
(es lo que su código hace), dejando la de 1919 solo donde ya está. El cambio mueve el objetivo calórico
de toda la cohorte (+301 kcal/día en su propio ejemplo verificado), así que entra con bump del motor y
golden tests, o no entra.*

**Y arrastra una pieza entera:** el flujo guiado de seis pasos del nutricionista (su v12 §6.2) empieza
por las cifras del motor calórico, así que mientras esto no se decida, ese flujo tampoco se construye.

## 2 · Los cortes del control de calidad biológico, con una advertencia de método

Sus once identidades imposibles están construidas y no dependen de ningún umbral. Faltan los **rangos**
(`QC_BIO_LIMITES`), y sus límites provisionales, sobre la cohorte limpia (352 mediciones), **rechazarían
cinco mediciones reales**.

| variable | mín real | p0,5 | p99,5 | máx real | su límite | ¿rechaza? |
|---|---|---|---|---|---|---|
| peso (kg) | **22** | 42,59 | 122,81 | 134 | 25-300 | sí: 1 |
| C (nF) | 0,54 | 0,67 | 4 | **16,22** | 0,3-10 | sí: 1 |
| Fo (kHz) | **4,84** | 24,9 | 60,74 | 66,41 | 10-150 | sí: 1 |
| grasa (%) | **-15,6** | 7,05 | 44,57 | 45,77 | 2-70 | sí: 2 |
| talla, IMC, cintura, cadera, Re, Ri, R∞, AF, hidratación, prensil | | | | | | no |

**La advertencia de método, suya de decidir y nuestra de decir:** adoptar p0,5 y p99,5 como cortes duros
rechaza por construcción cerca del 1 % de las mediciones reales, y para un filtro que existe para atrapar
un error de digitación eso es al revés. *Recomendamos que la banda de percentiles sirva para decir "mire
esta medición" y que **el corte que FRENA caiga fuera del mínimo y del máximo reales observados**: es la
regla que ya aplicamos desde el caso de la capacitancia de 16,22 nF, que con su rango 0,3-10 volvería a
quedar fuera y ya dejó una vez a una paciente sin diagnóstico. Y para su lista de imposibles: "masa grasa
o porcentaje de grasa ≤ 0".*

# B · LAS QUE ESTÁN APLICADAS Y NECESITAN SU CONFIRMACIÓN

## 3 · Las consultas que quedan fuera del recálculo [contestada por los hechos]

Su §5 pedía recalcular el histórico, y la lista no podía ser "todas". El recálculo de la v17 se ejecutó
el **16 de noviembre**: 481 consultas quedaron con la versión nueva, y lo que queda es confirmar el
estado en que quedaron las que no se pudieron tocar (71, medidas después de ejecutar):

| Motivo | Cuántas | ¿Tiene salida? |
|---|---|---|
| Paciente de prueba | 34 | No hace falta: no se reemiten a propósito |
| Medición repetida en otra consulta vigente | 20 | Sí: resolver de quién es la toma, y entran solas |
| Sin fecha de nacimiento legible | 13 | Sí: registrarla, y se reemiten por el flujo normal |
| Fuera de 18 a 100 años al medirse | 4 | No: la EB-BIS v7 no se calibró ahí |

**En qué estado quedaron, que es lo que se confirma:** dentro de la cohorte de investigación y marcadas
con su versión de motor sellada; /obbia las agrupa por familia mayor y avisa cuando la cohorte mezcla
dos. **Lo que confirmamos con usted** es solo que le sirve como estado **permanente** para las que nunca
se resuelvan; la alternativa sería recalcularlas a la fuerza con un dato que puede no ser del paciente.

## 4 · Su segunda mitad: los tres textos por banda del IAE [la primera mitad, aplicada]

**La primera mitad está contestada y aplicada, y el histórico recalculado.** Era la más importante: el
camino que calculaba la cifra del paciente se había migrado a la v7 y el que alimentaba el dominio 3, el
riesgo integrado y las rutas se había quedado en la v5, así que en la misma consulta convivían dos edades
biológicas, la que se le dice al paciente y la que decide lo que se le prescribe. Su v15 lo decide
(`computeDFIFromData` L11834 · `atlasMigrarEbV7` L4458 · dominio 3 L13965 · §1.4), se aplicó el 6 de
noviembre y el 7 se recalcularon las 422 consultas.

**El caso que lo hizo visible era suyo** (`ed83ff97`, la mujer de 64 años de su anexo A): la cifra que
ella ve nunca estuvo mal (76,4 años · IAE +12,4), pero el dominio 3 leía 31,4 años con IAE -32,6 y
"Enlentecido", y su pestaña de Tratamiento traía **cero rutas activas** donde hoy trae R1 y R4.
Cuarenta y cinco años de diferencia dentro de una consulta, y a esa paciente no se le había prescrito
nada para el envejecimiento. Eran 43 informes así y 17 en el contrario, de 389, y ninguno de los 60 se
había enviado porque el freno de la contradicción los retenía.

**Lo que sigue abierto es la segunda mitad, y no frena nada.** Su tabla 3 define tres textos por banda de
±5, y el texto que el paciente lee en seguimiento va por la **trayectoria**, no por el nivel del IAE. Son
dos cosas distintas y las dos son suyas; hoy conviven, así que un paciente puede leer "acorde con sus
pares" junto a "evolución favorable", que no se contradicen pero tampoco se explican solos.
*Recomendamos que **convivan**, porque dicen cosas distintas: una es el estado de esta consulta y la otra
el cambio entre dos. Pero si conviven conviene que el documento lo diga en media línea, y esa media línea
es texto suyo.*

## 6 · El Δ del IAE dentro de la banda: lo cambiamos nosotros, contra su regla [aplicado]

Su entrega del 1 de septiembre §5 define el Δ del IAE como "la distancia al límite del rango que se
cruzó, y **cero** mientras esté dentro de -5 a +5". El cero es suyo.

**Lo cambiamos a una raya dentro de la banda, y la razón es propia de esa fila:** el IAE ya es una
diferencia, así que la fila ponía dos números con signo uno al lado del otro ("+3,5" en Valor y "0,0" en
Δ). Conservamos la otra mitad de su regla: cuando sí cruzó, el Δ da la distancia al límite.
*Recomendamos dejar la raya. **Pero es preferencia nuestra contra su regla escrita, así que dígalo:**
¿está de acuerdo, o vuelve el cero? Es una celda que ya se movió tres veces y conviene cerrarla.*

## 7 · El borde exacto de ±5,0 del IAE [parcial: Atlas cerró la banda y las rutas en el motor 3.2.0; siguen abiertos el Δ y los dos sitios del protocolo] *(absorbe la 36)*

**Lo que YA está cerrado.** El motor 3.2.0 de Atlas (7 de noviembre) cerró el borde en los cuatro sitios
que dependían de nosotros: lo que el paciente lee, la clasificación del profesional (`cIAE`) y las
condiciones de R1 y R4. Salió de la simulación del recálculo, que dejó dos consultas frenadas con el IAE
en +5,0 exacto: el informe decía "envejecimiento acelerado estimado", la tabla "Acorde con sus pares" y
el tratamiento no traía la ruta. Las tres piezas se re-portaron byte a byte de su v16.

**Lo que sigue abierto es suyo.** Cotejado contra su `ATLAS_v17.html` el 16 de noviembre, dos sitios del
protocolo siguen con el corte **abierto**, más el Δ de su línea 15628:

| Dónde | Lo que dice su v17 | Con IAE = +5,0 exacto |
| --- | --- | --- |
| La síntesis del envejecimiento (L13811) | `iae >= 5` | **entra** |
| El protocolo de telómeros / estrés oxidativo (L17204) | `iae > 5` | no entra |
| La Coenzima Q10 (L17211) | `iae > 5` | no entra |

Así que, con un IAE de exactamente +5,0, su archivo **nombra el envejecimiento acelerado en la síntesis y
no prescribe la Coenzima Q10 que esa misma lectura justifica**. Atlas lo porta byte a byte
(`frozen/atlas-protocolo.js` L108 y L115). Y el Δ de su L15628 sigue imprimiendo "0,0" dentro de la
banda, que es la pregunta 6.

 · **A)** Todo pasa a cerrado (`>= 5`), incluidos el Δ y el nutracéutico. · **B)** El Δ se queda abierto
 y en el borde muestra la raya, y el nutracéutico y el protocolo pasan a cerrado. · **C)** Otra cosa.
*Recomendamos **B**: en la misma consulta no pueden regir dos cortes para la misma cifra, así que el
nutracéutico y el protocolo se cierran; y el Δ se queda con la raya por la razón de la 6. Lo que no puede
quedarse es el reparto de hoy, que es dos contra uno.*

## 8 · Los tres cortes de la Diana, y una objeción de estética que no habíamos dicho

El defecto que su v12 corrige ("los estados leves caían en verde lima y se leían como bien") está en
Atlas igual, y por la misma causa: es el gradiente de su propia `rc()`, portado verbatim. Su v12 propone
pasar a tres colores sólidos con cortes en 0,19 · 0,45 · 0,62. **Y aquí está lo que no le habíamos dicho,
y es de Santiago:** pasar a sólidos daña la estética y la simetría de la Diana. El gradiente no es solo
decoración: es lo que hace que la figura se lea como una superficie continua, y tres bandas sólidas la
parten en anillos. La Diana es, además, la pieza que más se mira de todo el sistema.

**El problema que usted señala es real y no lo discutimos:** un estado leve pintado de verde lima se lee
como "está bien", y eso es un veredicto clínico mal dicho. Lo que preguntamos es si hay una salida que
arregle la lectura **sin** perder la superficie continua: **1)** correr el gradiente hacia el rojo,
quitándole el verde lima a la zona leve, sin cortes duros · **2)** los tres colores sólidos de su v12,
tal cual · **3)** otra salida que usted vea.

**Y con la respuesta tiene que venir si el radar de cinco dominios y las tarjetas del DFI se igualan a
la Diana o se quedan como están.** En Atlas son los mismos tokens clínicos, así que si se igualan, se
igualan en todas las superficies a la vez. Los números no los podemos elegir nosotros.

## 9 · Los nombres llanos de tres de sus índices [aplicado]

En la tabla ANI-BIS-E de la historia clínica, tres filas se nombraban con el rótulo técnico de su tabla.
Santiago: *"propongo que los cambiemos a definiciones que los pacientes puedan entender y justo debajo la
sigla... no estamos cambiando los indicadores, solo la forma en como mostramos la info."* El IEHH pasó de
"Hidro-Homeostasis" a **Equilibrio hídrico**, el PABU (que no tenía nombre) a **Proporción
bioeléctrica** y el ICA-BIS de "Desviación de φ" a **Desviación bioeléctrica**. Sus nombres oficiales no
se tocan: siguen en el registro de indicadores y en la pantalla del profesional, al lado del llano.

**Y en la tercera nos apartamos de lo que se nos pidió.** Se propuso "Coherencia bioeléctrica": el número
que va al lado es una desviación, así que cuanto más pequeño mejor, y rotular "coherencia" encima de un
valor donde lo bueno es lo bajo invierte la lectura. *Recomendamos dejar "Desviación bioeléctrica". Si
prefiere "Coherencia", habría que mostrar el complemento o la clasificación en vez de la cifra.*

## 10 · "La dirección científica" que elimina un perfil: en Atlas ese rol no ve pacientes [aplicado]

Su v12 §1.2 pide que eliminar un perfil tenga política, "solo para el profesional dueño del paciente y
para la dirección científica". Está construido, con la asimetría de esta clase de acto: el profesional
pide con motivo y otro ejecuta.

"Dirección científica" es su palabra, textual de su v12 §1.2. La traducción que sigue es nuestra: quien
ejecuta es el **administrador**, porque en Atlas `direccion` no accede a datos de paciente por diseño y
esta bandeja necesita el nombre y el documento para poder decidir.
*Recomendamos dejarlo en administrador. Si quiere que sea literalmente la dirección científica, lo
primero que hay que decidir es si ese rol pasa a ver datos de paciente, que es un cambio mucho mayor.*

## 11 · El aviso de síndrome de realimentación sale del motor viejo

Usted lo anotó en su v12 §8.2 y no lo corrigió: *"el aviso lo emite `motorProtocolo`, el motor viejo, no
`motorTratNutri`. Dos motores opinando sobre el mismo paciente."* **Verificado en Atlas: está
idéntico.** `alertaSindRealim` sale de `atlas-protocolo.authorized.js` con la condición
`['F7','F10'].includes(fenotipo) && GEB < 1200 && IMC < 18.5`, y es porte fiel.

*Díganos si la condición se queda tal cual o si el aviso pasa al motor nuevo con otra condición. Cuando
lo decida, es una línea.*

## 12 · La fuerza prensil obligatoria, con salida

La dinamometría es el criterio **primario** del EWGSOP2 y hoy Atlas la pide sin alternativa: si no está,
la tarjeta de sarcopenia avisa y ahí termina. Muchas consultas no tienen dinamómetro a mano, y el dato lo
confirma: hoy la traen 92 de 492 (18,7 %).
*Recomendamos hacerla obligatoria **con una salida registrada**: "no se midió" más el motivo, que es el
patrón que este repositorio ya usa para los frenos sin alternativa. Lo tiene que aprobar usted porque
cambia la captura, y porque un "no se midió" con motivo es un dato clínico, no un campo administrativo.*

# C · LOS TEXTOS Y LOS COLORES QUE SOLO PUEDE ESCRIBIR USTED

## 13 · Los cinco textos de dominio del informe, en lenguaje sencillo [propuesto, NO aplicado]

La hoja 2 del informe trae sus cinco lecturas del DFI tal cual. No lo hemos tocado, y es a propósito: son
textos clínicos suyos. Lo que sigue es una propuesta.

| Dominio | Lo que dice hoy | Propuesta |
|---|---|---|
| Celular-Eléctrico | Homeostasis celular: membranas íntegras y microambiente equilibrado | Tus células están bien hidratadas y sus membranas en buen estado |
| Metabólico-Estructural | Perfil metabólico-estructural favorable | Tu músculo y tu grasa están en una proporción favorable |
| Envejecimiento | Envejecimiento biológico marcadamente acelerado | Tu cuerpo se está desgastando más rápido de lo que corresponde a tu edad |
| Conductual-Perceptual | Relación con el cuerpo y la comida sin alertas | Tu relación con la comida y con tu cuerpo no muestra señales de alarma |
| Epigenético-Contextual | Carga contextual amplificada por antecedentes o entorno | Tus antecedentes familiares y tu entorno te suman riesgo |

*Recomendamos que las escriba o las corrija usted: el informe llevaría las suyas para el paciente y las
de hoy para el profesional. Lo que no nos parece correcto es que las cambiemos nosotros.*

## 14 · Su banda media del IFC y del IRC tiene tres nombres, y uno dice "normal"

**Qué pasó.** Una integrante vio, en la misma paciente (mujer, IFC 2,11, IRC 2,79), que la tabla decía
"Disfunción celular establecida" y el párrafo del análisis "una función celular en rango normal con
riesgo celular en rango normal". **Lo que era nuestro ya está corregido:** la tabla reclasificaba el IFC
con 3,5/6,0, los cortes históricos únicos que su prompt prohíbe expresamente.

**Lo que es suyo.** Su archivo llama a la misma banda media de tres maneras: sus clasificadores `cIFC` y
`cIRC` la llaman "Alerta funcional" y "Riesgo moderado"; su `idx` interno del DFI la llama "Normal"; y su
párrafo `_seg1` escribe "en rango normal". No hay error de clasificación, es la misma banda en los tres;
pero quien lee "Riesgo moderado" en una línea y "en rango normal" dos párrafos más abajo entiende que el
sistema se contradice, y fue lo que pasó.

**Y su v17 lo dice en la MISMA función, tres líneas más arriba.** El comentario que encabeza su `cIRC`
escribe *"M: Bajo <2,3 · Normal 2,3-2,8 · Alto >2,8"* y el código, tres líneas más abajo, rotula esa
misma banda "Riesgo moderado" en ámbar. **Y ahora tiene una consecuencia que se ve en un documento
probatorio:** Santiago lo reportó el 16 de noviembre sobre una consulta reemitida, una mujer con IRC
**2,71**, dentro de su banda central, que sale listada en "Índices ANI-BIS-E alterados" de la historia
clínica porque el ámbar de su clasificador vale como alteración. **Atlas no lo cambia por su cuenta**
(Regla 0); lo que sí se arregló fue que esa fila llevaba la severidad del corte masculino, defecto
nuestro y ya cerrado.

**Y dos cortes más del mismo tema, los dos sin sexo.** El criterio de egreso de su R1 dice "IFC ≥ 4.5 y
IRC < 3.5 sostenido 2 controles", y para una mujer su corte superior del IFC es 3,28: con ese criterio
**no sale nunca** de la ruta aunque su función celular sea óptima. Y su indicación de remisión
"Valoración médica si IRC > 5.0" también es un corte único. **Su v17 ya dio cortes y alertas por sexo**
(Tablas 6.1 y 7.3), así que la pregunta es si las indicaciones y los criterios de egreso de las rutas los
adoptan.
**La pregunta:** para la banda media, ¿qué debe decir su párrafo? ¿La banda media del IRC cuenta como
índice alterado en la historia clínica, o solo las dos colas? ¿Y los cortes de las rutas pasan a ser por
sexo? El texto es suyo y se pone verbatim.

## 15 · Su clasificador del IAE pinta "Concordante" en ámbar *(absorbe la 35)*

**Lo preguntó usted:** *"si es concordante, ¿no debería estar en verde?"* Sí, y el ámbar sale de su
archivo: su `cIAE` pinta "Desacelerado" en verde, "Concordante" en ámbar `#f59e0b` y "Acelerado" en
rojo, y Atlas no escribe severidades a mano, lee el color que emite su clasificador. **Por qué pasó, y no
tiene nada de descuido:** el IAE es su único clasificador de dos colas, lo bueno está en el centro, y
sobre una rampa verde-ámbar-rojo al centro le tocó el de en medio.

**Y en la misma banda tiene DOS colores suyos**, verificado en su v17: `cIAE` ámbar (L4658), `dIAE` azul
(L15655).

**Tiene una consecuencia que se ve en el documento:** como el ámbar cuenta como alteración, un hombre
reemitido con IAE 0,0, que es su "acorde con sus pares", sale listado entre los *índices alterados* de la
historia clínica y del SOAP. Con la **A** eso desaparece solo.

 · **A)** Manda el azul: la banda central es lo esperado, no una alerta. · **B)** Manda el ámbar.
 · **C)** Son distintos a propósito, y díganos cuál va en cuál.
*Recomendamos **A**, que es lo que su `dIAE` nuevo hace: en una rampa de dos colas, pintar de ámbar lo
que está bien invierte la lectura.*

## 16 · Y hay una casilla más de su matriz IFC×IRC con el mismo problema de color

En `FYR_LABELS`, la casilla **3_3** (IFC alto, IRC alto) se llama "Función normal con riesgo" y lleva un
cian, `#22d3ee` (verificado en su v17, L5389). Nuestra regla lo lee como óptimo: la peor casilla de esa
fila con el color de la mejor.

**Hoy no tiene consecuencia en Atlas:** el motor se queda con la etiqueta y descarta ese color. Se lo
decimos porque en su archivo sí se ve, y es la misma forma que el ámbar del IAE. **¿Lo cambia, o el cian
significa algo que no estamos leyendo?**

# D · DOS REGLAS SUYAS PARA LO MISMO (necesita mirar su archivo)

Las siete no son diferencias entre su archivo y Atlas, sino **entre dos sitios de su propio archivo**; en
cada una portamos una de las dos y le decimos cuál. Todas se verificaron contra su `ATLAS_v17.html` el 12
y el 16 de noviembre, y todas **siguen como estaban**.

## 18 · Su historia clínica y su tabla de composición clasifican el % de grasa con cortes distintos

| Dónde | Referencia | Con 22,4 % en un hombre |
|---|---|---|
| Tabla de la historia clínica (L16751) | déficit < 8 · normal < 20 · límite < 25 · obesidad ≥ 25 | "Límite" |
| Tabla de composición (L15669) | 10-22 % en hombres, 10-32 en mujeres | "Sobrepeso adiposo" |

Mismo paciente, mismo número, dos veredictos. **Atlas usa hoy el segundo**, porque es el borde que nos
confirmó el 18 de agosto. **¿Cuál manda en la historia clínica?** Si es el de su tabla de la HC, lo
portamos tal cual; si es el que nos dio en agosto, su HC quedó con el criterio viejo.

## 19 · Tiene dos clasificadores del índice cintura-cadera, con etiquetas distintas

Los mismos cortes (0,90 en hombre, 0,85 en mujer) y distinta redacción: `dICC` (L15633) dice "Normal" /
"Riesgo cardiovascular" y `clasifICC` (L8878) dice "Riesgo bajo" / "Riesgo alto, distribución central".
**En Atlas no tiene consecuencia visible:** portamos solo `dICC`, byte a byte. **¿Cuál manda?** La
segunda dice más ("distribución central" explica por qué es riesgo), así que la nuestra puede quedarse
corta.

## 20 · `clasifLancet` está declarado en su archivo y nadie lo llama, ni usted

Es un clasificador de cuatro niveles que cruza IMC con masa grasa y masa magra, rotulado "Propuesta The
Lancet 2025". Está completo, con sus etiquetas y sus colores, y en su archivo aparece una sola vez: la
declaración (L8891); ha sobrevivido dos entregas más. **No lo portamos**, y no por pereza: conectar una
pieza que su propio archivo no conecta sería estrenar una clasificación clínica por nuestra cuenta. **¿Es
un resto, o algo que piensa usar?**

## 21 · Las badges de "Nivel III · Salud celular", y el ECM/BCM que se quedó sin sitio

**Lo pidió usted**, y al ir a moverlas encontramos esto: su `celBadges` se llena (L22943-22947) y ningún
render la lee, ni en su v17. Es la misma situación del `clasifLancet`.

Nosotros sí las mostrábamos, y ahí salió el choque que usted notó: su tabla de Wang decía "Hidratación
celular adecuada" y la badge decía "deficiente". **No es un error de cálculo: son dos indicadores suyos
distintos** (el AIC como porcentaje, 60-65 %, y la hidratación de la masa libre de grasa, 73,2 %, que ya
tiene su propia fila). Están retiradas, y eso no toca su instrucción del 23 de agosto.

**Lo que sí se pierde:** el ECM/BCM > 1,4 era el único de las cuatro badges sin fila propia, así que ya
no se ve en ninguna parte. Su archivo tampoco lo muestra. **¿Debe verse? ¿Con qué corte y en qué fila?**

## 22 · El estado PBI: su HC lo imprime y nosotros lo retiramos

La cabecera de su tabla de la historia clínica imprime, junto al fenotipo MCCB, "PBI: Riesgo celular".
**Atlas no lo calcula ni lo muestra**, por dos razones independientes: al reconciliar la taxonomía con su
prototipo, la real (81 estados EFR / 9 estructural / 9 sectores FyR / DFI de 5 dominios) tomó autoridad
sobre `F1-F12 / PBI / EIEC`; y su `estadoPBI` usa un **tercer umbral de ángulo de fase** (6,80 / 6,30,
L13715) que contradice el `cAF` (6,5 / 6,0) que Atlas ya muestra en la misma pantalla.

**Si el PBI vuelve, la pregunta previa es cuál de los dos umbrales manda**, porque no pueden convivir. Y
tiene una consecuencia: su propio bloque de datos crudos manda el estado PBI al modelo de IA, y nosotros
no lo calculamos, así que esa línea no la podemos enviar. Es el único dato de su prompt que falta por
decisión declarada, no por descuido.

## 23 · La fórmula sintética: sus doce campos están todos, pero la disposición es otra

Los cotejamos uno por uno: los doce campos están en Atlas, ninguna cifra cambia. Lo que cambia es la
forma: usted los presenta como lista plana, y nosotros como una cuenta (GEB × PAL = GET, menos el
déficit, igual al objetivo). **Que revise las dos y diga cuál quiere:** la suya se lee de un vistazo; la
nuestra enseña de dónde sale cada número, que es lo que el nutricionista necesita cuando ajusta uno.

**Y hay algo más:** su v12 §6.4 retira la tabla vieja de la fórmula, y con ella se va el **origen del
rótulo "Fórmula sintética"**, que adoptamos precisamente por ser el suyo. Si el rótulo desaparece de su
archivo, ¿cómo debe llamarse ese bloque en Atlas?

## 46 · Sus dos hidrataciones se contradicen en la franja de 71 % a 73 %

**De dónde salió.** De leer una paciente ya diagnosticada: en su tabla de composición hay dos filas
seguidas que hablan de hidratación y dan veredictos opuestos. **Que los dos indicadores sean distintos no
es el problema:** ACT/MLG (agua corporal total sobre masa libre de grasa) e Hidratación sin grasa (agua
libre de grasa sobre masa libre de grasa descontada la del tejido graso), las dos con referencia 73,2 %.

**El problema son sus dos clasificadores, que no comparten el borde**, y los dos están portados tal cual:
`dACTMLG` (L15645) llama **Normal** de 71 a 74, y `dHidDef` (L15660) llama normohidratación a 73 en
adelante. Así que cualquier paciente cuyos dos valores caigan entre 71 y 73 sale con "Normal" en una fila
y "Deshidratación leve" en la de abajo, y como los dos números suelen ir cerca la franja no es rara. **Es
la cuarta vez que esta pareja aparece:** la badge de la 21 era el mismo choque desde el otro lado.

 · **A)** `dHidDef` manda y `dACTMLG` sube su piso a 73. · **B)** `dACTMLG` manda y `dHidDef` baja su
 piso a 71. · **C)** Las dos se quedan y la tabla **dice** que miden cosas distintas. · **D)** Una de las
 dos filas sale de la tabla.
*Recomendamos **C**: los dos números son suyos y los dos son correctos, lo que falta es que el documento
diga que no son el mismo indicador. Mover un piso sería cambiar un corte clínico suyo. Si prefiere A o B,
es una línea; si prefiere D, díganos cuál se queda.*

# E · EL INSTRUMENTO Y EL PROMPT

## 24 · Diez de sus quince alertas clínicas no pueden salir nunca

Su `generarAlertas` tiene quince reglas y en Atlas corren cinco: TCA activo, riesgo glucémico crítico,
deshidratación probable, estrés alto con azúcares elevados e hidratación adecuada.

**Las otras diez leen `cons`**, el consumo de nutrientes por porciones al día, y ese dato **no lo captura
ninguna encuesta**, ni la suya ni la nuestra. **No es una pregunta nueva, es la consecuencia de dos que
ya respondió:** *"ninguno es la traducción de otro"* (30 de agosto) y, sobre las porciones por grupo,
*"no va, y no es que falte: es que no debe existir"* (3 de septiembre). Su v15 lo confirma por el otro
lado: el Módulo S tampoco las captura. **Mientras tanto Atlas lo dice en pantalla:** *"De las quince
alertas del modelo, 10 necesitan el consumo de nutrientes en porciones, que la encuesta no captura. La
ausencia de avisos no equivale a ausencia de riesgo."*
**¿Lo dejamos así?** Las tres salidas, y ninguna la tomamos por nuestra cuenta: **1)** se queda con el
aviso permanente · **2)** las diez se retiran del modelo · **3)** la encuesta captura porciones, que es
un instrumento nuevo y suyo.

## 25 · ¿Qué MÁS debería alimentar al generador de menús?

| Viaja | No viaja |
|---|---|
| Objetivo calórico y proteína objetivo | Alergias e intolerancias (retiradas el 28 de agosto) |
| Restricciones del modelo, con su referencia | Contexto de acceso e inseguridad alimentaria |
| Restricciones del profesional | Distribución por tiempos de comida |
| Patrón alimentario declarado | Datos de identificación, nunca |
| Fenotipo estructural, sector funcional, rutas activas | |

**La pregunta:** de lo de la derecha, ¿algo debería entrar? El acceso y la distribución por tiempos son
los dos candidatos. **Las alergias no están en la pregunta**, porque eso ya lo respondió.

## 26 · Sus pasos 1 a 3 del Análisis IA no llegan al paso 4

Su Análisis IA hace **cuatro** llamadas al modelo (patrones, hipótesis causal, validación y síntesis), y
al trazarlas para portarlas encontramos que la cadena se corta: el paso 1 lo leen el 2 y el 3, el 2 lo
lee el 3, **y el 3 no lo lee nadie**. Y el paso 4, que es el que produce el diagnóstico que se muestra,
no recibe ninguno de los tres: su mensaje lleva solo sus instrucciones, el bloque DFI y los datos crudos.
Los patrones, la hipótesis y la validación se calculan y se descartan.

Portamos **el paso 4**, que es donde viven la estructura de los cinco dominios y los datos; portar los
otros tres sería copiar el corte y pagarlo tres veces. **Si los tres primeros debían alimentar al cuarto,
díganoslo y lo cableamos.**

## 27 · En la historia clínica, ¿van TODAS las observaciones o solo la vigente?

Usted pidió que las observaciones aparezcan en la historia clínica y por consulta, y que cada profesión
escriba la suya sin pisar la de otra. Las dos cosas están hechas. **Lo que apareció al usarlas:** un
profesional que se corrige escribe una segunda, y como no se puede borrar la primera, quedan las dos; en
la pantalla la última se marca vigente, y en el documento salen todas.

**Por qué todas en el documento:** la historia clínica es probatoria, y que no se puedan borrar existe
precisamente para que no se pierda lo que se escribió; si mostrara solo la última, escondería que hubo
una corrección. **La objeción, dicha por nosotros mismos:** una corrección de una palabra deja dos
párrafos casi iguales. Su archivo no lo resuelve: guarda una sola y no la muestra en ningún documento.

## 28 · ¿En qué dominio van los síntomas digestivos?

Su DFI no los lee en ninguno de los cinco dominios y su paso 4 los manda en su propio bloque; el modelo,
por su cuenta, los metió en el Epigenético-Contextual. Su v15 añade el filtro digestivo y la regla de
salto, y sigue sin decir en qué dominio se leen.

Por ahora le pedimos al modelo que no los use como evidencia de ningún dominio. **Si prefiere que se lean
en alguno, díganos en cuál.**

## 29 · La pregunta de amputación se queda, y usted no la nombró

Nos dijo que quitáramos las preguntas que no había puesto y nombró dos (edema y fiebre): las dos están
fuera. La tercera del mismo lote, *"¿Tiene amputación de algún segmento corporal?"*, tampoco está en su
archivo, y la dejamos porque retirarla sin que la señale sería tratar su silencio como una instrucción.

**Y hay una razón para separarla:** el edema y la fiebre son transitorios y una amputación es
permanente. Lo que compromete no es el estado del paciente: es la ecuación, que estima sobre un cuerpo
completo. **¿La retiramos también?**

# F · DATA QUE CONVIENE QUE SEPA ANTES DE LEER SUS PROPIOS CASOS

## 30 · Dos de los ids de su anexo A son data de PRUEBA

El grupo de tres evaluaciones de su anexo (`5441fd96` / `b3e367cc` / `6256b921`, el que la columna `Edad`
no le cuadra a ninguno) es el grupo de smoke, marcado como de prueba el 29 de octubre: **el caso que
usted describe ahí no es de un paciente**. Y una corrección nuestra: le dijimos "cinco grupos entre
pacientes distintos" y son **cuatro**; usted tenía razón al dudar de la cifra.
*Recomendamos retirarlos de su lista de errores 1 y 2, o reemplazarlos por dos reales. Nosotros
mantenemos su anexo citado tal cual, con esta nota al lado.*

## 31 · Los pacientes pediátricos: el equipo da grasa negativa y la v7 no los cubre

En la cohorte hay cuerpos de 22 kg y 29 kg. El Biody aplica ecuaciones de adulto y devuelve **masa grasa
negativa** (las dos de la pregunta 2 vienen de ahí): no es un error de digitación, es una fórmula
aplicada fuera de su rango. Y la EB-BIS v7 está calibrada de 18 a 100 años.
*Recomendamos decirlo en el sistema y no calcular: que esas consultas salgan marcadas como fuera de rango
de calibración, con la razón escrita, en vez de emitir cifras que no significan nada. Y si CNV va a
atender pediatría, con qué ecuaciones es decisión suya.*

# G · LAS QUE SALIERON DE LEER LA v15 Y LA v16

**Son seis** (32, 33, 34, 39, 40 y 41): las tres primeras del 5 de noviembre, al revisar sus dos entregas
nuevas, y las otras tres del 7, de medir la cohorte contra la nube. **Dos de noviembre se absorbieron en
preguntas que ya existían, y no se renumera nada:** la 35 vive dentro de la **15** y la 36 dentro de la
**7**.

## 32 · ¿Qué pasó con las versiones 13 y 14 del HTML?

Nosotros nos quedamos en la v12 del 12 de octubre, y las dos siguientes que nos llegaron son la v15 y la
v16; entendemos que la 13 y la 14 fueron adelantos recogidos en estas dos. **No es una pregunta abierta,
es una confirmación.**

 · **A)** Sí, v15 y v16 recogen todo lo de v13 y v14. · **B)** No, falta algo (díganos qué).
*Recomendamos A: su v15 declara su base en `ATLAS_v12.html` y su v16 en `ATLAS_v15.html`, sin mencionar
las otras dos.*

## 33 · La reconfirmación al cierre de una ruta [aplicado: solo la anual]

Su §5.5 del 30 de octubre la dejó pendiente. Hoy aplica la regla anual, y así se queda mientras usted no
diga otra cosa.

 · **A)** Solo la anual. · **B)** El cierre de una ruta dispara la reconfirmación completa. · **C)** Solo
 los ítems de esa ruta.
*Recomendamos A, y es lo que hay: la B añade un bloque de confirmación largo justo en la consulta de
cierre, que es cuando el profesional tiene menos tiempo. Marcada [aplicado] porque la A no exige
construir nada.*

## 34 · El S1 del Módulo S cuando no hay nutracéuticos indicados [aplicado: A]

El S1 sale de los nutracéuticos de la consulta anterior, y de los 30 pacientes que hoy tienen dos o más
consultas, **18 no tienen ninguno en la anterior**: a esos el Módulo S les nacería con su primera
pregunta vacía.

 · **A)** Si no hay ninguno indicado, S1 y S2 no se presentan y la adherencia se calcula con el S3 (plan
 de alimentación) solo. · **B)** Se presenta S1 con una línea que diga "no se le indicó ninguno".
 · **C)** Otra cosa.
*Recomendamos **A**: una pregunta sobre un producto que nadie le indicó no tiene respuesta correcta, y
`cnvsAdherenciaAdecuada` ya se resuelve con el S3. **Pasa a [aplicado] el 16 de noviembre:** cuando se
escribió, el Módulo S no existía y la regla estaba solo decidida; hoy está construido y activo, la regla
A está en el código y pasó el smoke del 16.*

## 39 · El marco de referencia: ¿presentación o instrumento?

Su §2.6 pide el marco también en la línea base, y está puesto: cada sección dice su ventana de recuerdo
("Piensa en las últimas dos semanas", "en tu situación actual", "en tu patrón usual de consumo"). Lo que
hay que decidir es **si eso versiona el instrumento**.

**El argumento de que no:** su regla de invariancia (§7.4) habla de enunciado, opciones y puntaje, y
ninguno cambia; el marco hace explícito lo que el instrumento ya suponía, y lo que había antes no era
"sin ventana", era cada paciente eligiendo la suya. **El argumento de que sí:** "¿fumas?" contestada
pensando en el último año y pensando en las últimas dos semanas son dos preguntas distintas con el mismo
enunciado. **Lo que cuesta:** la A nada; la B un bump de encuesta, con las respuestas anteriores en la
versión sin marco y esas evaluaciones dejando de ser corregibles. Unas horas, no un rediseño.

 · **A)** Es presentación: se queda como está, sin versión nueva. · **B)** Es instrumento: se versiona, y
 lo respondido antes queda en la versión sin marco.
*Recomendamos **A**. **Y desde el 16 de noviembre tiene una consecuencia más:** ya hay seguimientos
reales respondiéndose con la CNV-S 1.0, así que si elige la B esas respuestas quedan selladas con la 1.0
y la versión nueva rige hacia adelante, sin reescribir ningún registro clínico, y las consultas de ese
tramo dejan de ser corregibles. Es el coste que la decisión de encenderla aceptó por anticipado; cuanto
antes responda esta, más corto es ese tramo.*

## 40 · Los menores fuera de la cohorte [aplicado]

Una consulta de una persona de **13 años al medirse** estaba dentro de `evaluaciones_para_investigacion`.
Se sacó, y la razón es suya por partida doble: la EB-BIS v7 está calibrada de 18 a 100 y su propio código
rechaza la edad fuera de ese rango, así que las cifras de esa fila no significan lo que dice la columna;
y la autorización de investigación de un menor no la da él.

 · **A)** Fuera de la cohorte, marcados y contados aparte. · **B)** Dentro, con su marca. · **C)** Otra.
*Recomendamos A, y es lo que hay. La consulta **sigue contando como consulta atendida** (son 6 de 652):
lo que sale es su fila de la cohorte publicable. Dos detalles de método: la edad se mide a la fecha de la
toma y no a hoy, y "no se sabe" no es "es menor" (sin fecha de nacimiento la fila se queda, porque un
dato que falta es calidad y no inelegibilidad).*

## 41 · Las 140 sin diagnóstico: qué son y qué aportan

"Sin diagnóstico" podía significar tres cosas, y al mirarlas una por una es una sola: son **consultas en
curso** (68 en borrador, 36 esperando la encuesta, 35 en progreso, 1 abandonada). De ellas, 108 aportan
solo la encuesta, 3 encuesta y medición, 29 nada todavía, y ninguna solo medición.

 · **A)** Se quedan: una encuesta respondida es dato de investigación aunque no haya bioimpedancia.
 · **B)** Solo entran las que tengan medición. · **C)** Se quedan, marcadas, y cada análisis decide.
*Recomendamos **A con la marca de C**, que es lo que hay: la vista las trae y /obbia las separa en su
propia cifra ("con diagnóstico sellado: las únicas con indicadores"). Sacarlas escondería encuestas
completas que sí sirven; contarlas sin decirlo haría creer que hay 429 bioimpedancias cuando hay 289.*

# H · LAS QUE SALIERON DE CONSTRUIR LA ENCUESTA DE SEGUIMIENTO

**Son cuatro** (42, 44, 45 y 47), y van aparte porque son de otra clase: salieron de **construir** su
CNV-S 1.0 y de probarla, que es cuando aparece lo que un documento no puede anticipar. Ninguna frena
nada, y desde el 16 de noviembre la encuesta está activa para todos los pacientes, así que lo que usted
decida se aplica hacia adelante. Solo la **39** podría obligar a una versión nueva del instrumento.

**Lo que ya está hecho**, para que sepa sobre qué contesta: el instrumento de seguimiento apunta a las
mismas preguntas de la línea base (su §2.2) y no las duplica, así que la invariancia de su §7.4 no es una
regla que haya que recordar sino algo que la estructura impide romper; el Módulo S con sus seis ítems y
sus opciones literales; el bloque de confirmación con sus tres estados; la regla de salto digestivo; la
reconfirmación anual con el ítem 38; y el marco por sección. Las cuentas de su tabla 3 salen exactas: 45
repetir, 7 con filtro, 8 confirmar y 4 retirar. *(De la prueba del 9 de noviembre salieron cuatro
defectos nuestros, ya corregidos, y una pregunta suya: la 47.)*

## 42 · ¿A quién se le aplica la CNV-S si su primera consulta no tiene encuesta completa?

Su §2.1 dice "desde la segunda consulta se aplica la CNV-S", y el bloque de confirmación precarga la
respuesta de la anterior. **El problema es que en Atlas hay primeras consultas sin encuesta completa:**
las 162 importadas del HTML y las que quedaron a medias. A un paciente así la CNV-S le mostraría ocho
ítems "a confirmar" sin nada que confirmar y cuatro retirados con un valor que no existe, y esos cuatro
quedarían vacíos para siempre.

 · **A)** Si la consulta anterior no tiene las ocho de confirmación, se aplica la encuesta completa otra
 vez y la CNV-S empieza en la siguiente. · **B)** Se aplica la CNV-S y los ítems sin respuesta anterior
 se presentan abiertos. · **C)** Otra cosa.
*Recomendamos **B para los ocho de confirmación** (es lo construido) **y A para los cuatro retirados**:
un ítem retirado que nunca se preguntó no es un dato conservado, es un hueco permanente. Con B sola, los
antecedentes familiares, los suplementos y las cirugías de un importado no se preguntarían jamás.*

## 44 · La reconfirmación anual cuando la línea base viene del HTML

Su §7.3: *"si pasó un año o más desde la última confirmación completa... Cuentan como confirmación
completa la línea base y cada reconfirmación hecha."* En Atlas hay 162 consultas importadas cuya línea
base es un archivo, no una encuesta diligenciada en una fecha, así que no hay esa fecha.

 · **A)** La fecha de la consulta importada. · **B)** No hay confirmación completa: la primera CNV-S de
 ese paciente trae la reconfirmación anual entera. · **C)** Otra cosa.
*Recomendamos **B**: una encuesta importada no se confirmó con nadie delante, y tratarla como
confirmación completa le daría un año de validez a un dato que nadie revisó.*

## 45 · `d7_agua` no está en su tabla 3

Su tabla 3 reparte los ítems por número y los nuestros llevan el suyo. **Uno no tiene número: `d7_agua`**,
los vasos de agua al día, que es una pregunta de Atlas y alimenta el componente de hidratación del ICEC.
Lo pusimos en **repetir**.

 · **A)** Repetir en cada control (es lo que hay). · **B)** Confirmar. · **C)** Retirar del control.
*Recomendamos **A**: el ICEC se recalcula en cada consulta y la hidratación es justo lo que cambia entre
una y otra. Las otras dos dejarían el ICEC de seguimiento apoyado en un dato viejo.*

## 47 · ¿El S1 pregunta por los productos que el paciente compró por fuera?

**De dónde sale.** Su §2.3 dice de dónde sale la lista del S1: *"de los nutracéuticos registrados en
Rutas de atención... de la tabla donde guardas las indicaciones o despachos de la consulta anterior"*. En
Atlas leemos las **indicaciones**: un producto indicado y no despachado es justo el caso en que la
respuesta importa. **Lo que eso deja fuera:** un producto que el paciente toma por su cuenta (otra marca,
algo de la farmacia) no está en ninguna de las dos tablas. Su adherencia se mide solo sobre lo nuestro,
que para su tabla 6 es lo correcto, pero el profesional no se entera de lo demás, y eso sí es información
clínica: interacciones, duplicidad de principios activos, o un cambio que no viene de la ruta. **Y hoy no
lo recoge nada más:** su ítem 35 está RETIRADO en la CNV-S por su tabla 3.

 · **A)** Como está: el S1 solo pregunta por lo indicado en la consulta anterior. · **B)** Un ítem nuevo
 en el Módulo S, abierto: *"¿está tomando algún suplemento o nutracéutico que no le hayamos indicado?"*.
 · **C)** Que la profesional pueda añadir productos a la lista del S1 antes de enviar la encuesta.
*Recomendamos **A** para el cálculo y **B como ítem nuevo**, si usted lo aprueba. No se contradicen: la
adherencia que su tabla 6 cruza es a LA RUTA, y meter ahí un producto que nadie indicó cambiaría lo que
la cifra significa; pero la respuesta del ítem nuevo no entraría en ese cálculo, iría a la historia
clínica. **La C la descartamos:** obliga a teclear antes de cada encuesta y a inventar un producto que no
está en el catálogo.*

# I · LAS QUE ABRE SU v17

**Son siete** (48, 49, 50, 52, 53, 54 y 55), de leer su `CAMBIOS_ATLAS_v17_URGENTE` y su
`ATLAS_v17.html` entre el 11 y el 16. Ninguna frena nada: la v17 está construida y el histórico ya corrió.

## 48 · El IEHH y el ISCM-BIS que ya se informaron dejan de ser comparables

Su v17 recalcula los dos con fórmulas y puntuaciones z **por sexo** y ordena conservar los anteriores
(`IEHH_v16`, `ISCM_v16`): un paciente al que ya se le informó un IEHH tiene desde entonces otro número
para el mismo día.

 · **A)** Se le muestra solo el nuevo. · **B)** El nuevo con el anterior al lado. · **C)** El nuevo y un
 aviso de recalibración, como se hizo con la EB-BIS v5.
*Recomendamos **C**: es el precedente de la casa y la única que no obliga al paciente a explicarse solo
por qué su número cambió sin que él cambiara.*

## 49 · El ISCM-BIS se sigue informando, pero sin lectura. ¿También al paciente?

Su v17 retira los cuatro niveles *"hasta validarlo frente a biomarcadores"*, y con razón: hoy no se sabe
qué extremo de su distribución corresponde a mayor susceptibilidad. Queda el valor y su percentil.

 · **A)** Se le muestra al paciente con su percentil y sin nivel. · **B)** Deja de mostrársele al
 paciente y queda solo en la vista del profesional. · **C)** Se retira de todas las superficies hasta que
 se valide.
*Recomendamos **B**: un número sin lectura no es información para quien no puede interpretarlo, y la A le
deja un dato del que ni nosotros sabemos decir si es bueno o malo.*

## 50 · La serie de seguimiento se parte donde el histórico no se puede recalcular

Su documento dice que *"la comparación con la consulta previa empieza a funcionar desde la primera
consulta guardada con v17"*, y leído así el bump apagaría la tarjeta de respuesta a la intervención
**para todos** hasta su segunda consulta con la v17.

**Y por eso el histórico se reemitió en vez de esperar** (decisión de Santiago del 11 de noviembre):
así **solo queda partida en las 71 consultas que no se pudieron recalcular**.

 · **A)** En esas consultas la tarjeta no aparece, como hoy cuando no hay anterior. · **B)** Aparece
 diciendo que no puede comparar porque la ciencia cambió entre las dos y esa consulta no se pudo
 recalcular.
*Recomendamos **B**, con el criterio que ya aplicamos a una medición no comparable: cuando algo no se
muestra, se dice por qué. Un hueco silencioso se lee como un paciente sin trayectoria, y además no se va
a cerrar nunca.*

## 52 · Sus nueve fenotipos del sector frente a los doce que Atlas ya tiene

Su Tabla 11.2 nombra **nueve** fenotipos MCCB, uno por sector, y de ellos sale la gravedad del dominio
metabólico-estructural. Atlas ya tiene **doce** (F1 a F12), portados verbatim de su `ATLAS.html` e
indexados por (FMI, obesidad clínica, FFMI): los doce distinguen **obesidad clínica de preclínica**, que
los nueve no.

 · **A)** Los nueve reemplazan a los doce. · **B)** Conviven: los nueve gobiernan el sector y el dominio
 2, y los doce siguen en la tarjeta del fenotipo. · **C)** Se retiran los doce.
*Recomendamos **B**: los nueve son una propiedad del SECTOR y es lo que su dominio 2 necesita, mientras
los doce cargan una distinción que usted introdujo (clínica contra preclínica, con el criterio de Rubino
2025 que su propio documento cita) y que los nueve no pueden expresar. Retirarlos perdería información
suya.*

**Mientras tanto, la tabla de composición muestra el nombre de la v17 (2026-11-16).** Santiago lo pidió
así al ver que el mismo documento daba dos nombres al mismo cruce FFMI × FMI: la tabla decía "Fenotipo
MCCB: Normopeso" (F8) y el DFI "S4 · Composición saludable", en las 481 consultas que tienen los dos
sellados. **Los doce no se retiran:** siguen sellándose y gobernando el protocolo por fenotipo, y solo
cambió qué nombre se pinta en esa fila.

## 53 · El orden de prioridad de las rutas, que su §10 nombra y no escribe

Dice que `activarRutas` devuelve *"las rutas del DFI en su orden de prioridad"*, y ese orden no está
escrito. El de su `computeDFI` es R1, R2, R3, R4, R5 por el orden en que las añade, y la R3 lleva el
rótulo "(prioritaria)" pegado al nombre.

 · **A)** El orden en que su `computeDFI` las añade: R1, R2, R3, R4, R5, y R6 sola cuando ningún dominio
 llega a 2. · **B)** El mismo, pero con la R3 **primera** cuando se enciende el veto conductual.
 · **C)** Otro orden que usted fije.
*Recomendamos **B**: su propio rótulo llama a la R3 prioritaria, y el veto conductual es el único que
fuerza el riesgo integrado a crítico por sí solo. Una ficha con señal de conducta de riesgo no puede
quedar tercera en la lista que el profesional lee.*

## 54 · ¿Qué cortes de FMI y FFMI lee el profesional en la ficha del indicador? [aplicado: B]

Su v17 deja **dos** juegos de cortes vivos con oficios distintos: los del libro (Tabla 10.2, por sexo:
FMI H 3,7-6,4 · M 5,0-8,1 · FFMI H 18,8-21,0 · M 15,5-17,1), que gobiernan el sector, el fenotipo y el
dominio metabólico-estructural, y los de `cFMI`/`cFFMI` (Excel Mapa E_BIS), que su documento conserva
*"solo para sus banderas clínicas"*. **El problema es que la pantalla los mezclaba:** un hombre con FFMI
21,1 salía en la ficha como "Normal (17-25)" y en la Diana con "FFMI Alto", a un clic de distancia.

 · **A)** La ficha sigue mostrando los cortes de `cFMI`/`cFFMI`. · **B)** La ficha muestra los cortes del
 libro, y las banderas clínicas se quedan en la columna de diagnóstico de la tabla de composición.
 · **C)** La ficha muestra los dos, rotulados.
*Recomendamos **B**, y está [aplicado]: el encabezado de esa pantalla dice que la referencia que muestra
es "el límite que gobierna el riesgo", y desde la v17 ese límite es el del libro. La bandera clínica
sigue visible donde ya estaba. **Y una consecuencia medida:** la Δ del donante de nuestros goldens pasa
de +0,37 a -0,03 en el FMI y de +4,10 a +2,30 en el FFMI. No es un decimal: es que el profesional lee
"por encima del límite" o "por debajo" según qué tabla esté mirando.*

## 55 · Su caso K dice "sin sexo no se clasifica", pero el adaptador del DFI lo vuelve FEMENINO

Su §13 caso K pide que sin sexo registrado el IFC, la PABU y el ICA-BIS digan *"Sin sexo: no se
clasifica"*, y así lo hacen. Pero su `computeDFIFromData` empieza con
`const sexoM = (d.sexo === "Masculino" || d.sexo === "M") ? "M" : "F"`, o sea que **cualquier valor que
no sea masculino se trata como femenino**, incluido el vacío: un paciente sin sexo recibe el sector, el
fenotipo y el dominio metabólico-estructural de una mujer. **En Atlas hoy no es alcanzable** (la cadena
normaliza el sexo antes y rechaza un valor desconocido), así que no es un defecto vivo: es una
contradicción dentro de su propio archivo, y el día que entre un registro sin sexo decidiría en silencio.

 · **A)** Vale el caso K: sin sexo, el DFI tampoco clasifica. · **B)** Vale el código: sin sexo se asume
 femenino. · **C)** Otra cosa.
*Recomendamos **A**, y no la aplicamos todavía porque toca su código congelado: es su criterio declarado
en el caso K y el que Atlas ya aplica en los demás sitios. Asumir femenino es la clase de valor por
defecto que no se ve en ninguna pantalla y cambia un veredicto.*

## 56 · Las indicaciones y las urgencias condicionales de sus remisiones

Su catálogo de rutas trae **10 indicaciones condicionales** ("Valoración médica si IRC > 5.0",
"Valoración médica si IAE > 10 años" y ocho más) y **2 urgencias condicionales** ("obligatoria si HTA o
DM2 activa" en la R2, "recomendada si IAE > 10 años" en la R4). **Ninguna se evalúa contra los datos del
paciente, en ninguna superficie:** son texto suyo y se copian tal cual.

**Y Atlas las trata de forma desigual, que es lo que le preguntamos.** La historia clínica, el SOAP y el
PDF **filtran** las indicaciones condicionales, porque el bloque se titula "lo que el modelo exigió" y
estaba listando condiciones que no aplicaban al paciente; **y no filtran las urgencias**. Medido el 16 de
noviembre sobre los 553 informes sellados: **268 consultas** imprimen "Médico (obligatoria si HTA o DM2
activa)" y **107** imprimen "recomendada si IAE > 10 años", se cumpla o no la condición. Y al revés:
`ed83ff97` **sí cumple** la del IAE (+12,4 años) y su historia clínica no se la muestra.

**De las diez, solo tres se pueden evaluar con lo que Atlas sella:** IRC > 5.0, IAE > 10 años y HTA o DM2
activa (de su D5). Las otras siete son cualitativas ("FMI muy elevado", "purgas frecuentes", "si el
psicólogo lo aprueba") y el instrumento no las captura.

 · **A)** Las tres evaluables se resuelven contra el sello y se imprime **solo lo que se cumple, con el
 valor** ("Valoración médica: IAE +12,4 años"); las siete que no se pueden evaluar se cuentan en una
 línea, para que el hueco no se lea como que no había nada; y las dos urgencias se imprimen resueltas.
 · **B)** Como hoy. · **C)** Otra.
*Recomendamos **A**. No la aplicamos por nuestra cuenta porque decidir que "+12,4 cumple más de 10" lo
diría el documento en nombre de su modelo, y eso es suyo.*

# ANEXO · LO QUE DECIDIMOS NOSOTROS Y SOLO LE DECLARAMOS

No pide nada: son las divergencias que tomamos por nuestra cuenta para no dejarle preguntas abiertas que
frenaran el cotejo. **Cada una tiene su puerta de salida: si prefiere otra cosa, se cambia.**

**Del instrumento, que es suyo.** La P43 (alergias) dice "Otra" y su archivo dice "Otras" · la P29
(estrés) añade "(1 = sin estrés, 10 = máximo)", porque una escala sin sus extremos no se puede responder
bien · la lista de intercambio imprime la medida además de los gramos, que es la (a) de sus tres salidas
· el texto libre de "otros medicamentos" viaja dentro de la respuesta, no como campo aparte. Las dos
primeras cuestan un bump de encuesta; las dos últimas, una línea.

**De la presentación, que es nuestra.** El administrador no ve las cuatro pestañas de tratamiento por
profesión · el diagnóstico de encuesta usa colapsables · el patrón alimentario no muestra el puntaje ni
el nivel · el radar usa cuatro colores con ancla azul · el diagnóstico abre en Funcional con franja de
veredicto persistente · la tabla de composición junta lo bioeléctrico crudo y conserva GEB y GET. **Y una
que merece su línea:** la tabla de la historia clínica muestra más índices que la suya, porque la nuestra
parte de las ~30 filas de Wang y les aplica **su** regla de filtrado. El filtro es suyo; el inventario de
filas es nuestro.

**Del prompt del resumen de IA.** Su estructura pide "redactar clínicamente conectando causas entre
dominios" y se conserva tal cual; le añadimos el límite de que cada causa y cada efecto que conecte tiene
que estar en los datos que se le dan, porque el modelo escribía cosas que ningún dato respalda. Y lo que
rompía tantas veces que dejó de escribirlo lo compone ahora Atlas: el párrafo de alertas y respuestas en
rojo, y el cierre de rutas y prioridades. **Donde Atlas va por delante de su archivo:** señalamos cuando
un grupo nuclear queda en 0 porciones · no pisamos la lista guardada al cambiar el objetivo · la cadena
calórica cuadra macros y lleva candado de concurrencia · y un documento que se contradice consigo mismo
no se entrega.

**De la CNV-S, de estructura y no de contenido.** Ninguna cambia una pregunta, una opción ni un puntaje;
van declaradas porque sostienen la invariancia de su §7.4. El instrumento es una **capa** sobre la
versión y no otra versión de la encuesta (así no hay dos textos de la misma pregunta que se separen) · el
Módulo S vive en su propia versión (si no, sumaría siete huecos a todas las encuestas de línea base) · S1
y S2 guardan una respuesta por producto · los ocho ítems a confirmar van juntos en su propio paso, que es
el orden de su anexo A · "Sin cambios" guarda la respuesta anterior y no una marca · y `cnvsNoComparable`
y `cnvsAdherenciaAdecuada` se derivan al leerlas.

# LO QUE YA ESTÁ CERRADO Y NO VUELVE A APARECER AQUÍ

Para que no lo busque. Una línea cada una. Lo que cerraron sus entregas de este mes está arriba, en la
tabla de "Lo que ya está contestado".

- **Las ALERGIAS, con su fecha porque llegó tres veces.** Lo decidió el 27 de agosto y se ejecutó el 28:
  las tablas de alérgenos, equivalencias y filtros están retiradas, no hay regla de "avena implica
  gluten", leche y lactosa no se cruzan con productos, P43 y P44 quedan como están, y el producto externo
  está habilitado con el alérgeno de su ficha. **Y el bloqueo activo con confirmación y registro NO se
  construye:** el asesor legal rectificó su propia recomendación, porque confundía usar el dato con
  bloquear con el dato, y un Atlas que bloquea sobre una inferencia clínica contradice el consentimiento
  ya firmado. Lo único que se construye es poner las dos declaraciones juntas en pantalla.
- **Las rutas al paciente** (respondió Santiago el 5 de noviembre): no van, y con ellas salen los
  suplementos y las remisiones, porque el informe no puede recomendar algo que la profesional no
  recomendó. Siguen en la historia clínica y en la hoja del plan.
- **El ICC y el ICT** (decidido por Santiago): si se teclea la cintura o la cadera, Atlas recalcula los
  dos con sus fórmulas; si no, manda el del equipo.
- **La fila PABU.** Se queda como la aprobó el 7 de septiembre
  ("Ya revisé ATLAS y está bien como lo tienen"), y lleva candado.
- **Por sus respuestas de septiembre:** la apertura del párrafo de IA · el criterio del profesional en la
  HC · las tres entradas de Leche semidescremada · la ortografía de la tabla de intercambio · las dos
  preguntas de encuesta que no llegaron en la entrega del 4 · los dos guiones de ANI-BIS-E · el
  comentario encima del interruptor del LE8.
- **Por la especificación 7.1.0:** `escalaAniosPorDE` y si la EB-BIS se calcula sin encuesta completa.
- **Antes:** el interruptor del LE8 · los tres colores de los clasificadores · las opciones de ejercicio ·
  las cuatro erratas de la tabla de intercambio · los seis rótulos de los sectores · Tumaco y Cartago · el
  núcleo de 66 alimentos · la caída campo por campo de `getDX` · la referencia del IFC.

# DE DÓNDE SALE CADA PREGUNTA

Este documento unificó las dos colas anteriores (el cotejo visual de septiembre y las *Dudas de EB-BIS v7
y ATLAS v12* del 30 de octubre) y añadió lo que salió de leer la v15, la v16 y la v17 y de medir la
cohorte contra la nube. **Verificado pregunta por pregunta contra sus entregas y contra el código o la
base**, no contra otro documento: el 4 y el 5 de noviembre contra la v15 y la v16, el 7 en el barrido de
la v10 a la v16, y el 12 y el 16 contra su
`CAMBIOS_ATLAS_v17_URGENTE` v1.2 y su `ATLAS_v17.html`. En todas las de la sección D se fue al archivo a
comprobar si el cambio estaba hecho sin estar narrado, y en todas sigue igual.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
