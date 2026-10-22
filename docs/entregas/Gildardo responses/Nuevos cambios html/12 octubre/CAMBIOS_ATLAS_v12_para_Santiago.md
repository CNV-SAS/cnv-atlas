# ATLAS v12 — Cambios que debe llevar al software

**Archivo:** `ATLAS_v12.html` (24.826 líneas · 1,56 MB) · **Base:** `ATLAS_v11.html`, sin modificar
**Fecha:** 12 de octubre de 2026 · **Para:** Equipo ATLAS — Santiago
**De:** Gildardo Uribe — Dirección Científica CNV

---

Santiago: v12 es el prototipo de seis ajustes que pedí sobre v11. Frente a v11 son **573 líneas
agregadas y 73 retiradas, en 32 bloques**. El software debe quedar como este archivo: ni más ni
menos. Cada sección dice qué cambia, dónde está en el HTML y qué tiene que resolverse del lado
del servidor, que es lo que el HTML no puede hacer solo.

No se tocó el consentimiento, ni los clasificadores, ni los umbrales diagnósticos, ni la IA, ni
Bodega, ni CNVResearch, ni la impresión del plan nutricional.

---

## Resumen

| # | Cambio | Estado en v12 | Lo que le toca a Santiago |
|---|---|---|---|
| 1 | Lista de pacientes: orden por último evaluado | **Hecho** | Ordenar en la consulta al servidor |
| 1 | Eliminar perfil | **Hecho en el equipo** | Borrado en servidor con política y auditoría |
| 1 | Eliminar toma de BIS | **Hecho** | Mismo criterio de campos en el backend |
| 2 | Control de calidad biológico (Cole-Cole y antropometría) | **Hecho** | Portarlo; **límites pendientes de Gildardo** |
| 3 | Se retira la pantalla intermedia: directo a la encuesta | **Hecho** | Retirar `ModEncuestaEstado` |
| 4 | Diana EFR en colores de semáforo | **Hecho** | Portarlo; **cortes pendientes de Gildardo** |
| 5 | Todo se calcula solo al subir el Excel | **Revisado** | Ver sección 5 |
| 6 | Nutricionista: flujo guiado en orden | **Hecho** | Portarlo tal cual; impresión intacta |
| 6 | Harris-Benedict sobre peso meta + 10 % | **Hecho** | Mismo motor en el backend |

---

## 1 · Lista de pacientes

### 1.1 · Primero el último evaluado

La lista salía en orden alfabético. Ahora sale **por la última consulta, la más reciente arriba**;
el nombre solo desempata. Línea 23691.

En producción el orden debe venir de la consulta al servidor (`order by` sobre la marca de
tiempo de la última consulta), no de ordenar en el navegador una lista ya descargada.

### 1.2 · Eliminar perfil

Cada fila tiene ahora **«Eliminar perfil»**, en una segunda línea para que no se pulse por error.
Es irreversible, así que no basta un «Aceptar»: **hay que escribir el número de documento del
paciente**. Si no coincide, no se borra nada.

| Qué | Dónde |
|---|---|
| `atlasEliminarPerfil(documento)` | línea 23176 |
| Manejador y confirmación | línea 23759 |

Qué borra: la consulta del paciente y todo lo que cuelga de su documento (antropometría manual,
plan, objetivo, exámenes, citas). **Qué NO borra, a propósito:** inventario, consignaciones y el
registro de nutracéuticos despachados. Eso es contabilidad de Bodega, no historia del paciente,
y si se borrara el kardex dejaría de cuadrar.

**Lo que el HTML no puede resolver y te toca:**

1. **El borrado en la base compartida.** v12 pide el `delete` sobre `consultas`, pero con la
   clave pública eso depende de una política que hoy no existe. En el documento de v11 dijimos
   «nadie borra: `delete` sin política». Ahora sí se borra, así que la política tiene que
   existir y ser **solo para el profesional dueño del paciente y para la dirección científica**.
