# Plan (O): traer a Atlas los pacientes atendidos con el HTML (borrador, 2026-09-21)

**Estado: SIN EMPEZAR.** Es bloque propio y espera dos cosas: la respuesta del chat legal (abajo) y la
decisión de dónde se exporta. El cotejo de los dos consentimientos está en
`docs/entregas/COTEJO_CONSENTIMIENTO_HTML_VS_ATLAS.md`.

---

## Lo que encontré en su archivo, antes de planear

1. **No trae ninguna exportación de pacientes.** Lo único que descarga es la historia clínica en HTML.
2. **Cada paciente es una lista de consultas** (`atlas:<documento>` en el navegador), con la encuesta, la
   medición, la antropometría, el plan y los tratamientos por profesión. Hay además una docena de datos
   sueltos por paciente (citas, plan, protocolo, notas de medicina, psicología y ejercicio).
3. **Las consultas se copian a la nube de Gildardo** (tabla `consultas`), pero **sin correo, teléfono ni la
   firma del consentimiento**: su propio código las borra antes de subir.
4. **La firma del consentimiento es un nombre tecleado con fecha**, sin código. Solo queda en el navegador del
   profesional que atendió.

## Las dos fuentes posibles, con lo que cuesta cada una

| | Navegador de cada profesional | Nube de Gildardo (`consultas`) |
|---|---|---|
| Qué trae | Todo, incluida la firma del consentimiento y el contacto | Las consultas, **sin contacto ni firma** |
| Cómo se saca | Una página de exportación que cada profesional abre en su equipo, en el mismo sitio donde usa el HTML | Una lectura central, con permiso de Gildardo sobre su proyecto |
| Riesgo | Equipo por equipo; lo que esté en un navegador borrado se pierde | Sin prueba del consentimiento en la importación |

## La propuesta de Santiago, y la pregunta que abre

**Su intuición:** portar solo las autorizaciones obligatorias, que el paciente ya dio. Las cinco casillas
del HTML eran obligatorias, y las dos que se parecen a las necesarias de Atlas son **servicio** y **datos
sensibles**. La tercera necesaria de Atlas (**medio electrónico**) no existía en el HTML.

**La pregunta es jurídica, no técnica:** el texto que firmaron no es el de Atlas (otro responsable, otras
finalidades, sin tratamiento internacional ni IA informados, otra conservación). Portarlas es afirmar que son
equivalentes, y esa afirmación la hace el legal.

## Preguntas para el chat legal

1. **¿El consentimiento del HTML ("Encuesta CNV v3.0") cubre el tratamiento de esos datos en Atlas?** El
   responsable cambia (en el HTML es CNV; en Atlas, el profesional para la atención y CNV como plataforma y
   como responsable autónomo), y Atlas añade finalidades: comercializar estadística anonimizada, control de
   calidad seudonimizado, acceso excepcional identificado a la historia, IA y tratamiento internacional.
2. **Si no lo cubre entero, ¿qué se puede hacer mientras el paciente vuelve a consulta?** Por ejemplo:
   importar la historia como registro de lo ya atendido, solo para custodia y consulta del profesional, y
   pedir el consentimiento de Atlas en la siguiente atención. ¿O no se puede importar nada antes de ese nuevo
   consentimiento?
3. **Las autorizaciones opcionales de Atlas** (investigación, continuidad, publicidad) el HTML nunca las
   pidió. ¿Se confirma que se piden de nuevo? Y la finalidad (c) del HTML, *"mejorar los algoritmos con datos
   anonimizados"*, ¿cubre algo de la investigación de Atlas o no?
4. **¿Hay que avisarle al paciente del cambio de plataforma?** Si es así: ¿por qué medio, antes o después de
   migrar, y qué tiene que decir el aviso? (El dictamen del 2026-08-20 §3 distingue cambio sustantivo, que
   exige nueva aceptación, de no sustantivo, que basta con informar.)
5. **La prueba del consentimiento.** En el HTML la firma es un nombre tecleado, sin código, y la copia en la
   nube de Gildardo ni siquiera la conserva. ¿Qué hay que conservar al importar para poder probar la
   autorización? ¿Basta con el nombre y la fecha del registro local?
6. **Los menores.** El HTML no tenía bloque de representante legal. ¿Qué pasa con un menor que firmó él mismo?
7. **La conservación.** El HTML prometía eliminar o anonimizar en 15 días hábiles al revocar; Atlas conserva
   la historia 15 años. ¿Rige lo que firmaron para los datos que vienen del HTML?
8. **El profesional.** Si en Atlas él es el responsable y custodio de la historia, ¿hace falta su autorización
   expresa para mover a sus pacientes, o basta con que él mismo haga la exportación?

## Cómo se construiría, una vez respondido

1. **Exportación** desde la fuente elegida, en un archivo.
2. **Revisión sin escribir nada:** qué pacientes, qué consultas, qué respuestas no calzan con la encuesta de
   hoy, qué pacientes ya existen en Atlas (por documento exacto; ante duda, el profesional confirma).
3. **Importación** con su procedencia ("importada del HTML", con la fecha original) y su auditoría. El orden
   inicial/seguimiento lo confirma el profesional: Atlas no lo decide solo.
4. **Smoke con datos sintéticos.** La corrida con datos reales la hace Santiago.

**Tamaño estimado: 3 a 4 sesiones**, según lo que responda el legal (si solo se custodia, es menos; si hay que
recalcular con el motor de hoy, es más).
