-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL FALTANTE SE COBRA AL PRECIO DE FACTURACION, NO AL PVP  ·  2026-09-29
--
-- DECISION DE CONTABILIDAD, confirmada por Santiago. El caso sellaba el PVP CON IVA y cobraba eso. El modelo
-- dice otra cosa, textual: "Se cobran al precio de facturacion (precio base menos 20%), no al PVP completo.
-- El 20% es margen del Integrante que en un faltante nadie gano; cobrar el PVP seria cobrar una utilidad
-- inexistente."
--
-- MULTICELL: 107.100 contra 72.000. Un 49% de mas.
--
-- ── LAS TRES RAZONES, PARA QUE QUEDE EL PORQUE Y NO SOLO LA CIFRA ──
--
--   1. EL IVA NO SE CAUSO. El PVP incluye 17.100 que son de la DIAN, y no hubo venta. Cobrarselos al
--      Integrante seria cobrarle un impuesto que nunca existio. Y ademas rompe el tratamiento de
--      INDEMNIZACION que el mismo modelo fija ("no genera factura de venta, no genera IVA"): cobrar el PVP
--      con IVA se parece demasiado a una venta, y si parece venta alguien puede exigir que se facture.
--   2. CNV NUNCA IBA A RECIBIR EL PVP por esa unidad. Si se hubiera vendido, se quedaba con 72.000 (la base
--      menos el 20% del Integrante). Cobrar 107.100 no repone lo perdido: cobra de mas.
--   3. Y COBRAR EL PVP HARIA EL FALTANTE MAS RENTABLE QUE LA VENTA (107.100 por una unidad perdida contra
--      72.000 por una vendida). "Ese calculo lo va a hacer el primer Integrante al que se le cobre, y es
--      indefendible."
--
-- El desincentivo se mantiene intacto: paga 72.000, no recibe nada del paciente, y pierde ademas los 18.000
-- de comision que habria ganado.
--
-- ── POR QUE TRES COLUMNAS NUEVAS Y NO REESCRIBIR `sealed_total` ──
--
-- `sealed_unit_price` y `sealed_total` son hechos SELLADOS y write-once por trigger desde la 0043: el PVP de
-- referencia al detectar y su total. Eso no cambio y no se toca; lo que cambia es CUANTO SE COBRA, que es
-- otra cifra. Reescribir un sellado para arreglar una regla es exactamente lo que el sellado existe para
-- impedir, y ademas dejaria el caso sin poder explicar su propia cuenta.
--
-- Con las tres, el caso se explica solo: "PVP 107.100, base 90.000, tu descuento del 20% son 18.000, se te
-- cobran 72.000".
--
-- ── Y LA TASA SE SELLA, NO SE USA UN 20% FIJO ──
--
-- La tasa del Integrante tiene vigencia (`professional_commission_rates`, 0119). Se sella la que regia A LA
-- FECHA DE DETECCION, igual que se sella el precio, para que un caso viejo pueda explicar su cuenta aunque la
-- tasa cambie despues.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "nutraceutical_faltante_cases"
  ADD COLUMN IF NOT EXISTS "sealed_base_unit" numeric,
  ADD COLUMN IF NOT EXISTS "sealed_commission_rate" numeric,
  -- LO QUE SE COBRA. Es lo que lee la liquidacion desde ahora.
  ADD COLUMN IF NOT EXISTS "sealed_charge" numeric;--> statement-breakpoint

COMMENT ON COLUMN "nutraceutical_faltante_cases"."sealed_charge" IS
  'La indemnizacion: cantidad x (base sin IVA x (1 - tasa del Integrante)), sellada a la deteccion. NO es el PVP: el IVA no se causo y el margen del Integrante nadie lo gano. Es lo que cobra la liquidacion.';--> statement-breakpoint

COMMENT ON COLUMN "nutraceutical_faltante_cases"."sealed_unit_price" IS
  'PVP CON IVA de referencia, sellado a la deteccion. NO es lo que se cobra (eso es sealed_charge): se conserva porque es el punto de partida de la cuenta y permite explicarla.';--> statement-breakpoint

