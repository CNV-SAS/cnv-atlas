# DELTA2.md — Catch-up legal (menores de edad) + preparación para B11

**Contexto.** Desde el cierre de B10, el chat legal dedicado produjo tres actualizaciones que ya están en `docs/`: `DATA_GOVERNANCE.md` (v1.1), `SECURITY.md` (v1.1) y `CONSENT_ATLAS.md` (v1.5). El cambio central es que **el MVP ahora SÍ soporta pacientes menores de 18 años** (Registro de Decisiones #15 de DATA_GOVERNANCE, revierte la decisión anterior). Este documento traduce esa decisión a trabajo técnico concreto sobre lo ya construido en B1 y B7.

**Cuándo aplicarlo.** Antes de B11. B7 está terminado y testeado bajo el supuesto "solo mayores de 18"; este DELTA lo actualiza sin rehacerlo desde cero.

---

## Parte A — Esquema (afecta B1: patient_consents)

### A1 [BLOQUEANTE] Ampliar `consent_type_enum` de 6 a 8 valores
Agregar dos valores nuevos al enum ya existente (creado en el DELTA anterior, B1):
```sql
alter type consent_type_enum add value 'representante_legal';
alter type consent_type_enum add value 'asentimiento_menor';
```
Nota para CC: `ALTER TYPE ... ADD VALUE` en Postgres no puede ejecutarse dentro de la misma transacción que luego usa el valor nuevo. Verificar si Drizzle/el runner de migraciones lo maneja en una migración separada o si hace falta dos pasos. Confirmar contra la doc de Postgres antes de escribir la migración.

### A2 [BLOQUEANTE] Columnas nuevas en `patient_consents`
Se agregan nullable, se llenan solo cuando `consent_type = 'representante_legal'`:
```sql
legal_representative_name text,
legal_representative_document text,
legal_representative_relationship text,
legal_representative_email text
```
Decisión de diseño (ya tomada, no reabrir): viven como columnas en `patient_consents`, NO en una tabla nueva. El registro `representante_legal` es conceptualmente una autorización más, igual que las otras 7, solo que con campos adicionales. Evita joins nuevos y es consistente con el patrón "una fila por tipo de autorización" ya establecido.

### A3 [IMPORTANTE] `asentimiento_menor` no necesita columnas nuevas
Es un registro simple (como `comunicaciones_comerciales`); el nombre del menor ya vive en `patient_profiles`, no se duplica.

---

## Parte B — Flujo de la encuesta (afecta B7)

### B1 [IMPORTANTE] Re-vendorizar el consentimiento a v1.5
En B7 se vendorizó el texto v1.2 en `src/modules/consent/text/consent-v1.2.ts` con un hash anclado en un test (`790c89d3...`). Esto se repite para v1.5:
- Nuevo archivo `text/consent-v1.5.ts` con el texto canónico de `CONSENT_ATLAS.md` v1.5 (secciones 1-13, placeholders intactos, bloques internos excluidos), siguiendo exactamente la misma regla C1 del DELTA original.
- El test de hash se actualiza para anclar el hash de v1.5 (será distinto al de v1.2, es intencional).
- Mantener `consent-v1.2.ts` sin borrar (las versiones anteriores se conservan durante el periodo de retención, per DATA_GOVERNANCE "Versiones del consentimiento").
- `consentSchema` (Zod) se extiende para los campos condicionales del bloque de representante legal y el asentimiento.

### B2 [IMPORTANTE] Selector explícito de mayoría/minoría de edad (reemplaza la sola declaración)
En el paso de consentimiento de la encuesta, ANTES de mostrar las casillas de autorización, se presenta una selección obligatoria y explícita:
- "Soy mayor de 18 años" → flujo actual sin cambios (declaración + 3 casillas necesarias + 3 opcionales).
- "Soy menor de edad" → se abre el bloque de representante legal:
  - Campos: nombre completo, tipo y número de documento, parentesco/calidad (padre/madre/tutor/curador), correo electrónico del representante.
  - **Fecha de nacimiento del menor, pedida aquí mismo** (no solo en identificación más adelante): determina si corresponde mostrar el checkbox de asentimiento (14-17 años). Este valor se reutiliza/prefill en el paso de identificación posterior; no se vuelve a pedir.
  - Si la edad calculada da 14-17 años: aparece el checkbox de asentimiento del menor (texto exacto del numeral 11 de CONSENT_ATLAS.md), con el nombre del menor interpolado.
  - Las 3 casillas necesarias y 3 opcionales siguen igual, pero firmadas por el representante (el copy ya lo aclara en CONSENT_ATLAS.md sección 2, nota).

### B3 [IMPORTANTE] Validación cruzada al confirmar identidad (segundo muro)
Cuando el profesional confirma identidad (B7, `confirmEvaluationIdentity`), se agrega una verificación: la fecha de nacimiento real del paciente (la que quedó en `patient_profiles.birth_date`) debe ser consistente con la rama de consentimiento que se usó (mayor/menor). Si hay discrepancia (se marcó "mayor" siendo menor de edad según el documento, o viceversa), la confirmación se bloquea con un mensaje claro, no pasa en silencio. El profesional debe resolver la discrepancia (típicamente: pedir que se vuelva a hacer el consentimiento con la rama correcta) antes de continuar.

### B4 [IMPORTANTE] Escritor transaccional (intake-writer.ts)
Al persistir los consentimientos, si la rama fue "menor de edad": insertar el registro `representante_legal` con sus columnas nuevas, y si aplica (14-17), el registro `asentimiento_menor`. Mismo patrón transaccional ya existente (orden de inserción respetado, gate de la regla 15 sin cambios: sigue exigiendo las mismas 3 autorizaciones necesarias, ahora firmadas por el representante cuando aplica).

---

## Parte C — Página de consentimiento vigente (nueva, pequeña)

### C1 [MENOR] Página de solo lectura del consentimiento vigente
Nueva ruta `(app)/consentimiento` (requiere sesión, cualquier rol autenticado) que renderiza el texto vendorizado vigente (`CONSENT_TEXT_V1_5` una vez exista) de forma legible, sin casillas ni formulario. Propósito: que el Integrante pueda consultar en cualquier momento qué consentimiento está vigente. No requiere policy especial más allá de estar autenticado.

---

## Parte D — BACKLOG.md (agregar, no bloquea nada del MVP)

### D1 Exportación de Historia Clínica al offboarding (alta prioridad post-primer-contrato)
Cuando un Integrante termina su vinculación con CNV, Atlas debe poder generar y entregar una exportación completa de las historias clínicas de sus pacientes: PDF por paciente + JSON/CSV estructurado. Entrega dentro de los 10 días hábiles siguientes a la terminación (DATA_GOVERNANCE, sección "Custodia de la historia clínica"). Funcionalidad de panel admin: "generar exportación de HC para Integrante X".

Después de la exportación, lógica de retención diferenciada por paciente según si marcó la casilla 4 (investigación) en su consentimiento:
- **Con casilla 4 marcada:** CNV retiene los datos seudonimizados en la capa de investigación.
- **Sin casilla 4:** los datos identificables del paciente se conservan un periodo de gracia de **30 días por defecto (configurable por admin, no hardcodeado)** tras la exportación, como garantía de que la entrega fue completa; vencido ese plazo, se anonimizan o eliminan.

Requiere: job programado (candidato: Vercel Cron o Inngest, ya está en el roadmap de background jobs de ARCHITECTURE.md), no es una función síncrona.

### D2 Bloque futuro: Alegra Producción
Al pasar la integración de Alegra de sandbox a producción real, hace falta un bloque propio (no es un ajuste menor de B6): credenciales de producción; re-mapeo completo de IDs (productos/nutracéuticos con IVA 19% configurado en Alegra producción, impuesto IVA, numeración/resolución de factura electrónica, centro de costo "Vitacellebis", bodegas si aplica); reglas de contenido de factura ya decididas (PVP completo con IVA, sin descontar comisión de Wompi, sin retención en la fuente, medio de pago correcto, contacto real del paciente con documento y correo, código de identificación por producto tipo NUT-001 para evitar observación FAZ09 de la DIAN); captura de CUFE/número de factura/estado DIAN; idempotencia estricta (una venta, una factura); conciliación Wompi (bruto facturado vs. neto desembolsado, la comisión de Wompi es gasto aparte con su propia factura). 

Decisiones ya tomadas para cuando se construya: (a) numeración/prefijo de Atlas distinto al manual, para trazabilidad limpia; (b) el inventario operativo lo sigue manejando Atlas (ya construido en B5), Alegra solo factura, no se modela bodega por profesional en Alegra.

### D3 Automatización de verificación de correo dual (Learning vs Atlas)
Cuando un profesional indica en el onboarding que su correo de Atlas es distinto al de CNV Learning, hoy se registra manualmente (10 personas, viable). A futuro, automatizar la validación/vinculación entre ambos correos.

---

## Parte E — MVP.md

### E1 [MENOR] Anotar el bloque futuro de Alegra Producción en el roadmap
Agregar una referencia en MVP.md a que existe un bloque post-B15 (o donde corresponda) para Alegra Producción, apuntando a BACKLOG.md D2, para que quede visible en la planificación y no se pierda.

---

## Resumen de prioridades

| ID | Área | Prioridad |
|----|------|-----------|
| A1 | Esquema | BLOQUEANTE |
| A2 | Esquema | BLOQUEANTE |
| A3 | Esquema | IMPORTANTE (sin trabajo, solo confirmación) |
| B1 | Encuesta/consentimiento | IMPORTANTE |
| B2 | Encuesta/consentimiento | IMPORTANTE |
| B3 | Confirmación de identidad | IMPORTANTE |
| B4 | Escritor transaccional | IMPORTANTE |
| C1 | Página nueva | MENOR |
| D1, D2, D3 | BACKLOG | Sin bloqueo, documental |
| E1 | MVP.md | MENOR |
