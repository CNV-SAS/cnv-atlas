# EB-BIS v7: las siete respuestas antes de construir

**Fecha:** 2026-10-24 · **Para:** Santiago · **Documento de Gildardo:** `EB_BIS_v7_Especificacion_ATLAS_CNV_2026-10-24.docx`
**Estado:** INFORME. **La función v7 no está construida.** Lo único que se construyó en esta entrega es
`computeAge`, que él decidió por su lado (§4 de este documento).

> **Este documento no identifica a ningún paciente.** Los casos van por el id de evaluación que él mismo usó
> en su anexo A, abreviado a ocho caracteres.

---

## 0 · Lo primero, porque cambia el orden de todo lo demás

**Sus errores 1 y 2 no son errores del motor ni del export: son dos pacientes compartiendo una medición, y
hay más de los que él encontró.** Los verifiqué uno por uno contra producción y después barrí la base entera
buscando la misma forma.

| | él encontró | hay de verdad |
|---|---|---|
| Mediciones repartidas entre **pacientes distintos** (su error 1) | 4 pares | **5 grupos** (uno de ellos con **tres** evaluaciones, no dos) |
| Mediciones repetidas **dentro del mismo paciente** (su error 2) | 6 | **6** (coincide exacto) |
| **Total de grupos con los crudos idénticos** | 10 | **11** |

**Y son idénticos de verdad, no parecidos.** Comparé Re, Ri, Rinf, C, peso y talla de cada par: coinciden
hasta el último decimal. No es que dos personas se midieran el mismo día; es la misma medición en dos sitios.

**La columna `Edad` del equipo dice de quién es la medición**, y es el dato que lo cierra:

| grupo | edad del equipo | a quién le cuadra |
|---|---|---|
| `4118e694` / `36aba016` | 43,513 | a **4118e694** (43 años). La otra tiene 46. |
| `6b82f54e` / `fb29a4e8` | 30,177 | a **6b82f54e** (30 años). La otra tiene 38. |
| `8ddc1244` / `baf15441` | 58,598 | a **8ddc1244** (58 años). La otra no tiene fecha de nacimiento. |
| `5441fd96` / `b3e367cc` / `6256b921` | 29,873 | **a ninguno de los tres** (22, 9 y 22 años). |
| `e3599e84` / `0c6f8ad4` | 41,878 | a **0c6f8ad4** (41 años). La otra tiene 39. |

El último grupo (`e3599e84` / `0c6f8ad4`) **no está en su anexo**: es el que le faltó. Son dos pacientes
distintos, los dos del 13 de octubre, con la medición importada cinco minutos después una de la otra.

**Cómo pasó, que es lo que usted pidió averiguar.** Dos mecanismos, no uno:

1. **El lote del HTML volvió a importar mediciones que ya existían en Atlas.** De las 23 evaluaciones
   implicadas, **13 llevan el lote `d9482d6b`** y 10 son nativas. En tres de los cinco grupos de pacientes
   distintos, una copia es nativa y la otra del lote. Y en dos de los seis casos del mismo paciente, **las
   dos copias son del lote**, creadas con dos minutos de diferencia: el lote se duplicó a sí mismo.
2. **Nada impide importar el mismo archivo dos veces, ni importarlo al paciente equivocado.** El grupo de
   las tres evaluaciones se creó en **ocho segundos** (01:06:51 y 01:06:59 del 16 de octubre), y el grupo
   que a él le faltó, en cinco minutos. Eso no es un lote: es la pantalla de importar usada dos veces.

**Por qué esto va primero.** Su sección 5 pide recalcular todo el histórico con la v7 *después* de corregir
los errores 1 a 6. Si se recalcula antes, se recalculan **23 evaluaciones cuyos datos crudos no son del
paciente al que están colgados**, y el resultado sería tan falso como el actual, solo que con más decimales.

---

## 1 · (a) Dónde vive la v7, y si sube la versión del motor

