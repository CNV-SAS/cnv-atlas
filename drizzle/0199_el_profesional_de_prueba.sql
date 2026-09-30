-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL PROFESIONAL DE PRUEBA  ·  segunda pieza de las cifras limpias (aprobada 2026-09-30)
--
-- POR QUE NO BASTABA LA FECHA DE ARRANQUE (0198): la fecha limpia el PASADO y no el FUTURO. Profesional
-- Demo va a seguir generando datos DESPUES del arranque, porque para eso existe, y sus ventas, sus
-- comisiones y su ingreso contarian como operacion real desde el primer dia.
--
-- MISMO TRATO QUE `patients.is_test` Y `nutraceuticals.is_test`, con sus tres capas (ver
-- `modules/patients/de-prueba.ts`, que es la unica fuente de la regla):
--
--   1 · FUERA DE LAS CIFRAS que alguien lee como "el tamaño de la operacion".
--   2 · FUERA DE LO QUE SALE hacia afuera.
--   3 · VISIBLE DONDE SE TRABAJA, PERO MARCADO. Esconderlo seria la forma de que alguien lo confunda con
--       uno real, y ademas dejaria a Demo sin poder hacer su trabajo.
--
-- ── LO QUE ESTA MARCA NO HACE, Y SON DOS DECISIONES, NO DOS OLVIDOS ──
--
-- NO SACA SU INVENTARIO DE LA VITRINA. Un saldo no es un flujo: las unidades que Demo tiene en su bodega
-- son unidades REALES que CNV le entrego, y estan ahi. Sacarlas daria un numero que no cuadra con ningun
-- conteo fisico. Es la misma linea que ya trazo la 0198, y por la misma razon. (Distinto de un PRODUCTO de
-- prueba, que si se excluye: esas unidades son ficticias.)
--
-- NO DECIDE SI SE FACTURA. Eso lo decide el PACIENTE, y tiene que seguir siendo asi: un profesional de
-- prueba que le venda a un paciente REAL tiene que emitir su factura igual, porque la venta ocurrio y la
-- ley no pregunta quien la registro. La propuesta del 2026-09-30 decia que "convenia que valiera lo
-- mismo"; al mirarlo de cerca no conviene, y por eso no se hace. El gate por ambiente y paciente
-- (`motivoSiPacienteYAmbienteNoCuadran`) ya cubre el caso real: Demo demuestra con pacientes de prueba.
--
-- MARCAR SOLO EXCLUYE DONDE ALGUIEN ESCRIBIO QUE EXCLUYA. Asi que el trabajo no es esta columna: es el
-- barrido, y su candado es `src/tests/profesional-de-prueba-barrido.test.ts`.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "is_test" boolean NOT NULL DEFAULT false;--> statement-breakpoint

COMMENT ON COLUMN "professional_profiles"."is_test" IS
  'Profesional de demostracion: no cuenta en las cifras de resumen. No afecta su inventario (unidades reales) ni la facturacion (la decide el paciente).';
