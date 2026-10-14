-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL DESCUADRE FISICO ES REAL: UNA SOLA DEFINICION PARA LOS DOS LECTORES QUE LA USAN  ·  2026-10-14
--
-- ═══ DE DONDE SALE ═══
--
-- La 0203 dejo UNA respuesta a "¿esta venta cuenta?" (`cuenta_como_de_prueba`), y catorce lectores la leen.
-- Pero DOS lectores estan exceptuados a proposito, con su razon escrita: los que hablan de UNIDADES FISICAS.
-- Si el producto era real, la unidad salio del estante de verdad y la vitrina esta descuadrada de verdad,
-- aunque el paciente o el profesional sean de prueba. Esconderlo esconderia un problema fisico.
--
--   · la bandeja "Ventas por revisar" (`listarVentasPorRevisar`), rama de saldo;
--   · y la rama `sin_saldo` del correo y del panel "Pendientes sin salida" (`listarPendientesDeAccion`).
--
-- ═══ EL DEFECTO: LA EXCEPCION ESTABA ESCRITA DOS VECES, Y DISTINTO ═══
--
-- Las dos miraban el PRODUCTO, pero no con la misma condicion:
--
--   · la bandeja:  not exists (linea con producto de prueba)      -> "NINGUNA linea es de prueba"
--   · los avisos:  exists (linea con producto NO de prueba)       -> "ALGUNA linea es real"
--
-- Hoy dan lo mismo porque el servicio no deja mezclar productos de prueba y reales en una venta. O sea que
-- coinciden por una regla de OTRA capa, no porque digan lo mismo. El dia que esa regla cambie, los dos
-- paneles van a discrepar sobre la misma venta, que es exactamente el defecto que ya pasamos: la LUVIA que
-- se veia en un panel y no se podia descartar en el otro.
--
-- ═══ Y LA MARCA MANUAL ENTRA AQUI, QUE ES LA DECISION NUEVA (Santiago, 2026-10-14) ═══
--
-- La 0217 escribio que la marca por venta NO saca el aviso de "cobrada sin saldo", y la razon era buena: una
-- marca derivada (del paciente, del profesional) no sabe nada de unidades. Pero la marca MANUAL si es otra
-- cosa, y es la unica de las cuatro que lo es: la pone UNA PERSONA, con motivo de diez caracteres y su fila
-- de auditoria, afirmando que el ACTO fue una prueba. Eso es precisamente la autoridad que a las derivadas
-- les falta.
--
-- Textual de Santiago: *"hagamos el esfuerzo a ver si marcamos cada caso como de prueba para que se oculten
-- esta vez si de verdad"*. Con la marca manual como insumo, se oculta; sin ella, no.
--
-- LO QUE ESTO NO ARREGLA, Y HAY QUE DECIRLO IGUAL DE FUERTE: la unidad sigue sin estar en el estante. Marcar
-- no devuelve nada. Lo que la marca quita es el AVISO, porque quien marco ya dijo que ese caso lo resuelve el
-- conteo; lo que cuadra el SALDO es un movimiento de `conciliacion` por ubicacion, con sus cifras. Por eso el
-- script de arranque imprime, una por una, las ventas que oculta por esta via: es la lista con la que se
-- cuenta el inventario.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── LA FUNCION: "¿pudo esta venta mover unidades de verdad?" ───
--
-- VA EN LA BASE Y NO EN TYPESCRIPT por lo mismo que `huella_del_pendiente`: los dos lectores escriben SQL
-- crudo, y una condicion copiada en dos consultas es una condicion que algun dia va a divergir en una.
--
-- `stable` y no `immutable`: depende de filas que pueden cambiar (la marca, el producto).
CREATE OR REPLACE FUNCTION public.el_descuadre_fisico_es_real(p_tx uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM transactions t
      JOIN transaction_items ti ON ti.transaction_id = t.id
      JOIN nutraceuticals n ON n.id = ti.nutraceutical_id
     WHERE t.id = p_tx
       -- (1) NADIE DIJO A MANO QUE ESTE ACTO FUE UNA PRUEBA.
       AND t.marcada_como_prueba_at IS NULL
       -- (2) Y HAY AL MENOS UNA LINEA DE PRODUCTO REAL: un hueco de saldo en un producto que no existe no es
       -- un problema de operacion. Esta es la mitad que ya estaba, escrita una sola vez.
       AND COALESCE(n.is_test, false) = false
  );
$$;--> statement-breakpoint

COMMENT ON FUNCTION public.el_descuadre_fisico_es_real(uuid) IS
  'Si esta venta pudo mover unidades FISICAS de verdad: ninguna marca manual del acto y al menos una linea de producto real. La usan los dos lectores exceptuados de cuenta_como_de_prueba (la bandeja de ventas por revisar y la rama sin_saldo de los avisos), que hablan de unidades y no de dinero.';--> statement-breakpoint

-- La leen las pantallas con la conexion de sistema; nadie la invoca desde el navegador.
REVOKE ALL ON FUNCTION public.el_descuadre_fisico_es_real(uuid) FROM anon, authenticated;
