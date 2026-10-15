-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- "OPERACION REAL": UNA SOLA DEFINICION, EN LA BASE  ·  0219
--
-- ═══ DE DONDE SALE (Santiago, 2026-10-15) ═══
--
-- Textual suyo: *"el nucleo de CNV es la data, que puede que en algun futuro la vendamos. Atlas es el creador
-- de esa data y entre mas facil sea acceder, organizar y cumplir con la calidad, mejor."*
--
-- Y EL RIESGO QUE NOMBRO ES EL CORRECTO: consultar data limpia son DOS condiciones (no marcada como prueba Y
-- posterior a la fecha de arranque), y si cada consulta las repite a mano, tarde o temprano una se olvida y la
-- cifra sale mal sin que nadie lo note. Es la misma forma que ya costo dos veces este mes (las 1.903 unidades
-- contra las 1.820; la venta devuelta que salia de un bruto y no del otro).
--
-- ═══ LO QUE ESTA VISTA ES, Y LO QUE DELIBERADAMENTE NO ES ═══
--
-- ES para quien CONSULTA LA BASE: una consulta analitica, una exportacion, un informe. Ahi no hay candado ni
-- revision de codigo, y es justo donde una condicion olvidada no la atrapa nadie.
--
-- NO ES para las PANTALLAS. Las catorce que leen `cuenta_como_de_prueba` y las que recortan por
-- `fecha_de_arranque` siguen como estan, cada una con su candado, porque ahi la frontera no es la misma para
-- todas: la fecha recorta las cifras de RESUMEN y NO lo que se le debe a alguien ni el inventario (ver
-- `fecha-de-arranque.ts`). Meterlas todas en una vista habria metido la fecha donde no va.
--
-- ═══ Y UNA CORRECCION AL ENUNCIADO, QUE IMPORTA MAS QUE LA VISTA ═══
--
-- LAS DOS CONDICIONES SON DE LO COMERCIAL. La data CLINICA tiene UNA SOLA: no ser de prueba. Una consulta del
-- 2 de octubre es una consulta de verdad, con su medicion y su diagnostico, aunque la operacion comercial
-- arranque el 15; el propio script de arranque la preservo a proposito (509 consultas y 1.781 consentimientos
-- intactos). Aplicarle la fecha a lo clinico borraria del dataset pacientes reales medidos de verdad, que es
-- justo lo contrario de la calidad que se busca.
--
-- ═══ POR QUE SE ENUMERAN LAS COLUMNAS Y NO SE PONE `t.*` ═══
--
-- Por dos razones, y la segunda es la de fondo:
--   · `t.*` en una vista se EXPANDE AL CREARLA, asi que una columna nueva en `transactions` no apareceria y
--     nadie se enteraria: una vista que calla un dato nuevo es peor que no tenerla;
--   · y esta vista alimenta un PRODUCTO DE DATOS. Que salga una columna es una decision, no una herencia.
--     Enumerarlas obliga a tomarla, y por eso aqui NO hay ninguna que identifique a un paciente: van sus
--     identificadores tecnicos, para poder unir, y nada mas.
--
-- ⚠ SEGURIDAD: `security_invoker = true` (la vista respeta la RLS de quien pregunta, no la del dueño) MAS la
--   revocacion a `anon` y `authenticated`. Sin lo primero, una vista corre con los privilegios de su dueño y
--   se vuelve una puerta alrededor de la RLS de `transactions`.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS "public"."ventas_reales";--> statement-breakpoint

CREATE VIEW "public"."ventas_reales"
  WITH (security_invoker = true) AS
SELECT t."id",
       t."organization_id",
       t."patient_id",
       t."professional_id",
       t."status",
       t."payment_method",
       t."amount",
       t."currency",
       t."modalidad_de_la_venta",
       t."treatment_id",
       t."alegra_invoice_number",
       t."alegra_invoice_state",
       t."wompi_env",
       -- EL DIA DE LA OPERACION EN HORA DE COLOMBIA, que es el que cuenta para cualquier agrupacion por
       -- fecha. `created_at` en UTC manda una venta de las 7 de la noche al dia siguiente.
       (COALESCE(t."operated_at", t."created_at") AT TIME ZONE 'America/Bogota')::date AS "dia",
       COALESCE(t."operated_at", t."created_at") AS "momento",
       t."created_at"
  FROM "transactions" t
 WHERE COALESCE(t."cuenta_como_de_prueba", false) = false
   -- LA FECHA SE LEE DE LA CONFIGURACION, no se escribe aqui: es el mismo valor que recortan las pantallas, y
   -- dos copias del dia del arranque es como se llega a dos respuestas del mismo mes. NULA = todavia no se
   -- fijo, y entonces cuenta todo (igual que `fechaDeArranque()` en el codigo).
   AND (
     (COALESCE(t."operated_at", t."created_at") AT TIME ZONE 'America/Bogota')::date
       >= COALESCE((SELECT c."fecha_de_arranque" FROM "commercial_config" c LIMIT 1), '-infinity'::date)
   );--> statement-breakpoint

COMMENT ON VIEW "public"."ventas_reales" IS
  'Ventas de la operacion REAL: no marcadas como de prueba (cuenta_como_de_prueba, 0203/0217) y del dia del arranque en adelante (commercial_config.fecha_de_arranque, 0198). Para consultas analiticas y exportaciones; las pantallas NO la usan (la fecha no recorta lo que se debe ni el inventario). Lo CLINICO tiene una sola condicion, no dos: no ser de prueba.';--> statement-breakpoint

REVOKE ALL ON "public"."ventas_reales" FROM anon, authenticated;--> statement-breakpoint
