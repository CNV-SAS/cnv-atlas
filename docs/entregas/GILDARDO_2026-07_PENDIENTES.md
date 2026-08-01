# Pendientes para Gildardo — extracto

**Fecha:** 2026-07-27 · **De:** equipo Atlas · **Para:** dirección científica CNV

Gildardo: esto es un **extracto** de lo que quedó abierto de nuestro lado y depende de una decisión tuya. No es la bitácora completa. **Todo lo que respondiste en las rondas anteriores ya está cerrado y no requiere acción tuya**; no hace falta que lo releas.

---

## Cómo leer esto (1 minuto)

Son **once puntos**, ordenados de lo que respondes en un minuto a lo que te exige escribir ciencia nueva:

| | Qué son | Cuántos | Qué te toma |
|---|---|---|---|
| **Puntos 1 a 4** | Preguntas de sí/no o de elegir entre dos opciones | 4 | minutos |
| **Puntos 5 a 8** | Decisiones sobre cuál de tus artefactos manda | 4 | te exigen sentarte |
| **Puntos 9 a 11** | Ciencia nueva que solo puedes escribir tú | 3 | trabajo real |

**Cada punto dice explícitamente qué necesitamos de vuelta.** Si algo se responde con un sí, dilo y ya. Si necesita una fórmula o un archivo, está marcado.

**Dos puntos impiden atender al primer paciente real:** el **5** (firma del modelo vigente) y el **8** (cuál modelo calórico es el vigente). Están marcados **[BLOQUEA]**.

**Los demás no bloquean pacientes, pero sí queremos cerrarlos todos** antes de abrir Atlas a la revisión de los profesionales. Que no bloqueen no significa que se puedan posponer indefinidamente: significa que si uno se demora, el resto sigue avanzando.

**Cómo responder:** puedes contestar sobre este mismo documento, punto por punto. Si le pasas esto a tu equipo técnico, hay un **anexo técnico al final** con las referencias de archivo y línea; el cuerpo no las necesita.

**Referencia cruzada:** cada punto trae entre paréntesis su número en nuestra bitácora interna (Q3, Q8, etc.), por si tu equipo lo necesita para rastrear.

---

# Puntos 1 a 4 · Respuesta corta

## 1. La casilla "total" del plan por grupos no cuadra con el objetivo calórico *(ref. Q12)*

En el plan por grupos de alimentos, las nueve columnas de porciones suman bien, pero la casilla de kcal de la fila TOTAL muestra el objetivo calórico exacto (2976), mientras que las filas de alimentos suman 3134 kcal. O sea: nueve celdas son sumas reales y la décima es una meta. La matriz de porciones se pasa del objetivo por 158 kcal (5,3 %).

**Qué necesitamos de vuelta:** dos respuestas cortas.
1. ¿Es una limitación aceptada de trabajar con porciones enteras, o la matriz debería reconciliar con el objetivo?
2. ¿Qué debe mostrar esa celda: la suma real de las filas, el objetivo, o las dos cosas?

---

## 2. ¿Cuál cálculo del patrón alimentario es el correcto? *(ref. Q15)*

El patrón alimentario (clasificar la dieta en protectora / moderada / de riesgo) se calcula distinto entre dos de tus artefactos, y dan puntajes distintos: uno suma el bonus de "neutros" incluyendo las carnes rojas como grupo extra, el otro no. **No es diferencia de textos: cambia el puntaje del paciente.** Y la encuesta ya está congelada de nuestro lado.

**Qué necesitamos de vuelta:** cuál de los dos es el correcto. Si es el que incluye carnes rojas, dinos también si la encuesta debe capturar ese grupo (hoy no lo hace).

---

## 3. Alimentación e hidratación del estilo de vida: ¿fórmula, o quedan por defecto? *(ref. Q3)*

Hoy dos de los ocho dominios del puntaje de estilo de vida (Alimentación e Hidratación) corren con valores por defecto, porque la encuesta captura frecuencias de consumo y vasos de agua, no "porciones" en el formato que espera la fórmula. Para el arranque los dejamos por defecto, que es lo mismo que hace tu prototipo.

Importa porque ese puntaje alimenta la edad biológica: hoy la EB-BIS se calcula con seis de ocho dominios reales y dos por defecto.

**Qué necesitamos de vuelta:** una de dos.
- **(a)** "Déjenlo por defecto" — y lo cerramos aquí.
- **(b)** La fórmula que convierte frecuencias de consumo y vasos de agua en el puntaje de esos dos dominios. Puede ser en texto; no hace falta código.

---

## 4. Nutracéuticos por ruta: ¿estructura viva o quedó sin usar? *(ref. bitácora, sin Q)*

