# Lo que queda sin resolver del lado científico

**Para Santiago. 2026-09-04, actualizado el 05.** Este documento no va para Gildardo. Está escrito para que sepas, sin
tecnicismos, qué queda abierto después de su entrega final y qué efecto tiene cada cosa.

---

## Resumen

| # | Qué es | ¿Pregunta o trabajo nuestro? | ¿Bloquea el hito 2? |
| --- | --- | --- | --- |
| 1 | El interruptor del LE8 | **CONTESTADO** el 2026-09-05: se queda ENCENDIDO. Pasa a ser **trabajo nuestro**, y no es una línea | **Sí**: hay que portarlo antes del cotejo |
| ~~2~~ | ~~Tres colores dicen lo contrario que su etiqueta~~ | **CERRADO** el 2026-09-05: el color se deriva del orden de riesgo; esos hexadecimales no los lee nadie | — |
| ~~3~~ | ~~Dos cosas que prometió y no llegaron~~ | **CERRADO** el 2026-09-04 | — |
| ~~4~~ | ~~Portar las opciones de ejercicio~~ | **CERRADO** el 2026-09-04 | — |
| 5 | Dos cosas de su archivo que salieron de un barrido, las dos chicas | **Preguntas**, sin prisa | No |

---

## 1 · El interruptor del LE8

**Es lo único serio que queda, y necesitas sus palabras para decidirlo. Van las tres, textuales.**

### Qué decide este interruptor

Cómo se calcula la **edad biológica** (él la llama EB-BIS): el número que le dice a una persona de 45
años que su cuerpo está como el de una de 52.

### Cita 1 · El comentario que él escribió al lado del interruptor, en el archivo del 4 de septiembre

> ```
> ── CONDICIÓN DE ACTIVACIÓN (Dirección Científica, 9-ago-2026) ──────
> Resuelto el punto 13 del paquete: el ICEC es el componente contextual que
> afecta la edad bioeléctrica, y por tanto NO puede activarse el mapeo dejando
> intactas la media y la desviación con que se estandariza. Se recalibran en el
> MISMO acto, nunca por separado.
>
> Para poner esto en `true` hacen falta las dos cosas a la vez:
>   1. Recalcular μ y σ del ICEC sobre la base de datos con el mapeo YA
>      corregido (hoy: μ = 58,578 · σ = 13,332, en la ecuación EB-BIS v5).
>   2. Sustituir esos dos números en la llamada a _zBis del término contextual.
>
> Recalcular μ y σ es un cálculo sobre nuestros propios registros, no una
> decisión de diseño: mientras no exista, esta bandera se queda en `false` y
> D-006 sigue vigente. Activarla sola bajaría la edad bioeléctrica de TODOS los
> pacientes entre 1 y 8 años, más cuanto más sano esté el paciente.
> ```
>
> **Y la línea siguiente, en el mismo archivo:**
> ```
> const LE8_MAPEO_CORREGIDO = true;
> ```

### Cita 2 · Lo que dijo el 30 de agosto sobre μ y σ

> **Hicieron bien en no encenderlo, y la nota que los frenó es mía.**
>
> La media 58,578 y la desviación 13,332 del ICEC **no están establecidas**, y por eso escribí esa
> advertencia al lado del interruptor. **Encender el mapeo sin la recalibración movería la edad biológica
> de todos los pacientes entre uno y ocho años contra dos constantes que yo mismo marqué como no
> verificadas.** Eso no se hace.
>
> **La recalibración va por mi lado y llega con el dato, no con una instrucción.** Hasta entonces el
> interruptor se queda en `false`. **No lo enciendan por partes ni por su cuenta.**

### Cita 3 · Lo que dijo el 4 de septiembre sobre por qué la recalibración es imposible hoy