**Dónde vive: en el frozen, como un archivo nuevo, verbatim.** Su `ebBisV7.js` es una función completa con
su objeto de parámetros, así que no hace falta adaptarla: entra como `src/clinical-engine/frozen/eb-bis-v7.js`
con su encabezado de copyright intacto, igual que los demás archivos suyos. La `computeEBBIS` de hoy
(`frozen/engine.indices.js`, la v5 con el intercepto de 41,438) **no se borra**: queda como la ciencia con la
que se sellaron los diagnósticos anteriores, que es lo que permite explicarlos dentro de un año.

**"Parámetros en configuración versionada": su objeto YA lo cumple, y una tabla de base de datos NO.** Esto
vale la pena decirlo con precisión, porque las dos lecturas suenan igual:

- **Su `EB_BIS_V7` con `version: '7.0.0'` es exactamente lo que pide** y no choca con nada: está fuera de la
  lógica de pantalla, tiene su propio número de versión, y ese número se persiste con cada resultado.
- **Lo que sí chocaría es una tabla editable en caliente.** Si un parámetro se pudiera cambiar desde una
  pantalla, dos diagnósticos sellados con el mismo `engine_version` podrían haber salido de números
  distintos, y eso rompe la regla dura 7 (la constelación de versiones dice *con qué se calculó*). El sello
  dejaría de significar nada.

Lo que sí hay que añadir es **persistir `versionParametros`** junto al resultado, como él pide en su §5. Hoy
se sella `engine_version`, `model_version_id`, `rules_version` y `survey_version_id`; el de parámetros es un
campo nuevo.

**La versión del motor: sube a `2.0.0`, no a `1.1.0`.** No es una opinión mía: el criterio está escrito en
`docs/VERSIONES.md` desde el 9 de septiembre y lo decidimos entonces.

> *"Mayor = la ciencia cambia y lo emitido antes no es comparable; menor = cambia lo que el motor PUEDE
> devolver; parche = corrección que no mueve ninguna cifra emitida."*

Una EB-BIS v5 y una v7 **no son comparables**: entradas distintas (la v5 usa IFC, PABU e ICEC; la v7 usa Re,
Ri, C, peso, MLG, ACT, FMI), el ICEC sale del cálculo, y la escala del IAE pasa a ser 5 años por desviación
con tope de ±15. Es el caso de "mayor" tal como está definido.

**Y una consecuencia de software que hay que resolver en la misma entrega:** la trayectoria de la EB-BIS
(`modules/followups/services/eb-trajectory.ts`) compara la EB de esta medición contra la de la anterior y le
dice al **paciente** "mejoró", "sin cambio" o "empeoró". **Hoy no mira `engine_version`.** Si un paciente
tiene una EB v5 de septiembre y una v7 de noviembre, la banda se calcularía entre dos escalas distintas y el
texto saldría igual de convincente. O se recalcula el histórico antes de emitir cualquier informe v7 (que es
lo que él pide), o la banda se niega a comparar entre versiones. Lo primero es su instrucción; lo segundo
hace falta de todos modos, porque la próxima versión traerá el mismo problema.

---

## 2 · (b) El nombre IRC: es el mismo índice, y encaja

**No hay dos índices con un nombre. Es literalmente la misma fórmula.**

| | |
|---|---|
| La v7, §3.2 | `IRC = (Re / (Ri × C)) × 10` |
| Atlas hoy, `frozen/engine.core.js:23` | `const calcIRC = (Re, Ri, C) => Ri * C === 0 ? 0 : (Re / (Ri * C)) * 10;` |

Y el cotejo de calibración sale solo: las medias por sexo de su tabla 2 caen **dentro de las bandas normales
de su propio artículo del IRC**, el que ya alimenta el clasificador de Atlas:

| | media de la v7 | banda "Normal" de Atlas (Artículo_IRC_vs_IR, Tabla 3, cohorte 6.063) |
|---|---|---|
| Mujeres | 2,6054 | 2,3 a 2,8 |
| Hombres | 1,9520 | 1,7 a 2,1 |

