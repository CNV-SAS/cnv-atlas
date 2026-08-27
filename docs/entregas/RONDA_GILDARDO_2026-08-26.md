# Ronda del 2026-08-26 · seguimiento a tus Partes 1 y 2

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 26 de agosto de 2026

Recibidas las dos partes. Arrancamos con lo que desbloqueaste. Esta ronda trae, en orden: **una cosa
urgente que no es clínica**, **dos hallazgos nuevos** que salieron de verificar tu archivo, el
**inventario del 3.1 rehecho** como pediste, **once preguntas** en total, **seis puntos que se te
pasaron**, y al final **lo que construimos de tu 3.2**, con dos tablas de criterio nutricional que
redactamos nosotros y que necesitamos que revises.

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

El caso reproducible. Lo corrimos **contra tu motor ya portado**, no a mano. Mujer de 60 años, 150 cm,
60 kg, con el factor de actividad en "sedentario":

| Paso | Valor |
|---|---|
| Peso ideal (tu fórmula, mujer) | 50,0 kg |
| IMC 26,7, entonces peso meta = peso ideal | 50 kg |
| GEB sobre peso meta | 977 kcal |
| GET (× 1,2 sedentario) | **1.172 kcal** |
| Su piso | 1.200 kcal |

**Le prescribe 1.172 kcal, por debajo de su propio piso**, y el piso no lo corrige porque el déficit es
cero.

**Y hay una consecuencia que lo deja sin discusión.** A esa misma paciente, ponerle un déficit de 300
kcal **le SUBE el objetivo**:

| | Objetivo |
|---|---|
| Déficit **0** (tu decisión del 1.2) | **1.172 kcal** |
| Déficit **300** | **1.200 kcal** |

Pedirle que coma 300 menos hace que el sistema le prescriba 28 más, porque **solo al haber déficit
aparece el piso que la protege**. Es exactamente lo que el 1.2 quería evitar, llegando por el otro
lado: no por dos descuentos sumados, sino por una red que quedó colgada de la condición equivocada.

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
decimos para que sepas que el arreglo del patrón alimentario y el de las alergias son **la misma
pieza**, no dos tareas, y que con ella entran las veinticinco de golpe.

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


# 5 · Cuatro preguntas y una nota

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

**Y dos cosas que vimos al portar `CAP_REF`, que ya está en Atlas con su candado de transcripción:**

1. **"Alta" queda pintada de verde**, el mismo color que "Normal" (`#16a34a` en tu `cC`). Pero tu
   documento dice que por encima de P75 se rotula "Alta" y **no** "Óptimo", porque *"el alto no lo
   presenta como bueno"*. La etiqueta dice una cosa y el color dice otra: en pantalla, verde se lee como
   "está bien". Lo portamos tal cual está en tu archivo, sin cambiarlo. **¿Le pones otro color, o el
   verde es deliberado?**

   **Y esto ya tiene una consecuencia visible hoy, que es lo que nos hace preguntártelo con urgencia.**
   Fuimos a ver dónde aparece la capacitancia en Atlas. No está en la tabla de índices alterados de la
   historia clínica (esa lleva los índices del modelo: IFC, IRC, ISCM, IEHH, EB, IAE, PABU e ICA-BIS),
   así que por ahí no hay riesgo. **Pero está en la tarjeta de Seguimiento, y ahí decimos esto:**

   > *"Según protocolo, C es el parámetro a seguir. Mayor capacitancia = mejor integridad celular:
   > verde si mejora, rojo si retrocede."*

   O sea: **subir se pinta como mejora, sin techo.** Un paciente que pasa de 2,40 a 4,00 nF, muy por
   encima de su P95, sale en verde y "mejorando". Y tú dices que el alto no es bueno y que **sube con
   el IMC**, es decir que ese ascenso puede ser un artefacto y no una mejoría.

   Ese texto es nuestro y lo escribimos antes de tener tu referencia. **No lo cambiamos por nuestra
   cuenta porque es criterio clínico tuyo:** ahora que `CAP_REF` existe, la alternativa natural sería
   que mejorar deje de ser "subir" y pase a ser "acercarse a la mediana de su grupo", que es lo que se
   deduce de tu 9.1. Pero eso cambia lo que la pantalla le dice al profesional en cada control.

   > **Pregunta 5b.** ¿Mejorar en capacitancia es SUBIR, o es ACERCARSE A LA MEDIANA del grupo? Y si un
   > paciente ya está por encima del P95, ¿seguir subiendo es mejorar, es indiferente, o es una señal?
