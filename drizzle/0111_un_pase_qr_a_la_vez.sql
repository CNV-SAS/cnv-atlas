-- UN PASE DE QR A LA VEZ POR PROFESIONAL. Forward-only.
--
-- ═══ EL ESTADO DE HOY ES EL PEOR DE LOS TRES ═══
--
-- La tabla admite VARIOS y la pantalla enseña UNO (el mas reciente). Asi que emitir un segundo pase
-- mientras el primero sigue en curso vuelve INVISIBLE al primero: sigue vivo, el paciente puede
-- confirmarlo, y nadie lo ve. Un consentimiento confirmado que no aparece en ninguna pantalla es peor que
-- no haber podido emitirlo.
--
-- ═══ POR QUE UNO Y NO UNA LISTA ═══
--
-- Listar varios resolveria el caso raro (dos pacientes leyendo a la vez en la misma consulta) a cambio de
-- abrir una clase de error nueva y peor: **declarar sobre el pase equivocado crea un paciente con la
-- identidad de otro**. Y la declaracion existe precisamente para impedir eso. Cambiar una molestia rara
-- por un error grave no es buen trato.
--
-- EL COSTO, dicho: si de verdad llega otro paciente, hay que esperar o anular el pase en curso. Anular
-- siempre es posible (mientras no se haya declarado), asi que no hay forma de quedarse bloqueado.
--
-- LOS ESTADOS QUE OCUPAN son los que todavia tienen algo pendiente. `discrepancia` cuenta: hay que
-- resolverla con el paciente. `abandonada`, `vencida` y `declarada` no ocupan.
-- ═══ PRIMERO SE LIMPIA LO QUE YA ESTÁ, Y ESTE ORDEN NO ES OPCIONAL ═══
--
-- Un indice unico NO SE PUEDE CREAR si los datos ya lo violan, y en la nube ya lo violaban: dos sesiones
-- `confirmada` del mismo profesional, de los smokes de estos dias (con varios pases permitidos, que es
-- justo lo que este indice viene a cerrar). La primera version de esta migracion no limpiaba, y fallo con
-- un `exit 1` mudo.
--
-- Y LA LECCION QUE DEJA, escrita aqui porque es donde se va a releer: la migracion se verifico contra una
-- base cuyos DATOS no ejercitaban la restriccion. Una restriccion nueva hay que probarla contra datos que
-- la violen, no solo contra un esquema vacio.
--
-- SE CONSERVA LA MAS RECIENTE de cada profesional y se anulan las anteriores. Se elige la mas reciente
-- porque es la que el profesional tenia delante: la pantalla siempre mostro esa, asi que las viejas ya
-- eran invisibles para el. Anularlas no le quita nada que estuviera usando.
--
-- `abandonada` y no `vencida`: es una decision, no un vencimiento. Y el conteo queda en el log del propio
-- UPDATE (`UPDATE n`), para que se vea cuantas se anularon.
with en_curso as (
  select
    id,
    row_number() over (partition by professional_id order by created_at desc) as puesto
  from public.presencial_consent_sessions
  where estado in ('emitida', 'abierta', 'confirmada', 'discrepancia')
)
update public.presencial_consent_sessions s
   set estado = 'abandonada'
  from en_curso c
 where s.id = c.id
   and c.puesto > 1;

create unique index if not exists presencial_sessions_una_activa
  on public.presencial_consent_sessions (professional_id)
  where estado in ('emitida', 'abierta', 'confirmada', 'discrepancia');

comment on index public.presencial_sessions_una_activa is
  'Un pase de QR a la vez por profesional. Sin esto, un segundo pase volvia INVISIBLE al primero (la pantalla enseña el mas reciente) y un consentimiento confirmado podia quedar sin aparecer en ninguna parte.';

-- ═══ Y LAS VENCIDAS DEJAN DE OCUPAR ═══
--
-- Una sesion que nadie confirmo se queda en 'emitida' o 'abierta' para siempre: sin esto, la primera que
-- venciera bloquearia al profesional de forma PERMANENTE, que es un defecto peor que el que el indice
-- cierra. El paso a 'vencida' no puede vivir en el indice (una condicion con now() no es inmutable), asi
-- que lo hace el propio codigo al emitir. Este UPDATE deja al dia lo que ya estaba vencido.
update public.presencial_consent_sessions
   set estado = 'vencida'
 where estado in ('emitida', 'abierta')
   and coalesce(lectura_hasta, expires_at) < now();
