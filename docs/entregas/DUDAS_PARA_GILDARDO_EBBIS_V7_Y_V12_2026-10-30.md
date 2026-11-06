# Dudas para Gildardo · EB-BIS v7 y ATLAS v12

> **RETIRADO COMO COLA VIVA (2026-11-03). Lo abierto vive en `docs/PENDIENTES_CIENTIFICOS.md`, que es
> el documento ÚNICO.** Santiago pidió uno solo y al día: tener las dudas aquí y la cola de septiembre
> allá hacía que algo se quedara sin llegarle, que es la misma razón por la que en septiembre se retiró
> `GILDARDO_QUERIES.md`. Este archivo se conserva como **registro de lo que se le envió el 30 de octubre
> y el 3 de noviembre**, con su numeración, para poder cruzarlo con sus respuestas si ya empezó a
> contestarlo. **No se le agregan preguntas nuevas ni se consulta para saber qué está abierto.**
>
> **Qué pasó con cada una al unir:** las 1 y 2 salieron (las respondió la especificación 7.1.0 del 26 de
> octubre); la 17 se fundió con la "Nueva (2026-09-19)" de la cola de septiembre, que era la misma; la 9
> se reescribió con la objeción de estética y simetría de la Diana; la 5 y la 13 llevan las cifras de hoy
> (veinte consultas, cuatro grupos entre pacientes distintos); y entró una nueva, sobre cómo deben leer el
> DFI y las rutas el IAE de la v7. La tabla "De dónde sale cada pregunta" del documento único dice en qué
> número quedó cada una.

**Fecha:** 2026-10-30 · **De:** Santiago (equipo técnico de Atlas) · **Para:** Gildardo de Jesús Uribe Gil

> **Este documento no identifica a ningún paciente.** Donde hace falta señalar un caso, va el id de
> evaluación abreviado a ocho caracteres, el mismo que usted usa en su anexo A.

**Cómo está armado.** Diecisiete preguntas (las tres últimas se agregaron el **3 de noviembre**, al revisar con usted el informe y la historia clínica impresos), cada una con el contexto en dos líneas y **nuestra recomendación**.
Las cinco primeras **frenan trabajo** (sin su respuesta no se construye ni se recalcula); las demás son
decisiones que ya están aplicadas de una forma y conviene que usted las confirme o las corrija.

**Lo que ya está construido y espera su visto bueno** va marcado como **[aplicado]**: en esos casos Atlas
hoy hace lo que dice la pregunta, así que si su respuesta es otra, se cambia.

---

## A · Las que frenan trabajo

### 1 · ¿`escalaAniosPorDE = 5` es definitivo?

Su propio código lo marca `// provisional`, y es el factor que convierte desviaciones estándar en años, o
sea el que fija la escala de toda la EB-BIS v7.

**Por qué frena:** si cambia *después* de recalcular los 351 diagnósticos, hay que recalcular otra vez, y
cada pasada deja una versión más de cada diagnóstico en la historia del paciente. Técnicamente se apila
sin problema; lo que no se apila bien es la lectura humana de esa historia.

**Nuestra recomendación:** dejarlo en 5 y **decirlo explícitamente como definitivo para la 7.1.0**. Si
tiene dudas, preferimos esperar a recalcular antes que recalcular dos veces.

### 2 · ¿La EB-BIS se calcula sin encuesta completa?

Su §1 dice que sí (el ICEC sale del cálculo cuando falta la encuesta). Pero el gate de encuesta completa,
que es **suyo** (§1 del 13 de agosto), frena el diagnóstico **entero**, así que hoy la EB-BIS nunca se
emitiría sin encuesta por otra razón.

**Nuestra recomendación:** mantener su gate y **no** abrir una excepción. Si quiere la EB-BIS sin encuesta,
hay que tocar el gate del diagnóstico, y eso cambia una regla clínica suya de agosto por una de octubre: no
lo hacemos sin que usted diga cuál manda.

### 3 · ¿Cuál Harris-Benedict manda, y sobre qué se aplica el 10 %?

