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

- **Pantalla para CNV** (admin/soporte): sube el archivo y elige la cuenta del profesional.
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

**Estado de la sesión 1:** la regla del enlace está hecha (`modoDelSeguimiento` en `consent/versions.ts`,
candado en `consent-versions.test.ts`). Falta la tabla del consentimiento de origen HTML y su texto archivado.

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
