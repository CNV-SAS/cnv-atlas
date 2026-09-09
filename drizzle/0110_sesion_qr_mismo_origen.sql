-- LA MARCA DE MISMO ORIGEN. Forward-only.
--
-- QUE MARCA: que la IP desde la que el PACIENTE abrio la sesion es la misma desde la que el PROFESIONAL
-- la emitio. El dictamen apoya la modalidad 2 en que el acto ocurrio en un DISPOSITIVO DISTINTO, y sin
-- nada que lo contraste esa afirmacion es "solo una etiqueta que puso el sistema".
--
-- ═══ NO BLOQUEA, Y LA RAZON ES QUE BLOQUEAR SERIA PEOR ═══
--
-- Una clinica con wifi hace coincidir las dos IP SIEMPRE, y ese es el caso mas normal, no el sospechoso.
-- Bloquear ahi convertiria el uso legitimo en un fallo y empujaria a la gente a buscarle la vuelta. Y al
-- reves: dos dispositivos en la misma red siguen siendo dos dispositivos.
--
-- ASI QUE ES UNA SEÑAL PARA REVISAR, no un veredicto. Lo que de verdad delata no es una coincidencia
-- suelta, es un profesional cuyas sesiones coinciden SIEMPRE y ademas con el mismo agente de usuario: eso
-- ya no es la wifi de la sala, es la misma maquina. Esa lectura es agregada y la hace una persona.
--
-- POR ESO NO SE ENSEÑA EN LA PANTALLA DEL PROFESIONAL. Enseñarsela no le sirve para nada (no puede
-- cambiar la red del paciente) y lo unico que lograria es enseñarle que se mide, que es justo lo que le
-- permitiria evitarlo. Vive en el registro de la sesion y en la lectura de admin.
alter table public.presencial_consent_sessions
  add column if not exists professional_ip inet;

alter table public.presencial_consent_sessions
  add column if not exists mismo_origen boolean;

comment on column public.presencial_consent_sessions.professional_ip is
  'IP desde la que el profesional EMITIO el pase. Se guarda para poder contrastarla con la del paciente; misma politica que la del paciente (tecnico/auditoria, admin).';
comment on column public.presencial_consent_sessions.mismo_origen is
  'La IP del paciente coincidio con la del profesional. SEÑAL PARA REVISAR, no bloqueo: una clinica con wifi las hace coincidir siempre. Nula si falta alguna de las dos.';

create index if not exists presencial_sessions_mismo_origen_idx
  on public.presencial_consent_sessions (professional_id, mismo_origen)
  where mismo_origen is true;
