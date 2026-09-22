# Plan (O): traer a Atlas los pacientes atendidos con el HTML

**Estado: PLAN DE SESIONES, SIN EMPEZAR (2026-09-21).** La respuesta legal está archivada en
`docs/entregas/RESPUESTA_LEGAL_IMPORTACION_HTML_2026-09-21.md` y el cotejo de los dos consentimientos en
`docs/entregas/COTEJO_CONSENTIMIENTO_HTML_VS_ATLAS.md`.

---

## Lo que decidió el legal, en cinco líneas

1. **La historia clínica se importa por custodia** (Resolución 1995 de 1999): está cubierto.
2. **El consentimiento se importa como lo que es**: de origen HTML, con su versión, su texto y su hash. **No se
   marcan las casillas de Atlas.**
3. **El paciente importado se trabaja con normalidad**, y en su próxima consulta firma el consentimiento de
   Atlas de forma obligatoria.
4. **La fuente es el navegador de cada profesional**, con un botón de exportación en el HTML y una declaración
   suya. Es la única fuente que conserva la prueba de la firma.
5. **Los indicadores del HTML entran como registro**, sin recalcular ni sobrescribir.

## Lo que verifiqué antes de planear

- **El enlace de seguimiento tiene hoy el hueco que el legal describe, y peor.** Si el paciente no tiene
  consentimiento de Atlas, cae en el camino "sin firma" y la acción lo **bloquea** con un aviso de revocación.
  Un paciente importado quedaría atascado en vez de ver el consentimiento completo. Se arregla en la sesión 1.
- **El HTML no registra revocaciones en ninguna parte.** No hay pacientes que excluir por esa razón (el legal
  pedía verificarlo, punto 7).
- **Ningún paciente del HTML está en la nube** (dato de Santiago). No hace falta el caso "sin prueba de firma"
  para la nube, aunque el modelo lo admite.
- **Lo que guarda el HTML por paciente**: `atlas:<documento>` (la lista de consultas completa) y, aparte,
  citas, plan, protocolo, porciones, objetivo, exámenes y las notas de medicina, psicología y ejercicio.

## Las sesiones

### Sesión 1 · La regla del enlace y el consentimiento de origen HTML

- **La regla del legal, literal:** el enlace de seguimiento omite el consentimiento **solo** si el paciente
  tiene un consentimiento de Atlas vigente y sin cambio sustantivo posterior. En cualquier otro caso (origen
  HTML, ninguno, versión reemplazada) presenta el consentimiento completo con código. Candado.
