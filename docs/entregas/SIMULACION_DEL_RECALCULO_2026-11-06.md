# El recálculo del motor 3.x · la corrida definitiva, y la decisión que falta

**Connected Nutrition Ventures · Atlas · 6 de noviembre de 2026**
**Reescrito el 7 con la corrida definitiva contra la nube** (09:35, **174 s**, en verde)
**Para:** Santiago · **Estado:** **las cinco cifras que autorizan salen bien. NADA se ha ejecutado.**

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

## 0 · Las cinco cifras que tenían que salir, y salieron

| Cifra | Qué significaba si no salía | Corrida del 7 |
|---|---|---|
| `frenadasNuevas` | Una consulta que hoy se puede entregar y después **no**. Si no es 0, el recálculo no se ejecuta | **0** |
| `seDestraban` | Cuántos informes frenados quedan entregables | **70 de 70** |
| `frenadasQueElRecalculoNoPuedeTocar` | Frenadas para siempre, sin salida | **0** |
| `cambianRutaSinAvisoDeBanda` | Consultas cuyo tratamiento sugerido se mueve **sin** que el profesional lo vea | **0** |
| `losQueElCorteABIERTOdejabaFuera` | Pacientes que el borde abierto dejaba sin la ruta que su propia banda nombra | **2**, los dos que el corte cerrado recupera |

Y la sexta, que es la que cambió de forma: **14 consultas no se pueden recalcular**, todas por la misma
causa (sin fecha de nacimiento). Ayer eran 282, y eso resultó ser un artefacto de la propia prueba.

**Lo que se mueve en las 478 que sí se recalculan:** el ICEC en 272, el dominio 3 en 172, las rutas en 106,
el nivel de riesgo integrado en 38, el dominio 5 en 9. Pasan a envejecimiento acelerado 47 y dejan de
estarlo 56. En 189 cambia alguna banda, y por su §12b esas son las que obligan a reemitir.

---

## 1a · Por qué ayer eran 282 y hoy son 14

**No fue el conteo, ni los datos, ni un arreglo intermedio: fue el timeout.** Lo verifiqué antes de
escribirlo, porque la respuesta cómoda (*"lo arreglé en el medio"*) habría sido falsa: entre las dos
corridas el `git diff` no toca **ninguna** pieza del camino de recómputo. Cambiaron el borde del motor, el
freno y la propia prueba; los lectores de insumos y el armado del input están idénticos.

**Lo que pasó, paso a paso.** Al cumplirse los 300 s, vitest falla la prueba y corre el `afterAll`, que
**cierra el pool** de conexiones. Pero la función de la prueba sigue viva (es una promesa suelta, y
JavaScript no se interrumpe a la mitad). Desde ese instante **toda** consulta a la base falla,
`simularConCienciaDeHoy` se traga el error por diseño y devuelve `null`, así que las consultas que faltaban
se marcaron "no recomputables" de golpe. Por eso el bucle terminó rápido y el JSON completo apareció justo
**después** del fallo.

**Y cuadra con tres cuentas independientes:**

| | Corrida de ayer | Corrida de hoy | Proporción |
|---|---|---|---|
| Consultas recomputadas | 210 | 478 | **×2,28** |
| Pasan a acelerado | 19 | 47 | ×2,47 |
| Rutas que cambian | 55 | 106 | ×1,93 |
| Reemisión obligatoria | 91 | 189 | ×2,08 |

210 + 282 = 492 exacto, y todas las cifras de movimiento de ayer escalan más o menos por la misma
proporción (no exacto, porque qué 210 alcanzaron a medirse dependió del orden). **Y explica también el
`frenadasHoy = 28`:** ese error era de sitio (se contaba dentro del bucle de recómputo, o sea sólo sobre las
recomputables), y 70 × 0,43 ≈ 30. Los dos números raros de ayer eran **el mismo artefacto**.

> **La lección, y vale más que el arreglo:** una medición que agota su timeout no da un resultado parcial,
> da un resultado **falso**, y encima creíble. Ayer esas cifras se leían perfectamente bien.

---

## 1b · Qué hace exactamente la ejecución desde `/admin/recalibración`

### No es un botón que reemita 478 de una vez

| | |
|---|---|
| **Quién puede** | `admin` y `direccion`. **No** un profesional: reemitir el histórico de otros por un cambio de versión no es un acto de consulta (policy `can-reemit-diagnosis`) |
| **Cómo** | Seleccionas filas a mano, o "elegir las primeras 50". **Tope de 50 por tanda**, y lo dice el botón |
| **En qué orden** | En serie, cada reemisión su propia transacción. Un fallo a la mitad deja un tramo revisable, no un estado difuso sobre 478 registros |
| **Repetible** | Una fila ya al día se reporta "saltada", no "hecha". Volver a correr no duplica nada |

