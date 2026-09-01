-- DEFICIT CALORICO EDITABLE POR EL PROFESIONAL (cotejo visual 2026-09-01, aprobado por Santiago).
--
-- POR QUE AHORA Y NO ANTES. El campo existe en la pantalla de Gildardo y en Atlas no. Lo habiamos dejado
-- quieto a proposito el 2026-08-31, y la razon era buena mientras duro: el deficit sugerido tendria que
-- salir de algun motor, y CUAL motor manda las cifras caloricas es la pregunta abierta (P-32/P-35).
--
-- Lo que cambio: el valor del modelo es CERO para todos los pacientes desde que Gildardo retiro los cinco
-- deficits por fenotipo (2026-08-19), y su propio `motorTratNutri` tambien lo dejo en 0 el 26-ago ("el
-- gasto ya se calcula sobre el peso meta, que de por si es un objetivo con el descuento dentro; restar
-- ademas 500 aplicaba un segundo descuento"). Con los dos motores en 0, abrir el campo NO ELIGE DE QUE
-- MOTOR SALE NADA: el sugerido es 0 venga de donde venga, y lo que se agrega es la palanca del profesional
-- sobre ese 0. La pregunta del gasto sigue abierta y sin tocar.
--
-- SIN TECHO NI PISO, por su instruccion del 2026-08-27 §5: "ninguna cifra de la prescripcion nutricional
-- lleva techo, piso, validacion ni advertencia". El motor propone, el profesional dispone. Lo unico que
-- limita el resultado es el piso de 1.000 kcal que su propia cadena ya aplica al objetivo.

ALTER TABLE "treatments" ADD COLUMN "adj_deficit" integer;

COMMENT ON COLUMN "treatments"."adj_deficit" IS
  'Deficit calorico fijado por el profesional (kcal/dia). NULL = usar el del modelo (protocol_suggested.estrategia.deficit, hoy 0 para todos). Entra a la cadena como kcalObj = max(1000, GET - deficit). Sin techo ni piso propios (Gildardo 2026-08-27 §5).';
