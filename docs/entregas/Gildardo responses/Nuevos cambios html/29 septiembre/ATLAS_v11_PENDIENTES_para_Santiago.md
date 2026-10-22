# ATLAS v11 — Automatización, datos completos y CNVResearch: qué está hecho y qué falta

**Archivo:** `ATLAS_v11.html` (24.275 líneas · 1,51 MB) · **Base:** `ATLAS_v10.html`, sin modificar
**Fecha:** 29 de septiembre de 2026 · **Para:** Equipo ATLAS — Santiago

---

Santiago: v11 se construyó en cuatro etapas sobre v10. Frente a v10 son **975 líneas
agregadas y 10 reemplazadas**, repartidas en 22 bloques. No se tocó el consentimiento, ni
el motor clínico, ni la IA, ni ningún umbral diagnóstico.

Dos advertencias antes de entrar, porque condicionan todo lo demás:

1. **Las cuatro etapas están probadas en lógica, no en navegador.** 79 comprobaciones
   automáticas en Node sobre el código real extraído del archivo, más la validación de
   sintaxis de los tres bloques `<script>`. El recorrido visual quedó pendiente: la máquina
   donde se desarrolló se quedó sin memoria repetidas veces. **Es la deuda de verificación
   que te heredo.**
2. **CNVResearch tiene el candado pintado.** Mientras ATLAS no tenga autenticación de
   servidor, la separación entre dirección científica y consulta es de interfaz. El propio
   módulo lo advierte en pantalla. Ver sección 6.

---

## Resumen

| # | Frente | Estado | Quién |
|---|---|---|---|
| 1 | Nutrición · cascada completa de macros | **Corregido** | hecho |
| 2 | ICN visible e imprimible | **Corregido** | hecho |
| 3 | Impresión en todas las páginas | **Hecho** | hecho |
| 4 | Guardado automático en Antropometría y Diagnóstico | **Hecho** | hecho |
| 5 | Espectro Z5–Z500 deja de perderse | **Hecho** | hecho |
| 6 | Código de paciente y seudonimización | **Hecho** | hecho |
| 7 | Anexos del paciente viajan a la nube | **Hecho** | hecho |
| 8 | Módulo CNVResearch | **Hecho** | hecho |
| 9 | **Supabase Auth** | **Pendiente — bloquea 3 cosas** | Santiago |
| 10 | Kardex de Bodega en `localStorage` | Pendiente (viene de v10) | Santiago |
| 11 | Tienda virtual: webhook y tabla | Código listo, **sin desplegar** (viene de v10) | Santiago |
| 12 | Consentimiento no menciona investigación | **Decisión de Gildardo** | Gildardo |

---

## 1 · Nutrición — el defecto no estaba donde parecía

**El síntoma.** «Cambio las calorías y los gramos de proteína, y lo demás no se recalcula.»

**Dónde NO estaba.** La pantalla del plan siempre recalculó bien. `formulaEditPN` toma
`kcal_obj`, `prot_gkg` y `fat_pct`, y de ahí derivan proteína en gramos, grasa,
carbohidrato y las porciones. Eso funcionaba.

**Dónde estaba.** Al **guardar**. Se escribía:

```js
sintEdit:{pal:palN, kcal_obj:kcalObj, prot_g:protG, fat_pct:fatPct}
```

y la historia clínica y la impresión leen `fat_g` y `cho_g` — **que nunca se escribían**. Por
eso en la ficha salían «—» en grasas y carbohidratos, y la tabla de intercambios
desaparecía entera, porque su guarda es `if(!protG_r||!choG_r) return ""`.

**Lo que se hizo.** Se guardan los siete campos (`prot_gkg`, `fat_g` y `cho_g` incluidos).
Y se agregó `_sintMacro` (línea 12144), que reconstruye grasa y carbohidrato para los planes
guardados **antes** de v11: derivando la grasa del `fat_pct` que sí se guardaba, y el
carbohidrato por diferencia. **Los planes viejos vuelven a mostrarse completos sin rehacerlos.**

> **No lo "optimices" unificando los almacenes.** Conviven `atlas:plan:<doc>` y
> `atlas:plan_pn:<doc>` con campos que se solapan. Fusionarlos parece limpieza, pero cada uno
> tiene lectores distintos repartidos por el archivo. Si lo haces, hay que rastrearlos todos.

---

## 2 · El ICN estaba, pero era invisible

Existía desde antes, con su tabla de cubrimiento por nutriente y la meta ICN ≈ 1. No se veía
por dos motivos, y los dos se corrigieron:

