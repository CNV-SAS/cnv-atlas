# GLOSSARY.md — Glosario de Atlas (CNV)

**Versión:** 0.1
**Nota:** las expansiones clínicas marcadas "(confirmar Gildardo)" son hipótesis derivadas del v7; la definición formal la firma la dirección científica (ver `SCIENTIFIC_MODEL.md`).

## Modelo y producto
- **ANI-BIS-E:** Alimentación y Nutrición Informada basada en Bioimpedancia Espectroscópica y Epigenética. El modelo de atención de CNV.
- **BIS:** Bioimpedancia Espectroscópica.
- **CNV:** Connected Nutrition Ventures.
- **Atlas:** la plataforma donde el modelo ANI-BIS-E se aplica, mide, gobierna y audita.
- **Diana:** gráfico polar de 81 estados (EFR) que integra función, riesgo y composición.
- **EFR:** Estado de Función y Riesgo (los 81 estados de la Diana).
- **MCCB:** matriz de fenotipos de composición corporal bioeléctrica (12 fenotipos, FMI x FFMI x MCA). (confirmar Gildardo)
- **PBI:** los 9 estados de AF x IR. (confirmar Gildardo)
- **EIEC:** equilibrio hídrico extra/intracelular (ECW/ICW). (confirmar Gildardo)
- **Fenotipo (F1-F12):** clasificación de composición corporal del MCCB.
- **Sector FR (S1-S9):** clasificación de función y riesgo (IFC x IRC).
- **VitaCelleBIS:** línea de nutracéuticos de CNV.
- **ObBIA-Latam:** Observatorio Latinoamericano de Bioimpedancia (dirección científica).
- **Comodato:** contrato de préstamo del equipo BIS al profesional.
- **Nutracéutico:** producto de la línea CNV usado en el tratamiento.

## Indicadores clínicos
- **IFC:** Índice de Función Celular (confirmar Gildardo). `C/Rinf*1000`. Óptima / alerta / disfunción.
- **IRC:** Índice de Riesgo Celular (confirmar Gildardo; aquí es el índice bioeléctrico, no insuficiencia renal). `(Re/(Ri*C))*10`. Bajo / moderado / alto.
- **PABU:** `(Re+Ri)*0.9/(Rinf*C)`; relación con el punto áureo φ = 1.618. (confirmar Gildardo)
- **ICA-BIS:** `PABU - 1.618`; desviación del punto áureo. (confirmar Gildardo)
- **ISCM:** Índice de Susceptibilidad ... (confirmar Gildardo). Niveles ISCM-1 a 4.
- **IEHH:** Índice de Equilibrio Hídrico ... (confirmar Gildardo). Óptimo / leve / moderado / severo.
- **IAE:** Índice de Aceleración del Envejecimiento (confirmar Gildardo). En años; desacelerado / concordante / acelerado.
- **EB:** (confirmar Gildardo).

## Variables y composición
- **Cole-Cole:** modelo de impedancia bioeléctrica. **Re** (resistencia extracelular), **Ri** (intracelular), **Rinf** (resistencia a frecuencia infinita), **C** (capacitancia de membrana). (confirmar Gildardo)
- **FFMI:** Fat-Free Mass Index (índice de masa libre de grasa).
- **FMI:** Fat Mass Index (índice de masa grasa).
- **MCA:** Masa Celular Activa (body cell mass).
- **SMM:** Skeletal Muscle Mass (masa muscular esquelética).
- **ASMI:** Appendicular Skeletal Muscle Index.
- **AF:** Ángulo de Fase (phase angle).
- **IR:** índice relacionado con inflamación de bajo grado (confirmar Gildardo).
- **ECW / ICW:** agua extracelular / intracelular.
- **LE8:** Life's Essential 8 (métrica de salud cardiovascular de la AHA).
- **φ (phi):** punto áureo, 1.618; referencia de homeostasis en el modelo.

## Términos técnicos y de gobernanza
- **RLS:** Row Level Security (la base decide qué filas ve cada usuario).
- **Seudonimización:** data clínica por `patient_id` (UUID), PII aparte. Sigue siendo dato personal.
- **Anonimización:** quitar el identificador directo **más** tratar cuasi-identificadores; irreversible.
- **Cuasi-identificador:** dato que re-identifica en combinación (ciudad, fecha de nacimiento, sexo).
- **Constelación de versiones:** `engine_version` + `survey_version_id` + `model_version_id` + `rules_version` en cada registro clínico (procedencia).
- **Snapshot:** copia inmutable de lo que el profesional vio/aprobó y el paciente recibió (evidencia).
- **Golden test / characterization test:** prueba que el port en TS reproduce exactamente la salida del HTML original.
- **Stub (del motor):** implementación falsa que honra el contrato del motor, para cablear y probar antes del motor real.
- **RBAC:** control de acceso basado en roles (vía policies contextuales).
- **MFA / TOTP:** segundo factor por app autenticadora (código que rota cada 30s).
- **Idempotencia:** que repetir una operación (ej. un webhook) produzca un solo efecto.
- **HMAC:** firma que verifica que un webhook viene del proveedor legítimo.
- **Append-only:** tabla a la que solo se agrega; no se edita ni borra (el `clinical_audit_log`).
- **Multi-tenant:** varias organizaciones en una misma instancia, aisladas por `organization_id`.
- **model-registry:** el módulo que almacena el modelo como datos versionados (variables, indicadores, cortes, mapas, 81 estados).
- **FHIR (HL7):** estándar de interoperabilidad de datos de salud. No se adopta en MVP; el esquema se mantiene conceptualmente alineado (patient↔Patient, professional↔Practitioner, bis/indicadores↔Observation, diagnóstico↔Condition, tratamiento↔CarePlan, consentimiento↔Consent). Capa de export/import FHIR en `BACKLOG.md`.
- **clinical-engine:** el módulo TS puro, server-side, que calcula los indicadores y resuelve la Diana.
