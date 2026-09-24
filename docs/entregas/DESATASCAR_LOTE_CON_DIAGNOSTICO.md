# Deshacer un lote importado al que ya se le generó un diagnóstico

**Para Santiago, 2026-09-24.** El deshacer se niega cuando alguna consulta del lote ya tiene diagnóstico, y
hace bien: un diagnóstico es un registro clínico sellado, con su constelación de versiones, y borrarlo por
detrás sin decirlo sería justo lo que ninguna parte de Atlas hace.

Así que el diagnóstico se borra **a propósito y con nombre**, y después el lote se deshace por la pantalla.
Esto es una excepción de reconstrucción, no un procedimiento normal: **solo aplica a pacientes de prueba o a
pacientes importados que se van a volver a importar.** Nunca a un paciente real que se está atendiendo.

## 1 · Ver qué se va a borrar, antes de borrar nada

```sql
select b.id as lote, b.source_file_name, e.id as evaluacion, d.id as diagnostico, d.created_at
  from html_import_batches b
  join evaluations e on e.import_batch_id = b.id
  join diagnoses d on d.evaluation_id = e.id
 where b.reverted_at is null
 order by d.created_at;
```

Si sale algo que **no** esperabas (un paciente que no es de prueba ni de los importados), para ahí y dime.

## 2 · Por qué el borrado directo NO funciona, y qué hace falta

El `delete` simple falla:

```
P0001: Un diagnostico confirmado es inmutable (firma clinica): no se puede borrar.
```

Y hace bien. Un diagnóstico nace **firmado** desde el 2026-09-18, y la firma clínica no se borra
(trigger `diagnoses_confirmation_immutability`, migración 0027).

**La regla del producto se queda como está:** cuando un profesional ya diagnosticó sobre un paciente
importado, ese import es parte de su historia clínica y el lote no se deshace. Se evaluaron las dos salidas
obvias y las dos son peores:

- **Desactivar el trigger dentro del deshacer.** Haría reversible cualquier lote, incluido uno donde se
  firmó un diagnóstico sobre un paciente real. Un botón que borra una firma clínica no debe existir.
- **Que el deshacer supersediera el diagnóstico** en vez de borrarlo, como la corrección de evaluación. No
  resuelve nada: el deshacer borra las evaluaciones y los pacientes que creó el lote, así que si el
  diagnóstico se queda, se quedan también la evaluación y el paciente, y no se deshizo nada.

Así que para un lote **de prueba** hay que levantar el trigger una vez, a mano, con la vía de escape que el
propio trigger documenta y acota a pre-producción. **Antes de correrlo, el paso 1 es obligatorio**: si algún
paciente del lote no es de prueba, no se corre.

```sql
begin;
set local session_replication_role = replica;

delete from diagnoses d
 using evaluations e
 where d.evaluation_id = e.id
   and e.import_batch_id = '<el id del lote>';

commit;
```

Esto borra **solo** los diagnósticos de ese lote. No deshace nada más: eso viene ahora, por la pantalla, que
es la que deja el rastro en el audit.

## 3 · Deshacer el lote desde la pantalla

En `/admin/importar-html`, **Deshacer** sobre cada lote. Ahora sí procede.

## 4 · Confirmar que quedó limpio

```sql
select count(*) from survey_answers sa
  join survey_questions sq on sq.id = sa.question_id
  join survey_responses sr on sr.id = sa.response_id
 where sr.import_batch_id is not null and sq.field_key ~ '^d1(_[0-9]+|f_[a-z]+)_i$'
   and sa.answer_value ~ '^[0-9]+$';
```

Cero es lo que se busca: ninguna respuesta del patrón alimentario quedó en la forma vieja.

## Y lo que hay que arreglar para que esto no se repita

**El smoke se contradecía**: su paso 3 genera el diagnóstico y su cierre dice "deshaz el lote", que es
justamente lo que el diagnóstico impide. Toda corrida dejaba un lote atascado. Ya está corregido en
`SMOKE_IMPORTACION_CIRCUNFERENCIAS_TECLEADAS.md`: la limpieza se hace en el orden que sí funciona.
