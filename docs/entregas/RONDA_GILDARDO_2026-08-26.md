# Ronda del 2026-08-26 · seguimiento a tus Partes 1 y 2

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 26 de agosto de 2026

Recibidas las dos partes. Arrancamos con lo que desbloqueaste. Esta ronda trae, en orden: **una cosa
urgente que no es clínica**, el **inventario del 3.1 rehecho** como pediste, **dos hallazgos nuevos** que
salieron de verificar tu archivo, **siete preguntas** y **cuatro puntos que se te pasaron**.

Y al final, como **anexo**, el mapa de Atlas que te debíamos: las 64 preguntas con su estado, qué
consume cada pantalla y cuáles de tus motores están portados. **Contesta tu 8.5 y tu 3.5.** Va aquí
adentro y no en un archivo aparte para que te llegue todo junto.

---

# 0 · Urgente y no clínico: tu archivo publica una clave de Groq

Esto va primero porque es lo único con reloj, y no es un reproche: es un riesgo tuyo del que
probablemente no te has enterado.

Antes de tocar el archivo nuevo le pasamos el barrido de credenciales que le hacemos a todo lo que entra
al repositorio. Encontramos, en tu HTML:

```js
const GROQ_API_KEY = "gsk_AdIQ...";   // linea 11858
```

**Esa clave viaja al navegador de cualquiera que abra el archivo.** No es una clave "publicable": es una
credencial de servidor, y el consumo se factura contra tu cuenta de Groq. Cualquiera que tenga hoy una
copia del HTML puede gastar con ella. **Convendría que la rotes**, es decir, generar una nueva en Groq e
invalidar esta. Y a futuro, que la llamada a la IA salga de un backend y no del navegador.

Y para que lo sepas de nuestro lado, sin que tengas que hacer nada: tu archivo también traía la clave
*publishable* de tu proyecto Supabase y el PIN de administrador en claro (`1234`). Las barrimos de todas
las copias, pero la de Supabase alcanzó a quedar en el historial de nuestro repositorio. Es la clave
anónima, la protegida por las reglas de acceso de tu proyecto, así que el riesgo es acotado. Te lo
decimos porque es tuya, y la decisión de rotarla también.

---

# 1 · Hallazgo nuevo: con el déficit en cero, el piso de 1.500 / 1.200 dejó de ser una red

Aplicamos tu regla del 1.2, la de sumar dos correcciones antes de aplicarlas. Esta es la suma.

Dijiste: *"El piso de 1.500 / 1.200 se conserva como red de seguridad. Con el déficit en cero casi nunca
debería activarse."* Fuimos a verificarlo en tu archivo, y el piso está guardado así:

```js
else { kcalObjetivo = get - deficit; }
if (deficit > 0) { var piso = sexoM ? 1500 : 1200; kcalObjetivo = Math.max(piso, kcalObjetivo); }
```

**El piso está condicionado a que haya déficit.** Con `deficit = 0` no se activa *casi* nunca: **no se
activa nunca**. Y el objetivo pasa a ser el gasto calculado sobre el peso meta, sin ninguna red debajo.

El caso reproducible, en tu estilo. Mujer de 60 años, 150 cm, 60 kg, sedentaria:

| Paso | Valor |
|---|---|
| Peso ideal (tu fórmula, mujer) | 50,0 kg |
| IMC 26,7, entonces peso meta = peso ideal | 50 kg |
| GEB sobre peso meta | 977 kcal |
| GET (× 1,2 sedentaria) | **1.172 kcal** |
| Su piso | 1.200 kcal |

**Le prescribe 1.172 kcal, por debajo de su propio piso**, y el piso no lo corrige porque el déficit es
cero. Es exactamente la situación que el 1.2 quería evitar, llegando por el otro lado: no por dos
descuentos sumados, sino por una red que quedó colgada de la condición equivocada.

> **Pregunta 1.** ¿Movemos el piso fuera de la condición del déficit, para que aplique siempre? Es un
> cambio de una línea y creemos que es lo que querías decir, pero es tu red y tu número: no lo tocamos
> sin que lo digas.

---

# 2 · Antes del 3.1: dos dominios del DFI están clavados en el mismo valor para todos los pacientes

Este es el hallazgo que tu 3.1 vuelve urgente, y creemos que te va a interesar más que la discusión
sobre el inventario.

`calcLE8` lee tres campos que **no existen en la encuesta**: `d1_9`, `d1_10` y `d1_16`. Solo viven en el
objeto de demostración, que es por lo que el defecto pasó inadvertido: probado con el paciente demo, el
LE8 parece funcionar.

En un paciente real las tres lecturas dan cero, y entonces:

```js
// dominio Alimentación
(Number(enc.d1_9)||0) >= 3 && (Number(enc.d1_10)||0) >= 2 ? 100
  : (Number(enc.d1_9)||0) >= 2 ? 60 : 30
```