-- ─── EL RECALCULO DE LOS CASOS QUE TODAVIA NO SE COBRARON ───
--
-- Los ya liquidados NO se tocan: su cifra se fue en una liquidacion girada, y reescribirla dejaria una
-- liquidacion que ya no se puede explicar. Si alguno quedo cobrado de mas, el ajuste va por la via de siempre
-- (un movimiento en sentido contrario en la liquidacion siguiente), no reescribiendo el pasado.
--
-- La tasa que se aplica es la VIGENTE A LA DETECCION; si el Integrante no tiene fila de vigencia, la de su
-- perfil; y si tampoco, el 20% que el modelo fija por defecto.
UPDATE "nutraceutical_faltante_cases" c
   SET "sealed_base_unit" = round(c."sealed_unit_price" / 1.19),
       "sealed_commission_rate" = coalesce(
         (select r."rate" from "professional_commission_rates" r
           where r."professional_id" = c."professional_id"
             and r."valid_from" <= (c."reported_at" at time zone 'America/Bogota')::date
             and (r."valid_to" is null or r."valid_to" > (c."reported_at" at time zone 'America/Bogota')::date)
           order by r."valid_from" desc limit 1),
         (select p."commission_rate" from "professional_profiles" p where p."id" = c."professional_id"),
         0.20
       ),
       "sealed_charge" = c."quantity" * round(
         round(c."sealed_unit_price" / 1.19) * (1 - coalesce(
           (select r."rate" from "professional_commission_rates" r
             where r."professional_id" = c."professional_id"
               and r."valid_from" <= (c."reported_at" at time zone 'America/Bogota')::date
               and (r."valid_to" is null or r."valid_to" > (c."reported_at" at time zone 'America/Bogota')::date)
             order by r."valid_from" desc limit 1),
           (select p."commission_rate" from "professional_profiles" p where p."id" = c."professional_id"),
           0.20
         ))
       )
 WHERE c."settlement_id" IS NULL;--> statement-breakpoint

-- Los ya liquidados conservan lo que se les cobro, para que su liquidacion siga cuadrando.
UPDATE "nutraceutical_faltante_cases"
   SET "sealed_charge" = "sealed_total",
       "sealed_base_unit" = round("sealed_unit_price" / 1.19),
       "sealed_commission_rate" = 0
 WHERE "settlement_id" IS NOT NULL AND "sealed_charge" IS NULL;--> statement-breakpoint

-- ─── LA INDEMNIZACION NO PUEDE PASARSE DEL VALOR DE VENTA ───
-- Es una guarda de sanidad: cualquier cuenta que produzca mas que el PVP total esta mal por construccion.
ALTER TABLE "nutraceutical_faltante_cases"
  DROP CONSTRAINT IF EXISTS "faltante_cargo_en_rango";--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_cases"
  ADD CONSTRAINT "faltante_cargo_en_rango" CHECK (
    "sealed_charge" IS NULL OR ("sealed_charge" >= 0 AND "sealed_charge" <= "sealed_total")
  );--> statement-breakpoint

-- ─── LAS TRES ENTRAN EN LOS HECHOS WRITE-ONCE ───
-- La funcion se recrea entera (es como estaba en la 0043) con las tres columnas nuevas en la lista: son la
-- cuenta del cargo, y una cuenta que se puede editar despues no explica nada.
create or replace function public.nutra_faltante_case_coherence() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_last public.nutraceutical_faltante_status;
begin
  if NEW.professional_id is distinct from OLD.professional_id
     or NEW.nutraceutical_id is distinct from OLD.nutraceutical_id
     or NEW.quantity is distinct from OLD.quantity
     or NEW.sealed_unit_price is distinct from OLD.sealed_unit_price
     or NEW.sealed_total is distinct from OLD.sealed_total
     or NEW.sealed_base_unit is distinct from OLD.sealed_base_unit
     or NEW.sealed_commission_rate is distinct from OLD.sealed_commission_rate
     or NEW.sealed_charge is distinct from OLD.sealed_charge
     or NEW.reported_at is distinct from OLD.reported_at
     or NEW.deadline_at is distinct from OLD.deadline_at then
    raise exception 'nutra_faltante: los hechos sellados del caso son inmutables (producto, cantidad, precio, cuenta del cargo, fechas).';
  end if;
  select to_status into v_last from public.nutraceutical_faltante_transitions
    where case_id = NEW.id order by created_at desc, id desc limit 1;
  if v_last is not null and NEW.status is distinct from v_last then
    raise exception 'nutra_faltante: el status es un cache de la ultima transicion (esperado %, intento %).', v_last, NEW.status;
  end if;
  if NEW.status = 'injustificado' and NEW.charge_status = 'sin_cargo' then
    raise exception 'nutra_faltante: un caso injustificado no puede quedar sin cargo.';
  end if;
  if NEW.status <> 'injustificado' and NEW.charge_status <> 'sin_cargo' then
    raise exception 'nutra_faltante: solo un caso injustificado lleva cargo.';
  end if;
  return NEW;
end;
$$;
