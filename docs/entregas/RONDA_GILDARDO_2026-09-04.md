# Ronda del 2026-09-04

**Ocho puntos, y ninguno te pide construir nada nuevo.** Salieron de portar tu entrega del 3 de
septiembre y de revisar los dos PDF que produce Atlas hoy: son cosas que ya están escritas en tu archivo y
que ahí adentro se contradicen, o que tu propio código ya resuelve en un sitio y no en otro.

Vale separarlos porque lo que te pedimos en cada grupo es distinto:

| Puntos | De dónde salen | Qué son |
| --- | --- | --- |
| **1 y 5** | Cotejar tus dos superficies del mismo dato | **Tu archivo dice dos cosas distintas del mismo estado.** No son desacuerdos con tu criterio |
| **2 y 3** | Tu entrega del 3 contra la del 2 | Cambios entre entregas que **no portamos** hasta que confirmes que son deliberados |
| **4** | Tu punto 3 del 3 de septiembre | Una pieza que declaras muerta y que **en Atlas está viva** |
| **6 a 8** | Portar tu mapa de regiones y mirar el PDF que recibe un paciente | Cosas que aparecieron al ejecutar tu bloque completo y al leer el documento impreso |

## De un vistazo

| # | Qué es | Qué te pedimos | ¿Bloquea? |
| --- | --- | --- | --- |
| **1** | **Los rótulos de los nueve sectores IFC × IRC dicen lo contrario de sus bandas en tres casos, y dos de ellos están intercambiados entre sí.** Quien tiene función alta con inflamación alta lee "Disfunción sin riesgo"; quien tiene función celular baja lee "Función estable". **Sale en dos pantallas y en ningún documento** | Confirmar el intercambio y los rótulos correctos. **No los tocamos** | **Sí**: es texto clínico que el profesional lee hoy |
| **2** | `LE8_MAPEO_CORREGIDO` sigue encendido, y van **tres entregas** con mu y sigma sin recalibrar | Lo mismo que te preguntamos el 3. Sigue sin portarse | **Sí**: bloquea portar tu `engine.dfi` |
| **3** | Tu entrega del 3 **retira** de `motorTratNutri` toda la prescripción de proteína y el gasto basal, que es lo que nos mandaste portar el 1 | Si la retirada es deliberada. **No la portamos** | **Sí**: es la cifra que se prescribe |
| **4** | Declaras `generarAlertas` pieza muerta "marcada para borrarse". **En Atlas está viva**: sus quince reglas se muestran en dos sitios de la pantalla de evaluación | Que no la borres, o que nos digas con qué se reemplaza | **Sí** si la borras |
| **5** | Veintiún estados EFR muestran "—" en mecanismo y biomarcadores. **Tu propio `efrCompose` ya escribe esos textos**; lo que lo impide es la forma de la caída de `getDX` | Cuál de tus dos caídas manda. **No te pedimos escribir veintiún textos** | No |
| **6** | **Tumaco y Cartago están cada uno en dos regiones** de tu mapa, así que su región la decide el orden de las claves del objeto | A qué región va cada uno | No |
| **7** | Entre seis y ocho subgrupos por región **quedan sin ningún alimento**. Y **dos de ellos son grupos que el plan SÍ prescribe**: el mismo documento dice "Azúcares y dulces: 1 porción" y tres páginas después entrega una lista vacía para ese grupo | Cuál manda: que el reparto no asigne porciones a un grupo que la región no surte, o que la región lleve un alimento de cada grupo que el reparto usa | No, pero el documento se contradice |
| **8** | **Cuatro erratas en tu tabla de alimentos** ("instántaneo", "azticar", "panels"), que salen impresas en el documento del paciente | Que nos digas si las corregimos. **No las tocamos por nuestra cuenta** | No |

---

# 1 · Los rótulos de los nueve sectores dicen lo contrario de sus bandas

**Este es el que más nos preocupa, porque es texto que el profesional está leyendo hoy** al lado del
diagnóstico, y en dos de los tres casos el error apunta hacia el lado tranquilizador.

## Los dos juegos de rótulos que tiene tu archivo

Tu archivo nombra los nueve sectores IFC × IRC en dos sitios, y no dicen lo mismo:

