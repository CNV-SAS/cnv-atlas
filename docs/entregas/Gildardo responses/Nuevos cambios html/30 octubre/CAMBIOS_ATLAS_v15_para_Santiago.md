# ATLAS v15: cambios que debe llevar ATLAS CNV

**Archivo de referencia:** `ATLAS_v15.html` (25.338 líneas · 1,56 MB) · **Base:** `ATLAS_v12.html`, sin modificar
**Fecha:** 30 de octubre de 2026 · **Para:** Equipo ATLAS (Santiago)
**De:** Gildardo Uribe, Dirección Científica CNV

---

Santiago: v15 reúne dos cambios para el software. El primero es la **EB-BIS v7 con parámetros 7.1.0**, que reemplaza a la v5. El segundo es la **Encuesta CNV-S 1.0**, la versión de seguimiento de la encuesta. Frente a v12 hay **570 líneas agregadas y 57 retiradas**. ATLAS CNV debe quedar como este archivo, ni más ni menos.

Fuentes que mandan sobre este documento (si algo no coincide, manda la fuente):

- *EB-BIS v7 en ATLAS CNV. Especificación de implementación* (26 de octubre de 2026), con `ebBisV7.js` y `casos.json` (paquete `EB_BIS_v7_param_7.1.0_Santiago.zip`).
- *Encuesta CNV-S. Versión de seguimiento de la Encuesta CNV v2.0. Documento técnico de diseño y registro de decisiones* (30 de octubre de 2026).

No se tocaron el consentimiento, los demás indicadores (IFC, IRC, PABU, ICA-BIS, IEHH, ISCM-BIS), la Diana EFR, el ICEC, los cinco dominios del DFI, la IA, Bodega ni CNVResearch.

---

## Resumen

| # | Cambio | Estado en v15 | Lo que te toca |
|---|---|---|---|
| 1 | EB-BIS v7 (7.1.0) reemplaza a la v5 | **Hecho, 7/7 casos de prueba** | Portar el motor tal cual y corregir primero los errores 1 a 8 de la especificación |
| 1 | Textos del IAE y cortes ±5 inclusivos | **Hecho** | Mismos textos y cortes en pantalla e informes |
| 1 | Versionado, histórico v5 y recálculo | **Hecho al leer el historial** | Migración en la base de datos |
| 2 | Encuesta CNV-S desde la segunda consulta | **Hecho** | Nuevo instrumento en la base y en el formulario |
| 2 | Módulo S, confirmación, regla de salto, marco de referencia | **Hecho** | Ítems nuevos en la base de datos y lógica del formulario |
| 2 | Trazabilidad del instrumento | **Hecho** | Columnas nuevas |
| 3 | Seguimiento: adherencia, eventos y delta | **Hecho** | Misma tarjeta; exportar a OB BIA LATAM con la versión del instrumento |

---

## 1 · EB-BIS v7 (parámetros 7.1.0)

### 1.1 · Antes de implementar: los errores de la exportación

La especificación del 26 de octubre (sección 3 y anexo A) lista ocho errores encontrados en las 366 evaluaciones de ATLAS CNV. **Mientras persistan, la EB-BIS de esas evaluaciones no es confiable con ninguna fórmula.** El HTML no importa archivos como lo hace ATLAS CNV, así que estos errores se corrigen de tu lado:

| N.º | Error | Corrección |
|---|---|---|
| 1 | Una medición quedó asignada a dos evaluaciones iniciales de pacientes distintos | Impedir que una medición se asocie a más de una evaluación inicial |
| 2 | Seguimientos que repiten la medición de la inicial | Un control exige una medición nueva |
| 3 y 4 | El motor calculó con edad 0 o 231 | Sin edad válida, el motor devuelve «pendiente» |
| 5 | La edad de ATLAS no coincide con la del equipo | Una sola fuente de fecha de nacimiento; alertar si la diferencia supera 1 año |
| 6 | La edad decimal del equipo se redondea hacia arriba | Siempre años cumplidos desde la fecha de nacimiento (truncar) |
| 7 | Evaluaciones de menores de 18 años | «Pendiente: edad no válida» |
| 8 | Fuerza prensil solo en 36 de 366 evaluaciones | Campo obligatorio en la inicial y en cada control |

