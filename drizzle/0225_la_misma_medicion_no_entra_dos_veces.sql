-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL INDICE QUE HACE BARATO BUSCAR LA MISMA MEDICION  ·  0225
--
-- ═══ DE DONDE SALE (Santiago, 2026-10-24) ═══
--
-- *"EL FRENO, YA: que una misma medicion (por huella de los crudos) no se pueda importar a una segunda
-- evaluacion, ni del mismo paciente ni de otro."*
--
-- Medido en produccion el 2026-10-24: 11 grupos de mediciones con los crudos IDENTICOS hasta el ultimo
-- decimal, 5 de ellos repartidos entre pacientes DISTINTOS (uno con tres evaluaciones). Es un dato de salud
-- de una persona en la historia clinica de otra, y de ahi salio el diagnostico que esa otra recibio.
--
-- ═══ QUE HACE ESTA MIGRACION, Y QUE NO ═══
--
-- SOLO EL INDICE. El freno vive en TypeScript, en `medicion-duplicada-reader.ts`, porque la huella se
-- construye con la MISMA funcion que lo compara: escribir la comparacion aqui en SQL dejaria dos
-- definiciones de "es la misma medicion", capaces de divergir.
--
-- ═══ POR QUE NO ES UN UNIQUE ═══
--
-- Porque hay una copia LEGITIMA: cuando una evaluacion se corrige, la nueva se queda con una copia de la
-- medicion (la toma fisica ocurrio una vez y pertenece a las dos versiones del registro). Un unique sobre
-- los crudos prohibiria eso y romperia el flujo de correccion. La excepcion se nombra donde se puede
-- verificar: el lector ignora un choque cuando las dos evaluaciones estan unidas en `clinical_corrections`.
--
-- ═══ Y POR QUE ESTE INDICE Y NO OTRO ═══
--
-- El freno busca candidatos por la primera variable de la huella (`Extracellular resistance`, la Re del
-- equipo) y su valor exacto; solo sobre esos pocos candidatos compara la huella completa. Sin el indice esa
-- busqueda es un recorrido de las 41.414 filas de `bis_raw_values` en cada importacion.
--
-- Es ADITIVO e inerte: un indice no cambia ninguna cifra ni ninguna fila.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

create index if not exists bis_raw_values_variable_valor_idx
  on public.bis_raw_values (variable_name, value);

comment on index public.bis_raw_values_variable_valor_idx is
  'Busqueda de candidatos del freno de medicion repetida (0225): variable + valor exacto. El freno vive en medicion-duplicada-reader.ts.';