2. **Los otros equipos.** v12 deja una marca local (`atlas:_eliminados`) para que el perfil no
   reaparezca cuando la nube lo vuelva a devolver. Pero esa marca vive en un solo computador: si
   otro equipo tiene al paciente guardado, lo vuelve a subir. La solución real es de servidor.
3. **Auditoría.** Quién borró, cuándo y a quién. Hoy no queda rastro en ninguna parte.

> **Decisión que es mía y no tuya:** la historia clínica tiene tiempos legales de conservación.
> Antes de llevar esto a producción voy a definir si «eliminar perfil» borra de verdad o si
> archiva y oculta. **Constrúyelo como borrado lógico** (una marca de eliminado con fecha y
> autor) hasta que yo lo confirme: así sirve para cualquiera de las dos respuestas.

### 1.3 · Eliminar toma

El botón **«Eliminar toma BIS»** aparece solo en los pacientes cuya última consulta tiene
bioimpedancia. Sirve para el caso del control: la toma quedó mal, se borra y el profesional la
vuelve a subir. **Solo se elimina la toma de BIS.**

| Se borra | Se conserva |
|---|---|
| Todo lo que entró por el Excel del Biodymanager | La encuesta completa y el consentimiento |
| Los datos de espectroscopía y su imagen | Peso, talla, cintura, cadera, dinamometría y peso meta |
| Los índices derivados (IFC, IRC, PABU, ISCM, IEHH, IAE…) | La verificación de condiciones de la toma |
| Las referencias y deltas de la tabla de Wang | El plan, las notas y el resto de la consulta |

La lista exacta de lo que se borra es `ATLAS_CAMPOS_BIS` (línea 23138): **134 campos**. No se
escribió a mano: se generó del propio archivo, leyendo `importarComposicion`,
`derivarFaltantes` y el envío de `onBisReady`. **Si agregas un campo a la importación, tiene
que entrar en esa lista**, o sobrevivirá al borrado.

Queda rastro: la consulta guarda `bisEliminada` con la fecha y el profesional.

> **Un efecto que hay que conocer.** El análisis de IA del diagnóstico se conserva, y se
> escribió con la toma que se acaba de borrar. No lo quité porque la instrucción es borrar
> solo la BIS. Cuando el profesional suba la nueva toma debe regenerarlo. En el software
> conviene marcarlo como «generado con una toma anterior» hasta que se regenere.

---

## 2 · Control de calidad biológico

**El problema.** Los profesionales no están mirando la curva de Cole. Suben el Excel y siguen.

**Lo que hace v12.** Al subir el Excel —o al capturar la espectroscopía, o al digitar la
antropometría— el sistema revisa la medición y, si encuentra algo, lo dice **antes de dejar
pasar a Diagnóstico**. No hay botón: se recalcula solo con cada dato.

| Qué | Dónde |
|---|---|
| `QC_BIO_LIMITES` — los límites, todos en un bloque | línea 6329 |
| `atlasQCBiologico(d)` — el motor, función pura | línea 6336 |
| Cálculo dentro de Antropometría | línea 7151 |
| Panel en pantalla | línea 7712 |
| Corta-piso en la navegación | línea 23268 |

Hay dos clases de hallazgo, y la diferencia importa:

**«Imposible»** — viola una identidad física o del modelo. No depende de ningún umbral.

- Re no es mayor que R∞ (la resistencia baja al subir la frecuencia).
- La reactancia del centro del círculo es positiva.
- Rc no coincide con (Re + R∞)/2: los parámetros no pertenecen al mismo arco.
- La impedancia sube con la frecuencia (Z a 200 kHz mayor que Z a 5 kHz).
- Algún parámetro de Cole es negativo.
- Masa grasa igual o mayor que el peso; masa sin grasa mayor que el peso.
- Masa grasa más masa sin grasa no suma el peso.
- Agua total igual o mayor que la masa sin grasa.
- Agua extracelular más intracelular no suma el agua total.
- Masa muscular o masa celular activa igual o mayor que la masa sin grasa.

