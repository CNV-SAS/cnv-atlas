-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UN DESCARTE VALE EN LOS DOS PANELES QUE MUESTRAN EL MISMO HECHO  ·  2026-10-15
--
-- ═══ EL CASO (Santiago, 2026-10-15, el arranque) ═══
--
-- Corrio el script de arranque CON COMMIT: las 55 ventas anteriores quedaron marcadas de prueba, no quedo
-- NINGUNA real, y la fecha de arranque quedo en el 15. Y textual suyo: *"ADMIN SIGUE VIENDO LO MISMO en
-- /pagos"*, con cinco en "Ventas por revisar" y cuatro mas un descartado en "Pendientes sin salida".
--
-- No era el despliegue ni un lector sin cubrir. Las cinco filas son las DOS excepciones escritas a proposito
-- (0218): hablan de UNIDADES FISICAS, y una unidad real salio de una vitrina real aunque el paciente sea de
-- prueba. Hasta ahi, correcto.
--
-- ═══ EL DEFECTO QUE SI HABIA, Y ES EL HAZARD 4 DE CLAUDE.MD ═══
--
-- La bandeja "Ventas por revisar" DICE, en su propio texto y para cada una de esas filas: *"ese descuadre hay
-- que cuadrarlo o descartarlo abajo, en Pendientes sin salida"*. Y `listarVentasPorRevisar` NO SABE NADA DEL
-- DESCARTE: despues de descartar, la fila sigue exactamente donde estaba.
--
-- O sea que la pantalla manda a hacer algo y no reconoce que se hizo. Santiago descarto uno (por eso se ve
-- "1 descartado" en el otro panel) y la bandeja siguio pidiendoselo. Leido desde afuera eso no se ve como
-- dos reglas distintas: se ve como que el sistema no registro la accion.
--
-- Es la regla de fondo del hazard 4: *"si dos partes de la pantalla dicen cosas opuestas, no es que una
-- este mal, es que LEEN FUENTES DISTINTAS"*, y el arreglo es unir las fuentes.
--
-- ═══ POR QUE UNA FUNCION Y NO LA CONDICION COPIADA ═══
--
-- Es el mismo argumento de la 0218 y de `huella_del_pendiente`, y aqui pesa mas porque la condicion no es
-- trivial: un descarte cuenta solo si NO esta revocado y si su huella sigue siendo la de HOY (un hecho que
-- cambio despues del juicio ya no esta cubierto por ese juicio, y vuelve a pedir accion).
--
-- Escrita dos veces, lo que divergiria no es un filtro: es la caducidad del juicio de una persona.
--
-- ⚠ Y LA HUELLA SOLO SE CALCULA SI HAY FILA DE DESCARTE. `huella_del_pendiente` LANZA para un tipo que no
--   tiene huella definida (hoy solo `sin_saldo` y `por_despachar`), y la bandeja pregunta tambien por
--   `fallido`, que no tiene camino de descarte. Con el EXISTS, para `fallido` no se evalua nunca.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.el_pendiente_sigue_pidiendo_accion(p_kind text, p_tx uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
      FROM pending_discards d
     WHERE d.kind = p_kind
       AND d.transaction_id = p_tx
       -- REVOCADO NO CUENTA: alguien se retracto del juicio.
       AND d.revoked_at IS NULL
       -- Y CADUCADO TAMPOCO: la huella guardada contra la de AHORA. Las dos salidas de la MISMA funcion,
       -- que es la razon por la que `huella_del_pendiente` existe.
       AND d.fact_fingerprint IS NOT DISTINCT FROM public.huella_del_pendiente(d.kind, d.transaction_id)
  );
$$;--> statement-breakpoint

COMMENT ON FUNCTION public.el_pendiente_sigue_pidiendo_accion(text, uuid) IS
  'Si este pendiente sigue pidiendo accion: no tiene descarte vigente, o el que tiene ya caduco porque el hecho cambio. Una sola definicion para los DOS paneles que muestran el mismo hecho (la bandeja de ventas por revisar y Pendientes sin salida), que antes solo la tenia uno.';--> statement-breakpoint

-- La leen las pantallas con la conexion de sistema; nadie la invoca desde el navegador.
REVOKE ALL ON FUNCTION public.el_pendiente_sigue_pidiendo_accion(text, uuid) FROM anon, authenticated;
