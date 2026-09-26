-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- REEMPLAZAR UN ADJUNTO SIN CHOCAR CONTRA SU PROPIO INDICE  ·  2026-09-25
--
-- LO ENCONTRO SU CANDADO al subir el SEGUNDO RUT. La 0179 puso dos invariantes buenos que, juntos, no dejaban
-- hacer el acto para el que existe la tabla:
--
--   · UNO VIGENTE por (profesional, tipo)  -> el adjunto nuevo no puede entrar mientras el viejo siga vigente;
--   · y un reemplazado DICE POR CUAL       -> el viejo no se puede retirar antes de que el nuevo exista.
--
-- O sea: A no puede entrar antes de B y B no puede salir antes de A. Cualquiera de los dos ordenes falla, y el
-- primer intento fallo con "duplicate key value violates unique constraint".
--
-- ── LA SALIDA ES APLAZAR LA LLAVE AL COMMIT, no aflojar ninguno de los dos ──
--
-- Con la FK DEFERRABLE INITIALLY DEFERRED el escritor puede: (1) retirar el viejo apuntando a un id que
-- TODAVIA no existe, (2) insertar el nuevo con ese id. Dentro de la transaccion el estado es transitorio y al
-- commit todo cuadra: un vigente, y el retirado apuntando a el.
--
-- POR QUE NO SE AFLOJO EL CHECK (que era la otra salida): permitir "retirado sin sucesor" para siempre, por un
-- problema de dos instantes, habria borrado la unica cosa que distingue REEMPLAZADO de RETIRADO, y el historial
-- dejaria de poder explicar de donde salio el vigente.
--
-- El indice unico NO se puede aplazar (es un indice parcial, no una restriccion), asi que lo que se aplaza es lo
-- que si se puede: la llave foranea.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "professional_attachments"
  DROP CONSTRAINT IF EXISTS "professional_attachments_superseded_by_professional_attachments_id_fk";--> statement-breakpoint

ALTER TABLE "professional_attachments"
  ADD CONSTRAINT "professional_attachments_superseded_by_fk"
  FOREIGN KEY ("superseded_by") REFERENCES "professional_attachments"("id")
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;