1. Tenía `className:"no-print"` — no salía en **ninguna** impresión.
2. Se dibujaba solo si el profesional de la consulta era nutricionista
   (`esNutriInter ? secValid : null`). La dirección científica, revisando un plan, no lo veía
   nunca.

Ahora el ICN y la tabla de grupos e intercambios se ven siempre que haya plan, y se imprimen.

---

## 3 · Impresión en todas las páginas

De once módulos solo imprimían tres. En vez de once botones se puso **uno solo, flotante**,
que existe en toda la aplicación.

| Dónde | Qué |
|---|---|
| línea 28 | `.atlas-print-fab` y las reglas globales `@media print`, en el `<style>` de la cabecera |
| línea 24263 | El botón se inyecta en el DOM **fuera de React**, después del montaje |

**Por qué fuera de React:** así existe en inicio, encuesta, antropometría, diagnóstico, rutas,
reporte, seguimiento, Bodega y CNVResearch sin tocar ni un módulo.

**Por qué las reglas van en la cabecera:** Antropometría, Reporte/HC y Tratamiento declaran su
propio `@media print` dentro del `<body>`, más tarde en el documento. Por orden de cascada
siguen mandando sobre las globales y **conservan su formato tal cual**. Si mueves las reglas
globales al body, les pisas el formato a los tres.

> **Trampa encontrada durante el desarrollo:** la primera versión insertó el botón entre el
> `if(App){...}` y su `else{...}` del montaje, partiendo la cadena y dejando el archivo sin
> compilar. El botón va **después** del `else`. La validación de sintaxis lo atrapó; si tocas
> esa zona, vuelve a correrla.

---

## 4 · Guardado automático

**La regla:** Antropometría y Diagnóstico se guardan solos cuando se cumplen **las dos**
condiciones — encuesta completa **y** Excel cargado. Los demás módulos conservan su botón.
Por petición expresa de Gildardo, **el botón «Guardar» sigue visible en los dos** para poder
forzarlo.

| Utilidad | Línea | Qué hace |
|---|---|---|
| `atlasEncuestaCompleta(datos)` | 12163 | Completitud de la encuesta |
| `atlasTieneBIS(bis)` | 12177 | ¿Ya se cargó el Excel? |
| `atlasParcharConsulta(doc, fecha, parche)` | 12189 | Escribe dentro de la consulta del día |

**La completitud no se inventó.** Usa exactamente el mismo criterio que ya mostraba «Encuesta
completa» en la pantalla del paciente: todas las preguntas de `QMAP_ENC` menos las declaradas
opcionales en `OPCIONALES_ENC`. Solo se sacó a una función reutilizable, para que no existan
dos definiciones de «completa» que puedan discrepar.

**Los efectos no llevan arreglo de dependencias, a propósito.** Cada uno compara una firma del
contenido antes de escribir y espera 1,2 segundos. Así no escribe una vez por cada tecla
mientras se corrige una circunferencia, y el mensaje de confirmación no vuelve a disparar el
guardado. Si le pones un arreglo de dependencias, verifica que no se te escape ninguna.

### 4.1 · Un riesgo de duplicar consultas que hay que conocer

**El historial de Antropometría se indexa por `fechaConsulta`. El helper global
`guardarConsulta` (línea 9804) busca por `fecha`.**

Llamar a ese helper desde otro módulo para la misma consulta crea **una segunda fila del mismo
día** — y esa duplicación llega a Supabase y después a CNVResearch como si fueran dos
pacientes-día. Por eso el guardado del diagnóstico usa `atlasParcharConsulta`, que busca por
las dos claves y siempre deja `fechaConsulta` escrita.

> **Esta inconsistencia sigue viva en el archivo.** No se unificó porque toca código que ya
> funciona. Es candidata a arreglo, pero con cuidado: hay que revisar todos los lectores de
> ambos campos antes de tocar.

---

## 5 · Lo que se guarda ahora y antes se perdía

### 5.1 · El espectro de impedancia

`Z5, Z20, Z50, Z100, Z200, Z500` se leían del Excel, se usaban para calcular el IR, se
mostraban en pantalla y **se botaban al guardar**. Ahora entran en la consulta, en los dos
puntos donde se arma el registro (líneas 7344 y 7379).

**Lo que se perdió hasta el 29 de septiembre de 2026 no se recupera.** Son los datos brutos
del observatorio.

### 5.2 · Código de paciente

`atlasCodigoPaciente(documento)` — línea 12224. Doble pasada FNV-1a con semillas distintas,
64 bits en base36: `1017894` → `CNV-1EXDIST0FDS68R`.

- Determinista: el mismo documento da siempre el mismo código, con puntos o sin ellos.
- No contiene el documento en claro.
- Probado con 40.000 documentos consecutivos sin una sola colisión.