En tu prototipo existe una estructura preparada para mostrar los nutracéuticos en orden de prioridad (primero, segundo, tercero) **por ruta de atención**, pero ninguna ruta define esos datos: está vacía.

Nota importante: la priorización **por estado funcional (EFR)** sí existe y ya la estamos usando — el orden de los productos que devuelve tu modelo es la priorización clínica, y la respetamos tal cual. Esta pregunta es solo sobre la otra estructura, la de por ruta.

**Qué necesitamos de vuelta:** un sí/no primero.
- ¿Esa estructura **debía** tener datos, o quedó preparada y no se usó?
- **Solo si debía tenerlos:** necesitamos la tabla de qué producto va en cada posición para cada ruta. Si no, la retiramos del código y no hay más que hacer.

---

# Puntos 5 a 8 · Decisiones

## 5. [BLOQUEA] Firma de que el modelo de índices vigente es el definitivo *(ref. Q8)*

Verificamos que los coeficientes de la edad biológica (EB-BIS) que tenemos congelados son idénticos, dígito a dígito, a los del `ATLAS.html` que entregaste: es la versión 5, no una anterior. Nuestra verificación técnica ya está hecha.

Lo que falta es tu confirmación formal. Sin ella no podemos afirmar que lo que Atlas calcula es tu ciencia actual, y eso es lo que le vamos a mostrar a un paciente real.

**Qué necesitamos de vuelta:** que respondas con esta frase, o la corrijas si algo no es exacto:

> *"Confirmo que el modelo de índices congelado en Atlas — con los coeficientes de EB-BIS versión 5 (constante 41,438; IFC +1,082; PABU +2,837; ICEC/LE8 −7,982) y las definiciones de IFC, IRC, PABU, IEHH, ISCM-BIS e IAE — corresponde a mi modelo vigente a la fecha. Gildardo de Jesús Uribe Gil, [fecha]."*

Si algún coeficiente no es el que quieres, dinos cuál y lo cambiamos con el procedimiento de siempre.

---

## 6. ¿Cuál de tus artefactos manda, pieza por pieza? *(ref. Q16)*

Los siete módulos que entregaste dicen "extraído de ATLAS_v7", pero el `ATLAS.html` que también entregaste es **otro archivo**. Y no es que uno sea más nuevo que el otro: es más nuevo en unas cosas y más viejo en otras.

- El modelo calórico: el `ATLAS.html` es más nuevo.
- La lista de intercambio de alimentos y el resumen clínico: están en los módulos y **no** en el `ATLAS.html`.
- Los índices: idénticos en los dos.
- El patrón alimentario: distintos (es el punto 2).

O sea, no existe "el artefacto más nuevo" para todo. Para portar cada pieza sin equivocarnos necesitamos que nos digas cuál manda **para esa pieza**.

**Qué necesitamos de vuelta:** esta tabla llena. Basta con marcar una columna por fila.

| Pieza | ¿Manda `ATLAS.html`? | ¿Manda el módulo? | ¿Otro artefacto? (dinos cuál) |
|---|---|---|---|
| Índices (IFC, IRC, PABU, IEHH, ISCM, EB-BIS, IAE) | | | |
| Patrón alimentario | | | |
| DFI y rutas de atención | | | |
| Resumen clínico por profesión | | | |
| Modelo calórico *(ver punto 8)* | | | |
| Lista de intercambio de alimentos | | | |
| Ciclo de menús | | | |
| Motores de tratamiento (médico, ejercicio, psicológico) | | | |

Si en alguna fila hay un archivo más nuevo que no nos has entregado, dínoslo: es preferible saberlo ahora.

---

## 7. ¿Cuál regla decide la ruta R2? *(ref. Q11)*

Dentro del modelo hay dos reglas distintas que activan la ruta **R2 (reducción de riesgo cardiometabólico)**, y no son dos copias de la misma: son dos criterios diferentes.

- Una la decide por la **severidad del dominio metabólico** del árbol de diagnóstico. Es la que el sistema usa de verdad hoy.
- La otra la decide por **umbrales de composición y metabolismo combinados** (FMI, ISCM, índice cintura-cadera, índice cintura-talla, radio de impedancia).

Para un caso real dan respuestas distintas. El **caso de referencia BIS-01** (hombre, 54 años, IMC 27,5; IR 0,798; ICT 0,544; FMI 6,37) queda **dentro** de la ruta por un criterio y **fuera** por el otro.

**Qué necesitamos de vuelta:** dos cosas.
1. ¿Cuál de las dos reglas representa tu modelo actual?
2. En julio confirmaste que la vía de "rutas por condición" no es la autoritativa, refiriéndote a la ruta R5. ¿Eso vale para **todas** las rutas (R1 a R6) o solo para R5?

---