Su v12 §6.1 prescribe Harris-Benedict sobre el peso meta más 10 % de termogénesis, y usted mismo marcó dos
precisiones por confirmar: que `gebHarris` trae los coeficientes de **1984** (88,362 / 447,593) y no los de
**1919**, y que el 10 % se aplica sobre TMB × actividad.

**Y hay un detalle que conviene que sepa:** Atlas ya tiene la de **1919** portada desde el 2026-09-02, como
respaldo del basal medido. Adoptar la de 1984 deja **dos Harris-Benedict** vivos en el sistema, cada uno en
su sitio; no es un problema, pero tiene que ser una decisión y no un accidente.

**Nuestra recomendación:** decidir la de **1984** para la prescripción (es la que usted portó) y el 10 %
sobre TMB × actividad (es lo que su código hace), dejando la de 1919 **solo** donde ya está. El cambio mueve
el objetivo calórico de toda la cohorte (**+301 kcal/día** en su propio ejemplo verificado), así que entra
con bump del motor y golden tests, o no entra.

### 4 · Los cortes del control de calidad biológico, con una advertencia de método

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

### 5 · Las consultas que quedan fuera del recálculo, ¿se quedan desfasadas para siempre?

Su §5 pide recalcular el histórico con la v7, y la lista no puede ser "todas": las 23 evaluaciones con la
medición compartida (sus errores 1 y 2) no se pueden recalcular hasta que se corrija de quién es cada toma,
y las que no tienen encuesta completa no emiten diagnóstico por su propio gate.

**La pregunta es qué pasa con ellas después.** Si se recalcula el resto, esas quedan con la EB-BIS de la v5
y las demás con la v7, y la banda de trayectoria no compara entre versiones mayores del motor (criterio de
`VERSIONES.md`), así que el seguimiento de esos pacientes queda partido en dos.

**Nuestra recomendación:** que queden **marcadas con su motivo** y entren al recálculo en cuanto se resuelva
lo que las frena (la corrección de la medición, o la encuesta), en vez de recalcularlas a la fuerza con un
dato que sabemos que no es del paciente. Pero díganos si eso es aceptable como estado **permanente** para
las que nunca se resuelvan: son pacientes que quizá no vuelven, y su historia se queda en la v5.

---

## B · Las que están aplicadas y necesitan su confirmación

### 6 · "Edad biológica estimada": adoptamos su tabla 3, que retira una decisión suya **[aplicado]**

Su tercera ronda del 2026-07-30 decidió que *"la expresión 'edad biológica' no se usa en ningún contenido
del sistema: ni en pantalla, ni en reportes"*, y el indicador se llamó "Edad Bioeléctrica (EB-BIS)". Quedó
registrado como divergencia deliberada.

Su **tabla 3 del 2026-10-26** vuelve a usar la expresión, ahora como *"Edad biológica estimada"*, y marca la
fila como "Profesional y paciente". Entendemos que ese matiz ("estimada") es justo lo que su objeción pedía:
le molestaba afirmar la edad del cuerpo, no estimarla.

**Nuestra recomendación:** lo nuevo manda, y así está aplicado: el indicador se llama **"Edad biológica
estimada"** en el registro del motor, en la pantalla de resultados y en la historia clínica (con su sigla
al lado). **Confirme**, porque cambia el rótulo de un documento clínico que ya salió 11 veces con el otro
nombre. Los informes ya enviados **no** se tocan.

### 7 · El Δ del IAE dentro de la banda: lo cambiamos **nosotros**, contra su regla **[aplicado]**

Su entrega del **2026-09-01 §5** define el Δ del IAE como *"la distancia al límite del rango que se cruzó,
y **cero** mientras esté dentro de −5 a +5"*. El cero es suyo.

**Lo cambiamos a "—" (raya) dentro de la banda, y la razón es propia de esa fila y de ninguna otra:** el IAE
**ya es** una diferencia, así que la fila ponía dos números con signo uno al lado del otro ("+3,5" en Valor
y "0,0" en Δ), y el "0,0" se leía como si el IAE fuera cero. Conservamos la otra mitad de su regla: cuando
sí cruzó, el Δ da la distancia al límite.

