-- Conflictos del menu con el PATRON ALIMENTARIO (d4_34).
--
-- POR QUE UNA COLUMNA APARTE Y NO DENTRO DE alergenos_detectados. Es el mismo mecanismo de deteccion
-- (alimentos de la salida contra una lista) pero NO es el mismo hecho, y mezclarlos habria sido la misma
-- sobrecarga que evitamos con `status`:
--
--   alergenos_detectados .. SEGURIDAD. Lista CERRADA de cosas concretas. Un menu con el alergeno no se
--                           entrega: puede mandar a alguien a urgencias.
--   patron_conflictos ..... ADHERENCIA. El patron excluye CATEGORIAS ABIERTAS (un vegano no excluye
--                           "pollo", excluye todo lo animal, y esa lista no se termina nunca). El cruce
--                           encuentra lo evidente y NO puede prometer completitud. Un menu que se salta
--                           el patron es un plan que el paciente no va a seguir (Gildardo, 3.2), no uno
--                           que lo lastima.
--
-- Consultarlos por separado es lo que permite tratarlos distinto en pantalla: uno bloquea con descarte
-- auditado, el otro avisa.
--
-- Misma semantica de tres estados que su hermana: [] = se cruzo y no habia nada; NULL = NO se pudo
-- cruzar (sugerencia de la v2, o parseo fallido). No son lo mismo.

alter table ai_menu_suggestions
  add column if not exists patron_conflictos jsonb;

comment on column ai_menu_suggestions.patron_conflictos is
  'Choques evidentes del menu con el patron alimentario declarado: [{patron,tiempo,alimento}]. [] = cruzado y sin choques. NULL = no se pudo cruzar. Es un aviso de ADHERENCIA, no de seguridad, y no promete completitud: el patron excluye categorias abiertas.';
