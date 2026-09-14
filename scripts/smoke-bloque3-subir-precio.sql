-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- SUBIR EL PRECIO DEL PRODUCTO DE PRUEBA A 11.900  ·  smoke del Bloque 3, sesion 2
--
-- POR QUE: Wompi rechaza todo cobro por debajo de $1.500 ("El monto minimo de una transaccion es $1,500
-- exceptuando impuestos", smoke del 2026-09-14). El producto de prueba valia 1.190, asi que un cobro de UNA
-- unidad nunca se podia pagar. El paso 5 de la sesion 1 si paso porque cobro TRES (3.570).
--
-- 11.900 es una base de 10.000 mas IVA: queda por encima del minimo con o sin impuestos, y la factura de
-- sandbox sigue cuadrando (el precio lo manda Atlas en cada linea).
--
-- LAS VENTAS YA HECHAS NO CAMBIAN: su precio quedo sellado en la linea al crearse.
--
-- COMO SE CORRE: ver docs/entregas/SMOKE_BLOQUE_3_SESION_2.md, paso 5. NO se pega en el editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  update nutraceuticals
     set unit_price = 11900, updated_at = now()
   where name = 'PRUEBA SMOKE BLOQUE 3' and is_test;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'ABORTADO: no existe el producto de prueba activo (PRUEBA SMOKE BLOQUE 3). Correr primero smoke-bloque3-preparar.sql.';
  end if;
  if n > 1 then
    raise exception 'ABORTADO: hay % productos de prueba con ese nombre. No se adivina cual.', n;
  end if;
  raise notice 'Precio del producto de prueba: 11.900 (antes 1.190). Las ventas ya hechas conservan su precio.';
end $$;

commit;
