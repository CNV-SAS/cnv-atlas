-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL FLETE SALE DE CNV (decision contable, 2026-10-05)
--
-- Textual de contabilidad: "el flete queda completamente fuera de CNV. El paciente le paga el envio
-- directamente al servicio de mensajeria, nunca a CNV ni al Integrante. Atlas no cobra flete, no lo
-- factura y no registra ningun gasto de domicilio."
--
-- LA REGLA INNEGOCIABLE, tambien textual: "el dinero del flete nunca entra a cuentas de CNV ni de un
-- Integrante. Sin excepciones, ni por hacerle el favor a un paciente. Si entra una vez, aparece un ingreso
-- sin factura y un gasto sin soporte, y se rompe la consistencia de todo el modelo."
--
-- ── QUE HACE ESTA MIGRACION, Y QUE NO HACE ─────────────────────────────────────────────────────────
--
-- HACE una cosa: agrega el telefono con el que se coordina el envio. Lo pide la decision ("capturar numero
-- de celular si no lo tiene registrado el paciente previamente en la encuesta").
--
-- VA EN LA VENTA Y NO EN `patients.phone`, a proposito. Dos razones:
--   · Escribirlo en el paciente desde una pantalla de cobro PISA el dato de la encuesta, que es la fuente
--     de identidad. Un envio no es el sitio desde donde se corrige la ficha de una persona.
--   · Y el numero con el que se coordino ESTE envio es un hecho de ese envio: si el paciente cambia de
--     celular el mes que viene, el registro de la entrega no deberia cambiar con el.
--
-- NO HACE lo que parecia obvio: NO BORRA `shipping_fee` NI `shipping_cost`. Las migraciones son
-- forward-only y esas dos columnas guardan lo que SI se cobro en las ventas anteriores a hoy. Una de esas
-- ventas todavia puede retractarse, y en ella CNV si recibio el flete y si lo debe devolver. Borrarlas
-- haria que esa devolucion saliera de menos, y el dato no se podria reconstruir.
--
-- LO QUE SE HACE EN SU LUGAR es dejarlas rotuladas como historicas, para que nadie las vuelva a escribir
-- creyendo que siguen vivas. Quien escriba un flete nuevo tiene que leer este comentario primero.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

alter table transactions add column if not exists shipping_phone text;

comment on column transactions.shipping_phone is
  'Celular con el que se coordina ESTE envio a domicilio. No pisa patients.phone: el numero de la ficha del paciente lo fija la encuesta. Desde 2026-10-05.';

comment on column transactions.shipping_fee is
  'HISTORICO, no se escribe mas (2026-10-05): lo que el paciente le pago a CNV por el envio, cuando CNV cobraba el flete. Desde el 2026-10-05 el flete queda fuera de CNV y esta columna queda null en toda venta nueva. Se conserva porque un retracto de una venta anterior si tiene que devolver ese flete.';

comment on column transactions.shipping_cost is
  'HISTORICO, no se escribe mas (2026-10-05): lo que CNV le pagaba al domiciliario. Ver shipping_fee.';

-- LA CONFIGURACION DEL FLETE, igual: se deja rotulada en vez de borrada. `flete_margen` tiene NOT NULL con
-- default, asi que tampoco se puede soltar sin tocar la tabla; y no hace falta, porque nada la lee ya.
comment on column commercial_config.flete_tarifa is
  'HISTORICO, no se lee mas (2026-10-05): costo sugerido del domiciliario que precargaba el formulario. El flete salio de CNV.';

comment on column commercial_config.flete_margen is
  'HISTORICO, no se lee mas (2026-10-05): margen sobre el costo del domiciliario, que compensaba la comision que la pasarela cobraba tambien sobre el flete. Sin flete no hay nada que compensar.';

-- `delivery_cities` NO queda historica: cambia de OFICIO. Era la lista de destinos habilitados (un porton:
-- solo se podia enviar ahi) y pasa a ser un DIRECTORIO que traduce una ciudad a su codigo DANE para el
-- analisis de ICA. El porton existia para no perder dinero en un envio a una zona sin tarifa; sin flete,
-- ningun destino le cuesta dinero a CNV, y una lista incompleta solo le negaria el envio a un paciente.
comment on table delivery_cities is
  'DIRECTORIO de ciudades con su codigo DANE, para sellar el municipio de destino de un envio (analisis de ICA). NO es una lista de destinos permitidos desde el 2026-10-05: una ciudad que no este aqui se puede enviar igual, y su dane_code queda null.';

comment on column delivery_cities.costo_sugerido is
  'HISTORICO, no se lee mas (2026-10-05): lo que solia cobrar el domiciliario en esa ciudad. El flete salio de CNV.';
