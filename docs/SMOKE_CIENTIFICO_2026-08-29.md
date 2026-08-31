# Smoke de lo científico · 2026-08-29

**Para:** Santiago
**Antes de:** el cotejo visual, que se hace una sola vez contra lo definitivo.

**Qué prueba esto y qué no.** Prueba que lo científico que cerramos **se ve y se comporta** como debe. No
prueba la forma (eso es el cotejo). Si algo de aquí sale mal, el cotejo se hace con una versión que hay que
volver a tocar, y sería cotejar dos veces.

---

## Antes de empezar: qué necesitas sembrar

**Casi nada.** Los pacientes demo alcanzan para todo menos dos casos.

```
pnpm db:seed        # base: encuesta, catálogo, prompt de IA, paciente demo
pnpm db:seed:bis    # condiciones de la toma BIS (idempotente, no borra respuestas)
pnpm seed:golden    # Demo GoldenPath, las dos mujeres, y los tres de trayectoria
```

**Los tres de trayectoria traen DOS evaluaciones cada uno**, que es lo que necesita la reemisión. No hay
que crear nada para eso.

**Lo único que tienes que provocar tú son las respuestas de encuesta.** Ningún demo tiene las que disparan
las alertas, y no las sembramos a propósito: sembrarlas haría que el smoke pase sin que nadie las escriba,
que es no probar nada.

> **Ojo con el seed principal: `pnpm db:seed` BORRA las respuestas de encuesta de la versión vigente.**
> Córrelo ANTES de llenar nada, no después.

---

## El orden, y por qué es este

**Una prueba gasta el caso de la siguiente si se hace al revés.** El orden de abajo evita tres choques:

1. **La encuesta va primero** porque las alertas, el menú y el diagnóstico leen lo que respondas ahí.
2. **El paso del ISCM sin MCA se retiró** (ver 3a): no es alcanzable por el Excel, y lo cubre un test.
3. **La reemisión va al final**, sobre los pacientes de trayectoria, y no sobre el que usaste para todo lo
   demás: necesita una evaluación **vieja**, y la que acabas de crear es nueva por definición.

| | Pantalla | Necesita navegador de verdad |
| --- | --- | --- |
| 1 | Encuesta (paciente) | **SÍ** |
| 2 | Evaluación (alertas) | No |
| 3 | Diagnóstico | No |
| 4 | Tratamiento | **SÍ** (dos formularios) |
| 5 | Reporte / HC | No |

---

# 1 · Encuesta · **navegador de verdad**

Abre el enlace del paciente y **respóndela entera**, con estos valores en las preguntas que importan.

> Los números son los que **ves en pantalla**, no los códigos internos.

## 1a · Los tres encabezados de grupo · **ya NO van en la encuesta del paciente**

**Corregido el 2026-08-31 tras el primer smoke.** Estaban aquí, portados de su archivo, y se **retiraron**
por sesgo de deseabilidad: rotular un bloque como *Procesados y ultraprocesados (PCBU)* antes de que el
paciente conteste empuja la respuesta hacia lo que se espera de él, y esto es un cuestionario de
frecuencia. Está preguntado en la ronda del 31.

**Qué mirar en la encuesta del paciente:** que **NO** aparezca ningún encabezado de categoría, y que el
**orden** siga siendo el del modelo: **carnes rojas justo después de carnes blancas** (posición 11), no al
final. El orden es lo que él pidió; el rótulo es lo que quitamos.

**Dónde se ven ahora, y hay que mirarlo:** en la evaluación, *Ver o editar encuesta*. Ahí sí salen los
tres, como **banda de color** (verde protector, azul neutro, rojo riesgo), que es la forma de su archivo.

**Sería defecto:** que aparezcan en la del paciente; que NO aparezcan en la del profesional; que sean
cuatro o se repitan; o que las carnes rojas caigan en el último bloque.

## 1b · Las respuestas que disparan las alertas

| Pregunta | Qué responder | Para qué |
| --- | --- | --- |
| **14** · Azúcares añadidos y bebidas azucaradas | **Todos los días** | Glucémico + estrés |
| **21** · Métodos para cambiar su peso | marca **Laxantes** | TCA activo |
| **29** · Nivel de estrés | **8** o más | Estrés + azúcares |
| **39** · Diagnósticos personales | marca **Diabetes tipo 2** | Glucémico |
| **57** · Agua (vasos por día) | **2** | Deshidratación |
| **60** · Color de la orina | **Oscuro (naranja / marrón)** | Deshidratación |
| **34** · Patrón alimentario | **Vegetariano** | Enciende la IA del menú |

**Y aquí está el hazard que más nos ha costado:** el formulario es de varios pasos y su familia de defectos
(auto-envío al entrar al último paso, auto-reset que borra lo escrito) **solo se ve en un navegador real**.

**Sería defecto:** que al pasar al último paso el formulario **se envíe solo**; que al equivocarte en algo
se borre lo que llevabas; o que un campo que ya validaste llegue vacío al servidor.

---

# 2 · Evaluación · las cinco alertas

