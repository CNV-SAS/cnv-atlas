-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LAS CIUDADES CON COBERTURA Y EL MARGEN DEL FLETE  ·  para pegar en el editor de Supabase
--
-- Datos de Santiago (2026-09-29): Medellin (05001, costo 14.000), Pereira (66001) y Cali (76001).
-- Margen 3%.
--
-- POR QUE PEREIRA Y CALI VAN SIN COSTO: Santiago no los dio, y no se inventan. El formulario deja el campo
-- vacio y el profesional teclea lo que le cobraron, que es justo la decision que se tomo ("14.000 es fijo en
-- Medellin pero varia en Pereira o Cali"). Cuando se sepan, se completan con el UPDATE de abajo.
--
-- SE PUEDE CORRER DOS VECES sin duplicar: el indice unico es por (ciudad, departamento) en minusculas.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

insert into delivery_cities (city, department, dane_code, costo_sugerido)
values
  ('Medellín',  'Antioquia',  '05001', 14000),
  ('Pereira',   'Risaralda',  '66001', null),
  ('Cali',      'Valle del Cauca', '76001', null)
on conflict do nothing;

-- El margen del 3%: compensa la comision que la pasarela cobra tambien sobre el flete. Es el valor por
-- defecto de la columna, asi que esto solo hace falta si alguien lo cambio.
update commercial_config set flete_margen = 0.03;

-- Y el costo sugerido por DEFECTO se deja nulo: el de Medellin ya vive en su ciudad, y poner uno global
-- precargaria 14.000 en Pereira y Cali, que es lo contrario de lo que se decidio.
update commercial_config set flete_tarifa = null;

commit;

-- Para comprobar que quedo:
--   select city, department, dane_code, costo_sugerido from delivery_cities order by city;
--   select flete_margen, flete_tarifa from commercial_config;

-- Cuando se sepa el costo de Pereira o Cali:
--   update delivery_cities set costo_sugerido = 18000 where lower(city) = 'pereira';
