# Ronda del 2026-09-02

**Abierta el 2 de septiembre y cerrada el 3, con la del 1 ya enviada.** Ninguno de los siete puntos es una
respuesta a lo que todavía tienes en el escritorio. Vienen de tres sitios distintos, y vale separarlos
porque lo que te pedimos en cada grupo es distinto:

| Puntos | De dónde salen | Qué son |
| --- | --- | --- |
| **1 a 3** | Revisar tu entrega del 2 contra tu documento | **Tu documento y tu archivo no dicen lo mismo**, o tu archivo no dice lo mismo en dos sitios. No son desacuerdos con tu criterio |
| **4 y 5** | El trabajo de estos dos días | Casos que aparecieron al construir y que dos reglas tuyas resuelven distinto |
| **6 y 7** | **Valentina, usando la encuesta con pacientes** | Observaciones sobre el instrumento. No son nuestras, y no hemos tocado nada |

## De un vistazo

| # | Qué es | Qué te pedimos | ¿Bloquea? |
| --- | --- | --- | --- |
| **1** | **Tu archivo del 2 de septiembre encendió `LE8_MAPEO_CORREGIDO`, y el comentario que lo acompaña dice que así no se enciende** | Confirmar si fue deliberado. **No lo portamos hasta que respondas** | **Sí**: bloquea portar tu `engine.dfi` |
| **2** | **El bloque de código del mapa de regiones no venía en la entrega**, aunque el documento dice que va | Que nos lo mandes | Sí, para construir el recorte por ciudad |
| **3** | Tu punto 0 pide convertir la frecuencia de consumo en porciones, pero **tus 18 grupos y los 21 subgrupos de la lista de intercambio no son uno a uno** | La correspondencia entre unos y otros. **No te pedimos el dato, te pedimos el mapa** | Sí, para el consumo actual |
| **4** | **Dos frases tuyas se contradicen en un caso que ninguna contempla**: reabrir una prescripción y volver a aprobarla **sin cambiar nada** | Cuál de las dos manda ahí, con nuestra propuesta al lado | No, pero decide qué le llega al paciente |
| **5** | Un campo de la cadena calórica que se queda **vacío** produce una prescripción implausible sin que nada lo distinga de una decisión | Si esos campos deben tener un valor por defecto que no se pueda borrar. **No te pedimos validar una cifra** | No |
| **6** | **P24 no tiene dónde marcar "no hago ejercicio"**, y dejarla en blanco impide diagnosticar | Si le agregas una opción. **Observación de Valentina usando el instrumento** | No, pero hoy obliga a contestar algo falso |
| **7** | **P43 y P44 hablan idiomas distintos** (alimentos contra sustancias), y el paciente no distingue alergia de intolerancia | El lenguaje de las opciones, y si separarlas tiene sentido para quien responde | No |

---

# 1 · El interruptor del LE8 quedó encendido, y tu propio archivo dice que así no

**Esto lo escribimos con cuidado, porque es señalarte una contradicción dentro de tu archivo, no discutirte
un criterio.** Puede que sea deliberado y que la recalibración venga aparte. Preferimos preguntarlo a
portarlo.

## Lo que cambió entre tus dos entregas

En la del **1 de septiembre**: `const LE8_MAPEO_CORREGIDO = false;`
En la del **2 de septiembre**: `const LE8_MAPEO_CORREGIDO = true;`

## Y lo que sigue escrito, intacto, en la MISMA entrega del 2

Tu comentario pegado a esa línea, entero:

