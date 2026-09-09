-- REGISTRO DERIVADO DEL MOTOR CONGELADO: los cuatro catalogos, al dia.
--
-- GENERADO por scripts/gen-registry-migration.mjs desde el motor congelado. NO editar a mano: el
-- motor es la fuente unica y esto se deriva de el. Editarlo aqui hace que los dos canales (local por
-- seed, nube por migracion) digan cosas distintas sin que nada de error, que es exactamente el
-- defecto que esta migracion viene a cerrar.
--
-- POR QUE EXISTE: hasta hoy estos cuatro catalogos SOLO los escribia supabase/seed.ts, cuyo atajo
-- lleva --env-file=.env.local dentro. Nunca hubo canal a la nube. Medido en la nube, en solo lectura,
-- antes de generar esto: 17 estados sin mecanismo y 20 sin biomarcadores (0 en local), y 6 de los 9
-- nombres de fr_sectors distintos, con el 1_1 diciendo lo CONTRARIO que el motor.
--
-- IDEMPOTENTE: todo es ON CONFLICT ... DO UPDATE sobre la clave natural. Aplicarla dos veces deja
-- exactamente lo mismo, y no borra ninguna fila.
--
-- NO TOCA NINGUN DIAGNOSTICO YA EMITIDO. El contenido del estado se SELLA en el snapshot al
-- diagnosticar (efrContent), y el snapshot es inmutable a proposito: corregir el catalogo no puede
-- reescribir lo que un profesional ya leyo. Los diagnosticos anteriores conservan su texto; los
-- nuevos salen del catalogo corregido.

-- ═══ ANTES ═══ Sale como NOTICE: visible en el editor SQL de Supabase (pestaña "Notices") y en psql.
-- Es contenido clinico, asi que hay que poder decir que habia y que quedo.
DO $$
DECLARE
  v_modelo uuid := '44444444-4444-4444-4444-444444444444';
  v_estados int; v_sin_mec int; v_sin_bio int; v_indic int; v_feno int; v_sect int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM model_versions WHERE id = v_modelo) THEN
    RAISE NOTICE 'ANTES · la version del modelo % no existe todavia: esta migracion la crea.', v_modelo;
  END IF;
  SELECT count(*) INTO v_estados FROM efr_states WHERE model_version_id = v_modelo;
  SELECT count(*) INTO v_sin_mec FROM efr_states WHERE model_version_id = v_modelo AND coalesce(btrim(mechanism), '') IN ('', '—');
  SELECT count(*) INTO v_sin_bio FROM efr_states WHERE model_version_id = v_modelo AND coalesce(btrim(biomarkers), '') IN ('', '—');
  SELECT count(*) INTO v_indic FROM indicator_definitions WHERE model_version_id = v_modelo;
  SELECT count(*) INTO v_feno FROM phenotypes WHERE model_version_id = v_modelo;
  SELECT count(*) INTO v_sect FROM fr_sectors WHERE model_version_id = v_modelo;
  RAISE NOTICE 'ANTES · efr_states: % de 81 (% sin mecanismo, % sin biomarcadores) | indicadores: % de 12 | fenotipos: % de 9 | sectores: % de 9', v_estados, v_sin_mec, v_sin_bio, v_indic, v_feno, v_sect;
END $$;

-- ── 0. model_versions (1): la fila de la que cuelgan los cuatro catalogos. ──
-- SE ACTUALIZA EN SITIO, y es seguro: los tres nombres de version (motor, modelo, reglas) se COPIAN al
-- snapshot al diagnosticar, asi que cambiar esta fila NO reescribe ningun diagnostico ya emitido.
INSERT INTO model_versions (id, version_name, rules_version, description, status) VALUES
  ('44444444-4444-4444-4444-444444444444', '1.0.0', '1.0.0', 'Modelo ANI-BIS-E portado del prototipo final de Gildardo (B11). Ciencia congelada en src/clinical-engine/frozen; los cortes viven en el motor.', 'active')
ON CONFLICT (id) DO UPDATE SET version_name = EXCLUDED.version_name, rules_version = EXCLUDED.rules_version, description = EXCLUDED.description, status = EXCLUDED.status;

