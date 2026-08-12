# Correcciones al Consentimiento de ATLAS

**Para:** el equipo de Atlas.
**Objeto:** ajustes a aplicar sobre la versión actual del texto, antes de recibir pacientes reales.
**Origen:** decisiones de revisión legal sobre reducción de casillas, refuerzo de la continuidad asistencial, principios bioéticos y especificidad de los datos sensibles.

---

## Resumen de los cambios

| # | Numeral | Cambio | Prioridad |
|---|---|---|---|
| 1 | 11 y 13 | **Restaurar el bloque de menores**, que se perdió en la última versión | Bloqueante |
| 2 | 12 | Reducir las necesarias de cuatro a tres (absorber la de "he sido informado") | Alta |
| 3 | 12 y 5 | Reducir las opcionales de cuatro a tres (fusionar etnia dentro de investigación) | Alta |
| 4 | 5 y 12 | Diferenciar con claridad continuidad asistencial de publicidad | Alta |
| 5 | 1 | Agregar principios bioéticos y voluntariedad | Media |
| 6 | 3 | Especificar los datos sensibles que realmente se capturan | Media |

Resultado: de ocho casillas a seis. Tres necesarias, tres opcionales.

---

## 1 · Restaurar el bloque de menores (bloqueante)

La versión actual eliminó del numeral 11 los campos del representante legal, su declaración de calidad, el bloque de asentimiento del menor y la nota sobre el envío del código de verificación. También eliminó del numeral 13 el bloque de firma para menores. Solo quedó la frase automática de ATLAS.

**Esto no puede quedar así.** Un menor de edad no tiene capacidad legal para autorizar el tratamiento de sus datos: la autorización válida la otorga su representante legal, y sin campos donde identificarlo y sin su declaración de calidad, no hay autorización válida para ningún paciente menor de 18 años. Si el sistema va a atender menores, este bloque es indispensable.

**Restaurar en el numeral 11, después de la declaración de mayoría de edad:**

> *Si el paciente es menor de 18 años, este consentimiento debe ser otorgado por su representante legal, quien declara:*
>
> *"Declaro que actúo como representante legal de la persona menor de edad evaluada, en calidad de (marque una): ☐ padre ☐ madre ☐ tutor legal ☐ curador. Manifiesto que cuento con la facultad legal para autorizar este tratamiento de datos en su nombre, en el mejor interés del menor."*
>
> ***Datos del representante legal*** *(solo si el paciente es menor de edad; se completa antes de continuar):*
>
> *Nombre completo: `________________________________`*
> *Tipo y número de documento: `____________________________`*
> *Parentesco o calidad: `____________________________`*
> *Correo electrónico: `____________________________`*
>
> ***Nota.*** *Cuando el paciente es menor de edad, el código de verificación con el que se firma este consentimiento (numeral 13) se envía al medio de contacto del representante legal, no al del menor. La copia del consentimiento se envía al representante y, si el menor registra un correo propio, también al menor.*
>
> ***Asentimiento del menor*** *(obligatorio cuando el paciente tiene entre 14 y 17 años):*
>
> *"Yo, `________________________________`, he sido informado/a de forma adecuada a mi edad sobre esta evaluación y estoy de acuerdo en participar."*
>
> ☐ *El menor (14 a 17 años) otorga su asentimiento en los términos anteriores.*

**Restaurar en el numeral 13, después del bloque de firma del paciente mayor de edad:**

> *Si el paciente es menor de edad, firma su representante legal (datos ya registrados en el numeral 11) y el código de verificación se envía al contacto del representante:*
>
> *Nombre completo del representante: `________________________________`*
> *Número de documento del representante: `____________________________`*

---

## 2 · Numeral 12: reducir las necesarias de cuatro a tres

La tercera casilla actual ("He sido informado/a del tratamiento internacional... y conozco mis derechos") **no es una autorización, es un acuse de recibo**. Informar al titular es una obligación de CNV bajo el artículo 12 de la Ley 1581, y su cumplimiento se acredita mostrando que el texto se desplegó, no pidiendo al paciente que confirme que leyó. Puede absorberse en la primera casilla sin pérdida legal.

**Las dos primeras no se fusionan entre sí.** El artículo 6 exige autorización explícita y diferenciada para datos sensibles, precisamente para que el titular distinga entre autorizar sus datos ordinarios y autorizar sus datos de salud.

