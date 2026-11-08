# El barrido final: todo lo que Gildardo pide cambiar en Atlas, de la v10 a la v16

**Fecha:** 2026-11-07 · **Para:** Santiago · **Pedido:** *"Un último barrido de TODO lo que Gildardo pide
cambiar en Atlas en sus documentos de pendientes y cambios de v10, v11, v12, v15 y v16. La meta es cerrar
lo científico: que no quede nada que podamos hacer sin él."*

**Fuentes, las cinco, en su carpeta `Nuevos cambios html`:**

| Versión | Documento | Qué trae |
|---|---|---|
| v10 · 27-sep | `ATLAS_v10_PENDIENTES_para_Santiago.md` | Bodega CNV y la tienda |
| v11 · 29-sep | `ATLAS_v11_PENDIENTES_para_Santiago.md` | 12 frentes de su HTML |
| v12 · 12-oct | `CAMBIOS_ATLAS_v12_para_Santiago.md` | 9 secciones |
| v15 · 30-oct | `CAMBIOS_ATLAS_v15_para_Santiago.md` | EB-BIS v7 y Encuesta CNV-S |
| v16 · 2-nov | `CAMBIOS_ATLAS_v16_patron_usual_para_Santiago.md` | Clasificación del patrón usual (D1) |

**La v11 y la v12 no se rehacen:** el barrido del 3 de noviembre
(`BARRIDO_V11_V12_2026-11-03.md`) sigue siendo la fuente de su detalle. Aquí se **verifican** sus filas
abiertas contra el código de hoy y se **extiende** a la v10, la v15 y la v16.

---

## Lo primero: el resultado en cuatro cifras

De **68 cosas que pide** en los cinco documentos:

| Estado | Cuántas |
|---|---|
| **Hecho** | 41 |
| **No aplica en Atlas** (y por qué) | 13 |
| **Decisión nuestra declarada** (y dónde se le dice) | 6 |
| **Bloqueado por una pregunta suya** | 7 |
| **Falta y se puede hacer ya** | **1**, y se hizo hoy |

**La columna que importa es la última, y queda vacía.** Lo único que estaba vivo y era nuestro era el
**marco de referencia de las secciones de la encuesta** (v15 §2.6), que no depende de la CNV-S: su frase
*"el marco de dos semanas también se agrega a la encuesta de línea base"* lo pone en el instrumento que ya
corre. Está construido hoy, con su candado.

Todo lo demás que falta **lo decide él**, y son las siete preguntas de la última sección.

---

## v10 · Bodega CNV y la tienda (27 de septiembre)

El documento de v10 es, casi entero, **una lista de lo que a su HTML le falta para parecerse a Atlas**.
Su propio resumen lo dice: siete de sus nueve filas son "Pendiente · Santiago", y lo pendiente es sacar el
inventario de `localStorage`, poner autenticación de verdad y arreglar los consecutivos. En Atlas eso
nunca existió de esa forma.

| § | Qué pide | Estado | Dónde / por qué |
|---|---|---|---|
| 1 | Módulo Bodega con kardex, lotes, mínimos y máximos | **Hecho** | Es el módulo de inventario con sus movimientos inmutables y el saldo por `stock_quantity` como caché del trigger |
| 2 | Descuento automático desde la consulta | **Hecho** | El despacho descuenta por lote y FEFO |
| 3 y 4 | Registrar las ventas de la tienda · tabla `ordenes_tienda` | **No aplica** | Es trabajo del sitio `cnv-corp`, no de Atlas. En Atlas la venta ya es una fila con su cotejo |
| 5 | Webhook de Wompi con `WOMPI_EVENTS_SECRET` | **Hecho** | Con verificación de firma en tiempo constante y su cotejo de conciliación |
| 6 | **El kardex sale de `localStorage` a Supabase** | **No aplica: nunca estuvo ahí** | El inventario de Atlas es una tabla con movimientos desde el primer día. Es su bloqueador, no el nuestro |
| 7 | Autenticación de verdad (hoy PIN `1234`) | **Hecho** | Supabase Auth con RLS por rol, desde B5 |
| 8 | Consecutivos únicos entre equipos | **Hecho** | Numeración en la base, no en el navegador |
| 9 | La pestaña «Inventario» duplicada del Administrador viejo | **No aplica** | En Atlas no hay una segunda cuenta del stock: las cuatro superficies leen la misma columna |
| 2.1 | **Las tres grafías del motor clínico** (`MULTICELL BASE`, `HEPA DETOX`, `GUTIMMUNE PRO`) | **Hecho** | Mapa de alias EXPLÍCITO en `treatment/nutraceuticals-recommendation.ts`, no una regla de "quitar guiones". El registro sanitario RSA-3987-2026 dice `MULTI-CELL BASE` |
| 3.4 | Alertas de vencimiento **por correo** | **Decisión nuestra declarada** | Existen en pantalla (0186) con su marca de "alerta vista". El correo es comercial, y lo comercial está **en pausa desde el 2026-09-18**. Va al BACKLOG, no a Gildardo |
| 3.5 | Cargar el proveedor de Bogotá en Parámetros | **No aplica (es operativo)** | Dato de Santiago, no cambio de software |
| 3.10 | Que el consolidado "por país" sea real | **Hecho** | Consecuencia de que el inventario esté en la base |

