# Cotejo de consentimientos: el que firmaron en el HTML y el de Atlas

**Para el chat legal.** Preparado el 2026-09-21 para la observación (O): llevar a Atlas los pacientes que
los profesionales atendieron con el HTML de Gildardo. Aquí no hay conclusiones jurídicas: hay los dos textos,
tema por tema, y las diferencias que se ven al ponerlos lado a lado. **Decir si son equivalentes es una
afirmación jurídica, y le corresponde al legal.**

| | HTML de Gildardo | Atlas |
|---|---|---|
| **Nombre y versión** | "Consentimiento Informado · Encuesta CNV v3.0" | Consentimiento informado de ATLAS, **v1.0** (vigente desde el 2026-08-12, con revisión legal del 11) |
| **Fuente** | `ATLAS_v9.html`, componente `ConsentimientoScreen` (línea 3209) | `src/modules/consent/text/consent-v1.0.ts` |
| **Cómo se firma** | Nombre completo **tecleado** y la fecha. Sin código de verificación | Firma electrónica: nombre y documento registrados + **código de verificación** enviado al contacto (Ley 527 de 1999). Se guarda el hash del documento y se envía copia |
| **Dónde queda la prueba** | En el navegador del profesional (`localStorage`). **La copia que se sincroniza a la nube de Gildardo NO la lleva**: `_PII_FIELDS` borra `firmaNombre`, `firmaConsentimiento`, `firmaFecha` y `fechaConsentimiento` antes de subir (línea 37) | En la base de Atlas (`patient_consents`), con el hash del texto firmado |

---

## Tema por tema

### 1. Quién es el responsable

- **HTML:** *"Connected Nutrition Ventures (CNV), representada por el profesional de salud que atiende esta
  consulta, es responsable del tratamiento de sus datos conforme al artículo 17 de la Ley 1581 de 2012 y el
  Decreto 1377 de 2013."*
- **Atlas:** *dos responsables.* **El profesional** es el Responsable para la atención clínica y custodio de
  la historia clínica. **CNV** actúa (i) como proveedor de la plataforma, tratando datos por cuenta del
  profesional, y (ii) como responsable autónomo para investigación, mejora del modelo, control de calidad y
  analítica, en lo que el paciente autorice.
- **Diferencia:** en el HTML el responsable es CNV (representada por el profesional); en Atlas el responsable
  de la atención es el profesional y CNV tiene dos papeles distintos.

### 2. Canal para ejercer derechos

- **HTML:** privacidad@cnvnutricion.com
- **Atlas:** protecciondatos@cnvsystem.com
- **Diferencia:** otro correo y otro dominio.

### 3. Qué datos se recolectan

- **HTML:** *personales* (nombre, documento, fecha de nacimiento, teléfono, correo); *sociodemográficos*
  (**etnia**, nivel educativo, ocupación, estado civil, estrato); *sensibles de salud* (hábitos alimentarios,
  composición corporal, diagnósticos, medicamentos, antecedentes familiares, conductas alimentarias, señales
  de TCA, sueño, tabaco y alcohol, síntomas digestivos, hidratación).
- **Atlas:** lo mismo, más **mediciones de bioimpedancia espectroscópica** y **determinantes de estilo de vida
  (enfoque epigenético)**; la **etnia es opcional** y va como dato sensible, y se dice expresamente que los
  datos sensibles son facultativos (art. 6, Ley 1581).
- **Diferencia:** en el HTML la etnia es un dato sociodemográfico más; en Atlas es sensible y voluntaria.

### 4. Para qué se usan

- **HTML (todas obligatorias):** *(a) elaborar su análisis y plan nutricional personalizado en el Motor
  Nutricional CNV; (b) calcular indicadores clínicos como el Índice de Estrés Metabólico, LE8 y riesgo de
  sarcopenia; (c) mejorar los algoritmos de evaluación nutricional de CNV con datos anonimizados.* Y: *"Sus
  datos NO serán vendidos ni cedidos con fines comerciales."*
- **Atlas (necesarias):** evaluación y plan en el modelo ANI-BIS-E; indicadores y clasificaciones; reporte y
  seguimiento; **generar y comercializar información estadística anonimizada** (los datos personales no se
  venden); **control de calidad** sobre datos seudonimizados; y, excepcionalmente, **acceso minimizado y
  registrado a la historia clínica identificada** (queja o desviación grave del protocolo).