> **DESACTIVADO A PROPÓSITO, NO PONER EN true SIN RESOLVER LO SIGUIENTE.** Activarlo baja la EB-BIS de
> TODOS los pacientes entre 1 y 8 años (más cuanto más sano está el paciente), porque el ICEC deja de estar
> artificialmente deprimido. Antes hay que establecer de dónde salieron la media 58,578 y la desviación
> 13,332 del ICEC en la ecuación EB-BIS v5:
>
> - si se calcularon sobre un ICEC correcto, activar esto CORRIGE un sesgo real y las edades biológicas
>   emitidas hasta hoy estaban infladas;
> - si se calcularon sobre el ICEC ya roto, μ y σ incorporan el sesgo y hay que recalibrarlas ANTES, o
>   todos quedarán con edad biológica demasiado joven.
>
> **CONDICIÓN DE ACTIVACIÓN (Dirección Científica, 9-ago-2026).** El ICEC es el componente contextual que
> afecta la edad bioeléctrica, y por tanto NO puede activarse el mapeo dejando intactas la media y la
> desviación con que se estandariza. **Se recalibran en el MISMO acto, nunca por separado.**
>
> Para poner esto en `true` hacen falta las dos cosas a la vez: **1.** Recalcular μ y σ del ICEC sobre la
> base de datos con el mapeo YA corregido. **2.** Sustituir esos dos números en la llamada a `_zBis`.
>
> Recalcular μ y σ es un cálculo sobre nuestros propios registros, no una decisión de diseño: **mientras no
> exista, esta bandera se queda en `false`.**

Y el 30 de agosto nos lo habías escrito a nosotros con las mismas palabras: *"la media 58,578 y la
desviación 13,332 del ICEC no están establecidas... el interruptor se queda en `false`. No lo enciendan por
partes ni por su cuenta."*

## El dato que hace la pregunta

**Los dos números no se movieron.** La llamada del término contextual sigue diciendo, byte por byte igual
que el 1 de septiembre:

```
+ (-7.982) * _zBis(_icecVal, 58.578, 13.332)    // Contextual (ICEC/LE8)
```

O sea que la primera condición está, y la segunda no.

## Qué hicimos y qué te preguntamos

**No lo portamos.** Atlas se queda con el interruptor en `false` hasta que respondas. No es corregirte la
ciencia: es no aplicar un cambio que tu propio archivo declara incompleto sin el otro medio.

**Tres salidas posibles, y cualquiera nos sirve:**

1. **Recalibraste y los números nuevos vienen aparte.** Mándanoslos y portamos las dos cosas juntas.
2. **Fue un cambio de prueba que se quedó puesto.** Nos lo dices y sigue en `false`.
3. **Decidiste activarlo sin recalibrar**, con una razón que no conocemos. Escríbela y la aplicamos, pero
   queremos que quede dicha: por tu propia cifra, la edad bioeléctrica de todos baja entre 1 y 8 años.

**Mientras tanto queda un candado en nuestro lado** que se pone en rojo el día que μ y σ cambien, para que
la recalibración no se nos pase.

---

# 2 · El bloque del mapa de regiones no venía en la entrega

**Tu §10.4 dice: "el bloque de código va en la entrega, con las diez zonas, las ciudades, el núcleo y la
función que resuelve la lista a partir de la ciudad. Está probado: Barranquilla resuelve a Caribe, Pasto a
Nariño, una ciudad desconocida devuelve los 350, y funciona con o sin tildes."**

**Lo buscamos y no está.** En el `ATLAS_v8.html` del 2 de septiembre no aparece ninguna de las diez zonas
(ni "Cundiboyacense", ni "Orinoquía", ni "Insular", ni "Eje Cafetero"), ni el núcleo nacional, ni una
función que resuelva la ciudad. "Barranquilla" sale una sola vez, y es en la lista de ciudades del
formulario, la misma que estaba en la entrega anterior.

**Suponemos que se quedó sin pegar.** El criterio sí llegó completo y es el que necesitábamos: las diez
zonas con lo que marca cada una, el núcleo de 56 alimentos que va siempre, y las dos reglas (ciudad
desconocida devuelve la lista completa; 111 ciudades mapeadas).

**Lo que te pedimos: el bloque.** Con él construimos; sin él tendríamos que reconstruir la asignación
alimento-zona a mano, y ahí sí estaríamos inventando contenido clínico. **Es la única de las cinco cosas de
esta ronda donde no hay nada que podamos hacer mientras tanto.**

