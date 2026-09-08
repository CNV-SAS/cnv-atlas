-- LA SESION DEL QR: DOS VENTANAS, NO UNA. Y lo que el paciente autorizo. Forward-only.
--
-- ═══ POR QUE DOS VENTANAS ═══
--
-- Los quince minutos iniciales estaban acotando la cosa equivocada. Lo que hay que acotar corto es el
-- tiempo que un QR vive en una pantalla SIN QUE NADIE LO ESCANEE: ahi es donde un token visible es un
-- riesgo. Una vez el paciente lo abrio en su telefono, el riesgo cambia de naturaleza y lo que queremos es
-- justo lo contrario: que lea despacio.
--
-- Quince minutos para leer un consentimiento entero es POCO, y castigar al que lee despacio es castigar
-- exactamente la conducta que hace informado al consentimiento. Peor: el que lee rapido pasa y el que lee
-- con calma pierde el trabajo, que es el incentivo al reves.
--
-- Asi que la ventana se PARTE:
--   · 15 minutos para ESCANEAR (el QR en pantalla, sin abrir);
--   · y al abrirlo, la sesion se extiende para LEER Y CONFIRMAR.
-- La extension es de la fila, no del token: el token sigue siendo de un solo uso y sigue muriendo con la
-- sesion. Y nunca ACORTA (se usa greatest), para que reabrir no pueda recortar la ventana de nadie.
alter table public.presencial_consent_sessions
  add column if not exists lectura_hasta timestamptz;

comment on column public.presencial_consent_sessions.lectura_hasta is
  'Hasta cuando puede CONFIRMAR el paciente que ya abrio la sesion. Mas larga que expires_at a proposito: expires_at acota el QR sin escanear, esta acota la lectura. Nula hasta que se abre.';

-- ═══ LO QUE EL PACIENTE AUTORIZO, GUARDADO EN LA SESION ═══
--
-- POR QUE HACE FALTA: la declaracion del profesional va DESPUES de que el paciente confirme (afirma lo
-- que ya ocurrio, no lo que va a ocurrir), y el CHECK de la 0105 exige que canal presencial y declaracion
-- vayan juntos. Asi que la autorizacion no se puede escribir en `patient_consents` hasta que el
-- profesional declare, y lo que el paciente marco tiene que esperar en algun sitio.
--
-- ESPERA AQUI, en una fila efimera y bajo la RLS del profesional, y no en `patient_consents`, porque una
-- fila en `patient_consents` es una autorizacion OTORGADA: escribirla antes de que el acto este completo
-- seria afirmar algo que todavia no se puede sostener.
alter table public.presencial_consent_sessions
  add column if not exists declarado_autorizaciones jsonb;

comment on column public.presencial_consent_sessions.declarado_autorizaciones is
  'Lo que el paciente marco en SU dispositivo, esperando a que el profesional declare. No es una autorizacion otorgada: eso solo existe en patient_consents.';

-- Y la coherencia: si confirmo, tuvo que marcar algo. Una confirmacion sin autorizaciones seria una fila
-- que dice que el paciente acepto sin decir que acepto.
alter table public.presencial_consent_sessions
  drop constraint if exists presencial_sessions_confirmacion_con_autorizaciones;
alter table public.presencial_consent_sessions
  add constraint presencial_sessions_confirmacion_con_autorizaciones
  check (confirmed_at is null or declarado_autorizaciones is not null);
