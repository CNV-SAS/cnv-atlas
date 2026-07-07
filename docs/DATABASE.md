# Modelo de datos de Atlas (CNV)

**Versión:** 1.2 (añadidas tablas de IA: `ai_config` y `ai_prompts` versionados)
**Motor:** PostgreSQL 15+ vía Supabase. ORM/migraciones: Drizzle.
**Acompaña a:** `ARCHITECTURE.md`, `SECURITY.md`, `MVP.md`, `CLINICAL_ENGINE.md`.

> Cambios v1.1: `diagnosis_definitions` reemplazado por catálogos del registry (`phenotypes`, `fr_sectors`, `efr_states` la Diana de 81 indexada por 4 bandas); `diagnoses` ahora referencia fenotipo/sector/estado EFR; import de BIS corregido a XLSX (Biody Manager + exceljs); `ai_diagnosis_suggestions` renombrado a `ai_menu_suggestions` (la IA genera el menú, no el diagnóstico).
> Cambios B11 (taxonomía real, autoridad del código sobre las especulaciones): `phenotypes` = 9 fenotipos estructurales (FFMI x FMI), `fr_sectors` = 9 sectores FyR (IFC x IRC); F1-F12/S1-S9/PBI/EIEC ya no aplican. `indicator_values.value` pasa a nullable (indicadores no calculables). La ciencia y los cortes viven congelados en `src/clinical-engine/frozen/`.

> El contenido clínico (indicadores, rangos, preguntas de la encuesta, escenarios de la Diana) está congelado hasta la entrega de Gildardo. Este documento define la **estructura** que lo contiene; el contenido se llena en el bloque clínico.

## Principios
1. **`auth.users` es solo identidad técnica.** El dominio de staff y profesionales vive en `public.profiles`. **Los pacientes NO son `auth.users`** (no inician sesión): son entidad de dominio pura.
2. **Seudonimización operativa.** La data clínica cuelga de `patient_id` (UUID). La PII vive en tablas aparte con RLS estricto. Ninguna tabla clínica/científica carga nombre ni documento, solo `patient_id`.
3. **Constelación de versiones.** Todo registro clínico guarda con qué se calculó: `engine_version`, `survey_version_id`, `model_version_id`, `rules_version`.
4. **Snapshot.** Lo que el profesional vio/aprobó y el paciente recibió se persiste tal como fue (valores, clasificación, diagnóstico, reporte). No se re-deriva.
5. **`clinical_audit_log` append-only.** Sin UPDATE ni DELETE, reforzado por trigger. Inline en la transacción, nunca por el bus.
6. **Multi-tenant.** `organization_id` en las tablas de dominio.
7. **Toda tabla con RLS habilitado.** Sin excepción.
8. **Migraciones forward-only.** Una migración aplicada nunca se edita; se crea otra encima. Comentario del porqué al inicio.
9. **`created_at`/`updated_at`** en toda tabla mutable, con `default now()` y trigger para `updated_at`.
10. **IDs `uuid`** con `default gen_random_uuid()` salvo clave natural justificada.
11. **Enums centrales** como tipos PostgreSQL.
12. **Seed determinístico.** Mismo resultado en cada reset.
13. **Borrado:** soft-delete (`deleted_at`) en dominio; el log clínico/auditoría es exento (append-only).

## Enums
```sql
create type app_role as enum ('admin', 'direccion', 'soporte', 'obbia', 'professional');
create type document_type as enum ('CC', 'CE', 'TI', 'PA', 'NIT');
create type patient_status as enum ('active', 'inactive');
create type profile_status as enum ('active', 'inactive');
create type evaluation_type as enum ('inicial', 'seguimiento');
create type evaluation_status as enum ('draft', 'in_progress', 'completed');
create type field_data_class as enum ('identifier', 'quasi_identifier', 'clinical');
create type indicator_classification as enum ('normal', 'riesgo', 'critico');
create type model_status as enum ('draft', 'active', 'retired');
create type device_status as enum ('available', 'in_use', 'maintenance', 'out_of_service', 'lost', 'retired');
create type assignment_status as enum ('active', 'completed', 'breach');
create type report_status as enum ('draft', 'approved', 'sent');
create type transaction_status as enum ('pending', 'paid', 'failed', 'refunded');
create type ai_suggestion_status as enum ('success', 'timeout', 'parse_failed', 'provider_error');
create type consent_type_enum as enum (
  'servicio', 'datos_sensibles', 'internacional_ia',
  'investigacion', 'comunicaciones_continuidad', 'comunicaciones_comerciales',
  'representante_legal', 'asentimiento_menor'  -- menores de edad (DELTA2 A1)
);
```