Con `d1_9 = 0` y `d1_10 = 0` el resultado es **siempre 30**. Y el de Hidratación, por la misma vía,
**siempre 20**.

**Dos de los ocho dominios del DFI valen lo mismo en todos los pacientes.** No discriminan a nadie: ni al
que come bien ni al que come mal, ni al que se hidrata ni al que no. Y arrastran el índice hacia abajo
por igual para todo el mundo.

Ya tenemos identificado el mapeo correcto, y nos lo confirmaste el 28 de julio:

| Dominio | Debe leer |
|---|---|
| Alimentación | `calcPatron(enc).score`, sobre `d1_1_i` … `d1_15_i` |
| Hidratación | `enc.d7_agua`, vasos de 200 ml, la misma unidad que esperaba `d1_16` |

Está escrito y desactivado a propósito detrás de un interruptor, esperando tu visto bueno, **porque
encenderlo cambia el diagnóstico de todos los pacientes ya evaluados**. No es un arreglo mecánico: es un
cambio de resultado clínico con efecto retroactivo.

> **Pregunta 2.** ¿Encendemos el mapeo corregido? Y si sí, ¿qué hacemos con las evaluaciones ya hechas:
> se quedan con el valor viejo, se recalculan, o se recalculan y queda anotado en la historia que el DFI
> cambió de versión? Lo tercero es lo que recomendamos, pero la decisión es tuya porque es un cambio de
> diagnóstico, no de software.

---

# 3 · El 3.1 rehecho, con la columna que ninguno de los dos estaba mirando

**Tienes razón y nuestra tabla estaba mal enunciada.** Decir "nadie las usa" era falso, y además era
ambiguo, porque no dijimos respecto a qué. Lo rehicimos sobre todo el archivo, como pediste.

Al rehacerlo apareció que **los dos estábamos midiendo cosas distintas, y ninguna de las dos era la que
decide**:

- Tú mediste **cuántas tienen consumidores en tu archivo**. Verificado: **19 de 25** tienen lecturas
  reales. Contamos solo los accesos por `enc.`, `e.`, `e_.`, `b.` y `edit.`, así que con otros patrones
  de acceso tu cifra de 22 es perfectamente compatible. No la discutimos.
- Nosotros medimos **cuántas tienen consumidores en lo que llevamos portado**. Es **1 de 25**, y esa una
  es muerta: `engine.dfi.js` declara `const alcohol = enc.d3_31 || ""` y ningún cálculo la usa.
- **Ninguno de los dos miró la tercera:** *¿el dato llega a Atlas?* Consultamos la base de datos real.
  **La respuesta es cero de 25.**

Ninguna de las 25 tiene `field_key`. El `field_key` es lo que hace que una respuesta pase del formulario
al objeto que consumen los motores. Sin él, la pregunta se muestra, el paciente la contesta, se guarda en
la historia, y es **invisible para todo lo que calcula**.

Por eso tu ejemplo del alcohol es tan bueno, y por eso los dos teníamos razón: `d3_31` **sí** tiene
consumidores en tu archivo, y en Atlas **nunca llega**, así que aunque portáramos esos consumidores
recibirían la cadena vacía.

## La tabla, con las tres columnas

| Pregunta (nuestra pantalla) | Tu código | Lecturas en tu archivo | En lo portado | Llega en Atlas |
|---|---|---|---|---|
| P25 ¿Qué tipo de actividad realiza? | `d3_25` | 3 | 0 | **NO** |
| P27 ¿Cómo califica la calidad de su sueño? | `d3_27` | 3 | 0 | **NO** |
| P28 ¿Ronca durante el sueño? | `d3_28` | 1 | 0 | **NO** |
| P31 ¿Con qué frecuencia consume alcohol? | `d3_31` | 4 | 2 (muertas) | **NO** |
| P32 ¿Cuántas comidas hace al día? | `d4_32` | 0 | 0 | **NO** |
| P33 ¿Desayuna regularmente? | `d4_33` | 0 | 0 | **NO** |
| P34 ¿Sigue algún patrón alimentario? | `d4_34` | 1 | 0 | **NO** |
| P35 ¿Qué suplementos toma actualmente? | `d4_35` | 1 | 0 | **NO** |
| P37 ¿Toma medicamentos para la presión arterial? | `d5_37` | 3 | 0 | **NO** |
| P41 ¿Fue amamantado/a en su infancia? | `d5_41` | 2 | 0 | **NO** |
| P42 ¿Exposición habitual a contaminantes? | `d5_42` | 5 | 0 | **NO** |
| P43 ¿Alergias alimentarias diagnosticadas? | `d6_43` | 8 | 0 | **NO** |
| P44 ¿Intolerancias alimentarias? | `d6_44` | 6 | 0 | **NO** |
| P45 ¿Cirugía que afecte digestión o metabolismo? | `d6_qx` | 7 | 0 | **NO** |
| P46 Hinchazón abdominal | `d6_45` | 1 | 0 | **NO** |
| P47 Gases / flatulencia | `d6_46` | 1 | 0 | **NO** |
| P48 Dolor abdominal | `d6_47` | 0 | 0 | **NO** |
| P49 Diarrea | `d6_48` | 0 | 0 | **NO** |
| P50 Estreñimiento | `d6_49` | 1 | 0 | **NO** |
| P51 Reflujo / acidez | `d6_50` | 0 | 0 | **NO** |
| P52 Náuseas | `d6_51` | 0 | 0 | **NO** |
| P53 Café (tazas/día) | `d7_52` | 1 | 0 | **NO** |
| P54 Té (tazas/día) | `d7_53` | 1 | 0 | **NO** |
| P55 Jugos naturales (vasos/día) | `d7_54` | 1 | 0 | **NO** |
| P60 ¿Color de su orina? | `d7_58` | 3 | 0 | **NO** |

