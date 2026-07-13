-- RLS de clinical_access_grants (bloque auditoria/control de calidad).
-- Sigue el modelo de 0003_rls.sql y 0007_survey_links_rls.sql.
--
-- Modelo de acceso:
--   - SELECT: el solicitante ve sus propios grants; el aprobador ve los que le
--     tocan, resueltos por approver_role (calculado al solicitar: soporte -> admin,
--     admin -> direccion). obbia, professional y cualquier otro no ven nada (no
--     coinciden con approver_role ni son requester). No hay identidad de paciente
--     en esta tabla: solo resource_id (uuid), el join a la PII es Nivel (c).
--   - INSERT/UPDATE/DELETE: sin policy. Crear la solicitud, aprobar, negar y revocar
--     va por writers con owner (BYPASSRLS) para escribir el evento en
--     clinical_audit_log inline en la misma transaccion (regla dura 8); una sesion
--     no puede escribir el audit log, asi que tampoco muta esta tabla directo. El
--     approver_role se calcula server-side desde el rol real del solicitante, no
--     desde el cliente, para que no se pueda forjar la matriz de aprobacion.

alter table public.clinical_access_grants enable row level security;--> statement-breakpoint

create policy "clinical_access_grants_select" on public.clinical_access_grants
  for select to authenticated using (
    requester_id = auth.uid() or public.has_role(approver_role)
  );
