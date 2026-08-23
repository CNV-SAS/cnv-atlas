# Ronda para Gildardo — 2026-08-23

**De:** Equipo Atlas · **Para:** Gildardo Uribe, Dirección Científica CNV

> **Esta no es una ronda paralela a la anterior.** Es **una sola cola**, en su versión de hoy: los puntos P-25 a P-31 vienen acumulados de días atrás y nunca se te enviaron en un documento; los puntos 1, 2 y 3 son nuevos, de esta semana. La ronda del **20 de agosto** era de otro tema (etnia y encuesta) y ya te la mandamos: de esa **solo queda una cosa sin responder**, y va al final de este documento para que no se pierda.

**Contexto.** Cerramos el plan alimentario del nutricionista (lista de intercambio por alimento, distribución por tiempos, validación de nutrientes) y, al conectar las restricciones que calcula el modelo, apareció algo que no podemos resolver nosotros: **tu prototipo tiene dos motores que prescriben la dieta y no coinciden**. Ese es el punto 1 y es el más importante de esta ronda; los otros dos son hallazgos concretos que te reportamos, y al final va la cola acumulada.

Los tres primeros salieron de portar, no de opinar. Ninguno es una preferencia nuestra.

**Fuente.** Todo lo que sigue está verificado contra la entrega que confirmaste como vigente el 17 de agosto (`ATLAS_v8.html` del 2026-08-19, la que nos llegó con tu respuesta), no contra la del 13. Lo comprobamos pieza por pieza: `motorTratNutri`, el bloque de recomendaciones, las dos tablas de intercambio y el ciclo de menús son idénticos entre las dos entregas, así que los hallazgos no vienen de mirar un archivo superado.

**Y antes de la pregunta 1, lo que ya nos dijiste**, para que no tengas que reconstruirlo: el 17 escribiste que *"el objetivo calórico ya no lo deriva el sistema (13-ago). Se retiraron los cinco déficits sugeridos por fenotipo. El déficit queda en 0 y la orientación del fenotipo se conserva como texto sin cifra, en el campo perfil. **Lo decide el nutricionista**"*, y también que *"el déficit sigue partiendo del **peso meta** acordado con el paciente"*. Y el 19 confirmaste que `motorTratNutri` está al día con la corrección del 9-ago. Eso ya inclina una de las nueve filas y es parte de lo que preguntamos abajo.

---

## 1. Dos motores prescriben la dieta y no coinciden. ¿Cuál manda?

**Cómo apareció.** El nutricionista arma el plan y necesita saber qué debe excluir. `motorProtocolo` calcula esas restricciones (proteína, fósforo y potasio por enfermedad renal; sodio por hipertensión; azúcares simples por diabetes), así que las conectamos: hoy se muestran sobre la cadena calórica y **se envían al generador de menús**, para que la IA no proponga un plan que contradiga el diagnóstico.

Al hacerlo notamos que `motorTratNutri` prescribe **otro** límite de sodio para el mismo paciente. Y al comparar los dos motores completos, el sodio resultó ser uno de nueve puntos.

### Lo que cada motor prescribe para el mismo paciente

| | `motorProtocolo` (el que Atlas usa hoy) | `motorTratNutri` |
|---|---|---|
| **Sodio (hipertensión)** | **< 2.300 mg/día** (DASH — JNC 2023) | **< 1.500 mg/día** (OMS; DASH/NHLBI; AHA/ACC 2025) |
| **Sodio (enfermedad renal)** | no fija límite | 2.000 mg/día (gana el más restrictivo) |
| **Proteína en cáncer** | 1,5 a 2,0 g/kg (ESPEN Oncología) | 1,25 g/kg |
| **Peso sobre el que se multiplica la proteína** | peso de cálculo (`PI + 0,25 × (peso − PI)` si IMC ≥ 25) | **peso meta** (por defecto Lorentz si el IMC está fuera de 18,5 a 25) |
| **Gasto basal** | Cunningham si hay masa libre de grasa; si no, Mifflin | **Mifflin siempre, sobre peso actual** |
| **Factor de actividad** | 1,375 por defecto | el sugerido por el motor de ejercicio |
| **Déficit calórico** | **0 siempre** (lo retiraste el 19 de agosto) | **500 kcal en obesidad**, con piso de 1.500 (H) / 1.200 (M) |
| **Objetivo en cáncer o desnutrición** | gasto total de mantenimiento | **27,5 kcal × peso actual** |
| **Grasa en dislipidemia** | 30 % (no baja nunca) | **25 %**, con saturada < 7 % |
| **Qué define la conducta** | el **fenotipo** (F1 a F12, mapa MCCB) | la **condición** (diagnóstico + composición: IMC, FMI, FFMI, ASMI) |