**Y hay dos dominios completos sin un solo `field_key`:** *Conductas alimentarias* (`d4`) y *Alergias y
digestión* (`d6`). Nada de lo que el paciente responde en esos dos dominios llega a ningún motor. Ahí
están el patrón alimentario y las alergias, que es exactamente lo que señalaste.

**Esto no requiere decisión tuya y ya lo estamos construyendo.** Es trabajo nuestro, no ciencia. Lo
decimos para que sepas que el arreglo del patrón alimentario y el de las alergias son **la misma pieza
con catorce campos**, no dos tareas.

---

# 4 · Hallazgo nuevo: tu numeración y la nuestra se separaron, y un mismo código nombra preguntas distintas

Salió de mapear la tabla anterior, y conviene que lo sepas antes de que nos escribas otra instrucción
citando un código.

Nuestra encuesta tiene **dos preguntas que tu numeración no contempla**: la de **cirugía digestiva** (en
tu archivo es `d6_qx`, sin número en la secuencia, y la muestras como pregunta 63) y la de **agua**
(`d7_agua`). Como están intercaladas, todo lo que va después se corre.

El resultado:

| Código | En tu archivo es | En nuestra pantalla, esa posición es |
|---|---|---|
| `d6_45` | Hinchazón abdominal | ¿Cirugía que afecte la digestión? (P45) |
| `d6_50` | Reflujo / acidez | Estreñimiento (P50) |
| `d7_57` | ¿Siente sed con frecuencia? | Agua, vasos por día (P57) |

**Y lo verificamos hacia atrás antes de contarte esto: no se aplicó nada mal.** Revisamos las doce veces
que nos has citado un código (`d5_39`, `d6_44`, `d4_34`, `d3_31`, `d7_57`, `d8_59` y las demás) y las
comparamos, una por una, contra la pregunta que ese código tiene en Atlas. **Coinciden todas.** La razón
es que cuando cableamos las preguntas usamos tu código, no la posición, así que el desfase de numeración
nunca entró en el cableado.

**El código manda, no el número.** Vamos a seguir citando siempre tu código y a decir entre paréntesis
qué pregunta es, para que no se cuele un error silencioso más adelante. Si tú nos escribes "la 45", vamos
a preguntarte cuál de las dos.

Y un detalle menor de tu archivo, por si te sirve: **hay dos preguntas con `num: 56`**, Agua y Bebidas
energéticas.

---


# 5 · Cinco preguntas

## 5.1 · El rango proteico: tu documento dice 1,5 a 2,0 y tu archivo implementa 1,5

Esta la pudimos resolver casi sola, y la dejamos como confirmación en vez de pregunta. Tu documento dice
*"el desnutrido conserva el rango alto: 1,5 a 2,0 g/kg"*, y `protKg` es un solo número. Fuimos al archivo
nuevo y ya está separada:

```js
tipoEnergia = "Hipercalórica";  protKg = desnutricion ? 1.5 : 1.25;
```

**Portamos 1,5**, que es lo que tu archivo hace, por la regla de siempre: manda el archivo.

> **Pregunta 3.** ¿El 2,0 es el techo del rango clínico que se le muestra al nutricionista como
> referencia, o hay algún caso en que el motor deba calcular con un valor más alto que 1,5?

Verificamos también que la nota de realimentación (fosfato, potasio, magnesio; iniciar a 10-15 kcal/kg)
siga viajando solo con la rama de desnutrición. Sigue.

## 5.2 · El tamizaje de apnea no tiene instrumento, y no vamos a inventarle uno

Lo llamas *"la omisión más grande"* y apruebas construirlo. Los cuatro datos están capturados: ronquido
(`d3_28`), calidad del sueño (`d3_27`), horas de sueño (`d3_26`) e IMC.