2. **Tu última banda es `[70, 200]`**, así que absorbe a todos los mayores de 70 sin marcarlos como
   fuera de rango. Un paciente de 95 años se compara contra el grupo de 70+ (n=87) como si fuera del
   artículo. No lo tocamos; lo decimos por si querías marcarlo.

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

**Actualización, porque ya está construido:** el patrón también se comprueba en código ahora, pero como
**aviso** y no como bloqueo, por una razón que explicamos en el punto 10.3. Lo que sigue en pie de este
punto es lo de fondo: la alergia no depende de que el modelo obedezca.

---

# 7 · Seis puntos de la ronda anterior que quedaron sin respuesta

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

# 9 · Tres cosas que hicimos al cablear las alergias, dos para que las confirmes y una que es reporte

Construimos lo del 3.2: las 25 preguntas ya llegan al motor. Al hacerlo aparecieron tres cosas que
tienes que saber.

## 9.1 · El alcohol: conservamos tu intención cambiando tu mecanismo

En julio (Q6) nos dijiste que el alcohol no debía alimentar el motor, porque `calcLE8` lo leía en una
variable muerta. El mecanismo que elegiste fue **no darle `field_key`**, y así quedó escrito.

Tu Parte 2 ahora lo pide en Médico y en Psicología. Para eso el dato tiene que llegar.

Lo hicimos así: **le dimos `field_key` pero marcado como de tratamiento, no de diagnóstico.** El dato
llega a los profesionales y **el efecto sobre el diagnóstico sigue siendo cero**, porque esa variable
sigue muerta. Y eso no lo afirmamos: lo prueba un candado que corre el motor antes y después, campo por
campo, y que además comprueba que sí detecta un cambio real cuando lo hay.

**O sea: conservamos tu intención cambiando tu mecanismo.** Q6 quería efecto cero en el diagnóstico, y
el candado prueba justo esa garantía, mejor de lo que la probaba la ausencia del `field_key`.

> **Pregunta 8.** ¿Lo confirmas? Si prefieres que el alcohol siga sin llegar a ninguna parte, lo
> devolvemos, pero entonces no puede aparecer en Médico ni en Psicología.

## 9.2 · El texto libre de "Otra": tu regla del 15 era más amplia de lo que nosotros implementamos

En tu §4 del 15 de agosto nombraste las nueve preguntas con opción "Otra" y dijiste que en `d5_38` y
`d6_44`, **las que alimentaban el motor**, el texto libre también lo alimenta. Y pediste una cosa más:

> *"Una sola regla para todo el instrumento, sin excepciones por pregunta."*

**Nosotros lo implementamos como una lista de tres campos, y el resto quedó excluido.** En ese momento
daba igual, porque los demás no llegaban al motor de todos modos. Pero al volver las alergias una
restricción del plan, esa lista pasó a hacer daño:

**Un paciente alérgico al mango marcaba "Otra", escribía "mango", y llegaba al motor como si no tuviera
alergias.** La lista cerrada cubre los alérgenos comunes, así que **lo que se perdía era el raro**, que
es justamente el que el profesional no adivina.

Lo corregimos aplicando tu regla como la enunciaste: el texto libre alimenta al motor **cuando el motor
actúa sobre su contenido**, y se descarta cuando la respuesta es solo registro. Son diez campos ahora.
`d5_42` (contaminantes) y `d8_59` (quién prepara los alimentos) se quedan fuera por ese criterio.

> **Pregunta 9.** ¿Es ese el criterio correcto? Lo preferimos a una lista porque una lista describe el
> estado de hoy y deja de valer cuando el estado cambia, que es exactamente lo que nos acaba de pasar.

## 9.3 · Reporte, no pregunta: dos campos ya perdían el texto libre, y uno importa

Esto no lo estamos preguntando. Es algo que ya estaba pasando y que conviene que sepas.

