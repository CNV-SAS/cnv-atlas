# El panel del nutricionista: el flujo guiado de v12 en Atlas (propuesta, sin construir)

**Fecha:** 2026-10-30 · **Para:** Santiago (y Gildardo en los dos puntos clínicos) · **Estado:** propuesta.
**No se construyó nada de esto.**

**De dónde sale:** v12 §6.2 (el flujo guiado de seis pasos), leído contra el panel que Atlas tiene hoy. Su
argumento es bueno y es el mismo que Santiago ha hecho dos veces: *"demasiados corta-pisos y sin orden"*.
El panel actual muestra todo a la vez, y son 3.500 líneas de campos en vivo.

---

## Lo primero: dos cosas de esta propuesta esperan a Gildardo, y una de ellas la bloquea

| Qué | Por qué bloquea |
|---|---|
| **El motor calórico (§6.1)** | Los pasos 1 y 2 del flujo son, literalmente, las cifras del motor: TMB, gasto, el 10 % de termogénesis y la fórmula sintética. Construir la pantalla antes de que la cifra esté decidida es maquetar alrededor de un número que se va a mover (**+301 kcal/día** en su propio ejemplo verificado), y además con **dos Harris-Benedict** posibles (1919 y 1984) sin decidir cuál manda |
| **Retirar el resumen clínico y la meta terapéutica de pantalla** | Es decisión de Santiago, no de él, y la propuesta recomienda lo contrario (ver abajo) |

**Recomendación de orden:** esta propuesta se construye **después** de que llegue su respuesta sobre
Harris-Benedict y el 10 %, porque es cuando se sabe qué dicen los pasos 1 y 2. Lo que **no** espera es lo
que ya se hizo hoy: soltar la cifra manual de calorías (§6.2, defecto nuestro, commit del 30-oct).

---

## 1. Lo que se adopta tal cual, y es la mayor parte

**La revelación progresiva en seis pasos, con el orden de v12.** El orden es lo más valioso de su
propuesta, y no por estética: hoy el objetivo calórico se puede escribir **antes** de mirar la fórmula, y
las porciones existen antes de que nadie haya aprobado las calorías. Su orden (recomendaciones → fórmula →
objetivo → porciones e ICN → tiempos → menú) es la secuencia clínica real, y cada paso depende del
anterior de verdad.

**Una regla suya que conviene citar aquí, porque es la que hace el flujo barato:** *"si deja las
recomendaciones tal cual, el ICN aparece de inmediato"*. El camino frecuente (no tocar nada) pasa a ser un
clic, y eso es exactamente lo contrario de añadir pasos.

**Y una pieza que Atlas ya tiene y encaja sola:** el paso 1 muestra *"TMB y gasto del Biody Xpert como
referencia"*, y en Atlas esa cifra ya se pinta con su rótulo propio ("Gasto energético medido por el
equipo"), con la nota de que el plan **no** se prescribe con ella.

---

## 2. Las tres cosas que chocan, y cómo se resuelven

### 2.1 · "Son tres aprobaciones" contra el guardado único

**El choque:** Atlas tiene **UN** botón de guardar al pie, con la barra pegajosa que nombra las secciones
cambiadas. Fue una decisión explícita de Santiago (2026-09-09, *"pasamos de 8 botones a solo 1 botón"*) y
el candado `guardado-unico-del-protocolo` la sostiene. Tres aprobaciones vuelven a partir el guardado.

**La resolución, y es la que el propio v12 insinúa:** sus "aprobaciones" son **avances de paso**, no
guardados. Lo que hacen es *revelar lo siguiente*, no escribir en la base. Así que se portan como un
estado de pantalla: el paso 2 aparece cuando el profesional dio por buenas las recomendaciones, y lo
**guardado** sigue siendo uno solo al final.

**Y hay una razón técnica para que sea así, no solo de preferencia:** partir el guardado en tres
obligaría a tres firmas sobre las mismas seis columnas de ajustes (`adjustmentSignature` cubre las seis), y
un guardado parcial dejaría que la cadena de un profesional pisara la meta de otro. Eso ya está escrito en
el panel como la razón por la que la **presentación** se parte y el guardado no.

### 2.2 · El estado del flujo: en v12 vive en el navegador, y aquí no puede

**Su implementación** guarda el paso alcanzado en `localStorage`, con la clave
`atlas:plan_flujo:<documento>:<fecha>`.

**En Atlas eso está prohibido dos veces:** CLAUDE.md prohíbe `localStorage` para datos sensibles, y esa
clave **lleva el número de documento del paciente**, o sea PII en el navegador de un equipo compartido. Es
la misma decisión que ya se tomó con la marca local de perfiles eliminados (`atlas:_eliminados`), que
también se descartó.