> **El interruptor está en `true` por decisión de esta Dirección, tomada el 2 de septiembre y reafirmada
> ese mismo día.** No es un descuido, no es un estado intermedio y no es la segunda vez que se les pasa:
> es la segunda vez que **no se les dijo**.
>
> [...] con el mapeo apagado, **dos de los ocho dominios del LE8 —Alimentación e Hidratación— leían
> campos que solo existen en el objeto `DEMO`**. En paciente real daban cero, y esos dos dominios
> quedaban clavados en 30 y en 20 **para todo el mundo, midiera lo que midiera la persona**.
>
> Eso sí era un defecto, y de los que no se ven: el LE8 parecía funcionar porque se probaba con el caso
> demo.
>
> **La recalibración no está pendiente de una firma. Está bloqueada por ausencia de dato.**
>
> μ y σ del ICEC se calculan sobre una población con ICEC medido. **Ninguna fuente disponible lo trae**
> [...] La razón es estructural, no logística: **el ICEC se calcula desde la encuesta**, y ninguna de
> esas fuentes la trae. [...] **es que hoy no existe la tercera cosa que ambas requieren.** Se recalibra
> cuando haya una masa de pacientes con encuesta completa.
>
> Y sobre las mismas constantes, en la misma respuesta:
>
> **μ = 58,578 y σ = 13,332 tampoco tienen origen documentado.** No aparecen en ninguno de los dos
> documentos técnicos de la EB-BIS [...] **la v5 necesita su documento técnico.**

### Lo que las tres dicen juntas

Puestas en orden, el cuadro es este:

1. Su comentario y su mensaje del 30 dicen lo mismo: **el interruptor se queda apagado hasta recalibrar**,
   y no se enciende "por partes ni por su cuenta".
2. Su respuesta del 4 dice que **la recalibración es imposible hoy** y que las dos constantes **no tienen
   origen documentado**.
3. **Y su archivo lo tiene encendido.**

Por su propia regla del 30 de agosto, con la condición 1 imposible de cumplir, el interruptor **no podría
encenderse nunca**. Y sin embargo está encendido.

**Las dos opciones tienen un problema escrito por él:**

- **Encendido:** la edad biológica de todos baja entre 1 y 8 años, contra dos constantes que él mismo
  marcó como no verificadas y que ahora dice que no tienen origen documentado.
- **Apagado (lo de hoy):** dos de los ocho componentes del LE8 corren clavados en el mismo valor para
  todo el mundo, midiera lo que midiera la persona.

**Atlas sigue hoy en `false`, y eso es lo que hay que cambiar.** Ver abajo.

### El dato que hacía falta: qué pasa con los diagnósticos ya emitidos

**Esto también lo contestó él**, el 30 de agosto, en el mismo párrafo de la cita 2:

> **Y sí: la conducta de reemisión aplica igual a la EB-BIS.** Es la misma regla del 12b, y con más razón
> aquí, porque una recalibración poblacional mueve a todos por definición: **reemisión obligatoria si el
> paciente cambia de banda, y aviso cuando le cambie el tratamiento.**

O sea que si se enciende:

- Los diagnósticos ya emitidos **no se marcan como desfasados en bloque**. La regla es por paciente.
- **Hay que reemitir a todo paciente que cambie de banda** de edad biológica. Como el cambio baja la edad
  entre 1 y 8 años, muchos cruzarían una banda.
- **Se le avisa a cada uno cuyo tratamiento cambie** como consecuencia.

**Y aquí está lo que vuelve la decisión fácil:** medido hoy sobre la base, **no hay ningún tratamiento
aprobado y no hay pacientes reales todavía**. Así que la reemisión obligatoria, que es lo caro de esta
decisión, **hoy no cuesta nada**. Después del hito 2 sí, y crece con cada paciente que entre.

*(Ese conteo se midió antes en esta sesión. Vale la pena repetirlo el día que se decida, porque es
justamente el número que cambia.)*

### CONTESTADO el 2026-09-05: se queda ENCENDIDO

**Su respuesta, textual:**

> **El ICEC se activa tal cual se envió. Esa es la directriz vigente y con ella se cierra el punto.**
>
> **Esa nota [la del 30 de agosto] se escribió sin haber analizado un solo caso, porque entonces no los
> teníamos.** Era una advertencia prudencial, no una medición.
>
> El 2 de septiembre sí se analizaron: se extrajeron los registros reales de ATLAS, se midió el efecto
> del mapeo perfil por perfil, y **los ICA-BIS calculados coincidieron exactamente con los guardados en
> el sistema**. Con eso a la vista se tomó la decisión de encenderlo.
>
> **Una advertencia escrita sin datos no gobierna sobre una decisión tomada con datos.** El orden
> correcto de lectura es ese, y la nota del interruptor queda superada por el acto que la resolvió.

