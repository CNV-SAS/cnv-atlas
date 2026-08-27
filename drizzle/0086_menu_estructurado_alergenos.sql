-- Menu estructurado y cruce de alergenos (prompt menu.v3).
--
-- POR QUE. El menu se generaba como prosa libre, y sobre prosa el unico chequeo de alergenos posible es
-- buscar subcadenas: se le escapa "camarones" cuando la alergia dice "mariscos" y se dispara con "leche
-- de almendras" cuando la alergia es a la leche. Con el menu como lista de alimentos el cruce es exacto.
-- Gildardo lo aprobo en su 3.2 del 2026-08-26: las alergias entran como RESTRICCION del plan.
--
-- DOS COLUMNAS, no una:
--   menu_json ............. el menu ya parseado a la forma del contrato v3. Es lo que se cruza y lo que
--                           se renderiza. Null en las filas de la v2 (prosa) y en los intentos fallidos.
--   alergenos_detectados .. los hallazgos del cruce: [{alergeno, tiempo, alimento}]. Array VACIO cuando
--                           se cruzo y no habia nada; NULL cuando no se pudo cruzar (menu v2, o parseo
--                           fallido). La distincion importa: "revisado y limpio" no es lo mismo que "no
--                           revisado", y aguas abajo se leen distinto (leccion ausencia vs vacio).
--
-- NO SE TOCA EL ENUM `status`. Podria haberse agregado un valor "alergeno_detectado", pero `status`
-- describe como fue la GENERACION (exito, timeout, error del proveedor, respuesta invalida), no la
-- revision de seguridad, que es un hecho aparte: un menu puede generarse perfectamente y contener un
-- alergeno. Sobrecargar el campo habria mezclado dos cosas que se consultan por separado. Ademas evita
-- el ALTER TYPE ... ADD VALUE, que no corre dentro de una transaccion.
--
-- COMPATIBILIDAD CON LAS FILAS VIEJAS. Las sugerencias ya guardadas son prosa de la v2 y se quedan como
-- estan: menu_json y alergenos_detectados en NULL, y siguen renderizandose desde generated_text. El
-- lector tiene que tolerar LAS DOS FORMAS, y el que escribe tambien. (Familia del cambio de shape del
-- jsonb del plan alimentario, donde el writer relelia la forma vieja cruda y reventaba.)

alter table ai_menu_suggestions
  add column if not exists menu_json jsonb,
  add column if not exists alergenos_detectados jsonb;

comment on column ai_menu_suggestions.menu_json is
  'Menu parseado a la forma del contrato menu.v3 ({comidas:[{tiempo,alimentos:[{nombre,porcion}]}]}). NULL en las filas de la v2 (prosa libre) y en los intentos fallidos.';

comment on column ai_menu_suggestions.alergenos_detectados is
  'Hallazgos del cruce contra las alergias declaradas: [{alergeno,tiempo,alimento}]. Array vacio = se cruzo y no habia nada. NULL = NO se pudo cruzar (menu v2 o parseo fallido). No son lo mismo.';
