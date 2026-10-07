-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CUANDO TOCA EL CONTEO FISICO (Santiago, 2026-10-06)
--
-- EL PROBLEMA, en sus palabras: la seccion de conteo de /mi-inventario esta SIEMPRE activa, "y la gente se
-- puede confundir y piensa que se tiene que contar apenas reciban".
--
-- Y EL ARREGLO NO ES UN INTERRUPTOR: es que una seccion siempre abierta NO DICE CUANDO TOCA. Lo que hace
-- falta es una ventana con fecha propia, que conteste la pregunta que la gente se esta haciendo.
--
-- ── DOS COSAS, NO UNA (decision de Santiago, y la razon importa) ──────────────────────────────────
--
--   1. UNA VENTANA POR PERIODO, mensual por defecto, configurable desde el panel. Textual suyo: "si cambia
--      la decision del negocio, se cambia desde el panel y no desde el codigo".
--   2. Y UN INTERRUPTOR para que admin lo abra YA, para el caso que el calendario no cubre: hay sospecha de
--      una diferencia y hay que contar sin esperar al 1. Es tambien la salida de quien se paso la ventana.
--
-- SOLO EL INTERRUPTOR NO BASTA: dejaria a los Integrantes esperando que alguien les abra la puerta, y el dia
-- que nadie la abra no hay conteo y nadie lo nota. La obligacion tiene que tener fecha propia.
--
-- ── LA CADENCIA ES NUESTRA, NO DEL MODELO ─────────────────────────────────────────────────────────
--
-- Verificado el 2026-10-05: el modelo comercial solo dice que el conteo "se mantiene en ambas modalidades".
-- El "SEMANAL" que estaba escrito en BACKLOG.md y en un comentario de `count-writer.ts` salia de nuestra
-- propia planeacion de T3b-3, no de un contrato. Asi que mensual es una decision que solo obliga a
-- actualizar nuestro doc, y queda actualizado en el mismo commit.
--
-- Y LOS VALORES NO VAN EN EL CODIGO, por el principio 2 del modelo ("nada de valores fijos en el codigo"):
-- van en `commercial_config`, que es donde ya viven los dias de alerta de vencimiento.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── LA VENTANA, EN CONFIGURACION ──────────────────────────────────────────────────────────────────
--
-- `dia_de_apertura` se recorta al ultimo dia del mes cuando no existe (con 31, febrero abre el 28): eso lo
-- hace el modulo puro, no un CHECK, porque es aritmetica de calendario y no una restriccion del dato.
--
-- EL CHECK SI IMPIDE LO IMPOSIBLE: un dia fuera de 1..31 y una ventana de cero dias. Una ventana de cero dias
-- cerraria el conteo para siempre sin que nada lo dijera, que es el peor valor que esta tabla puede tener.
alter table commercial_config
  add column if not exists conteo_dia_de_apertura integer not null default 1;
alter table commercial_config
  add column if not exists conteo_dias_de_ventana integer not null default 5;

alter table commercial_config drop constraint if exists commercial_config_conteo_valido;
alter table commercial_config add constraint commercial_config_conteo_valido check (
  conteo_dia_de_apertura between 1 and 31 and conteo_dias_de_ventana between 1 and 28
);

comment on column commercial_config.conteo_dia_de_apertura is
  'Dia del mes en que se abre la ventana del conteo fisico. Se recorta al ultimo dia del mes cuando no existe.';
comment on column commercial_config.conteo_dias_de_ventana is
  'Cuantos dias dura la ventana del conteo, contando el dia de apertura. Puede pasar al mes siguiente.';

-- ── EL INTERRUPTOR: UNA APERTURA CONCEDIDA A UN INTEGRANTE ────────────────────────────────────────
--
-- ES UNA TABLA Y NO UNA COLUMNA, y la razon es que hay que poder responder "quien le abrio el conteo, cuando
-- y por que". Con una columna `conteo_abierto_hasta` en el perfil, cada apertura borraria la anterior y no
-- quedaria rastro de ninguna. Abrirle un conteo a alguien es pedirle trabajo y puede terminar en un caso de
-- faltante con consecuencia economica: tiene que poder auditarse.
create table if not exists nutraceutical_count_openings (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles(id) on delete cascade,
  -- HASTA CUANDO VALE. Una apertura sin fecha de fin dejaria el conteo abierto para siempre, que es
  -- exactamente el estado del que venimos.
  valid_until date not null,
  -- POR QUE. Obligatorio: si a alguien le abren el conteo fuera del calendario, tiene derecho a saber por que,
  -- y esa frase se le muestra. Un motivo vacio convierte la peticion en una orden sin explicacion.
  motivo text not null,
  opened_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint nutraceutical_count_openings_motivo_no_vacio check (length(btrim(motivo)) >= 5)
);

create index if not exists nutra_count_openings_prof_idx
  on nutraceutical_count_openings (professional_id, valid_until desc);

comment on table nutraceutical_count_openings is
  'Aperturas del conteo fisico concedidas por admin fuera de la ventana del calendario. Una fila por peticion, con su motivo y quien la concedio: abrirle un conteo a alguien puede terminar en un cargo por faltante.';

-- ── LO QUE NO SE HACE AQUI, dicho para que no parezca un olvido ───────────────────────────────────
--
-- NO SE BLOQUEA EL CONTEO CON UN TRIGGER. La ventana se verifica en el escritor (`recordCount`), que es donde
-- esta la regla y donde puede explicar al Integrante CUANDO le toca. Un trigger solo podria rechazar, y el
-- mensaje que de verdad hace falta ("se abre el 1 y tienes hasta el 5") no cabe en un error de base.
--
-- Y la ventana NO se guarda en la sesion de conteo: se DERIVA de su fecha. Guardarla crearia una segunda
-- fuente capaz de contradecir al calendario vigente.
