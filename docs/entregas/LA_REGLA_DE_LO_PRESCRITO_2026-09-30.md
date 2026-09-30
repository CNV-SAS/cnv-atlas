# La regla de lo prescrito: la rompí yo, y hay que decidir cómo se arregla

**Para Santiago. Reportado, no cambiado. Lo único que toqué es el mensaje, que no decía la salida.**

---

## Lo primero: la regla no es nueva y era correcta

`"Solo se venden aquí los nutracéuticos prescritos en este tratamiento"` existe desde el Bloque 3, y su
comentario dice literalmente **por qué** era correcta:

> *"Lo no prescrito se vende en `/pagos`, no se cuela en la venta de la consulta."*

O sea: la regla se escribió para la venta que nace **en Tratamiento**, donde la pantalla solo ofrece lo
prescrito. Ahí, un producto no prescrito solo puede llegar si alguien manipuló la petición, y bloquear es lo
correcto. **Y tenía una válvula de escape declarada: /pagos.**

## Y lo segundo, que es lo que importa: yo cerré esa válvula

Al hacer obligatorio el tratamiento en /pagos, **las ventas de /pagos pasaron a llevar `treatment_id`**, así
que esta regla — escrita para la venta en consulta — empezó a aplicarse también ahí. **La salida que la regla
asumía es exactamente la que quité.**

No es que la regla sea demasiado estricta: **es que le cambié el contexto sin darme cuenta.** Es el patrón que
ya tenemos escrito como lección: una regla nueva puede invalidar el mecanismo de una vieja, y el síntoma
aparece lejos de donde se tocó.

## El caso real que tú planteas, y lo que cuesta forzarlo

El paciente vuelve, y el profesional le vende algo que **no estaba en el plan de esa consulta pero sí viene de
su seguimiento**. Hoy las opciones son dos, y las dos pierden algo:

| Opción | Qué pierde |
| --- | --- |
| Marcarlo "sin consulta" | **El vínculo clínico**, que es justo lo que buscábamos. Y ensucia la cifra: aparecería como compra de mostrador cuando no lo es |
| No venderlo por /pagos | No hay otra vía: la venta en consulta tampoco lo deja |

**Y hay un costo que no es obvio:** forzar "sin consulta" **destruye el insight que tú pediste**. "Cuántos
compran fuera de lo prescrito" solo se puede medir si la compra **conserva su consulta** y se marca como fuera
del plan. Si se va a "sin consulta", el dato desaparece: ya no se sabe de qué plan se apartó.

**La pantalla nueva ya cuenta las dos cosas por separado** (líneas dentro del plan, líneas fuera), y su
candado tiene un caso dedicado a que una venta suelta **no** cuente como "fuera del plan", porque son dos
hechos distintos. Ese eje solo se llena si la regla deja pasar la compra fuera del plan.

## Lo que recomiendo

**Que la regla siga bloqueando donde nació y avise donde no.**

- **En la venta que nace en Tratamiento: sigue bloqueando.** Esa pantalla solo ofrece lo prescrito, así que un
  producto no prescrito ahí no es un caso legítimo: es una petición que no pudo salir de la pantalla.
- **En /pagos: avisa y el profesional confirma.** "Ese producto no estaba prescrito en esa consulta. ¿Lo
  registro así?" Y la venta queda atada, marcada como fuera del plan.

Es la forma que ya usamos en el resto del sistema: **el sistema propone, la persona decide, y queda el
registro de que decidió.** Igual que el faltante (Atlas propone, dos personas cobran) y que la alerta de
vencimiento (Atlas propone quién asume, nadie cobra solo).

**Lo que costaría:** una bandera explícita en la venta (`fuera_del_plan_confirmado`), el aviso con su botón de
confirmar, y que la regla lea la bandera. Sin migración de datos: nada que recalcular.

**Y lo que NO haría:** quitar la regla del todo. En la venta en consulta es el único guard que impide colar
un producto por una petición armada a mano, y ese guard sí ha servido.

## Mientras decides

**El mensaje ya dice la salida**, que era el defecto real: *"Ese producto no está prescrito en la consulta que
elegiste. Si la compra no sale de ese plan, marca «No sale de ninguna consulta» y escribe por qué: la venta se
registra igual."* Con eso puedes seguir el smoke hoy, con el costo dicho arriba: esa venta sale de las cifras
del plan.

## Y tu confirmación

**Sí: la regla dice PRESCRITOS, no "recomendados por el modelo".** Son dos cosas distintas y las dos se
guardan:

- **Lo prescrito** vive en `treatment_nutraceuticals`, por id. Si el profesional prescribió algo que el modelo
  no recomendó, **cuenta como prescrito y se vende sin problema**. Su criterio clínico no es una excepción a
  la regla: es la regla.
- **Lo que el modelo recomendó** vive aparte, en el snapshot sellado del informe. La pantalla nueva lo muestra
  en su propio bloque ("lo que el modelo recomendó y no se prescribió"), y con una frase que evita el mal uso:
  apartarse del modelo **no es un error**, el modelo propone.

Era tu preocupación y la respuesta es que no hay nada que arreglar ahí.
