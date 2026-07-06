# SCIENTIFIC_MODEL.md — El modelo ANI-BIS-E

**Versión:** 0.1 (estructura + transcripción del inventario de ATLAS v7)
**Estado:** PENDIENTE de validación y completado por la dirección científica (Gildardo / CNV Research).
**Relación:** este documento define *qué es* el modelo (la ciencia). `CLINICAL_ENGINE.md` define *cómo se implementa y porta* (la ingeniería). `DATABASE.md` define *dónde se almacena* (el `model-registry`).

> **Autoridad y alcance.** La ciencia, las fórmulas, los puntos de corte y su validez clínica son autoridad de Gildardo / CNV Research. Lo que sigue es la estructura formal del modelo más lo que el inventario del v7 reveló, transcrito para que Gildardo lo valide y complete. Las afirmaciones clínicas aquí son transcripción de lo que el v7 computa, no asesoría médica ni validación de Claude o Santiago. Los golden tests prueban paridad con el HTML, no corrección clínica: eso lo firma Gildardo.

> **Actualización B11 (taxonomía real, autoridad del código).** Al portar el motor final de Gildardo (`ATLAS_v7.html`), la taxonomía REAL del código tiene autoridad sobre las nomenclaturas especulativas que este documento escribió antes de tener el código. En concreto: **F1-F12, PBI y EIEC ya NO aplican**. La estructura real entregada es: 12 indicadores (IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, IAE, EB, FMI, FFMI, AF, IR); **fenotipo EFR de 81 estados** (clave IFC_IRC_FFMI_FMI, mapa `DX`); **fenotipo estructural de 9** (FFMI x FMI, `STRUCT_LABELS`); **sector funcional FyR de 9** (IFC x IRC, `FYR_LABELS`); y el **DFI (Diagnóstico Funcional Integral)**: árbol de 5 dominios + riesgo integrado + rutas de atención autoritativas (integra encuesta + BIS). La ciencia congelada vive verbatim en `src/clinical-engine/frozen/`; es la fuente de verdad. Las secciones de abajo que hablan de F1-F12/PBI/EIEC quedan superadas por esta nota.

## Qué es ANI-BIS-E
Alimentación y Nutrición Informada basada en Bioimpedancia Espectroscópica y Epigenética. Convierte mediciones bioeléctricas y datos de la persona en indicadores de función y riesgo celular, un estado integrado (la Diana EFR) y un protocolo de intervención nutricional.

## Entidades formales del modelo
El modelo se define como un conjunto de entidades versionadas. Cada una pertenece a una versión del modelo; al cambiar la versión, los registros históricos conservan la versión con que se calcularon.

1. **Versión del modelo** (`model_version` + `rules_version`).
2. **Variables de entrada** (Cole-Cole, composición Biody, encuesta, demográficas).
3. **Indicadores** (derivados de las variables por fórmulas).
4. **Clasificaciones** (cortes que mapean un indicador a una banda/etiqueta).
5. **Mapas de estado** (combinaciones de bandas → fenotipos, sectores, estados).
6. **La Diana EFR** (81 estados) con su contenido clínico.
7. **Reglas de protocolo** (estrategia calórica, proteína, restricciones, exámenes, suplementación).
8. **Referencias** (guías: ESPEN, KDIGO, ADA, AHA, GLIM, etc.).