**La cuarta se conserva.** Es la que hace que el paciente *acepte* el medio electrónico, no solo que se le informe, y es la que sostiene el criterio de confiabilidad del Decreto 2364 de 2012.

**Texto final del bloque de necesarias:**

> **Autorizaciones necesarias para el servicio**
> *Debe marcar las tres para continuar.*
>
> ☐ *Autorizo el tratamiento de mis datos personales para las finalidades necesarias descritas en el numeral 4, y declaro conocer el tratamiento internacional (numeral 7), el uso de sistemas automatizados (numeral 6) y mis derechos como titular (numeral 9).*
>
> ☐ *Autorizo el tratamiento de mis datos sensibles de salud, de forma voluntaria, para mi evaluación y plan personalizados.*
>
> ☐ *Acepto que este consentimiento se otorga por medios electrónicos, con plena validez conforme a la Ley 527 de 1999, y que para confirmarlo Atlas enviará un código de verificación al medio de contacto que registro (propio o de una persona de confianza que yo designe).*

---

## 3 · Numeral 12: reducir las opcionales de cuatro a tres

La etnia no se captura para la atención clínica del paciente: el modelo ANI-BIS-E no modifica su plan según la etnia. Se captura únicamente para que ObBIA-Latam pueda estratificar en investigación. Como comparte finalidad con la casilla de investigación que ya existe, se fusiona en ella en lugar de crear una casilla nueva.

Esto es legalmente válido porque se mantienen las tres condiciones que exige el artículo 6: sigue siendo **opcional** (no condiciona el servicio), sigue siendo **explícita** (nombra el dato sensible, no lo esconde), y **la finalidad es una sola** (investigación), que es la condición real para poder agrupar autorizaciones.

**Texto final de la primera casilla opcional:**

> ☐ *Autorizo el uso de mis datos seudonimizados para investigación científica del modelo, incluida la realizada en colaboración con terceros bajo la dirección científica de ObBIA-Latam, y el uso de mi pertenencia étnica para el análisis de diferencias entre poblaciones, cuando decida informarla (numeral 5).*

**Se elimina** la casilla independiente de pertenencia étnica.

En el numeral 5, el bullet sobre etnia deja de ser un punto aparte y se integra al de investigación:

> *Participar, con sus datos seudonimizados (nunca con sus datos de identificación), en investigación científica del modelo ANI-BIS-E y de la medicina bioeléctrica, realizada directamente por el Observatorio Latinoamericano de Bioimpedancia (ObBIA-Latam) o en colaboración con instituciones académicas y profesionales de investigación que trabajen bajo la dirección científica de ObBIA-Latam. Esta investigación utiliza únicamente sus datos clínicos y funcionales estructurados (mediciones, indicadores, respuestas de la encuesta, tratamiento y seguimiento), sin incluir observaciones o notas en texto libre de su profesional. **Si usted decide informar su pertenencia étnica, este dato se utiliza dentro de esta misma finalidad, para que los análisis puedan considerar las diferencias de composición corporal entre poblaciones; informarlo es completamente voluntario y no responder no tiene ninguna consecuencia sobre su evaluación ni su tratamiento.** Cuando un estudio específico requiera identificar el resultado de un paciente en una publicación con fines académicos, se le solicitará un consentimiento de investigación adicional y separado, propio de ese estudio.*

**Nota para la implementación:** el campo de pertenencia étnica debe ofrecer las categorías del autorreconocimiento del DANE (Indígena; Gitano o Rrom; Raizal; Palenquero; Negro, mulato, afrodescendiente o afrocolombiano; Ninguno de los anteriores) más **"Prefiero no responder"** como opción explícita, distinta de dejar el campo vacío. El dato siempre por autorreconocimiento del paciente, nunca asignado por el profesional ni inferido por el sistema.

---

## 4 · Diferenciar continuidad asistencial de publicidad

Las dos últimas casillas opcionales se parecen demasiado hoy, y no deberían: una es asistencial y la otra comercial. La primera merece más peso, porque es el mecanismo que protege la continuidad del cuidado del paciente cuando su profesional deja la red.

**En el numeral 5, reemplazar los dos últimos bullets por:**