Pero un tamizaje no es cruzar cuatro datos: es un instrumento con puntos de corte. Y no nos diste
ninguno. Es el mismo caso del ECM/BCM en el que nos dijiste que hicimos bien en no tocar.

> **Pregunta 4.** ¿Qué instrumento usamos: STOP-BANG, Berlín, uno propio? ¿Con qué puntos de corte, y con
> qué salida, positivo/negativo o bajo/intermedio/alto? ¿Y los cuatro datos que tenemos alcanzan, o hay
> que agregar preguntas a la encuesta? Sin los cortes no lo construimos.

## 5.3 · Los 0,1 nF: ¿solo la capacitancia, o toda la tabla de cambios?

Preguntamos por el cambio mínimo detectable en general y contestaste en nanofaradios, que es la unidad de
la capacitancia. La tabla de cambios de Seguimiento muestra bastantes más indicadores.

> **Pregunta 5.** ¿El umbral de 0,1 nF es solo para la capacitancia, o hay que fijar un mínimo detectable
> por cada indicador? Si es lo segundo, necesitamos el número de cada uno. Si no, los demás se reportan
> siempre, con cualquier magnitud de cambio.

## 5.4 · La casilla de porciones se mueve dos niveles, no uno (nota, no pregunta)

Dices *"muevan la casilla del nivel 2 al nivel 1"*. Hoy en Atlas la casilla está en el **alimento**, no en
el subgrupo: la movimos ahí hace poco. Así que llevarla al grupo revierte **dos** niveles y cambia el
formato en que se guarda la prescripción.

Lo hacemos, tu instrucción es clara. Te lo decimos solo para que sepas que lo que se pierde es la
prescripción por alimento, no por subgrupo.

## 5.5 · Los suplementos y la medicación son texto libre

Apruebas que el plan tenga en cuenta los suplementos que el paciente ya toma, para no duplicar vitamina
D, y que el médico sepa si la hipertensión está tratada. Las dos preguntas existen, `d4_35` y `d5_37`, y
las dos son **texto libre**: el paciente escribe lo que quiera.

Para que el sistema decida algo con eso tendría que interpretar lo que escribió, y ahí se equivoca.

> **Pregunta 6.** ¿Prefieres (a) que el motor no decida y solo se le muestre al profesional, literal, lo
> que el paciente escribió, o (b) que esas dos preguntas pasen a opciones cerradas? La (b) toca el
> contenido de la encuesta, que está congelado, así que es tuya.

---

# 6 · Cómo estamos separando la alergia del patrón alimentario

Apruebas los dos y los estamos construyendo juntos, pero **no del mismo modo**, y queremos que sepas la
diferencia porque es clínica.

- **El patrón alimentario va al generador como restricción del plan.** Condiciona todas las comidas, y es
  el tipo de cosa que el modelo de lenguaje sabe respetar.
- **La alergia NO va por instrucción al modelo.** Se filtra en código, antes y después de generar el
  menú: los alimentos a los que el paciente es alérgico no entran, y si alguno se cuela en la salida, se
  bloquea el menú.

La razón es que **la seguridad no puede depender de que el modelo obedezca**. Una instrucción en el
prompt se cumple casi siempre, y "casi siempre" no es un criterio aceptable cuando lo que está en juego
es una reacción alérgica. El patrón alimentario mal respetado produce un plan que el paciente no sigue;
la alergia mal respetada produce un paciente en urgencias.

Si no estás de acuerdo con esa separación, dilo y la cambiamos.

---

# 7 · Cuatro puntos de la ronda anterior que quedaron sin respuesta

Van con número esta vez. Los tres últimos iban sin numerar en el documento anterior, bajo un título
corrido, y sospechamos que por eso se pasaron.

## 7.1 (era 8.7) · Tu encuesta y tu motor agrupan las carnes rojas distinto

**Es el que más nos bloquea.** Tenemos parado el rediseño de la sección de Alimentación del formulario
esperándolo.

El resumen: al agrupar las preguntas de frecuencia por tipo de alimento para que quepan en un teléfono,
un candado nuestro detectó que `FREQ_GROUPS` **no está ordenado por número de pregunta**: las carnes rojas
(`n15`) quedan colocadas después de `n10`. Si hubiéramos puesto los encabezados por posición, habríamos
rotulado las carnes rojas como ultraprocesados. Revertimos el cambio entero.

> **Pregunta 7.** ¿El orden de `FREQ_GROUPS` es deliberado o es un descuido? Y si lo agrupamos para la
> pantalla, ¿qué agrupación clínica quieres que se le muestre al paciente?

## 7.2 (era 7.3) · Dos filas de tu tabla de historia clínica dicen "Normal" y "Óptimo"

Te lo reportamos como defecto de tu pantalla y no lo comentaste. Sigue en pie.

## 7.3 (era 9.2) · Dos cosas de tu pantalla de Seguimiento

Igual: reportadas, sin comentario.

