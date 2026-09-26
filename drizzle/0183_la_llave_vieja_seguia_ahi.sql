-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA LLAVE VIEJA SEGUIA AHI, PORQUE EL DROP NO ACERTO SU NOMBRE  ·  2026-09-25
--
-- La 0182 quiso hacer aplazable la llave de `superseded_by` y hizo dos cosas: solto una llave con el nombre que
-- YO SUPUSE (`..._superseded_by_professional_attachments_id_fk`, el estilo que genera drizzle-kit) y agrego la
-- aplazable. Pero esta tabla se creo con SQL escrito a mano, asi que Postgres le puso SU nombre por defecto
-- (`..._superseded_by_fkey`), y ese `DROP ... IF EXISTS` NO SOLTO NADA.
--
-- EL RESULTADO ES LA PARTE QUE IMPORTA: quedaron DOS llaves sobre la misma columna, una aplazable y otra no, y
-- manda la mas estricta. O sea que la 0182 parecio aplicarse (drizzle dijo "applied successfully") y no cambio
-- el comportamiento. Su candado lo dijo enseguida: "Key (superseded_by)=... is not present", con el nombre
-- `..._superseded_by_fkey` en el error.
--
-- ── LA LECCION ──
--
-- `DROP CONSTRAINT IF EXISTS` con el nombre equivocado es SILENCIOSO: no falla, no avisa, y deja creer que la
-- restriccion ya no esta. En una tabla creada a mano hay que mirar el nombre real (pg_constraint), no suponer el
-- que generaria drizzle-kit. Es de la misma familia que el CHECK que pasaba por un nulo (0181): dos formas de
-- que una restriccion diga una cosa y haga otra.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "professional_attachments"
  DROP CONSTRAINT IF EXISTS "professional_attachments_superseded_by_fkey";