- `FYR_LABELS`, en la aplicación principal. Es el que portamos y el que Atlas muestra.
- El campo `cn` de `SEC` (A1 a A9), en tu visor de los 81 estados.

Los pareamos **por su clave IFC_IRC**, no por posición, porque los dos objetos están en orden distinto y
pareados por posición dan un resultado falso (nos pasó en el primer intento):

| Sector | Clave | Bandas | `FYR_LABELS` (lo que Atlas muestra) | `cn` de tu visor |
| --- | --- | --- | --- | --- |
| A1 | 3_1 | IFC Alto / IRC Bajo | Estado celular óptimo | Óptimo celular |
| A2 | 3_2 | IFC Alto / IRC Normal | Estado fisiológico estable | Función alta, riesgo basal |
| A3 | 2_1 | IFC Normal / IRC Bajo | Buen desempeño, señales tempranas | Función basal favorable |
| A4 | 2_2 | IFC Normal / IRC Normal | Desempeño normal, riesgo moderado | Función basal estable |
| **A5** | **3_3** | **IFC Alto / IRC Alto** | **Disfunción sin riesgo** | Función alta con inflamación |
| A6 | 2_3 | IFC Normal / IRC Alto | Disfunción + riesgo creciente | Alerta funcional |
| **A7** | **1_1** | **IFC Bajo / IRC Bajo** | **Alto desempeño, riesgo oculto** | Disfunción sin inflamación |
| **A8** | **1_2** | **IFC Bajo / IRC Normal** | **Función estable, riesgo elevado** | Disfunción incipiente |
| A9 | 1_3 | IFC Bajo / IRC Alto | Estado crítico | Disfunción con inflamación |

## Lo que salta al leer las tres filas marcadas

**A5 y A7 están intercambiados, y no aproximadamente: cada uno lleva la descripción exacta del otro.**

- **3_3 es IFC Alto con IRC Alto.** Eso es alto desempeño con riesgo alto, que es justamente
  "Alto desempeño, riesgo oculto"... que está guardado en 1_1.
- **1_1 es IFC Bajo con IRC Bajo.** Eso es disfunción sin riesgo, que es justamente
  "Disfunción sin riesgo"... que está guardado en 3_3.

**Y A8 (1_2) dice "Función estable" de un paciente cuyo IFC es Bajo.** Ese no forma pareja con ninguno;
es el tercero, aparte.

En los nueve casos, el `cn` de tu visor sí concuerda con las bandas. O sea que la versión correcta la
tienes escrita, en el mismo archivo.

## Por qué esto no es cosmético

El rótulo sale en **dos sitios de Atlas**: en la línea **"Estado funcional bioeléctrico (IFC × IRC)"** de
la tarjeta de resultados, y como nombre del anillo en el desglose de la Diana.

Las dos lecturas concretas, que son las que preocupan:

- Un paciente con **IFC Alto / IRC Alto** (función alta con inflamación alta) tiene en pantalla
  **"Disfunción sin riesgo"**.
- Un paciente con **IFC Bajo / IRC Normal** (función celular baja) tiene en pantalla
  **"Función estable, riesgo elevado"**.

**Los dos errores empujan hacia el lado tranquilizador**, que es el que nadie vuelve a revisar. Si
apuntaran al lado alarmista, un profesional los cuestionaría al leerlos.

## Hasta dónde llega, que es lo que acota la urgencia

**Lo verificamos, y son buenas noticias: el rótulo NO viaja a ningún documento.**

- **No está en el reporte del paciente.** El documento no recibe siquiera el dato: `frSector` se retiró de
  su entrada junto con los bloques que tu §7.1 no pide, así que no puede filtrarse por descuido.
- **No está en la historia clínica**, ni en pantalla ni en el PDF.

O sea que **vive solo en la pantalla del profesional**, y ningún paciente ha recibido un documento que lo
diga. Eso baja la urgencia de "hay que avisar a pacientes" a "hay que corregirlo antes de que alguien
tome una decisión con ello delante". Sigue siendo lo primero de esta ronda.

## Qué hicimos y qué te pedimos

