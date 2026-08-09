-- Remesa (E2), guarda de confirmación única. Una remesa se confirma con UNA recepción: si dos recepciones
-- pudieran ligarse a la misma remesa, el saldo subiría dos veces (cada recepción es +N). El índice único
-- parcial lo impide a nivel de BD (además del guard en el dominio, defensa en profundidad; misma disciplina
-- que el índice parcial del link base de encuesta). No afecta las recepciones NO respaldadas (remesa_id NULL).
CREATE UNIQUE INDEX "nutra_movements_one_recepcion_per_remesa"
  ON "nutraceutical_stock_movements" (remesa_id)
  WHERE remesa_id IS NOT NULL;