**Nuestra recomendación:** dejar la raya. **Pero es preferencia nuestra contra su regla escrita, así que
dígalo:** ¿está de acuerdo, o vuelve el cero? Es una celda que ya se movió tres veces y conviene cerrarla.

### 8 · El borde exacto de ±5,0 del IAE, donde hoy Atlas se contradice consigo mismo

Su tabla 3 usa cortes **cerrados** (`≥ +5` acelerado, `≤ −5` desacelerado), y su capa de display anterior
(`dIAE`) los usaba **abiertos**. Atlas adoptó los cerrados de la tabla 3 para la banda.

**El problema está exactamente en ±5,0:** la banda dice "envejecimiento acelerado estimado" (porque 5 ≥ 5) y
el Δ, que usa el corte abierto, dice que está **dentro** del rango. En ese único valor, las dos columnas de
la misma fila se contradicen.

**Nuestra recomendación:** alinear el Δ a **su** corte cerrado, y entonces un IAE de exactamente +5,0 saldría
con banda "acelerado" y Δ "+0,0 años" (está justo en el límite, a cero de distancia). **No lo cambiamos
todavía** porque es su corte y porque reintroduce un "0,0" que la pregunta 7 acaba de retirar.

### 9 · Los tres cortes de la Diana, y si el radar se iguala a ella

El defecto que su v12 corrige (*"los estados leves caían en verde lima y se leían como bien"*) **está en
Atlas igual**, y por la misma causa: es el gradiente de su propia `rc()`, portado verbatim.

Son **tres números en una función** (0,19 · 0,45 · 0,62). Lo que no podemos es elegirlos nosotros: el color
de un veredicto clínico sale de su clasificador, no de nuestro criterio.

**Nuestra recomendación:** firme los tres cortes y díganos **si el radar de cinco dominios y las tarjetas
del DFI se igualan a ellos o se quedan como están**. Su v12 dice que igualarlos sería cambiar un color; en
Atlas son los mismos tokens clínicos, así que si se igualan, se igualan en todas las superficies a la vez.

### 10 · El aviso de síndrome de realimentación sale del motor viejo

Usted lo anotó en su v12 §8.2 y no lo corrigió: *"el aviso lo emite `motorProtocolo`, el motor viejo, no
`motorTratNutri`. Dos motores opinando sobre el mismo paciente."*

**Verificado en Atlas: está idéntico.** `alertaSindRealim` sale de `atlas-protocolo.authorized.js` (ese
mismo motor viejo) con la condición `['F7','F10'].includes(fenotipo) && GEB < 1200 && IMC < 18.5`. Es porte
fiel, así que el defecto viajó con él.

**Nuestra recomendación:** díganos si la condición se queda tal cual (y entonces no hay nada que hacer, solo
dejarlo escrito) o si el aviso pasa al motor nuevo con otra condición. Cuando lo decida, es una línea.

### 11 · La fuerza prensil obligatoria, **con salida**

La dinamometría es el criterio **primario** del EWGSOP2 y hoy Atlas la pide sin ofrecer alternativa: si no
está, la tarjeta de sarcopenia avisa de que falta y ahí termina. En la práctica, muchas consultas no tienen
dinamómetro a mano.

**Nuestra recomendación:** hacerla obligatoria **con una salida registrada**: "no se midió" más el motivo,
que es el patrón que este repositorio ya usa para los frenos sin alternativa (un freno sin salida no es un
guard: detiene a una persona). **Lo tiene que aprobar usted porque cambia la captura**, y porque un
"no se midió" con motivo es un dato clínico, no un campo administrativo.

### 12 · "La dirección científica" que elimina un perfil: en Atlas ese rol no ve pacientes **[aplicado]**

