# Plan: portar los tres motores de tratamiento (médico, ejercicio, psicología) — 2026-08-03

Planning-first. Los motores son construibles YA (no esperan C6) y dos alimentan la cadena calórica. Verificado leyendo su código en el vigente.

## (a) El orden entre ellos: psicología → ejercicio → médico (CONFIRMADO con el código)

- **Psicología PRIMERO.** Produce `tcaFlag`, la señal que el motor nutricional usa para la salvaguarda de conducta alimentaria (pausar el déficit). Es protección clínica y es lo que la cadena calórica va a necesitar como requisito duro. Además es el más autocontenido (solo encuesta, ignora el BIS).
- **Ejercicio SEGUNDO.** Produce `faRec`, el factor de actividad que el nutricional usa como valor por defecto. La cadena lo necesita, pero es menos crítico que la salvaguarda (es un default, no una protección).
- **Médico ÚLTIMO.** Verificado: nadie consume su salida (`metas/monitoreo/remisión/medNotas`); es independiente. Puede ir en cualquier momento; va al final porque no desbloquea nada.

Los dos acoplamientos (psico→nutri, ejercicio→nutri) confirman el orden; el médico fuera de la cadena confirma que va al final.

## (b) La precondición del psicológico (protocolo de riesgo): SE CAE, con una confirmación menor

Registro previo: el bloque psicológico tenía una precondición bloqueante, el protocolo de riesgo de PHQ-9/SCOFF/GAD-7 (qué hace el sistema si un tamizaje sale positivo, p. ej. riesgo suicida). **Verificado con el motor enfrente:**
- El motor SÍ define la conducta para lo que detecta: computa SCOFF desde la encuesta (`d2_21`) y, si es positivo, marca "remitir a psicología clínica o psiquiatría". No hay un tamizaje que detecte y no diga qué hacer.
- PHQ-9 y GAD-7 NO los computa el sistema: el motor los deja como "aplicar en consulta". La encuesta no captura sus ítems. Así que **Atlas nunca auto-detecta depresión/ansiedad/riesgo suicida**: el caso peligroso (detectar y no actuar) no existe, porque no hay detección automática de esos.
- **Conclusión: la precondición como estaba (detección sin conducta) SE CAE.** El motor se porta tal como está (SCOFF con conducta; PHQ-9/GAD-7 a consulta). Queda UNA confirmación menor, NO bloqueante, para Gildardo: que dejar PHQ-9/GAD-7 a la consulta (el sistema no los captura ni tamiza) es intencional, no un hueco. Entra al documento consolidado como consulta cuando responda; no frena el port.

## (c) Dónde vive cada motor: EXTRACTO VERBATIM CONTIGUO → frozen + DIFF

Los tres motores son contiguos en el vigente (médico 14176-14208, ejercicio 14209-14234, psicología 14235-14254), justo después de `motorTratNutri`. Son funciones JS puras (regex + construcción de objetos, sin React ni DOM). **Se portan verbatim a `frozen/`, con su DIFF contra el vigente y golden, como `atlas-protocolo.js`.** NO es el caso de transcripción de `engine.indices.js` (donde no había extracto verbatim): aquí sí lo hay. Propuesta: un archivo `frozen/atlas-tratamiento.js` con los tres (o `motorTratNutri` también, cuando llegue la cadena), su DIFF, y golden por motor con casos del donante.

## (d) Las pantallas: motores PRIMERO (con golden), pantallas después

- Se portan los MOTORES primero, con golden que prueba paridad. El valor está en los motores: son los que alimentan la cadena (`faRec`, `tcaFlag`) y los que producen la salida clínica. Sellarlos con su constelación es lo que hace el registro reconstruible.
- Las PANTALLAS (los bloques React `trat_medico`/`trat_ejercicio`/`trat_psico`, ~160 líneas c/u) se portan DESPUÉS, en nuestra TS/TSX (no son frozen: son UI, como el resto de Atlas). Pueden esperar: no bloquean la cadena, y una parte de su contenido (los párrafos narrativos, ver (e)) depende de C9. Además la subpestaña por profesión (la navegación) va con las pantallas.
- Argumento: separar motor de pantalla es lo que permite tener el motor sellado y probado antes de decidir la UI, y evita que la dependencia C9 de la narrativa frene el motor, que no la tiene.

## (e) Los cuatro párrafos narrativos: BLOQUE APARTE, tres de cuatro con dependencia C9/Q26

Verificado qué campos lee cada `_resumenXXXParrafo`:
- **Psicológico** (`_resumenPsicoParrafo`): lee percepción corporal, insatisfacción, control, métodos, estrés, sueño (d2_*, d3_*). **NO llama `_resDietaCoarse`, no lee `d7_agua`. LIMPIO: portable ya.**
- **Médico** (`_resumenMedicoParrafo`): antecedentes, dx, cirugía, alergias, medicamentos, actividad, tabaco, alcohol, estrés, sueño, **y `_resDietaCoarse`** (la cláusula "mantiene [dieta]", C9-dependiente).
- **Ejercicio** (`_resumenEjercicioParrafo`): actividad, FFMI, **`d7_agua`** (Q26), estrés, **y `_resDietaCoarse`** (C9).
- **Nutricional:** C9-dependiente (ya sabido).
**Conclusión:** los párrafos son un BLOQUE APARTE de los motores (son narrativa/display, no motor clínico; los MOTORES no llaman `_resDietaCoarse`). El psicológico se puede portar ya; nutri/médico/ejercicio arrastran la cláusula de dieta (C9) y ejercicio además la de hidratación (Q26), así que se portan contra una encuesta que va a cambiar. Recomendación: los párrafos NO se bundlean con los motores; van con las pantallas, y los tres con dependencia esperan a C9/Q26 (o se portan sin la cláusula de dieta).

## Resumen del bloque

1. **Motores (frozen + DIFF + golden), en orden psico → ejercicio → médico.** Construible ya, no espera C6. Es el núcleo y lo que alimenta la cadena.
2. **Cablearlos:** producir y sellar sus salidas (dónde: el pipeline/tratamiento; `tcaFlag` y `faRec` quedan disponibles para la cadena cuando se construya).
3. **Pantallas (TS/TSX) + subpestañas por profesión:** después, no bloquean.
4. **Párrafos narrativos:** bloque aparte; el psicológico ya, los otros tres esperan C9/Q26.
5. **Confirmación menor a Gildardo** (no bloqueante): PHQ-9/GAD-7 consult-only intencional.

**Alcance de lo primero (si apruebas): los tres motores a frozen con golden, en ese orden.** El cableado y las pantallas se planean como sub-tareas al cerrar los motores.
