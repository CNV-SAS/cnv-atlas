-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA VISTA CON SECURITY DEFINER, Y EL ENDURECIMIENTO DE LAS FUNCIONES  ·  2026-09-29
--
-- Lo que queda del reporte de Supabase, ya clasificado. NO todo era riesgo: lo que si lo era va primero.
--
-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. LA VISTA  ·  ERROR, y si era real
-- ══════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `combinaciones_bajo_umbral` (0119) cruza `revenue_splits` con `professional_commission_rates` y muestra el
-- NOMBRE del Integrante junto a su TASA DE COMISION y la participacion del proveedor.
--
-- Las dos tablas de origen tienen RLS ("las lee quien ve dinero"), pero una vista en Postgres corre por
-- defecto con los permisos de QUIEN LA CREO, asi que la vista PASABA POR ENCIMA de esa RLS: cualquiera con
-- sesion podia leer las tasas de todos los Integrantes. No hay datos de pacientes ahi, pero si de personas.
--
-- `security_invoker = true` (Postgres 15+; el proyecto corre 17) la hace evaluar con los permisos de QUIEN
-- CONSULTA, o sea con la RLS de las tablas de origen. Es una linea y no cambia lo que la vista devuelve a
-- quien ya tenia derecho a verlo.
ALTER VIEW public.combinaciones_bajo_umbral SET (security_invoker = true);--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. EL search_path DE LAS FUNCIONES  ·  WARN, y es mas ruido que riesgo, pero se cierra
-- ══════════════════════════════════════════════════════════════════════════════════════════════════
--
-- SE MIDIO ANTES DE TOCAR: las 19 funciones que el reporte lista son TODAS security invoker y TODAS devuelven
-- trigger. O sea que corren con los privilegios de quien dispara la operacion, no con los del creador: el
-- vector clasico (colar un objeto en un esquema anterior del search_path para que una funcion PRIVILEGIADA lo
-- ejecute) no aplica, porque no hay privilegio extra que robar.
--
-- Las SECURITY DEFINER de verdad (has_role, is_patient_professional, is_own_professional_profile,
-- current_user_roles, has_active_grant, es_mi_ficha_profesional, patient_professional_anexo3_current) YA
-- TIENEN su search_path fijado en vacio. Se verifico una por una, leyendo el cuerpo de cada una.
--
-- ASI QUE ESTO ES HIGIENE, y se hace con ALTER FUNCTION y NO reescribiendo los cuerpos: fijar el camino sin
-- tocar una linea de logica no puede romper un trigger. Reescribir 19 funciones para calificar cada tabla con
-- el esquema seria mover riesgo real a cambio de silenciar un aviso.
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.prevent_audit_mutation() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.prevent_report_snapshot_mutation() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.treatments_immutability() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.diagnoses_confirmation_immutability() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.clinical_corrections_guard() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.clinical_corrections_apply() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.clinical_corrections_append_only() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.evaluations_superseded_coherence() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.nutra_movement_append_only() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.nutra_faltante_transition_append_only() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.nutra_count_append_only() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.referrals_immutable() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.prescription_emissions_immutability() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.prevent_soap_note_mutation() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.commission_settlement_paid_immutable() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.lot_expiry_alerts_solo_vista() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.nutra_returns_solo_cierre() SET search_path = pg_catalog, public;--> statement-breakpoint
ALTER FUNCTION public.distribucion_statements_inmutable() SET search_path = pg_catalog, public;--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. NADA DE ESTO LO LLAMA UN ANONIMO  ·  WARN, y se cierra porque es gratis
-- ══════════════════════════════════════════════════════════════════════════════════════════════════
--
-- SE MIDIO PRIMERO: NINGUNA politica de la base alcanza al rol anon (cero filas en pg_policies con ese rol).
-- Asi que un anonimo no tiene nada legitimo que hacer con estas funciones, y revocarle el EXECUTE no puede
-- romper una politica. Eso era lo UNICO que habia que comprobar antes de revocar: una funcion que una politica
-- evalua se ejecuta COMO el consultante, y quitarle el permiso habria roto la consulta entera.
--
-- LAS SEIS AUTOACOTADAS DEVUELVEN FALSO A UN ANONIMO, verificado leyendo cada cuerpo: todas cuelgan de
-- auth.uid(), que para anon es nulo. O sea que no filtraban. Se revocan igual, porque un endpoint que no
-- deberia existir es superficie que hay que volver a analizar cada vez que alguien audite.
--
-- LA EXCEPCION QUE SI ERA UN ORACULO: patient_professional_anexo3_current(p_patient_id) NO usa auth.uid().
-- Responde si el profesional de ESE paciente tiene el Anexo 3 firmado, para cualquier id que le pasen. Es un
-- booleano y hay que conocer el UUID, asi que el alcance es chico, pero es la unica de las siete que contesta
-- algo sobre un PACIENTE a quien no ha iniciado sesion.
REVOKE EXECUTE ON FUNCTION public.current_user_roles() FROM anon;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.has_role(public.app_role) FROM anon;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_own_professional_profile(uuid) FROM anon;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_patient_professional(uuid) FROM anon;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.es_mi_ficha_profesional(uuid) FROM anon;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.has_active_grant(public.access_grant_type, uuid) FROM anon;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.patient_professional_anexo3_current(uuid) FROM anon;--> statement-breakpoint

-- Y LAS DE TRIGGER, de los DOS roles: llamarlas por RPC falla sola (una funcion de trigger sin contexto de
-- trigger lanza), pero un trigger NO comprueba el EXECUTE de quien dispara la operacion (eso se comprueba al
-- CREAR el trigger), asi que revocarlo no apaga ningun candado. Se verifica corriendo la suite de BD despues.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.nutra_faltante_case_coherence() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.nutra_faltante_project() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.nutra_faltante_settle() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.nutra_faltante_transition_valid() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.nutra_inventory_coherence() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.nutra_movement_apply() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.nutra_movement_lote_del_producto() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.nutra_movement_remesa_link() FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.reparto_residuo_cnv_valido() FROM anon, authenticated;