**La propuesta: no guardar el estado del flujo en ninguna parte, DERIVARLO de lo que ya está guardado.** Un
paso está hecho si su dato existe: la cadena tiene ajustes, la lista tiene porciones, los tiempos están
elegidos. Dos ventajas que no son teóricas:

- **No puede contradecir al dato.** Un estado guardado aparte se desincroniza del contenido en cuanto algo
  se corrija por otro camino (una corrección versionada, por ejemplo), y entonces la pantalla diría "paso 4
  aprobado" sobre unas porciones que ya no existen.
- **Y resuelve gratis su propia nota de migración** (*"un plan hecho antes de v12 entra con todos los pasos
  aprobados"*): si el estado se deriva, un plan viejo con sus datos completos ya sale con todo hecho, sin
  backfill ni bandera.

### 2.3 · Retirar el resumen clínico y la meta terapéutica de la pantalla

**Su decisión:** *"ya no salen en pantalla. Siguen en la impresión."*

**Recomendamos NO retirarlos, y moverlos al paso 1.** El motivo es lo que esa lectura es: es el único
sitio donde el profesional lee lo que el modelo concluyó **mientras** prescribe. Retirarla de pantalla
obliga a imprimir para leerla, o a prescribir sin ella. Y su propio paso 1 se llama "recomendaciones del
sistema", que es exactamente el sitio donde esa lectura pertenece.

**Es decisión de Santiago.** Si decide retirarla, se retira: el bloque ya es `no-print`/impresión separada,
así que el cambio es de pantalla y no toca el documento.

---

## 3. Lo que NO se recomienda portar

| Pieza de v12 | Por qué no |
|---|---|
| La marca local del flujo (`localStorage`) | PII en el navegador; y se deriva, ver 2.2 |
| Las tres aprobaciones como **guardados** | Rompe el guardado único y abre el guardado parcial, ver 2.1 |
| Su rótulo "Actividad prescrita (FA)" | Ya resuelto: su §8.1 mandó unificar en **PAL**, y así está |

---

## 4. Lo que la propuesta ARRASTRA y hay que decidir con ella

**El nombre "Fórmula sintética".** No es nuestro: es el de su tarjeta `secD`, que **v12 retira** (§6.4), y
lo adoptamos en el cotejo del 2026-09-05 porque Santiago pidió usar el suyo. Al retirarla, el rótulo se
queda sin la fuente que lo justificaba, y lo que la reemplaza en su versión es el **paso 2** de este flujo.
Así que el nombre se decide aquí: o se conserva (es vocabulario que el equipo ya usa), o el paso 2 toma el
nombre que él le dé en su versión. **No se renombra antes de construir el flujo**, porque dejaría el bloque
rebautizado por nosotros y sin el flujo que lo justifica.

---

## 5. Lo que se puede construir sin tocar la pantalla (y conviene antes)

Dos piezas del flujo son independientes de la maqueta y bajan el riesgo de la tanda grande:

1. **El paso 1 como bloque de lectura** (recomendaciones del sistema reunidas en un sitio). Hoy están
   repartidas: por nutriente, por enfermedad, por hallazgos del DFI, por alimentación y por antecedentes.
   Reunirlas no cambia ningún cálculo.
2. **Las dependencias en vivo que faltan.** La verificación del 30-oct dejó una sola excepción conocida:
   las porciones del intercambio siguen el objetivo **guardado**, no el de pantalla (la "base estable" del
   2026-09-10). En un flujo guiado por pasos eso deja de ser una excepción cómoda: el paso 4 vendría
   inmediatamente después de aprobar la fórmula en el paso 2, así que tendría que seguir el objetivo **en
   vivo**. Es la pieza con más riesgo de las dos, porque toca el aviso de desfase (DIV-11).

---

## 6. Tamaño

| Pieza | Tamaño | Depende de |
|---|---|---|
| El paso 1 como bloque de lectura | media tanda | nada |
| El objetivo en vivo para las porciones (2.5 / §5.2) | media tanda | nada, pero toca DIV-11 |
| La revelación progresiva de los seis pasos, con el estado derivado | una tanda | el motor calórico de Gildardo |
| Retirar (o mover) el resumen clínico y la meta | lo que dure la decisión | Santiago |

**Y lo que no cambia, por si acaso:** la impresión. Su §6.3 lo dice y en Atlas ya es así desde el 24 de
octubre, por el mismo argumento que él usa (*"no unifiques los dos bloques"*): la hoja imprimible se arma
con lo **guardado** y el taller va `no-print`, así que reordenar la pantalla no mueve una coma del impreso.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