**«Fuera de rango»** — el valor existe pero cae fuera de `QC_BIO_LIMITES`: talla, peso, IMC,
cintura, cadera, fuerza prensil, Re, Ri, R∞, capacitancia, frecuencia característica, ángulo de
fase, porcentaje de grasa e hidratación de la masa sin grasa.

**Cómo corta el piso.** El panel sale en rojo encima de la importación y la navegación no deja
salir de Antropometría. El profesional tiene dos caminos: corregir el dato o volver a subir el
Excel —y el panel desaparece solo—, o pulsar *«Revisé la curva de Cole y los datos: continuar
con esta medición»*. Ese visto bueno viaja con la consulta (`qcBioVisto`), así que no se vuelve
a pedir al reabrir el módulo. Si después cambia un dato y aparece un hallazgo distinto, se pide
de nuevo.

> **PENDIENTE DE VALIDACIÓN — los números de `QC_BIO_LIMITES` no están aprobados.** Los puse
> anchos a propósito, para atrapar errores de digitación y tomas fallidas, no como cortes
> diagnósticos: Re 200–1.500 Ω · Ri 300–5.000 Ω · R∞ 100–1.200 Ω · C 0,3–10 nF · Fo 10–150 kHz
> · AF 2–12° · talla 100–230 cm · peso 25–300 kg · IMC 10–80 · cintura 40–220 cm · cadera
> 50–220 cm · fuerza prensil 1–90 kgf · grasa 2–70 % · hidratación de la masa sin grasa 60–85 %.
> **Deben reemplazarse por los percentiles extremos de la cohorte real.** Santiago: saca del
> observatorio el percentil 0,5 y el 99,5 de cada variable y me los traes; yo los firmo. Las
> identidades de la lista «imposible» sí son definitivas.

Dos reglas de diseño que no hay que deshacer:

1. **Cero y vacío significan «sin dato», no hallazgo.** Un parámetro sin capturar llega como 0;
   si se tratara como valor, toda consulta sin espectroscopía saldría en rojo.
2. **El control avisa y frena, pero no decide.** La decisión de continuar es del profesional y
   queda registrada. No lo conviertas en un bloqueo sin salida.

---

## 3 · Se retira la pantalla intermedia

Al pulsar «Revisar», «Nueva consulta» o «Nuevo paciente» se llegaba a una pantalla de estado
(buscar paciente, tarjeta de consentimiento, lista de preguntas pendientes) y desde ahí había
que pulsar otra vez para entrar a la encuesta. **Sobraba. Ahora se entra directo a la encuesta.**

| Qué | Dónde |
|---|---|
| El módulo Encuesta monta `ModEncuesta` | línea 24754 |
| `ModEncuesta` recibe `onCambio` | líneas 3554 y 3570 |
| `ModEncuestaEstado` | línea 12653 — **quedó sin uso, retíralo** |

Tres cosas que esa pantalla hacía y a dónde fueron:

- **Preguntas pendientes:** la encuesta ya las muestra en su propio encabezado (el porcentaje es
  un botón que las lista). No se perdió nada.
- **Buscar paciente:** era un duplicado de la lista de pacientes.
- **Verificación de condiciones de la toma de BIA** (placas metálicas, prótesis, marcapasos,
  ayuno, ejercicio, diurético, embarazo, ciclo). **Esta no se podía perder: es un control de
  seguridad.** Pasó al módulo de Antropometría, encima de la importación, que es donde
  corresponde: se verifica justo antes de subir la bioimpedancia. Línea 24765.

Un cambio técnico que acompaña a este: como ya no hay pantalla previa, **la encuesta sube cada
cambio al paciente en curso** (`onCambio`). Antes solo lo hacía al pulsar «Finalizar», y si el
profesional saltaba a otro módulo por la barra superior perdía lo escrito.

---

## 4 · Diana EFR en colores de semáforo

**El defecto.** La Diana usaba un degradado continuo de diez tonos. Los estados leves caían en
verde lima y se leían como «bien».

**Lo que se hizo.** Cuatro bandas, sin degradado. Línea 13407.

