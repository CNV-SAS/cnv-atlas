-- DATA-MIGRATION: los seis nutraceuticos que no existen pasan de 'solo_tienda' a 'no_disponible'.
--
-- Hallazgo del cotejo (Santiago, 2026-08-24): el catalogo decia "solo en tienda" para seis productos, y
-- el texto de la pantalla explica que eso significa "el paciente lo compra en la tienda de CNV". Pero
-- HOY SOLO EXISTEN CUATRO REFERENCIAS REALES, y son justamente las que los profesionales llevan en
-- consignacion. Los otros seis no estan ni en consultorio ni en tienda: no existen todavia.
--
-- Por que importa y no es cosmetico: un profesional puede PRESCRIBIR un producto creyendo que su paciente
-- lo puede comprar, y el paciente se va con una indicacion que no puede cumplir.
--
-- DEFENSIVA: acota por NOMBRE a los seis, no por estado. Si alguien ya corrigio alguno a mano, o si la
-- tienda empieza a vender uno de verdad y lo marcaron 'solo_tienda' a proposito, el WHERE del estado lo
-- volveria a bajar; acotar por nombre hace que esta migracion diga exactamente que toca. Idempotente.
UPDATE "nutraceuticals"
SET "commercial_availability" = 'no_disponible'
WHERE "commercial_availability" = 'solo_tienda'
  AND "name" IN (
    'BERBERINA METABO',
    'MITO-Q10 PLUS',
    'HEPA-DETOX',
    'ADAPTO-STRESS',
    'SARCO-PROTECT',
    'GUT-IMMUNE PRO'
  );
