# BORRADOR — Ronda corta a Gildardo (para revisión de Santiago antes de enviar)

> **Estado:** BORRADOR. No enviado. Para que Santiago lo revise y apruebe antes de mandarlo. Ordenado por esfuerzo (primero lo que se responde en minutos, al final lo que exige sentarse). Marcado **[bloquea]** lo que detiene trabajo nuestro. Sin referencias de archivo ni línea en el cuerpo; el anexo técnico al final es para su asistente.
>
> **Nota de armado (para Santiago, no va a Gildardo):** se dejaron FUERA, a propósito, Q24 (indicadores que alertan juntos, material de comunicación, no bloquea) y Q26 (el interruptor del índice contextual, ligado a C1, que está en pausa). Ambas pueden esperar a una ronda posterior. Si quieres incluir Q26, la agrego (es un sí/no rápido para él y evita que su prototipo y Atlas calculen la edad bioeléctrica distinto).

---

Gildardo:

Un paquete corto. Están ordenadas de menos a más esfuerzo. Marcamos las que detienen trabajo de nuestro lado.

## 1. Dos confirmaciones rápidas (sí / no)

**A. Sin peso de referencia registrado, no emitimos prescripción calórica ni proteica, sin respaldo por fórmula.** Tú dijiste que sin peso meta registrado, Atlas entrega el diagnóstico completo pero no emite la prescripción calórica ni la proteica, sin caer en silencio al peso medido. Tu archivo actual sí tiene un respaldo por fórmula cuando falta ese peso. Vamos a quitarlo, a propósito, siguiendo tu instrucción: es una divergencia deliberada respecto de tu archivo y te la avisamos. ¿Confirmas?

**B. El peso de referencia es el que ingresa el profesional, no el que calcula una fórmula.** Entendimos que el peso de referencia es el que el profesional registra al medir (a dónde quiere llevar al paciente), no el peso ajustado que calcula el sistema con una fórmula sobre el peso medido. ¿Lo leímos bien?

## 2. Firma de C11: la corrección de la tabla de indicadores (ya hecha)

Esto no es pregunta, es la descripción del cambio que pediste, para que puedas firmar C11.

Nos dijiste: "corrijan la tabla contra el motor para IFC, IRC y FMI, no al revés." Lo hicimos así:

- **Antes:** el rango de referencia que veía el profesional para esos tres salía de tu tabla de presentación, que era genérica (no distinguía sexo) y, en el IRC, estaba en otra escala. Por eso no coincidía con la clasificación del paciente, que sí sale de tu clasificador. Mientras eso estuvo sin resolver, esos tres los dejamos en blanco.
- **Ahora:** el rango sale de tu clasificador (el del motor, el que distingue por sexo). Para el IFC mostramos el umbral por encima del cual la función es óptima; para el IRC, el umbral por debajo del cual el riesgo es bajo; para el FMI, la banda de masa grasa normal. Cada uno por sexo, con tus mismos cortes.
- **Corregimos también la dirección:** en el IFC lo bueno es hacia arriba, en el IRC hacia abajo. La tabla vieja no lo comunicaba; ahora la referencia lo dice.
- Pusimos un candado automático: si en algún momento cambias un corte de tu clasificador, el sistema avisa que la referencia mostrada quedó desactualizada, para que las dos nunca se separen en silencio.

Los otros indicadores (ángulo de fase, radio de reactancia, FFMI y los índices integrados) ya coincidían con tu clasificador y no cambiaron. ¿Confirmas que así lo querías? Con eso firmas C11.

## 3. [bloquea] ¿Se puede diagnosticar con la encuesta incompleta?

Ahora las preguntas de la encuesta son opcionales para el paciente (el profesional la completa en consulta si quedó a medias, como en tu prototipo). Eso significa que muchas encuestas llegarán incompletas.

Verificamos con la misma medición que una encuesta con la mayoría de respuestas en blanco cambia el cuadro: sube el nivel de riesgo, activa una ruta de atención que no corresponde, y mueve la edad bioeléctrica, porque los dominios sin responder corren con valores por defecto. Hoy nada lo impide: el sistema la trata como completa, el profesional no ve advertencia, y el diagnóstico se sella.