## Tablas

### Grupo 1: organización, usuarios, roles
```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,                       -- clinica, consultorio, unidad CNV
  country text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Espejo de auth.users SOLO para staff y profesionales (no pacientes).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  email text not null,
  full_name text not null,
  status profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx on profiles(organization_id);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name app_role not null unique,
  description text
);

-- N:N: un usuario puede tener varios roles.
create table public.user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on user_roles(role_id);

-- Datos de dominio del profesional (1:1 con profiles cuando tiene rol professional).
create table public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  license text,                             -- registro profesional
  specialty text,
  certification_status text,                -- gate de habilitacion ANI-BIS-E
  commission_rate numeric not null default 0.20,  -- editable por admin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_certifications (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles(id) on delete cascade,
  certification_name text not null,
  institution text,
  year int,
  created_at timestamptz not null default now()
);
```

### Grupo 2: pacientes (seudonimización)
```sql
-- Identidad mínima. El documento es la llave de resolución de identidad.
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  document_type document_type not null,
  document_number text not null,
  status patient_status not null default 'active',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, document_type, document_number)
);

-- PII demográfica.
create table public.patient_profiles (
  patient_id uuid primary key references patients(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date,
  sex text,
  country text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patient_contacts (
  patient_id uuid primary key references patients(id) on delete cascade,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Consentimiento versionado e inmutable.
create table public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  consent_type consent_type_enum not null,
  consent_version text not null,            -- version exacta del texto
  document_hash text not null,              -- hash del texto aceptado
  signed_at timestamptz not null default now(),
  revoked_at timestamptz,                   -- null = autorizacion vigente; con valor = revocada (no se borra el registro)
  -- Menores de edad (DELTA2 A2). Nullable; solo se llenan cuando
  -- consent_type = 'representante_legal'. El registro del representante es una
  -- autorizacion mas, con campos adicionales; no una tabla nueva.
  legal_representative_name text,
  legal_representative_document text,
  legal_representative_relationship text,
  legal_representative_email text
);
create index patient_consents_patient_idx on patient_consents(patient_id);
-- Una sola autorizacion activa por (paciente, tipo): re-consentir revoca primero
-- la anterior en la misma transaccion. No usar unique(patient_id, consent_type) a
-- secas, romperia el re-consentimiento.
create unique index patient_consents_one_active_idx
  on public.patient_consents (patient_id, consent_type)
  where revoked_at is null;

create table public.patient_professional_relationships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  professional_id uuid not null references professional_profiles(id) on delete restrict,
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  unique (patient_id, professional_id)
);
create index ppr_professional_idx on patient_professional_relationships(professional_id);
```