**No tocamos nada.** Los rótulos son contenido tuyo y la Regla 0 dice que se representan literalmente,
incluso cuando lo que representan nos parece un error. Atlas sigue mostrando `FYR_LABELS` tal cual.

Te pedimos dos cosas concretas:

1. **Confirmar el intercambio de 3_3 y 1_1**, que es la lectura que hacemos de la tabla.
2. **Decirnos qué texto va en 1_2**, que no forma pareja con ninguno.

Si la respuesta es que el juego bueno es el `cn` de tu visor, lo portamos entero y se acaba la
duplicidad. Es lo que recomendaríamos, porque un dato con dos versiones acaba divergiendo siempre.

---

# 2 · El interruptor del LE8, tercera entrega encendido

**Es el punto 1 de la ronda del 3, sin novedad.** Lo repetimos porque cambió una cosa: ya no es un
cambio reciente, es un estado que persiste.

`LE8_MAPEO_CORREGIDO` está en `true` desde tu entrega del 2 de septiembre. La del 3 lo mantiene. Y en las
dos, la llamada del término contextual sigue diciendo `_zBis(_icecVal, 58.578, 13.332)`, byte por byte
igual que el 1 de septiembre.

El comentario que acompaña la bandera, **que sigue intacto en el archivo de hoy**, exige las dos cosas a
la vez: recalcular mu y sigma sobre la base con el mapeo ya corregido, **y** sustituir esos dos números en
la llamada. Textual tuyo: *"Se recalibran en el MISMO acto, nunca por separado"*.

**Atlas no porta el cambio.** El frozen se queda en `false`, y va con candado: el día que mu y sigma dejen
de ser 58.578 y 13.332, ese candado se pone rojo y portamos las dos cosas juntas.

Con tu propia cifra de lo que está en juego: encenderlo sin recalibrar *"baja la edad bioeléctrica de
todos los pacientes entre 1 y 8 años, más cuanto más sano esté el paciente"*.

---

# 3 · Tu entrega del 3 retira la proteína y el gasto basal de `motorTratNutri`

**El 1 de septiembre nos mandaste portar la prescripción de proteína del motor** (tu §9.6 punto 4:
"la proteína la prescribe el motor, no el mínimo poblacional"). Lo portamos el 3, con su cadena de
sellado y su tolerancia para los tratamientos anteriores.

**Tu entrega del mismo 3 de septiembre retira de `motorTratNutri` toda esa prescripción, y también el
gasto basal.**

No lo portamos, y la razón es la asimetría del riesgo: si la retirada es deliberada, portarla tarde
cuesta un día; si es un descuido de edición, portarla deja a Atlas sin la cifra de proteína que tú mismo
acababas de mandar prescribir.

**Qué prescribe Atlas hoy**, para que decidas sobre lo que hay: la proteína del motor tal como estaba en
tu entrega del 2, con el ajuste del profesional por encima cuando lo hay. El oráculo de nuestro candado
de la cadena calórica quedó anclado a esa entrega del 2, **declarado y con fecha**, no en silencio.

Te pedimos una sola frase: si la retirada es deliberada, la portamos; si no, la ignoramos y seguimos con
la del 2.

---

# 4 · `generarAlertas` está marcada para borrarse, y en Atlas está viva

En tu punto 3 del 3 de septiembre escribiste, sobre `calcConsumo`, `generarAlertas` y `TCAC`:

> Son tres piezas muertas que además insinúan un puente entre la encuesta y el módulo nutricional que no
> debe existir. **Quedan marcadas para borrarse**, no para conectarse.

**Sobre `calcConsumo` y `TCAC` no tenemos nada que decir: en Atlas tampoco las invoca nadie.** Tu premisa
es cierta y la conclusión es tuya.

**`generarAlertas` es otra cosa.** En tu archivo nadie la llama, es verdad. En Atlas sí: sus quince
reglas se muestran en **dos sitios** de la pantalla de evaluación, a través de un adaptador
(`alertas-disponibles`) que traduce los campos de la encuesta a los que ella lee.

O sea que tu premisa ("nadie la invoca") es cierta de tu archivo y falsa del nuestro, y por eso la
conclusión no se traslada sola.