Su v12 §1.2 pide que eliminar un perfil tenga política, *"solo para el profesional dueño del paciente y
para la dirección científica"*. Está construido, con la asimetría que Santiago ya había fijado para esta
clase de acto: el profesional **pide** con motivo y otro **ejecuta**, escribiendo el documento del paciente.

**«Dirección científica» es SU palabra, no nuestra:** sale textual de su v12 §1.2, donde escribe que la
política sea *"solo para el profesional dueño del paciente y para la dirección científica"*. Lo decimos
porque la traducción que sigue es NUESTRA y conviene que se vea cuál es cuál.

**Y quien ejecuta es el ADMINISTRADOR, no el rol de dirección**, y esa es la traducción: en Atlas `direccion` **no accede a datos de paciente** por diseño (su tablero se construyó sin
PII), y esta bandeja necesita el nombre y el documento para poder decidir.

**Nuestra recomendación:** dejarlo en administrador, que es quien ya resuelve esta clase de decisión y quien
ya ve esos datos. Si quiere que sea literalmente la dirección científica, lo primero que hay que decidir es
si ese rol pasa a ver datos de paciente, que es un cambio de alcance mucho mayor y con consecuencias en
toda la aplicación.

---

## C · Dos cosas de la data que conviene que sepa antes de leer sus propios casos

### 13 · Dos de los ids de su anexo A son data de PRUEBA

El grupo de tres evaluaciones de su anexo (`5441fd96` / `b3e367cc` / `6256b921`, el que la columna `Edad`
del equipo no le cuadra a ninguno de los tres) es el **grupo de smoke**: pacientes creados por el equipo
para probar el sistema. Quedaron marcados como de prueba el 29 de octubre.

**Qué cambia con eso:** salen de las cifras, salen de la cohorte de investigación y dejan de aparecer como
alerta real. O sea que **el caso que usted describe ahí no es de un paciente**, y los otros diez grupos
siguen siendo reales (cinco de ellos entre pacientes distintos).

**Nuestra recomendación:** retírelos de su lista de errores 1 y 2, o reemplácelos por dos reales si quiere
el caso documentado. Nosotros mantenemos su anexo citado tal cual en nuestros documentos, con esta nota al
lado, para que las dos versiones se puedan cruzar.

### 14 · Los pacientes pediátricos: el equipo da grasa negativa y la v7 no los cubre

En la cohorte hay cuerpos de **22 kg y 29 kg**. El Biody aplica ecuaciones de adulto, y en esos cuerpos
devuelve **masa grasa negativa** (las dos grasas negativas de la tabla de la pregunta 4 vienen de ahí). No
es un error de digitación: es una fórmula aplicada fuera de su rango.

**Y la EB-BIS v7 está calibrada 18-100 años**, así que para esos pacientes no hay ni composición confiable
ni edad biológica que estimar.

**Nuestra recomendación:** decirlo en el sistema y no calcular: que esas consultas salgan **marcadas como
fuera de rango de calibración**, con la razón escrita, en vez de emitir cifras que no significan nada. Y si
CNV va a atender pediatría, hace falta decidir con qué ecuaciones, que es una decisión suya y no de software.


---

## D · Las que salieron al mirar el informe y la historia clínica impresos (2026-11-03)

Santiago descargó los dos documentos de un paciente y los leyó línea por línea. De ahí salen estas tres, y
las tres son sobre **cómo se le dicen sus índices y sus indicaciones a quien no es profesional**.

### 15 · Los nombres llanos de tres de sus índices **[aplicado]**

En la tabla ANI-BIS-E de la historia clínica, tres filas se nombraban con el rótulo técnico de su propia
tabla de HC, y Santiago no los entiende como los entendería un paciente: *"se muestran «Hidro-Homeostasis
IEHH», «PABU», «Desviación de φ ICA-BIS»... propongo que los cambiemos a definiciones que los pacientes
puedan entender y justo debajo la sigla, así como tenemos «Aceleración del Envejecimiento IAE», que me
parece muy bien hecho. **No estamos cambiando los indicadores**, solo la forma en como mostramos la info."*