### Grupo 3: modelo científico (registry)
```sql
create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  version_name text not null unique,        -- "ANI-BIS-E 1.0"
  rules_version text not null,              -- version de las reglas diagnosticas
  description text,
  status model_status not null default 'draft',
  created_at timestamptz not null default now()
);
-- Solo una version 'active' a la vez (se valida en aplicacion + indice parcial).
create unique index model_versions_one_active_idx on model_versions(status) where status = 'active';

create table public.model_variables (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references model_versions(id) on delete cascade,
  variable_name text not null,
  description text
);

create table public.indicator_definitions (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references model_versions(id) on delete cascade,
  code text not null,                       -- IFC, IRC, IEHH, ...
  name text not null,
  unit text,
  description text,
  unique (model_version_id, code)
);

create table public.indicator_ranges (
  id uuid primary key default gen_random_uuid(),
  indicator_definition_id uuid not null references indicator_definitions(id) on delete cascade,
  min_value numeric,
  max_value numeric,
  classification indicator_classification not null
);

-- Catálogo de fenotipos ESTRUCTURALES (9 = FFMI x FMI). Taxonomía REAL del motor de
-- Gildardo (B11: STRUCT_LABELS). code = la clave del par de bandas ("A_B", "N_A", ...).
-- (La nomenclatura vieja "F1-F12 MCCB con MCA" era especulativa y ya no aplica.)
create table public.phenotypes (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references model_versions(id) on delete cascade,
  code text not null,                       -- clave estructural: "A_B", "N_N", "B_A", ...
  name text not null,
  risk text,
  unique (model_version_id, code)
);

-- Catálogo de sectores funcionales FyR (9 = IFC x IRC). Taxonomía REAL del motor
-- (B11: FYR_LABELS). code = clave del par de bandas ("3_1" = IFC alto x IRC bajo, ...).
-- (La nomenclatura vieja "S1-S9" ya no aplica.)
create table public.fr_sectors (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references model_versions(id) on delete cascade,
  code text not null,                       -- clave FyR: "3_1", "2_2", "1_3", ...
  name text not null,
  unique (model_version_id, code)
);

-- Diana EFR de 81 estados. En el v7 es un lookup por la combinación de 4 bandas
-- (IFC, IRC, FFMI, FMI); aquí se almacena versionado y con su contenido clínico.
create table public.efr_states (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references model_versions(id) on delete cascade,
  state_number int not null,                -- 1..81
  ifc_band int not null,                    -- bandas que forman la llave
  irc_band int not null,
  ffmi_band int not null,
  fmi_band int not null,
  diagnosis_name text not null,             -- DX[key].dx del motor congelado (contenido REAL de Gildardo, verbatim; se puebla corriendo getDX por las 81 bandas en B11)
  mechanism text,                           -- DX[key].mec
  biomarkers text,                          -- DX[key].bio
  risks text,                               -- DX[key].rsk
  suggested_nutraceuticals text,            -- DX[key].n
  unique (model_version_id, state_number),
  unique (model_version_id, ifc_band, irc_band, ffmi_band, fmi_band)
);
```
> Nota B11 (taxonomía real): al portar el motor de Gildardo, la taxonomía REAL del código tiene autoridad sobre las especulaciones previas. PBI (9 estados, AF x IR) y EIEC ya NO aplican; el diagnóstico funcional integrado lo da el DFI (5 dominios + riesgo + rutas), no un catálogo PBI/EIEC. Los cortes de los clasificadores viven en el motor congelado (`src/clinical-engine/frozen/`), fuente única; el registry es su espejo consultable. Ver `SCIENTIFIC_MODEL.md` y `CLINICAL_ENGINE.md`.

### Grupo 4: encuesta
```sql
create table public.survey_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.survey_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references survey_templates(id) on delete cascade,
  version_number int not null,
  published_at timestamptz not null default now(),
  unique (template_id, version_number)
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references survey_versions(id) on delete cascade,
  question_text text not null,
  question_type text not null,              -- texto, numero, opcion, opcion_multiple
  field_key text,                           -- d-field del motor (d5_39, d3_24...); nullable: solo las preguntas que alimentan el motor. Puente questionId->variable de calcLE8/DFI. Las opciones deben coincidir caracter por caracter con lo que lee el motor congelado.
  section text,                             -- dominio de la encuesta (D1-D8) para agrupar visualmente en el intake (B7.1); etiqueta orientada al paciente, nullable
  order_index int not null,
  data_class field_data_class not null,     -- clasificacion de 3 niveles
  used_in_diagnosis boolean not null default false,
  unique (survey_version_id, order_index)
);

create table public.survey_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references survey_questions(id) on delete cascade,
  option_text text not null,
  value numeric,
  order_index int not null
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  survey_version_id uuid not null references survey_versions(id),
  ip_address inet,
  created_at timestamptz not null default now()
);
create index survey_responses_eval_idx on survey_responses(evaluation_id);

create table public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references survey_responses(id) on delete cascade,
  question_id uuid not null references survey_questions(id),
  answer_value text
);
create index survey_answers_response_idx on survey_answers(response_id);

-- Links de acceso a la encuesta publica (B7). El token opaco de la URL mapea, en
-- servidor, a (profesional, organizacion); aqui vive ese mapeo y el estado del
-- link. Una sola tabla cubre los dos tipos de link de la encuesta:
--   - inicial: link generico reusable que el profesional comparte como QR; no
--     carga PII de nadie (patient_id/prefill null); no expira ni se consume.
--   - seguimiento: emitido para un paciente concreto, de un solo uso; pre-carga
--     cuasi-identificadores estables (ciudad, celular), se vence al completar
--     (consumed_at) con colchon de 30 dias (expires_at).
-- Lectura del token en el intake: via service_role (sin sesion del paciente). El
-- profesional emite links con su sesion (RLS); consumir/expirar lo hace el intake.
create table public.survey_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  professional_id uuid not null references professional_profiles(id) on delete restrict,
  type evaluation_type not null,            -- inicial (reusable) | seguimiento (un uso)
  token text not null unique,               -- opaco, alta entropia
  patient_id uuid references patients(id) on delete cascade,  -- solo seguimiento
  prefill jsonb,                            -- solo seguimiento: cuasi-identificadores editables
  expires_at timestamptz,                   -- seguimiento: now()+30d; inicial: null
  consumed_at timestamptz,                  -- seguimiento: al completar; inicial: null
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index survey_links_professional_idx on survey_links(professional_id);
```

