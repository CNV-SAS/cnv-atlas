# BORRADOR — Pregunta a Gildardo sobre la cadena calórica (para revisión de Santiago antes de enviar)

> **Estado:** BORRADOR. No enviado. Redactado el 2026-08-02 para que Santiago lo revise antes de mandarlo. En lenguaje llano, sin referencias de archivo. Marco: no le preguntamos "cuál de tus dos funciones", porque ya respondió que ninguna (definió un tercer modelo); le preguntamos qué pasa con lo que su tercer modelo no especifica.

---

Gildardo:

Nos dijiste que el gasto calórico se calcula con Mifflin sobre el peso de referencia, y que el ajuste solo se aplica cuando SUMA (el sobrecosto metabólico del cáncer), no cuando resta (porque el peso de referencia ya produce el déficit). Al ir a implementarlo encontramos cuatro cosas que tu instrucción no menciona y que tus dos versiones anteriores resuelven de forma distinta. Necesitamos tu decisión en cada una. Son cuatro decisiones concretas sobre tu propio modelo.

## Hueco 1 · ¿Sobre qué peso se calcula el gasto?

Tu instrucción dice "Mifflin sobre el peso de referencia".

- Una de tus versiones calcula el gasto basal sobre el **peso medido** (el actual del paciente) y usa el peso de referencia solo para la proteína.
- La otra usa el peso de referencia en más partes.

Pregunta: el gasto basal (la base del cálculo calórico), ¿lo calculamos sobre el **peso de referencia** (el que ingresa el profesional) o sobre el **peso medido**? Lo preguntamos porque cambia todas las calorías del plan, no solo un detalle.

## Hueco 2 · ¿Cómo se calcula el objetivo calórico en cáncer?

Tus dos versiones lo hacen distinto:

- Una toma el gasto total y le SUMA una cantidad fija (por ejemplo +300 kcal/día).
- La otra ignora el gasto y usa directamente una regla por peso (por ejemplo 27,5 kcal por kilo de peso medido).

Pregunta: en el paciente con cáncer activo, ¿el objetivo es "gasto total más el sobrecosto" o "tantas kcal por kilo"? Y si es lo primero, ¿cuánto suma el sobrecosto y sobre qué peso?

## Hueco 3 · ¿Cuánta proteína, y sobre qué peso?

Tus dos versiones dan cifras de proteína distintas para el mismo paciente. Por ejemplo, en cáncer una indica un rango alto (alrededor de 1,5 a 2,0 g por kilo) y la otra un valor más bajo (alrededor de 1,25 g por kilo). Y una la calcula sobre el peso de referencia, la otra sobre el peso medido.

Pregunta: ¿qué cantidad de proteína por kilo usamos (un valor o un rango, por condición), y sobre cuál peso se multiplica, el de referencia o el medido?

## Hueco 4 · El factor de actividad, cuando el profesional no lo elige

En las dos versiones el profesional PUEDE elegir el factor de actividad (sedentario, ligero, moderado, alto). Eso no cambia. La diferencia es qué pasa cuando NO lo elige:

- Una usa un valor fijo por defecto (ligero).
- La otra calcula un valor sugerido a partir del nivel de ejercicio prescrito (por ejemplo, para obesidad sugiere "moderado").

Pregunta: cuando el profesional no elige el factor, ¿usamos un valor fijo por defecto, o el sugerido según el ejercicio? Te avisamos que la segunda opción requiere construir tu motor de ejercicio, que hoy no está implementado, así que agranda el trabajo. El profesional conserva la elección en cualquiera de las dos.

## Dos confirmaciones (creemos que ya las respondiste, queremos asegurarnos)

**A. Sin peso de referencia, no hay prescripción calórica ni proteica, sin respaldo por fórmula.** Tú dijiste que sin peso meta registrado, Atlas entrega el diagnóstico completo pero no emite la prescripción calórica ni la proteica, sin caer en silencio al peso medido. Tu archivo actual SÍ tiene un respaldo por fórmula cuando falta el peso meta. Vamos a quitarlo, a propósito, siguiendo tu instrucción: es una divergencia deliberada respecto de tu archivo y te la avisamos. ¿Confirmas?

**B. El peso de referencia es el que ingresa el profesional, no el que calcula una fórmula.** Entendimos que el peso de referencia es el que el profesional registra en el módulo antropométrico (a dónde quiere llevar al paciente), no el peso ajustado que calcula el sistema con una fórmula sobre el peso medido. ¿Lo leímos bien?

---

Gracias. Con estas cuatro decisiones y las dos confirmaciones cerramos la cadena calórica, que es lo que desbloquea también el protocolo del cáncer.