- **Migración:** una tabla propia para los consentimientos de origen externo (paciente, origen, versión del
  texto, hash del texto, nombre tecleado, fecha de firma tal como se registró, profesional, "sin prueba de
  firma", quién y cuándo importó, lote). No toca `patient_consents` ni sus tipos.
- **El texto del HTML archivado** en el repositorio, versionado y con su hash, como los de Atlas.
- **La ficha del paciente importado lo dice:** "Consentimiento de origen HTML. Firmará el de Atlas en su
  próxima consulta."

### Sesión 2 · El exportador, en NUESTRA copia del HTML

- **No se toca el HTML de Gildardo:** se entrega una copia derivada (`ATLAS_v9` más el exportador) que Santiago
  distribuye a los integrantes.
- **El botón lista los pacientes del navegador**, el profesional marca cuáles exportar y **marca la
  declaración** del punto 8 del legal (le pidieron continuar en Atlas web, obtuvo su consentimiento con el texto
  del HTML, la exportación es fiel).
- **El archivo lleva todo**, incluida la etnia y la firma del consentimiento, más la declaración, la fecha, la
  versión del formato y un hash del contenido.
- **Candado** sobre una copia sintética del navegador: exporta lo que hay, no inventa y no pierde claves.

### Sesión 3 · La revisión, sin escribir nada

- **Pantalla para CNV** (solo admin, decisión de Santiago del 2026-09-21): toma el archivo que subió el profesional y elige la cuenta a la que se importa.
- **El informe:** qué pacientes y qué consultas trae; cuáles ya existen en Atlas por documento exacto (ante
  duda, el profesional confirma); qué respuestas no calzan con la encuesta vigente; quién es menor de edad; a
  quién le falta la prueba de firma.
- **No escribe nada**, y hay candado de eso.

### Sesión 4 · La importación

- **A la cuenta del profesional**, con procedencia "importado del HTML" y la fecha original de cada consulta.
- **Auditoría del lote**: quién, cuándo, cuántos, desde qué archivo (con su hash).
- **Los indicadores del HTML como registro**, sin recalcular.
- **Una decisión que tomar ahí** (abajo, pregunta 4).

### Sesión 5 · Smoke con datos sintéticos

- De punta a punta: exportar, revisar, importar, abrir la ficha, mandar el enlace de seguimiento y firmar el
  consentimiento de Atlas. La corrida con datos reales la hace Santiago.
- **El cierre** (retirar el HTML y purgar las copias locales con constancia) lo hace Santiago.

**Tamaño: cinco sesiones.** La 1 es independiente y se puede hacer ya; las demás esperan las respuestas de
abajo.

## Lo que respondió Santiago (2026-09-21) y lo que cambia en el plan

1. **El HTML se abre como archivo en el equipo, sin web.** Consecuencia técnica: el navegador guarda los datos
   por "origen", y con un archivo local ese origen puede ser el archivo mismo (Safari lo hace así). Un
   exportador en un archivo NUEVO podría no ver lo guardado por el viejo. **Por eso la sesión 2 entrega dos
   vías:** la copia con el exportador, para reemplazar el archivo en la MISMA carpeta y con el MISMO nombre, y
   un exportador de consola (un texto que se pega en las herramientas del navegador con el HTML viejo abierto)
   como respaldo si la primera no ve los datos. Las dos se prueban en la sesión 5.
2. **Navegadores: Chrome, Brave y Safari, en Windows y en Apple.** El smoke de la sesión 5 cubre los tres. Si
   alguien usó dos navegadores, exporta de cada uno y la revisión (sesión 3) muestra las consultas repetidas.
3. **Solo admin importa.** La pantalla de la sesión 3 es de admin (soporte no).
4. **Las consultas importadas entran a la trayectoria cuando tengan diagnóstico generado desde Atlas.** Se
   importan SIN diagnóstico; mientras no lo tengan, se ven en la ficha y en la historia como "importada del
   HTML", pero no son punto de la serie.
5. **Respuestas de la encuesta que no calzan con la vigente:** alerta para corregir, no se descartan. La
   revisión (sesión 3) las lista y, ya importadas, la consulta muestra el aviso hasta que se corrijan con el
   flujo de corrección que ya existe.
6. **El paciente ya existe en Atlas por cédula:** la importación no decide sola si una consulta es inicial o
   seguimiento (regla 18). Ordena las consultas por fecha y el profesional confirma.
7. **Selección en el exportador:** con "marcar todos" y "desmarcar todos".

**El BIS importado (verificado en el código, 2026-09-21).** La idea de Claude web (el BIS entra como medición
importada pendiente de confirmar, con las condiciones de la toma sin marcar, y el diagnóstico se genera al
entrar a trabajar la consulta) **no la soporta hoy el flujo tal cual**, y hay que construirla en la sesión 4:

- Hoy el orden lo impone la importación del XLSX: `bis/actions.ts` exige las condiciones de la toma
  respondidas ANTES de aceptar el archivo. Un BIS importado desde el HTML entra por otro camino y llegaría sin
  condiciones.
- Y el diagnóstico (`clinical-pipeline`) NO revisa las condiciones: exige BIS y encuesta completa, y congela
  los reparos de validez de las condiciones que haya. Sin condiciones, el diagnóstico saldría como si la toma
  no tuviera ningún reparo, que no es lo mismo que "no se registraron".
- **Lo que propongo construir (decides tú):** el BIS importado queda marcado "importado del HTML, condiciones no registradas", y
  generar el diagnóstico de esa consulta exige que el profesional capture las condiciones o declare que no se
  registraron (y eso se congela en el diagnóstico). Ningún número del BIS se recalcula.


## Cambio del 2026-09-22: el BIS ya no necesita un estado nuevo

Santiago simplificó el flujo general, para toda evaluación: el bloque de Medición BIS está siempre
disponible, y el botón **"Importar medición BIS"** es el único guardián. Si faltan las condiciones de la
toma, la encuesta al 100 % o el archivo no sirve (cintura, cadera, datos del motor), lo dice todo junto y no
deja pasar (`evaluarRequisitosDelImport`). **Esto reemplaza la propuesta de "condiciones no registradas"** de
la sección anterior: la consulta importada queda sin medición confirmada hasta que el profesional la importe
con todo completo, igual que cualquier otra. Nada nuevo en la base.

**A verificar cuando se retome la (O):** el navegador no deja precargar un campo de archivo. Si la medición
viene en el archivo de importación, se guarda del lado del servidor y "Importar medición BIS" la toma de ahí
en vez de pedir el XLSX.

## Revisión de Claude web y verificaciones (2026-09-22)

### Estado: la sesión 1 está HECHA

- **La regla del enlace:** `modoDelSeguimiento` (`consent/versions.ts`), candado en `consent-versions.test.ts`.
  Smoke de Santiago en local: pide el consentimiento con código cuando no hay uno vigente, y no lo pide cuando
  ya lo hay.
- **La tabla del consentimiento de origen HTML** y la del lote: migración `0159`, documentadas en
  `DATABASE.md` (grupo 2). Inmutable, fuera de `patient_consents`, y el gate de la regla 15 no la lee.
- **El texto archivado con su hash:** `consent/text/consent-html-cnv-v3.0.ts`. **Es el mismo texto en las 14
  versiones del HTML del repositorio** (julio a 21 de septiembre), así que todo paciente importado firmó este.
  El candado `consent-html-archivado.test.ts` comprueba que cada frase está en el HTML, que no se omitió nada
  del documento y que el texto no cambió entre versiones.
- **La ficha lo dice:** "Consentimiento de origen HTML. Firmará el de Atlas en su próxima consulta".

### La verificación del XLSX: el HTML guarda VALORES, no el archivo

El HTML lee el XLSX en el navegador (`importarComposicion`) y guarda en cada consulta **los valores ya leídos**
(con las mismas claves de nuestro `BIODY_COLUMNS`, que salió de esa función), más los índices que calculó. El
archivo no se conserva. Y **cintura y cadera no vienen del XLSX**: el HTML las toma de su antropometría manual.

Lo que cambia:
- Para los importados no hay archivo que subir: llega **una medición ya leída**. La pieza es "la medición
  leída, pendiente de importar", y el botón "Importar medición BIS" la toma de ahí.
- **Propongo que el flujo normal use la misma pieza.** En vez de guardar el XLSX (que trae nombre y fecha de
  nacimiento del paciente), al pulsar "Importar" con el archivo válido se guardan los valores ya leídos, sin
  los datos de identificación que el lector ya separa. Una sola pieza para los dos caminos, y ningún archivo
  con el nombre del paciente esperando. Necesita una tabla nueva; se construye en la sesión 4.
- **Cuándo se borra la medición pendiente:** al completar la importación; y también si la evaluación se
  cierra, se abandona o se reemplaza (va colgada de la evaluación, así que se va con ella).
- **La idea de Santiago va encima:** en la revisión (sesión 3), la medición de cada consulta se valida en ese
  momento, y el informe dice por paciente qué le falta (cintura, cadera, datos del motor) antes de que el
  profesional pulse nada.

### Los cuatro ajustes

- **a) Solo admin**, también en la sesión 3 (corregido arriba).
- **b) El canal del archivo.** El archivo de exportación lleva documento, etnia, salud y la firma: no puede
  viajar por correo ni por WhatsApp. **Propuesta: el profesional lo sube desde su propia cuenta de Atlas**, en
  una pantalla "Traer mis pacientes del HTML". Ya tiene sesión, así que no hace falta un enlace nuevo. El
  archivo queda en un espacio privado, lo ve solo admin para revisar e importar, y **se borra al terminar la
  importación del lote**, con constancia en el lote. Así "enviar a CNV" es subirlo a Atlas.