Abre la evaluación del paciente. Las alertas van **arriba de todo**, antes de la entrada.

**Qué tiene que verse, con lo que respondiste:**

| Alerta | Nivel |
| --- | --- |
| TCA activo detectado | Crítica (roja) |
| Riesgo glucémico crítico | Crítica |
| Estrés alto + azúcares elevados | Moderada |
| Deshidratación probable, y que diga **"Agua: 2 vasos"** | Alta |

**Lo más importante de esta pantalla es el pie**, que dice que **el cuadro nutricional todavía no se
evalúa** y que diez alertas esperan el consumo de nutrientes.

**Sería defecto:**
- Que diga **"Agua: 0 vasos"**. Ese era el defecto: se disparaba sin que nadie respondiera.
- Que **no aparezca el pie**. Sin él, "ninguna alerta" se lee como "el paciente está bien".
- Que aparezca alguna de las diez de consumo (sodio, fibra, hierro, calcio, déficit calórico).

**Y una comprobación en negativo, que vale la pena:** vuelve a la encuesta, **quita el agua** (deja la 57
vacía) y mira que **la deshidratación desaparezca**. Sin el dato, la regla no se evalúa.

---

# 3 · Diagnóstico

## 3a · El ISCM sin MCA · **retirado del recorrido (no se puede provocar así)**

**Era errata mía, verificada el 2026-08-31.** El paso decía "borra la columna de la desviación teórica de
la masa celular activa y súbelo". **No sirve, y no por el nombre de la columna:** Atlas la **reconstruye**.
`deriveMissingComposition` calcula `MCA_dif = MCA − MCA_ref`, y si además borras la MCA, la deriva del agua
intracelular (`MCA = 1,0162 × AIC + MPM`). La cadena de derivación de su archivo es tan completa que **un
export normal del Biody siempre produce ISCM**.

O sea que el caso no es alcanzable por el Excel, y eso es una buena noticia, no un hueco: la guarda existe
para el dato que de verdad falta (entrada manual, equipo viejo), no para el export completo.

**Dónde queda probado:** `src/tests/iscm-sin-mca.test.ts`, con su control negativo (con ISCM presente todo
sigue igual) y con el caso que los distingue: un ISCM de **cero medido** sí se clasifica.

**Lo que sigue sin ser defecto:** que el dominio puntúe severidad 1 sin dato. Es su `?? 1` y está preguntado
en la ronda.

## 3b · Los cortes del IRC

**Qué mirar:** en la tabla de indicadores, la fila del IRC. La referencia tiene que decir **1,7** (hombre) o
**2,3** (mujer).

**Y el que importa:** en el DFI, el ítem del IRC tiene que decir el **mismo corte** que la tabla.

**Sería defecto:** que uno diga 1,7 y el otro 1,68. Estaban contradiciéndose sobre el mismo paciente.

## 3c · El ángulo de fase normal

**Qué mirar:** si el paciente tiene un AF **normal**, su etiqueta dice "Normal" y su color es **verde**.

**Sería defecto:** que diga "Normal" en **ámbar**. Era el color de alerta sobre un valor normal.

---

# 4 · Tratamiento · **navegador de verdad**

## 4a · La cadena calórica en dos bloques

**Qué mirar:** dos bloques separados, en este orden.

1. **Objetivo del plan**: peso meta y objetivo calórico, y una línea que dice si el objetivo es **"fijado
   por ti"** o **"sugerido por el modelo"**.
2. **Cómo se llega a ese objetivo**: GEB, PAL, proteína, grasa, la vista previa y el reparto de macros.

**Y la comprobación que de verdad importa:** en el segundo bloque, el objetivo calórico aparece **en lectura,
con la marca "lo fijas arriba"**. No debe haber un segundo campo editable de objetivo.

**Prueba el formulario:** cambia el peso meta **y** el PAL, guarda **una sola vez**, y verifica que **se
guardaron los dos**. Es un solo formulario partido en dos bloques; si se hubiera partido el guardado, uno de
los dos se perdería.

**Sería defecto:** dos botones de guardar; que guardar en un bloque borre lo del otro; o que el objetivo sea
editable en los dos sitios.

## 4b · Los dos resúmenes

**Qué mirar, y son dos sitios distintos:**

- En **Rutas de atención**, arriba de las rutas activadas: **"Resumen del diagnóstico"**, que es el párrafo
  del DFI.
- En la subpestaña de **tu profesión**: **"Resumen clínico"**, que es el párrafo de tu disciplina.

**Sería defecto:** que el párrafo del DFI aparezca en los dos (era el defecto: estaban fundidos); o que el
de la profesión salga vacío sin explicar por qué.

**Si puedes, entra con otra profesión** (médico o entrenador): su párrafo estaba sin portar y ahora existe.
Antes decía *"su resumen todavía no se ha portado"*.

## 4c · El menú adaptado

**Qué provocar:** ya tienes el patrón *Vegetariano* de la encuesta. Añade además una restricción tuya en la
sección **Restricciones alimentarias**: escribe **"Sin gluten"** y guarda.