| Color | Significado | Celdas de las 81 |
|---|---|---|
| Blanco (centro) | Excepcional | — |
| Verde | Bien | 10 |
| Amarillo | Leve · alerta temprana | 26 |
| Naranja | Moderado · a vigilar | 17 |
| Rojo | A tratar | 28 |

La leyenda de la barra lateral pasó de «Óptimo · Moderado · Riesgo máximo» a **«Bien · Leve ·
Moderado · A tratar»**.

> **PENDIENTE DE VALIDACIÓN — los cortes entre bandas.** La posición de cada celda es la suma
> del rango del anillo (1 a 9) y del sector (1 a 9), llevada a una escala de 0 a 1. Los cortes
> que puse son **0,19 · 0,45 · 0,62**, es decir: suma hasta 5 verde, 6 a 9 amarillo, 10 y 11
> naranja, 12 en adelante rojo. Los escogí para que el rojo empiece donde ya empezaba en el
> degradado anterior. Son tres números en una sola función; los confirmo o los muevo yo.

**No se tocó** el radar de cinco dominios ni las tarjetas del DFI: ya estaban en verde, ámbar,
naranja y rojo. Si se quiere el mismo amarillo de la Diana en el radar, es cambiar un color en
`_RAD_ZONE_FILL` y `_DFI_SEVC`; no lo hice porque no estaba pedido.

---

## 5 · Todo se calcula solo al subir el Excel

La regla: **una vez subido el Excel del BIS, todo se calcula sin que el profesional pulse nada.**
Las dos excepciones son el DFI por IA y el módulo del nutricionista.

Revisé v12 buscando botones de «calcular», «generar», «aprobar», «confirmar», «sugerir» y
«distribuir». Lo que queda con intervención manual después del Excel es esto, y nada más:

| Dónde | Qué pide | Se queda |
|---|---|---|
| Antropometría | Confirmar la espectroscopía capturada | Sí — solo con el export del Biody BIS, que no trae Cole-Cole |
| Antropometría | Visto bueno del control de calidad | Sí — solo si hay hallazgos (sección 2) |
| Diagnóstico | Generar el análisis con IA | Sí — es la excepción prevista |
| Nutricionista | Tres aprobaciones del flujo | Sí — es la excepción prevista (sección 6) |
| Todos | Botón «Guardar» | Sí — Antropometría y Diagnóstico ya guardan solos desde v11 |

En el módulo del nutricionista sí había clics que sobraban, y se quitaron: ya no hay que pulsar
«Distribuir porciones» para ver las porciones, ni «Sugerir distribución» para repartirlas por
tiempos. Los dos botones siguen ahí, pero como «volver a calcular», no como paso obligado.

**Para el software:** que ningún módulo nuevo agregue un botón de calcular. Si un dato depende
de otro, se recalcula al cambiar el otro.

---

## 6 · Nutricionista

### 6.1 · El motor calórico

**Seguía apareciendo Mifflin. Ya no.**

| Antes (v11) | Ahora (v12) |
|---|---|
| TMB por Mifflin-St Jeor sobre el peso meta | TMB por **Harris-Benedict sobre el peso meta** |
| Gasto total = TMB × factor de actividad | Gasto total = TMB × factor de actividad **+ 10 % de termogénesis** |

Está en `motorTratNutri`, líneas 16667 a 16676. El motor devuelve ahora el desglose completo:
`geb`, `getAct` (TMB × actividad), `eta` (el 10 %) y `get`.

- **El Biody Xpert calcula su TMB y su gasto sobre el peso actual.** Por eso se muestran como
  referencia arriba del todo, pero el plan no se prescribe con ellos: se prescribe con
  Harris-Benedict sobre el peso meta.
- **El peso meta es el de Antropometría.** Es el mismo dato, no otro. Si el nutricionista lo
  ajusta en el plan, también cambia en Antropometría.
- **El factor de actividad lo escoge el profesional.** El sistema marca el recomendado —el que
  sale de la prescripción de ejercicio— y el 10 % se suma solo.