---

# 3 · La lista de intercambio sí tiene porciones, pero tus grupos y sus subgrupos no son uno a uno

**Tu punto 0 dice que la frecuencia de consumo no se convierte en porciones**, y que el consumo actual del
paciente se estima desde la lista de intercambio. Fuimos a hacerlo y nos frenó una cosa concreta que no
podemos resolver sin ti.

**No es que falte el dato: la lista tiene las porciones.** Lo que no tenemos es **la correspondencia** entre
los 18 grupos con que la encuesta pregunta y los 21 subgrupos con que la lista reparte.

## Dónde calza directo (6 de 18)

| Tu grupo de la encuesta | Subgrupo de la lista |
| --- | --- |
| Leguminosas | Leguminosas |
| Cereales | Cereales |
| Tubérculos | Raíces, tubérculos y plátanos |
| Frutas | Frutas |
| Grasas saturadas | Grasas saturadas |
| Alcohol | Bebidas alcohólicas |

## Dónde no, y por qué cada caso es distinto

| Caso | El problema |
| --- | --- |
| **Carnes rojas · Pollo y pavo · Pescado** | Son **tres** grupos en la encuesta y la lista reparte por contenido graso: "carnes magras" y "carnes altas en lípidos". No es un corte por animal, así que no podemos repartirlos sin tu criterio |
| **Huevos** | En la encuesta es un grupo propio; en la lista va dentro de "sustitutos (embutidos, quesos, huevo)", junto a cosas de perfil muy distinto |
| **Verduras crudas · Verduras cocidas** | **Dos** grupos en la encuesta, **un** subgrupo en la lista |
| **Grasas saludables** | Un grupo en la encuesta que se reparte en **cuatro** subgrupos de la lista |
| **Agua pura · Café y té** | **No tienen subgrupo en la lista.** El agua además se captura aparte, en su propia pregunta |

## Y una cosa que vimos en tu archivo, por si cambia la respuesta

En la entrega vigente **`calcConsumo` está como stub vacío**, con tu nota: *"mantener `calcConsumo` como
stub vacío para no romper referencias"*. O sea que hoy la conversión no la hace tu prototipo tampoco.

**Lo que te pedimos: el mapa, no el dato.** Para cada uno de los 18 grupos, a qué subgrupo (o subgrupos, y
en qué proporción) corresponde. Con eso lo construimos. **No lo resolvemos por nuestra cuenta porque
repartir "carnes rojas" entre magras y altas en lípidos es una decisión clínica, no de programación.**

---

# 4 · Un tratamiento reemitido que es idéntico al anterior: ¿se le avisa al paciente?

**Es un caso que apareció al construir, no una duda de lectura.** Desde esta semana un profesional puede
aprobar una prescripción, reabrirla escribiendo el motivo, y volver a aprobarla. Si en el medio **no cambia
nada**, queda un tratamiento reemitido cuya prescripción es idéntica a la anterior.

**Y ahí tus dos reglas apuntan a lados distintos:**

| | |
| --- | --- |
| Tu §12c | *"Un tratamiento reemitido **se avisa SIEMPRE**, porque cambia lo que la persona come."* |
| Tu misma §12c, dos frases antes | *"Si no cambia ninguna de las dos, queda el registro de versión en la historia y no se le manda nada: **NO SE ALARMA A NADIE POR UN DECIMAL**."* |

La primera mira el ACTO (hubo una reemisión). La segunda mira el EFECTO (no cambió nada para el paciente).
En el caso idéntico las dos aplican y dicen cosas opuestas.

## Qué hace Atlas hoy, para que decidas sobre lo que hay

Hoy **avisamos siempre**, porque la condición que usamos es el acto: en cuanto hay una aprobación anterior
archivada, la pantalla le dice al profesional que esta prescripción reemplaza a otra que el paciente ya
recibió y que tiene que enviarle el reporte nuevo. **Aunque las cifras sean exactamente las mismas.**

