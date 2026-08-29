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
2. **El ISCM sin MCA va antes de generar el diagnóstico**, porque se decide al importar el BIS: después ya
   está sellado.
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

## 1a · Los tres encabezados de grupo

**Qué mirar:** en la matriz de frecuencia (preguntas 1 a 15) tienen que aparecer **tres encabezados**, en
este orden: *Alimentación Real protectora*, *Alimentación Real energética (moderar)*, *Procesados y
ultraprocesados (PCBU)*.

**Y lo que de verdad se está probando:** que **las carnes rojas queden bajo el encabezado del MEDIO**, no
bajo el de procesados. Estaban mal y es lo que corregimos.

**Sería defecto:** que aparezcan cuatro encabezados, que uno se repita, o que las carnes rojas caigan en el
último bloque.

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

## 3a · El ISCM sin MCA · **hazlo ANTES de generar**

**Qué provocar:** al importar el archivo del Biody, usa uno **sin la columna de la desviación teórica de la
masa celular activa** (`Masa celular activa measurementDetails.ECARTTHEORIQUEEXPORT kg`). La forma más
simple: abre el Excel del demo, **borra esa columna**, y súbelo.

**Qué mirar:** en el dominio *Metabólico-Estructural* del DFI tiene que decir **"ISCM –"** y la fila
**"ISCM-BIS – (–)"**.

**Sería defecto:** que diga **"ISCM Leve"** o **"ISCM-BIS 0"**. Ese era el defecto: el dato ausente entraba
como cero, y un cero ahí afirma que el paciente está en su valor esperado.

**Lo que NO es defecto:** que el dominio siga puntuando severidad 1 en el radar. Eso es decisión de
Gildardo y está preguntado en la ronda.

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
- Un botón **"Aplicar a la grilla"** en **cada una**, no uno solo para todas.
- Al aplicar una, esa celda de la grilla cambia y el botón pasa a **"Aplicado a la grilla"**. **Las demás
  siguen sin aplicar.**

**Sería defecto:** que devuelva la semana entera; que solo haya un botón para aceptar todo; o que aplicar
una cambie más de una celda.

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

## 5c · La reemisión por cambio de banda · **usa los de trayectoria**

**Qué provocar:** abre uno de los **Demo Trayectoria** (tienen dos evaluaciones) y entra a la **más
antigua**.

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
