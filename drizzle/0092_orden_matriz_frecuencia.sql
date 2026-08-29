-- ORDEN DE LA MATRIZ DE FRECUENCIA: por CATEGORIA CLINICA, no por el numero del campo (2026-08-29).
--
-- QUE CORRIGE. `FREQ_GROUPS` (el frozen, portado byte a byte del archivo de Gildardo) ordena los quince
-- grupos por categoria: 1-7 protector, 8-11 neutro, 12-15 riesgo. Las CARNES ROJAS ocupan la posicion 11
-- (neutro) aunque su campo sea `d1_15_i`: el 15 es el identificador, no el lugar. La ENCUESTA, en cambio,
-- ordenaba por el numero del campo, asi que las carnes rojas salian las ULTIMAS, despues de
-- ultraprocesados, o sea entre los de RIESGO.
--
-- Su regla, textual (respuesta del 2026-08-27, punto 8): "nunca roten por posicion, siempre por `n`", y
-- "la agrupacion que ve el paciente es esa misma: EL ORDEN ES EL MENSAJE". Con el orden viejo le deciamos
-- al paciente que las carnes rojas son alimento de riesgo cuando su modelo las clasifica como neutras.
--
-- POR QUE NO HAY BUMP DE VERSION, y se verifico antes de decidirlo:
--   * NINGUNA pregunta cambia de enunciado, de opciones ni de `field_key`. Se pregunta exactamente lo
--     mismo, con las mismas palabras. Solo cambia la SECUENCIA.
--   * El id de cada pregunta es determinista sobre (tipo, version, CLAVE), nunca sobre la posicion, y las
--     respuestas apuntan a `question_id`. Ninguna respuesta guardada se desalinea.
--   * `order_index` solo se usa para ORDENAR; no es referencia de nada.
--   Un bump obligaria a rehacer las encuestas ya respondidas sin que ninguna cambiara de significado.
--
-- ADITIVA Y FORWARD-ONLY, no el seed: `db:seed` BORRA y re-inserta las respuestas de la version vigente,
-- asi que contra la nube destruiria datos reales. Esto solo mueve el orden.
--
-- EN DOS PASOS, y no por gusto: hay un indice UNICO sobre (survey_version_id, order_index), asi que un
-- solo UPDATE que baraja posiciones choca a medio camino contra una fila que aun no se ha movido. El
-- primer intento fallo exactamente asi. Primero se aparta el bloque entero a un rango libre (+1000) y
-- despues se fija el destino. Es tambien lo que la hace idempotente: fija posiciones absolutas, asi que
-- correrla dos veces deja lo mismo.

-- Paso 1: apartar los quince a un rango que no colisiona con nada.
update public.survey_questions
set order_index = order_index + 1000
where field_key like 'd1\_%\_i' and field_key not like 'd1f%';

-- Paso 2: fijar el orden por CATEGORIA.
update public.survey_questions q
set order_index = v.pos
from (values
  ('d1_1_i',  1), ('d1_2_i',  2), ('d1_3_i',  3), ('d1_4_i',  4), ('d1_5_i',  5),
  ('d1_6_i',  6), ('d1_7_i',  7),                                    -- protector
  ('d1_8_i',  8), ('d1_9_i',  9), ('d1_10_i', 10), ('d1_15_i', 11),  -- neutro (carnes rojas van aqui)
  ('d1_11_i', 12), ('d1_12_i', 13), ('d1_13_i', 14), ('d1_14_i', 15) -- riesgo
) as v(field_key, pos)
where q.field_key = v.field_key;
