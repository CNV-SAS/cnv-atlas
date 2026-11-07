# El recálculo del motor 3.x · la simulación, y la decisión que falta

**Connected Nutrition Ventures · Atlas · 6 de noviembre de 2026, corregido el 7 con las cifras de la nube**
**Para:** Santiago · **Estado:** **la simulación está corregida. NADA se ha ejecutado.**

---

## En una línea

El motor subió tres veces en dos días (**3.0.0**, **3.1.0** y **3.2.0**) y las tres mueven el diagnóstico.
Lo ya emitido **no se reescribe** (regla 7): se reemite, y reemitir la cohorte es un acto que tú apruebas.
Esta simulación dice a cuántos pacientes toca y qué se les mueve, **sin escribir nada**.

> **Son tres versiones y no una** porque cada una se escribió **después** de que la anterior ya estuviera
> empujada, así que la nube podía estar sellando con ella. La regla que sale de haberlo hecho dos veces
> seguidas: mientras el recálculo esté sin aprobar, **cada cambio de ciencia escrito después de un push
> necesita su propia versión**.

---

## 0 · Por qué la primera corrida se pasó de los 300 segundos

**No fue la conexión.** El pool se cierra en `afterAll` y se cerró: el proceso terminó con código 0, y el
`console.log` alcanzó a imprimir. **Fue el trabajo**: 492 consultas recomputadas **de una en una** contra un
Postgres remoto, y cada `simularConCienciaDeHoy` son varias consultas de ida y vuelta. A unos 0,6 s por
consulta sale justo en los 300 s, y por eso imprimió y falló casi en el mismo instante.

**Arreglado, con tres cosas:**

| | |
|---|---|
| **Lotes de ocho en paralelo** | El pool de `postgres-js` abre hasta diez conexiones. En local baja de 8,8 s a 3,4 s; contra la nube es donde se nota |
| **Latido de progreso** cada diez lotes | No es adorno: sin él, una corrida lenta no se distingue de un cuelgue, que es exactamente lo que pasó |
| **Timeout de 30 minutos** | Acorde al trabajo, en vez de a lo que tardaba antes |

---

## 1 · Lo que no cuadraba con la corrida local

### a) 282 de 492 no se pueden recalcular, y antes no se decía por qué

**El hueco era real y era mío.** `simularConCienciaDeHoy` devuelve `null` y **se traga el motivo a
propósito** (su consumidor es un aviso informativo y un fallo no puede tumbar la página de una evaluación
vieja). Para la simulación eso no alcanza: 282 sin causa no es un dato, es un agujero.

**Ya lo dice.** Cada `null` se re-deriva paso a paso, en el mismo orden y con las mismas piezas (no se
duplica el motor; lo único que se añade es mirar dónde se cae), y se agrupa por causa:

- no hay modelo activo (sería global, no de la consulta);
- el lector de insumos no devuelve nada;
- **sin medición de bioimpedancia vigente**;
- **el motor no corre**, y entonces con el mensaje de `ClinicalInputError`, que dice *qué* insumo falta o
  está fuera de rango.

En local las 16 son todas la misma: `expectedFieldKeys` vacío, o sea **encuestas anteriores a que el
instrumento declarara sus claves**. En la nube la mezcla será otra, y la nueva corrida la imprime.

**Y una aserción nueva que lo sostiene:** la suma de las causas tiene que ser igual al número de consultas
sin recálculo. Una causa que no se encuentre ya no se pierde en silencio.

**Qué ve el profesional en esas 282 después del recálculo** (esto no hay que medirlo, está en el código):

| | |
|---|---|
| ¿Siguen con el DFI viejo? | **Sí, y es lo correcto.** El snapshot sellado no se reescribe nunca. Ve exactamente el diagnóstico que se emitió, con su pie de versiones |
| ¿Quedan marcadas? | Ve el aviso **gris** *"Emitido con una versión anterior del modelo"*, con la procedencia (con qué se emitió y qué rige hoy). En tono neutro a propósito: marcar no invalida |
| ¿Les sale "reemisión obligatoria"? | **No**, y también es correcto: cuando no se puede recomputar, `veredictoDeReemision` cae a "solo marcar" en vez de afirmar que hay que reemitir algo que no pudo comparar |
| ¿Se comparan con las nuevas? | **No.** `sonComparables` compara la versión MAYOR, así que un sello 1.x o 2.x contra una consulta nueva 3.x no se resta. El profesional ve el aviso de que *"el paciente no verá el cambio de su evaluación: la medición anterior se calculó con otra versión del motor"* |

### b) El freno: eran 70, la simulación decía 28, y la diferencia es la cifra que importa

**El error era de sitio, no de criterio.** `frenadasHoy` se contaba **dentro** del bucle de recálculo,
después de descartar las que no se pueden recomputar. O sea que medía *"frenadas **y** recomputables"* con
el rótulo de *"frenadas"*. Ya se cuenta en su propia fase, antes: el estado de hoy sale del snapshot sellado
y no necesita recomputar nada.