**Lo que te pedimos no es que la mantengas por nosotros.** Es una de estas dos:

- **Que no la borres**, si las quince reglas siguen siendo válidas y lo único muerto era el cableado.
- **O que nos digas con qué se reemplazan**, si el criterio cambió. Quitarlas sin reemplazo le retira al
  profesional quince avisos clínicos que hoy ve.

La diferencia importa porque, si la borras de la siguiente entrega, nuestro candado de deriva se va a
poner rojo y no va a saber distinguir "la retiró a propósito" de "quedó fuera".

---

# 5 · Los veintiún estados con raya: tu `efrCompose` ya los escribe

**Veintiún de los 81 estados EFR muestran "—"** en mecanismo, en biomarcadores o en los dos. Lo
verificamos ejecutando tu motor sobre tu entrega de hoy: **la raya está en tu archivo**, no se perdió al
portar. Y no la rellenamos ni la ocultamos, porque rellenarla sería escribirte el diagnóstico y ocultarla
sería tapar el hueco en vez de resolverlo.

**Pero al mirarlo de cerca no es un hueco de redacción, es una caída que no llega.**

Tu `getDX` compone solo cuando falta la clave entera:

```js
const base = DX[key] ? { ...DX[key] } : efrCompose(kl(ifcK), kl(ircK), kl(ffmiK), kl(fmiK));
```

Las veintiuna claves **existen**, con `"—"` dentro. Así que la condición no se cumple y `efrCompose` no
llega a correr.

**Y tu `efrCompose` sí tiene el texto.** Lo corrimos sobre los veintiuno: los llena todos. Para el estado
21 (`N_B_N_B`) devuelve *"Homeostasis celular y metabólica conservada."* y *"Biomarcadores dentro del
rango esperado."*

**Tu otro visor, en el mismo archivo, ya cae campo por campo:**

```js
return {d:base.d||comp.d, m:base.m||comp.m, b:base.b||comp.b, r:base.r||comp.r, n:base.n||comp.n};
```

Con esa forma, los veintiuno salen con texto. Con la de `getDX`, salen con raya. **El mismo paciente ve
una cosa en una pantalla tuya y otra en la otra.**

**La pregunta es cuál de tus dos caídas manda**, no que escribas veintiún textos.

Para acotar el alcance: los 81 conservan **diagnóstico, riesgo y nutracéuticos completos**. Lo que falta
son las dos columnas explicativas.

---

# 6 · Tumaco y Cartago están cada uno en dos regiones

Al ejecutar tu mapa completo salieron **224 municipios pero 222 distintos**. Los dos repetidos:

| Municipio | Está en | `regionDe` devuelve | Por qué |
| --- | --- | --- | --- |
| **Tumaco** | `pacifica` y `andina_narino` | `pacifica` | es la primera clave del objeto que coincide |
| **Cartago** | `andina_antioquia` y `andina_valle` | `andina_antioquia` | igual |

**El efecto es pequeño pero la causa no:** la región de esos pacientes la decide el **orden de las claves
del objeto**, no un criterio tuyo. Si algún día se reordena ese objeto por cualquier motivo, esos dos
pacientes cambian de lista de alimentos sin que nadie toque el mapa.

Cartago es municipio del Valle del Cauca y hoy resuelve a Antioquia y Eje Cafetero, que puede ser
deliberado si lo agrupaste con el Eje por cercanía. Tumaco es de Nariño y resuelve a Pacífica, que
también puede ser deliberado porque es costa pacífica.

**No los tocamos.** Asignar un municipio a una región es contenido tuyo. Te pedimos solo a cuál va cada
uno, para dejarlo en una sola.

---

# 7 · Entre seis y ocho subgrupos por región quedan sin ningún alimento

Tu verificación dice, y la confirmamos: *"Las diez regiones tienen alimentos en los nueve grupos que la
prescripción necesita"*. Es cierto.

**Lo que aparece es en el nivel de abajo, el de subgrupo, que es el que imprime tu lista del paciente.**
Tu render recorre `INTER_GRUPOS`, dentro de cada uno los subgrupos de `INTER_TABLA_A`, y de cada subgrupo
los alimentos de la zona. **No filtra el subgrupo vacío**, así que sale el rótulo en negrita y detrás no
hay nada.