- No se escribió una fórmula nueva: se usa `gebHarris`, que ya estaba en el archivo (línea 2771).

> **Dos precisiones que voy a confirmar yo.** (1) `gebHarris` trae los coeficientes de la
> revisión de 1984 (88,362 / 447,593), no los originales de 1919. (2) El 10 % se aplica sobre
> TMB × actividad. Si alguna de las dos cambia, es una línea cada una.

**Cambia el número en todo el sistema**, no solo en la pantalla del nutricionista: la historia
clínica y el reporte leen el mismo motor. Ejemplo verificado: mujer de 40 años, 160 cm, peso
meta 62 kg, actividad ligera → TMB 1.343 · con actividad 1.847 · más 10 % → 2.032 kcal.

### 6.2 · El flujo guiado

Lo que había: resumen clínico y meta terapéutica de entrada, y después todas las secciones a la
vez, con botones que había que ir pulsando. **Demasiados corta-pisos y sin orden.**

Lo que hay ahora, en este orden. Cada paso aparece cuando el anterior quedó listo.

| Paso | Qué muestra | Qué hace el profesional |
|---|---|---|
| 1 · Recomendaciones del sistema | TMB y gasto del Biody Xpert · Harris-Benedict sobre peso meta · factor de actividad · recomendaciones por nutriente, por enfermedad, por hallazgos del DFI, por alimentación y por antecedentes | **Dejar tal cual** o **Modificar** |
| 2 · Fórmula sintética sugerida | Calorías · proteína en g/kg · grasa total · carbohidratos por diferencia | Edita lo que quiera y aprueba |
| 3 · Objetivo del tratamiento | La recomendación del sistema, editable | Escribe encima si quiere |
| 4 · Porciones e ICN | Lista de intercambio con porciones ya calculadas y la validación con ICN | Ajusta porciones y aprueba |
| 5 · Tiempos de comida | Leyenda «Tiempos de comida» con los seis tiempos | Escoge, y la distribución se despliega sola |
| 6 · Ejemplo de menú | El menú semanal | — |

Las reglas, tal como las pedí:

- **Si deja las recomendaciones tal cual, el ICN aparece de inmediato.** Un solo clic aprueba
  recomendaciones y fórmula, calcula las porciones y muestra el ICN.
- **Si modifica, todo se recalcula solo.** Al mover calorías, proteína o grasa, los carbohidratos
  salen por diferencia; al cambiar las calorías, las porciones y la distribución se rehacen.
- **Al cambiar el peso meta o el factor de actividad, se suelta la cifra manual de calorías**,
  para que el objetivo vuelva a seguir al cálculo. Sin esto, una cifra escrita a mano dejaba el
  plan clavado aunque el gasto cambiara. Queda un enlace para volver a las calorías calculadas.
- **El objetivo no aparece antes de la fórmula.** Lo pone el nutricionista; el sistema solo le
  propone uno.
- **Resumen clínico y meta terapéutica ya no salen en pantalla.** Siguen en la impresión.
- **Son tres aprobaciones en total**, o dos si deja las recomendaciones tal cual.

| Qué | Dónde |
|---|---|
| Estado del flujo, por paciente y por consulta | línea 21065 · clave `atlas:plan_flujo:<documento>:<fecha>` |
| Definición de los seis pasos | líneas 22206 a 22420 |
| Qué se dibuja en pantalla y qué en la impresión | línea 22419 |

Un plan hecho antes de v12 entra con todos los pasos aprobados, para que nadie tenga que
recorrerlo otra vez.

### 6.3 · La impresión sale igual

**No cambió.** El flujo guiado es solo de pantalla. La impresión tiene su propio bloque, con las
mismas secciones y en el mismo orden que v11: encabezado, resumen clínico, meta terapéutica,
objetivo, validación con ICN, lista de intercambio con porciones, distribución por tiempos,
menú, recomendaciones personalizadas y la lista de intercambio del paciente.