Las dos medias caen en el centro de su banda. Es el mismo índice, con la misma escala, calibrado sobre otra
cohorte (`BD_UNICA_BXZMIII`, n = 6.001) y llega al mismo sitio. **Eso es una buena señal sobre la v7**, y
conviene decírselo: dos cohortes distintas, el mismo centro.

Un detalle del port que ya nos costó una vez y hay que no repetir: **el ×10 va DENTRO de `calcIRC`**. El
16,222 que le reportamos en agosto salió de una tabla que multiplicaba lo ya multiplicado.

---

## 3 · (c) Los errores 1 y 2, con su veredicto

**Error 1 · CONFIRMADO, y es más grave de lo que dice.** Es un dato de salud de una persona en la historia de
otra, y de ahí salió el diagnóstico que esa otra persona recibió. Ya está en §0: cinco grupos, 11 en total
con el error 2, y la columna `Edad` del equipo señala al dueño en cuatro de los cinco.

**Error 2 · CONFIRMADO, y NO es lo que yo sospechaba.** Mi hipótesis era que el CSV no filtraba las
reemplazadas por el flujo de corrección. **Es falsa, y lo verifiqué de dos maneras:** el script sí filtra
`superseded_at` y `retirada_at` (líneas 208-211), y ninguna de las seis evaluaciones tiene correción alguna
(`clinical_corrections` no las menciona). Lo que hay es real: para el mismo paciente, una evaluación
`inicial` y una `seguimiento`, con **dos filas de medición distintas** (ids distintos), la misma fecha y los
crudos idénticos. Un seguimiento que reusa la medición de la inicial no mide nada nuevo: dice que el
paciente no cambió porque es el mismo dato.

**El freno que hay que poner, y por qué no es el que él pide.** Su corrección dice *"impedir que una medición
se asocie a más de una evaluación inicial"*. Eso, tal cual, no se puede: en el esquema de Atlas
`bis_measurements.evaluation_id` es una sola columna, así que una fila de medición ya pertenece a una sola
evaluación. **Lo que de verdad pasa es que el MISMO archivo del equipo se importa dos veces y produce dos
filas.** Así que el freno tiene que mirar el CONTENIDO, no la relación:

1. **Al importar, rechazar un archivo cuyos crudos ya existen en la base** (misma fecha de medición y mismos
   Re/Ri/Rinf/C), diciendo a qué paciente y a qué evaluación están colgados. Eso atrapa los dos mecanismos
   de §0: la re-importación y el paciente equivocado.
2. **Y decir el nombre del paciente al que ya pertenece**, porque el caso útil no es "ya existe" sino "este
   archivo es de otra persona". Es lo que convierte el freno en algo que el profesional puede resolver.

**Esto sí es nuestra capa (el importador), no su motor.** Lo dimensiono y lo construyo cuando usted diga; no
va en esta entrega porque §0 cambió el alcance.

---

## 4 · (d) Errores 3, 4, 6 y 7: computeAge. **CONSTRUIDO**

Gildardo decidió, usted me dijo "construyelo", y está construido. Esto es lo que hace y lo que no.

### Lo que se construyó

| | |
|---|---|
| `computeAge` ante una fecha ausente, ilegible o imposible | **lanza**, ya no devuelve 0 |
| `edadParaDiagnosticar` | la **puerta** que lo traduce a una frase con salida, antes de llegar al motor |
| Dónde se mira | en `run-pipeline.ts` (la **sexta** puerta) **y** en `correct-evaluation.ts`, los dos caminos al motor |
| La edad | **a la fecha de la medición**, no a la de hoy |
| El redondeo | **truncado**, años cumplidos |
| El cinturón | **0 a 130 años**, solo lo imposible |
| La salida | **"Completar la fecha de nacimiento"** en la ficha del paciente, solo cuando falta |

