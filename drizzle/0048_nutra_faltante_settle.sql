-- T3b-3 ST5a: al CERRAR un caso de faltante, el saldo baja a lo contado. El producto NO esta,
-- independientemente de quien responda por el: los CUATRO cierres (justificado, venta_no_registrada,
-- injustificado confirmado, y el rechazo de direccion que termina en justificado) deben ajustar el
-- inventario igual. Un trigger sobre la transicion, al entrar a un estado TERMINAL, inserta un movimiento
-- conciliacion (-cantidad) para el producto/profesional del caso. El trigger de los movimientos recomputa
-- el saldo. Es la unica via, asi ningun camino de cierre se olvida de ajustar (garantia en la BD, no en el
-- codigo de aplicacion). security definer para insertar pese a la RLS. Reproducible.

create or replace function public.nutra_faltante_settle() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_prof uuid; v_nutra uuid; v_qty integer; v_lote text;
begin
  -- Solo los estados TERMINALES cierran (injustificado_pendiente NO: aun no hay decision final).
  if NEW.to_status not in ('justificado', 'venta_no_registrada', 'injustificado') then
    return null;
  end if;
  select professional_id, nutraceutical_id, quantity, lote
    into v_prof, v_nutra, v_qty, v_lote
    from public.nutraceutical_faltante_cases where id = NEW.case_id;
  insert into public.nutraceutical_stock_movements
    (professional_id, nutraceutical_id, delta, type, reason, lote)
    values (v_prof, v_nutra, -v_qty, 'conciliacion',
            'Conciliacion por faltante (' || NEW.to_status || ')', v_lote);
  return null;
end;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS nutra_faltante_settle_trg ON nutraceutical_faltante_transitions;--> statement-breakpoint
CREATE TRIGGER nutra_faltante_settle_trg
  AFTER INSERT ON nutraceutical_faltante_transitions
  FOR EACH ROW EXECUTE FUNCTION public.nutra_faltante_settle();