En v15 los errores 3, 4, 6 y 7 quedan resueltos en el propio motor: la edad sale siempre de la fecha de nacimiento y la fecha de medición (`atlasEdadCumplida`, línea 4423). Los errores 1, 2, 5 y 8 son de la importación y del formulario de ATLAS CNV.

### 1.2 · El cálculo

`EB_BIS_V7` y `ebBisV7` (líneas 4375 a 4421) son la función de referencia de la especificación, **copiada sin cambios**. Los parámetros viven en un objeto de configuración versionado, no dentro de la pantalla. Puedes integrar `ebBisV7.js` tal cual.

- Entradas: sexo, edad en años cumplidos (18 a 100), Re, Ri y C del equipo, peso, MLG, ACT y FMI de la misma evaluación. En v15 la MLG sale del campo `FFM` del export.
- El ICEC ya no entra al cálculo. La EB-BIS se calcula aunque la encuesta no esté completa. El ICEC solo activa la alerta de discordancia (z de pares ≥ 1 e ICEC ≥ 80).
- Desaparece la v5: intercepto 41,438 con IFC, PABU e ICEC (línea 7668 en v15).

**Verificación hecha sobre el archivo:** los siete casos de `casos.json` dan la EB-BIS, el IAE y la alerta esperados, con diferencia de 0,0 años. También se probaron los casos límite: edad 17 o vacía devuelve «pendiente: edad no válida»; C = 0 devuelve «pendiente» con el nombre del dato; PSSG/peso fuera de 0,05 a 0,40 devuelve «revisar»; sin ICEC se calcula y no hay alerta.

### 1.3 · Salidas y presentación (sección 5 de la especificación)

| Salida | Quién la ve | En v15 |
|---|---|---|
| EB-BIS (1 decimal) | Profesional y paciente | Igual que antes |
| IAE (1 decimal con signo) | Profesional y paciente | «Envejecimiento acelerado estimado» si IAE ≥ +5,0 · «Acorde con sus pares» entre −5,0 y +5,0 · «Envejecimiento desacelerado estimado» si IAE ≤ −5,0 |
| z de pares (2 decimales) | Solo profesional | Fila de soporte en la tabla del diagnóstico (línea 15410) |
| Tope ±15 | Solo profesional | «IAE: valor limitado al máximo del indicador (±15 años)» |
| Alerta de discordancia | Solo profesional | «Deterioro celular mayor que el esperado con hábitos reportados favorables: verificar hábitos o cambio reciente» |
| Alerta contextual | Solo profesional | «Envejecimiento bioeléctrico acelerado con carga epigenética alta» cuando ICEC < 50 e IAE v7 ≥ +5 años (línea 15417). Reemplaza el umbral IAE > 3 de la Guía del Desarrollador v2 |
| No calculable | Profesional | «EB-BIS pendiente: » más el motivo que devuelve la función |
| DFI | Profesional | Mientras la encuesta no esté completa, «Diagnóstico integrado pendiente de la encuesta» y el DFI no se genera (línea 15648) |

Los cortes pasan a ser inclusivos en ±5 (`cIAE`, línea 4487). Se ajustaron todos los sitios que definían «acelerado» con `> 5`: las rutas R1 y R4, la síntesis del diagnóstico, la alerta de estrés de psicología y los informes. Hay que replicarlo en ATLAS CNV.

### 1.4 · Versionado y migración (sección 6)

- Con cada resultado se guardan `ebVersionMotor = "EB-BIS v7"` y `ebVersionParametros = "7.1.0"`, además de `ebZPares`, `ebTopado`, `ebAlertaDiscordancia`, `ebEstado` y `ebMotivo` (líneas 7866 y 7910).
- El valor v5 pasa a `EB_BIS_v5` / `IAE_v5`, que no se muestran en ninguna pantalla.
- En v15 las consultas guardadas se recalculan con la v7 al leer el historial (`atlasMigrarEbV7`, línea 4458). Si una consulta no tiene los datos crudos, queda «pendiente»: nunca se muestra el v5. En ATLAS CNV esto debe ser una **migración en la base de datos**, después de corregir los errores 1 a 6.
- Los informes ya entregados a pacientes no se modifican.

---

## 2 · Encuesta CNV-S 1.0 (seguimiento)

### 2.1 · Cuándo se aplica

La primera consulta usa la encuesta completa (línea base). **Desde la segunda consulta se aplica la CNV-S.** En v15 entra por «Nueva consulta» en la lista de pacientes (`atlasPrepararCNVS`, línea 3649, llamada en la línea 24265). Todo el bloque está entre las líneas 3583 y 3813.

