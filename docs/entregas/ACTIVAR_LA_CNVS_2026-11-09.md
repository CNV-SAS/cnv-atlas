# Activar la Encuesta CNV-S para todos los pacientes

**Connected Nutrition Ventures · Atlas · 9 de noviembre de 2026**

> **Esto es el runbook, no la decisión.** La CNV-S está construida y hoy se aplica **solo a pacientes de
> prueba**. Encenderla para pacientes reales lo decide Santiago después del smoke, y clínicamente lo
> aprueba Gildardo. Aquí está exactamente qué hacer, qué cambia, cómo se apaga y qué decirles a los
> profesionales.

---

## 1 · Lo que falta antes de encenderla

| Precondición | Estado al 9 de noviembre |
| --- | --- |
| El smoke en navegador, completo | **Pendiente de Santiago**: falta medir la consulta de prueba, generar el diagnóstico y ver la tarjeta de respuesta, la HC, el SOAP y el CSV. |
| El visto bueno de **Gildardo** sobre el Módulo S | **Pendiente.** Son las cinco preguntas de la sección H de `PENDIENTES_CIENTIFICOS.md` (39, 40, 43, 46, 47). |
| La pregunta **39** (si el marco de referencia pide versión nueva del instrumento) | **Pendiente.** Es la única de las cinco que puede obligar a cambiar el instrumento, así que va antes de encender. |
| El marco de referencia por sección (§7.1) | **No construido**, y está declarado: `marcoDeLaSeccion` deriva el marco del `field_key` (`d1…d8`), así que los ítems `cnvs_*` no reciben ninguno y los `confirmar` heredan "últimas dos semanas". Arreglarlo bien necesita la sección y el comportamiento, no solo la clave. |

**Nada de lo anterior bloquea el smoke**: todo eso se puede probar hoy con el paciente de prueba.

---

## 2 · Qué cambia, exactamente

**Un interruptor, una línea.** En `src/modules/evaluations/instrumento.ts`:

```ts
export const CNVS_ACTIVA = false;   // ← pasa a true
```

Es una constante y no una variable de entorno a propósito: una variable hay que documentarla y tiene
**tres** estados (puesta, vacía, ausente), que es justo la forma en que una bandera se queda encendida sin
que nadie lo sepa. Una constante **se ve en el diff**.

**Lo que pasa con `true`:**

- toda consulta de **seguimiento** (segunda consulta en adelante, de cualquier paciente) aplica la
  **CNV-S 1.0** en vez de la CNV v2.0 completa;
- el paciente ve **71 ítems** en vez de 64: el Módulo S (7), el Cierre, el bloque de confirmación (8
  ítems) y las 45 que se repiten. Cuatro ítems no se le vuelven a preguntar (los `retirar`: 35, 38, 41 y
  63) y **conservan el valor de su línea base**;
- la consulta **sella** su instrumento (`evaluations.survey_instrument_id`), así que a partir de ese
  momento su encuesta se arma por el sello y no por la regla;
- la pestaña Seguimiento gana la adherencia, el S1 a S6 y el escenario de la tabla 6;
- la HC, el SOAP y el CSV incluyen el Módulo S en texto normal.

**Lo que NO cambia:** la primera consulta de cualquier paciente (siempre línea base, su §2.1, sin
excepción), las 500 consultas que ya existen, el motor clínico, el DFI, la Diana y los umbrales. **Ninguna
respuesta del Módulo S alimenta el diagnóstico**: verificado por bandera (`used_in_diagnosis = false` en
las siete) y por separación de versiones.

**No hace falta ninguna migración.** El instrumento y sus 71 ítems ya están en la nube (verificado el 9 de
noviembre), con los rótulos "Seguimiento" y "Confirmación" de la 0246.

---

## 3 · Cómo se apaga si algo sale mal

**Se revierte la constante y se pushea.** Y la propiedad que hace que apagar sea seguro, que conviene
entender antes de encender:

