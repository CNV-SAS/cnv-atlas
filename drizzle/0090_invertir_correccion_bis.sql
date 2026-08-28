-- INVERTIR el modelo de correccion de medidas: el valor corregido va al CRUDO, y esta tabla guarda el
-- ORIGINAL del equipo.
--
-- POR QUE SE INVIERTE (defecto encontrado en el smoke del 2026-08-27). Con la correccion viviendo
-- aparte, CADA consumidor de bis_raw_values tenia que acordarse de consultarla. Y son seis:
-- pipeline-reader (el que arma el bisRow para el MOTOR), treatment-reader (el GET medido de la cadena),
-- celular-badges-reader, serie-reader, medico-ejercicio-treatment-reader y composition-reader. Solo el
-- ultimo la consultaba.
--
-- **El diagnostico se habria generado sobre el valor SIN corregir**, y eso no se ve desde la pantalla.
--
-- Seis lectores que tengan que acordarse de una regla es la clase de regla que se olvida en el septimo.
-- Invirtiendo, los seis ven el valor corregido SIN CAMBIAR UNA LINEA, incluido el pipeline, y el
-- correction-flow copia lo correcto sin saber que existe esto.
--
-- EL CRUDO DEL EQUIPO NO SE PIERDE: cambia de sitio. Queda en original_value, que es su lugar, y la
-- pantalla lo sigue mostrando ("el equipo midio 84"). Lo que cambia es cual de los dos es el valor POR
-- DEFECTO, y el por defecto correcto es **el que el profesional afirma**, no el que llego mal.
--
-- Se puede porque bis_raw_values no tiene trigger append-only: solo policies de select e insert, y la
-- escritura va por service role.

-- El valor de la fila deja de ser "la correccion" y pasa a ser "lo que midio el equipo".
alter table bis_value_corrections rename column value to original_value;--> statement-breakpoint

comment on column bis_value_corrections.original_value is
  'Lo que midio el EQUIPO antes de que el profesional lo corrigiera. El valor vigente vive en bis_raw_values, para que TODOS los consumidores (incluido el pipeline) lo vean sin consultar esta tabla.';

comment on table bis_value_corrections is
  'Rastro de una medida antropometrica corregida: que midio el equipo, quien la corrigio y cuando. El valor CORREGIDO vive en bis_raw_values (invertido en 0090); aqui queda el original para poder decir cual es cual y para poder restaurarlo.';

-- LIMPIEZA DE LO SEMBRADO POR EL SMOKE. Las filas escritas antes de esta migracion llevan el nombre
-- CORTO de la medida ("cintura"), no el encabezado normalizado del Biody, asi que nunca coincidieron
-- con ningun crudo: estan huerfanas y su `value` es el valor corregido, no el original. Con la
-- inversion quedarian al reves de como deben. Son las del smoke y se borran; no hay dato clinico que
-- preservar porque nunca llegaron a consumirse.
delete from bis_value_corrections
where variable_name in ('peso', 'talla', 'cintura', 'cadera');