**Toca solo nuestra capa.** `computeAge` vive en `modules/clinical-pipeline/services/build-engine-input.ts`,
que es un módulo de la aplicación. No se tocó un decimal de `src/clinical-engine/`.

**Y no hubo que inventar el diseño, porque la conducta correcta ya estaba escrita dos veces en casa:**
`normalizeSex`, veinte líneas más abajo en el mismo archivo, falla en voz alta por el mismo riesgo; y
`computeAgeYears` del consentimiento (`modules/consent/validations.ts`) ya **rechaza** una fecha que no sea
`YYYY-MM-DD` exacto, que es por lo que la rama de menor de edad nunca se calculó con un año de cinco dígitos.
La nueva `edadSiSePuede` **usa esa misma función**, no una copia: una segunda definición de "edad" es como se
llega a que el mismo paciente tenga dos edades según quién pregunte.

### (d) El redondeo: no sale de Atlas. Atlas ya truncaba

Su error 6 dice *"el motor redondea la edad hacia arriba (30,95 pasa a 31) y ATLAS la trunca (30)"*, y usted
preguntó de dónde sale, porque yo había dicho que `computeAge` truncaba. **Truncaba y trunca. El que redondea
es la columna `Edad` del equipo, que es decimal.** Medido sobre la cohorte entera:

| | evaluaciones |
|---|---|
| Con edad derivable de la fecha de nacimiento | **361** |
| El decimal del equipo y la edad de Atlas coinciden exacto | 169 |
| **El decimal del equipo redondea a "Atlas + 1"** (30,95 → 31 contra 30) | **156** |
| Desfase real, no explicable por el decimal | 34 |
| Sin columna `Edad` del equipo | 2 |

Así que sus 11 casos son una muestra de 156. **Y no hay nada que corregir en Atlas por este error:** su
corrección pedida ("usar siempre años cumplidos, truncar") es lo que Atlas ya hacía. El que redondea hacia
arriba es su HTML, que lee la edad decimal del equipo. Se lo devuelvo como dato, no como defecto nuestro.

### (d) Error 7, menores de 16: hay **seis**, no tres, y la v7 NO los frena

Barrido completo de la cohorte real vigente:

| evaluación | edad a la medición | estado | ¿tiene EB-BIS sellada? |
|---|---|---|---|
| `41e21c77` | **8** | in_progress | no |
| `b3e367cc` | **9** | in_progress | sí (y es una del error 1: la medición no es suya) |
| `e91888d0` | **12** | in_progress | no |
| `4c30e740` | 13 | completed | **sí** |
| `121224cd` | 13 | completed | **sí** |
| `33e13c69` | 15 | completed | **sí** |

Los tres de su anexo son los tres `completed`. Los otros tres están a medio camino: **el día que alguien les
genere el diagnóstico, con la v5 de hoy saldría una EB-BIS inventada para un niño de 8 años.**

**Y aquí hay una decisión que yo no tomé, a propósito.** Su regla dice *"la EB-BIS no aplica a menores de 16:
el motor devuelve pendiente: edad no válida"*. Eso es un estado de **un indicador**, no un freno al
diagnóstico. La puerta que construí **no frena a un menor**: frena una fecha ausente o imposible. Hacer que
un menor de 16 no pueda diagnosticarse sería ir más lejos de lo que él pidió, y hay seis pacientes reales a
los que afectaría. El "pendiente" de los menores vive dentro de la función v7, cuando se construya.

### Las tres evaluaciones del error 4: están limpias para corregirse

Son exactamente las tres que medí el 22 de octubre, y su causa **no es un fallo de lectura del motor**: es que
la fecha de nacimiento **se corrigió por script el 9 de octubre, después de sellar el diagnóstico**, y un
sellado no se recalcula solo. Eso también contesta por qué los errores 3 y 4 son cosas distintas: en el 3 la
fecha sigue faltando (13 casos), en el 4 llegó tarde (3 casos).