### La pantalla ofrece MENOS de 478, y esa es la cifra que decide el tamaño del trabajo

`recomputables: 478` es *"a cuántas puede correrles el motor"*. La pantalla además excluye, con el motivo
escrito en la fila y sin casilla que marcar:

- las de **huella repetida** (hay que resolver a quién pertenece la medición antes de recalcular),
- las de **edad fuera de 18 a 100** al medirse (la EB-BIS v7 no se calibró ahí),
- las **14 sin fecha de nacimiento**,
- y los **pacientes de prueba**, que se cuentan aparte y no se reemiten.

Esa cifra está en la pantalla hoy mismo (los tres grupos suman el total), y desde esta ronda la
**simulación también la dice** (`laPantalla.entran`), con la **misma función** que usa la pantalla. Antes la
simulación decidía por su cuenta quién entraba: medía un conjunto y la pantalla ofrecía otro, y la
diferencia no se habría visto.

### Qué escribe cada reemisión, y qué no toca

| Escribe | No toca |
|---|---|
| Una fila nueva en `diagnoses`, con la constelación completa de versiones y **firmada por quien ejecuta** (no se hereda la firma del profesional que atendió en agosto) | El diagnóstico sellado: sigue entero, con su versión y su firma |
| Una fila nueva en `reports` **en borrador**, con el snapshot nuevo | El informe **enviado**: es una fila anterior, con su `sent_at` y su PDF en Storage |
| El rastro `diagnosis.reemitted` inline en la transacción, con las dos versiones y qué no se modificó | **La prescripción.** `treatments.diagnosis_id` sigue apuntando al diagnóstico anterior, a propósito |
| | La banda sellada de trayectoria, que se **copia** del informe anterior para que el freno del cambio desfavorable siga aplicando |

**Nada sale al paciente.** El informe nuevo nace en borrador y el envío es un botón del profesional
(`sendReport` sólo se alcanza desde `sendReportAction` / `resendReportAction`, invocadas desde
`report-card.tsx`: **no hay cron, ni trabajo en segundo plano, ni bus** que mande un informe). La reemisión
tampoco envía: produce un documento nuevo que sigue esperando que alguien pulse enviar.

### Los 189 avisos ámbar: desaparecen en las reemitidas, y se quedan en las demás

El aviso **no lo crea la ejecución**: se computa al leer, así que cualquier profesional que abra una de esas
consultas **ya lo está viendo hoy**. Al reemitir, lo sellado coincide con lo vigente, el aviso ámbar
desaparece y en su lugar queda la nota gris *"Reemitido el … por recalibración científica (motor 2.0.0 a
3.2.0)"*, con las cifras del documento anterior plegadas y la frase de que la prescripción y el informe
enviado no se modificaron. En las que la pantalla no puede ofrecer, **el aviso ámbar se queda**, y su salida
es resolver lo que lo bloquea (punto 3).

### Qué ve el profesional, antes y después

| Caso | Hoy | Después de ejecutar |
|---|---|---|
| **Una de las 70 frenadas** | El informe y la HC **no se pueden entregar**: *"Este documento se contradice… Se habilita cuando terminemos el ajuste del cálculo"*. La hoja del plan sí se entrega | Las dos hojas se entregan. El aviso de contradicción desaparece porque las dos lecturas salen del mismo cálculo |
| **Una de las 106 con rutas que cambian** | El aviso ámbar de reemisión obligatoria, o el gris de procedencia. El tratamiento, como lo aprobó | La nota gris de reemitido. El diagnóstico nuevo **sugiere** otra ruta; **la prescripción aprobada sigue intacta** |
| **Una de las 14 sin fecha** | El aviso ámbar o gris, y en la pantalla de recalibración la fila **con su motivo y sin casilla** | Igual que hoy. Sigue sellada con su versión anterior hasta que se registre la fecha |

---

## 1c · Qué tiene que hacer cada profesional

**Casi ninguna, nada.** Lo que cambia es lo que ve al abrir una consulta vieja, y en tres casos hay algo que
hacer:

1. **Las que se destraban (70):** ya puede entregar el informe y la historia clínica que el freno retenía.
   Es la única acción que estaba bloqueada y se desbloquea.
2. **Las de reemisión obligatoria (189):** abrir, mirar qué banda cambió (el aviso lo nombra, antes y
   después) y decidir si le manda al paciente el informe nuevo. **La decisión y el envío son suyos.**
3. **Las de ruta nueva (106):** mirar la sugerencia del diagnóstico nuevo. **No tiene que rehacer nada:** su
   prescripción no se tocó, y el motor propone, el profesional dispone.

