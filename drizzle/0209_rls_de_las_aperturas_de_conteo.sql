-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- RLS DE LAS APERTURAS DE CONTEO (corrige un olvido de la 0208, mismo dia)
--
-- ═══ QUE PASO, Y VALE MAS QUE LA MIGRACION ═══
--
-- La 0208 creo `nutraceutical_count_openings` y SE OLVIDO DE HABILITAR RLS. Lo atrapo
-- `rls-en-todas-las-tablas.test.ts`, que barre `public` y exige que ninguna tabla quede sin RLS. Sin eso, la
-- tabla quedaba legible y escribible por cualquier usuario autenticado a traves de la API.
--
-- Y VA EN UNA MIGRACION NUEVA Y NO EDITANDO LA 0208, porque la 0208 YA ESTA APLICADA. Las migraciones son
-- forward-only (ARCHITECTURE.md, y es la primera de "lo que nunca debes hacer"): editar una aplicada deja la
-- base local al dia y la nube sin el cambio, sin que nada lo diga. Mi primer impulso fue agregarlo al final de
-- la 0208, y eso habria sido exactamente ese defecto.
--
-- ═══ QUIEN LEE Y QUIEN ESCRIBE, con su razon ═══
--
-- LEE EL INTEGRANTE DUEÑO, y hace falta: su pantalla dice "CNV te pidio un conteo: (la razon)", y esa frase
-- sale de aqui. Una apertura que no puede leer es una peticion que no puede ver.
--
-- ESCRIBE SOLO CNV (admin o direccion). Sin esta mitad, un Integrante podria abrirse el conteo a si mismo y la
-- ventana no significaria nada. El escritor ya lo exige por policy; esto lo pone tambien en la base, porque es
-- la clase de regla que no debe depender de una sola capa.
--
-- SIN UPDATE NI DELETE, igual que la sesion de conteo (0045): una peticion es un HECHO registrado. Si se
-- concedio de mas, se deja vencer; si hace falta otra, se concede otra. Editarla borraria el rastro de lo que
-- se pidio, que es justo lo que esta tabla existe para conservar.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "nutraceutical_count_openings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "nutra_count_openings_select" ON "nutraceutical_count_openings";--> statement-breakpoint
CREATE POLICY "nutra_count_openings_select" ON "nutraceutical_count_openings"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR public.is_own_professional_profile(professional_id)
  );--> statement-breakpoint

DROP POLICY IF EXISTS "nutra_count_openings_insert" ON "nutraceutical_count_openings";--> statement-breakpoint
CREATE POLICY "nutra_count_openings_insert" ON "nutraceutical_count_openings"
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role('admin') OR public.has_role('direccion')
  );
