-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL VINCULO DE LA ENTREGA CON SU PACIENTE, EXIGIDO POR LA BASE (Bloque 0, 2026-09-11)
--
-- POR QUE EXISTE. `treatment_id` es lo que permite saber que paciente recibio que producto y de que lote.
-- Con producto de tercero en el portafolio (LUVIA, que contiene avena) y una obligacion contractual de
-- trazar y notificar a los pacientes de un lote afectado, una entrega sin ese vinculo es un hueco negro:
-- ante una alerta sanitaria del fabricante no se puede saber a quien le llego.
--
-- El codigo siempre lo escribe (`inventory-service.recordDespacho`), pero eso es una convencion del
-- codigo, no una garantia. Esta restriccion la vuelve garantia.
--
-- ── POR QUE CONDICIONAL Y NO `NOT NULL` ──────────────────────────────────────────────────────────
--
-- El plan pedia un `NOT NULL` y NO ES VIABLE: esta tabla no guarda solo entregas. Guarda tambien
-- recepciones (el integrante reconoce que recibio), remesas (CNV declara que envio) y conciliaciones
-- (ajuste tras conteo fisico), y NINGUNA de las tres tiene tratamiento, porque no son actos sobre un
-- paciente. Un `NOT NULL` plano haria imposible RECIBIR MERCANCIA, que es justo lo que el Bloque 1
-- necesita para cargar el inventario inicial.
--
-- Asi que la restriccion dice lo que de verdad se quiere decir: el vinculo es obligatorio SOLO donde
-- significa algo.
--
-- ── LO QUE ESTO NO HACE ──────────────────────────────────────────────────────────────────────────
--
-- No repara las filas existentes. Las cuatro entregas con `treatment_id` nulo que hay hoy son datos de
-- PRUEBA y se van con la purga (`scripts/purga-comercial.sql`), que se corre ANTES que esta migracion.
-- Si se corriera al reves, esta migracion fallaria: un CHECK se valida contra las filas que ya estan.
-- Ese orden es parte del criterio de aceptacion del Bloque 0.
--
-- ── Y LO QUE CAMBIA EN EL BLOQUE 3 ───────────────────────────────────────────────────────────────
--
-- Al aplicarse la Decision 1 (la venta descuenta inventario), el tipo `despacho` se sustituye por `venta`
-- y el vinculo correcto pasa a ser movimiento -> venta -> tratamiento. Esta restriccion se reemplaza
-- entonces por la equivalente sobre `sale_line_id`. Hasta ese dia, esta es la que cierra el hueco.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "nutraceutical_stock_movements"
  ADD CONSTRAINT "nutra_movement_despacho_exige_tratamiento"
  CHECK ("type" <> 'despacho' OR "treatment_id" IS NOT NULL);