**Lo aplicado, en una sola fuente para la historia clínica y la pantalla:**

| Código | Decía | Dice |
|---|---|---|
| IEHH | Hidro-Homeostasis | **Equilibrio hídrico** |
| PABU | (sin nombre) | **Proporción bioeléctrica** |
| ICA-BIS | Desviación de φ | **Desviación bioeléctrica** |

Sus **nombres oficiales** (los que usted fijó en su §10 del 2026-08-09) no se tocan: siguen en el registro
de indicadores y en la pantalla del profesional, al lado del llano. Las otras cinco filas no se mueven,
porque sus nombres ya son llanos o los fijó su tabla 3.

**Y en la tercera nos apartamos de lo que se nos pidió, con una razón que conviene que juzgue usted.** Se
propuso *"Coherencia bioeléctrica"*, y pusimos *"Desviación bioeléctrica"*: el número que va al lado **es
una desviación**, y su columna de referencia dice "0.00–0.15 Zona φ", o sea que cuanto más pequeño, mejor.
Rotular "coherencia" encima de un valor donde lo bueno es lo bajo invierte la lectura: un 0,15 se leería
como poca coherencia cuando es justo la zona buena.

**Nuestra recomendación:** dejar "Desviación bioeléctrica". Si prefiere "Coherencia", habría que mostrar
el complemento (1 − ICA-BIS) o la clasificación en vez de la cifra, y eso ya es una decisión suya sobre
qué se muestra.

### 16 · Los cinco textos de dominio del informe, en lenguaje sencillo **[aplicado, PROVISIONAL]**

La hoja 2 del informe del paciente trae sus cinco lecturas del DFI tal cual. Un paciente lee esto:

> *"Homeostasis celular: membranas íntegras y microambiente equilibrado."*
> *"Carga contextual amplificada por antecedentes o entorno."*

**No lo hemos tocado, y es a propósito:** son textos clínicos suyos, y la regla de esta casa es que no se
editan, no se resumen ni se reinterpretan desde nuestro lado. Lo que sigue es una **propuesta**, no algo
aplicado:

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

> **APLICADO COMO PROVISIONAL el 2026-11-06, por decisión de Santiago.** Textual suya: *"Los cinco textos
> de dominio son jerga. Aplica ya la propuesta en lenguaje sencillo, marcada como provisional."* El
> argumento es que un informe que el paciente no entiende no cumple su función tampoco mientras espera.
>
> **Lo que esto NO toca, que es lo que lo hace reversible en una línea:** el motor sigue intacto con sus
> veinte lecturas y su candado de diferencia byte a byte; **el profesional sigue leyendo las suyas** (esta
> capa es solo del documento del paciente); y el mapa de paciente que usted ya tenía escrito
> (`_dfiPac`) tampoco se tocó. Lo nuestro vive en un archivo aparte
> (`clinical-engine/lectura-sencilla-provisional.ts`) que se borra de una pieza el día que usted conteste.
>
> **Y son VEINTE y no cinco.** Su clasificador tiene cuatro niveles por dominio y la propuesta de arriba
> traía un ejemplo de cada dominio, cada uno de un nivel distinto. Aplicar solo esos cinco habría dejado
> quince lecturas en jerga y cinco en castellano, que se lee peor que las veinte iguales. Las quince que
> faltaban las escribimos con las mismas reglas: una por nivel, ni un término técnico, **sin suavizar la
> gravedad** (un nivel 3 sigue diciendo que hace falta atención) y sin agregar nada que su lectura no
> diga. **Su regla del dominio conductual con severidad alta manda sobre esta capa:** ahí sigue saliendo
> su frase de acompañamiento, y nuestra capa calla.

### 17 · Las rutas no tienen una versión escrita para el paciente, y un área se queda muda

Esta **frena una pieza**, así que si solo contesta una de las tres, que sea esta.

Su contenido de rutas está escrito para el profesional, y así llega hoy al informe del paciente:
*"Distribución proteica: ≥25g por comida"*, *"Carga: 65–75% de 1RM · 3 series × 8–12 repeticiones"*,
*"Crucíferas: sulforafano → Nrf2 → protección epigenética"*.

