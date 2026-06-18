-- Grants a los roles de la Data API de Supabase (authenticated, service_role).
--
-- Por que hace falta: Drizzle crea las tablas como postgres por conexion directa,
-- fuera del flujo de Supabase que auto-otorga privilegios a estos roles. Sin estos
-- GRANT, PostgREST/supabase-js da "permission denied for table" aunque RLS y el
-- service_role esten bien (el seed fallaba aqui).
--
-- Por que es seguro: la proteccion de datos la dan las RLS ya habilitadas en las
-- 55 tablas. Estos grants solo permiten que las API roles LLEGUEN a la tabla;
-- authenticated sigue filtrado por las policies, y service_role bypassa RLS por
-- diseno (escrituras mediadas por el sistema). NO se incluye anon: Atlas no expone
-- lectura anonima de tablas public.
--
-- default privileges: cubre las tablas que creen futuras migraciones (tambien
-- corren como postgres), para no repetir este grant cada vez.

grant usage on schema public to authenticated, service_role;--> statement-breakpoint

grant all on all tables in schema public to authenticated, service_role;--> statement-breakpoint
grant all on all sequences in schema public to authenticated, service_role;--> statement-breakpoint
grant all on all functions in schema public to authenticated, service_role;--> statement-breakpoint

alter default privileges in schema public grant all on tables to authenticated, service_role;--> statement-breakpoint
alter default privileges in schema public grant all on sequences to authenticated, service_role;--> statement-breakpoint
alter default privileges in schema public grant all on functions to authenticated, service_role;