### 2.2 · Qué pasa con cada ítem (tabla 3 del documento)

| Categoría | Ítems | Comportamiento |
|---|---|---|
| Repetir | D1 completo, 19 a 27, 29 a 31, 32, 33, 36, 37, 52 a 58, 60 a 62 | Igual que en la línea base, sin precarga |
| Repetir con filtro | 45 a 51 | Pregunta filtro antes de los síntomas |
| Confirmar | 28, 34, 39, 40, 42, 43, 44, 59 | Precargados; «Sin cambios» o «Editar» |
| Retirar | 35, 38, 41 y 63 | No se preguntan; se conserva el valor de la línea base |

**Invariancia (sección 7.4):** los ítems «Repetir» se presentan con el mismo enunciado, las mismas opciones y el mismo puntaje que la línea base. Por eso v15 no redefine preguntas: reutiliza las mismas secciones D1 a D8 y solo oculta los ítems que van a confirmación o se retiran. En ATLAS CNV, como las preguntas salen de la base de datos (`supabase/seed.ts`), la CNV-S debe **apuntar a las mismas preguntas** y no duplicarlas con otro texto.

Orden del formulario (anexo A): Inicio, **Módulo S**, **Confirmar**, D1 a D8, **Cierre** (`TAB_ORDER_CNVS`, línea 3801).

### 2.3 · Módulo S (ítems nuevos)

Enunciados y opciones literales del documento. Ninguno lleva raya larga, así que se pueden pegar en el seed.

| Ítem | Pregunta | Opciones | Tipo |
|---|---|---|---|
| S1 | [nutracéutico]: ¿con qué frecuencia lo tomó? | Todos los días · 5 o más días por semana · Menos de 5 días por semana · No lo tomó · Lo suspendió | Una respuesta, una vez por cada nutracéutico |
| S2 | Si no lo tomó como se indicó, ¿por qué? | Olvido · Costo · Molestia digestiva u otro efecto · No vio cambios · Otro | Una respuesta; solo si S1 no es «Todos los días» ni «5 o más» |
| S3 | ¿En qué medida siguió el plan de alimentación indicado? | Nada · Poco · La mitad · Casi todo · Todo | Una respuesta |
| S4 | Desde la última consulta, ¿ha tenido alguno de estos eventos? | Enfermedad aguda (fiebre, infección, diarrea) · Hospitalización o cirugía · Medicamento nuevo · Embarazo o lactancia · Cambio de turno o de trabajo · Evento estresante mayor · Ninguno | Varias |
| S5 | ¿Ha intentado cambiar su peso desde la última consulta? | No · Sí, bajar · Sí, subir | Una respuesta |
| S6 | Desde la última consulta, ¿cómo describiría el cambio en su estado de salud general? | Muchísimo mejor · Mucho mejor · Un poco mejor · Sin cambios · Un poco peor · Mucho peor · Muchísimo peor | Una respuesta, en Cierre |

**S1 es dinámico:** sale de los nutracéuticos registrados en Rutas de atención para el paciente. En v15 se leen de lo que el profesional despachó en Rutas de atención (`atlas:nutra:<documento>:<profesional>`). En ATLAS CNV deben salir de la tabla donde guardas las indicaciones o despachos de la consulta anterior.

### 2.4 · Bloque de confirmación

Cada ítem muestra la respuesta anterior y dos botones, «Sin cambios» y «Editar». «Editar» abre la pregunta original con sus opciones (`CNVS_CONF`, línea 3755).

**Reconfirmación anual (sección 7.3):** si pasó un año o más desde la última confirmación completa, se presentan todos los ítems abiertos más el ítem 38, antecedentes familiares. Cuentan como confirmación completa la línea base y cada reconfirmación hecha.

### 2.5 · Regla de salto de los síntomas digestivos (sección 7.2)

Antes de los ítems 45 a 51 va la pregunta filtro: «En las últimas dos semanas, ¿ha tenido algún síntoma digestivo (hinchazón, gases, dolor, diarrea, estreñimiento, reflujo o náuseas)?» (Sí / No). Si la respuesta es «No» y en la consulta anterior los siete se registraron como «Nunca», se guardan los siete como «Nunca» sin presentarlos. En cualquier otro caso se presentan los siete. La lógica está en la línea 2106 y en la línea 3834 en adelante.

