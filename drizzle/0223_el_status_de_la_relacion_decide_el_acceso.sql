-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL `status` DE LA RELACION DECIDE EL ACCESO, QUE ES LO QUE NO HACIA  ·  0223
--
-- ═══ EL FILO (verificado el 2026-10-24) ═══
--
-- `is_patient_of` (0106) es la UNICA definicion de "este paciente es de este profesional", y gobierna las
-- policies de `patients`, `patient_profiles`, `patient_consents`, `evaluations` y las demas. Su cuerpo
-- preguntaba solo por la existencia de la fila:
--
--   select exists(select 1 from patient_professional_relationships ppr
--                 where ppr.patient_id = ... and ppr.professional_id = ...)
--
-- O SEA QUE PONER LA RELACION EN UN ESTADO HISTORICO NO QUITABA EL ACCESO. El profesional seguiria viendo
-- la historia clinica completa de un paciente que ya no atiende. Y la fila no se puede borrar: que ese
-- profesional atendio a ese paciente es un hecho clinico que tiene que seguir en la base, no solo en
-- auditoria (Santiago, 2026-10-24: *"no borrar la relacion"*).
--
-- ═══ Y EL REPOSITORIO YA TENIA LAS DOS LECTURAS, YA DIVERGIDAS ═══
--
-- El trigger `relaciones_recomputan_marca` (0202), que decide si un paciente cuenta como de prueba, SI
-- filtra `status = 'active'`. La funcion que decide QUIEN PUEDE VER LA HISTORIA CLINICA, no. La condicion
-- estaba escrita en el sitio menos grave y faltaba en el mas grave.
--
-- ═══ POR QUE ES BARATO HOY, Y POR QUE HOY ES EL DIA ═══
--
-- Medido en produccion antes de escribir esto: **551 relaciones, las 551 en `active`, cero en cualquier
-- otro estado, y cero pacientes con mas de un profesional**. Asi que esta condicion no excluye NI UNA fila
-- existente: no hay acceso que se pueda romper. Empieza a tener efecto el dia que se escriba el primer
-- estado distinto de `active`, que es justamente el dia de la reasignacion. Por eso va PRIMERO la
-- condicion y DESPUES el movimiento: al revés habria un rato en que el profesional anterior conserva el
-- acceso y nadie lo nota.
--
-- ═══ LOS DOS SITIOS, EN LA MISMA PASADA ═══
--
-- 1 · `is_patient_of`: el acceso. Es el que importa hoy.
-- 2 · `patient_professional_anexo3_current` (0018): contesta si el paciente tiene algun profesional con el
--     Anexo 3 vigente, y leia la relacion igual de crudo. HOY ESTA INERTE (verificado: nadie ha firmado el
--     Anexo 3, asi que devuelve false para todos), pero el dia que empiecen las firmas aparece la misma
--     divergencia: un paciente pasaria ese gate por la firma de un profesional que ya no lo atiende.
--     Ponerselo despues seria dejar escrito un segundo sitio que ya sabemos que esta mal.
--
-- Las tres policies de `ppr` (0003) resuelven por `auth.uid()` contra `professional_profiles`, no por el
-- estado de la relacion: no cambian.
--
-- ═══ Y EL `status` DEJA DE SER TEXTO LIBRE ═══
--
-- Era `text not null default 'active'` sin ninguna restriccion, y de el depende el acceso a una historia
-- clinica. Un `'Active'` con mayuscula, o un `'activa'` en espanol, dejaria al paciente invisible para su
-- propio profesional SIN UN SOLO ERROR. El CHECK atrapa lo IMPOSIBLE (un valor que ningun camino del
-- codigo escribe), no lo improbable: los dos unicos estados que existen son el de siempre y el que
-- introduce la reasignacion.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1 · EL VOCABULARIO DEL ESTADO ───────────────────────────────────────────────────────────────
-- Las 551 filas de hoy estan en 'active', asi que el CHECK se valida sin tocar ninguna.
alter table public.patient_professional_relationships
  add constraint ppr_status_vocabulario
  check (status in ('active', 'reasignada'));--> statement-breakpoint

comment on column public.patient_professional_relationships.status is
  'active = este profesional atiende a este paciente hoy (y por tanto ve su historia: is_patient_of lo exige desde la 0223). reasignada = lo atendio y el paciente paso a otro; la fila NO se borra porque el hecho clinico tiene que seguir en la base.';--> statement-breakpoint

-- ── 2 · EL ACCESO MIRA EL ESTADO ────────────────────────────────────────────────────────────────
-- MISMA FIRMA, MISMO `security definer`, mismo `search_path` vacio. Lo unico que cambia es la condicion
-- nueva, que hoy no excluye ninguna fila.
create or replace function public.is_patient_of(p_patient_id uuid, p_professional_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.patient_professional_relationships ppr
    where ppr.patient_id = p_patient_id
      and ppr.professional_id = p_professional_id
      and ppr.status = 'active'
  )
$$;--> statement-breakpoint

comment on function public.is_patient_of(uuid, uuid) is
  'Unica definicion de "este paciente es de este profesional HOY". p_professional_id es un professional_profiles.id. Exige status = active (0223): una relacion reasignada queda en la base como historia y NO da acceso. La usan is_patient_professional (con el profesional de la sesion) y el intake publico (con el profesional del enlace).';--> statement-breakpoint

-- ── 3 · Y EL GATE DEL ANEXO 3, por lo mismo ─────────────────────────────────────────────────────
create or replace function public.patient_professional_anexo3_current(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.patient_professional_relationships ppr
    join public.professional_document_signatures pds on pds.professional_id = ppr.professional_id
    where ppr.patient_id = p_patient_id
      and ppr.status = 'active'
      and pds.document_type = 'anexo3'
      and pds.signed_version = '1.0'
  )
$$;--> statement-breakpoint

comment on function public.patient_professional_anexo3_current(uuid) is
  'Si el paciente tiene HOY algun profesional con el Anexo 3 v1.0 firmado. Exige status = active en la relacion (0223), por la misma razon que is_patient_of: la firma de quien ya no lo atiende no vale para el.';