**Nada de la v10 queda abierto para Gildardo.**

---

## v11 · los doce frentes (29 de septiembre)

Verificado hoy contra el barrido del 3 de noviembre. **Las doce filas siguen como estaban**, y las cinco
que en su momento "podían estar vivas" se comprobaron entonces contra el código, una por una. Hoy se
volvieron a mirar las dos que podían haberse movido:

| Fila | Verificado hoy | Resultado |
|---|---|---|
| §8.1 · tres nutracéuticos sin dosis por la grafía | `nutraceuticals-recommendation.ts` | Sigue cerrado, con el mapa de alias y las tres grafías nombradas |
| §1 · cascada de macros | la cadena se deriva en el render | Sigue sin campos que puedan quedar sin escribir |

Las otras diez (ICN visible, impresión por hoja, guardado automático, espectro Z5-Z500, seudonimización,
anexos, CNVResearch, Supabase Auth, kardex, tienda y consentimiento) no cambiaron de estado. El detalle
está en el barrido del 3 de noviembre y en `REVISION_ATLAS_V11_2026-10-24.md`.

**Las tres decisiones nuestras de la v11** (el botón de impresión flotante, el guardado automático en
todos los módulos y unificar `guardarConsulta`/`fechaConsulta`) siguen declaradas, con su razón, en el
anexo de `PENDIENTES_CIENTIFICOS.md`.

---

## v12 · las nueve secciones (12 de octubre)

| § | Qué pide | Estado | Dónde / por qué |
|---|---|---|---|
| 1.1 | Lista por último evaluado | **Hecho** | El orden lo manda el servidor y la pantalla reordena con **la misma función**, no con un segundo comparador |
| 1.2 | Eliminar perfil con política y auditoría | **Hecho** (0233) | Con la asimetría de la 0180: el profesional pide con motivo, `admin` ejecuta. **Decisión nuestra declarada:** lo ejecuta `admin` y no el rol de dirección, porque en Atlas ese rol no ve datos de paciente. Es la pregunta 10, ya aplicada |
| 1.3 | Eliminar toma de BIS | **Hecho** (0235) | Dos motivos con su `trigger_type` propio: "la toma quedó mal" y "el archivo es de otra persona" |
| 2 | Control de calidad biológico | **Construido; los límites son suyos** | **BLOQUEADO POR LA PREGUNTA 2.** El motor, el panel y el freno están (0231). Los nueve rangos siguen sin fuente, y entre tanto frenaron una medición real más |
| 3 | Retirar la pantalla intermedia | **No aplica** | Atlas nunca la tuvo. Lo que sí importaba (las condiciones de la toma en Antropometría) se hizo el 30-oct |
| 4 | Diana en colores de semáforo | **BLOQUEADO POR LA PREGUNTA 8** | El defecto que describe está igual en Atlas (degradado continuo). Los tres cortes (0,19 · 0,45 · 0,62) los firma él |
| 5 | Todo se calcula solo al subir el Excel | **Hecho** | La cadena va en vivo; lo manual es lo que SELLA, que es su propia excepción |
| 6.1 | Harris-Benedict sobre peso meta + 10 % | **BLOQUEADO POR LA PREGUNTA 1** | Son dos Harris-Benedict posibles y él mismo dice que lo confirma: +301 kcal/día de diferencia en su propio ejemplo |
| 6.2 | El flujo guiado de seis pasos | **Bloqueado en 6.1** | Propuesto y sin construir: sus pasos 1 y 2 SON las cifras del motor calórico |
| 6.2 | El estado del flujo en `localStorage` | **Decisión nuestra declarada** | Su clave lleva el documento del paciente, o sea PII en un equipo compartido. Se deriva de lo guardado |
| 6.2 | Las tres aprobaciones como guardados | **Decisión nuestra declarada** | Atlas tiene un solo botón de guardar, por decisión de Santiago. Sus aprobaciones son avances de paso |
| 6.2 | Retirar el resumen clínico y la meta de pantalla | **Decisión nuestra declarada** | Recomendamos moverlos al paso 1 en vez de retirarlos |
| 6.3 | La impresión sale igual | **Hecho** | Y por su mismo argumento |
| 6.4 | Retirar la tabla vieja de la fórmula | **No aplica** | En Atlas no existe |
| 7 | Las cinco verificaciones | **Dos son de Santiago, tres suyas** | La impresión del plan y el freno del QC en vivo piden smoke humano; la Diana espera sus cortes |
| 8.1 | El menú se sortea en cada redibujo | **No aplica** | El día de arranque se DERIVA del tratamiento, no es aleatorio |
| 8.2 | **Dos motores opinan del mismo paciente** | **BLOQUEADO POR LA PREGUNTA 11** | Vivo en Atlas, idéntico: el aviso de realimentación lo emite un motor y la prescripción otro |
| 8.3 | El rótulo `ATLAS_v7` | **No aplica** | En Atlas la versión del motor va sellada en cada registro |

