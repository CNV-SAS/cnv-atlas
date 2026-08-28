# Ronda del 2026-08-28

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 28 de agosto de 2026

Cuatro puntos. Los tres primeros son decisiones que te devolvemos: qué hicimos, por qué, y si lo
mantenemos o lo revertimos. El cuarto es un defecto de tu archivo que encontramos al cotejar, con dos
cifras clínicas de por medio.

**Ninguno de los tres primeros está cerrado por nuestra cuenta:** si no estás de acuerdo con alguno,
se revierte.

---

# 1 · El alérgeno de LUVIA: el criterio legal cambió la premisa, y el cruce ya existe

## Lo que nos dijiste, y por qué tenía sentido

**"El alérgeno se avisa pero no se cruza."** Cuando lo dijiste, el sistema **no tenía con qué cruzarlo**:
las alergias del paciente ni siquiera llegaban al motor (son dos de las 25 preguntas sin `field_key` que
te reportamos en la ronda del 26). Avisar era todo lo que se podía hacer.

## Las dos cosas que cambiaron desde entonces

**Primera: el cruce ya está construido.** Al cablear tu 3.2 hicimos el filtro de alérgenos del menú, con
la tabla de traducción que te mandamos para revisar (la del punto 10 de la ronda anterior). El sistema
hoy **sabe** que un paciente declaró alergia al gluten y **sabe** que LUVIA contiene avena.

**Segunda, y es la que pesa: el asesor legal dice que mostrarlo no basta.** Su argumento, textual:

> *"Un sistema que tenía el dato y no lo usó es mucho más difícil de defender que uno que nunca lo
> tuvo."*

Recomienda **bloquear activamente**, con confirmación afirmativa y registro de quién la vio y decidió
seguir.

## Por qué te lo preguntamos en vez de aplicarlo

Porque **es criterio clínico y es tuyo**, y porque el legal opina sobre exposición, no sobre práctica. Un
bloqueo que estorbe en cada consulta se convierte en un clic automático, y entonces no protege a nadie y
además estorba. Eso lo sabes tú, no él.

## Y no habría que inventar nada: el patrón ya existe y lo aprobaste

Es **exactamente el mismo** que construimos para el alérgeno del menú, que ya viste en la ronda anterior:

- El aviso sale **arriba**, con el alérgeno, el producto y por qué.
- El profesional puede seguir, pero **escribiendo el motivo** (mínimo 10 caracteres, validado en el
  servidor).
- Eso queda en la **historia de auditoría** con su nombre y la fecha.
- **El aviso no desaparece al descartarlo**: quien vuelva a abrirlo ve las dos cosas, el alérgeno
  detectado y quién dijo que estaba bien. Descartar es decir "lo miré y está bien", no "no pasó nada".

> **Pregunta 1.** ¿Mantenemos "se avisa pero no se cruza" para LUVIA, o aplicamos el mismo bloqueo con
> confirmación y motivo que ya usa el menú? Y si es lo segundo, ¿vale para **todos** los productos con
> alérgeno declarado, o solo cuando el paciente tiene esa alergia registrada?

**Mientras respondes no lo tocamos.** LUVIA no está construida todavía, así que no hay nada que
deshacer: entra ya con el criterio que nos digas.

---

# 2 · El "Meta kg" de tu tabla: no lo portamos, y queremos que lo sepas

Es una **divergencia visible**: tu archivo lo tiene y Atlas no va a tenerlo, así que preferimos
decírtelo antes de que lo notes.

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

**Y no te lo contamos solo para informarte: la decisión es tuya.** Las tres diferencias son juicios
nuestros sobre una pieza tuya, y cualquiera de ellas se revierte si no estás de acuerdo.

> **Pregunta 3.** ¿Las mantenemos o revertimos alguna? En concreto: ¿el sellado tras el diagnóstico te
> parece bien, o el profesional debería poder corregir también después? ¿Y la fuerza prensil se queda
> donde está (condiciones del BIS) o la quieres también aquí, aunque sean dos sitios? Si revertimos
> algo, dinos qué prefieres en su lugar.

---

# 4 · Dos filas de tu tabla muestran un indicador con la etiqueta del otro

Esto no es una divergencia nuestra: es un defecto de tu pantalla, y lo verificamos **contra tus propias
fórmulas** antes de decírtelo, porque son dos cifras clínicas.

## Las dos filas

Mismo paciente, misma medición (Nico, ACT 44,66 · masa grasa 18,04 · peso 80,40):

| Fila | Tu pantalla | Atlas |
|---|---|---|
| **FFW, agua libre de grasa (L)** | 44,66 | **41,95** |
| **Hidratación sin grasa (%)** | 71,60 | **70,33** |

## Las dos tienen la misma causa, y está en tu propio archivo

Tu `derivar-composicion.js` define **dos** indicadores de hidratación, y el comentario 4.7 dice
literalmente que **no son el mismo**:

```js
poner('ACT_MLG', ACT / FFM * 100,             'Hidratación de la masa sin grasa')
poner('hidSG',   FFW / (FFM - 0,15*FM) * 100, 'Hidratación sin grasa')
```

Con los números de este paciente:

- `ACT / FFM` = **71,62** → es lo que tu pantalla muestra bajo la etiqueta *"Hidratación sin grasa"*
- `FFW / (FFM − 0,15 × FM)` = **70,33** → es lo que muestra Atlas

O sea: **tu pantalla rotula "Hidratación sin grasa" y muestra el otro**, el que tu propio archivo llama
"Hidratación de la masa sin grasa".

**Y el FFW es la misma historia.** Tu fórmula es `FFW = ACT − 0,15 × FM`, que da **41,95**, lo que
muestra Atlas. Tu pantalla muestra **44,66**, que es exactamente ACT: la fila de FFW está mostrando el
agua corporal total.

## Lo que queremos que veas

**Atlas está bien, y lo está por usar tus fórmulas.** No cambiamos nada ni interpretamos: la derivación
usa tus identidades congeladas, verificadas sobre 5.073 registros. Lo decimos así porque es lo que te
permite arreglar tu archivo: **no hay que decidir qué número es correcto, hay que hacer que cada fila
muestre el indicador que su etiqueta nombra.**

> **Pregunta 4.** ¿Confirmas que las dos filas de tu pantalla están tomando el indicador equivocado? Y
> si en realidad la etiqueta es la que está mal (es decir, querías mostrar `ACT/FFM` y llamarlo de otro
> modo), dinos cuál es el rótulo correcto y lo ajustamos en Atlas.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