> **No unifiques los dos bloques.** Parece duplicación y no lo es: es lo que permite reordenar
> la pantalla sin mover una coma del impreso. Si los fusionas, cada ajuste de pantalla vuelve a
> cambiar lo que recibe el paciente.

### 6.4 · Lo que se retiró

La tabla vieja de la fórmula sintética (`filasFx` y la tarjeta `secD`). La reemplaza el paso 2.
No se imprimía, así que el impreso no la echa de menos.

---

## 7 · Lo que se probó y lo que no

| Frente | Cómo |
|---|---|
| Sintaxis | Los tres bloques `<script>` de v12 compilan; el balance de llaves y corchetes es idéntico al de v11 |
| Control de calidad | 14 comprobaciones sobre el motor real: paciente sano sin hallazgos, cada identidad violada una por una, cada rango, y que el cero no cuente como hallazgo |
| Motor calórico | 8 comprobaciones: Harris-Benedict contra el cálculo a mano, peso meta de Antropometría, peso meta editado, 10 % y suma |
| Eliminar toma y perfil | 17 comprobaciones: qué se conserva, qué se va, que no toque a otro paciente ni un documento parecido, ni Bodega ni el despacho |
| Navegador | Recorrido real con un paciente de prueba: orden de la lista y botones, entrada directa a la encuesta, verificación de la toma en Antropometría, panel de control de calidad con un peso mal digitado, y el flujo del nutricionista completo de principio a fin |
| Diana | Se ejecutó su código y se contaron las 81 celdas por color |

**No verificado, y es tu primera tarea al recibir el archivo:**

1. **La impresión del plan, sobre papel o PDF.** Se comprobó que el bloque de impresión contiene
   las mismas secciones que v11; no se comparó una hoja contra la otra.
2. **El corta-piso de navegación del control de calidad**, en vivo. La lógica es de cuatro
   líneas y el panel sí se probó, pero el salto bloqueado no se pulsó en navegador.
3. **La Diana a la vista.** Los colores se verificaron por código, no mirándola.
4. **Una importación con un Excel real** que traiga una curva de Cole mala.
5. **El borrado en la base compartida**: el proyecto de Supabase sigue sin responder.

---

## 8 · Defectos que vi y no corregí

No estaban en la lista, así que quedan anotados. Los decido yo.

| # | Qué | Efecto |
|---|---|---|
| 1 | El menú de ejemplo se sortea de nuevo cada vez que la pantalla se redibuja | Mientras el profesional escribe en otro campo, el menú cambia solo. Viene de antes de v12 |
| 2 | El aviso de síndrome de realimentación lo emite `motorProtocolo`, el motor viejo, no `motorTratNutri` | Dos motores opinando sobre el mismo paciente. En el caso de prueba salió en una paciente con obesidad |
| 3 | `guardarEnPC` sigue escribiendo `version: 'ATLAS_v7'` en el archivo que exporta | Solo es un rótulo, pero confunde al leer un respaldo |
| 4 | Los cuatro defectos de la sección 8 del documento de v11 siguen vivos | Sin cambio |

---

## 9 · Orden sugerido de trabajo

1. **Abre `ATLAS_v12.html` y recórrelo**, empezando por las cinco verificaciones de la sección 7.
2. **Lista de pacientes y entrada directa a la encuesta** (secciones 1.1 y 3). Son las más
   simples y las que más se notan.
3. **Control de calidad** (sección 2), con los límites provisionales. En paralelo, sácame los
   percentiles de la cohorte.
4. **Motor calórico y flujo del nutricionista** (sección 6). Es el cambio más grande.
5. **Diana** (sección 4).
6. **Eliminar toma** (1.3) y después **eliminar perfil** (1.2), este último como borrado lógico
   y con la política de servidor.

Lo que espera mi confirmación antes de producción: los límites del control de calidad, los
cortes de la Diana, la versión de Harris-Benedict y la base del 10 %, y si eliminar perfil borra
o archiva. **No los des por cerrados hasta que yo los firme.**

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