Medido sobre tres ciudades:

| Ciudad | Subgrupos sin alimento |
| --- | --- |
| **Bogotá** | 8: Leche descremada, Carnes altas en lípidos, Nueces, Semillas, Reducidos en grasa, Azúcares y dulces, Mecato, Bebidas alcohólicas |
| **Barranquilla** | 6: Leche descremada, Semillas, Reducidos en grasa, Azúcares y dulces, Mecato, Bebidas alcohólicas |
| **Leticia** | 7: los de Barranquilla más Nueces |

**Tres se repiten en las diez regiones:** Azúcares y dulces, Mecato y Bebidas alcohólicas. Esos tres se
leen como una decisión tuya, y muy razonable.

## Y aquí está lo que lo convierte en un defecto y no en una rareza

**Dos de esos grupos vacíos son grupos que tu propio plan PRESCRIBE.**

Lo vimos en el PDF de un paciente real, no leyendo el código. En la misma hoja:

- la tabla de "Cómo repartir tus porciones en el día" dice **"Azúcares y dulces: 1"**,
- y tres páginas más abajo la lista de intercambio dice **"Azúcares y dulces:"** y no hay nada detrás.

**Al paciente se le prescribe una porción de un grupo y se le entrega una lista vacía para elegirla.**

Y no es de ese paciente ni de esa región. Medido sobre las diez regiones y tres objetivos calóricos
distintos:

| Grupo prescrito | Se queda sin lista en |
| --- | --- |
| **Azúcares y dulces** (1 porción) | **las diez regiones, siempre** |
| **Nueces** (1 porción) | **siete de las diez** (en Caribe, Pacífica e Insular sí hay) |

Eso cambia la pregunta. No es "¿se ve raro un rótulo vacío?", es **cuál de las dos partes manda**: si el
reparto por grupos no debe asignar porciones a un grupo que la región no puede surtir, o si la región debe
llevar al menos un alimento de cada grupo que el reparto usa.

**Los otros no se leen igual.** "Leche descremada" vacío en las diez regiones, y "Nueces" o "Semillas"
vacíos en casi todas, no parecen la misma clase de ausencia: son alimentos que un plan sí usa.

**Y la lista completa no tiene el hueco** (una ciudad sin región recibe los 350 y ningún subgrupo queda
vacío), así que viene del recorte, no de `INTER_TABLA_B`.

**Portamos tu render tal cual**, con los rótulos vacíos incluidos, porque suprimirlos sería un arreglo de
forma que taparía esto. Te pedimos cuál de las tres:

1. **Salen vacíos** y está bien, es información (aquí no hay opciones de este subgrupo). Si es esta, sigue
   abierto qué hacer con el "Azúcares y dulces: 1" de la tabla de porciones.
2. **Se ocultan** cuando no tienen alimentos, y el reparto tampoco les asigna porciones.
3. **Entran al núcleo nacional** los que no deberían faltarle a nadie (los lácteos descremados y las
   nueces sobre todo), y los discrecionales sí se quedan vacíos.

---

# 8 · Tres erratas de tu tabla de alimentos, que el paciente lee

Aparecieron al revisar el PDF de un paciente. Son de `INTER_TABLA_B`, verificadas contra tu entrega
vigente, así que **no son de nuestra transcripción**: las portamos tal cual y salen impresas.

| Dice | Debería decir |
| --- | --- |
| Café **instántaneo** en polvo | instantáneo |
| Café **instántaneo** descafeinado en polvo | instantáneo |
| Chocolate con **azticar** | azúcar |
| Chocolate granulado con **panels** | panela |

**No las tocamos**, por lo mismo de siempre: es tu tabla, y corregirla por nuestra cuenta abriría la
puerta a "corregirte" cosas que no son erratas. Con que nos digas "corríjanlas", las corregimos y quedan
en el candado.

**Y el alcance, para ser honestos:** salieron de la lista de UN paciente, que son 80 de los 350 alimentos.
No hicimos revisión ortográfica de los otros 270. Si prefieres, la hacemos y te la mandamos completa en
vez de por goteo.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
