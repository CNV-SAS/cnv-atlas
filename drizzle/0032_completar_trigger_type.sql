-- Nuevo disparador del flujo de correccion: completar_profesional. Corregir un dato mal digitado
-- (correccion_profesional) y agregar una respuesta que faltaba (completar_profesional) son actos
-- clinicamente distintos; sin etiquetas separadas, al auditar la cadena de versiones de un paciente
-- no se podria distinguir "aqui hubo errores" de "aqui la encuesta se completo en varias consultas".
-- El servicio deriva cual de los dos segun el delta. Forward-only, sin DROP; el valor se agrega al
-- final del enum (no se usa en esta misma migracion, seguro en PG12+).
ALTER TYPE "public"."correction_trigger_type" ADD VALUE 'completar_profesional';