- **Diferencias:** Atlas añade la comercialización de estadística anonimizada, el control de calidad y el
  acceso excepcional identificado. La finalidad (c) del HTML (mejorar algoritmos con datos anonimizados) no
  tiene una equivalente exacta en Atlas: allí la mejora del modelo va dentro de CNV como responsable autónomo,
  y la investigación es **opcional**.

### 5. Usos opcionales

- **HTML:** **ninguno.** Las cinco casillas son obligatorias (la firma se habilita solo si están todas).
- **Atlas:** tres opcionales, que no afectan la atención: **investigación** (seudonimizada, ObBIA-Latam,
  incluye la etnia si la informa), **continuidad asistencial** (que CNV lo contacte si su profesional deja el
  modelo) y **comunicaciones comerciales**.
- **Diferencia:** el HTML nunca preguntó por investigación, continuidad ni publicidad.

### 6. Terceros, tratamiento internacional e IA

- **HTML:** solo con *(a) laboratorio clínico de referencia, "siempre bajo su autorización expresa"; (b) EPS o
  aseguradora cuando exista obligación legal o usted lo solicite; (c) proveedores tecnológicos bajo contratos
  de confidencialidad.* **No menciona tratamiento internacional ni inteligencia artificial.**
- **Atlas:** proveedores en **Estados Unidos** y, para la bioimpedancia, **Francia** (numeral 7); **IA** sobre
  variables seudonimizadas, que no decide (numeral 6).
- **Diferencia:** el HTML no informa ni la transferencia internacional ni la IA, aunque su propio archivo usa
  un servicio de IA (a través de cnvsystem.com) y guarda en Supabase.

### 7. Conservación y supresión

- **HTML:** al revocar, *"los datos serán eliminados o anonimizados en un plazo máximo de 15 días hábiles."*
- **Atlas:** la historia clínica se conserva **quince (15) años** desde la última atención (Resoluciones 1995
  de 1999 y 839 de 2017); la supresión se atiende anonimizando lo que no esté sujeto a conservación legal.
- **Diferencia:** 15 días hábiles para eliminar frente a 15 años de conservación de la historia clínica.

### 8. Menores de edad

- **HTML:** no tiene bloque de menores. Firma quien escribe su nombre.
- **Atlas:** representante legal (con declaración y datos), asentimiento del menor de 14 a 17 años, y el código
  de verificación va al contacto del representante.
- **Diferencia:** un menor atendido con el HTML pudo firmar él mismo.

### 9. Derechos, revocación y principios

- **HTML:** acceder, rectificar, suprimir, revocar, quejas ante la SIC, atención conforme a la Ley 100; y los
  principios bioéticos con cita (Núremberg, Helsinki, Beauchamp & Childress).
- **Atlas:** los mismos derechos, más **solicitar prueba de la autorización**; los mismos cuatro principios,
  sin las citas.
- **Diferencia:** menor.

### 10. Las casillas, una por una

| HTML (las cinco obligatorias) | Lo más parecido en Atlas |
|---|---|
| Autorizo el tratamiento de mis datos personales (nombre, documento, contacto) con la finalidad descrita en el numeral 3 | **Servicio** (necesaria): finalidades del numeral 4, y declara conocer el tratamiento internacional, la IA y sus derechos |
| Autorizo el tratamiento de mis datos sensibles de salud (...) exclusivamente para análisis nutricional | **Datos sensibles** (necesaria): para su evaluación y plan personalizados |
| He sido informado/a sobre el posible compartir de mis datos con laboratorio, EPS o proveedores tecnológicos (...) y acepto las condiciones | Sin casilla propia: va dentro de **Servicio** |
| Conozco mis derechos como titular (...) y sé cómo ejercerlos | Sin casilla propia: va dentro de **Servicio** |
| Entiendo que mi participación es voluntaria (...) principios de beneficencia, no maleficencia, autonomía y justicia | Sin casilla: numeral 1 |
| *(no existe)* | **Medio electrónico** (necesaria): acepta que se firma por medios electrónicos y con código |
| *(no existe)* | **Investigación**, **Continuidad**, **Publicidad** (opcionales) |