| | `a2ce960c` | `be1a0288` | `bcf91875` |
|---|---|---|---|
| Fecha de nacimiento hoy | 1980-04-19 | 1977-05-28 | 1975-02-21 |
| Edad real a la medición | 46 | 49 | 51 |
| Edad que usó el motor | **0** | **0** | **231** |
| Versión de encuesta | la activa | la activa | la activa |
| Reporte | borrador | borrador | borrador |
| ¿Enviado al paciente? | **no** | **no** | **no** |
| Tratamiento | ninguno | ninguno | ninguno |

**No hay nada entregado que reparar**, y las tres pasan las compuertas del flujo de corrección. La única
fricción es de permisos: corregir es del profesional asignado, no de admin.

### Y un sitio más donde entra la edad, que medí y no cambia nada

Al verificar el ICN (su v11, punto 2) salió que los objetivos de nutrientes se calculan con el sexo y la edad
**sellados** (`validacion.ts:61-62`). Con edad 0, el calcio y el hierro dan **los mismos valores** que con
cualquier edad por debajo de 51, porque las dos únicas ramas son ">70" y ">=51". Así que es un quinto
consumidor de la edad y **en estos tres casos no cambió ninguna cifra**. Lo digo para que no quede como un
cabo suelto: lo miré, y no pasa nada.

---

## 5 · (e) Error 5: el desfase de edad es, en su mayoría, el error 1 disfrazado

Él encontró 6 casos con diferencias de 3 a 20 años. El barrido completo da **16 con más de un año de
diferencia** (los otros 18 de los 34 son el decimal del equipo). Y al cruzarlos con §0:

| | casos |
|---|---|
| Desfases de más de 1 año entre la edad de Atlas y la del equipo | **16** |
| **De ellos, explicados por una medición que pertenece a otro paciente** (errores 1 y 2) | **9** |
| Desfases que quedan después de corregir los errores 1 y 2 | **7** |

**Corregir el error 1 hace desaparecer más de la mitad del error 5.** Es la consecuencia práctica de que la
medición esté colgada del paciente equivocado: la edad del equipo es la de su dueño real, así que claro que
no cuadra con la del paciente al que se le colgó.

**Los 7 que quedan son dos fuentes que se contradicen**, y hay que decidir cuál manda. Hoy Atlas usa la fecha
de nacimiento del perfil (lo que el paciente declaró al firmar) y el equipo usa la que se tecleó en el
BiodyLife al medir. **No son el mismo acto ni tienen la misma solemnidad**: la del perfil la declaró el
paciente en un consentimiento firmado; la del equipo la tecleó quien operó el aparato.

**Mi recomendación sobre su "unificar la fuente": la fuente es el perfil, y no se cambia.** Es la que firma el
paciente y la que decide la rama del consentimiento. Lo que sí tiene sentido es su alerta:

**El coste del aviso, dimensionado.** Comparar las dos edades al importar la medición y avisar si difieren
más de un año: el dato ya está en la misma fila que se importa (`Edad` es una de las 94 columnas del
contrato), así que no hay consulta nueva. Es un aviso en la pantalla de importación, junto a los que ya salen
(pacientes sin sexo, consultas sin encuesta). **Pequeño: una comparación y un contador.** Y con un efecto
colateral útil: **ese mismo aviso habría destapado los errores 1 y 2 el día que ocurrieron**, porque la
medición de otra persona casi nunca trae la edad que cuadra.

---

## 6 · (f) Error 8, la fuerza prensil obligatoria

**Primero el dato, que es el que decide:** 36 de 366 evaluaciones la tienen (**10%**). Y el detalle que ya le
pasé: **de las nueve filas de Gildardo, siete la traen**. El dato no falta porque sea difícil de tomar.