**Y al cruzar las dos listas aparece lo que no estaba: `frenadasQueElRecalculoNoPuedeTocar`.** Con las
cifras de la corrida vieja son **70 − 28 = unas 42 consultas** que están frenadas **y** no se pueden
recalcular. La cifra exacta la da la corrida nueva.

> **Esas se quedarían frenadas para siempre, y hay algo peor: el mensaje del freno les miente.** Hoy dice
> *"Se habilita cuando terminemos el ajuste del cálculo, que ya está en marcha: no tienes que pedir nada."*
> Para esas 42 **eso no va a pasar nunca**, porque su consulta no se puede recalcular.
>
> **La salida, y sale de una regla que ya tenemos escrita** (*"un freno sin salida no es un guard: detiene a
> una persona"*): el mensaje tiene que distinguir los dos casos. Para las recalculables, lo que dice hoy.
> Para las otras: que la lectura de envejecimiento **de esa consulta** no se puede reconciliar, que la hoja
> del plan sí se entrega, y que la cifra llega con la próxima medición.
>
> **No lo construí**, por dos razones: la cifra exacta sale de tu corrida, y qué se le dice al profesional
> es una decisión, no una implementación. Es lo primero que haría en cuanto me pases el JSON.

### c) Mi conclusión local estaba equivocada, y la retiro

Escribí *"cinco consultas dejan de estar aceleradas y **ninguna pasa a estarlo**"*. **En la nube son 19 las
que pasan a acelerado**, y la R4 entra en 19. Lo que dije valía para los datos sembrados y no para los
reales, que es exactamente el error contra el que el propio documento advierte (*"manda la nube"*) y lo
cometí igual.

**Lo correcto, con las cifras de la nube:**

| | |
|---|---|
| Dejan de estar aceleradas | **35** (sale la R4 en 35) |
| **Pasan a estar aceleradas** | **19** (entra la R4 en 19) |
| Sin cambio | 156 |
| Rutas que cambian | **55** · entran R4 ×19, R6 ×17, R5 ×1 · salen R4 ×35, R6 ×2, R5 ×1 |

**Los 19 son los que estrenan una sugerencia de tratamiento**, así que la simulación ahora imprime **sus
ids**: sin eso no se puede abrir uno en el navegador, que es lo que pediste.

### d) Las dos que no se destrababan tenían el IAE en +5,0 exacto, y era Atlas contradiciéndose

**No era un dato raro: eran cuatro lectores con dos cortes.**

| Lector | Corte | En +5,0 decía |
|---|---|---|
| `presentacion-eb-bis.ts` (lo que lee el **paciente**) | `>= 5` | "envejecimiento acelerado estimado" |
| `cIAE` del frozen (la **clasificación** del profesional) | `<= 5` | "Acorde con sus pares" |
| condición de la ruta **R4** (lo que se **prescribe**) | `> 5` | no se activa |
| condición de la ruta **R1** | `> 5` | no se activa |

Así que con un IAE de +5,0 el informe le nombraba el problema al paciente, la tabla decía que estaba bien, y
el tratamiento no traía la ruta que trata el envejecimiento. **El freno hacía exactamente su trabajo: lo que
detectaba era real y lo producía Atlas.**

**El corte cerrado es de Gildardo** (su `cIAE` del v16, línea 4568, y sus condiciones de R1 y R4 dicen
`>= 5`). Las tres piezas se re-portaron byte a byte. Con ellas entran sus tres textos de banda, que todavía
no se usan.

**Arreglado y medido, motor 3.2.0.** Sube también `emission_versions.classification` a `cXXX-2026-11-07`,
porque una etiqueta sellada sí se movió: +5,0 pasa de "Concordante" a "Acelerado" y −5,0 a "Desacelerado".
Son **cuatro consultas** en la cohorte (`fdb7e083` y `0eebf4dd` en +5,0 · `58d6ec8a` y `84253510` en −5,0).

El candado (`el-borde-de-los-cinco-dice-lo-mismo.test.ts`) no pincha los cuatro sitios por separado, porque
cada aserción suelta se puede cumplir con el resto roto: **compara las cuatro lecturas entre sí** en −6, −5,
−4,9, 0, 4,9, 5 y 6, que es la forma del defecto.

> **Sigue abierto, y no lo toqué:** el Δ de su línea 15628 sigue con el corte **abierto** en su propio
> archivo, así que en +5,0 su documento se contradice solo (la fila dice "acelerado" y el Δ de al lado dice
> "0,0"). Es su pregunta **36** y la decide él.

### e) El dominio 3 que desaparece: una, y ahora dice por qué

La simulación imprime **su id, su severidad anterior, el estado de la EB-BIS v7 y su motivo**. La causa será
que la v7 no puede calcular en esa consulta (falta la edad, el ACT o el sexo válido), y entonces el dominio
queda **sin puntuar**. **No se cae a la v5 a propósito**: volver a la cifra vieja justo donde nadie va a
mirarla es reintroducir la contradicción en el sitio peor. Ese camino ya existía (antes se daba cuando
faltaba el ICEC) y el frozen lo trata igual.

---

## 2 · Lo que tiene que quedar antes de ejecutar

### Los 55 con rutas que cambian: el tratamiento prescrito no se puede tocar

**No es una convención nuestra, lo impide la base de datos.** El trigger `treatments_immutability`
(migración 0026) lanza excepción ante cualquier intento de cambiar `protocol_approved`, `kcal_objetivo`,
`proteina_g`, los ajustes o `approved_by/at` de un tratamiento en estado `approved`. Y `protocol_suggested`
es **write-once** incluso en borrador. Textual del trigger: *"La prescripción de un protocolo aprobado es
inmutable: se corrige por versión nueva."*

**Y la simulación no escribe nada**, así que ni siquiera llega a intentarlo: `simularConCienciaDeHoy`
recomputa en memoria y no persiste.

**El aviso al profesional existe y dice lo que cambió.** Para los que cambian de banda sale el banner ámbar
*"Reemisión obligatoria: la clasificación de este paciente cambió"*, con la lista `antes → ahora` y con qué
versión se emitió. Para el resto, el aviso gris de procedencia.

**Pero hay un hueco que medí y no tapé, y es tuyo decidirlo.** `veredictoDeReemision` compara
**clasificaciones** (su §12b: *"el criterio es el resultado… cambia de banda"*), **no rutas**. Así que una
consulta cuyas rutas sugeridas cambien sin que cambie ninguna banda cae en "solo marcar": el profesional ve
el aviso gris y **no se entera de que la sugerencia de tratamiento se movió**. La simulación ahora cuenta
exactamente eso (`cambianRutaSinAvisoDeBanda`); en local es 0 y en la nube lo dirá la corrida. **Si no es 0,
es una pregunta para Gildardo**, no un arreglo nuestro: meter las rutas en su obligación sería extender su
regla por nuestra cuenta.

**Y lo que falta probar en el navegador:** abrir uno de los 19 que pasan a acelerado y ver el banner con la
ruta R4 nueva. Los ids los imprime la simulación; el smoke es tuyo, porque es la única verificación que
atrapa lo que ni tsc ni los tests ven.

### Las 91 reemisiones obligatorias: qué significan, y qué NO pasa solo

**Qué significa para el profesional:** al abrir el diagnóstico de esa consulta ve el banner ámbar con las
bandas que cambiaron. El documento emitido **sigue siendo válido** para su fecha y no se reescribe; lo que
hay es una acción pendiente suya.

**Nada sale al paciente por sí solo, y esto está verificado en el código, no supuesto.** El envío solo se
alcanza por `sendReportAction` / `resendReportAction`, que son server actions invocadas desde el botón de
`report-card.tsx`. **No hay cron, ni trabajo en segundo plano, ni bus** que mande un informe. La reemisión
tampoco envía: produce un documento nuevo que sigue esperando que alguien pulse enviar.

### La simulación corregida

Los tres defectos del punto 0 y los cinco del punto 1 están resueltos. **Falta tu corrida.**

```powershell
$env:DATABASE_URL = "<la cadena de conexión de producción>"
npx vitest run --project db --reporter=verbose src/tests/simulacion-del-recalculo-db.test.ts
```

**Las cinco cifras que hay que mirar antes de autorizar:**

1. `freno.frenadasNuevas` **tiene que ser 0.** Con el borde ya cerrado no puede haber contradicción nueva;
   si aparece una, el recálculo **no se ejecuta** hasta entender por qué.
2. `freno.frenadasQueElRecalculoNoPuedeTocar`: las que se quedan frenadas para siempre si no se les da
   salida. Es lo que decide si hay que cambiar el mensaje del freno antes de ejecutar.
3. `noRecomputables.porCausa`: si alguna causa es un defecto nuestro y no un dato que falta, se arregla
   antes, porque recalcular con un lector roto deja a esos pacientes fuera sin que se note.
4. `bordeDeLos5.losQueElCorteABIERTOdejabaFuera`: cuántos pacientes gana el corte cerrado.
5. `rutas.cambianRutaSinAvisoDeBanda`: si no es 0, la pregunta a Gildardo entra antes de ejecutar.

**Mientras tanto no hay nada que deshacer:** el motor está cambiado, versionado y verde, y **nada se ha
ejecutado**. Lo único que está en producción es el motor nuevo calculando **consultas nuevas**, que es el
arreglo; el histórico sigue intacto en sus snapshots.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