- **c) El cruce por documento.** El documento del HTML se tecleó a mano. Antes de comparar se normaliza
  (sin puntos, espacios, guiones ni ceros a la izquierda). Si hay coincidencia exacta normalizada, es el mismo
  paciente y el profesional confirma el orden (regla 18). Si solo hay parecido (un dígito distinto, mismo
  nombre y fecha de nacimiento), **no se une ni se crea nada**: la revisión lo muestra al admin como posible
  duplicado.
- **d) El mapeo de la encuesta. Existe, y es por clave.** Las 64 preguntas de la encuesta de Atlas tienen la
  misma clave que en el HTML (se portaron de ahí; verificado pregunta por pregunta, 64 de 64). Lo que puede no
  calzar son los **valores**: una consulta vieja pudo guardar una opción que la versión de hoy ya no tiene. La
  sesión 3 lo revisa opción por opción y la consulta queda con el aviso para corregir.

### Un hallazgo para el cierre: la copia en la nube del HTML

El HTML también sube cada consulta a una tabla `consultas` en un Supabase en la nube (la dirección y la clave
se retiraron de nuestra copia; están en el original). Esa copia lleva **documento, nombre, profesional, fecha y
todos los datos clínicos**; solo quita correo, teléfono y la firma. El cotejo del consentimiento ya la
mencionaba como "la nube de Gildardo".