**Y no es insumo de la v7.** Su propia sección 3.1 no la lista entre las entradas: está en la tabla de
errores porque al mirar la cohorte vio el hueco. Es una decisión de captura, no de fórmula. (Sí es insumo del
**fenotipo de sarcopenia**, criterio primario del EWGSOP2, desde la versión 1.2.0 del motor: sin ella
`dxSarcopenia` corta pidiendo el dato. Así que el hueco tiene consecuencias, pero no en la EB-BIS.)

**Su versión, "obligatoria", tiene el defecto que ya nos costó dos veces: un campo obligatorio sin salida.**
El día sin dinamómetro, o con el paciente que no puede apretar, la profesional no puede seguir. Eso es el
hazard 6 de nuestro CLAUDE.md, con su caso real escrito: un `required` incondicional al lado de la casilla
que lo sustituye hace que quien tiene que registrar **elija cualquier opción para poder enviar**, y un dato
inventado se ve igual que uno bueno.

**Lo que propongo llevarle: "obligatoria con salida".** El campo se exige, y al lado hay una casilla "no se
midió" con su motivo (sin dinamómetro / el paciente no puede / otro). Así el 90% vacío de hoy se convierte en
dos cosas distintas y contables: *no se midió por esto* y *se midió, y es este valor*.

**El coste, dimensionado.** Un campo nuevo y su motivo en `evaluation_bis_intake` (migración aditiva), el
formulario de medidas del profesional (`antropometria-editable.tsx`, donde hoy dice "(opcional)"), el writer,
y el gate del `required={!noSeMidio}` con su candado. **Hay precedente exacto:** la salida de "esta compra no
sale de ninguna consulta" en /pagos, con su candado `la-salida-se-puede-elegir.test.ts`, que prohíbe
precisamente el obligatorio inerte. Un día de trabajo, no más, y el candado ya está escrito para copiarlo.

**Lo que NO recomiendo** es que frene el diagnóstico. Hoy, sin fuerza prensil, el motor dice "ingrese fuerza
prensil" en el veredicto de sarcopenia y el resto del diagnóstico sale. Eso ya es la conducta correcta: el
dato que falta se nombra donde falta.

---

## 7 · (g) El recálculo: el orden, y la pregunta del parámetro provisional

**Su lectura es la correcta, y la respaldo: recalcular las limpias y dejar las del anexo A marcadas.** Frenar
390 por 30 deja a todos los pacientes con una EB-BIS vieja, incluidos los 340 que no tienen ningún problema.

**El orden que propongo:**

1. **Corregir los errores 1 y 2 primero** (las 23 evaluaciones con la medición compartida). No son "datos
   sucios": son mediciones colgadas de la persona equivocada, y hay que decidir caso por caso de quién es.
   **Esto lo decide quien atendió, no nosotros**, y la columna `Edad` del equipo da la respuesta en cuatro de
   los cinco pares. El quinto (el de las tres, con edad del equipo 29,873 y ninguno de 29) hay que
   preguntárselo a quien midió ese día.
2. **El freno del importador** (§3), para que no vuelva a entrar ninguna.
3. **Completar las 15 fechas de nacimiento que faltan** (su error 3, 13 casos + 2 que él no vio). La pantalla
   para hacerlo ya está construida en esta entrega.
4. **La función v7 al frozen**, con `ENGINE_VERSION` a 2.0.0, su `versionParametros` persistido y los siete
   casos de su sección 6 como golden tests (regla dura 6: ninguna versión del motor sin golden tests).
5. **El recálculo por el flujo de corrección**, con `trigger_type = recalibracion_ciencia`, que ya existe y
   ya versiona: cada evaluación recalculada deja la vieja legible como reemplazada, con su `engine_version`
   intacto. **No se reescribe nada**, se emite una versión nueva.
6. **Las del anexo A quedan sin recalcular y marcadas**, con el motivo escrito. No se les inventa una EB-BIS
   nueva sobre datos que no son del paciente.
7. **Los informes ya entregados no se tocan** (su §5), y en Atlas eso se cumple solo: de las tres del error 4,
   ninguna se envió.