Santiago pidió que eso salga del documento del paciente (las dosis van calculadas para él en la hoja del
plan, la receta de ejercicio la recibe de quien lo entrena, y el mecanismo molecular no le sirve). Lo
hicimos **suprimiendo, no reescribiendo**, que es la única forma que esta casa admite con su contenido.

**Y al suprimir, una de las seis rutas se queda sin UNA SOLA línea para el paciente: la R4,
«Desaceleración del Envejecimiento».** Sus tres componentes son exactamente eso (proteína en g/kg,
alimentos antioxidantes, resistencia progresiva). No es un hueco de nuestro filtro: **es que esa versión
no existe**.

Hoy el informe dice, en esa área, que se trabaja con el profesional en la consulta y que lo de
alimentación va en la hoja del plan. Es verdad, pero es un parche.

**Nuestra recomendación:** dos o tres frases por ruta, escritas por usted, de *qué va a trabajar* el
paciente, sin dosis ni mecanismos. Con eso la hoja 3 deja de ser un parche y el informe dice lo que
promete. Son dieciocho frases en total (tres por ruta), y las construimos el mismo día que lleguen.

### 18 · Sus pacientes: cuáles son de prueba, porque desde fuera no se distinguen

**Esta es suya y solo suya, y es corta de contestar.**

En Atlas tiene **95 pacientes asignados** y **70 distintos en sus 80 consultas**. De esas 80, ninguna está
cerrada: 53 en borrador, 14 en curso y 13 esperando encuesta. Mientras no se sepa cuáles son pruebas
suyas, esos pacientes y esas consultas entran en las cifras de la cohorte y en el export de investigación.

**Lo que hicimos antes de preguntarle:** buscar los obvios por la FORMA del dato, con un criterio escrito
y estrecho a propósito (atrapa lo imposible, nunca lo improbable): documento de menos de 6 cifras, de una
sola cifra repetida o en secuencia; nombre con una palabra de una letra repetida, con una sola letra, con
un teclazo, o que se diga a sí mismo "prueba/test/demo".

**Resultado: UNO de 95.** Los otros 94 tienen documentos de 7 a 10 dígitos y nombres de 2 a 5 palabras,
o sea que **por su forma son indistinguibles de un paciente real**. No podemos señalarlos sin inventar.

**Lo que le pedimos:** la lista con nombres y documentos se la pasa Santiago aparte (no va al repositorio).
Marque cuáles son suyos de prueba. El marcado lo hace el sistema por su flujo, con su motivo y su rastro;
nadie va a tocar la base por detrás.

---

## Qué pasa con cada respuesta

| Pregunta | Qué se desbloquea |
|---|---|
| 1 y 2 | Se construye la EB-BIS v7 (parámetros 7.1.0) y se recalcula el histórico |
| 3 | Entra el motor calórico nuevo, con bump de versión, y con él el flujo guiado del nutricionista |
| 4 | Entran los rangos del control de calidad biológico (las once identidades ya están) |
| 5 | Se cierra qué pasa con las consultas que el recálculo no puede tocar |
| 6, 7 y 8 | Se cierra el rótulo y el formato de la fila de la EB-BIS, que ya se movió tres veces |
| 9 | Entran los colores de la Diana |
| 10 y 11 | Dos piezas de una línea cada una, que hoy no se tocan porque son suyas |
| 12 | Se confirma quién puede eliminar un perfil (hoy: el administrador) |
| 13 y 14 | Nada que construir: es data que conviene que usted sepa antes de leer sus casos |
| 15 | Se cierra cómo se nombran sus índices de cara a quien no es profesional |
| 16 | El informe lleva SUS cinco lecturas en lenguaje de paciente, y las de hoy siguen para el profesional |
| **17** | **La hoja 3 del informe deja de ser un parche: hoy un área entera se queda sin nada que decirle al paciente** |

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