- **Para el cierre (sesión 5):** retirar el HTML no basta; esa tabla también hay que purgarla, con constancia.
- **Para Santiago:** confirmar de quién es ese proyecto de Supabase y si el legal lo tuvo en cuenta.

## Decisiones de Santiago (2026-09-22, segunda ronda): esto manda sobre lo anterior

### El BIS del importado: la medición simplemente existe

- **El importado llega con su medición.** Se importa como medición de la evaluación, con la cintura y la
  cadera de la antropometría del HTML. Antrop. & BIS muestra la tabla de composición con la nota de que vino
  del HTML. **El profesional no vuelve a subir el XLSX**: eso queda para las evaluaciones siguientes.
- **La guarda se movió al diagnóstico, para los dos caminos (HECHO).** El diagnóstico ya exigía la encuesta
  completa; ahora exige también las condiciones de la toma guardadas y sin contraindicación
  (`condicionesParaDiagnosticar`, en `run-pipeline`). Así un importado con la encuesta completa y sin
  condiciones no se diagnostica "como si la toma no tuviera ningún reparo". Es la misma regla del botón de
  importar, en el sitio que ningún camino se salta. Las pruebas de base real siembran condiciones con
  `helpers/condiciones-bis.ts`.
- **La "medición leída pendiente" para el flujo normal** (que el archivo no se pierda al cambiar de pestaña)
  queda para después. No bloquea la importación.

### El canal: el profesional manda el archivo como le quede fácil

- **Por correo o por WhatsApp.** Pedirles subirlo a Atlas es fricción y formación que hoy no toca.
- **Riesgo aceptado** (el archivo lleva documento, etnia, salud y la firma), **con dos mitigaciones que no le
  cuestan nada al profesional:** el archivo se borra de Atlas al terminar el lote, con constancia; y el admin
  borra el mensaje del correo o del chat cuando lo importa.
- **Sin cifrado por ahora.** Cifrar con una clave mostrada en pantalla obliga al profesional a mandar la clave
  por otro lado: es un paso más, y la decisión fue no añadirlos.

### El cierre (sesión 5), con constancia

- Retirar el HTML y purgar las copias locales (Santiago).
- **Borrar el Supabase del HTML** (tabla `consultas`): es de una cuenta de CNV, de prueba, y no alimenta nada.
  Santiago le pide a Gildardo que lo borre; se deja constancia.

## Estado: la sesión 2 está HECHA (2026-09-22)

- **El exportador:** `scripts/exportador-html/exportador.js`, inyectado en nuestra copia del v9 por
  `scripts/exportador-html/construir.mjs` (el archivo de Gildardo no se toca). Lista los pacientes del
  navegador, marcar y desmarcar todos, las tres declaraciones del punto 8 del legal, y descarga el archivo.
- **Fiel:** copia cada valor tal cual está guardado (la historia, sus claves relacionadas del BIS, la
  antropometría y el plan, y la sesión del profesional), sin leerlo ni reescribirlo. Lee el navegador directo,
  no la nube, porque la nube no lleva la firma.
- **Lo que se distribuye:** `docs/distribucion/exportador-html/` con la copia (`ATLAS_v9.html`), el script para
  la consola y las instrucciones para los integrantes.
