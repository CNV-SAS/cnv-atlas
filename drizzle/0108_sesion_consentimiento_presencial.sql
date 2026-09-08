-- SESION DE CONSENTIMIENTO PRESENCIAL · MODALIDAD 2 (QR). Forward-only.
--
-- QUE ES. Un token de UN SOLO USO y vida corta que solo existe en la pantalla del profesional durante esa
-- consulta. El paciente lo escanea con SU telefono, escribe su identidad, lee y marca. Resuelve el caso
-- que la modalidad 1 no resuelve: el paciente SIN CORREO, o sin acceso a el en ese momento.
--
-- POR QUE TABLA NUEVA Y NO `survey_links`, medido antes de decidir: el indice `survey_links_base_unique`
-- es unico parcial sobre (professional_id) where type='inicial' and patient_id is null. Un token efimero
-- con esa forma CHOCARIA con el QR impreso del consultorio. Y son cosas distintas: uno se pega en la
-- pared y dura para siempre, este muere en quince minutos.
--
-- ═══ LO QUE ESTA MODALIDAD ES, Y LO QUE NO (dictamen legal 2026-09-09) ═══
--
-- Produce una AUTORIZACION VALIDA. **NO produce una firma electronica con presuncion de confiabilidad**,
-- que es lo que si da el OTP del art. 4 del Decreto 2364.
--
-- LA CONSECUENCIA, dicha aqui para que nadie lea esta tabla como equivalente a la modalidad 1: si alguien
-- discute la autorizacion, LA CARGA DE PROBAR RECAE EN NOSOTROS. Y lo que se puede aportar es exactamente
-- lo que esta tabla guarda: que hubo una sesion atada a esa consulta, que el acto ocurrio en un
-- DISPOSITIVO DISTINTO del profesional, que un profesional declaro haber verificado el documento, y
-- cuanto tiempo paso entre abrir y confirmar. Por eso ninguna de esas columnas es opcional de facto.