**Lo que sí conservamos siempre, y no proponemos tocar:** la reapertura queda registrada en la historia con
su motivo, cambien o no las cifras. Es tu formulación del sellado, *"no es un candado: es una consecuencia
registrada"*, y ahí no vemos discusión.

## Nuestra propuesta

**Derivar si la prescripción cambió, y avisar al paciente solo entonces.** Podemos comparar la
prescripción archivada contra la nueva (objetivo calórico, gramos de proteína, restricciones, porciones) y
distinguir dos casos:

- **Cambió algo** → se avisa, como hoy.
- **Es idéntica** → queda el registro en la historia, y al paciente no se le manda un documento nuevo que
  dice lo mismo que el que ya tiene.

**Por qué nos parece la lectura correcta de las dos frases juntas:** tu regla del decimal existe para no
alarmar por algo que no cambia nada para la persona, y una prescripción idéntica es el caso extremo de eso,
no una excepción. La regla del "siempre" está escrita pensando en la reemisión típica, que **sí** mueve
cifras.

**Pero es tuya la decisión, y hay un argumento en contra que no descartamos:** que una reemisión sea un
acto del que el paciente debe enterarse **aunque el contenido no cambie**, porque su plan fue reabierto y
revisado. Si es así, lo dejamos como está y no tocamos nada.

**La pregunta, concreta:** ¿el aviso al paciente cuelga del ACTO (hubo reemisión) o del EFECTO (cambió lo
que come)?

**Mientras respondes, no cambiamos nada:** se sigue avisando siempre, que es el lado conservador.

---

# 5 · Un campo vacío se lee igual que una decisión, y ahí sí podemos hacer algo

**Empezamos aclarando lo que NO te estamos pidiendo**, porque tu regla es clara y no la discutimos:
*"Ninguna cifra de la prescripción nutricional lleva techo, piso, validación ni advertencia"* (§5 del 27 de
agosto, y dijiste expresamente que vale para TODA la prescripción). **El motor propone, el profesional
dispone.** No queremos validar ninguna cifra.

**El caso, real, de una prueba de esta semana.** Un paciente salió con esta prescripción:

| | |
| --- | --- |
| Objetivo | 2.000 kcal |
| Proteína | 58 g |
| Carbohidratos | **427 g** |
| Grasa | **7 g** |

**Las cuatro cifras son correctas**: lo reprodujimos exacto, y salen de que el porcentaje de grasa quedó en
**3 %**. La cadena hizo lo que le pidieron; con 3 % de grasa quedan 63 kcal de grasa y los carbohidratos
absorben el resto. Barrimos los cincuenta tratamientos de la base y **ninguno produce eso solo**: el 3 % se
escribió en el campo.

**Y aquí está la pregunta, que es de OTRA cosa.** Hoy ese campo se puede dejar en blanco, y cuando está en
blanco el sistema usa tu valor por defecto (30 %). Pero **un valor escrito a mano y un campo mal borrado se
ven exactamente igual desde el motor**: los dos son "lo que el profesional dejó ahí".

**La pregunta:** ¿los campos de la cadena calórica deberían tener un valor por defecto que **no se pueda
dejar vacío**, de modo que borrarlo lo devuelva al del modelo en vez de dejarlo en un número suelto?

**No es validar una prescripción**, y por eso creemos que no choca con tu regla: **es evitar que un campo
vacío se lea como un 3 %**. Si un profesional escribe 3 % a propósito, el sistema lo respeta, igual que hoy.

**Si te parece que esto también es meterse donde no debemos, se queda como está.** Lo preguntamos porque la
diferencia entre "lo decidió" y "se le borró" no la puede resolver el motor, y quien la paga es el paciente.

---

# 6 · P24: un paciente que no hace ejercicio no tiene dónde marcarlo

**Esta observación y la siguiente son de Valentina, usando el instrumento con pacientes.** No son nuestras
y no hemos tocado nada: la encuesta es tuya, y el texto y las opciones también.