`d2_21` (métodos que ha usado para cambiar de peso) y `d5_40` (medicamentos actuales) **sí tenían
`field_key` desde siempre**, así que su dato ya llegaba y su texto libre ya se estaba descartando.

En `d2_21` eso significa que un paciente que escribía **"Otra: me provoco vómito"** no encendía la
detección de métodos de control de peso. El motor veía la lista sin ese elemento.

**Y hay un agravante:** la historia clínica lee las respuestas **en crudo**, sin pasar por esa capa. Así
que el documento mostraba el método o el medicamento **que el motor no había visto**. Dos superficies del
mismo sistema leyendo fuentes distintas, y la que firma el profesional era la que sí lo mostraba.

**Ninguna evaluación real quedó afectada:** revisamos la base y no hay ni una respuesta con texto libre
en esos dos campos. El defecto era real y estaba vivo en el código, pero ningún paciente lo alcanzó.
Queda corregido con el mismo cambio del 9.2.

---

# 10 · Construimos el filtro de alergias, y en el camino escribimos contenido clínico que tienes que revisar

Esto es lo último y es lo que más nos importa que veas, porque **hay dos listas que redactamos nosotros
y son criterio nutricional, no código**.

## 10.1 · El menú ahora se le pide al modelo de otra forma

Hasta hoy le pedíamos el menú en prosa: *"responde solo con el menú"*. Lo cambiamos a una lista de
alimentos por tiempo de comida.

**La razón no es de formato, es que sobre prosa no se puede comprobar nada.** Para verificar que un menú
no lleva mariscos, con prosa lo único posible es buscar la palabra, y eso falla en las dos direcciones:
se le escapa "camarones" cuando la alergia dice "mariscos", y se dispara con "leche de almendras" cuando
la alergia es a la leche. Con el menú como lista, la comprobación es alimento contra alimento.

Y hay una razón de fondo: **sin esa comprobación, el aviso de alergias que le damos al modelo parece
proteger y no protege.** Una instrucción se cumple casi siempre, y "casi siempre" no es criterio cuando
lo que está en juego es una reacción alérgica.

**Lo que esto NO detecta, dicho claro:** un alimento que contiene el alérgeno sin nombrarlo. Un "pan de
trigo" lo dice; una "salsa césar" lleva anchoas y no lo dice. Por eso el resultado se le presenta al
profesional y no sustituye su lectura.

## 10.2 · La lista de qué cuenta como cada alérgeno: la escribimos nosotros

Para que "Mariscos" cruce con un menú que dice "camarones", hubo que escribir a qué se traduce cada
alérgeno. **Eso es criterio nutricional y lo redactamos nosotros. Necesitamos que lo revises.**

| El paciente declara | Lo tratamos como | ¿Es correcto? |
|---|---|---|
| Leche | leche, lácteo, queso, yogur, mantequilla, crema de leche, kumis, cuajada | |
| Huevo | huevo, clara, yema, tortilla de huevo, revuelto | |
| Maní | maní, cacahuate, mantequilla de maní | |
| Trigo | trigo, pan, pasta, harina de trigo, galletas | |
| Soya | soya, tofu, salsa de soya, leche de soya, edamame | |
| Pescado | pescado, atún, salmón, tilapia, bagre, trucha, sardina, bacalao, mojarra | |
| Mariscos | camarón, langostino, langosta, cangrejo, almeja, mejillón, calamar, pulpo | |
| Lactosa | los mismos que leche, más helado | |
| Gluten | gluten, trigo, cebada, centeno, pan, pasta | |
| Fructosa | fructosa, jarabe de maíz, miel, jugo concentrado | |

**Dinos qué falta y qué sobra.** Sobra importa tanto como falta: si marcamos de más, el nutricionista ve
avisos falsos, y a la tercera vez aprende a ignorarlos. Entonces el mecanismo deja de proteger el día
que acierta.

Cuando el paciente escribe su alergia en "Otra" (mango, kiwi, ajonjolí), se busca tal cual, sin
traducción. Ahí no inventamos nada.

## 10.3 · El patrón alimentario: lo tratamos distinto que la alergia, y queremos que lo confirmes

Hicimos también lo del vegano al que le proponen pollo. **Pero no lo tratamos igual que una alergia**, y
la diferencia es clínica:

- **La alergia excluye cosas concretas.** La lista se puede escribir entera.
- **El patrón excluye categorías abiertas.** Un vegano no excluye "pollo": excluye todo lo de origen
  animal, y esa lista no se termina nunca (chorizo, chicharrón, manteca, morcilla).

Así que el cruce del patrón **encuentra lo evidente y no puede prometer que los encuentra todos**. Por
eso lo tratamos como un aviso de calidad del plan y no como un bloqueo de seguridad: un menú que se
salta el patrón es un plan que el paciente no va a seguir, como tú mismo dijiste, no uno que lo manda a
urgencias.

Y la segunda lista que escribimos nosotros:

| Patrón | Lo que excluimos |
|---|---|
| Vegano | carnes, pescados, mariscos, embutidos, huevo, lácteos, miel |
| Vegetariano | carnes, pescados, mariscos, embutidos (sí permite huevo y lácteos) |
| Sin gluten | trigo, cebada, centeno, pan, pasta, galletas |
| Sin lácteos | leche, queso, yogur, mantequilla, crema, cuajada, kumis |
| Keto | arroz, pan, pasta, papa, yuca, plátano, azúcar, arepa, harina |
| Bajo en sal | embutidos, jamón, chorizo, salchicha, enlatados |

**El de keto es el que más dudamos:** lo armamos por carbohidratos de uso habitual, pero el umbral de
qué entra y qué no es tuyo, no nuestro.

Si un paciente escribe un patrón en "Otra" que no está en esa tabla, **no producimos ningún aviso**. Es
deliberado: preferimos no decir nada a decir algo mal.

## 10.4 · Qué pasa cuando el sistema detecta un alérgeno

Se muestra el aviso **arriba del menú**, con el alérgeno, la comida y el alimento. Y no se puede
silenciar sin dueño: el nutricionista puede descartarlo, pero **tiene que escribir por qué**, y eso queda
en la historia de auditoría con su nombre y la fecha.

**El aviso no desaparece al descartarlo.** Quien vuelva a abrir esa sugerencia ve las dos cosas: que se
detectó un alérgeno, y quién dijo que estaba bien. Descartar es decir "lo miré y está bien", no "no pasó
nada".

> **Pregunta 10.** ¿Las dos tablas de arriba son correctas? Y en la de patrones, ¿el keto es el que tú
> usarías?

---

# 11 · La casilla al nivel 1: al ir a construirlo encontramos que rompe el cuadre calórico

Aprobaste mover la casilla de porciones del subgrupo al grupo (1.1). Fuimos a hacerlo y **paramos**,
porque el cambio deja una pregunta sin respuesta que es tuya, no nuestra.

**Y hay una razón por la que no la podemos sacar de tu archivo: tu archivo tiene la casilla en el
subgrupo.** Tú mismo lo dijiste. Así que sus totales son por subgrupo, y esto no es un porte: es diseño
nuevo. El número que falta es clínico.

## El problema, con tu propia tabla

Los alimentos de un mismo grupo **no aportan lo mismo**. En Lácteos (G4), de `INTER_TABLA_A`:

| Alimento | kcal por porción |
|---|---|
| Leche entera | **134** |
| Leche semidescremada | **100** |
| Leche descremada | **74** |

Hoy el cuadre se calcula multiplicando las porciones de **cada alimento** por su kcal, y ese total es lo
que se compara contra el objetivo calórico. Es el cuadre, no un adorno.

Si el nutricionista prescribe **"3 porciones de lácteos"** sin decir cuáles, el sistema no tiene con qué
número multiplicar:

> **3 lácteos son 222 kcal o 402 kcal según cuáles sean. Un 80 % de diferencia, en un solo grupo.**

Y por el P-26, cuáles lo resuelve la IA según la ciudad. O sea: **el dato que hace falta para el cuadre
no existe en el momento en que el profesional prescribe.**

## Y no afecta solo al cuadre: cuelgan tres cosas de esas porciones

Lo verificamos antes de escribirte, porque cambia el tamaño de la decisión:

1. **El cuadre calórico y los macros.** Proteína, carbohidrato y grasa se calculan igual.
2. **La distribución por tiempos de comida.** Reparte las porciones de cada alimento entre desayuno,
   almuerzo y cena. Repartir "3 lácteos" sí funciona; lo que queda sin número es cuántas kcal lleva cada
   comida.