## 7.4, 7.5 y 7.6 · Tres defectos de tu archivo que vimos al portar la historia clínica

Estos son los que iban sin número. **El tercero es el serio.**

- **7.4 · Aparecen `undefined` literales.** En el bloque de composición corporal, en pantalla, tal cual.
- **7.5 · El motivo de consulta sale sin separador.** Las opciones se concatenan pegadas:
  *"Control de pesocomposición corporalRiesgo metabólico"*.
- **7.6 · La fecha de la firma es la fecha de impresión.** El pie `FIRMA Y FECHA` usa el día en que se
  abre el documento, no el día en que se firmó. **Una historia clínica es un documento probatorio**: si se
  reimprime en marzo una consulta de agosto, el documento afirma que se firmó en marzo. Es el único de
  los tres que no es cosmético.

---

# 8 · El 8.5 y el 3.5: van contestados en el anexo de este documento

Dices que no puedes contestarlos sin ver el software. Tienes cuenta en Atlas desde hace semanas, así que
el acceso ya lo tienes. Lo que creemos que te falta no es entrar: es **ver qué consume cada pantalla**,
que es justamente lo que usando Atlas no se ve.

Y hay una razón práctica que quizá explica por qué el acceso no te ha servido: **la herramienta con la
que trabajas lee archivos que tengas en tu computador**. No navega a Atlas ni tiene nuestro repositorio,
y no puede entrar con tu cuenta. Así que para lo que quieres hacer, un documento sirve y un usuario y
contraseña no.

**Ese documento va al final de este, como anexo.** Lleva las 64 preguntas con su estado, cuáles de tus
motores están portados, qué muestra cada pantalla, y la respuesta directa a las dos preguntas. Va aquí
adentro y no aparte para que te llegue en un solo archivo.

Si además quieres el código, dilo y te lo mandamos.

---

# Resumen

| # | Qué es | Qué necesitamos |
|---|---|---|
| 0 | **Tu clave de Groq viaja al navegador** de cualquiera que abra tu HTML | Que la rotes. No es clínico y no espera |
| 1 | **El piso de 1.500/1.200 dejó de activarse** al poner el déficit en cero. Caso: 1.172 kcal prescritas con piso de 1.200 | ¿Sacamos el piso de la condición del déficit? |
| 2 | **Alimentación e Hidratación del DFI están clavadas en 30 y 20 para todos** | ¿Encendemos el mapeo corregido? ¿Qué pasa con lo ya evaluado? |
| 3 | **3.1 rehecho.** Nuestra tabla estaba mal enunciada; la columna que decide es "¿llega el dato?", y son **0 de 25** | Nada. Lo construimos nosotros |
| 4 | **Tu numeración y la nuestra se separaron**: `d6_45` es Hinchazón para ti y Cirugía para nosotros | Nada. Citaremos siempre tu código |
| 5.1 | Rango proteico: portamos **1,5**, que es lo que tu archivo hace | ¿El 2,0 es techo de referencia? |
| 5.2 | **El tamizaje de apnea no tiene instrumento** | Instrumento y puntos de corte |
| 5.3 | Los **0,1 nF**: ¿solo capacitancia? | El alcance, y los números si son varios |
| 5.4 | La casilla revierte **dos** niveles | Nada, es aviso |
| 5.5 | Suplementos y medicación son **texto libre** | ¿Se muestran literal, o pasan a opciones cerradas? |
| 6 | La alergia **se filtra en código**, no por instrucción al modelo | Confirmar que estás de acuerdo |
| 7.1 | **Carnes rojas: el orden de `FREQ_GROUPS`.** Bloquea el rediseño del formulario | ¿Deliberado o descuido? |
| 7.2 a 7.6 | Cinco defectos de tu archivo sin comentar. **El de la fecha de la firma es probatorio** | Acuse |
| 8 | El **anexo** de este documento contesta el 8.5 y el 3.5 | Nada |

**Lo que más nos bloquea, en orden: el 7.1**, que tiene el formulario parado; **el 5.2**, porque no
construimos el tamizaje sin cortes; y **el 1**, que es un cambio de diagnóstico con efecto sobre lo ya
evaluado.

Mientras respondes seguimos con los catorce `field_key`, las dos reversiones del 8.1 y el 1.1, el porte de
`CAP_REF` y el de `motorTratNutri`, que con lo del 5.1 resuelto ya no tiene nada bloqueado.

---

# Anexo · Mapa de Atlas: qué consume cada pantalla y qué llega del instrumento

Este anexo es la respuesta al **8.5** y al **3.5**. Es de consulta, no hay que leerlo de corrido:
puedes ir directo a la parte que te interese.

### Cómo leer esto

Hay una pieza intermedia entre tu instrumento y tu modelo que no existe en tu archivo, y sin ella nada
de esto se entiende: el **`field_key`**.

