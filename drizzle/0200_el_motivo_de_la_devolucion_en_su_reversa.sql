-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL MOTIVO DE LA DEVOLUCION, DONDE LA PANTALLA LO BUSCA
--
-- LO QUE PASO (Santiago, 2026-09-30): el agregado de Direccion mostraba "Devolución de 1 de 2 unidades de la
-- línea" bajo el titulo de POR QUE, y yo dije que el formulario no pedia motivo. SI LO PIDE, y con cinco
-- letras minimo: lo que pasaba es que el motivo se guardaba en el MOVIMIENTO de inventario
-- (`nutraceutical_stock_movements.reason`) y en el log de auditoria, y la reversa se quedaba con una frase
-- compuesta por el codigo.
--
-- Es exactamente la misma forma del defecto de la nota credito del mismo dia: EL DATO ESTA Y LA PANTALLA DICE
-- OTRA COSA. Y la conclusion equivocada es peor que el hueco, porque lleva a construir lo que ya existe.
--
-- El writer ya guarda el motivo en la reversa. Esto recupera los que ya se escribieron, que si no quedarian
-- invisibles para siempre en la unica pantalla que los agrupa.
--
-- ── POR QUE SE PUEDE Y NO ES REESCRIBIR LA HISTORIA ──
--
-- No se inventa nada: el motivo se copia del movimiento que la MISMA transaccion creo, atado por la linea de
-- venta. Es el mismo hecho, escrito por la misma persona, en el mismo instante.
--
-- Y SOLO SE TOCAN LAS QUE TIENEN LA FRASE AUTOMATICA: si alguna reversa de devolucion llegara a tener una nota
-- escrita a mano (hoy no las hay, pero el filtro no cuesta nada), se deja como esta. Una migracion que pisa
-- texto que no compuso el codigo es una migracion que borra trabajo de alguien.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

UPDATE "sale_reversals" r
   SET "note" = m."reason"
  FROM "nutraceutical_stock_movements" m
 WHERE m."transaction_item_id" = r."transaction_item_id"
   AND m."type" = 'devolucion_paciente'
   AND m."reason" IS NOT NULL
   AND btrim(m."reason") <> ''
   AND r."kind" = 'devolucion'
   AND r."note" LIKE 'Devolución de % unidades de la línea.';