### Grupo 5: evaluaciones (la ruta)
```sql
-- El hub. Pertenece a paciente + profesional + organizacion.
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete restrict,
  professional_id uuid not null references professional_profiles(id) on delete restrict,
  organization_id uuid not null references organizations(id),
  type evaluation_type not null,
  status evaluation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index evaluations_patient_idx on evaluations(patient_id);
create index evaluations_professional_idx on evaluations(professional_id);

create table public.evaluation_notes (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  author_id uuid not null references profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);
```

### Grupo 6: BIS
```sql
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  asset_code text not null unique,          -- CNV-BIS-0001
  manufacturer_serial text not null unique, -- serial de fabrica
  system_email text not null unique,        -- login Biody Manager (clave en vault, NO aqui)
  brand text,                               -- marca del fabricante; el asset_code es agnostico de ella
  model text not null,                      -- Biody B.I.S ZM
  supplier text,                            -- Aminogram
  purchase_date date,
  status device_status not null default 'available',
  last_calibration_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bis_variables (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                -- resistencia, reactancia, angulo de fase
  unit text,
  description text
);

create table public.bis_measurements (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  device_id uuid references devices(id),
  measurement_date timestamptz not null,
  device_calibration_date date,             -- snapshot de calibracion al escanear
  created_at timestamptz not null default now()
);
create index bis_measurements_eval_idx on bis_measurements(evaluation_id);

-- Modelo flexible (nombre+valor): absorbe el export XLSX de Biody Manager (procesado
-- con SheetJS) sin conocer su forma exacta. (El v7 importa Excel, no CSV.)
create table public.bis_raw_values (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references bis_measurements(id) on delete cascade,
  variable_name text not null,
  value numeric not null
);
create index bis_raw_values_measurement_idx on bis_raw_values(measurement_id);

create table public.bis_import_logs (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid references evaluations(id) on delete set null,
  status text not null,                     -- ok, validation_failed, parse_failed
  error_detail text,
  created_at timestamptz not null default now()
);
```

### Grupo 7: indicadores calculados
```sql
create table public.indicator_values (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  indicator_definition_id uuid not null references indicator_definitions(id),
  value numeric,                            -- nullable (B11): el motor devuelve null para indicadores no calculables (EB/IAE sin encuesta; ISCM/IEHH sin insumos secundarios). No se inventa un 0.
  classification indicator_classification,
  -- Constelacion de versiones (procedencia):
  engine_version text not null,
  survey_version_id uuid not null references survey_versions(id),
  model_version_id uuid not null references model_versions(id),
  rules_version text not null,
  created_at timestamptz not null default now()
);
create index indicator_values_eval_idx on indicator_values(evaluation_id);
```