> **Es seudonimización, no anonimización.** Quien tenga la base interna puede reidentificar —
> que es justamente lo que se pidió, para las auditorías de calidad. Pero significa que **OB
> BIA LATAM no puede declararse «anonimizado»** ante un comité de ética ni en la sección de
> métodos de una publicación. Es una distinción que un revisor sí mira.

### 5.3 · Los anexos viajan con la consulta

`atlasAnexosPaciente(doc)` — línea 12270. Recorre el almacenamiento y recoge todo lo que ATLAS
guarda de un paciente **fuera** de su consulta: plan nutricional, tratamientos, nutracéuticos
enviados, exámenes, citas y objetivos. Funciona con los tres patrones de clave que conviven
hoy: `atlas:plan:<doc>`, `atlas:nutra:<doc>:<prof>` y `atlas:exams_res:<doc>`.

Dos decisiones deliberadas:

- **Del plan se guarda la fórmula, no el menú de la semana.** El menú es texto largo, se
  reescribe en cada consulta y no aporta a la investigación. Guardarlo en cada registro
  llenaría el almacenamiento.
- **Los anexos se cuelgan solo de la consulta más reciente.** Son el estado actual del
  paciente; repetirlos en todas infla la tabla N veces con lo mismo.

### 5.4 · El disparador que hacía falta

Guardar el plan o despachar un nutracéutico **no toca** `atlas:<doc>`, así que la nube nunca
se enteraba. `atlasTocarPaciente(doc)` (línea 12259) reescribe la consulta para disparar la
sincronización, y está enganchado en el guardado del plan y en el despacho.

### 5.5 · Lo que NO se tocó

**`_isPatientKey` sigue igual.** Es el corazón de la sincronización. Los anexos viajan dentro
del blob `datos` de la consulta, así que **no hace falta ninguna migración en Supabase**: la
tabla `consultas` sigue con sus cinco columnas de siempre (`documento`, `nombre`,
`profesional`, `fecha_consulta`, `datos`).

Si más adelante quieres `codigoPaciente` como columna propia para indexar, es un `alter table`
de una línea; hoy va dentro de `datos`.

---

## 6 · CNVResearch

Quinta baldosa del inicio. Motor en la línea 20135, interfaz en la 20515, ruta en la 23653.

### 6.1 · Permisos

| | Dirección científica (cédula de Gildardo) | Consulta (PIN 1234 o documento de integrante) |
|---|---|---|
| Resumen y consolidados | Sí | Sí |
| Fila del paciente | Sí | No |
| Exportar | Sí | No |
| Modificar la base | — | — |

**Nadie puede manipular los datos, tampoco Gildardo: el motor no tiene una sola función de
escritura.** Hay una prueba automática que falla si alguien agrega un `setItem`, un `insert`
o un `update` al archivo del motor. Consérvala.

### 6.2 · Exportación

Cinco hojas: **Consultas, Encuesta, Nutracéuticos, Tratamientos y Diccionario**. Dos modos:

- **OB BIA LATAM** — seudonimizada: código de paciente, sin documento ni nombre.
- **Interna** — con documento y nombre, para auditar la calidad del dato. Pide confirmación
  explícita antes de generarse, diciendo cuántos pacientes identificados incluye.

Tres decisiones de diseño que conviene no deshacer:

1. **Nada se pierde en silencio.** Las columnas conocidas salen primero con su etiqueta, pero
   cualquier variable que aparezca en los datos y no esté en la lista **se anexa igual**. En
   un observatorio es peor perder una variable sin notarlo que mostrar una de más.
2. **La hoja Consultas lleva dos encabezados:** etiqueta legible arriba, nombre técnico del
   campo debajo. Es lo que permite reproducir un análisis meses después sin adivinar qué era
   cada columna.
3. **El diccionario dice qué se retiró, no solo qué queda.** En modo observatorio lista los
   identificadores excluidos como «RETIRADO de esta exportación por seudonimización». Sin esa
   lista, un revisor tendría que deducir la exclusión de una ausencia.

### 6.3 · La carga pagina de mil en mil

Supabase devuelve como máximo 1.000 filas por consulta. **Sin paginar, el día que la base pase
de mil consultas el módulo mostraría solo la primera página y nadie lo notaría** — el peor tipo
de error en investigación. Si tocas `cargarNube`, conserva el paginado.

---

## 7 · Lo que falta para ponerlo en línea

### 7.1 · Supabase Auth — es lo que desbloquea tres cosas

Hoy: PIN `1234` escrito en el HTML, más la cédula del propietario, más los últimos cuatro
dígitos del documento de cada integrante. Sirve para arrancar; no sirve en línea.