- **Candado:** `exportador-html.test.ts`, sobre un navegador sintético (exporta lo que hay, no inventa, no
  pierde claves ni mezcla pacientes de documento parecido) y sobre la copia (el HTML intacto más el exportador,
  al día con el script).
- **Pendiente de un navegador real:** el smoke en Chrome, Brave y Safari va en la sesión 5.

## Estado: la sesión 3 está HECHA (2026-09-22)

- **La pantalla:** `/admin/importar-html` (solo admin, `canImportFromHtml`; en el menú de administración como
  "Importar del HTML"). Se sube el archivo que mandó el profesional y muestra el informe. **No guarda nada**:
  ni base ni almacenamiento; el archivo se lee en memoria.
- **El informe, por paciente:** si ya existe en Atlas (documento normalizado), si se parece a otro (un dígito
  distinto, o mismo nombre y fecha de nacimiento: no se une ni se crea), si era menor al firmar, y por cada
  consulta: la firma del consentimiento, las respuestas que no calzan con la encuesta de hoy ("Otra: texto"
  calza), cuántas quedaron sin responder y si la medición trae lo que exigen el motor y la regla de negocio
  (cintura y cadera). Avisa si el archivo trae el mismo documento dos veces.
- **Candado:** `importacion-html-revision.test.ts`, de punta a punta con el exportador real, más que ningún
  archivo del módulo escribe y que solo lo ve admin.
- **El selector de la cuenta de destino** va en la sesión 4, al importar: la revisión no depende de él.

## La revisión, ajustada con los dos archivos reales de Santiago (2026-09-22)

Los dos JSON que exportó Santiago (no entran al repositorio: `.gitignore`) destaparon seis cosas; las seis
quedaron en `revisar-lote.ts` con su candado, y se comprobó el informe contra los dos archivos:

1. **Cintura y cadera:** la cadena de `_circAnt` del v9 (L7513): la consulta, el Excel guardado
   (`atlas_bis_<doc>`) y lo guardado a mano (`atlas:antro:<doc>`), con su `atlasCirc` (20 cm o menos no es una
   medida). Las dos últimas son una por paciente: solo respaldan su consulta más reciente, y el informe lo dice.
2. **El informe enviado al paciente** (`informePaciente`, sin `fechaConsulta`) no es una consulta: se separa y
   se lista aparte. Trae el resumen de IA del HTML y lo que se le mostró al paciente.
3. **Las respuestas de versiones viejas:** se comparan con las opciones de todas las versiones de la encuesta
   de Atlas ("Gluten" de v2 a v5); "Otras" calza con "Otra".
4. **Fecha de nacimiento imposible** (posterior a la primera consulta): se distingue de "menor de edad".
5. **Consultas de otro profesional:** cada consulta dice quién la hizo, y se marca la que no hizo quien exportó.
6. **La firma con otro nombre** ("dsadsads" por "Santiago"): se marca; es una firma más débil.

## Lo que se resuelve en la sesión 4 (propuesta, antes de construir)

- **El mismo documento en dos archivos** (el 12345 venía en los dos, con datos distintos): la importación
  consulta los lotes ya importados. Si el documento ya entró por otro lote, no se vuelve a crear el paciente: el
  admin ve las consultas que ya están y las que el segundo archivo agrega, y confirma.
- **Las consultas de otro profesional:** el admin asigna cada nombre que aparece en el archivo a una cuenta de
  Atlas ("Frank Carrera" a la cuenta de Frank). La consulta queda a nombre de quien la hizo, y se crea la
  relación de ese paciente con cada profesional que lo atendió. Si ese profesional no tiene cuenta en Atlas, la
  consulta no se importa hasta que la tenga, o el admin decide a quién queda asignada, con constancia.
- **El informe enviado al paciente:** se conserva como documento importado (custodia de la historia clínica),
  sin que cuente como consulta ni entre a la trayectoria.

## Las tres decisiones de la sesión 4 (Santiago, 2026-09-22)

1. **El mismo documento en dos archivos:** la importación revisa los lotes ya importados. Si el documento ya
   entró, no se crea otro paciente; el admin ve qué consultas ya están y cuáles agrega el archivo nuevo.