### 2.6 · Marco de referencia (sección 7.1)

Cada sección muestra su marco: «patrón usual de consumo» en D1 (no es un recordatorio de 24 horas); «últimas dos semanas» en D2, D3, D4, D6, D7 y D8; «situación actual» en D5 y Confirmar; «desde la última consulta» en Módulo S y Cierre. **El marco de dos semanas también se agrega a la encuesta de línea base.**

### 2.7 · Trazabilidad (sección 10)

Campos nuevos por encuesta:

| Campo | Contenido |
|---|---|
| `instrumentoEncuesta` | «CNV v2.0» o «CNV-S 1.0» |
| `encuestaMinutos` | Tiempo de diligenciamiento |
| `cnvsConfirmacion` | Por cada ítem confirmado: `editado` (sí/no) y estado (`sin_cambios`, `editado`, `sin_marcar`) |
| `cnvs_s1` … `cnvs_s6`, `cnvs_gi_filtro` | Respuestas del módulo S y del filtro |
| `cnvsNoComparable` | Sí cuando S4 registra enfermedad aguda, hospitalización o cirugía, o embarazo o lactancia |
| `cnvsAdherenciaAdecuada` | S1 en «Todos los días» o «5 o más» para todos los indicados, y S3 en «Casi todo» o «Todo» |
| `cnvsReconfirmacionHecha` | Si en esa consulta se hizo la reconfirmación anual |

Al calcular si la encuesta está completa, los ítems retirados no cuentan como pendientes en la CNV-S (líneas 3873 y 12738).

---

## 3 · Módulo Seguimiento

Nueva tarjeta **«Respuesta a la intervención · Encuesta CNV-S»** (`cnvsTarjetaSeguimiento`, línea 15978). Se compara contra la última consulta **comparable** y muestra:

- El delta del DFI (riesgo integrado ponderado, de 0 a 100; menor es mejor), de la capacitancia y de la PABU.
- La adherencia, S1 a S6 y las mediciones no comparables.
- El escenario de la tabla 6:

| Delta del DFI | Adherencia adecuada | Adherencia insuficiente |
|---|---|---|
| Mejora | Respuesta compatible con la ruta | Mejora no atribuible a la ruta |
| Sin cambio o empeoramiento | Respuesta insuficiente con exposición adecuada | Exposición insuficiente |

Una medición marcada como no comparable se guarda y se informa, pero no entra al delta.

**OB BIA LATAM:** los registros de seguimiento deben exportarse con su `instrumentoEncuesta`, para los análisis longitudinales ajustados por adherencia.

---

## 4 · Cómo se probó v15

- El archivo se sirvió en `127.0.0.1` con un paciente de prueba propio, sin acceso a Supabase y sin tocar datos reales.
- Recorrido completo: consulta de línea base, luego «Nueva consulta» con CNV-S, Módulo S, confirmación con un ítem editado, filtro digestivo con salto, cierre y guardado. Después, Diagnóstico y Seguimiento en los dos casos, con evento intercurrente y sin él.
- Los campos de trazabilidad quedaron guardados y la consola no mostró errores.

---

## 5 · Decisiones de Gildardo sobre lo que quedó abierto (30 de octubre)

1. **Ítem 63, cirugías digestivas: se retira del control.** Las cirugías previas quedan registradas en la primera consulta y el profesional las conoce en los controles. En la CNV-S no se pregunta y conserva el valor de la línea base.
2. **D1 es patrón usual de consumo.** No es un recordatorio de 24 horas, que Gildardo considera poco confiable. Su marco de referencia es «patrón usual de consumo», en las dos encuestas.
3. **Ítem 29, estrés:** queda como está («en el último mes»).
4. **Alerta contextual: va.** Se activa con ICEC < 50 e IAE v7 ≥ +5 años y la ve solo el profesional. Es la pareja de la alerta de discordancia: aquella avisa cuando el deterioro celular no concuerda con hábitos buenos; esta, cuando hábitos y contexto desfavorables coinciden con envejecimiento acelerado.
5. **Reconfirmación al cierre de una ruta:** pendiente de decisión. Hoy solo aplica la regla anual.

Se mantiene como está:

- En la pantalla, «Encuesta CNV v3.0»; en los datos se guarda «CNV v2.0», como pide el documento.
- S4: la opción «Embarazo o lactancia» marca la medición como no comparable.
- S2: una sola respuesta por producto.