**La clave que ATLAS lleva dentro del archivo es pública.** Cualquiera que abra el HTML puede
leer y escribir la tabla `consultas` completa por fuera de los módulos. Eso significa que:

- La separación de CNVResearch es **de interfaz**, no de servidor.
- Los permisos de Bodega son **de interfaz**.
- La encuesta por QR sigue parada por lo mismo: el profesional no puede leer su cola.

**Resuélvelo una sola vez para todo ATLAS, no módulo por módulo.** Con Auth puesto, las
políticas RLS caen solas:

- dirección científica → lee todo, exporta;
- administrativo → lee los consolidados, no la fila del paciente;
- profesional → lee y escribe solo sus propios pacientes;
- nadie borra: `delete` sin política.

### 7.2 · Bodega sigue en `localStorage`

Viene de v10 y no cambió. El kardex vive en cinco claves del navegador, así que el inventario
es el de ese computador. El esquema propuesto y los cuatro puntos de corte del código están en
el documento de v10, sección 5. **Ojo con los consecutivos:** dos computadores generarían
`OC-2026-0001` los dos.

### 7.3 · Tienda virtual sin desplegar

Los cinco archivos de `cnv-corp` siguen en el árbol de trabajo, sin commit. Pasos en el
documento de v10, sección 4.3. Recordatorio del orden: **primero la tabla y el secreto de
eventos, después el despliegue.**

---

## 8 · Defectos vivos que NO se corrigieron, y por qué

Todos son anteriores a v11 y tocan código en funcionamiento. Quedan anotados para que los
decida Gildardo, no para que los arregles por tu cuenta.

| # | Qué | Efecto hoy |
|---|---|---|
| 1 | El motor clínico emite `MULTICELL BASE`, `HEPA DETOX` y `GUTIMMUNE PRO`; `NUTR_DOSIS` está indexada `MULTI-CELL BASE`, `HEPA-DETOX`, `GUT-IMMUNE PRO` | Esos tres productos muestran «Según criterio clínico» en vez de su dosis |
| 2 | `guardarConsulta` busca por `fecha`; Antropometría indexa por `fechaConsulta` | Riesgo de duplicar la consulta del día (ver 4.1) |
| 3 | La pestaña «Inventario» del módulo Administrador calcula el stock por su cuenta con la lista `-CELL` | Muestra cifras que no cuadran con Bodega CNV |
| 4 | `VITACELLEBIS_PRODUCTS` es código muerto | Si alguien la reactiva, descuenta de frascos que nadie entrega |

**Bodega ya es inmune al número 1:** normaliza el nombre al escribir el movimiento, así que
las tres grafías caen en un solo saldo.

---

## 9 · Lo que se probó

| Frente | Cobertura |
|---|---|
| Nutrición | 8 comprobaciones: plan nuevo, plan viejo derivado, caso sin datos (muestra guion, no un cero falso) y coherencia energética `prot×4 + grasa×9 + cho×4 ≈ kcal` |
| Guardado automático | 21: completitud (respondido, vacío, lista vacía, **el cero como respuesta válida**, opcionales que no bloquean), detección del Excel por cuatro vías, compuerta exigiendo las dos condiciones |
| Código y anexos | 17: determinismo, normalización, ausencia del documento en claro, 40.000 casos sin colisión; anexos sin el menú, sin mezclar pacientes, `null` cuando no hay nada |
| CNVResearch | 41: aplanado, IMC derivado, los ocho filtros y sus combinaciones, conteo de pacientes distintos, las cinco hojas, y que la exportación del observatorio **no lleve documento ni nombre** mientras la interna sí |
| Sintaxis | Los tres bloques `<script>`, tras cada etapa |

**No verificado: el recorrido visual de ninguna de las cuatro etapas.** Es la deuda que queda.
Lo primero que deberías hacer al recibir el archivo es abrirlo y recorrerlo.

---

## 10 · Orden sugerido de trabajo

1. **Abre `ATLAS_v11.html` y recórrelo.** Es la deuda de verificación (sección 9).
2. **Supabase Auth** (7.1). Desbloquea CNVResearch, Bodega y la encuesta por QR de una vez.
3. **Tienda virtual** (7.2): tabla, secreto de eventos, despliegue.
4. **Migrar el kardex de Bodega** a Supabase, con los consecutivos en la misma pasada.
5. Llevarle a Gildardo los cuatro defectos de la sección 8 para que decida.

Los puntos 5 y el consentimiento (que no menciona investigación, y debería si OB BIA LATAM va
a publicar) son decisiones suyas, no tareas técnicas. **No los ejecutes sin su visto bueno.**

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