---

## v15 · EB-BIS v7 y Encuesta CNV-S (30 de octubre)

### Los ocho errores de la exportación (§1.1)

Son los que él dice que **se corrigen de nuestro lado**, porque el HTML no importa archivos como Atlas.

| N.º | Error | Estado | Dónde |
|---|---|---|---|
| 1 | Una medición en dos evaluaciones iniciales de pacientes distintos | **Hecho** | El freno por huella de los crudos (0225), el aviso de medición repetida y su pantalla de corrección |
| 2 | Seguimientos que repiten la medición de la inicial | **Hecho** | Mismo mecanismo. Hoy quedan 10 grupos abiertos, todos de una profesional, con su guía de corrección |
| 3 y 4 | El motor calculó con edad 0 o 231 | **Hecho** (2026-10-24) | `computeAge` ya no devuelve 0 ante una fecha ausente: falla en voz alta, y tiene su salida en la ficha |
| 5 | La edad de Atlas no coincide con la del equipo, alertar si pasa de 1 año | **Hecho** | `DIFERENCIA_DE_EDAD_TOLERADA = 1`, con la edad medida **a la fecha de la toma** |
| 6 | La edad decimal del equipo se redondea hacia arriba | **Hecho** | Años cumplidos, truncados, desde la fecha de nacimiento |
| 7 | Evaluaciones de menores de 18 | **Hecho, y se cerró el último lado hoy** | El motor devuelve "pendiente", el aviso es neutro y sin pedir acción, y desde la 0239 **los menores quedan fuera de la cohorte de investigación**, marcados en las vigentes |
| 8 | Fuerza prensil solo en 36 de 366 | **BLOQUEADO POR LA PREGUNTA 12** | Hacerla obligatoria sin salida registrada frena una consulta real cuando no hay dinamómetro |

### El resto de la v15