En tu archivo, la respuesta a una pregunta y la variable que consume el motor son **la misma cosa**:
escribes `enc.d3_31` y ahí está. En Atlas están separadas, porque las respuestas viven en una base de
datos y las preguntas cambian de versión. El `field_key` es la etiqueta que dice *"esta pregunta, al
guardarse, se convierte en la variable `d3_31` del motor"*.

Y de ahí sale la consecuencia importante:

> **Una pregunta sin `field_key` se muestra, el paciente la responde, se guarda en su historia, y el
> motor nunca la ve.** No falla nada. No hay error. Simplemente el cálculo corre sin ese dato.

Ese es el estado de **25 de tus 64 preguntas** hoy, y es lo que estamos arreglando.

---

## Parte A · El instrumento: las 64 preguntas y cuáles llegan

Tres estados posibles:

- **Sí**: tiene `field_key` y hay algo en Atlas que la consume.
- **Sí, sin consumidor aún**: el dato llega, pero lo que lo consume es un motor que todavía no hemos
  portado. Se conecta solo cuando el porte llegue.
- **NO**: no tiene `field_key`. El dato no sale del formulario.

**Alimentación**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 1 | Verduras y hortalizas (frecuencia de consumo) | `d1_1_i` | **Sí** |
| 2 | Frutas enteras (frecuencia de consumo) | `d1_2_i` | **Sí** |
| 3 | Leguminosas (frecuencia de consumo) | `d1_3_i` | **Sí** |
| 4 | Pescado y mariscos (frecuencia de consumo) | `d1_4_i` | **Sí** |
| 5 | Grasas saludables (frecuencia de consumo) | `d1_5_i` | **Sí** |
| 6 | Lácteos y fermentados (frecuencia de consumo) | `d1_6_i` | **Sí** |
| 7 | Huevos (frecuencia de consumo) | `d1_7_i` | **Sí** |
| 8 | Cereales integrales y otros (frecuencia de consumo) | `d1_8_i` | **Sí** |
| 9 | Raíces, tubérculos y plátanos (frecuencia de consumo) | `d1_9_i` | **Sí** |
| 10 | Carnes blancas (frecuencia de consumo) | `d1_10_i` | **Sí** |
| 11 | Cereales refinados y harinas blancas (frecuencia de consumo) | `d1_11_i` | **Sí** |
| 12 | Carnes procesadas y embutidos (frecuencia de consumo) | `d1_12_i` | **Sí** |
| 13 | Azúcares añadidos y bebidas azucaradas (frecuencia de consumo) | `d1_13_i` | **Sí** |
| 14 | Ultraprocesados (PCBU) (frecuencia de consumo) | `d1_14_i` | **Sí** |
| 15 | Carnes rojas (frecuencia de consumo) | `d1_15_i` | **Sí** |
| 16 | ¿Con qué frecuencia añade sal extra a la comida ya servida? | `d1f_sal_i` | **Sí** |
| 17 | ¿Desayuna regularmente (antes de las 10 am)? | `d1f_des_i` | **Sí** |
| 18 | ¿A qué hora suele cenar? | `d1f_noche_i` | **Sí** |

**Percepción corporal**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 19 | ¿Cómo percibe su cuerpo actualmente? | `d2_19` | **Sí** |
| 20 | ¿Qué tan satisfecho/a está con su peso? | `d2_20` | **Sí** |
| 21 | ¿Qué métodos ha usado para cambiar su peso? | `d2_21` | **Sí** |
| 22 | ¿Con qué frecuencia pierde el control al comer? | `d2_22` | **Sí** |

**Hábitos**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 23 | ¿Cuántos días/semana hace actividad física (≥30 min)? | `d3_23` | **Sí** |
| 24 | ¿Cuánto dura cada sesión? | `d3_24` | **Sí** |
| 25 | ¿Qué tipo de actividad realiza? | (ninguno) | **NO** |
| 26 | ¿Cuántas horas duerme por noche? | `d3_26` | **Sí** |
| 27 | ¿Cómo califica la calidad de su sueño? | (ninguno) | **NO** |
| 28 | ¿Ronca durante el sueño? | (ninguno) | **NO** |
| 29 | Nivel de estrés en el último mes (1 = sin estrés, 10 = máximo) | `d3_29` | **Sí** |
| 30 | ¿Su relación con el tabaco / nicotina? | `d3_30` | **Sí** |
| 31 | ¿Con qué frecuencia consume alcohol? | (ninguno) | **NO** |

**Conductas alimentarias**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 32 | ¿Cuántas comidas hace al día? | (ninguno) | **NO** |
| 33 | ¿Desayuna regularmente? | (ninguno) | **NO** |
| 34 | ¿Sigue algún patrón alimentario? | (ninguno) | **NO** |
| 35 | ¿Qué suplementos toma actualmente? | (ninguno) | **NO** |