> **Una consulta que ya selló la CNV-S sigue viéndola.** El sello es por consulta, y las pantallas leen el
> sello, no la regla (`instrumentoDeLaConsulta`, `instrumentoPorTokenDeEncuesta`). Así que apagar el
> interruptor **no rompe** lo que está a medias: un paciente con su enlace abierto termina la encuesta que
> empezó, y su profesional la ve, la completa y la diagnostica con el mismo instrumento.

Lo que cambia al apagar es solo **qué se le aplica a las consultas NUEVAS**: vuelven a la CNV v2.0
completa. Nada que deshacer en la base, nada que migrar.

**El caso intermedio, por si hace falta:** si lo que falla es clínico y hay que dejar de aplicar la CNV-S
pero mantenerla para seguir probando, se apaga `CNVS_ACTIVA` y se deja `CNVS_EN_PRUEBAS = true`, que es el
estado de hoy: solo pacientes de prueba.

---

## 4 · Qué mirar las primeras 24 horas

1. **La primera consulta de seguimiento real.** En `/ani-bis-e/<id>/encuesta/editar`, la cabecera dice
   `Instrumento: CNV-S 1.0`. Si dice `CNV v2.0`, el interruptor no llegó al despliegue.
2. **Que el S1 presente un ítem por cada nutracéutico indicado en la consulta anterior.** Si presenta uno
   de dos, el defecto es del lector de "la anterior" y ya tiene candado.
3. **Sentry, estas áreas:** `evaluacion.contexto-cnvs`, `seguimiento.modulo-s`,
   `seguimiento.nombres-de-productos`, `evaluacion.serie-seguimiento`. Ninguna tumba una pantalla (todas
   van con `catch`), así que un error ahí se ve **solo** en Sentry: hay que mirarlo a propósito.
4. **El gate del diagnóstico.** Una consulta CNV-S tiene que poder emitirse sin "Encuesta incompleta":
   los 29 campos del diagnóstico están, incluido `d5_38`, que se **hereda** de la línea base. Si alguna
   sale incompleta por `d5_38`, la herencia falló.

---

## 5 · El mensaje para los profesionales

> **Desde hoy, la encuesta de los controles es más corta.**
>
> A partir de la segunda consulta, el paciente ya no responde la encuesta completa: responde una versión
> de seguimiento. Lo que cambia para ti:
>
> - **Hay preguntas que ya no se le hacen** (antecedentes familiares, suplementos, y dos más). No es un
>   error ni un dato que falte: Atlas **conserva** lo que respondió en su primera consulta y el
>   diagnóstico las usa igual.
> - **Hay preguntas nuevas sobre el tratamiento**: si tomó lo que se le indicó y con qué frecuencia, si
>   siguió el plan de alimentación, y si pasó algo entre las dos consultas (una enfermedad, una cirugía,
>   un embarazo). Se preguntan **producto por producto**, con el nombre del que se le indicó.
> - **En la pestaña Seguimiento** verás la **adherencia** y una lectura de si el paciente respondió a la
>   ruta. Si en el último control pasó algo que hace que su medición no sea comparable, Atlas te lo dice y
>   **no** resta esa medición contra la anterior: la conserva y la informa.
> - **Algunas preguntas aparecen solo si hacen falta.** Si el paciente dice que tomó todo como se le
>   indicó, no se le pregunta por qué no lo tomó. Si una pregunta no está en la pantalla, es porque esta
>   encuesta decidió no hacerla, **no** porque falte por responder.
>
> La primera consulta de un paciente nuevo no cambia en nada.

---

## 6 · Lo que este documento NO autoriza

Encender la CNV-S no autoriza nada clínico. Las cinco preguntas de la sección H de
`PENDIENTES_CIENTIFICOS.md` siguen abiertas, y dos de ellas cambian lo que el sistema hace con las
respuestas (la 43, "Lo suspendió" como no adherencia, ya aplicada con nuestra recomendación; y la 46). Si
Gildardo decide otra cosa, se cambia en un sitio.
