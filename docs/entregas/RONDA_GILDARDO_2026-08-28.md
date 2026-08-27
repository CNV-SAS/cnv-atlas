# Ronda del 2026-08-28

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 28 de agosto de 2026

Una sola pregunta, y es sobre una instrucción tuya que **no estamos cuestionando**: lo que cambió es la
premisa sobre la que la diste.

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

© Connected Nutrition Ventures SAS, 2026. Documento interno.
