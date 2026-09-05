# Smoke de la encuesta v6

**Para Santiago. 2026-09-04.** Cambió el **instrumento**, así que esto no es opcional: es la única
verificación que atrapa esta clase de defecto. **En navegador y en teléfono**, porque la encuesta la
contesta un paciente desde su celular.

**Antes de empezar:** `pnpm db:seed` en local (ya corre bien; ver la nota del final) y confirmar que el
log dice **`survey v6`**. Si dice v5, la sesión está mirando la versión vieja y todo lo de abajo sale mal.

---

## Qué cambió, en una tabla

| Dónde | Antes (v5) | Ahora (v6) |
| --- | --- | --- |
| **P23** enunciado | ¿Cuántos días/semana hace actividad física **(≥30 min)**? | ¿Cuántos días/semana hace actividad física? |
| **P23** primera opción | `0` | **No hago ejercicio** |
| **P24** opciones | Menos de 15 · 15–30 · … | **0 minutos a la semana** · Menos de 15 · … |
| **P44** opciones | Lactosa · Gluten · Fructosa | **Lactosa (leche y lácteos)** · Gluten (trigo, pan, pasta) · Fructosa (frutas, miel) |

**Los cuatro son texto suyo**, no propuesta nuestra. Los dos primeros estaban en su archivo; los otros dos
los escribió palabra por palabra el 3 de septiembre.

---

## Recorrido 1 · El caso que originó todo esto (lo vio Valentina)

**Es el que importa.** El defecto era que quien no hace ejercicio tenía que mentir para poder avanzar.

1. Abre el link de encuesta y llega al bloque **Hábitos**.
2. En la **P23**, elige **"No hago ejercicio"**.
3. Baja a la **P24**.

**Qué tienes que ver:**

- La P23 **ya no dice "(≥30 min)"** en el enunciado.
- Su primera opción dice **"No hago ejercicio"**, no `0`.
- La P24 ofrece **"0 minutos a la semana"** como **primera** opción.
- Eligiendo esa, **puedes avanzar**: el contador de pendientes baja y no te frena.

**Sería defecto si:**

- La P23 sigue mostrando `(≥30 min)` o la opción `0`. **Estás en la v5**: revisa el seed.
- La P24 no tiene la opción de cero, o la tiene pero **no la primera**.
- Eliges "No hago ejercicio" y la encuesta **te sigue exigiendo** unos minutos para avanzar.
- El contador de preguntas pendientes **no baja** al contestar. (Ese conteo ya recayó dos veces; si falla,
  es grave y no cosmético.)

---

## Recorrido 2 · Las intolerancias, que ahora dicen el alimento

1. Ve al bloque **Alergias y digestión**.
2. Mira la **P43** (alergias) y la **P44** (intolerancias), en ese orden.

**Qué tienes que ver:**

- **P43 sigue igual**: Ninguna · Leche · Huevo · Maní · Trigo · Soya · Pescado · Mariscos · **Otra**.
- **P44 con el alimento al lado**: **Lactosa (leche y lácteos)** · Gluten (trigo, pan, pasta) · Fructosa
  (frutas, miel) · Otra.
- **Siguen siendo dos preguntas separadas.** Eso es deliberado: él lo confirmó el 3 de septiembre
  (*"alergia e intolerancia no son lo mismo"*).

**Sería defecto si:** se fusionaron, cambiaron de orden, o la P43 también ganó paréntesis (no debe).

**Y una cosa de teléfono, que aquí es donde se ve:** *"Fructosa (frutas, miel)"* es una etiqueta larga.
En pantalla angosta tiene que **envolver dentro de su opción**, no salirse de la caja ni cortarse con
puntos suspensivos.

---

## Recorrido 3 · Que no se rompió lo que ya funcionaba

El bump reescribe **las 64 preguntas**, no solo las cuatro. Así que hay que confirmar que el resto llegó
igual:

1. Recorre la encuesta **de principio a fin** y envíala.
2. Fíjate al pasar en:
   - Las **ocho secciones** con su nombre (Alimentación, Percepción corporal, Hábitos, Conductas
     alimentarias, Antecedentes y estilo de vida, Alergias y digestión, Hidratación, Contexto social).
   - La **matriz de frecuencia** del principio, con sus quince grupos **y las carnes rojas en la posición
     11**, no al final. (Ese orden es el mensaje: su modelo las clasifica como neutras.)
   - Las preguntas con **"Otra"** que abren un campo de texto libre al elegirlas.
   - La **P29 del estrés**, que debe seguir diciendo **"(1 = sin estrés, 10 = máximo)"**. Es una
     divergencia nuestra declarada (DIV-12) y se queda a propósito: sin los extremos, la escala no se
     puede responder.

**Sería defecto si:** falta una pregunta, una sección quedó vacía, el orden cambió, o el texto libre de
"Otra" dejó de aparecer.

---

## Recorrido 4 · Las evaluaciones viejas, que es lo que el bump protege

**Este es el que verifica que no rompimos nada de lo que ya existía.**

1. Abre una evaluación **anterior** (de las que ya estaban, hechas con la v5).
2. Ve a **Ver o editar encuesta**.

**Qué tienes que ver:**

- Sus respuestas **siguen ahí, completas**, con las opciones **viejas**: la P23 muestra `(≥30 min)` en el
  enunciado y su respuesta seleccionada.
- El botón de **corrección** sale **deshabilitado**, con este texto:
  > *"Esta evaluación se hizo con una versión anterior del cuestionario; no puede recalcularse con el
  > modelo actual. Escríbele a soporte."*

**Eso NO es un defecto: es el bump funcionando.** Cada evaluación se queda con el instrumento que el
paciente respondió de verdad.

**Sería defecto si:**

- La evaluación vieja aparece con las opciones **nuevas**. Eso significaría que el bump pisó la versión
  anterior, que es exactamente lo que había que evitar.
- Alguna respuesta suya sale **vacía** o "sin responder" cuando antes estaba contestada.
- El botón de corrección da **error al pulsarlo** en vez de salir deshabilitado con su razón.

---

## Y una nota para cuando pushees

**La migración no se despliega sola.** Ya nos mordió una vez (2026-08-08). Después del push, contra la
nube:

```
pnpm db:check:cloud      # confirma que 0099 está pendiente
pnpm db:migrate          # la aplica
pnpm db:types            # regenera los tipos
```

**Hasta que corras eso, la nube sigue en v5** y el código desplegado espera la v6.

**Y `pnpm db:seed` no se corre contra la nube.** Borra las respuestas de la versión vigente. Para la nube
va la migración, que solo inserta.

---

## Una cosa que apareció haciendo esto, y que te va a tocar

`pnpm db:seed` estaba **roto** en cualquier base sembrada antes del 1 de septiembre:

```
Seed fallido: ai_prompts: duplicate key value violates unique constraint "ai_prompts_one_active_idx"
```

No tiene nada que ver con la encuesta: el seed subió un prompt de IA a v2 y la base ya tenía la v1
**activa**, y solo puede haber una activa por clave. Ya está arreglado (el seed desactiva la anterior
antes de insertar la nueva, y respeta las ediciones del admin que estén en versiones más altas).

Lo menciono porque **se encontró por el bump, no por los prompts**: el seed es el paso de verificación del
bump y no corría.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