## 8. [BLOQUEA] ¿Cuál de los dos modelos calóricos es el vigente? *(ref. Q14)*

Hay dos formas distintas, **ambas tuyas**, de calcular las calorías y la proteína que se le prescriben a un paciente. Para el mismo paciente dan resultados distintos.

| | Dentro de `ATLAS.html` | En el módulo de motores de tratamiento |
|---|---|---|
| Gasto basal | Cunningham, a partir de la masa magra | Mifflin, sobre el peso medido |
| Proteína | sobre el peso de cálculo (ajustado) | sobre el peso ideal |
| Estrategia calórica | por fenotipo | por condición clínica |

El primero es el que dibuja la pantalla del protocolo que ven los profesionales. El segundo trae en su encabezado la frase *"Reemplazan el modelo calórico por Mifflin"* — y "reemplazan" suena a una decisión que tomaste, no a una extracción, así que podría ser tu pensamiento más reciente aunque venga de una versión anterior del prototipo.

Aquí se le prescriben calorías y proteína a una persona. La procedencia no puede quedar en disputa entre dos artefactos tuyos.

**Qué necesitamos de vuelta:** cuál de los dos representa tu modelo vigente. Si es el del módulo, dinos también si la estrategia por fenotipo debe desaparecer o convivir con la de condición clínica.

Estamos construyendo con el de `ATLAS.html` porque es el que reproduce la pantalla con la que se entrenan los profesionales. Si respondes que es el otro, revertir nos cuesta poco: un archivo y su prueba.

---

# Puntos 9 a 11 · Ciencia nueva

Estos tres no son preguntas: son cosas que solo puedes escribir tú. No bloquean nada, pero cada uno deja una funcionalidad incompleta.

## 9. Función de rangos de referencia por indicador y sexo *(ref. bitácora, pedido 4)*

Para mostrarle al profesional, junto a cada indicador, su rango normal y qué tan lejos está el paciente de él, necesitamos los valores de referencia (mínimo y máximo) por indicador y por sexo. En tu prototipo esos umbrales están escritos dentro de cada clasificador, no como datos que se puedan consultar, así que no los podemos extraer sin reinterpretar tu ciencia — y eso no lo hacemos.

**Qué necesitamos de vuelta:** una función en JavaScript, con la misma forma de tus otros módulos, que reciba el indicador y el sexo y devuelva el mínimo y el máximo. Si prefieres, una tabla también sirve y nosotros la convertimos.

**Sin esto:** la tabla de indicadores va sin columna de referencia ni distancia al rango.

## 10. Fórmula del indicador AEC/MCA (dAECMCA) *(ref. bitácora, pedido extra)*

Este indicador vive solo dentro del dibujo de la pantalla de tu prototipo, no como una función con su fórmula aislada, así que no hay nada que podamos extraer.

**Qué necesitamos de vuelta:** la fórmula, y sus puntos de corte si los tiene. En texto está bien.

**Sin esto:** el indicador no aparece en Atlas.

## 11. Contenido clínico del manual de tratamiento *(no abierto formalmente, lo anotamos por visibilidad)*

En el *Manual de Tratamiento del DFI* quedaron tres secciones marcadas como "a desarrollar por la dirección científica": la definición de los estados funcionales del DFI, la conducta terapéutica por estado, y la matriz de composición y prioridad cuando coexisten varios estados alterados.

No lo pedimos ahora — sabemos que es trabajo de fondo. Lo anotamos para que quede claro que está en el radar y que ninguna de esas tres se puede inferir de guías genéricas sin tu validación.

---

# Acciones que ya tomamos (no requieren respuesta, solo avísanos si alguna no es lo que querías)

- **Alcohol *(ref. Q6)*:** definiste que el consumo de alcohol es registro clínico y no debe pesar en el puntaje de estilo de vida. Ya está aplicado: el alcohol dejó de entrar al cálculo y la pregunta sigue en la encuesta como registro. Efecto cero sobre diagnósticos previos.
- **Fuerza prensil:** confirmaste que se captura y no entra a ningún cálculo. Aplicado.
- **Porcentajes por tiempo de comida:** habíamos visto una pantalla donde los tiempos activos sumaban 95 % en vez de 100 %. Al revisar tu código encontramos que **sí** normaliza correctamente; la pantalla era un estado viejo del prototipo. No hay nada que corregir.

---

# Anexo técnico (para el equipo técnico de Gildardo)

Referencias de archivo y línea sobre nuestro repositorio. Sin datos de pacientes.

