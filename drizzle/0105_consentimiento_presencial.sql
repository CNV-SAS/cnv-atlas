-- CONSENTIMIENTO PRESENCIAL · MODALIDAD 1 (con correo). Aditiva, forward-only.
--
-- POR QUE. Hasta hoy el paciente SIN CORREO entraba hasta la mitad y se quedaba ahi: el schema de
-- identidad acepta `email` nulo, pero la firma verifica SIEMPRE el OTP (dictamen art. 4 Decreto 2364) y
-- el OTP solo va a un correo. Sin firma no hay evaluacion. Medido antes de tocar nada.
--
-- El dictamen legal (2026-09-08) desbloquea el consentimiento PRESENCIAL en tres modalidades. Esta
-- migracion prepara las tres y esta tanda construye la 1; las otras dos NO se construyen todavia, y el
-- orden es POR FUERZA PROBATORIA, no por esfuerzo: la 1 es firma electronica con OTP, que es la que el
-- dictamen respalda. Tenerlas las tres a la vez invita a elegir la comoda.
--
-- ═══ 1. LA MODALIDAD, SELLADA EN LA AUTORIZACION ═══
--
-- No es un metadato: dos autorizaciones obtenidas por caminos distintos tienen FUERZA PROBATORIA
-- distinta, y el dia que alguien discuta una hay que poder decir cual fue.
--
-- Los valores se cierran con un CHECK, no con un enum de Postgres: un enum exige una migracion para
-- añadir un valor y aqui los cuatro estan cerrados por el dictamen. `remoto_otp` es lo que ya existia.
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS signature_channel text;

ALTER TABLE patient_consents DROP CONSTRAINT IF EXISTS patient_consents_signature_channel_check;
ALTER TABLE patient_consents ADD CONSTRAINT patient_consents_signature_channel_check
  CHECK (signature_channel IS NULL OR signature_channel IN (
    'remoto_otp',        -- el paciente firma desde su casa, con el enlace. Lo que existia.
    'presencial_otp',    -- modalidad 1: en consulta, el paciente marca y digita el codigo
    'presencial_qr',     -- modalidad 2: QR, el paciente consiente en SU dispositivo
    'presencial_papel'   -- modalidad 3: impreso, firmado a mano, foto subida
  ));

COMMENT ON COLUMN patient_consents.signature_channel IS
  'Como se obtuvo esta autorizacion. NULL en las anteriores a 2026-09-08 (todas remotas por construccion: era el unico camino). Tiene fuerza probatoria distinta segun el valor.';

-- ═══ 2. LA DECLARACION DEL PROFESIONAL ═══
--
-- En las tres modalidades presenciales el profesional declara que presento el consentimiento, que el
-- paciente tuvo oportunidad de leerlo, que fue EL quien marco las autorizaciones, y que verifico su
-- identidad contra el documento.
--
-- SE VERSIONA COMO EL CONSENTIMIENTO, y no es formalismo: es una afirmacion suya con consecuencias. Si
-- mañana cambia su redaccion, lo declarado antes tiene que seguir diciendo lo que decia. Guardar solo un
-- booleano dejaria constancia de que "declaro algo" sin poder citar QUE.
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS declared_by uuid REFERENCES profiles(id);
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS declaration_version text;

COMMENT ON COLUMN patient_consents.declared_by IS
  'Profesional que declaro haber presentado el consentimiento en persona. NULL en las remotas: alli no hay declaracion de nadie, firma el paciente solo.';
COMMENT ON COLUMN patient_consents.declaration_version IS
  'Version del texto de la declaracion del profesional, para poder citarlo tal como lo leyo. Va junto a declared_by.';

-- COHERENCIA: la declaracion es de las presenciales, y las presenciales la exigen. Un canal presencial
-- sin declaracion, o una declaracion sin canal, es una fila que no significa nada.
ALTER TABLE patient_consents DROP CONSTRAINT IF EXISTS patient_consents_declaracion_coherente;
ALTER TABLE patient_consents ADD CONSTRAINT patient_consents_declaracion_coherente
  CHECK (
    (signature_channel IS NULL OR signature_channel = 'remoto_otp')
      AND declared_by IS NULL AND declaration_version IS NULL
    OR
    signature_channel IN ('presencial_otp', 'presencial_qr', 'presencial_papel')
      AND declared_by IS NOT NULL AND declaration_version IS NOT NULL
  );

-- LO QUE ESTA MIGRACION NO TRAE, dicho para que no se lea como olvido: la columna del PATH de la imagen
-- del consentimiento en papel. Va con la modalidad 3, junto a su bucket y su RLS, porque sin el
-- almacenamiento una ruta a un archivo que no existe es peor que no tenerla.
--
-- Y LA CASILLA NO SUSTITUYE AL GATE. Nada de esto crea autorizaciones: el gate de la regla dura 15 sigue
-- leyendo `patient_consents` dentro de la transaccion (`canCreateEvaluation`), y la encuesta sigue sin
-- poder escribirse antes de que exista la evaluacion. Estas columnas dicen COMO se obtuvo el permiso, no
-- lo otorgan.
