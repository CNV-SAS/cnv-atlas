-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- MULTI-CELL BASE, CON GUION, COMO DICE SU REGISTRO SANITARIO  ·  2026-09-13
--
-- El catalogo decia "MULTICELL BASE" desde agosto, por la decision #16 de DATA_GOVERNANCE, que afirmaba que
-- el registro INVIMA lo escribe sin guion. Era al reves: Santiago leyo el registro RSA-3987-2026 en la
-- consulta del INVIMA el 2026-09-13 y dice "MULTI-CELL BASE". La grafia sigue la regla de siempre (manda el
-- registro, que es el nombre con el que el producto esta autorizado); lo que estaba mal era el dato.
--
-- ES EL NOMBRE QUE VA A LA FACTURA DE PRODUCCION, y por eso se corrige antes del paso a produccion: el item
-- de Alegra produccion se crea con este nombre y el cotejo compara nombres.
--
-- QUE NO CAMBIA: las firmas de las prescripciones usan el id del producto, no su nombre; los snapshots y
-- reportes ya emitidos conservan el nombre con el que se emitieron, que es historia.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE n int;
BEGIN
  -- Si ya existe con guion (la migracion corrio, o alguien lo corrigio a mano), no hay nada que hacer.
  IF EXISTS (SELECT 1 FROM "nutraceuticals" WHERE "name" = 'MULTI-CELL BASE') THEN
    IF EXISTS (SELECT 1 FROM "nutraceuticals" WHERE "name" = 'MULTICELL BASE') THEN
      RAISE EXCEPTION 'ABORTADO: existen a la vez "MULTICELL BASE" y "MULTI-CELL BASE". Hay que decidir a mano cual es el producto.';
    END IF;
    RAISE NOTICE 'MULTI-CELL BASE ya tenia guion: nada que renombrar.';
    RETURN;
  END IF;

  UPDATE "nutraceuticals" SET "name" = 'MULTI-CELL BASE', "updated_at" = now()
   WHERE "name" = 'MULTICELL BASE';
  GET DIAGNOSTICS n = ROW_COUNT;
  -- Una base sin el catalogo sembrado (0 filas) no es un error; mas de una si lo seria.
  IF n > 1 THEN
    RAISE EXCEPTION 'ABORTADO: "MULTICELL BASE" nombra % productos, y tiene que ser uno.', n;
  END IF;
  RAISE NOTICE 'Renombrado a MULTI-CELL BASE: % producto(s).', n;
END $$;