> ***Continuidad de su atención.*** *Que CNV pueda contactarle para asegurar la continuidad de su proceso en salud dentro de la red de profesionales. Esta autorización es relevante si el profesional que le atiende deja de operar el modelo ANI-BIS-E: en ese caso, CNV podrá informarle sobre las opciones disponibles para continuar su tratamiento con otro profesional de la red, sin que ello implique el traslado automático de su historia clínica, que siempre requiere su autorización específica.*
>
> ***Comunicaciones comerciales.*** *Recibir información promocional sobre novedades, productos, descuentos y otros servicios del ecosistema CNV. Esta autorización tiene una finalidad exclusivamente comercial y es completamente independiente de su atención en salud.*

**En el numeral 12, reemplazar las dos últimas casillas opcionales por:**

> ☐ ***Continuidad asistencial.*** *Autorizo que CNV me contacte para asegurar la continuidad de mi proceso en salud dentro de la red, especialmente si el profesional que me atiende deja de operar el modelo (numeral 5).*
>
> ☐ ***Publicidad.*** *Autorizo recibir comunicaciones comerciales y promocionales del ecosistema CNV (numeral 5).*

Los rótulos en negrita al inicio de cada casilla son deliberados: permiten que el paciente distinga de un vistazo cuál es cuál, sin tener que leer ambas frases completas para notar la diferencia.

**Advertencia de implementación:** estas dos casillas no deben fusionarse ni presentarse como una sola opción. Hacerlo condicionaría la continuidad de la atención en salud a aceptar publicidad, lo cual es legalmente cuestionable y además haría perder autorizaciones de continuidad, que son operativamente necesarias cuando un Integrante se retira de la red.

---

## 5 · Numeral 1: agregar principios bioéticos y voluntariedad

El consentimiento informado en salud tiene raíz bioética, no solo de protección de datos. La Resolución 8430 de 1993, que ya se cita en el Acuerdo de Colaboración en Investigación, descansa sobre estos principios. El numeral 1 actual es puramente instrumental y no los menciona.

**Agregar como segundo párrafo del numeral 1:**

> *Su participación es voluntaria y puede retirarse en cualquier momento sin consecuencias sobre su atención. La información se trata conforme a los principios de beneficencia, no maleficencia, autonomía y justicia que rigen la práctica en salud.*

---

## 6 · Numeral 3: especificar los datos sensibles que se capturan

La descripción actual ("hábitos, composición corporal, mediciones de bioimpedancia espectroscópica, antecedentes, conductas y síntomas, entre otros") es abstracta. Para que el consentimiento sea genuinamente *informado*, el paciente debe entender qué está autorizando en concreto.

Esto importa especialmente porque la encuesta indaga sobre **señales de trastornos de la conducta alimentaria**, que es de los datos más sensibles que puede capturar la plataforma y hoy queda subsumido bajo "conductas y síntomas".

**Reemplazar el bullet de datos sensibles de salud por:**

> *Datos sensibles de salud: antecedentes personales y familiares, diagnósticos y medicamentos, hábitos de alimentación, actividad física y sueño, composición corporal, mediciones de bioimpedancia espectroscópica, síntomas, y señales relacionadas con la conducta alimentaria, entre otros.*

Si la encuesta captura otras categorías particularmente sensibles no reflejadas aquí (por ejemplo, consumo de sustancias, salud mental o salud sexual y reproductiva), conviene nombrarlas también de forma expresa.

---

## Versionamiento

Estos cambios son sustantivos: alteran el número y el alcance de las autorizaciones. Corresponde **subir la versión del documento** y generar un hash nuevo.

Los `consent_type` resultantes son seis:

| Tipo | Bloque |
|---|---|
| `servicio` | Necesaria |
| `datos_sensibles` | Necesaria |
| `medios_electronicos` | Necesaria |
| `investigacion` | Opcional (incluye etnia) |
| `continuidad_asistencial` | Opcional |
| `comunicaciones_comerciales` | Opcional |

Más los dos tipos condicionales del bloque de menores: `representante_legal` y `asentimiento_menor`.

Desaparecen `internacional_ia` (absorbido en `servicio`) y no llega a crearse un tipo independiente para etnia.

**Nota sobre pacientes ya registrados:** si al momento de aplicar estos cambios existen pacientes que aceptaron una versión anterior, sus autorizaciones previas siguen siendo válidas para lo que autorizaron. La versión nueva aplica a partir de su siguiente atención, cuando ATLAS le presente el texto vigente.