3. **La validación de nutrientes (los 26 y el ICN).** Esta es la más seria: hoy dice qué porcentaje de
   cada nutriente cubre el plan. Con porciones por grupo pasaría a decir *"cubre entre el 60 % y el 110 %
   del calcio"*, y eso no es una afirmación clínica usable.

## Las cuatro salidas que vemos

| | Qué sería | Qué cuesta |
|---|---|---|
| **1** | Un **alimento representante** por grupo, con su kcal fija | El cuadre vuelve a ser un número. Pero **hay que elegir cuál**, y esa elección cambia el objetivo del paciente |
| **2** | El **promedio** del grupo | No corresponde a ningún alimento real: el cuadre sería de algo que nadie come |
| **3** | El cuadre **se calcula después**, cuando la IA elija por ciudad | Coherente con tu P-26, pero el profesional prescribe **sin ver el total**, que es para lo que existe la tabla |
| **4** | La prescripción sigue por grupo y el cuadre se muestra como **RANGO**: *"3 porciones de lácteos = entre 222 y 402 kcal según cuáles elija la IA"* | No inventa un número ni elige por ti, y el profesional ve la incertidumbre en vez de un total falso. Pero el rango **se propaga** a los macros, a los tiempos y a la validación de nutrientes |

**La 4 no es nuestra recomendación**, es una posibilidad que queremos que tengas delante porque puede
ser la que quieras. Si la eliges, lo que hay que decidir además es hasta dónde dejamos que el rango
llegue: un rango en el cuadre se entiende; un rango en la adecuación de calcio, no sabemos.

> **Pregunta 11.** ¿Cuál de las cuatro? Y si es la 1, ¿cuál es el alimento representante de cada uno de
> los 12 grupos? Si es la 4, ¿el rango llega hasta la validación de nutrientes o esa se queda como está?

**Mientras respondes no lo tocamos.** El cambio es de cálculo, y la regla que nos diste es parar.

**Una buena noticia, para que sepas que no urge por datos:** ningún tratamiento tiene porciones
guardadas todavía. No hay nada que migrar ni que se pierda, decidas lo que decidas.

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
| 5b | **Seguimiento dice hoy "mayor capacitancia = mejor", sin techo**, y tu 9.1 dice que el alto no es bueno y sube con el IMC | ¿Mejorar es subir, o acercarse a la mediana? |
| 5.4 | La casilla revierte **dos** niveles | Nada, es aviso |
| 5.5 | Suplementos y medicación son **texto libre** | ¿Se muestran literal, o pasan a opciones cerradas? |
| 6 | La alergia **se filtra en código**, no por instrucción al modelo | Confirmar que estás de acuerdo |
| 7.1 | **Carnes rojas: el orden de `FREQ_GROUPS`.** Bloquea el rediseño del formulario | ¿Deliberado o descuido? |
| 7.2 a 7.6 | Cinco defectos de tu archivo sin comentar. **El de la fecha de la firma es probatorio** | Acuse |
| 8 | El **anexo** de este documento contesta el 8.5 y el 3.5 | Nada |
| 9.1 | **El alcohol conserva tu intención de Q6 cambiando su mecanismo**: llega al profesional, efecto cero en el diagnóstico, probado por un candado | Confirmar |
| 9.2 | Tu regla del §4 era **más amplia** que nuestra implementación. Un alérgico al mango llegaba sin alergias | ¿El criterio es el correcto? |
| 9.3 | **Reporte:** `d2_21` y `d5_40` ya perdían su texto libre. Ninguna evaluación real afectada | Nada, ya corregido |
| 11 | **La casilla al nivel 1 rompe el cuadre calórico**: 3 lácteos son 222 o 402 kcal. Tu archivo no lo puede responder porque tiene la casilla en el subgrupo | **Cuál de las cuatro salidas.** Parados hasta entonces |
| 10 | **El filtro de alergias está construido**, y con él DOS TABLAS que redactamos nosotros: qué cuenta como cada alérgeno, y qué excluye cada patrón | **Revisarlas.** Es criterio nutricional, no código |

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