**Por qué esto importa hoy y no en abstracto.** Atlas usa el primero, así que **para un hipertenso estamos prescribiendo 2.300 mg de sodio y mandando ese número a la IA que genera el menú**. Si el que manda es el otro, el límite correcto es 1.500. Entre 2.300 y 1.500 no hay matiz clínico: hay una dieta distinta.

**Lo que NO vamos a hacer sin tu respuesta.** Tenemos `motorTratNutri` listo para portar (es la pieza que falta de las cuatro; médico, ejercicio y psicología ya están). **No lo portamos**, porque meter un segundo motor que contradice al que ya prescribe empeoraría la incoherencia en vez de cerrarla. Esperamos tu decisión.

### Dos señales dentro de tu propio archivo, que apuntan al segundo motor

No queremos que decidas contra un vacío, así que va lo que encontramos a favor de `motorTratNutri`:

- **Tus propias recomendaciones ya usan su sodio.** Los dos bloques de recomendaciones de la pantalla de nutrición imprimen `sodioMax` de `motorTratNutri` (1.500 en hipertensión, 2.000 en enfermedad renal). O sea: **en tu archivo, lo que se le recomienda al paciente ya sale del segundo motor**, mientras las restricciones que muestra el primero dicen 2.300.
- **Lo que nos dijiste el 17 va en la misma dirección:** el déficit por fenotipo (que es del primer motor) lo retiraste, y dijiste que el déficit parte del peso meta, que es el mecanismo del segundo.

### Un desajuste entre tu carta y tu archivo, que te reportamos

Aplicamos la regla que nos diste el 19 (*"cuando el texto y el motor se contradigan, manda el motor, y repórtenmelo"*):

> Escribiste que **"el déficit sigue partiendo del peso meta acordado"**. En el archivo vigente, `motorTratNutri` fija **`deficit = 500` en obesidad** (un valor constante), editable después por el profesional. **No lo deriva del peso meta.**

No lo tocamos ni lo interpretamos. Te lo reportamos porque si la intención es que se derive del peso meta, hoy el archivo no lo hace.

**Lo que necesitamos de ti, en una línea:** ¿cuál de los dos gobierna la prescripción nutricional? Y si la respuesta es "cada uno en lo suyo", cuál manda en cada fila de la tabla.

---

## 2. Un bloque de recomendaciones quedó huérfano al retirar el déficit

Esto no es una pregunta abierta: es un reporte con una decisión pequeña al final.

En la pantalla del nutricionista hay siete bloques de recomendaciones por diagnóstico. El de **"Manejo del exceso de grasa corporal"** se activa con esta condición:

```
isObesidad_pn = pr.estrategia && pr.estrategia.deficit > 0
```

El 19 de agosto retiraste el déficit del `motorProtocolo`: `deficit` quedó en **0 para todos los perfiles**, y la orientación del fenotipo se conserva como texto sin cifra. Con eso, `deficit > 0` **nunca se cumple** y ese bloque **no puede aparecer nunca**.

Y su contenido cita justo lo retirado:

> "Objetivo N kcal/día (**déficit N kcal**; **piso 1.200 M / 1.500 H**)"

**Lo que necesitamos de ti:** ¿el bloque se retira (la conducta de exceso de grasa ya no se recomienda aparte), o se conserva con **otra condición** de activación? Si es lo segundo, dinos cuál: la más natural sería el propio fenotipo (F1 a F5) o la obesidad por composición (IMC ≥ 30 o FMI > 6 H / 9 M), pero es tu decisión, no la nuestra. Y su texto habría que reescribirlo sin el déficit ni el piso.

---

## 3. Un umbral viejo sobrevivió en una pieza sin portar: FFMI 17,92 / 15,64