### Grupo 8: diagnóstico
```sql
create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete restrict,
  -- Estado resuelto por el motor (determinista, vía la Diana). No es IA.
  efr_state_number int not null,            -- 1..81 (clave IFC_IRC_FFMI_FMI)
  phenotype_id uuid references phenotypes(id),  -- fenotipo estructural (9, FFMI x FMI)
  fr_sector_id uuid references fr_sectors(id),  -- sector FyR (9, IFC x IRC)
  diagnosis_name text not null,
  -- Constelacion de versiones:
  engine_version text not null,
  model_version_id uuid not null references model_versions(id),
  rules_version text not null,
  confirmed_by uuid references profiles(id),  -- el profesional que confirma
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index diagnoses_eval_idx on diagnoses(evaluation_id);

create table public.diagnosis_notes (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references diagnoses(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

-- IA de apoyo: en el v7 la IA (Groq) genera el MENÚ/dieta dados los objetivos del
-- protocolo, NO el diagnóstico (ese es determinista). Inmutable, sin PII.
create table public.ai_menu_suggestions (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references treatments(id) on delete cascade,
  generated_by uuid not null references profiles(id),
  provider text not null,                   -- groq, gemini
  model text not null,
  prompt_version text not null,
  generated_text text,                      -- el menú generado
  raw_response jsonb,
  status ai_suggestion_status not null,
  latency_ms int,
  generated_at timestamptz not null default now()
);
create index ai_menu_suggestions_treatment_idx on ai_menu_suggestions(treatment_id);
```

### Grupo 9: tratamiento
```sql
create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references diagnoses(id) on delete restrict,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table public.treatment_nutraceuticals (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references treatments(id) on delete cascade,
  nutraceutical_id uuid not null references nutraceuticals(id),
  dosage text,
  duration_days int
);

create table public.treatment_diet_guidelines (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references treatments(id) on delete cascade,
  guideline_text text not null
);

create table public.treatment_notes (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references treatments(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);
```

### Grupo 10: seguimiento
```sql
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete restrict,
  treatment_id uuid references treatments(id) on delete set null,
  evaluation_id uuid references evaluations(id) on delete set null,  -- la evaluacion de tipo seguimiento
  followup_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index followups_patient_idx on followups(patient_id);

create table public.followup_metrics (
  id uuid primary key default gen_random_uuid(),
  followup_id uuid not null references followups(id) on delete cascade,
  metric_name text not null,
  value numeric
);
```

### Grupo 11: reportes (snapshot)
```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  type text not null,                       -- paciente, profesional, modelo
  status report_status not null default 'draft',
  snapshot jsonb not null,                  -- contenido exacto, inmutable, del reporte
  professional_notes text,                  -- B10.1: notas del profesional, editable solo en draft; congelada al aprobar (trigger). Vive aparte del snapshot
  send_mode text,                           -- B10.1: modo de envio, sellado al enviar: 'atlas' | 'notas' | 'ambos'
  storage_path text,                        -- PDF en Storage privado
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_eval_idx on reports(evaluation_id);
```
> Trigger `prevent_report_snapshot_mutation` (0003, extendido en 0010): bloquea DELETE, congela `snapshot` siempre y congela `professional_notes` cuando `status <> 'draft'` (se fija en draft->approved y luego es inmutable). Los UPDATE de estado (status, approved_by/at, sent_at, storage_path, send_mode) pasan.

### Grupo 12: comodato
```sql
create table public.device_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete restrict,
  professional_id uuid not null references professional_profiles(id) on delete restrict,
  start_date date not null,
  expected_end_date date not null,
  actual_return_date date,                  -- nulo hasta devolucion
  status assignment_status not null default 'active',
  legal_document_url text,                  -- PDF del comodato firmado
  created_at timestamptz not null default now()
);
create index device_assignments_device_idx on device_assignments(device_id);
create index device_assignments_professional_idx on device_assignments(professional_id);
```

### Grupo 13: nutracéuticos
```sql
create table public.nutraceuticals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  description text,
  unit text,
  unit_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nutraceutical_inventory (
  id uuid primary key default gen_random_uuid(),
  nutraceutical_id uuid not null references nutraceuticals(id) on delete cascade,
  stock_quantity int not null default 0,
  last_updated timestamptz not null default now()
);

create table public.nutraceutical_usage (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references treatments(id) on delete cascade,
  nutraceutical_id uuid not null references nutraceuticals(id),
  quantity int not null
);
```