create table if not exists public.presencial_consent_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  organization_id uuid not null references public.organizations(id),
  -- El profesional DUEÑO del acto (professional_profiles.id): a el se atribuye la evaluacion.
  professional_id uuid not null references public.professional_profiles(id),
  -- La PERSONA que abrio la sesion y que declara (profiles.id). Es el mismo par que en `declared_by` de
  -- patient_consents: la ficha atribuye, la persona declara.
  created_by uuid not null references public.profiles(id),

  -- ═══ EL GATE DEL CORREO ═══
  --
  -- El QR SOLO aparece cuando no hay correo, y la razon es del dictamen: "si queda como alternativa
  -- libre, va a convertirse en la ruta por defecto, porque es mas rapida, y terminarian usando la
  -- modalidad mas debil en el 80% de los casos sin ninguna necesidad".
  --
  -- ESTA COLUMNA NO IMPIDE NADA, Y ESO ESTA DICHO A PROPOSITO: un profesional que quiera el camino rapido
  -- puede dejar el campo de correo vacio. Lo que hace la columna es que dejarlo vacio deje de ser un
  -- descuido y pase a ser una AFIRMACION con un nombre detras (created_by) y una fecha. No lo previene:
  -- lo vuelve atribuible y contable.
  sin_correo_declarado boolean not null default true,
  declaracion_version text not null,

  -- El documento YA verificado por el profesional en su pantalla. Se guarda porque es contra lo que se
  -- compara lo que el paciente escriba en su telefono (dictamen: el acto tiene que ser una manifestacion
  -- suya, no una aceptacion de datos que otro registro). Vive lo que vive la sesion.
  document_type public.document_type not null,
  document_number text not null,

  -- Lo que el PACIENTE escribio en SU dispositivo, tal cual. Nulo hasta que lo escribe.
  declarado_nombres text,
  declarado_apellidos text,
  declarado_document_type public.document_type,
  declarado_document_number text,

  -- ═══ LAS DOS MARCAS DE TIEMPO ═══
  -- Su razon, verbatim: "un consentimiento aceptado cuatro segundos despues de abrirse es dificil de
  -- defender como informado". Por eso son dos y no una: lo que importa es la DISTANCIA entre ellas.
  opened_at timestamptz,
  confirmed_at timestamptz,
  declared_at timestamptz,

  -- ═══ EL DISPOSITIVO DEL PACIENTE ═══
  -- Su razon, verbatim: "sin eso, la afirmacion de que fueron dispositivos distintos es solo una etiqueta
  -- que puso el sistema". Las dos columnas ya existen con esta misma politica en `clinical_audit_log`
  -- (DATA_GOVERNANCE: tecnico/auditoria, acceso solo admin), asi que no se abre una categoria de dato
  -- nueva: se aplica la que ya esta declarada.
  patient_ip inet,
  patient_user_agent text,

  estado text not null default 'emitida',
  expires_at timestamptz not null,
  patient_id uuid references public.patients(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Los estados posibles, cerrados. `abandonada` y `vencida` son desenlaces normales, no fallos.
alter table public.presencial_consent_sessions
  drop constraint if exists presencial_sessions_estado_check;
alter table public.presencial_consent_sessions
  add constraint presencial_sessions_estado_check
  check (estado in ('emitida','abierta','confirmada','declarada','vencida','abandonada','discrepancia'));

-- COHERENCIA DE LOS TIEMPOS: no se puede confirmar sin haber abierto, ni declarar sin haber confirmado.
-- Es lo que hace que la distancia entre marcas signifique algo.
alter table public.presencial_consent_sessions
  drop constraint if exists presencial_sessions_tiempos_coherentes;
alter table public.presencial_consent_sessions
  add constraint presencial_sessions_tiempos_coherentes
  check (
    (confirmed_at is null or opened_at is not null)
    and (declared_at is null or confirmed_at is not null)
    and (confirmed_at is null or confirmed_at >= opened_at)
    and (declared_at is null or declared_at >= confirmed_at)
  );

create index if not exists presencial_sessions_prof_idx
  on public.presencial_consent_sessions (professional_id, created_at desc);

comment on table public.presencial_consent_sessions is
  'Modalidad 2 (QR): sesion de consentimiento presencial, un solo uso y vida corta. Produce autorizacion valida, NO firma electronica con presuncion de confiabilidad: la carga de probar recae en nosotros y se apoya en estas columnas.';

-- ═══ RLS ═══
--
-- "¿esta ficha profesional es la mia?" no tenia helper: el que habia, is_patient_professional, contesta
-- "¿este PACIENTE es mio?", que es otra pregunta. Se escribe UNA vez, por el mismo motivo que en la 0106:
-- tres copias del mismo predicado en tres policies divergen, y lo que divergiria es quien ve que.
create or replace function public.es_mi_ficha_profesional(p_professional_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $fn$
  select exists(
    select 1 from public.professional_profiles pp
    where pp.id = p_professional_id and pp.profile_id = auth.uid()
  )
$fn$;

revoke execute on function public.es_mi_ficha_profesional(uuid) from public;
grant execute on function public.es_mi_ficha_profesional(uuid) to authenticated, service_role;

-- El profesional ve y gobierna SUS sesiones. La superficie publica (el paciente con el token) NO pasa por
-- RLS: entra por service role, como el resto del intake publico, porque no tiene sesion.
alter table public.presencial_consent_sessions enable row level security;

drop policy if exists presencial_sessions_select on public.presencial_consent_sessions;
create policy presencial_sessions_select on public.presencial_consent_sessions
  for select to authenticated
  using (
    public.es_mi_ficha_profesional(professional_id) or public.has_role('admin')
  );

drop policy if exists presencial_sessions_insert on public.presencial_consent_sessions;
create policy presencial_sessions_insert on public.presencial_consent_sessions
  for insert to authenticated
  with check (
    public.es_mi_ficha_profesional(professional_id) or public.has_role('admin')
  );

drop policy if exists presencial_sessions_update on public.presencial_consent_sessions;
create policy presencial_sessions_update on public.presencial_consent_sessions
  for update to authenticated
  using (
    public.es_mi_ficha_profesional(professional_id) or public.has_role('admin')
  );
