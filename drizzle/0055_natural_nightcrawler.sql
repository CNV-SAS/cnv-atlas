-- EA1 checkpoint 2 (composicion derivada). Por que PERSISTIR lo derivado y no calcularlo en vivo:
--   a) Dos consumidores leen de bis_raw_values (el motor arma bisRow para los indices; la tabla de
--      Wang lo lee directo). Calcular en vivo obligaria a derivar en dos lugares, y dos copias se
--      desincronizan (paso con los rangos y con el saldo de inventario).
--   b) Precedente: cuando ASMI se calculaba y se descartaba antes de sellar, se sello.
--   c) La que decide: un valor derivado que alimenta un diagnostico debe quedar REGISTRADO. Si en un
--      ano alguien revisa por que ese paciente tuvo ese indice, necesita ver los numeros que se usaron,
--      no recalcularlos con el codigo de entonces (por eso ademas derived_formula_version).
-- La insercion de las filas derivadas va en la MISMA transaccion del import (writeBisMeasurement).
CREATE TYPE "public"."bis_value_origin" AS ENUM('medido', 'derivado');--> statement-breakpoint
ALTER TABLE "bis_raw_values" ADD COLUMN "origin" "bis_value_origin" DEFAULT 'medido' NOT NULL;--> statement-breakpoint
ALTER TABLE "bis_raw_values" ADD COLUMN "derived_formula_version" text;