### Grupo 14: pagos y finanzas
```sql
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  patient_id uuid references patients(id) on delete set null,
  professional_id uuid references professional_profiles(id) on delete set null,
  status transaction_status not null default 'pending',
  amount numeric not null,
  currency text not null default 'COP',
  wompi_transaction_id text,
  alegra_invoice_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_professional_idx on transactions(professional_id);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  nutraceutical_id uuid not null references nutraceuticals(id),
  quantity int not null,
  unit_price numeric not null
);

create table public.professional_revenue (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  professional_id uuid not null references professional_profiles(id),
  commission_rate numeric not null,         -- snapshot de la tasa aplicada
  commission_amount numeric not null,
  created_at timestamptz not null default now()
);

create table public.cnv_revenue (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

-- Idempotencia y auditoria de webhooks de pago.
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                   -- wompi, alegra
  external_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);
```

### Grupo 15: investigación (ligero en MVP)
```sql
create table public.research_datasets (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references profiles(id),
  scope text not null,
  anonymization_level text not null,        -- aggregate, anonymized
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
```

### Grupo 16: gobernanza
```sql
-- Append-only. Sin UPDATE/DELETE (RLS + trigger). Inline, nunca por el bus.
create table public.clinical_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  actor_email text,
  event text not null,
  entity_type text,
  entity_id text,
  payload jsonb,
  model_version_id uuid references model_versions(id),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index clinical_audit_actor_idx on clinical_audit_log(actor_id);
create index clinical_audit_event_idx on clinical_audit_log(event);
create index clinical_audit_entity_idx on clinical_audit_log(entity_type, entity_id);
create index clinical_audit_created_idx on clinical_audit_log(created_at desc);
```

### Grupo 17: IA (config y prompts versionados)
```sql
-- Config global de IA: el admin elige proveedor/modelo activos (las keys siguen en .env).
create table public.ai_config (
  id uuid primary key default gen_random_uuid(),
  active_provider text not null,            -- groq, gemini
  active_model text not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- Prompts versionados, editables por admin. Cada edición crea una versión nueva (inmutable).
create table public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,                 -- ej. menu.generate
  version int not null,
  content text not null,
  status text not null default 'active',    -- active, retired
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (prompt_key, version)
);
create unique index ai_prompts_one_active_idx on ai_prompts(prompt_key) where status = 'active';
```
Cada `ai_menu_suggestions` guarda el `prompt_version` con que se generó (procedencia). El cambio de proveedor/modelo y la edición de prompt se registran en `clinical_audit_log`.

## Helpers RLS y hardening
**Convención obligatoria:** toda función `security definer` lleva `set search_path = ''` e identificadores calificados con schema. Previene search path hijacking (una función `security definer` corre con privilegios del owner).

```sql
-- Roles del usuario actual (N:N).
create or replace function public.current_user_roles()
returns setof public.app_role
language sql stable security definer set search_path = ''
as $$
  select r.name from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
$$;

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = p_role
  )
$$;

-- El profesional del paciente (vía relacion).
create or replace function public.is_patient_professional(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.patient_professional_relationships ppr
    join public.professional_profiles pp on pp.id = ppr.professional_id
    where ppr.patient_id = p_patient_id and pp.profile_id = auth.uid()
  )
$$;
```

## RLS: patrones y ejemplos críticos
Toda tabla lleva `alter table ... enable row level security`. Las políticas siguen cuatro patrones, y se escriben tabla por tabla en sus migraciones:

- **Propias del usuario:** el dueño ve/edita lo suyo (`auth.uid() = ...`).
- **Profesional del paciente:** acceso a la data clínica de sus pacientes (`is_patient_professional(patient_id)`).
- **Por rol:** admin/dirección/soporte/obbia según corresponda (`has_role('admin')`, etc.).
- **Obbia/research:** acceso a data agregada/anonimizada, **nunca a PII**.

