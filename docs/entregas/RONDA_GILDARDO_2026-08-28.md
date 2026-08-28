# Ronda del 2026-08-28

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 28 de agosto de 2026

Dos preguntas y un aviso. La primera es sobre una instrucción tuya que **no estamos cuestionando**: lo
que cambió es la premisa sobre la que la diste. La segunda es una divergencia con tu archivo que
preferimos contarte antes de que la notes.

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

No necesitamos nada tuyo aquí: te lo contamos porque es tu pieza y quedó distinta.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
