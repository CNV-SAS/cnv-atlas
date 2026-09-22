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

## Lo que necesito de Santiago antes de la sesión 2

1. **¿Cómo abren el HTML los integrantes: como archivo en su equipo, o desde una dirección web?** Decide cómo
   funciona el exportador: el navegador solo deja leer lo guardado desde el mismo sitio donde se guardó.
2. **¿Con qué navegador?** Lo guardado vive en ese navegador; si alguien usó dos, tiene dos copias.
3. **¿Quién importa en Atlas?** El legal dice que CNV. Propongo admin y soporte.
4. **Las consultas importadas, ¿solo se consultan, o también cuentan como punto de la trayectoria?** Si cuentan,
   el primer seguimiento en Atlas ya compara contra la última consulta del HTML, que es lo que el paciente
   espera; pero sus indicadores salieron del motor del HTML, no del de Atlas. Mi recomendación: que se vean en la
   historia y en la ficha, y que **no** entren a la trayectoria hasta que se recalculen con el motor de hoy (el
   legal ya dejó abierta esa puerta como "derivado nuevo").