## Capas del modelo (según el v7)
- **Capa 1:** factores de riesgo y carga alostática (de la encuesta y el LE8 / Life's Essential 8).
- **Capa 2 (tesis doctoral):** MCCB (12 fenotipos, FMI x FFMI x MCA), PBI (9 estados, AF x IR), EIEC (equilibrio hídrico ECW/ICW).
- **Capa 3 (ANI BIS-E):** IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, IAE, EB; sector FR (IFC x IRC); Diana EFR (81 estados).

## Variables de entrada
- **Cole-Cole:** Re, Ri, Rinf, C. *(Nomenclatura y significado exactos: confirmar con Gildardo: Re/Ri resistencias extra/intracelular, Rinf a frecuencia infinita, C capacitancia de membrana.)*
- **Composición (Biody Manager):** FMI, FFMI, MCA y MCA_ref, SMM/smmW, ASMI, AF (ángulo de fase), IR, ECW, ICW, FFM, peso, talla, IMC.
- **Encuesta:** comorbilidades (campos codificados `d5_*`), LE8, hábitos, estilo de vida.
- **Demográficas:** sexo, edad.

## Indicadores
Transcripción del v7. La expansión formal de cada acrónimo y su definición clínica las completa Gildardo.

| Indicador | Fórmula / origen (v7) | Qué indica (según etiquetas del v7) | Expansión (PENDIENTE Gildardo) |
|---|---|---|---|
| IFC | `C/Rinf*1000` | Función celular: óptima / alerta / disfunción | Índice de Función Celular (confirmar) |
| IRC | `(Re/(Ri*C))*10` | Riesgo celular: bajo / moderado / alto | Índice de Riesgo Celular (confirmar) |
| PABU | `(Re+Ri)*0.9/(Rinf*C)` | Relación con el punto áureo φ = 1.618 | (confirmar) |
| ICA-BIS | `PABU - 1.618` | Desviación del punto áureo: homeostasis / desviación / crítica | (confirmar) |
| ISCM | De fuente (confirmar dónde) | Susceptibilidad: ISCM-1 a ISCM-4 | Índice de Susceptibilidad ... (confirmar) |
| IEHH | De fuente | Equilibrio hídrico: óptimo / leve / moderado / severo | (confirmar) |
| IAE | De fuente, en años | Aceleración del envejecimiento: desacelerado / concordante / acelerado | Índice de Aceleración del Envejecimiento (confirmar) |
| EB | De fuente | (confirmar) | (confirmar) |

## Clasificaciones (cortes del v7)
Los cortes vienen, según los comentarios del v7, de los Excel `MAPA_RyF_BIS` y `Mapa E_BIS` de Gildardo. **Son datos versionados del `model-registry`, no constantes de código.** Transcripción (PENDIENTE confirmar que coinciden con el Excel final):

- **cIFC:** > 6 óptima; 3.5 a 6 alerta funcional; < 3.5 disfunción.
- **cIRC:** < 2.0 bajo riesgo; 2.0 a 3.4 moderado; > 3.4 alto.
- **cAF** (M): < 6.5 bajo, ≤ 7.0 normal, > 7.0 alto; (F): < 6.0 / ≤ 6.5 / > 6.5.
- **cIR** (por sexo): corte M 0.78, F 0.82 → óptimo vs inflamación de bajo grado.
- **cISCM:** ≤ −1 / ≤ 1 / ≤ 2.5 / > 2.5 (niveles 1 a 4).
- **cIEHH:** ≤ 0 / ≤ 1 / ≤ 2 / > 2.
- **cIAE:** < −5 desacelerado; ≤ 5 concordante; > 5 acelerado.
- **cFMI, cFFMI, cSMM:** cortes por sexo (transcritos en `CLINICAL_ENGINE.md`; fuente Mapa E_BIS).

## Fenotipos MCCB (12)
`keyMCCB = nivelFMI + '_' + nivelFFMI`. El nivel de FMI usa MCA para distinguir alto clínico vs preclínico. F1 a F12, cada uno con nombre y nivel de riesgo (ej. F1 obesidad sarcopénica clínica = riesgo crítico; F8 normopeso = bajo; F12 físicamente activo = bajo). El contenido clínico y los nombres definitivos: Gildardo.

## Sectores FR (9) y Diana EFR (81)
- **Sector FR:** `nivelIFC (1-3) x nivelIRC (1-3)` → S1 a S9, con su nombre (ej. S1 estado óptimo, S9 estado crítico).
- **Diana EFR (81 estados):** sector (IFC x IRC) x anillo de composición (FFMI x FMI). Cada estado trae diagnóstico, mecanismo, biomarcadores, riesgos y nutracéuticos. En el v7 es un lookup de 81 entradas indexado por la combinación de 4 bandas. La estructura está en `efr_states` (`DATABASE.md`); el contenido clínico de las 81 entradas: Gildardo.

## PBI (9) y EIEC
- **PBI:** `nivelAF x nivelIR` → 9 estados (de óptimo a riesgo máximo).
- **EIEC:** ratio ECW/ICW → estados de equilibrio hídrico.

## Reglas de protocolo
Lógica determinista por fenotipo + comorbilidades: estrategia calórica (con referencias ESPEN/KDIGO/ADA/AHA), proteína mínima/máxima, restricciones dietarias, exámenes recomendados, suplementación (mapeada a productos VitaCelleBIS) y alertas (ej. síndrome de realimentación). La validez clínica de cada regla y umbral: Gildardo.

## Versionado del modelo
- Una versión activa a la vez.
- Cada cambio en fórmulas, cortes, mapas, estados o reglas crea una nueva versión del modelo + un nuevo `rules_version`.
- **Reproducibilidad:** cada registro clínico guarda `model_version_id` + `rules_version` + `engine_version` + `survey_version_id`, más su snapshot. Un diagnóstico calculado con v1.0 conserva su cálculo v1.0 aunque el modelo evolucione.

## Frontera ciencia / implementación / datos
- **Ciencia** (este documento): la define Gildardo.
- **Implementación** (`CLINICAL_ENGINE.md`): Atlas la porta con fidelidad y golden tests.
- **Datos** (`model-registry` en `DATABASE.md`): los cortes, mapas, fenotipos, sectores y las 81 entradas EFR se almacenan versionados. Las fórmulas son código.
- Regla: si un número clínico puede cambiar entre versiones, es dato versionado, no constante de código.

## Lo que Gildardo debe completar y firmar
- Las expansiones y definiciones formales de los acrónimos (IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, IAE, EB).
- La fuente de verdad de cada corte (qué Excel, qué versión) y la confirmación de que coinciden con lo transcrito del v7.
- Dónde y cómo se calculan ISCM, IEHH, IAE y EB.
- La validez clínica de los fenotipos (F1-F12), sectores (S1-S9), estados EFR (81), PBI (9) y de las reglas de protocolo.
- Una muestra de valores oro firmada como clínicamente correcta.
- Las diferencias del núcleo clínico entre el v7 y el HTML final corregido.
