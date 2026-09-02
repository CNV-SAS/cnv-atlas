# Ronda del 2026-09-02

**Abierta el 2 de septiembre, con la del 1 ya enviada.** Aquí va lo que sale del trabajo posterior, no
respuestas a lo que todavía tienes en tu escritorio.

## De un vistazo

| # | Qué es | Qué te pedimos | ¿Bloquea? |
| --- | --- | --- | --- |
| **1** | **Dos frases tuyas se contradicen en un caso que ninguna contempla**: reabrir una prescripción y volver a aprobarla **sin cambiar nada** | Cuál de las dos manda ahí, con nuestra propuesta al lado | No, pero decide qué le llega al paciente |
| **2** | Un campo de la cadena calórica que se queda **vacío** produce una prescripción implausible sin que nada lo distinga de una decisión | Si esos campos deben tener un valor por defecto que no se pueda borrar. **No te pedimos validar una cifra** | No |

---

# 1 · Un tratamiento reemitido que es idéntico al anterior: ¿se le avisa al paciente?

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

# 2 · Un campo vacío se lee igual que una decisión, y ahí sí podemos hacer algo

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

© Connected Nutrition Ventures SAS, 2026. Documento interno.