**Qué mirar en la grilla del menú semanal:** arriba, **antes de la tabla**, tiene que estar la explicación
de que la base es un ciclo de 21 días y de que eso es **criterio clínico**.

**Sería defecto:** que esa explicación esté al pie, en letra chica. Al pie se lee como una limitación
técnica.

**Ahora pulsa "Adaptar a las restricciones".** Lo que tiene que verse:

- Una lista de **sustituciones**, no un menú nuevo. Cada una con **día, tiempo, el reemplazo y su motivo**.
- Un botón **"Aplicar a la grilla"** en **cada una**.
- Y debajo, el atajo: **"Aplicar las N a la grilla"**, que aparece solo si quedan **dos o más** por aceptar
  (agregado el 2026-08-31). Con los individuales presentes es un atajo, no una imposición.
- Al aplicar una, esa celda de la grilla cambia y el botón pasa a **"Aplicado a la grilla"**. **Las demás
  siguen sin aplicar.**
- **Y la página NO salta al inicio** en ninguno de los dos botones, ni al pulsar "Adaptar a las
  restricciones". Ese era el defecto del primer smoke.

**Sería defecto:** que devuelva la semana entera; que el atajo sea el ÚNICO botón; que aplicar una cambie
más de una celda; que el atajo aplique unas sí y otras no (va todo en un solo guardado); o que la página
salte al inicio al pulsar cualquiera de los tres botones.

**Y la comprobación en negativo:** quita las restricciones (borra "Sin gluten" y pon el patrón en
*Ninguno*), y el botón debe quedar **deshabilitado**, diciendo que no hay nada que adaptar.

**Si la IA falla** (sin conexión, o el proveedor caído): el aviso debe decir que **la grilla se queda con el
menú del ciclo**, no que "no se pudo generar el menú". El ciclo no es un plan B.

---

# 5 · Reporte e historia clínica

## 5a · Las observaciones del profesional

**Qué provocar:** en el panel de tratamiento, sección **"Notas del tratamiento"**, escribe una nota.

**Qué mirar:** esa nota aparece en la **historia clínica**, en un bloque **"Observaciones del profesional"**,
al final del cuerpo clínico, **antes** de la próxima consulta y la firma.

**Sería defecto:** que no aparezca (era el defecto: se guardaban y no se mostraban); o que el bloque vacío
diga solo "sin observaciones", sin explicar que el profesional no registró ninguna.

## 5b · La fecha de la evaluación

**Qué mirar:** la fecha del encabezado y la de la HC son la de la **medición**, no la de hoy.

## 5c · La reemisión por cambio de banda

**Cómo llegas a una evaluación antigua** (no quedó claro en el primer smoke): *Pacientes* → abres el
paciente → la tabla de evaluaciones las lista todas, **más reciente primero, por fecha de medición**, con
**"Ver resultados"** en cada fila. Desde el panel de una evaluación no hay ruta directa a otra: la salida es
"Volver a la ficha del paciente", que es esa misma tabla.

**Los dos pacientes que SÍ cambian de banda** (barrida toda la base el 2026-08-31; son los únicos):

| Paciente | IRC | Sellado | Con los cortes de hoy |
| --- | --- | --- | --- |
| **Demo Realimentación Bajo peso (smoke)** | 2,2794 | Riesgo moderado | **Bajo riesgo** |
| **Demo Restricciones Renal (smoke)** | 2,2794 | Riesgo moderado | **Bajo riesgo** |

Los dos son de **Profesional Demo** (nutricionista) y los siembra `SEED_REALIMENTACION=1`. El corte de
mujeres pasó de 2,27 a 2,30, y 2,2794 cae justo en esa ventana.

**Qué provocar:** abre cualquiera de esos dos. En **Demo Trayectoria** verás el otro desenlace (el gris),
porque su clasificación no se mueve: los dos son correctos y conviene ver los dos.

**Por qué funciona ahora y no antes:** hoy subimos la versión de los clasificadores, porque el porte del IRC
mueve de banda. Así que las evaluaciones emitidas antes quedan marcadas como **emitidas con versión
anterior**, y el sistema recalcula para decirte si el paciente cambió de banda.

**Qué mirar, y son dos desenlaces distintos:**

- Si **NO cambió de banda**: aviso **gris**, que dice que el diagnóstico sigue siendo válido **y que la
  clasificación no cambia, así que no hace falta reemitir**.
- Si **SÍ cambió**: aviso **ámbar**, **"Reemisión obligatoria"**, con la lista de qué cambió y de qué a qué.

**Sería defecto:** que el aviso ámbar use **rojo clínico** (el rojo significa riesgo del paciente, y aquí el
asunto es del documento); o que el aviso gris **no diga** si hace falta reemitir, dejándote la pregunta
abierta.

---

## Si algo sale mal

Anota **qué pantalla, qué esperabas y qué viste**, y sigue con lo demás: casi todo es independiente. Lo
único encadenado es la encuesta, que alimenta las alertas y el menú.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
