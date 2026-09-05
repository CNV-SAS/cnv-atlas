-- LE8 ENCENDIDO: dieciseis campos pasan a ser INSUMO DEL DIAGNOSTICO (2026-09-05).
--
-- QUE CAMBIA, y por que no es un cambio de instrumento: NO se toca ni una pregunta, ni una opcion, ni
-- una respuesta. Solo se corrige la MARCA de que lee el motor (`used_in_diagnosis`), que es metadato.
--
-- POR QUE. Con `LE8_MAPEO_CORREGIDO` en `true` (instruccion de Direccion Cientifica del 2026-09-05,
-- decision del 2026-09-02), el dominio de Alimentacion del LE8 pasa a leer `calcPatron(enc).score` sobre
-- los quince grupos de frecuencia, y el de Hidratacion pasa a leer `d7_agua`. Los dieciseis campos
-- estaban marcados `used_in_diagnosis = false` porque hasta ayer solo alimentaban el DISPLAY del patron
-- y el motor de tratamiento.
--
-- LO QUE PASABA SI NO SE CORRIGE: `expected_field_keys` sale de esta columna, y contra ella se mide
-- `dfi.complete`. Un paciente que no respondiera la matriz recibiria un ICEC calculado sobre un score
-- fabricado (calcPatron sobre un enc vacio da 10, "Deficiente") y el sistema diria que los insumos del
-- diagnostico estan completos. Es exactamente el defecto que su CA-3 mando cerrar ("que distinga 'el
-- paciente respondio 0' de 'el paciente no respondio'"), reabierto por otra puerta.
--
-- ALCANCE DE VERSION, decidido explicitamente (Santiago, 2026-09-05): SOLO la v6, que es la vigente. Las
-- evaluaciones anteriores se emitieron bajo la declaracion de su propia version y se quedan con ella;
-- reescribirles la marca cambiaria retroactivamente contra que se midio su completitud.
--
-- FORWARD-ONLY: no se toca la 0099, que ya describe estas filas. Esta corrige una columna de esas mismas
-- filas. El seed ya quedo alineado (los quince grupos y d7_agua llevan `engine: true`), asi que una base
-- sembrada de cero nace correcta y esta migracion la deja igual.

UPDATE survey_questions
SET used_in_diagnosis = true
WHERE survey_version_id = '55555555-5555-5555-5555-555555555556'
  AND field_key IN (
    'd1_1_i', 'd1_2_i', 'd1_3_i', 'd1_4_i', 'd1_5_i',
    'd1_6_i', 'd1_7_i', 'd1_8_i', 'd1_9_i', 'd1_10_i',
    'd1_11_i', 'd1_12_i', 'd1_13_i', 'd1_14_i', 'd1_15_i',
    'd7_agua'
  );
