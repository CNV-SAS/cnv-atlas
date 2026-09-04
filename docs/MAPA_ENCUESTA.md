# Mapa de la encuesta del paciente (2026-09-04)

**Para no perder el rumbo al entrar en lo científico.** Estado de la encuesta de Atlas Pacientes: lo
hecho, lo que espera una decisión de Santiago, lo que espera a Gildardo, y lo que no se ha mirado.

**El criterio que gobierna todo lo de abajo**, y sale del cotejo contra su encuesta: **se adopta lo que
hace la encuesta más fácil de responder y se deja fuera lo que la califica.** Un control más entretenido
está bien; un color que dice "esto está mal" antes de contestar, no. No es una regla estética: un rojo
sobre "conductas alimentarias" puede cambiar lo que el paciente responde, y esos datos alimentan el motor.

---

## 1 · Hecho

| Pieza | Qué es |
| --- | --- |
| **La referencia de cantidad, en su propia línea** | "Un puño cerrado" estaba pegado al final de la línea gris de ejemplos. El dato ya existía; lo que faltaba era jerarquía. Con tinte de marca (`primary/10`), no verde ni ámbar |
| **Un icono por dominio** | Identidad, en ink. Ninguno es un símbolo de veredicto, y el candado lista los prohibidos |
| **El conteo por sección** | "18 preguntas" junto al título. Dice cuántas **hay**, nunca cuántas faltan |
| **La tira de color de la orina** | Como en su archivo: opciones arriba, barras debajo. En rejilla compartida, así que cada barra cae bajo la suya en cualquier ancho |
| **La lista de preguntas pendientes, con salto** | Cada fila lleva a su pregunta. En superficie neutra, con el permiso escrito: "puedes enviarla así y completarlas con tu profesional" |
| **El disco del deslizable de estrés** | El valor se ve. En azul fijo: un ámbar que subiera con el nivel calificaría |
| **La barra de avance** | Medía preguntas y casi nunca se actualizaba: el disparador solo cubría controles nativos, y 64 de 65 preguntas son botones |
| **El scroll que subía solo** | Un `ref` de función en línea llamaba a `scrollIntoView` en cada render, y `block: "nearest"` sí mueve la página |

**Ya estaba antes y no había que construirlo** (verificado, no supuesto): los contadores de bebidas (y son
mejores que los suyos: distinguen *sin tocar* de *cero explícito*), la línea de ejemplos, el progreso por
preguntas y el guardado dentro de la sección.

---

## 2 · Espera decisión de Santiago

### 2.1 · La rampa de ocho tonos

**Decidido que va.** Falta el diseño concreto. Propuesta:

- **Ocho matices en OKLCH con lightness y croma idénticos**, variando solo el matiz. Así "misma
  intensidad" es literal y no a ojo, que es exactamente lo que falla en su archivo, donde D4 en ámbar y D6
  en rojo destacan sobre el verde y el azul de los demás.
- **Dos tokens por dominio**: superficie muy clara y acento para el icono.
- **Fuera el arco rojo y el ámbar.** Un rojo sobre "Alergias y digestión" o un ámbar sobre "Conductas
  alimentarias" sería repetir su defecto exacto. Quedan verdes, azules, violetas y magentas: ocho caben.
- Y el límite ya fijado: **los tonos son los nuestros**, no los de su paleta.

### 2.2 · Los emojis, y una excepción que hay que escribir

**`CLAUDE.md` los prohíbe** ("Sin emojis en UI", línea 185) y `BRAND.md` lo repite dos veces. **Adoptarlos
es una excepción que hay que escribir, no saltarse.** Redacción propuesta:

> Emojis permitidos **solo en la encuesta del paciente** (nunca en la app clínica), **siempre fijos** y
> **nunca dependientes de la respuesta**.

| Dónde | ¿Va? | Por qué |
| --- | --- | --- |
| Encabezado de dominio | **Sí**, fijo | Identidad. Pero **o emoji o icono, no los dos** |
| Extremos del deslizable de estrés | **Sí**, fijos | Rotulan la escala, no la respuesta. Es lo que hace una escala de dolor con caras |
| Grupos de alimento de D1 | **Sí**, fijo por grupo | Dice "verduras", no "bien hecho" |
| Que cambie con el valor del deslizable | **No** | Califica la respuesta |
| En las opciones de frecuencia | **No** | Pondría una cara sobre la respuesta elegida |
| En la lista de pendientes o la barra | **No** | Es lo que ya se retiró |

**Y un candado que habrá que cambiar deliberadamente:** hoy `referencia-de-porcion-visible.test.ts` afirma
que ninguna ayuda lleva emoji. Si entran, ese caso se reescribe con su razón, no se borra.

---

## 3 · Espera el bump de versión de la encuesta

**Las tres cosas de P23 y P24**, de su punto 6 del 3 de septiembre. Verificado contra su archivo:

| Lo que anunció | ¿Está en el HTML del 3? |
| --- | --- |
| "No hago ejercicio" en P23 | **Sí** (0 veces en la del 2, 3 en la del 3) |
| "0 minutos a la semana" en P24, con su mapeo a 0 en `calcPAL` | **Sí** |
| Quitar el "(≥30 min)" de P23 | **No.** La etiqueta es byte por byte idéntica a la del 2 |

**El bump es barato en mecánica** (un `SURVEY_VERSION_ID` nuevo; los ids llevan la versión, la anterior se
preserva intacta) **y caro en consecuencia**: cada paciente nuevo entra con la versión nueva y las
evaluaciones viejas dejan de ser corregibles.

**Recomendación: esperar la etiqueta corregida y bumpear las tres juntas.** Es una línea suya. Si se
prefiere no esperar, se bumpea con dos de tres y se le avisa de la que queda, que es **la contradicción
que él mismo señaló**: P23 dice "≥30 min" mientras P24 ya ofrece "Menos de 15" y "0 minutos".

---

## 4 · Sin cotejar

Las tres pantallas del intake que no son dominios. Santiago dijo que la prioridad eran los dominios y que
estas quedaban para después:

- **Consentimiento**
- **Datos de inicio**
- **"Sobre ti"** (caracterización opcional)

Hay capturas de las dos primeras en `cotejo-visual/atlas-web/encuesta atlas pacientes`. **No hay capturas
equivalentes de su lado**, porque su archivo no tiene esas pantallas: son nuestras. Así que aquí no hay
cotejo posible, hay diseño propio, y eso cambia el tipo de trabajo.

---

## 5 · Fuera por decisión ya tomada

| Qué | Por qué |
| --- | --- |
| **Los cuatro dispositivos de sesgo** de su encuesta: el ⚠️ y el ámbar de D4, D6 entera en rojo, el contador de ítems en rojo, y "✅ Alimentación Real protectora" | Los cuatro califican la respuesta antes de darla. El cuarto ya se había retirado el 2026-08-31 |
| **La matriz de frecuencia como tabla única** | Serían dos widgets para la misma pregunta y acabarían divergiendo, y esos datos alimentan el motor. Las 15 preguntas están todas; lo que no se adoptó es el formato |

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