**Antecedentes y estilo de vida**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 36 | ¿Le han diagnosticado hipertensión arterial? | `d5_36` | **Sí** |
| 37 | ¿Toma medicamentos para la presión arterial? | (ninguno) | **NO** |
| 38 | ¿Familiares cercanos con estas enfermedades? | `d5_38` | **Sí** |
| 39 | ¿Tiene alguno de estos diagnósticos personales? | `d5_39` | **Sí** |
| 40 | ¿Qué medicamentos toma actualmente? | `d5_40` | **Sí** |
| 41 | ¿Fue amamantado/a en su infancia? | (ninguno) | **NO** |
| 42 | ¿Exposición habitual a contaminantes? | (ninguno) | **NO** |

**Alergias y digestión**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 43 | ¿Alergias alimentarias diagnosticadas? | (ninguno) | **NO** |
| 44 | ¿Intolerancias alimentarias? | (ninguno) | **NO** |
| 45 | ¿Le han realizado alguna cirugía que afecte la digestión o el metabolismo? | (ninguno) | **NO** |
| 46 | Hinchazón abdominal | (ninguno) | **NO** |
| 47 | Gases / flatulencia | (ninguno) | **NO** |
| 48 | Dolor abdominal | (ninguno) | **NO** |
| 49 | Diarrea | (ninguno) | **NO** |
| 50 | Estreñimiento | (ninguno) | **NO** |
| 51 | Reflujo / acidez | (ninguno) | **NO** |
| 52 | Náuseas | (ninguno) | **NO** |

**Hidratación**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 53 | Café (tazas por día) | (ninguno) | **NO** |
| 54 | Té (tazas por día) | (ninguno) | **NO** |
| 55 | Jugos naturales (vasos por día) | (ninguno) | **NO** |
| 56 | Gaseosas (vasos por día) | `d7_55` | **Sí** |
| 57 | Agua (vasos de 200 ml por día) | `d7_agua` | **Sí** |
| 58 | Bebidas energéticas (latas por día) | `d7_56` | **Sí** |
| 59 | ¿Siente sed con frecuencia? | `d7_57` | Sí, sin consumidor aún |
| 60 | ¿Color de su orina habitualmente? | (ninguno) | **NO** |

**Contexto social**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 61 | ¿Quién prepara sus alimentos habitualmente? | `d8_59` | **Sí** |
| 62 | ¿Con qué frecuencia come fuera de casa? | `d8_60` | **Sí** |
| 63 | ¿Tiene acceso fácil a alimentos frescos y saludables? | `d8_61` | **Sí** |
| 64 | ¿Hay momentos en que no tiene suficiente comida en el hogar? | `d8_62` | **Sí** |

### Resumen de la Parte A

| | Cuántas |
|---|---|
| Preguntas del instrumento | **64** |
| Con `field_key`, el dato llega | **39** |
| **Sin `field_key`, el dato NO llega** | **25** |

Y dos dominios completos, **Conductas alimentarias** y **Alergias y digestión**, no tienen **ni un solo**
`field_key`. Nada de lo que el paciente responde en esos dos dominios llega a ningún motor. Ahí están el
patrón alimentario y las alergias.

**Esto no requiere decisión tuya. Es trabajo nuestro y ya está en curso.**

---

## Parte B · Tus motores: qué está portado y qué no

| Tuyo | ¿Portado? | Nota |
|---|---|---|
| `computeDFI` | **Sí** | Con la salvedad de la Parte D |
| `calcPatron` | **Sí** | Alimenta la vista de patrón alimentario |
| `cap` (capacitancia) | **Sí** | `CAP_REF` y `capRef()` del archivo nuevo están **en cola**, no portados aún |
| `motorTratMedico` | **Sí** | |
| `motorTratEjercicio` | **Sí** | |
| `motorTratPsico` | **Sí** | |
| **`motorTratNutri`** | **NO** | Estaba bloqueado por el 1.1 al 1.4. Lo desbloqueaste el 26; es lo siguiente que portamos |
| **El constructor de texto clínico** (tu L13172) | **NO** | Es el que citaste en el 3.1. Nunca lo habíamos identificado como pieza aparte |
| `compFill` | **NO** | |

**El constructor de texto clínico es un hallazgo tuyo**, no nuestro: apareció porque nos corregiste el
inventario. No lo teníamos en la lista de piezas por portar. Es una pieza que lee bastante de la encuesta
y produce texto para el profesional, y hasta tu Parte 2 no sabíamos que existía como cosa separada.

---

## Parte C · Las pantallas de Atlas y qué muestra cada una

Atlas organiza la consulta en **cinco pestañas**, en este orden.

### 1 · Evaluación

Dos subpestañas: **Antropometría y BIS** (los datos que entran del equipo Biody, o a mano) y **Encuesta**
(las 64 preguntas, con su estado de completitud).