Así que la contradicción se resuelve por FECHA y por MÉTODO: la nota del 30 es anterior y prudencial, la
decisión del 2 es posterior y medida. **Su archivo no lo contradice: el interruptor está en `true` y ahí
tiene que quedarse.** El que quedó desfasado es el comentario de la nota, que sigue diciendo "esta
bandera se queda en `false`" justo encima de un `true`. Es lo que nos frenó dos veces, y conviene
decírselo aunque él no lo cambie.

**Y μ y σ se quedan como están** (58,578 y 13,332), por una razón que él da con todas las letras: no
están pendientes de firma, están **bloqueadas por ausencia de dato**. El ICEC se calcula desde la
encuesta y ninguna fuente disponible la trae, así que se recalibra cuando haya una masa de pacientes con
encuesta completa. Él mismo añade que esas dos constantes tampoco tienen origen documentado y que **la
v5 necesita su documento técnico**, trabajo suyo.

**Entonces el riesgo residual, dicho claro:** encendemos por instrucción suya, medida por él, y
estandarizamos contra dos constantes que él marca como no documentadas. No es ambiguo qué hacer. Sí
conviene que quede escrito con sus palabras, y por eso está aquí.

### Lo que cuesta encenderlo, que NO es voltear una línea

La cabecera de nuestro propio `engine.dfi.js` ya lo advertía, y al verificarlo resultó exacta:

1. **`calcPatron` no está en el ámbito de `engine.dfi`.** El archivo solo importa del núcleo. Con el
   interruptor en `true`, la rama de Alimentación cae al `catch` y devuelve 30 igual que antes: el flip
   solo **parecería** aplicado.
2. **Y `calcPatron` necesita el `enc` ADAPTADO, no el crudo.** Consume el ordinal 0-4 de cada grupo;
   Atlas guarda el TEXTO de la opción. Pasarle el crudo da el mismo 30 mudo. El adaptador ya existe
   (`clinical-engine/patron.ts`) y hay que cablearlo, no reescribirlo.
3. **`d7_agua` sí fluye** (es `contador`, así que `Number()` lo lee), pero está declarada
   `treatmentEngine`, no `engine`, así que su `used_in_diagnosis` es `false`. Al encender el
   interruptor pasa a alimentar el diagnóstico y esa marca queda mintiendo.
4. **El flip va por el mecanismo de modificaciones autorizadas.** La constante está dentro de la región
   que compara `DIFF-dfi`; tocarla a mano pone el candado en rojo, y con razón.

Los dos requisitos que faltaban cuando se escribió esa advertencia (`calcPatron` portado y `d7_agua`
capturada) **ya existen**. Lo que queda es el cableado, la marca y el flip, con su medición.

**Y mueve números para todos:** ICEC/LE8, EB-BIS, IAE, los dominios 3 y 5 del DFI con su severidad, y
las rutas R4 y R5. Hoy no hay tratamiento aprobado ni paciente real, así que la reemisión que él exige
(*"reemisión obligatoria si el paciente cambia de banda"*) **no cuesta nada todavía**. Después del hito
2 sí.

---

## 2 · Los tres colores: VERIFICADO el 2026-09-05, y no hay nada que preguntar

**Lo que él señaló es cierto, y no llega a la pantalla.** La pregunta que decidía era de dónde sale hoy
el color de cada casilla. Ya está verificado.

### Lo que él dijo

> **Una cosa que queda señalada y sin tocar:** los colores de `FYR_LABELS` no se movieron, y con los
> rótulos nuevos hay tres que ya no acompañan. `3_3` "Función normal con riesgo" sigue en cian, `2_2`
> "Función sin riesgo" sigue en ámbar y `1_2` "Disfunción sin riesgo" sigue en rojo. **El color es
> contenido de esta Dirección y va firmado aparte**, no inferido de la nueva redacción.

### Y lo que se verificó

Esos nueve colores están **declarados y no los lee nadie**, ni en Atlas ni en su propio archivo.

- En Atlas, `FYR_LABELS` se usa **solo para el nombre** (`.l`). El campo del color (`.c`) no se lee en
  ningún sitio, y el cian de `3_3` (`#22d3ee`) no aparece en ninguna otra línea del repositorio.
- En su archivo del 4 de septiembre pasa lo mismo: `getFyR()` devuelve el objeto entero, y las dos veces
  que se llama se toma únicamente `.l`.