**Lo que NO tiene que hacer:** recalcular a mano, pedir nada, ni revisar las 478.

**El reparto por profesional no está en este JSON, y lo añadí para la próxima corrida.** La simulación ahora
imprime `quienTieneQueMirar` (reemisión obligatoria, rutas que cambian e informes que se destraban, por
profesional), `laPantalla.porProfesional`, `freno.frenadasHoyPorProfesional` y
`noRecomputables.porProfesional`, todo con **ocho caracteres** del id y sin nombres, más una línea aparte
con el directorio de ocho caracteres a nombre que **no va a git**. Son 174 segundos más de corrida.

---

## 2 · Los 106 con rutas que cambian: la prescripción no se toca

**Corrijo una cosa que escribí en la ronda anterior.** Dije que una prescripción aprobada es *"inmutable a
nivel de base (trigger de la 0026)"*. Eso **dejó de ser cierto el 9 de septiembre**: la migración 0116
retiró la rama del congelado (y la de la reapertura con motivo) porque la prescripción pasó a estar
**siempre abierta** y lo que conserva lo entregado es la copia de cada emisión, no que nadie edite. Lo que
sí sigue en pie del trigger: **`protocol_suggested` es write-once** (es la salida del motor, regla dura 7)
y **no se borra** un protocolo que ya salió hacia un paciente.

**Lo que de verdad protege la prescripción en el recálculo es que la reemisión no la toca.** No escribe en
`treatments`, y eso es lo que está con candado.

**Y tiene una consecuencia que hay que decir:** como `protocol_suggested` es write-once, la **sugerencia
sellada del motor** (incluida la de nutracéuticos) sigue siendo la que se calculó con la cifra anterior, y
no se reescribe. Queda como registro de lo que se sugirió ese día. Si la profesional quiere que la
prescripción refleje el diagnóstico nuevo, la ajusta y la guarda: está abierta. Eso es lo que dice el aviso
nuevo de Tratamiento.

**Y la reemisión no lo intenta siquiera:** no toca `treatments`, y el `diagnosis_id` del tratamiento sigue
apuntando al diagnóstico anterior a propósito. De ahí se **deriva** la marca de "este tratamiento está
apoyado en una cifra que ya no es la vigente", sin columna que acordarse de apagar.

**El aviso al profesional existe y dice lo que cambió:** banner ámbar *"Reemisión obligatoria: la
clasificación de este paciente cambió"*, con la lista `antes → ahora` y con qué versión se emitió. Para el
resto, el aviso gris de procedencia.

**Y el hueco que había medido queda cerrado por la propia corrida.** `veredictoDeReemision` compara
**clasificaciones** y no rutas (su §12b: *"el criterio es el resultado… cambia de banda"*), así que una
consulta cuyas rutas se movieran sin cambiar ninguna banda caería en "solo marcar" y el profesional no se
enteraría. En la nube `cambianRutaSinAvisoDeBanda` es **0**: las 106 que cambian de ruta cambian también de
banda, así que todas disparan el aviso. **No hay nada que preguntarle a Gildardo por esto.**

**Lo que falta, y es tuyo:** abrir en el navegador una de las 47 que pasan a acelerado y ver el banner con
la ruta R4 nueva. Los ids están en `envejecimiento.pasaAAcelerado.cuales`. El smoke humano es la única
verificación que atrapa lo que ni tsc ni los tests ven.

> **Y lo atrapó.** Al abrir `ed83ff97` después de ejecutar, Tratamiento decía **"0 rutas activas"** con un
> diagnóstico de riesgo CRÍTICO. La causa no era el `diagnosis_id` del tratamiento: el snapshot de la
> reemisión se escribía **sin las tres capas que el pipeline congela** (`rutasContent`, `efrContent`,
> `validityCaveats`), y los lectores las toman con `?? []`, así que nada falló y cinco superficies
> quedaron vacías. Arreglado el servicio, con candado, y hay una reparación para los 424 informes que ya
> se escribieron: el bloque de arriba de `/admin/recalibración`. No cambia ninguna cifra.

---

## 3 · Las 14 sin fecha de nacimiento

**Una sola causa, y es la única de las 492:** `computeAge: fecha de nacimiento invalida, llego: null`. El
motor falla en voz alta a propósito desde el 24 de octubre (antes una fecha ausente se volvía edad cero, que
es un diagnóstico sobre un dato inventado).

**La lista por profesional sale en la próxima corrida.** Este JSON trae **5 de los 14** ids: el campo se
llamaba `ejemplos` y cortaba a cinco. Ya está cambiado: ahora imprime los 14 completos, con el profesional
de cada uno en ocho caracteres. El detalle con nombres va a `docs/entregas/dudas/`, que está fuera de git.

