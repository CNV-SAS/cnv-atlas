// Texto del consentimiento que firmaron los pacientes atendidos con el HTML de Gildardo, ARCHIVADO para
// la importacion a Atlas (respuesta legal del 2026-09-21, punto 2: "se importa como lo que es: de origen
// HTML, con su version, su texto y su hash").
//
// FUENTE: el componente `ConsentimientoScreen` de ATLAS_v9.html (L3209-3534). EL TEXTO ES EL MISMO EN LAS
// CATORCE VERSIONES DEL HTML que hay en el repositorio (julio a 21 de septiembre de 2026): se verifico
// extrayendo los literales de cada una, y el candado `consent-html-archivado.test.ts` lo vuelve a comprobar.
// Asi que no hace falta saber con que version del HTML firmo cada paciente: todos firmaron este.
//
// ES UNA TRANSCRIPCION, NO UNA REDACCION NUESTRA. Por eso conserva sus guiones largos y su puntuacion tal
// cual, aunque nuestra regla de estilo los prohiba: cambiar un signo cambiaria el texto que el paciente
// acepto, y con el su hash. Se omiten solo los iconos, los botones ("Acepto", "No acepto") y los avisos de
// validacion del formulario, que no son parte del documento. {{fecha}} es la fecha del dia en que se
// mostro (`toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })`).
//
// COMO SE FIRMABA, que es lo que lo distingue del de Atlas: el paciente marcaba las cinco declaraciones
// (todas obligatorias) y tecleaba su nombre. Sin codigo de verificacion. El HTML guarda solo `firmaNombre` y
// `fechaConsentimiento`.

export const CONSENT_HTML_VERSION = "Encuesta CNV v3.0";

export const CONSENT_TEXT_HTML_CNV_V3_0 = `Connected Nutrition Ventures
Consentimiento Informado · Encuesta CNV v3.0
{{fecha}} · Por favor lea y acepte antes de continuar

¿Por qué este formulario?
Antes de iniciar la encuesta nutricional, CNV está obligada —por ley y por principios éticos— a informarle cómo serán usados sus datos personales y de salud, y a obtener su autorización libre, voluntaria e informada. Este documento cumple con la Ley 1581 de 2012, la Ley 100 de 1993, el Código de Núremberg (1947) y la Declaración de Helsinki (2013).

1. Responsable del tratamiento
Connected Nutrition Ventures (CNV), representada por el profesional de salud que atiende esta consulta, es responsable del tratamiento de sus datos conforme al artículo 17 de la Ley 1581 de 2012 y el Decreto 1377 de 2013.

2. Datos que se recolectan en esta encuesta
Datos personales: nombre completo, documento de identidad, fecha de nacimiento, teléfono y correo electrónico.
Datos sociodemográficos: etnia, nivel educativo, ocupación, estado civil, estrato.
Datos sensibles de salud (Art. 6, Ley 1581): hábitos alimentarios, composición corporal, diagnósticos clínicos (diabetes, HTA, dislipidemia, hipotiroidismo), medicamentos, antecedentes familiares, conductas alimentarias, señales de TCA, hábitos de sueño, consumo de tabaco y alcohol, síntomas digestivos e hidratación.

3. Finalidad del tratamiento (Art. 13, Ley 1581)
Sus datos serán usados exclusivamente para: (a) elaborar su análisis y plan nutricional personalizado en el Motor Nutricional CNV; (b) calcular indicadores clínicos como el Índice de Estrés Metabólico, LE8 y riesgo de sarcopenia; (c) mejorar los algoritmos de evaluación nutricional de CNV con datos anonimizados. Sus datos NO serán vendidos ni cedidos con fines comerciales.

4. Compartir con terceros
CNV podrá compartir sus datos únicamente con: (a) laboratorio clínico de referencia para integración de resultados analíticos, siempre bajo su autorización expresa; (b) EPS o aseguradora cuando exista obligación legal o usted lo solicite; (c) proveedores tecnológicos que operen bajo contratos de confidencialidad y cumplimiento de la Ley 1581. En ningún caso sus datos sensibles de salud serán compartidos sin informarle.

5. Sus derechos como titular (Ley 1581/2012 · Ley 100/1993)
Usted tiene derecho a:
• Acceder a sus datos en cualquier momento ·
• Rectificar datos inexactos ·
• Suprimir sus datos (derecho al olvido) ·
• Revocar este consentimiento sin consecuencias negativas para su atención ·
• Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) ·
• Recibir atención en salud de calidad, con integralidad, continuidad y libre escogencia conforme a la Ley 100 de 1993.
Para ejercer estos derechos contacte: privacidad@cnvnutricion.com

6. Principios bioéticos aplicables (Núremberg · Helsinki · Beauchamp & Childress)
Esta evaluación se rige por los cuatro principios fundamentales de la bioética:
• Autonomía: su participación es completamente voluntaria y puede retirarse en cualquier momento sin perjuicio alguno (Código de Núremberg, 1947 — Principio 1).
• Beneficencia: toda la información recolectada tiene como único fin su beneficio nutricional y clínico (Declaración de Helsinki, 2013 — Art. 8).
• No maleficencia: CNV se compromete a no usar sus datos de forma que pueda causarle daño, discriminación o perjuicio.
• Justicia: recibirá la misma calidad de atención independientemente de sus condiciones sociodemográficas o de salud.

7. Revocación del consentimiento
Usted puede revocar este consentimiento en cualquier momento de forma oral o escrita ante el profesional de salud o enviando una solicitud a privacidad@cnvnutricion.com. La revocación no afecta la licitud del tratamiento realizado antes de su comunicación. Los datos serán eliminados o anonimizados en un plazo máximo de 15 días hábiles.

Declaraciones de consentimiento — marque cada una
[ ] Autorizo el tratamiento de mis datos personales (nombre, documento, contacto) con la finalidad descrita en el numeral 3.
[ ] Autorizo el tratamiento de mis datos sensibles de salud (diagnósticos, medicamentos, hábitos, señales de TCA) exclusivamente para análisis nutricional.
[ ] He sido informado/a sobre el posible compartir de mis datos con laboratorio, EPS o proveedores tecnológicos bajo las condiciones del numeral 4, y acepto las condiciones.
[ ] Conozco mis derechos como titular de datos (acceso, rectificación, supresión, revocación) y sé cómo ejercerlos.
[ ] Entiendo que mi participación es voluntaria, que puedo retirarme sin consecuencias y que la información se usará bajo los principios de beneficencia, no maleficencia, autonomía y justicia.

Firma del consentimiento
Escriba su nombre completo tal como aparece en su documento de identidad para validar su consentimiento. Fecha: {{fecha}}
Nombre completo del paciente / titular: {{firma_nombre}}

Este consentimiento quedará registrado con fecha y nombre en el historial de la consulta.
`;