Cuando unificaste la frontera de desnutrición (FFMI de 17,92 a **17** en hombres y de 15,64 a **15** en mujeres), barrimos el motor y lo aplicamos. Pero esa pieza de recomendaciones todavía no la habíamos portado, y ahí el umbral viejo sigue vivo:

```
isSarco_pn = FFMI > 0 && FFMI < (sexoM ? 17.92 : 15.64)
```

Es la condición que activa el bloque de **"Preservación y ganancia de masa muscular"**. Con el umbral viejo, un hombre con FFMI 17,5 recibe esas recomendaciones; con el vigente, no.

Lo traemos con el marco que nos diste en el caso del SMM/W (24 a 22): **cuando cambias un umbral, buscamos todos los sitios donde vive ese número.** Este estaba en una pieza que aún no habíamos portado, así que el barrido anterior no lo alcanzó.

**Y al buscar todos los sitios apareció algo más: hay DOS copias de ese bloque de recomendaciones en tu archivo, y no usan el mismo umbral.**

| | Copia en la tarjeta "RECOMENDACIONES" | Copia en la subpestaña del nutricionista |
|---|---|---|
| Sarcopenia | `ffmi < 17` | `ffmi < (hombre ? 17,92 : 15,64)` |
| Distingue sexo | **no** | sí |
| Proteína que imprime | `protKg` de `motorTratNutri` | la de la fórmula sintética |

Dos consecuencias, y las dos afectan a pacientes reales:

- **Un mismo paciente puede recibir el bloque en una pantalla y no en la otra.** Un hombre con FFMI 17,5 lo recibe en la segunda copia y no en la primera.
- **La primera copia aplica el umbral masculino a las mujeres.** Sin la distinción por sexo, una mujer con FFMI 16 queda marcada como sarcopénica, cuando su frontera vigente es 15. Le recomienda preservación de masa muscular a una mujer que no la necesita por ese criterio.

**Lo que necesitamos de ti (ahora sí es decisión, no solo confirmación):** ¿las dos copias deben quedar con **17 / 15** y distinguiendo sexo? Es lo que entendemos, y es lo que portaríamos. Si alguna debía comportarse distinto, dinos cuál y por qué.

**Lo que necesitamos de ti (confirmación, no decisión abierta):** entendemos que se porta con **17 / 15**, la frontera vigente. Confírmanoslo y lo portamos así. Si por alguna razón esa condición debía quedarse en el umbral anterior, dinos por qué y la dejamos como está.

---

## Cola acumulada (pendientes de rondas anteriores)

Van completas para que decidas de una. **Nota de numeración:** teníamos dos preguntas con el número P-29; la de "cuál gasto energético manda" pasa a ser **P-31**. La de granularidad conserva el P-29.

### P-25 · Distribución por tiempos de comida

El dato existe en tu archivo (mapa por número de comidas de 3 a 6, con porcentaje por tiempo; con 5 comidas: desayuno 0,30 · medias onces 0,10 · almuerzo 0,30 · algo 0,10 · cena 0,20). Reparte el objetivo calórico en el día.

**Preguntas:** (a) ¿es la versión final para portar? (b) ¿los porcentajes son fijos del modelo, o un valor por defecto que el profesional ajusta?

### P-26 · Lista de intercambio (U de A · ICBF 2025)

El dato está completo en la entrega (12 grupos; `INTER_TABLA_A` con los nutrientes por porción; `INTER_TABLA_B` con 350 alimentos, gramaje y medida casera). **No hace falta que nos mandes nada.**

**Pregunta:** ¿es el dataset final para portar tal cual, o hay una versión más nueva?

### P-27 · Metas de la tabla de validación (matiz menor, no bloquea)

Ya verificamos que las necesidades de los nutrientes se calculan en tu archivo de forma determinista (macros del protocolo, fibra por fórmula, micronutrientes por RDA/DRI según sexo y edad). Es porte, no falta dato.

**Único matiz a confirmar:** los micronutrientes son fijos por sexo y edad y **no se ajustan por condición clínica** (un paciente renal sigue viendo potasio 3.400 mg como necesidad, mientras las restricciones de enfermedad renal alimentan el menú). Suponemos que es deliberado, porque así es una RDA. ¿Correcto?

### P-28 · El bloque "Nivel III — Salud celular" en Tratamiento