**Y sí: al registrar la fecha se pueden reemitir por el flujo normal.** Verificado en el código, no
supuesto:

1. El profesional (o un admin) completa la fecha en la ficha del paciente. Esa pantalla existe desde el 24
   de octubre, justo como salida de este hueco, y **solo rellena**: si ya hubiera fecha, no la cambia.
2. Con la fecha puesta, la fila deja de estar excluida en `/admin/recalibración` y se puede seleccionar.
3. La reemisión la sigue ejecutando `admin` o `direccion`, no el profesional.

Lo que **no** pasa solo: registrar la fecha no cambia el diagnóstico ya sellado. Hace falta la reemisión.

---

## 4 · Los 5 del dominio 3 que desaparece

**No son las 14.** Su fecha **sí** se lee: si no, el motor no habría corrido y estarían en el otro grupo.
Así que su edad **a la fecha de la medición** cae fuera de 18 a 100, y ahí el frozen de la v7 devuelve
`pendiente: edad no válida` y el dominio 3 no puntúa. `b3e367cc` es de prueba (ya lo sabíamos: es parte de
la pregunta 30 de PENDIENTES).

**Si son menores o mayores de 100 lo dice la próxima corrida**, no este JSON: `motivo` sólo decía "edad no
válida". Ya imprime `edadAlMedirse` y, al lado, `laPantallaLaOfrece`.

**Y buscándolo encontré un defecto nuestro, que arreglé.** La exclusión de la pantalla miraba **un solo
lado** del rango: excluía a los menores de 18 y **no** a los mayores de 100. O sea que una consulta de más
de 100 años se habría ofrecido para reemitir, y habría vuelto con la EB-BIS en "pendiente" y el dominio 3 en
blanco, que es exactamente lo que esa exclusión existe para impedir. Ahora el corte es el del frozen **por
los dos lados** (`edad < 18 || edad > 100`, leído de su archivo y no escrito por nosotros), con su candado.

**Consecuencia para tu decisión:** sean menores o mayores de 100, la pantalla **no las va a ofrecer**, así
que la desaparición del dominio 3 no llega a ningún profesional. La próxima corrida lo confirma fila por
fila con `laPantallaLaOfrece`.

**Qué vería el profesional si alguna pasara:** la tarjeta del dominio Envejecimiento con la etiqueta neutra
**"Sin dato"** (nunca un verde, que se leería como óptimo), el eje del radar rotulado "sin dato" y sin
vértice, y el motivo en el bloque de la EB-BIS de la misma pantalla: *"EB-BIS pendiente: edad no válida"*.
La tarjeta del dominio no repite el motivo; está una pantalla más arriba.

---

## 5 · Lo que sigue abierto, y lo decide Gildardo

**La pregunta 36 creció, y es del mismo borde.** Su v16 cerró el corte de la banda y de las rutas
(`iae >= 5`) pero dejó **abierto** el de la sugerencia del nutracéutico y el del protocolo de telómeros
(`iae > 5`). Así que con un IAE de **exactamente +5,0** su archivo llama al paciente acelerado, activa la
ruta R4 y **no** sugiere la Coenzima Q10. En Atlas está portado byte a byte, así que hace lo mismo. Hoy son
**dos consultas reales**. Está en PENDIENTES con sus opciones y nuestra recomendación.

---

## Cómo correrla otra vez

```powershell
$env:DATABASE_URL = "<la cadena de conexión de producción>"
pnpm vitest run --project db src/tests/simulacion-del-recalculo-db.test.ts
```

**Tarda unos 3 minutos** y el timeout es de 30. Imprime con el prefijo `SIMULACION_300`, y desde esta ronda
por `process.stdout.write` y no por `console.log`: vitest intercepta la consola y, según cómo se corra, la
salida de una prueba que **pasa** no aparece. Una corrida de tres minutos que termina en verde y no imprime
nada obliga a repetirla.

**Qué leer primero:** las cinco cifras del punto 0, y después `laPantalla.entran`, que es cuántas vas a
poder seleccionar de verdad. Si `frenadasNuevas` no es 0, el recálculo **no se ejecuta**.

**Mientras tanto no hay nada que deshacer:** el motor está cambiado, versionado y verde, y **nada se ha
ejecutado**. Lo único que está en producción es el motor nuevo calculando **consultas nuevas**, que es el
arreglo; el histórico sigue intacto en sus snapshots. **Y nada de esto ejecuta un recálculo por sí solo:**
la simulación es de solo lectura, los avisos se computan al leer sin escribir nada, y la reemisión sólo
ocurre pulsando el botón de esa pantalla.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
