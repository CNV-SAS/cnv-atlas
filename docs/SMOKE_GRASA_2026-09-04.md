# Smoke: el porcentaje de grasa en la historia clínica (2026-09-04)

**Un solo caso, y es corto.** De las dos cosas que entraron en la tanda, **solo una se puede smokear**; la
otra no, y conviene saberlo antes que descubrirlo intentándolo. Está explicado al final.

`pnpm dev`, y entra como el nutricionista de siempre.

---

## El caso · La grasa se registra con su porcentaje, no solo en gramos

**Qué se arregló.** La historia clínica imprimía las grasas **solo en gramos**. El porcentaje es el que el
profesional **fija**; los gramos son su consecuencia. Un documento clínico que registra la consecuencia y
no la decisión no deja reconstruir la prescripción.

### a) Qué paciente

**`/evaluaciones/a0000000-0000-4000-8000-0000000000a3`**

Es un F5 con tratamiento y peso meta fijado, así que tiene cadena calórica completa. **No hay que sembrar
nada**: ya está en tu base.

Si prefieres otro, sirve cualquiera que tenga tratamiento; lo único que hace falta es poder editar la
cadena.

### b) Qué provocar

1. Baja al bloque **"Cómo se llega a ese objetivo"** (la cadena calórica).
2. En el campo **"Grasa (%)"**, escribe un valor que se distinga del modelo: **25**.
3. **Guarda.**

### c) Qué mirar

| Dónde | Qué tiene que decir |
| --- | --- |
| **La HC en pantalla** (bloque Plan nutricional) | Grasas: **N g/día (25 %)** |
| **El PDF de la HC** (botón de imprimir/guardar) | Grasas: **N g (25 %)** |

Los gramos van a cambiar contigo: lo que se comprueba es que **el porcentaje aparezca y sea el tuyo**.

### d) Qué sería defecto

- Que la HC siga diciendo **solo los gramos**, sin paréntesis.
- Que el porcentaje diga **30** (el del modelo) en vez de tu 25: sería el mismo defecto que arreglamos en
  el plan del paciente, llegando por otro camino.
- Que en pantalla salga tu número y **en el PDF no**, o al revés: los dos leen la misma composición, así
  que una diferencia entre ellos es una fuente que se coló.
- Que aparezca `(null %)` o un paréntesis vacío si borras el campo. Sin porcentaje, tiene que volver a
  mostrar **solo los gramos**, sin paréntesis huérfano.

---

## Lo que NO se puede smokear, y por qué

**El arreglo de "No hago ejercicio" no se puede probar a mano, y además hoy no cambia nada visible.**

- **No se puede elegir:** las opciones de la P23 siguen siendo `0 … 7`. La opción "No hago ejercicio" es
  parte de su entrega de contenido y **entrar en la encuesta exige un bump de versión** (los ids de
  pregunta y de opción llevan la versión dentro). Hasta entonces no aparece en el formulario.
- **Y no cambiaría lo que ves:** con la opción "0" de hoy, el resumen por profesión **ya dice** *"no
  realiza actividad física"*. El arreglo es para **después** del bump, cuando el texto sustituya al número.

**Por eso lleva test y no recorrido:** `resumen-no-hago-ejercicio.test.ts` fija los cuatro casos, incluidos
los dos controles que importan — que un número real siga diciendo los días, y que **una respuesta ausente
no se lea como un cero**, porque "no hace ejercicio" es un dato y "no contestó" es una ausencia.

Un cambio que no altera ninguna pantalla hoy es exactamente el que se pierde sin que nadie lo note.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