Es la pestaña de entrada de datos. No muestra salidas del modelo.

### 2 · Diagnóstico

Tres subpestañas:

- **Composición Corporal** , la tabla de indicadores con sus cortes y colores: FMI, FFMI, ASMI, SMM/W,
  ECM/BCM, capacitancia, ángulo de fase, agua, y el resto. Es donde vive la tabla de Wang.
- **Diagnóstico Funcional** , el DFI con sus ocho dominios, la Diana, y los índices: IFC, IRC, PABU,
  ICA-BIS, ISCM, IEHH, IAE, EB-BIS.
- **Diagnóstico Encuesta** , la lectura del instrumento: patrón alimentario, dominios de la encuesta.

### 3 · Tratamiento

- **Rutas de atención** , las remisiones por disciplina que producen tus cuatro motores.
- **Plan** , objetivo calórico y la cadena que lo produce, macros, restricciones del modelo,
  restricciones del profesional, distribución por grupos, tiempos de comida, menú generado por IA,
  nutracéuticos.

**Aquí está el hueco más grande, y es el de tu 3.2:** el plan se arma **sin** el patrón alimentario y
**sin** las alergias, porque son dos de las 25 que no llegan.

### 4 · Seguimiento

La comparación entre controles: la tabla de cambios por indicador, las líneas de serie, el aviso de
trayectoria (mejoró / estable / empeoró) y la fecha de próximo control.

### 5 · Reporte / HC

Dos documentos distintos, y esto es lo que resolviste en el 7.1:

- **La historia clínica** , el documento del profesional y de la institución. Lleva todo, incluidos los
  índices y la EB-BIS. **No la recibe el paciente.**
- **El reporte del paciente** , lo que se le envía. Hoy lleva lo que nos dijiste que **no debe llevar**:
  IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el código `N_N_N_A`. Estamos rehaciéndolo con tu lista del 7.1.

---

## Parte D · Respuesta directa a tu 8.5: qué no está llegando a donde debería

Esto es lo que preguntaste. Son cuatro cosas, en orden de gravedad.

### D1 · Dos dominios del DFI están clavados en el mismo valor para todos los pacientes

`calcLE8` lee `d1_9`, `d1_10` y `d1_16`, que **no existen en la encuesta**: solo viven en el objeto de
demostración. En un paciente real las tres dan cero, y entonces **Alimentación queda en 30 y Hidratación
en 20, para todo el mundo**.

Dos de los ocho dominios no discriminan a nadie. Tenemos el mapeo correcto escrito y desactivado detrás
de un interruptor, porque encenderlo cambia el diagnóstico de todos los pacientes ya evaluados. Va como
pregunta 2 de la ronda.

### D2 · El plan nutricional se arma sin patrón alimentario y sin alergias

Lo encontraste tú en el 3.2. La causa es la de la Parte A: ninguna de las dos tiene `field_key`, así que
el generador no puede verlas ni aunque quisiera. **Es lo primero que estamos construyendo.**

### D3 · Tus motores de tratamiento leen una fracción del instrumento

Lo dijiste tú y lo confirmamos: `motorTratNutri` lee 5 campos, `motorTratMedico` 3 y `motorTratEjercicio`
2. Pero el techo real es más bajo de lo que parece, porque **de esos campos, los que no tienen
`field_key` llegan vacíos**. Tu ejemplo del alcohol es exactamente eso: `d3_31` tiene consumidores en tu
archivo y en Atlas nunca llega, así que portar esos consumidores sin arreglar el `field_key` produciría
código que lee la cadena vacía.

### D4 · El reporte del paciente lleva lo que dijiste que no debe llevar

Ya resuelto por tu 7.1, en construcción. Lo dejamos anotado aquí para que el mapa quede completo.

---

## Parte E · Respuesta a tu 3.5: qué más

Tu 3.5 preguntaba qué más hay de esta familia. La respuesta honesta, después de hacer este mapa:

**La familia es una sola y tiene un nombre: el `field_key`.** Casi todo lo que encontramos, y todo lo que
encontraste tú, es la misma cosa vista desde ángulos distintos: una pregunta que el paciente contesta y
que no llega al cálculo. No son defectos sueltos en sitios distintos; son **25 instancias de un mismo
hueco**, y por eso se arreglan juntas y no de a una.

Lo que **no** es de esa familia, y que conviene que sepas que existe:

- **La capacitancia no tenía referencia** hasta tu entrega del 26. Ya la tiene (`CAP_REF`), pendiente de
  portar.
- **`notas_profesional` se sobrescribe en cada control** y no la lee nadie. Lo verificaste tú en el 8.3.
- **Tres defectos de tu pantalla** que te reportamos al portar la historia clínica y que quedaron sin
  comentar. Van renumerados en la ronda: el serio es que **la fecha de la firma es la fecha de
  impresión**, en un documento probatorio.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