2. **La cuenta del profesional la decide el admin, no el archivo.** Muchos nombres se escribieron en pruebas
   (a veces el de Gildardo, porque él estaba explicando) y algunos de esos profesionales ni existen. El nombre
   del archivo es informativo: la revisión lo muestra y no sugiere ninguna cuenta.
3. **El informe enviado al paciente NO se importa.** Puede ser de prácticas, y además lo escribió el motor del
   HTML, con recomendaciones que Atlas ya no admite ("la estrategia clínica debe priorizar..."). Si entrara a
   la historia, algún día alguien lo leería como nuestro. La revisión dice que existe y que se queda fuera.

Y la firma con un nombre distinto al del paciente queda como **dato menor**, no como alerta: en Atlas la firma
va con código; en el HTML era un nombre tecleado.

## Estado: la sesión 4 está HECHA (2026-09-22)

**Lo que escribe, por consulta del HTML, todo en UNA transacción por lote** (`importar-lote-writer`):
`html_import_batches` (el lote), `patients` + `patient_profiles` + `patient_contacts` (solo si el paciente es
nuevo), `patient_professional_relationships` con la cuenta que elige el admin, `evaluations` **con la fecha
original** (`created_at` es la fecha de la consulta en toda la app), `survey_responses` + `survey_answers`,
`bis_measurements` + `bis_raw_values` (ningún número se recalcula) y `patient_external_consents`, **también
cuando la consulta no traía firma**, marcada "sin prueba de firma" (migración 0162). Y `clinical_audit_log`
por consulta, inline.

**Lo que NO escribe:** diagnóstico, tratamiento, reporte, condiciones de la toma BIS, ni el informe que el
HTML le envió al paciente.

**Las cuatro verificaciones de Claude web:**
- **(a) Deshacer un lote:** `revertirLote` retira sus consultas (con sus respuestas y su medición, por
  cascada), sus consentimientos de origen HTML y **solo los pacientes que el lote creó**; a uno que ya existía
  se le quitan las consultas, no la ficha. No se puede deshacer si alguna consulta ya tiene diagnóstico: eso ya
  es trabajo clínico. La fila del lote se conserva, marcada con quién y cuándo lo deshizo.
- **(b) La columna de pendientes** dice "Importada del HTML: registrar condiciones", no "Montar BIS".
- **(c) El orden inicial/seguimiento:** si el paciente ya tiene evaluaciones en Atlas, **todas** las
  importadas entran como seguimiento, aunque sean anteriores. Solo un paciente nuevo estrena inicial.
- **(d) Las consultas sin firma** se importan igual, con el consentimiento marcado "sin prueba de firma".

**Y el mismo documento en dos archivos:** una consulta del mismo paciente y la misma fecha ya importada no se
duplica; el resumen dice cuáles se omitieron.

## El smoke con datos sintéticos (sesión 5, primera parte)

Hay un archivo de ejemplo con pacientes inventados: `docs/distribucion/exportador-html/ejemplo-sintetico.json`
(se regenera con `node scripts/exportador-html/ejemplo-sintetico.mjs`). Trae los casos que importan: un
paciente con dos consultas y la cintura solo en lo guardado a mano, uno sin firma y con un informe enviado, y
uno sin medición.

**Los pasos, en "Importar del HTML":**
1. Súbelo y pulsa **Revisar el archivo**. Debe decir 3 pacientes, 4 consultas, 1 sin firma, y en SINT-002 que
   trae un informe que no se importa.
2. Elige una cuenta de profesional y pulsa **Importar a esa cuenta**. Debe decir 4 consultas y 3 pacientes
   nuevos.
3. Abre la lista de pacientes con esa cuenta: los tres aparecen, con "Sin autorización vigente" y con
   **"Importada del HTML: registrar condiciones"** en la columna de pendientes.
4. Abre SINT-001: dos consultas con sus fechas (13 de agosto y 4 de septiembre), la tabla de composición ya
   calculada, y en la ficha "Consentimiento de origen HTML".
5. Pulsa generar diagnóstico: debe decir lo que falta, no generarlo.
6. Vuelve a subir el MISMO archivo e impórtalo otra vez: debe decir que no repitió ninguna consulta.
7. Pulsa **Deshacer este lote**: los tres pacientes desaparecen de la lista.