| § | Qué pide | Estado | Dónde / por qué |
|---|---|---|---|
| 1.2 | Portar `ebBisV7.js` tal cual, con sus parámetros 7.1.0 versionados | **Hecho** | Portado verbatim, con los 7 casos de `casos.json` como golden |
| 1.2 | El ICEC ya no entra al cálculo; desaparece la v5 | **Hecho** | La v5 no se muestra en ninguna superficie |
| 1.3 | EB-BIS e IAE al profesional y al paciente | **Hecho** | Y con la frase del paciente que Santiago aprobó |
| 1.3 | Los tres textos del IAE, con cortes ±5 inclusivos | **Hecho en la presentación** | `bandaIae` lee un solo corte, cerrado en los dos extremos |
| 1.3 | **Y los mismos cortes en las rutas R1 y R4, la síntesis y la alerta de estrés** | **BLOQUEADO POR LA PREGUNTA 7** | En su propio archivo esos sitios siguen con `> 5` abierto. Son suyos: cambiarlos es editar su contenido clínico |
| 1.3 | z de pares, tope ±15, alerta de discordancia · solo profesional | **Hecho** | Las tres en la tabla de soporte del diagnóstico |
| 1.3 | **Alerta contextual** (ICEC < 50 e IAE ≥ +5) | **Hecho** (hoy) | Con los dos cortes exactos: el del ICEC estricto, el del IAE inclusivo, y el del IAE **leído** de la banda del motor |
| 1.3 | "Diagnóstico integrado pendiente de la encuesta" | **Hecho** | El DFI no se genera con la encuesta incompleta |
| 1.4 | Versionado del resultado (`ebVersionMotor`, `ebVersionParametros`, `ebZPares`, `ebTopado`, `ebEstado`, `ebMotivo`) | **Hecho** | Sellados en el snapshot, que es la constelación de la regla dura 7 |
| 1.4 | **Migración en la base, después de corregir los errores 1 a 6** | **Hecho** | La reemisión con el motor nuevo, con su simulación previa y su freno. Y los informes ya entregados **no se modifican**: el snapshot es inmutable por trigger |
| 2.1 a 2.5 | Encuesta CNV-S: instrumento, Módulo S, confirmación, regla de salto, reconfirmación anual | **Es el punto 5 de hoy** | Diez piezas, y cambia la encuesta que llena el paciente |
| 2.6 | **Marco de referencia por sección, también en la línea base** | **FALTABA, Y SE HIZO HOY** | Los ocho marcos, derivados del `field_key` y no del rótulo, en la encuesta del paciente y en la vista del profesional |
| 2.7 | Trazabilidad del instrumento (`instrumentoEncuesta`, `cnvs_*`, `cnvsNoComparable`, `cnvsAdherenciaAdecuada`) | **Con la CNV-S** | Son campos de la CNV-S: sin el instrumento no hay nada que trazar |
| 3 | Tarjeta "Respuesta a la intervención" | **Hecho a medias, a propósito** | El delta del DFI, de la capacitancia y de la PABU está, con `sonComparables`. La adherencia y el escenario de su tabla 6 **dependen del Módulo S**, y la tarjeta lo dice en vez de inventar el eje |
| 3 | Exportar a OB BIA LATAM con `instrumentoEncuesta` | **Con la CNV-S** | |
| 5.5 | Reconfirmación al cierre de una ruta | **Pendiente suyo** | Él mismo lo deja abierto: *"pendiente de decisión"* |

---

## v16 · la clasificación del patrón usual (2 de noviembre)

**Las siete filas de su resumen están hechas**, incluidas las dos que él marcó como "no aplica al HTML"
porque eran de Atlas.

| § | Qué pide | Estado | Dónde |
|---|---|---|---|
| 4.1 | Clasificador único (`d1EstadoGrupo`, `d1Clasificar`, `d1Lista`, `d1TextoPatron`) | **Hecho** | Portado a la capa congelada y leído por las TRES superficies que antes clasificaban por su cuenta |
| 4.2 | `calcPatron` del ICEC: huevos incluidos, embutidos con penalización doble, tope 54, carnes rojas | **Hecho** | `frozen/engine.patron.js`, con las cuatro reglas y su tope |
| 4.2 | **Versionar el ICEC** | **Hecho** | El motor subió de MAYOR y las consultas se reemitieron; el valor anterior queda sellado en su informe |
| 4.3 | Dominio alimentario, resumen narrativo y los dos párrafos | **Hecho** | Con el golden re-anclado a la v16 y su razón escrita |
| 4.3 | `calcularDominios` / `nivelAlim` (su L10549) | **No aplica** | Es su OTRA estructura de cinco dominios, la que el DFI sustituye; en su propio archivo alimenta el camino que él declara muerto |
| 4.4 | Vista D1 con la categoría de cada grupo, la nota fija y la frase al pie | **Hecho** | Con "Limitar" propio de las carnes rojas y la nota que dice qué significa el color |
| 4.4 | Las tarjetas se leen por el PEOR grupo, no por el promedio | **Hecho** | Y los neutros conservan su lectura por promedio, como él pide |
| 4.5 | La IA recibe la clasificación ya hecha | **Hecho** | Las dos mitades: el dato resuelto y la regla en el texto de sistema v15, en los dos sentidos |
| 6 | Encuesta del QR con los 15 grupos de D1 | **Hecho, y su diagnóstico ya no aplica** | En Atlas están los 15 grupos con sus textos **en las cinco versiones publicadas**: 633 de 634 encuestas traen el grupo 15. El caso del instrumento anterior es **una** encuesta |
| 7 | Motor congelado: Alimentación fija en 30 | **Hecho el 2026-09-06**, antes de que él lo escribiera | El interruptor del mapeo (`LE8_MAPEO_CORREGIDO`) está en `true` en la capa autorizada, con su adaptador de ordinales. Hoy la Alimentación varía |

---

## Lo único que faltaba, y lo que se hizo con ello

**v15 §2.6 · el marco de referencia de cada sección.**

