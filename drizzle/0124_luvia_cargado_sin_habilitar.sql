-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LUVIA ENTRA AL CATALOGO, Y NO SE PUEDE VENDER  ·  Bloque 1  ·  2026-09-11
--
-- Producto de TERCERO en consignacion del Centro de Nutricion Integral Katherine Ruiz. Entra porque el
-- inventario inicial lo necesita (84 unidades ya repartidas), y entra BLOQUEADO porque no puede venderse
-- hasta que Direccion Cientifica firme las equivalencias de alergenos: declara AVENA, y la avena implica
-- gluten salvo certificacion.
--
-- ── LO QUE IMPIDE QUE SE VENDA, y por que ahora si basta ─────────────────────────────────────────
--
-- `commercial_availability = 'no_disponible'`. Hasta el 2026-09-11 esa bandera gateaba SOLO la entrega:
-- el checkout de /pagos filtraba el catalogo por "tiene precio" y nada mas, asi que un producto no
-- disponible con precio SE PODIA VENDER. Se cerro en el servicio (`resolveSale`), que es donde la accion
-- recibe ids y donde un filtro de formulario no alcanza.
--
-- Asi que la fila entra con las dos condiciones cumplidas: la bandera puesta y la puerta cerrada.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. EL PROVEEDOR ──────────────────────────────────────────────────────────────────────────────
--
-- Su perfil tributario va sin rellenar a proposito: son datos que hay que PEDIRLE, y escribir un supuesto
-- (responsable de IVA, agente de retencion) determinaria si CNV le retiene y cuanto. Un nulo se ve; un
-- supuesto plausible se da por bueno.
--
-- Y CONVIENE TENER PRESENTE EL CONFLICTO DE INTERES de la §7.9: la proveedora es tambien Integrante de la
-- red. El modelo pide que la decision de admision quede documentada con su criterio; sin ese registro, la
-- admision de un producto de un proveedor que ademas es Integrante es dificil de explicar.
INSERT INTO "suppliers" ("name", "notes")
SELECT 'Centro de Nutrición Integral Katherine Ruiz S.A.S.',
       'Proveedor de LUVIA en consignación. Perfil tributario PENDIENTE: sin él no se puede decidir si CNV le practica retención (§7.3). Conflicto de interés declarado (§7.9): la proveedora es también Integrante de la red.'
 WHERE NOT EXISTS (SELECT 1 FROM "suppliers" WHERE "name" = 'Centro de Nutrición Integral Katherine Ruiz S.A.S.');--> statement-breakpoint

-- ── 2. EL PRODUCTO ───────────────────────────────────────────────────────────────────────────────
--
-- PVP 90.000 con IVA (base 75.630, IVA 14.370), confirmado por contabilidad con el proveedor: viene de
-- redondear 89.990.
--
-- `brand_owner` es campo propio y NO se deduce del proveedor: por la doctrina del fabricante aparente
-- (§7.7), lo que hay que mostrar al paciente en la ficha, el reporte y la factura es quien pone la marca.
INSERT INTO "nutraceuticals"
  ("organization_id", "name", "description", "unit", "unit_price", "indication",
   "commercial_availability", "ownership", "brand_owner", "supplier_id", "vat_rate")
SELECT o."id",
       'LUVIA',
       'Fibra funcional con probióticos. Producto de tercero: contiene avena.',
       'unidad',
       90000,
       'Fibra funcional con probióticos',
       'no_disponible',
       'tercero',
       'Centro de Nutrición Integral Katherine Ruiz S.A.S.',
       s."id",
       0.19
  FROM "organizations" o
  CROSS JOIN "suppliers" s
 WHERE s."name" = 'Centro de Nutrición Integral Katherine Ruiz S.A.S.'
   AND NOT EXISTS (SELECT 1 FROM "nutraceuticals" WHERE "name" = 'LUVIA')
 LIMIT 1;--> statement-breakpoint

-- ── 3. SU ALERGENO DECLARADO ─────────────────────────────────────────────────────────────────────
--
-- AVENA, verbatim de la ficha del fabricante. Lo que eso IMPLICA (gluten, salvo certificacion) lo dice la
-- relacion, no esta fila: lo que el producto declara y lo que se deduce son dos cosas, y la primera no la
-- decidimos nosotros.
--
-- `absence_certified_for` va NULO: la ficha de LUVIA no dice "avena sin gluten certificada". Mientras siga
-- nulo, la relacion por contaminacion cruzada implica gluten, que es el tratamiento seguro.
INSERT INTO "nutraceutical_allergens" ("nutraceutical_id", "allergen_id", "declared_as", "notes")
SELECT n."id", a."id", 'avena',
       'Declarado en la ficha del fabricante. Sin certificación de ausencia de gluten, así que se trata como gluten.'
  FROM "nutraceuticals" n
  CROSS JOIN "allergens" a
 WHERE n."name" = 'LUVIA' AND a."code" = 'avena'
ON CONFLICT ("nutraceutical_id", "allergen_id") DO NOTHING;--> statement-breakpoint

-- ── 4. SU REPARTO ────────────────────────────────────────────────────────────────────────────────
--
-- SOLO LA PARTICIPACION DEL PROVEEDOR (0,70). La del Integrante sale de SU tasa y vale para todos los
-- productos; la de CNV es el residuo. Con el Integrante al 20%, a CNV le queda el 10%.
--
-- EL UMBRAL DE AVISO ES 0,10, y por eso es POR PRODUCTO: expresa como dato la decision de contabilidad de
-- aceptar ese 10% SOLO para el piloto. En cuanto una tasa de Integrante pase del 20%, el residuo cae por
-- debajo y avisa. Con un umbral global unico esto no se podria decir sin que todo producto propio avisara
-- tambien.
--
-- Y CON VIGENCIA DESDE HOY porque sabemos que se renegocia antes de un segundo lote: ese dia se añade una
-- fila, no se edita esta, que reescribiria lo ya liquidado.
INSERT INTO "revenue_splits" ("nutraceutical_id", "supplier_share", "margen_aviso", "valid_from", "note")
SELECT n."id", 0.70, 0.10, DATE '2026-09-11',
       'Reparto del piloto: proveedor 70%, Integrante su tasa, CNV el residuo (10% con la tasa actual). Contabilidad lo acepta SOLO para el piloto; se renegocia antes de un segundo lote.'
  FROM "nutraceuticals" n
 WHERE n."name" = 'LUVIA'
   AND NOT EXISTS (SELECT 1 FROM "revenue_splits" rs WHERE rs."nutraceutical_id" = n."id");