Atlas lo muestra en Tratamiento (hidratación celular, ángulo de fase, masa celular activa). Está portado del vigente, pero **no aparece en la subpestaña de Tratamiento de tu v8**: es contenido celular, más cercano a Diagnóstico.

**Pregunta:** ¿se queda en Tratamiento, se mueve a Diagnóstico, o se retira? Mientras respondes lo dejamos donde está.

### P-29 · Granularidad de la lista de intercambio: ¿por alimento (21) o por grupo (12)?

Tu tabla permite poner porciones en cualquiera de los 21 alimentos y repartir dentro de un grupo (por ejemplo 2 de leche entera y 1 de descremada). Lo portamos así, fiel.

**Pregunta:** ¿es deliberado que el profesional pueda repartir dentro del grupo, o bastaría con que elija un alimento representativo por grupo? Lo preguntamos porque la versión por alimento hace la tabla más larga, y queríamos confirmar que la granularidad es intencional antes de simplificarla.

### P-30 · Un reparto por tiempos que no cuadra: ¿se puede guardar, o debe impedirse?

En la distribución por tiempos, si un alimento tiene 2 porciones en la lista de intercambio y el profesional las reparte a cero en todos los tiempos, tu archivo lo marca en rojo pero **permite guardar**. Lo portamos igual.

**Pregunta:** ¿es deliberado que se pueda guardar un reparto que no cuadra, o debería impedirse? Lo preguntamos porque en Atlas el plan **queda guardado**, mientras que en tu prototipo se recalcula al recargar: allí un descuadre es transitorio, aquí es permanente. Mientras respondes, Atlas queda fiel a tu archivo: avisa en vivo y permite guardar.

### P-31 · ¿Cuál gasto energético manda: el medido por el equipo o el calculado? (antes P-29)

Atlas ofrece un atajo "gasto medido por el Biody: N kcal — usar", al lado de la cadena que calcula otro gasto total (basal por Cunningham/Mifflin × factor de actividad). Difieren por método, no por paciente. Tu v8 usa **solo el calculado**; no muestra el medido. Atlas alinea la base al calculado y deja el medido como referencia informativa.

**Pregunta (confirmación):** ¿correcto que la base sea el calculado y el medido quede como referencia, o prefieres que el medido entre en algún caso?

---

## Resumen de lo que necesitamos

| # | Qué | Tipo |
|---|---|---|
| 1 | **Cuál de los dos motores gobierna la prescripción nutricional** (nueve puntos de discrepancia, sodio incluido) | **Decisión, bloquea** |
| 2 | Qué hacer con el bloque de recomendaciones que quedó huérfano | Decisión, pequeña |
| 3 | FFMI 17 / 15 y distinción por sexo en las **dos copias** del bloque de sarcopenia | Decisión, pequeña |
| P-25 | Porcentajes por tiempo de comida: ¿finales? ¿fijos o ajustables? | Confirmación + decisión |
| P-26 | Lista de intercambio: ¿dataset final? | Confirmación |
| P-27 | Micronutrientes fijos por sexo y edad, sin ajuste por condición | Confirmación |
| P-28 | Dónde vive el bloque de salud celular | Decisión |
| P-29 | Granularidad de la lista: por alimento o por grupo | Confirmación |
| P-30 | Guardar o impedir un reparto que no cuadra | Decisión de comportamiento |
| P-31 | Gasto medido vs calculado | Confirmación |

**Lo único que bloquea construcción es el punto 1.** Los demás los seguimos portando fieles a tu archivo mientras respondes.

---

## Lo único que quedó sin responder de la ronda del 20 (otro tema, para que no se pierda)

**La residencia prolongada.** La pediste el 17 ("región de origen o residencia prolongada"), con un argumento que compartimos: la adaptación a la altura viene de vivir años en altura, no de dónde se está hoy. La **retiramos** siguiendo tu regla del 20 (la encuesta no se adelanta al archivo), pero tu carta no la mencionó, así que no sabemos si la retiras de verdad o la vas a parametrizar.

- ¿La retiras definitivamente, o la parametrizas en el archivo para volver a capturarla?
- Con ella fuera, **la altitud fisiológica se queda sin fuente**: la altitud de la ciudad actual mide otra cosa. Si el observatorio va a segmentar por altitud de adaptación, hoy no tiene de dónde derivarla.

La columna que la guardaba se conserva, sin uso, esperando tu decisión.