## Lo que dice hoy, textual

| | |
| --- | --- |
| **P23** (`d3_23`) | *"¿Cuántos días/semana hace actividad física (≥30 min)?"* — opciones **0** a 7 |
| **P24** (`d3_24`) | *"¿Cuánto dura cada sesión?"* — **Menos de 15** · 15-30 min · 30-45 min · 45-60 min · Más de 60 min |

**La 23 sí permite decir "ninguno". La 24 arranca en "menos de 15 minutos".** Un paciente sedentario ya
dijo que no hace ejercicio ningún día, y la pregunta siguiente le pide la duración de unas sesiones que no
existen.

## Y verificamos qué pasa hoy, porque cambia el tamaño del problema

**La P24 sigue apareciendo aunque conteste 0 días.** La encuesta no tiene saltos condicionales: todas las
preguntas se muestran siempre.

**Y dejarla en blanco no es una salida:** el diagnóstico exige la encuesta completa, así que una P24 vacía
**impide diagnosticar** hasta que alguien la llene. O sea que hoy el paciente sedentario tiene que marcar
una duración que no hace.

**Lo que sí verificamos es que el dato del modelo no se corrompe:** el LE8 calcula
`metMin = días × minutos`, y con 0 días el producto es 0 sea cual sea la duración marcada. **El puntaje
no cambia.** Lo decimos porque acota el riesgo: el problema es de instrumento y de lo que queda escrito en
la historia, no del cálculo.

## Lo que te pedimos

**Si le agregas una opción a la P24** (del tipo "No hago ejercicio" o "No aplica"), la ponemos. **O si
prefieres que la P24 desaparezca cuando la 23 responde 0**, también, pero eso es un salto condicional y
la encuesta hoy no tiene ninguno: sería el primero, y la decisión de estrenarlo es tuya.

---

# 7 · P43 y P44: el paciente no distingue alergia de intolerancia, y las dos preguntas hablan idiomas distintos

**La observación de Valentina es sobre la P44:** los pacientes no saben qué es la fructosa o el gluten, y
responden con alimentos ("frijoles", "leche"). Hay opción "Otra", pero se está usando para lo que debería
estar en la lista.

**Al ir a mirarlo apareció algo más, y es lo que hace la pregunta:**

| | |
| --- | --- |
| **P43** (`d6_43`) | *"¿Alergias alimentarias diagnosticadas?"* — Ninguna · **Leche · Huevo · Maní · Trigo · Soya · Pescado · Mariscos** · Otra |
| **P44** (`d6_44`) | *"¿Intolerancias alimentarias?"* — Ninguna · **Lactosa · Gluten · Fructosa** · Otra |

**La 43 habla en ALIMENTOS y la 44 en SUSTANCIAS**, y van una detrás de la otra. Para quien responde, "leche"
está en la primera lista y "lactosa" en la segunda: alguien con intolerancia a la lactosa encuentra la
palabra que reconoce en la pregunta de ALERGIAS, que es la que no le corresponde.

**Y la mitad de fondo, que Santiago plantea sin saber la respuesta:** son cosas distintas clínicamente (una
inmune, otra digestiva), pero preguntarlas por separado supone que el paciente ya sabe cuál de las dos
tiene. Muchos no lo saben, y algunos ni siquiera con diagnóstico médico de por medio.

## Lo que te pedimos, en dos mitades

1. **El lenguaje de las opciones de la P44.** Si aterrizarlas a alimentos (leche/lácteos, trigo o pan,
   frutas) sirve mejor, mándanos la lista y la ponemos tal cual.
2. **Si separar las dos preguntas tiene sentido para quien responde.** No te pedimos que las unas: te
   preguntamos si la distinción es del paciente o del profesional. Si es del profesional, quizá el paciente
   deba marcar el alimento y la clasificación la haga quien lo atiende.

**No tocamos nada mientras respondes.** Las dos preguntas siguen exactamente como están.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