- **Punto 1 (total del plan):** matriz de porciones del apartado E del Nivel IV. Fuera del bloque actual (T2); se construye en el bloque Plan alimentario.
- **Punto 2 (patrón):** `calcPatron` con neutro `[8,9,10,15]` (módulo `atlas-encuesta-patron.js:72`) frente a `[8,9,10]` (`ATLAS.html:2324`). `FREQ_GROUPS`: 15 grupos frente a 14. Cambia el score, no solo las etiquetas. Encuesta congelada de nuestro lado.
- **Punto 3 (LE8):** `calcLE8` lee `d1_9`, `d1_10` y `d1_16`; la encuesta captura `d1_*_i` (frecuencias) y `d7_agua`. No inventamos el mapeo. Dominios Alimentación e Hidratación con default 30 y 20.
- **Punto 4 (nutracéuticos por ruta):** estructura P1/P2/P3 preparada en el código de rutas, sin datos en ninguna ruta. La vía viva es la de estado EFR, vía `getDX`, cuyo orden de salida respetamos como priorización clínica.
- **Punto 5 (firma v5):** `engine.indices.js`, `computeEBBIS` L34-41, byte-idéntico en coeficientes a `ATLAS.html` L5706-5729. Constante 41.438; IFC +1.082 (μ 4.0146, σ 2.2669); PABU +2.837 (μ 1.8303, σ 0.7741); ICEC/LE8 −7.982 (μ 58.578, σ 13.332). ISCM, IEHH e IAE también idénticos. Verificación cerrada; falta la firma.
- **Punto 6 (versión por pieza):** auditoría de fidelidad de los seis módulos frente a `ATLAS.html`. Índices: coinciden verbatim (`atlas-core-indices.js:8-179` = `ATLAS.html:3222-3409`). Patrón: diverge en score (punto 2). DFI: el motor coincide verbatim (`:249-324` = `ATLAS.html:11313-11388`), pero el módulo agrega `_parrafo` y `_metas` a 24 semanas por profesión, atados a un spec externo no verificable. Resumen clínico: sus funciones no existen por nombre en `ATLAS.html` ni sus frases aparecen. Lista de intercambio: 12 grupos, ~350 alimentos, 27 nutrientes en el módulo, frente a `LISTA_INT` de 11 filas × 7 campos inline en `ATLAS.html:14856-14868`. Menú: mismos 21 días y alimentos, cantidades convertidas de g/cc a medidas caseras.
- **Punto 7 (R2):** regla autoritativa en `computeDFI` (`engine.dfi.js:153`, `if(dom2.sev>=2)`) frente al predicado `RUTA_COND.R2` (`engine.indices.js:56`, OR de umbrales FMI/ISCM/ICC/ICT/IR). Hoy solo la primera alimenta el `EngineOutput`; `rutasPorCondicion` no llega a ninguna pantalla. Caso BIS-01 = donante del fixture golden.
- **Punto 8 (calórico):** inline `ATLAS.html:14124` → `gebAuto = ffm>0 ? round(500+22*ffm) : Mifflin(...)`; estrategia por fenotipo en `ATLAS.html:13555-13562`; `pesoCalculo` en `:13552-13554` (peso ideal Broca + 0,25 × exceso, salvo IRC o cáncer). Módulo: `atlas-motores-tratamiento.js`, `motorTratNutri` L9-98, Mifflin sobre peso medido L20, proteína sobre `pesoMeta` L18/L87, estrategia por condición L41-85, encabezado "Reemplazan..." L3. Portamos el inline porque reproduce la pantalla al dígito (verificado: GEB 1946 → GET 2676 → objetivo 2976 → proteína 110 g → grasa 99 g → CHO 411 g / 55 %). Revertir = un archivo congelado más su prueba de paridad.
- **Puntos 9 y 10 (autoría):** la función de rangos y `dAECMCA` no llegaron en la entrega. Los clasificadores traen los umbrales como literales embebidos dentro de cada función, no como datos expuestos; `dAECMCA` es render-only inline (`ATLAS.html` ~L12297). Exponerlos no basta: exige autoría.

---

> **Nota de corrección (2026-08-01), añadida al pie. El cuerpo de arriba NO se edita: este documento es el registro de lo que le enviamos a Gildardo, y corregirlo por dentro lo inutiliza para saber qué leyó.**
>
> El párrafo del punto sobre la identidad del archivo dice: «Estamos construyendo con el de `ATLAS.html` porque es el que reproduce la pantalla **con la que se entrenan los profesionales**». Ese hecho es **falso** y se corrigió después (dato de Santiago, 2026-07-31): los profesionales se forman en **Atlas Web, no en el HTML** (el HTML se usó como referencia porque no había versión web; hoy la hay). La decisión de construir con `ATLAS.html` sigue bien, pero por otra razón: el HTML es la **expresión de la ciencia de Gildardo**, y la fidelidad protege eso, no la familiaridad de nadie. Ver el barrido en `GILDARDO_QUERIES.md` Q21 y `RESULTADOS_GAP.md`.