Su frase: *"Cada sección muestra su marco: «patrón usual de consumo» en D1 (no es un recordatorio de 24
horas); «últimas dos semanas» en D2, D3, D4, D6, D7 y D8; «situación actual» en D5 y Confirmar... **El
marco de dos semanas también se agrega a la encuesta de línea base.**"*

Esa última frase es la que lo trae hoy: **el marco no es solo de la CNV-S**, y por eso no espera al punto
5. Y no es ayuda de pantalla: es la **ventana de recuerdo** del instrumento. "¿Fumas?" contestada
pensando en el último año y contestada pensando en las últimas dos semanas son dos preguntas distintas
con el mismo enunciado. Sin marco, cada paciente elige su propia ventana y las respuestas de dos personas
dejan de ser comparables, que es justo lo que un instrumento existe para evitar.

Lo que entra:

- Los **ocho marcos**, con sus tres textos (los suyos, tuteados), en `evaluations/marco-de-la-seccion.ts`.
- En la **encuesta del paciente**, encima del párrafo de ayuda: la ayuda dice *cómo* responder y el marco
  dice *sobre qué periodo*, y lo segundo manda.
- En la **vista del profesional**, del mismo módulo: si el profesional leyera otra ventana que la que vio
  el paciente, las dos superficies dirían cosas distintas sobre el mismo dato.
- **Derivado del `field_key`, no del rótulo en español.** El icono de la sección y su párrafo de ayuda sí
  se buscan por rótulo, y para ellos está bien: renombrar una sección cuesta un icono. Aquí costaría la
  ventana de recuerdo de un cuestionario clínico, **en silencio**.

Candado: `src/tests/el-marco-de-la-seccion.test.ts` (11 casos).

**Y una pregunta que abre, pequeña pero suya:** el marco cambia cómo se interpreta una respuesta, aunque
no cambie ningún enunciado ni ninguna opción. Su regla de invariancia (§7.4) habla de enunciado, opciones
y puntaje, así que el marco no la rompe; pero si él considera que el marco es parte del instrumento,
**esto pide una versión nueva de la encuesta**, no un cambio de pantalla. Va a `PENDIENTES` como la
pregunta **39**.

---

## Las siete preguntas que bloquean, en una lista

Son las únicas cosas de los cinco documentos que no podemos hacer:

| # | Qué bloquea | De qué versión viene |
|---|---|---|
| **1** | Cuál Harris-Benedict y sobre qué el 10 % | v12 §6.1 (y con ella el flujo guiado §6.2) |
| **2** | Los nueve rangos del control de calidad biológico | v12 §2 |
| **7** | El borde de ±5,0 del IAE en los tres sitios de su archivo | v15 §1.3 |
| **8** | Los tres cortes de la Diana | v12 §4 |
| **11** | Qué motor emite el aviso de realimentación | v12 §8.2 |
| **12** | Fuerza prensil obligatoria, con salida registrada | v15 §1.1, error 8 |
| **39** · nueva | Si el marco de referencia es parte del instrumento (y pide versión) | v15 §2.6 |

Y dos que no bloquean nada pero son suyas: la **13** (los cinco textos de dominio en lenguaje llano) y la
reconfirmación al cierre de una ruta, que él mismo dejó pendiente en su §5.5.

---

## Cómo se verificó

No es una lectura de documentos contra documentos. Cada fila marcada **Hecho** se comprobó contra el
código o contra la base:

- **Contra el código:** el mapa de alias de los nutracéuticos, `LE8_MAPEO_CORREGIDO`, las cuatro reglas de
  `calcPatron`, `DIFERENCIA_DE_EDAD_TOLERADA`, la tabla de soporte del diagnóstico, el clasificador de D1
  y sus tres lectores, el orden del roster y las dos mitades del prompt de la IA.
- **Contra la nube** (solo lectura, `scripts/LO_QUE_PREGUNTO_LA_SIMULACION_2026-11-07.mjs`): la tabla de
  la R1 por celda del dominio 1, los menores de la cohorte y las consultas sin diagnóstico.
- **Contra la suite:** los candados que ya fijan cada propiedad, que es lo que no envejece.

Donde la verificación cambió el estado que decía un documento, se dice: la **v16 §6 y §7** describen
correctamente el defecto y **ya no el estado** (los 15 grupos están en las cinco versiones publicadas, y
el componente de Alimentación se arregló el 6 de septiembre), y el **grupo 3** de las mediciones repetidas
se cerró solo porque su gemela es de una cuenta de prueba.