Tu decisión de P0 fue que la fórmula no se toca ni se acota, y estamos de acuerdo. Pero eso supone que la encuesta viene completa. ¿Qué debería hacer el sistema si el profesional intenta diagnosticar con la encuesta incompleta? ¿Diagnosticar sin la edad bioeléctrica, como ya hace cuando falta el índice contextual? ¿Diagnosticar con advertencia visible? ¿O no diagnosticar hasta completarla? Es la misma familia que tu regla de "sin índice contextual no hay edad bioeléctrica", un nivel arriba.

## 4. ¿Qué puede hacer un médico o un deportólogo dentro del modelo?

Atlas hoy está pensado para que el nutricionista opere el modelo completo (genera el protocolo, prescribe calorías y proteína, arma el plan). Un médico o un deportólogo puede medir al paciente, ver el diagnóstico completo, consultar la orientación de su especialidad y dejar una nota clínica, pero no tiene una conducta propia que registrar (no prescribe, no ordena exámenes con registro, no documenta su intervención).

¿Qué debería poder hacer cada profesión dentro del modelo? ¿O el modelo está pensado para que el nutricionista sea quien opera y las demás participen de otra forma? La respuesta define si conviene vincular médicos y deportólogos ya, o arrancar solo con nutricionistas hasta que existan sus módulos.

**Una cosa concreta que salió al revisar el panel médico:** entre los exámenes sugeridos, "Telómeros / estrés oxidativo" cita como referencia el propio modelo ("ANI BIS-E 2026"), no un protocolo de laboratorio estándar. No es un examen de laboratorio habitual, y un médico probablemente no sabría dónde ordenarlo. ¿Es deliberado (un examen propio del modelo), y cómo se ordena o dónde se procesa?

## 5. ¿Cómo funciona la remisión en el modelo?

En Tratamiento mostramos las remisiones que activa cada ruta, pero hoy remitir no es una acción: es una indicación que el profesional lee, sin registro. Y cuando la ruta remite a la misma profesión del que atiende, el profesional lee una instrucción para remitirse a sí mismo (un médico ve, dentro de su propio panel, "Remisión médica si hipertensión o diabetes activa").

¿Cómo funciona la remisión en tu modelo? ¿El profesional debería poder registrar que remitió, y a quién? ¿Y qué debería ver cuando la remisión es a su propia especialidad? (Suena a que ahí no es "remite a", sino "esto te corresponde a ti".)

## 6. [bloquea] La cadena calórica: cuatro cosas que tu tercer modelo no especifica

Nos dijiste que el gasto se calcula con Mifflin sobre el peso de referencia y que el ajuste solo se aplica cuando suma (el sobrecosto del cáncer), no cuando resta. Al implementarlo encontramos cuatro cosas que tu instrucción no menciona y que tus dos versiones anteriores resuelven distinto. Son cuatro decisiones concretas sobre tu propio modelo.

**6.1. ¿Sobre qué peso se calcula el gasto?** Una de tus versiones calcula el gasto basal sobre el peso medido (el actual) y usa el peso de referencia solo para la proteína; la otra usa el de referencia en más partes. ¿El gasto basal lo calculamos sobre el peso de referencia o sobre el peso medido? Cambia todas las calorías del plan.

**6.2. ¿Cómo se calcula el objetivo calórico en cáncer?** Una versión toma el gasto total y le suma una cantidad fija; la otra ignora el gasto y usa una regla por peso (tantas kcal por kilo). En cáncer activo, ¿el objetivo es "gasto total más el sobrecosto" o "tantas kcal por kilo"? Y si es lo primero, ¿cuánto suma y sobre qué peso?

**6.3. ¿Cuánta proteína, y sobre qué peso?** Tus dos versiones dan cifras distintas para el mismo paciente (en cáncer, una indica un rango alto y la otra un valor más bajo), y una la calcula sobre el peso de referencia, la otra sobre el medido. ¿Qué cantidad de proteína por kilo usamos (un valor o un rango, por condición), y sobre cuál peso se multiplica?