-- ── 1. indicator_definitions (12): los nombres que Gildardo fijo, uno por indicador. ──
INSERT INTO indicator_definitions (model_version_id, code, name, unit) VALUES
  ('44444444-4444-4444-4444-444444444444', 'IFC', 'Índice de Función Celular', null),
  ('44444444-4444-4444-4444-444444444444', 'IRC', 'Índice de Riesgo Celular', null),
  ('44444444-4444-4444-4444-444444444444', 'PABU', 'Proporción Áurea Bioeléctrica de Uribe', null),
  ('44444444-4444-4444-4444-444444444444', 'ICA-BIS', 'Índice de Coherencia Áurea (BIS)', null),
  ('44444444-4444-4444-4444-444444444444', 'ISCM', 'Índice de Susceptibilidad Cardiometabólica', null),
  ('44444444-4444-4444-4444-444444444444', 'IEHH', 'Índice del Estado de Hidratación Humana', null),
  ('44444444-4444-4444-4444-444444444444', 'IAE', 'Índice de Aceleración del Envejecimiento', 'años'),
  ('44444444-4444-4444-4444-444444444444', 'EB', 'Edad Bioeléctrica (EB-BIS)', 'años'),
  ('44444444-4444-4444-4444-444444444444', 'FMI', 'Índice de Masa Grasa', 'kg/m2'),
  ('44444444-4444-4444-4444-444444444444', 'FFMI', 'Índice de Masa Libre de Grasa', 'kg/m2'),
  ('44444444-4444-4444-4444-444444444444', 'AF', 'Ángulo de Fase a 50 kHz', 'grados'),
  ('44444444-4444-4444-4444-444444444444', 'IR', 'Radio de impedancia', null)