Ejemplos críticos:
```sql
-- patients: el profesional ve a sus pacientes; admin/soporte todos; obbia NO PII.
create policy "Professional views own patients" on public.patients
  for select to authenticated using (public.is_patient_professional(id));
create policy "Staff views patients" on public.patients
  for select to authenticated using (public.has_role('admin') or public.has_role('soporte'));

-- patient_profiles (PII): mismo acceso, obbia excluido explicitamente.
create policy "Professional views own patients PII" on public.patient_profiles
  for select to authenticated using (public.is_patient_professional(patient_id));
create policy "Admin views patients PII" on public.patient_profiles
  for select to authenticated using (public.has_role('admin'));

-- evaluations: el profesional dueño + admin.
create policy "Professional manages own evaluations" on public.evaluations
  for all to authenticated
  using (public.is_patient_professional(patient_id))
  with check (public.is_patient_professional(patient_id));

-- diagnoses: lectura para el profesional del paciente de esa evaluacion.
create policy "Professional views diagnoses of own patients" on public.diagnoses
  for select to authenticated using (
    exists (
      select 1 from public.evaluations e
      where e.id = diagnoses.evaluation_id and public.is_patient_professional(e.patient_id)
    )
  );

-- clinical_audit_log: solo admin lee. Sin INSERT por usuario (va por service role inline),
-- sin UPDATE/DELETE (append-only).
create policy "Admin reads clinical audit" on public.clinical_audit_log
  for select to authenticated using (public.has_role('admin'));
```

**Campos secretos:** RLS es por fila, no por columna. Cuando un rol no debe ver un campo (ej. obbia no debe ver PII), se bloquea el SELECT de esa tabla para ese rol y se sirve el dato filtrado desde un route handler con service role. Mismo patrón que en el LMS.

## Triggers
```sql
-- updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
-- Aplicar a cada tabla con updated_at (organizations, profiles, professional_profiles,
-- patient_profiles, patient_contacts, evaluations, devices, nutraceuticals, transactions).

-- Append-only del audit clinico: bloquea UPDATE/DELETE incluso con service role.
create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'clinical_audit_log es append-only: no se permite % ', tg_op;
end;
$$;
create trigger clinical_audit_no_update
  before update or delete on public.clinical_audit_log
  for each row execute function public.prevent_audit_mutation();
```

## Storage buckets
```sql
-- Reportes del paciente: privado, acceso interno por URL firmada.
insert into storage.buckets (id, name, public) values ('patient-reports', 'patient-reports', false);
create policy "Staff and patient professional read reports" on storage.objects
  for select using (
    bucket_id = 'patient-reports' and (
      public.has_role('admin')
      -- el path incluye patient_id; se valida is_patient_professional en route handler
    )
  );
-- Comodato firmado: privado, solo admin/soporte.
insert into storage.buckets (id, name, public) values ('comodato-docs', 'comodato-docs', false);
```
El PDF del paciente se entrega como adjunto por correo; las URLs firmadas son para acceso interno desde Atlas.

## Seed determinístico
`supabase/seed.ts` (vía `pnpm dlx tsx`), estado inicial reproducible con UUIDs fijos:
- 1 organización: CNV.
- Los 5 roles (`admin`, `direccion`, `soporte`, `obbia`, `professional`).
- 1 admin: Santiago (auth user + profile + `user_roles` → admin).
- 1 profesional de prueba (auth user + profile + professional_profile + `user_roles` → professional, `commission_rate` 0.20).
- 1 `model_version` placeholder en estado `active` (contenido de indicadores/rangos/escenarios se llena al entregar Gildardo).
- 1 `survey_template` + `survey_version` con estructura placeholder (preguntas reales al entregar Gildardo).
- 2 `devices` de ejemplo (estados distintos), 2 nutracéuticos con inventario.

Auth users vía `supabase.auth.admin.createUser()` con `email_confirm: true`; el trigger materializa `profiles`. Los roles se asignan explícitamente en `user_roles` (no hay rol por defecto). El resto se inserta con service role. Passwords desde env vars (`SEED_ADMIN_PASSWORD`, etc.).

## Migraciones
Convención `NNNN_descripcion.sql` (4 dígitos), forward-only, con comentario del porqué al inicio. Orden por dependencias: enums → organizations/profiles/roles/user_roles → professional_profiles → patients/profiles/consents/relationships → model_registry → survey → evaluations → bis → indicator_values → diagnoses → treatments → followups → reports → comodato → nutraceuticals → payments → research → clinical_audit_log → helpers RLS → triggers → storage → RLS por tabla. Los helpers van antes de las storage policies y las RLS que los consumen.

Regla dura: una migración aplicada no se modifica; se crea otra encima.

## Tipos TypeScript
Tras cada migración, regenerar `src/types/database.generated.ts` con `supabase gen types typescript --linked`. No se editan a mano; se incluyen en git.