### Y la pregunta que hay que hacerle a él, porque la cadena crece

Su `escalaAniosPorDE: 5` lleva el comentario **`// provisional`** escrito por él mismo. Y el `deResidual`
(3,75 mujeres / 5,91 hombres) sale de la misma calibración.

**Si ese 5 cambia después de recalcular, hay que recalcular otra vez.** Y el recálculo no es gratuito ni
invisible: cada pasada crea una versión nueva de cada evaluación, con su fila en `clinical_corrections` y su
reporte. Dos pasadas dejan tres versiones de cada diagnóstico en la historia del paciente, y un profesional
que abra esa historia verá tres, no una.

**Técnicamente se apila sin problema** (la cadena es una lista enlazada, `v1 → v2 → v3`, y la vigencia se
deriva de ahí). Lo que no se apila sin coste es la **lectura humana** de esa historia.

**Mi recomendación: preguntarle si el 5 es el definitivo antes de recalcular 390 evaluaciones.** Si dice que
sí, se recalcula una vez y queda. Si dice que todavía lo está mirando, se construye la función, se sella para
los diagnósticos NUEVOS, y el recálculo del histórico espera a que firme el parámetro. Esa espera no cuesta
nada: los diagnósticos viejos ya están emitidos con su versión, que es lo que la constelación de versiones
existe para poder decir.

---

## 8 · La presentación (su tabla 3): lo que ya encaja y lo que hay que decidir

| lo que pide | en Atlas |
|---|---|
| EB-BIS e IAE para profesional y paciente, 1 decimal | **Ya es así.** La cifra está en el diagnóstico y en el informe del paciente. |
| Los tres textos por banda de ±5 | **Nuevos.** Hoy el texto del paciente va por la **trayectoria** (mejoró / sin cambio / empeoró, corte de 2 años), no por el nivel del IAE. **Son dos cosas distintas y las dos son suyas**: hay que preguntarle si el texto nuevo sustituye al de la trayectoria o convive con él. Si conviven, el paciente puede leer "acorde con sus pares" junto a "evolución favorable", que no se contradicen pero tampoco se explican solos. |
| z de pares, tope y alerta, solo profesional | **Nuevos**, y la reja por rol ya existe. |
| "Toda salida se presenta como estimación, nunca como diagnóstico" | Ya es la línea de Atlas. |
| El ICEC se mantiene en el DFI y la Ruta 5 | **Se cumple solo**: el ICEC vive en el LE8 del DFI, y lo único que cambia es que la EB-BIS deja de leerlo. |
| Desaparece "EB-BIS pendiente: requiere encuesta" | Esa leyenda exacta **no existe en Atlas**: lo que hay es `computeEBBIS` devolviendo `null` sin ICEC, y la pantalla no pinta la cifra. Con la v7 la EB-BIS se calculará aunque la encuesta esté incompleta, que es su punto. **Ojo con el efecto secundario:** hoy el gate de encuesta completa frena el diagnóstico entero, así que la EB-BIS nunca se emite sin encuesta por otra razón. Si él quiere la EB-BIS sin encuesta, eso toca el gate, y ese gate es suyo (§1 del 13 de agosto). **Hay que preguntárselo explícitamente.** |

---

## 9 · Lo que se construyó hoy, y lo que no

**Construido:**

- `computeAge` falla en voz alta, con su puerta en los dos caminos al motor, la edad a la fecha de la
  medición, y **su salida**: "Completar la fecha de nacimiento" en la ficha, solo cuando falta, con motivo en
  el rastro clínico. Candado: `src/tests/la-edad-que-se-vuelve-cero.test.ts` (29 pruebas).

**No construido, y esperando:**

- **La función v7**, hasta que decida sobre el parámetro provisional y sobre el gate de la encuesta.
- **El freno del importador** contra la medición duplicada (§3).
- **La fuerza prensil con salida** (§6), que él tiene que aprobar porque cambia la captura.
- **La alerta de desfase de edad** (§5).