**El color que sí se ve sale de otro lado, y se deriva solo.** Las nueve casillas se pintan en la Diana,
y el color lo calcula un degradado verde a rojo sobre el **orden de riesgo** de las nueve combinaciones
(su `rc()`, portado en `riskColor`). Su propio comentario lo dice: *"Orden sectores igual al HTML de
referencia (rk 1..9 define color)"*.

Ese orden deja `2_2` en la posición 4 de 9 (ámbar, que es lo que corresponde a esa posición) y `1_2` en
la 8 de 9 (rojo, que también corresponde). **Así que en pantalla no hay semáforo invertido.** El único de
los tres que desentonaría, si alguien llegara a leer el campo, es el cian de `3_3`.

### Lo que queda

**Nada que preguntarle y nada que arreglar.** Los tres hexadecimales son una declaración muerta que
sobrevive en el archivo. Queda anotado por si algún día alguien va a usarlos: **antes de leer
`FYR_LABELS.c` hay que pedirle los tres**, porque hoy no acompañan a sus rótulos.

---

## 3 y 4 · CERRADOS con el bump de la encuesta a v6 (2026-09-04)

Los dos eran del instrumento y se cerraron juntos, en un solo bump:

- **Las dos opciones de ejercicio** que él ya tenía en su archivo desde el 3 de septiembre ("No hago
  ejercicio" en la P23, "0 minutos a la semana" en la P24), que era trabajo nuestro atrasado.
- **Las dos correcciones que prometió "para la próxima entrega"** y no llegaron: quitar el "(≥30 min)" de
  la P23 y poner el alimento al lado de la sustancia en la P44 ("Lactosa (leche y lácteos)"). Los dos
  textos **los escribió él**, palabra por palabra, así que aplicarlos no es decidir contenido.

Detalle, medición y plan: `docs/PLAN_BUMP_ENCUESTA_v6.md`. Recorrido de prueba:
`docs/SMOKE_ENCUESTA_v6_2026-09-04.md`.

---

## 5 · Dos cosas que salieron de barrer su archivo al revés

Las dos aparecieron mirando **qué tiene su archivo que nosotros no**, que es la dirección que ningún
candado nuestro vigila (los candados prueban que lo nuestro sigue estando en el suyo, no al revés).

**Las dos son chicas y ninguna corre prisa.** Van aquí y no en una ronda: el ciclo con él está cerrado.

### a) Su archivo tiene dos clasificadores del índice cintura-cadera, con etiquetas distintas

El índice cintura-cadera se clasifica en su archivo en **dos sitios**, con los mismos cortes (0,90 en
hombre, 0,85 en mujer) y **distinta redacción**:

| Dónde | Debajo del corte | Encima |
| --- | --- | --- |
| `dICC` | "Normal" | "Riesgo cardiovascular" |
| `clasifICC` | "Riesgo bajo" | "Riesgo alto — distribución central" |

Es la **misma forma** del problema que él acaba de arreglar en los nueve sectores: dos sitios de su archivo
nombrando lo mismo de dos maneras.

**Verificado: no tiene consecuencia visible en Atlas.** Nosotros portamos solo `dICC`, byte a byte, y el
índice se pinta en **un único sitio**. Un profesional nunca ve las dos etiquetas para el mismo paciente.
El problema vive en su prototipo, no en nuestro porte.

**Lo que se le preguntaría, cuando haya ocasión:** cuál de las dos manda. La suya viva dice más
("distribución central" explica *por qué* es riesgo), así que puede que la nuestra se quede corta.

### b) Tiene un clasificador completo que nadie llama, ni él

`clasifLancet` es un clasificador de cuatro niveles que cruza IMC con masa grasa y masa magra, rotulado
*"Propuesta The Lancet 2025"*. Está completo, con sus etiquetas y sus colores.

**Y en su propio archivo aparece una sola vez: la declaración.** Nadie lo invoca.

Es la misma situación de las tres piezas que él declaró muertas en septiembre (*"quedan marcadas para
borrarse, no para conectarse"*), **con una diferencia: esta nunca la ha mencionado.**

**No lo portamos**, y no por pereza: conectar una pieza que su propio archivo no conecta sería estrenar
una clasificación clínica por nuestra cuenta, que es justo lo que la Regla 0 prohíbe. Lo que cabe es
preguntarle si es un resto o algo que piensa usar.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
