# Respuesta legal: importación de pacientes atendidos con el HTML (2026-09-21)

Texto recibido por Santiago del chat legal, sobre `COTEJO_CONSENTIMIENTO_HTML_VS_ATLAS.md` y
`PLAN_IMPORTACION_DESDE_EL_HTML.md`. Se archiva sin editar.

## Criterio general

La importación se sostiene en dos bases distintas, y el diseño debe mantenerlas separadas:

La historia clínica se importa por la obligación legal de custodia. La atención ya ocurrió y la Resolución
1995 de 1999 obliga a conservar la historia quince años. Trasladarla a Atlas, por instrucción del profesional
y para seguir atendiendo al paciente, está cubierto.

El consentimiento se importa como lo que es: el consentimiento de origen HTML, con su versión, su texto y su
alcance. No se convierte en consentimiento de Atlas ni se marcan las casillas de Atlas, porque el registro
debe reflejar exactamente el texto que el paciente firmó. El texto del HTML difiere del de Atlas en puntos
sustantivos: otro responsable, no informaba la IA ni el tratamiento internacional, y prometía que los datos
no serían vendidos ni cedidos con fines comerciales.

La consecuencia práctica es simple: el paciente importado se trabaja con normalidad, no se va a bloquear
ninguna funcionalidad dentro de Atlas web, y en su próxima consulta firma el consentimiento de Atlas de forma
obligatoria. Desde ahí queda bajo el mismo régimen que cualquier otro paciente.

## Fuente de la exportación

El navegador de cada profesional, mediante un botón de exportación en el HTML. Es la única fuente que conserva
la prueba del consentimiento: la copia en la nube del prototipo la elimina antes de subir.

El profesional elige qué pacientes exportar (los que le pidieron continuar en Atlas web) y envía el archivo a
CNV, que los importa a su cuenta.

Si algún paciente solo existiera en la nube, sin registro local, se importa igual la historia por custodia,
con su consentimiento marcado como "origen HTML, sin prueba de firma". La regla de la próxima consulta lo
cubre de la misma manera.

## Respuestas a las ocho preguntas

**1. ¿El consentimiento del HTML cubre el tratamiento en Atlas?** Cubre la atención y el análisis del
paciente por su profesional, que es lo que se preserva. No cubre por sí solo las finalidades que Atlas añade
(IA informada, tratamiento internacional, control de calidad, acceso excepcional, estadística
comercializable). Eso no obliga a restringir nada, porque el consentimiento de Atlas se exige antes de la
próxima evaluación, y es en una evaluación nueva donde esas finalidades vuelven a actuar sobre el paciente. No
hay ventana en la que se usen sin estar cubiertas.

**2. ¿Qué se puede hacer mientras el paciente vuelve a consulta?** Todo lo normal sobre su historia. El
profesional la consulta y la trabaja sin restricciones. Lo único obligatorio es el consentimiento de Atlas
antes de la siguiente evaluación.

**3. ¿Se piden de nuevo las opcionales? ¿La finalidad (c) del HTML cubre la investigación de Atlas?** Las
opcionales se piden en el consentimiento de Atlas de la próxima consulta, sin lógica adicional. La finalidad
(c), "mejorar los algoritmos con datos anonimizados", cubre el uso de datos anonimizados, que de todos modos no
requiere autorización. No cubre la investigación con datos seudonimizados, que en Atlas es opcional. Estos
pacientes quedan como cualquier paciente que no ha marcado esa casilla, hasta que firmen.

**4. ¿Hay que avisarle al paciente del cambio de plataforma?** El cambio es sustantivo, pero en este flujo el
aviso ya ocurre: el paciente es quien le manifiesta al profesional que quiere continuar en Atlas web, y esa
conversación es el aviso. Queda formalizado con la declaración del profesional al exportar (pregunta 8) y con
el consentimiento completo de Atlas en la próxima consulta, que le informa todo lo nuevo.

**5. La prueba del consentimiento.** Conservar al importar: el nombre tecleado, la fecha de firma, la versión
del texto, el texto completo del consentimiento del HTML archivado con su hash, el profesional que atendió, y
la fecha y el responsable de la importación. Es una prueba más débil que la de Atlas, pero es la que existe, y
lo importante es no perderla.

**6. Los menores.** Según lo reportado, no hay menores entre los pacientes a importar. Como verificación, si la
fecha de nacimiento de algún paciente importado indica minoría de edad, se marca y el consentimiento de la
próxima consulta lo otorga su representante legal con el flujo de Atlas, que ya lo contempla.

**7. La conservación.** Para la historia clínica rige la ley: quince años, con independencia de lo que
prometía el HTML. La promesa de eliminar en quince días hábiles al revocar solo puede aplicarse a los datos no
sujetos a conservación legal, y así se lee. Para esos otros datos rige lo que firmaron: si un paciente de
origen HTML revoca antes de firmar el consentimiento de Atlas, esos datos se eliminan o anonimizan en quince
días hábiles. Conviene verificar si hay revocaciones ya registradas en el HTML; esos pacientes solo se
importan en lo que corresponde a historia clínica.

**8. ¿Hace falta autorización expresa del profesional?** Sí, porque en Atlas es el responsable y custodio.
Basta con que él mismo exporte y marque una declaración al hacerlo: que los pacientes exportados le
manifestaron su voluntad de continuar en Atlas web, que obtuvo su consentimiento con el texto del HTML, y que
la exportación es fiel. No hace falta un documento aparte.

## Regla del enlace de seguimiento

El enlace de seguimiento solo puede omitir el consentimiento si el paciente tiene un consentimiento de Atlas
vigente. Si su consentimiento es de origen HTML, o de una versión de Atlas que haya sido reemplazada por un
cambio sustantivo, el enlace presenta el consentimiento completo con código de verificación, como a un
paciente nuevo.

La regla resuelve este caso y deja resuelto el futuro: cualquier actualización sustantiva del consentimiento
quedará cubierta sin lógica adicional.

## Implementación

- Exportación en el HTML, por paciente, con toda la información registrada, incluida la etnia, y la
  declaración del profesional.
- Revisión sin escribir nada: qué pacientes y qué consultas trae el archivo, qué respuestas no calzan con la
  encuesta vigente, y qué pacientes ya existen en Atlas (por documento exacto; ante duda, el profesional
  confirma).
- Importación a la cuenta del profesional, con procedencia "importado del HTML", la fecha original de cada
  consulta y auditoría completa (quién, cuándo, cuántos, desde qué fuente).
- Consentimiento registrado con origen HTML, sin mapear a los consent_type de Atlas.
- Indicadores históricos importados como registro, sin recalcular ni sobrescribir. Si más adelante se
  recalculan con el motor actual, el resultado queda como derivado nuevo.
- Smoke con datos sintéticos. La corrida con datos reales la hace Santiago.

## Cierre

Una vez verificada la importación: retirar técnicamente el HTML abierto a los integrantes, para que nadie
registre pacientes nuevos en él, y purgar la copia de pacientes en la nube del prototipo y en los navegadores,
con constancia de qué se eliminó y cuándo. Mientras existan esas copias, son un tratamiento fuera de la
gobernanza de Atlas.

*(Nota de Santiago: él lo hace, ya no van a usar el HTML una vez importen sus pacientes a Atlas web. Ningún
paciente del HTML está en la nube, solo en local.)*

El canal de derechos que conocen estos pacientes (privacidad@cnvnutricion.com) comparte bandeja con
protecciondatos@cnvsystem.com, así que no requiere acción.
