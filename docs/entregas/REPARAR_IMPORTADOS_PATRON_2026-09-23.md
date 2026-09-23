# Reparar los pacientes importados antes del 2026-09-23

**Qué pasó.** El HTML guarda las 18 preguntas del patrón alimentario como el **índice** de la opción (0 a 4);
Atlas guarda el **texto**. El importador las copiaba tal cual, así que quedaron como `"1"`, `"4"`, `"0"`.

**Por qué importa más de lo que parece.** Verse vacío no era el daño. El lector del patrón las marcaba
ilegibles y avisaba a Sentry (así se supo), pero **el ICEC sí se calculó**: su guarda comprueba que el dato
esté **presente**, y `"1"` está presente. Con el valor en la forma equivocada, el puntaje de Alimentación
salió bajo para **todo paciente importado**, y eso arrastra la edad biológica y el ICEC. Un dato en la forma
equivocada es peor que uno ausente, porque las guardas de ausencia no lo ven.

**Ya está arreglado hacia adelante** (commit `7b3a5e5e`): el importador traduce el ordinal contra el texto
canónico del motor, la revisión juzga lo que se va a guardar y no solo lo que viene como texto, y hay un
candado que cruza lo que el importador escribe con lo que el motor sabe leer.

**Lo que falta es lo ya importado.** Esto no se arregla solo.

---

## 1 · Ver a quién le pasó (solo lectura)

En el SQL editor de Supabase de producción:

```sql
select e.patient_id, count(*) as respuestas_malas
  from survey_answers sa
  join survey_questions sq on sq.id = sa.question_id
  join survey_responses sr on sr.id = sa.response_id
  join evaluations e on e.id = sr.evaluation_id
 where sr.import_batch_id is not null
   and sq.field_key ~ '^d1(_[0-9]+|f_[a-z]+)_i$'
   and sa.answer_value ~ '^[0-9]+$'
 group by 1;
```

Cada fila es un paciente con el patrón en la forma equivocada. Si no sale ninguna, no hay nada que reparar.

## 2 · Ver si alguno alcanzó a tener diagnóstico

```sql
select e.id, e.patient_id, e.status, (d.id is not null) as tiene_diagnostico
  from evaluations e
  join survey_responses sr on sr.evaluation_id = e.id
  left join diagnoses d on d.evaluation_id = e.id
 where sr.import_batch_id is not null;
```

Esto parte el problema en dos, y el remedio es distinto:

- **Sin diagnóstico generado:** no hay nada sellado. Basta corregir las respuestas.
- **Con diagnóstico generado:** ese diagnóstico tiene el ICEC mal y **no se puede editar** (un diagnóstico
  sellado es inmutable, con su constelación de versiones, y eso no se toca). Hay que **generar uno nuevo**
  después de corregir, y el viejo queda en la historia como lo que fue.

## 3 · El camino recomendado: deshacer y volver a importar

Es el más limpio y no inventa nada: **Deshacer** el lote desde `/admin/importar-html` y volver a importarlo
con el archivo original, ya con la corrección. El deshacer es todo o nada (así se decidió) y borra los
pacientes que ese lote creó, sus evaluaciones y sus consentimientos de origen.

**Antes de deshacer, dos condiciones:**

1. **Que nadie haya trabajado encima.** Si a un paciente importado ya se le agregó algo en Atlas (una
   evaluación nueva, un tratamiento, una venta), el deshacer se niega (`LoteNoReversibleError`), y hace bien.
2. **Que se conserve el archivo de exportación original.** Sin él no hay con qué volver a importar.

Si alguna de las dos no se cumple, no se deshace: se repara en sitio (punto 4) y se avisa.

## 4 · Si no se puede deshacer

Entonces hay que traducir las respuestas ya guardadas. **No lo hagas a mano contra la base**: la traducción
tiene que salir del mismo sitio del que sale la del importador (los textos del motor congelado), y escribir
a mano un texto que no sea byte a byte el canónico deja el problema igual pero más difícil de ver (los
guiones de "1–2 días" y "3–4 días" son en-dash, no guion normal).

Pídeme el script de reparación: sale de `opcionCanonicaDelPatron`, deja su rastro en el audit log, y al
terminar hay que **generar de nuevo** el diagnóstico de las evaluaciones del punto 2 que lo tuvieran.

## 5 · Y avisar

A quien atendió a esos pacientes: **el ICEC y la edad biológica de esos diagnósticos estaban mal** y hay
unos nuevos. No es un detalle de pantalla, es una cifra que el profesional pudo haberle dicho al paciente.
