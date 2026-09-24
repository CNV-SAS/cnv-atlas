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

## 2 · Borrar el diagnóstico de esas consultas

```sql
delete from diagnoses d
 using evaluations e, html_import_batches b
 where d.evaluation_id = e.id
   and e.import_batch_id = b.id
   and b.reverted_at is null;
```

Si quieres hacerlo de a un lote, agrega `and b.id = '<el id del lote>'`.

**Si eso falla por una referencia** (un tratamiento o un reporte colgando del diagnóstico), significa que
alguien trabajó encima: bórralos primero, o dime y lo miramos, porque entonces ya no es solo un lote de
prueba.

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