ON CONFLICT (model_version_id, code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit;

-- ── 2. phenotypes (9): fenotipo estructural FFMI x FMI, por clave de banda "A_B". ──
INSERT INTO phenotypes (model_version_id, code, name) VALUES
  ('44444444-4444-4444-4444-444444444444', 'A_B', 'Fenotipo atlético magro'),
  ('44444444-4444-4444-4444-444444444444', 'A_N', 'Composición corporal saludable'),
  ('44444444-4444-4444-4444-444444444444', 'A_A', 'Sobrepeso adiposo con masa conservada'),
  ('44444444-4444-4444-4444-444444444444', 'N_B', 'Delgado funcional'),
  ('44444444-4444-4444-4444-444444444444', 'N_N', 'Composición corporal saludable'),
  ('44444444-4444-4444-4444-444444444444', 'N_A', 'Fenotipo fuerte–adiposo'),
  ('44444444-4444-4444-4444-444444444444', 'B_B', 'Caquexia / Desnutrición proteico-energética'),
  ('44444444-4444-4444-4444-444444444444', 'B_N', 'Obesidad sarcopénica oculta'),
  ('44444444-4444-4444-4444-444444444444', 'B_A', 'Obesidad sarcopénica (SMM/Peso↓ + FMI↑)')
ON CONFLICT (model_version_id, code) DO UPDATE SET name = EXCLUDED.name;

-- ── 3. fr_sectors (9): sector funcional IFC x IRC. Es el catalogo que decia lo contrario. ──
INSERT INTO fr_sectors (model_version_id, code, name) VALUES
  ('44444444-4444-4444-4444-444444444444', '3_1', 'Estado celular óptimo'),
  ('44444444-4444-4444-4444-444444444444', '3_2', 'Estado fisiológico estable'),
  ('44444444-4444-4444-4444-444444444444', '3_3', 'Función normal con riesgo'),
  ('44444444-4444-4444-4444-444444444444', '2_1', 'Función con bajo riesgo'),
  ('44444444-4444-4444-4444-444444444444', '2_2', 'Función sin riesgo'),
  ('44444444-4444-4444-4444-444444444444', '2_3', 'Función con riesgo'),
  ('44444444-4444-4444-4444-444444444444', '1_1', 'Disfunción con bajo riesgo'),
  ('44444444-4444-4444-4444-444444444444', '1_2', 'Disfunción sin riesgo'),
  ('44444444-4444-4444-4444-444444444444', '1_3', 'Estado crítico')
ON CONFLICT (model_version_id, code) DO UPDATE SET name = EXCLUDED.name;

-- ── 4. efr_states (81): los cinco campos clinicos de cada estado de la Diana. ──
-- LA CLAVE DEL UPSERT ES (model_version_id, state_number), que es como el seed y el lector los
-- identifican. Las bandas van en el SET y no en la clave porque son parte de la fila.
INSERT INTO efr_states (model_version_id, state_number, ifc_band, irc_band, ffmi_band, fmi_band, diagnosis_name, mechanism, biomarkers, risks, suggested_nutraceuticals) VALUES
  ('44444444-4444-4444-4444-444444444444', 1, 3, 1, 3, 1, 'Atleta con grasa y baja IRC → buen pronóstico', 'Homeostasis celular y metabólica conservada.', 'Biomarcadores dentro del rango esperado.', 'Mantener', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 2, 3, 1, 3, 2, 'Fuerte-adiposo con baja inflamación → riesgo menor', 'Homeostasis celular y metabólica conservada.', 'Biomarcadores dentro del rango esperado.', 'Intervención electiva', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 3, 3, 1, 2, 1, 'Atlético magro con IFC alto y baja IRC → estado celular óptimo', 'Homeostasis celular y metabólica conservada.', 'Biomarcadores dentro del rango esperado.', 'Mantener', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 4, 3, 1, 2, 2, 'Composición y función óptimas, baja inflamación → estado celular ideal', 'Homeostasis celular y metabólica conservada.', 'Biomarcadores dentro del rango esperado.', 'Mantener', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 5, 3, 1, 3, 3, 'Atleta con grasa pero baja IRC → mejor pronóstico que con IRC alto', 'Lipotoxicidad y desregulación de adipoquinas.', 'HOMA-IR elevado, glucemia y perfil lipídico alterados.', 'Reducir grasa por rendimiento', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 6, 3, 1, 2, 3, 'Alta función y baja IRC con grasa alta → riesgo controlable', 'Lipotoxicidad y desregulación de adipoquinas.', 'HOMA-IR elevado, glucemia y perfil lipídico alterados.', 'Reducir grasa si visceral', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 7, 3, 1, 1, 1, 'Atlético magro óptimo → mínimo riesgo', 'Depleción de la reserva proteica y muscular.', 'Creatinina/índice muscular bajos.', 'Mantener', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 8, 3, 1, 1, 2, 'Atlético magro con IFC alto y baja IRC → excelente resiliencia', 'Depleción de la reserva proteica y muscular.', 'Creatinina/índice muscular bajos.', 'Mantener', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 9, 3, 1, 1, 3, 'Atlético magro con grasa alta y baja IRC → riesgo bajo-moderado', 'Depleción de la reserva proteica y muscular; lipotoxicidad y desregulación de adipoquinas.', 'HOMA-IR elevado, glucemia y perfil lipídico alterados; creatinina/índice muscular bajos.', 'Evaluar distribución grasa', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 10, 3, 2, 3, 1, 'Alta función con grasa alta y baja IRC → mejor pronóstico', 'Homeostasis celular y metabólica conservada.', 'Biomarcadores dentro del rango esperado.', 'Intervención electiva', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 11, 3, 2, 3, 2, 'Fuerte-adiposo con IFC alto → buen pronóstico funcional', 'Masa magra protege', 'Biomarcadores dentro del rango esperado.', 'Reducir grasa visceral', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 12, 3, 2, 2, 1, 'Atlético magro con IFC alto → rendimiento y salud óptimos', 'Homeostasis celular y metabólica conservada.', 'Biomarcadores dentro del rango esperado.', 'Mantener', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 13, 3, 2, 2, 2, 'Función óptima y composición normal → excelente pronóstico', 'Homeostasis', 'Biomarcadores dentro del rango esperado.', 'Mantener', 'MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 14, 3, 2, 3, 3, 'Atleta con grasa y IRC normal → riesgo moderado', 'Si visceral alto, riesgo', 'HOMA‑IR variable', 'Reducir grasa', 'BERBERINA METABO, MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 15, 3, 2, 2, 3, 'Alta función con grasa alta → vigilar visceralidad', 'Lipotoxicidad y desregulación de adipoquinas.', 'HOMA-IR elevado, glucemia y perfil lipídico alterados.', 'Reducir grasa si visceral', 'BERBERINA METABO, MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 16, 3, 2, 1, 1, 'Atlético magro óptimo → máximo rendimiento y baja morbilidad', 'Depleción de la reserva proteica y muscular.', 'Creatinina/índice muscular bajos.', 'Mantener', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 17, 3, 2, 1, 2, 'Atlético magro con IFC alto → ideal para resistencia', 'Depleción de la reserva proteica y muscular.', 'Creatinina/índice muscular bajos.', 'Mantener', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 18, 3, 2, 1, 3, 'Atlético magro con grasa alta → riesgo según visceralidad', 'Depleción de la reserva proteica y muscular; lipotoxicidad y desregulación de adipoquinas.', 'HOMA-IR elevado, glucemia y perfil lipídico alterados; creatinina/índice muscular bajos.', 'Evaluar cintura', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 19, 2, 1, 3, 1, 'Adiposo con baja IRC y baja grasa → bajo riesgo', 'Buen pronóstico', 'Biomarcadores dentro del rango esperado.', 'Mantener', 'MULTI-CELL BASE, OMEGA COMPLEX, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 20, 2, 1, 3, 2, 'Adiposo con baja IRC → buena ventana de intervención', 'Intervención dietética', 'Biomarcadores controlables', 'Buena respuesta', 'MULTI-CELL BASE, OMEGA COMPLEX, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 21, 2, 1, 2, 1, 'Magro con baja IRC → excelente pronóstico', 'Homeostasis celular y metabólica conservada.', 'Biomarcadores dentro del rango esperado.', 'Mantener', 'MULTI-CELL BASE, OMEGA COMPLEX, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 22, 2, 1, 2, 2, 'Salud metabólica estable → bajo riesgo', 'Homeostasis', 'Biomarcadores dentro del rango esperado.', 'Mantener', 'MULTI-CELL BASE, OMEGA COMPLEX, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 23, 2, 1, 3, 3, 'Adiposo sin inflamación → riesgo metabólico menor pero presente', 'Menor inflamación sistémica', 'PCR normal', 'Reducir grasa visceral', 'MULTI-CELL BASE, OMEGA COMPLEX, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 24, 2, 1, 2, 3, 'Síndrome metabólico, resistencia a la insulina, DM2, hígado graso metabólico, dislipidemia.', 'Lipotoxicidad y desregulación de adipoquinas.', 'HOMA-IR elevado, glucemia y perfil lipídico alterados.', 'Progresión hacia anillos/radios externos de la diana con deterioro funcional y complicaciones cardiometabólicas.', 'MULTI-CELL BASE, OMEGA COMPLEX, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 25, 2, 1, 1, 1, 'Sarcopenia, desnutrición proteico-energética, fragilidad.', 'Depleción de la reserva proteica y muscular.', 'Creatinina/índice muscular bajos.', 'Progresión hacia anillos/radios externos de la diana con deterioro funcional.', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 26, 2, 1, 1, 2, 'Sarcopenia, desnutrición proteico-energética, fragilidad.', 'Depleción de la reserva proteica y muscular.', 'Creatinina/índice muscular bajos.', 'Progresión hacia anillos/radios externos de la diana con deterioro funcional.', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 27, 2, 1, 1, 3, 'Obesidad sarcopénica; síndrome metabólico, resistencia a la insulina, DM2, hígado graso metabólico, dislipidemia.', 'Depleción de la reserva proteica y muscular; lipotoxicidad y desregulación de adipoquinas.', 'HOMA-IR elevado, glucemia y perfil lipídico alterados; creatinina/índice muscular bajos.', 'Progresión hacia anillos/radios externos de la diana con deterioro funcional y complicaciones cardiometabólicas.', 'SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 28, 2, 2, 3, 1, 'Adiposo con función normal y baja grasa → riesgo menor', 'Menor riesgo si visceral bajo', 'Biomarcadores normales', 'Mantenimiento', 'OMEGA COMPLEX, MULTI-CELL BASE, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 29, 2, 2, 3, 2, 'Adiposo subclínico con reserva → prevención eficaz', 'Lipotoxicidad moderada', 'HOMA‑IR variable', 'Intervención nutricional', 'OMEGA COMPLEX, MULTI-CELL BASE, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 30, 2, 2, 2, 1, 'Funcional magro → buen pronóstico', 'Buena calidad muscular', 'IFC normal', 'Mantener ingesta', 'OMEGA COMPLEX, MULTI-CELL BASE, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 31, 2, 2, 2, 2, 'Composición corporal saludable → bajo riesgo', 'Homeostasis metabólica', 'Biomarcadores normales', 'Mantenimiento preventivo', 'OMEGA COMPLEX, MULTI-CELL BASE, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 32, 2, 2, 3, 3, 'Fuerte-adiposo subclínico → riesgo metabólico moderado', 'Adiposidad visceral, inflamación moderada', 'HOMA‑IR↑, TG↑', 'DM2, ECV si no se corrige', 'BERBERINA METABO, OMEGA COMPLEX, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 33, 2, 2, 2, 3, 'Composición saludable con grasa alta → riesgo de progresión', 'Depende de distribución grasa', 'HOMA‑IR variable', 'Vigilancia', 'BERBERINA METABO, OMEGA COMPLEX, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 34, 2, 2, 1, 1, 'Sarcopenia, desnutrición proteico-energética, fragilidad.', 'Depleción de la reserva proteica y muscular.', 'Creatinina/índice muscular bajos.', 'Progresión hacia anillos/radios externos de la diana con deterioro funcional.', 'SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 35, 2, 2, 1, 2, 'Sarcopenia, desnutrición proteico-energética, fragilidad.', 'Depleción de la reserva proteica y muscular.', 'Creatinina/índice muscular bajos.', 'Progresión hacia anillos/radios externos de la diana con deterioro funcional.', 'SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 36, 2, 2, 1, 3, 'Atlético magro con grasa alta → riesgo según visceralidad', 'Si visceral bajo, riesgo menor', 'Medir cintura', 'Ajustes dietéticos', 'SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 37, 3, 3, 3, 1, 'Alta función con inflamación y baja grasa → estrés sistémico', 'Inflamación no por grasa; investigar causas', 'PCR↑', 'Riesgo de catabolismo', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 38, 3, 3, 3, 2, 'Fuerte-adiposo con alta función e IRC alto → riesgo metabólico', 'Adiposidad visceral + inflamación', 'HOMA‑IR↑', 'Vigilancia y reducción grasa', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 39, 3, 3, 2, 1, 'Alta función, IRC alto, baja grasa → estrés por sobreentreno o inflamación no metabólica', 'Cortisol elevado, inflamación', 'Cortisol↑, PCR↑', 'Ajustar carga', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 40, 3, 3, 2, 2, 'Función óptima con IRC alto → riesgo inflamación crónica', 'Inflamación limita longevidad celular', 'PCR↑', 'Reducir IRC', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 41, 3, 3, 3, 3, 'Atleta adiposo con inflamación → riesgo CV a largo plazo', 'Inflamación crónica pese a alta función', 'PCR↑, HOMA‑IR↑', 'Riesgo de ECV, DM2', 'BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV'),
  ('44444444-4444-4444-4444-444444444444', 42, 3, 3, 2, 3, 'Alta función con grasa alta e IRC alto → riesgo metabólico', 'Adiposidad visceral', 'HOMA‑IR↑', 'Intervención necesaria', 'BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV'),
  ('44444444-4444-4444-4444-444444444444', 43, 3, 3, 1, 1, 'Atleta óptimo con IRC alto → investigar fuente inflamatoria', 'Posible infección crónica o autoinmunidad', 'PCR↑, autoanticuerpos', 'Tratar causa', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, SARCO-PROTECT, D3-K2 OSTEO'),
  ('44444444-4444-4444-4444-444444444444', 44, 3, 3, 1, 2, 'Alta función con IRC alto → vigilancia', 'Expansión del compartimento extracelular e inflamación de bajo grado; depleción de la reserva proteica y muscular.', 'PCR↑', 'Ajustes recuperación', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, SARCO-PROTECT, D3-K2 OSTEO'),
  ('44444444-4444-4444-4444-444444444444', 45, 3, 3, 1, 3, 'Magro con alta función pero IRC alto → riesgo catabolismo por estrés', 'Eje HPA activado, inflamación', 'Cortisol↑, PCR↑', 'Reducir estrés', 'BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV'),
  ('44444444-4444-4444-4444-444444444444', 46, 2, 3, 3, 1, 'Alta función pero inflamación y baja reserva → descompensación rápida', 'Inflamación limita respuesta al estrés', 'PCR↑, IFC normal', 'Riesgo fallo funcional ante estrés', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 47, 2, 3, 3, 2, 'Adiposo inflamatorio con reserva → progresión a DM2', 'Adipocinas proinflamatorias', 'HOMA‑IR↑, PCR↑', 'Riesgo CV aumentado', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 48, 2, 3, 2, 1, 'Función normal con inflamación y baja grasa → riesgo catabolismo', 'Inflamación favorece catabolismo', 'PCR↑, albúmina↓', 'Pérdida de masa si persiste', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 49, 2, 3, 2, 2, 'Función normal con inflamación → riesgo de deterioro', 'Inflamación crónica', 'PCR↑', 'Vigilancia y reducción de IRC', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 50, 2, 3, 3, 3, 'Fuerte-adiposo con inflamación → alto riesgo cardiometabólico', 'Inflamación crónica, estrés oxidativo, RI', 'PCR↑, HOMA‑IR↑, TG↑', 'DM2, ECV, esteatohepatitis', 'BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV, HEPA-DETOX'),
  ('44444444-4444-4444-4444-444444444444', 51, 2, 3, 2, 3, 'Composición saludable comprometida por inflamación → DM2 emergente', 'Inflamación sistémica', 'HOMA‑IR↑, PCR↑', 'Progresión metabólica', 'BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV, HEPA-DETOX'),
  ('44444444-4444-4444-4444-444444444444', 52, 2, 3, 1, 1, 'Magro inflamado sin grasa → posible enfermedad inflamatoria sistémica', 'Inflamación no metabólica', 'PCR↑', 'Pérdida funcional', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, SARCO-PROTECT, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 53, 2, 3, 1, 2, 'Función normal pero inflamación y baja reserva → riesgo deterioro', 'Inflamación', 'PCR↑', 'Intervención temprana', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, SARCO-PROTECT, MITO-Q10 PLUS'),
  ('44444444-4444-4444-4444-444444444444', 54, 2, 3, 1, 3, 'Magro con inflamación y grasa → obesidad sarcopénica emergente', 'Lipotoxicidad + inflamación', 'HOMA‑IR↑, PCR↑', 'Pérdida funcional acelerada', 'BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV, HEPA-DETOX'),
  ('44444444-4444-4444-4444-444444444444', 55, 1, 1, 3, 1, 'Disfunción celular con riesgo nutricional.', 'Alteración de membrana y bomba Na⁺-K⁺-ATPasa (pérdida de integridad celular).', 'Albúmina/prealbúmina bajas, ángulo de fase reducido.', 'Progresión hacia anillos/radios externos de la diana con deterioro funcional.', 'MITO-Q10 PLUS, MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 56, 1, 1, 3, 2, 'Adiposo con IFC bajo y IRC bajo → riesgo subclínico', 'Disfunción celular temprana sin inflamación sistémica', 'IFC↓, HOMA‑IR variable', 'Deterioro gradual', 'MITO-Q10 PLUS, MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 57, 1, 1, 2, 1, 'Baja función y baja IRC → ventana de recuperación', 'Déficit reversible con nutrición y entrenamiento', 'IFC↓, PCR normal', 'Recuperación posible si se actúa', 'MITO-Q10 PLUS, SARCO-PROTECT, MULTI-CELL BASE, D3-K2 OSTEO'),
  ('44444444-4444-4444-4444-444444444444', 58, 1, 1, 2, 2, 'IFC bajo con IRC bajo → riesgo moderado', 'Disfunción celular temprana', 'IFC↓', 'Prevención eficaz', 'MITO-Q10 PLUS, MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 59, 1, 1, 3, 3, 'Masa magra alta pero IFC bajo → myosteatosis silenciosa', 'Calidad muscular pobre pese a cantidad', 'Ángulo de fase↓, marcadores oxidativos↑', 'Riesgo lesión y disfunción metabólica', 'BERBERINA METABO, MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 60, 1, 1, 2, 3, 'IFC bajo con grasa alta → riesgo metabólico oculto', 'Lipotoxicidad local', 'HOMA‑IR↑', 'Progresión si no se corrige', 'BERBERINA METABO, MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 61, 1, 1, 1, 1, 'Desnutrición severa sin inflamación → riesgo fallo por inanición', 'Deficiencias proteicas y energéticas', 'Albúmina muy baja, electrolitos alterados', 'Falla orgánica si no se corrige', 'SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE, OMEGA COMPLEX, GUT-IMMUNE PRO'),
  ('44444444-4444-4444-4444-444444444444', 62, 1, 1, 1, 2, 'Déficit proteico con baja inflamación → recuperación posible', 'Déficit proteico', 'Albúmina↓', 'Rehabilitación nutricional necesaria', 'SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 63, 1, 1, 1, 3, 'Obesidad con IFC bajo pero IRC bajo → riesgo oculto de progresión', 'Inflamación no detectada por IRC pero IFC indica daño celular', 'IFC↓, PCR puede ser normal', 'Progresión silenciosa a DM2', 'BERBERINA METABO, MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 64, 1, 2, 3, 1, 'Músculo presente pero IFC bajo → riesgo pérdida funcional', 'Myosteatosis incipiente', 'Ángulo de fase↓, PCR↑', 'Vulnerabilidad funcional', 'MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 65, 1, 2, 3, 2, 'Reserva magra con IFC bajo → riesgo catabolismo si aumenta carga', 'Inflamación inducida por adiposidad; anabolismo limitado', 'PCR↑, HOMA‑IR↑', 'Pérdida de masa funcional con el tiempo', 'MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 66, 1, 2, 2, 1, 'Fragilidad con baja grasa → riesgo pérdida funcional', 'Déficit energético relativo', 'Albúmina↓, IFC↓', 'Caídas de rendimiento', 'MITO-Q10 PLUS, MULTI-CELL BASE, OMEGA COMPLEX, ADAPTO-STRESS'),
  ('44444444-4444-4444-4444-444444444444', 67, 1, 2, 2, 2, 'Disfunción celular con reserva moderada → riesgo de deterioro si persiste', 'Alteración en señalización anabólica; inflamación baja', 'PCR normal‑alto, ángulo de fase↓', 'Pérdida funcional gradual', 'MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 68, 1, 2, 3, 3, 'Fuerte-adiposo con IFC bajo → myosteatosis y riesgo CV', 'Adipocinas proinflamatorias + pérdida calidad muscular', 'PCR↑, adiponectina↓, TG↑', 'Enfermedad coronaria, disminución de fuerza', 'BERBERINA METABO, OMEGA COMPLEX, MITO-Q10 PLUS, HEPA-DETOX'),
  ('44444444-4444-4444-4444-444444444444', 69, 1, 2, 2, 3, 'Adiposo subclínico con IFC bajo → RI emergente', 'Disfunción mitocondrial y señalización anabólica reducida', 'HOMA‑IR↑, PCR leve, ángulo de fase↓', 'Progresión a síndrome metabólico si no se corrige', 'BERBERINA METABO, OMEGA COMPLEX, MITO-Q10 PLUS, HEPA-DETOX'),
  ('44444444-4444-4444-4444-444444444444', 70, 1, 2, 1, 1, 'Desnutrición funcional → alto riesgo de complicaciones', 'Deficiencia energética y proteica; inmunidad comprometida', 'Albúmina muy baja, linfopenia', 'Infecciones, pobre cicatrización', 'SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 71, 1, 2, 1, 2, 'Déficit funcional moderado → fragilidad metabólica', 'Baja síntesis proteica, menor capacidad de respuesta anabólica', 'Albúmina↓, IFC↓', 'Vulnerabilidad ante estrés', 'MITO-Q10 PLUS, SARCO-PROTECT, MULTI-CELL BASE, D3-K2 OSTEO, OMEGA COMPLEX'),
  ('44444444-4444-4444-4444-444444444444', 72, 1, 2, 1, 3, 'Obesidad con disfunción celular moderada → riesgo DM2 y esteatohepatitis', 'Lipotoxicidad, estrés ER, inflamación moderada', 'ALT/AST↑, HOMA‑IR↑, PCR moderada', 'Esteatosis hepática, progresión metabólica', 'BERBERINA METABO, OMEGA COMPLEX, MITO-Q10 PLUS, SARCO-PROTECT, HEPA-DETOX'),
  ('44444444-4444-4444-4444-444444444444', 73, 1, 3, 3, 1, 'Músculo presente pero disfuncional por inflamación → rendimiento engañoso', 'Myosteatosis y disfunción mitocondrial; anabolismo bloqueado', 'Ángulo de fase↓, PCR↑, CK anómalo', 'Caídas de rendimiento súbitas; lesión por sobreuso', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 74, 1, 3, 3, 2, 'Reserva magra con inflamación → rendimiento aparente pero riesgo metabólico', 'Inflamación limita anabolismo; mitocondrias disfuncionales', 'PCR↑, CK variable, marcadores oxidativos↑', 'Riesgo lesión y pérdida calidad muscular', 'OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 75, 1, 3, 2, 1, 'Fragilidad con inflamación y baja grasa → riesgo infección y pobre cicatrización', 'Déficit energético + inflamación; inmunosupresión funcional', 'Linfopenia relativa, albúmina↓, PCR↑', 'Infecciones, mala recuperación', 'OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, MULTI-CELL BASE, ADAPTO-STRESS'),
  ('44444444-4444-4444-4444-444444444444', 76, 1, 3, 2, 2, 'Adiposo inflamatorio con reserva moderada → riesgo progresión DM2', 'Inflamación sistémica reduce señalización insulina y mTOR', 'PCR↑, HOMA‑IR↑, ángulo de fase↓', 'Pérdida funcional gradual, mayor riesgo lesión', 'OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 77, 1, 3, 3, 3, 'Fuerte-adiposo con disfunción → cardiometabolismo adverso pese a masa magra', 'Myosteatosis + adipocito inflamatorio; adipokinas proinflamatorias; anabolismo bloqueado', 'PCR↑, adiponectina↓, RI, marcadores daño muscular', 'Enfermedad coronaria, disfunción metabólica oculta', 'BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, HEPA-DETOX'),
  ('44444444-4444-4444-4444-444444444444', 78, 1, 3, 2, 3, 'Obesidad sarcopénica avanzada → progresión a DM2 y ECV', 'Estrés oxidativo mitocondrial, disfunción mitocondrial muscular, RI', 'PCR↑, TG↑, glucosa ayunas↑, ángulo de fase↓', 'Insuficiencia funcional progresiva; mayor riesgo eventos CV', 'OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, BERBERINA METABO, HEPA-DETOX'),
  ('44444444-4444-4444-4444-444444444444', 79, 1, 3, 1, 1, 'Desnutrición inflamatoria → fallo funcional agudo', 'Catabolismo extremo, baja síntesis proteica, hipometabolismo celular', 'Albúmina muy baja, PCR↑, electrolitos alterados', 'Hospitalización, infección, falla orgánica', 'OMEGA COMPLEX, MITO-Q10 PLUS, SARCO-PROTECT, CURCUMIN BIOACTIV, MULTI-CELL BASE, D3-K2 OSTEO'),
  ('44444444-4444-4444-4444-444444444444', 80, 1, 3, 1, 2, 'Déficit funcional inflamatorio → fragilidad con inflamación', 'Catabolismo proteico por citoquinas; pérdida síntesis proteica; alteración permeabilidad membrana', 'Albúmina↓, PCR↑, creatinina relativa↑, IFC↓', 'Fragilidad, pobre recuperación ante estrés/infección', 'OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, SARCO-PROTECT, MULTI-CELL BASE'),
  ('44444444-4444-4444-4444-444444444444', 81, 1, 3, 1, 3, 'Obesidad sarcopénica clínica → síndrome metabólico, DM2, insuficiencia funcional', 'Inflamación crónica (TNFα, IL‑6), RI, lipotoxicidad, myosteatosis, pérdida síntesis proteica', 'PCR↑, HOMA‑IR↑, CK variable, ferritina↑, albúmina↓, IFC↓', 'Alta mortalidad cardiometabólica; caídas; incapacidad funcional', 'OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, BERBERINA METABO, SARCO-PROTECT, HEPA-DETOX')
ON CONFLICT (model_version_id, state_number) DO UPDATE SET
  ifc_band = EXCLUDED.ifc_band, irc_band = EXCLUDED.irc_band,
  ffmi_band = EXCLUDED.ffmi_band, fmi_band = EXCLUDED.fmi_band,
  diagnosis_name = EXCLUDED.diagnosis_name, mechanism = EXCLUDED.mechanism,
  biomarkers = EXCLUDED.biomarkers, risks = EXCLUDED.risks,
  suggested_nutraceuticals = EXCLUDED.suggested_nutraceuticals;

-- ═══ DESPUES ═══
DO $$
DECLARE
  v_modelo uuid := '44444444-4444-4444-4444-444444444444';
  v_estados int; v_sin_mec int; v_sin_bio int; v_indic int; v_feno int; v_sect int;
BEGIN
  SELECT count(*) INTO v_estados FROM efr_states WHERE model_version_id = v_modelo;
  SELECT count(*) INTO v_sin_mec FROM efr_states WHERE model_version_id = v_modelo AND coalesce(btrim(mechanism), '') IN ('', '—');
  SELECT count(*) INTO v_sin_bio FROM efr_states WHERE model_version_id = v_modelo AND coalesce(btrim(biomarkers), '') IN ('', '—');
  SELECT count(*) INTO v_indic FROM indicator_definitions WHERE model_version_id = v_modelo;
  SELECT count(*) INTO v_feno FROM phenotypes WHERE model_version_id = v_modelo;
  SELECT count(*) INTO v_sect FROM fr_sectors WHERE model_version_id = v_modelo;
  RAISE NOTICE 'DESPUES · efr_states: % de 81 (% sin mecanismo, % sin biomarcadores) | indicadores: % de 12 | fenotipos: % de 9 | sectores: % de 9', v_estados, v_sin_mec, v_sin_bio, v_indic, v_feno, v_sect;
  IF v_estados <> 81 OR v_indic <> 12 OR v_feno <> 9 OR v_sect <> 9 THEN
    RAISE EXCEPTION 'El registro quedo incompleto: % estados, % indicadores, % fenotipos, % sectores.', v_estados, v_indic, v_feno, v_sect;
  END IF;
  IF v_sin_mec > 0 OR v_sin_bio > 0 THEN
    RAISE NOTICE 'Quedan % estados sin mecanismo y % sin biomarcadores. Si el motor los trae vacios eso es SU contenido, no un fallo de esta migracion.', v_sin_mec, v_sin_bio;
  END IF;
END $$;

-- 81 estados, 12 indicadores, 9 fenotipos, 9 sectores.