**6.4. El factor de actividad, cuando el profesional no lo elige.** En las dos versiones el profesional puede elegir el factor (sedentario, ligero, moderado, alto); eso no cambia. La diferencia es qué pasa cuando no lo elige: una usa un valor fijo por defecto (ligero); la otra calcula un valor sugerido según el ejercicio prescrito. ¿Usamos el valor fijo o el sugerido? La segunda opción exige construir tu motor de ejercicio, que hoy no está, así que agranda el trabajo. El profesional conserva la elección en cualquier caso.

## 7. [bloquea] La comunicación al paciente del cambio de la edad bioeléctrica (segunda medición)

El mecanismo ya está construido (tres bandas, intervalo mínimo de 12 semanas, corte provisional de ±2 años). Falta lo que solo tú puedes escribir. Está desconectado a propósito: nada llega a un paciente hasta tu respuesta, porque además tu decisión puede cambiar la forma, no solo el texto.

**7.1. La redacción de las tres bandas** de cara al paciente (mejoró / sin cambio / empeoró), sin nombrar "edad bioeléctrica" ni dar cifra. Hoy usamos textos neutros de relleno.

**7.2. La banda "empeoró": ¿la aprueba el profesional antes de que salga?** Como la banda se calcula sola y el reporte se aprueba y se envía, el profesional podría aprobar el documento sin haber leído esa sección, y el paciente recibir un "empeoró" sin que nadie decidiera comunicárselo. ¿El profesional debería confirmarlo antes de que salga (como confirma el diagnóstico), o el reporte lo lleva siempre? Y "empeoró" probablemente va acompañado de algo (el plan, la próxima cita): ¿de qué?

**7.3. El corte de ±2 años es provisional, y eso afecta "sin cambio".** Un cambio de 1,9 años se comunica hoy como "sin cambio". Decirle a un paciente "se mantuvo estable" es algo que el modelo, con el corte provisional, no sostiene del todo. ¿Es aceptable así por ahora, o el texto debería ser más prudente (algo como "sin cambios significativos con la información disponible")?

## Y lo que queda de tu lado

Cuando puedas: **C6** (el gasto y la proteína sobre peso meta, que dijiste que completas y nos envías con el déficit ya cerrado), **P2** (que va primero, porque destraba los nutracéuticos por ruta) y **P3**.

Gracias. Con esto cerramos la cadena calórica (que desbloquea también el protocolo del cáncer), la comunicación del seguimiento, y las dos preguntas de flujo clínico.

---

## Anexo técnico (para tu asistente / CC)

Solo los valores concretos, por si ayuda a verificar contra el código. Sin esto el cuerpo se entiende igual.

- **Cadena calórica, las dos versiones que divergen:**
  - Gasto basal: una versión usa Cunningham (500 + 22 × masa magra) cuando hay masa magra; la otra, Mifflin sobre el peso medido siempre.
  - Cáncer: una da "gasto total − déficit" con déficit −300 (o sea +300); la otra, 27,5 kcal × kg de peso medido.
  - Proteína en cáncer: una da rango 1,5–2,0 g/kg (sobre peso de referencia); la otra, 1,25 g/kg (sobre peso meta).
  - Déficit por condición: una lo pone por fenotipo (−300 cáncer, +500 obesidad sarcopénica, +600 obesidad, +300 preclínica); la otra solo +500 en obesidad.
  - Factor de actividad: mapa {sedentario 1,2 · ligero 1,375 · moderado 1,55 · alto 1,725 · muy alto 1,9}; el sugerido sale del motor de ejercicio (faRec).
- **C11, cortes del clasificador que ahora mostramos** (por sexo, H / M): IFC umbral óptimo 6,68 / 3,28; IRC umbral de bajo riesgo 1,68 / 2,27; FMI banda normal 3–6 / 5–9. Coinciden con los literales de tus clasificadores.
- **Encuesta incompleta:** de los 13 campos que alimentan el motor, una encuesta a 3 de 13 sube el riesgo de MEDIO a ALTO y activa una ruta contextual extra; los dominios sin responder corren con sus valores por defecto.
