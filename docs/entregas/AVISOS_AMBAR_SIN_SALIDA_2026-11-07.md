# Los avisos ámbar que no tenían salida

**2026-11-07.** Qué se cambió en el aviso de "emitido con una versión anterior del modelo", y la lista
de las consultas a las que les toca.

Sin datos de paciente: las consultas van con ocho caracteres de su identificador. El detalle con nombres
y documentos vive en `docs/entregas/dudas/mediciones-repetidas-por-profesional.md`, que está gitignoreado
y no sale de CNV.

---

## 1 · El defecto, dicho en una línea

El ámbar le dice a la profesional que el documento **debe reemitirse**. De los 53 que quedaron después
del recálculo, la pantalla de recalibración **no ofrece ninguno**, y en los de la edad no lo va a ofrecer
nunca. Era un aviso que pedía una acción que el sistema no deja hacer, y que no se podía quitar.

Un freno sin salida no es un guard: detiene a una persona. Y además entrena a ignorar el ámbar, que es lo
que lo vuelve inútil el día que sí hay algo que hacer.

| motivo | cuántos | ¿tiene salida? |
|---|---|---|
| Paciente de prueba | 30 | no hace falta: no se reemiten a propósito |
| Medición repetida | 19 | **sí**: decidir de quién es la toma |
| Menor de edad al medirse | 4 | **no**, y nunca la va a tener |

---

## 2 · Qué se cambió

**Los de la edad pasan a una nota fija y neutra**, con el texto que fijó Santiago:

> **Fuera del rango de calibración de la EB-BIS (18 a 100 años): no se recalcula**
>
> Al medirse tenía N años, y la edad biológica estimada se calibró entre los 18 y los 100. El
> diagnóstico se emitió con lo que regía en su momento y sigue siendo válido. No hay nada que hacer con
> esta nota.

Va en registro **neutro** (fondo tenue, icono de historia), no en ámbar, y **sin pedir ninguna acción**:
no es un problema por resolver, es una condición del paciente. La EB-BIS v7 devuelve `pendiente` fuera de
ese rango, así que reemitir dejaría el dominio 3 en blanco, que es peor que no reemitir.

Y va **antes** que el ámbar en el código, a propósito: aunque la clasificación de ese paciente haya
cambiado, la reemisión sigue siendo imposible, así que el ámbar no puede ganarle.

**Los de medición repetida se quedan en ámbar, porque sí tienen salida, y ahora la nombran:**

> **Antes de reemitir:** su medición está repetida en otra consulta: hay que resolver a quién pertenece
> antes de recalcular. Decide cuál es la que vale en **Antrop. & BIS**, en el bloque de reemplazar la
> medición, y después el recálculo la ofrece sola.

El rótulo de la pestaña y el enlace se derivan del mapa de etapas, no están escritos a mano: un aviso que
nombra una pestaña a mano sobrevive a que la pestaña se renombre, y eso ya pasó una vez.

**Y los que no tienen fecha de nacimiento** (las 14 de la simulación) llevan la suya, que es otra:
registrarla en la ficha del paciente, y después se reemiten por el flujo normal.

Candado: `src/tests/el-ambar-que-no-se-puede-quitar.test.ts`.

---

## 3 · La lista de las repetidas, por profesional

Las 21 consultas de **pacientes reales** con una medición repetida son todas de **Ángela Marín Ramírez**.
Los otros tres profesionales de la lista (Profesional Demo, Profesional Prueba, Profesional demo 2) son
cuentas de prueba, y sus 29 consultas son las que entran en los 30 ámbar de prueba.

Medido contra producción el 2026-10-24. **El grupo es el conjunto de consultas que comparten la misma toma
física**: resolver una resuelve a las dos.

| grupo | consultas | ¿entre pacientes distintos? | nota |
|---|---|---|---|
| 3 | `99f4be45` | sí | **ya resuelto**: su gemela es de una cuenta de prueba, que no cuenta (ver abajo) |
| 4 | `f99bc9f3` · `d8a9076a` | no | mismo paciente, inicial y seguimiento |
| 5 | `4118e694` · `36aba016` | **sí** | dos pacientes distintos |
| 6 | `d6892f88` · `7f31029c` | no | mismo paciente, inicial y seguimiento |
| 7 | `6b82f54e` · `fb29a4e8` | **sí** | dos pacientes distintos |
| 9 | `0582ea65` · `24bb7e23` | no | mismo paciente, inicial y seguimiento |
| 10 | `0300d807` · `80d168dd` | no | mismo paciente; la edad de la ficha no cuadra con la del equipo |
| 11 | `15149709` · `233f7a5d` | no | mismo paciente; la edad de la ficha no cuadra con la del equipo |
| 12 | `8ddc1244` · `baf15441` | **sí** | dos documentos distintos, nombre parecido |
| 13 | `e3599e84` · `0c6f8ad4` | **sí** | dos pacientes distintos |
| 14 | **`2be9aa69`** · **`b4a9ea2a`** | no | **las dos pasan a acelerado con el motor de hoy** |

**Vueltas a medir contra la nube el 2026-11-07 por la tarde: quedan 20 en 10 grupos, no 21 en 11.** El
grupo 3 se cerró **solo**, y la razón vale la pena: el lector de huellas repetidas excluye a los pacientes
de prueba, así que en cuanto su gemela quedó marcada como de prueba, `99f4be45` dejó de tener con quién
repetirse. Las otras diez siguen abiertas. Preguntarle a la vista antes de mandar trabajo es lo que evita
que alguien vaya a corregir algo que ya no existe.

**Las dos del grupo 14 son las primeras que hay que mirar.** Son las que cambian lo que se le dice al
paciente: con el motor de hoy su IAE entra en banda acelerada, así que el documento que tiene en la mano
dice una cosa y el recálculo diría otra. Y su freno no es la ciencia, es saber cuál de las dos tomas vale.

**Los cuatro grupos entre pacientes distintos (5, 7, 12 y 13) son los de riesgo real:** ahí una
bioimpedancia puede estar atribuida a la persona equivocada, y eso no se arregla recalculando.

De estas 21, **19 llevan hoy el ámbar** (su clasificación cambió con el motor nuevo) y las otras dos solo
la nota gris. Cuál es cuál sale de la corrida de la simulación contra la nube, que ya lo imprime por
profesional y por motivo, con las que pasan a acelerado marcadas:

```
pnpm vitest run --project db src/tests/simulacion-del-recalculo-db.test.ts
# -> quienTieneQueMirar.reemisionObligatoria.queLaPantallaNOofrece.cuales
```

---

## 4 · Los menores: la pregunta queda abierta con Gildardo

La EB-BIS v7 no puntúa fuera de 18 a 100, y eso **no es una decisión nuestra**: es su calibración
(`eb-bis-v7.js`). Lo que el sistema hace ahora es decirlo y no pedir nada.

Lo que sigue abierto es **qué se le entrega a un paciente menor de edad**: hoy su dominio 3
(envejecimiento) no puntúa, y su diagnóstico sale sin esa parte. Es la pregunta 31 de
`PENDIENTES_CIENTIFICOS.md`, y sigue siendo suya.
