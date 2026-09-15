-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- REINICIAR LOS ENVIOS DE HOY DEL RESUMEN DE AVISOS  ·  solo para el smoke del Bloque A  ·  2026-09-15
--
-- El resumen se envia una sola vez por dia y franja (alert_digest_runs). Para repetir la mañana y la tarde en
-- el mismo dia del smoke, se borran las filas de HOY (dia de Colombia). No toca ventas, marcas ni "en gestion".
--
-- COMO SE CORRE: ver docs/entregas/SMOKE_BLOQUE_A_AVISOS.md, paso 5. NO se pega en el editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  delete from alert_digest_runs where run_date = (now() at time zone 'America/Bogota')::date;
  get diagnostics n = row_count;
  raise notice 'Envios de hoy borrados: %. La mañana y la tarde se pueden correr otra vez.', n;
end $$;

commit;
