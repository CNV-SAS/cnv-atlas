-- ═══ LA PREGUNTA 32 SE ENTIENDE MAL, Y SE ARREGLA LA REDACCION (Santiago, 2026-09-19) ═══
--
-- EL SINTOMA QUE LO PIDE, textual suyo: *"¿Cuántas comidas hace al día? Ya que la gente se confunde y
-- piensa que cuántas comidas prepara en el día (por la palabra hace). Cuando en realidad la encuesta se
-- refiere a cuántas comidas se come."*
--
-- Y TIENE RAZON EN EL FONDO: una pregunta que la mitad de la gente responde a otra cosa no mide lo que
-- dice medir. El dato entra al motor (d4_32, conductas alimentarias), asi que una lectura equivocada no es
-- un detalle de forma.
--
-- ── POR QUE ESTO NO TOCA CIENCIA Y NO ESPERA A GILDARDO ───────────────────────────────────────────
--
-- No cambia QUE se pregunta (numero de comidas al dia), ni el tipo de respuesta, ni las opciones, ni el
-- `field_key` por el que el motor la lee. Cambia el verbo, que es lo que induce el error. Santiago lo
-- decidio asi y queda escrito aqui para que se pueda revisar con el archivo al lado.
--
-- ── LO QUE SE VERIFICO ANTES DE TOCARLA (y es la parte que importa) ───────────────────────────────
--
-- Cambiar el TEXTO de una pregunta ya rompio un mapeo antes: la 0085 resolvia el `field_key` POR TEXTO
-- ('¿Cuántas comidas hace al día?' -> 'd4_32'). Esa migracion esta aplicada y no vuelve a correr, asi que
-- no la afecta; pero por eso se comprobo que HOY nada mapee por texto:
--
--   · el motor y el gate leen por `field_key` (d4_32), no por la frase;
--   · las respuestas cuelgan de `question_id`, que NO cambia;
--   · los tres lectores que traen `question_text` (criterio, respuestas, encuesta) lo usan para MOSTRAR;
--   · la exportacion a CSV lo toma de la misma fila, asi que sale corregido solo.
--
-- ── SOLO LA VERSION ACTIVA (v6) ───────────────────────────────────────────────────────────────────
--
-- Las versiones anteriores se quedan como estaban: son el instrumento con el que respondieron pacientes
-- de entonces, y reescribirlas cambiaria lo que dice un registro historico. Lo que se corrige es lo que
-- se le muestra a quien responde de aqui en adelante.

begin;

update survey_questions
   set question_text = '¿Cuántas comidas consume al día?'
 where field_key = 'd4_32'
   and survey_version_id = '55555555-5555-5555-5555-555555555556'
   and question_text = '¿Cuántas comidas hace al día?';

-- Control: si no cambio exactamente UNA fila, algo no es lo que este archivo supone (otra version activa,
-- el texto ya corregido, o la pregunta movida) y es mejor no seguir a ciegas.
do $$
declare n int;
begin
  select count(*) into n
    from survey_questions
   where field_key = 'd4_32'
     and survey_version_id = '55555555-5555-5555-5555-555555555556'
     and question_text = '¿Cuántas comidas consume al día?';
  if n <> 1 then
    raise exception 'ABORTADO: se esperaba 1 pregunta d4_32 corregida en la v6 y hay %.', n;
  end if;
end $$;

commit;
