import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { fechaDeArranque } from "@/modules/payments/data/fecha-de-arranque";
import type { ClaseDeshecha } from "@/modules/payments/lo-deshecho";
import { SQL_SIN_PROFESIONAL_DE_PRUEBA } from "@/modules/professionals/de-prueba";

// ═══ CUANTO DE LO VENDIDO SE DESHIZO, DE QUE CLASE Y POR QUE ═══
//
// LO PIDIO SANTIAGO (2026-09-30), y salio de una frase de la pantalla de insights: "una compra devuelta
// sigue contando como compra". Si eso vale alli, ¿donde se ve cuanto se deshizo?
//
// El dato estaba ENTERO en `sale_reversals` y no estaba agregado en ninguna parte. Lo unico que habia eran
// tres vistas parciales: el dinero saliendo del bruto (invisible: la cifra baja y nadie sabe por que), las
// disputas abiertas en la bandeja de pendientes (donde lo resuelto desaparece) y la reversa de a una en la
// pantalla del profesional.
//
// ── ESTO NO RESTA DE LOS INSIGHTS, Y VA DICHO EN LA PANTALLA ──
//
// Alli una compra devuelta sigue contando como compra, porque la pregunta es si se siguio la prescripcion.
// Aqui la pregunta es otra. Las dos cifras conviven, y sin decirlo alguien las va a cruzar y a concluir mal.
//
// ── Y EL CORTE DEL ARRANQUE APLICA, por la fecha de LA VENTA ──
//
// Es una cifra de resumen, asi que cuenta desde el arranque como las demas. Y se acota por la fecha de la
// VENTA y no por la de la reversa: una devolucion de una venta anterior al arranque corresponde a una venta
// que esta pantalla ya no cuenta, y contarla aqui daria una tasa sobre un denominador que no la incluye.

export type LoDeshecho = {
  /** Ventas pagadas del periodo: el denominador sin el cual ningun conteo significa nada. */
  ventasPagadas: number;
  porClase: { clase: ClaseDeshecha; estado: string; veces: number; monto: number }[];
  /** Las notas escritas al abrir cada caso, agrupadas. */
  motivos: { clase: ClaseDeshecha; motivo: string; veces: number }[];
  /** Que producto vuelve mas, en unidades. Es el dato que le sirve a la direccion cientifica. */
  productosDevueltos: { producto: string; unidades: number; veces: number }[];
  /**
   * Los links, que NO son ventas deshechas y por eso van aparte con su nombre propio.
   * Ver `lo-deshecho.ts` para por que son cuatro situaciones y no una.
   */
  links: { aMano: number; reemplazadosPorOtroCobro: number; noCompletados: number; sinUsar: number };
  desdeElArranque: string | null;
};

export async function loDeshecho(): Promise<LoDeshecho> {
  const arranque = await fechaDeArranque();
  // El corte va sobre la VENTA (alias `t`), tambien cuando se cuentan reversas: ver la nota de arriba.
  //
  // Y ARRASTRA EL FILTRO DEL PROFESIONAL DE DEMOSTRACION (0199) EN LA MISMA VARIABLE, a proposito: si
  // fueran dos fragmentos sueltos, la consulta que se escriba mañana pondria uno y olvidaria el otro. Aqui
  // el olvido posible es el de la variable entera, que es mucho mas visible.
  const corte = sql`${
    arranque
      ? sql` and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${arranque}::date`
      : sql``
  } and ${sql.raw(SQL_SIN_PROFESIONAL_DE_PRUEBA)}`;

  const [pagadas] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from transactions t where t.status = 'paid'${corte}`);

  const porClase = await db.execute<{ kind: string; state: string; veces: number; monto: string }>(sql`
    select r.kind, r.state, count(*)::int as veces,
           coalesce(sum(r.debited_amount), 0)::text as monto
      from sale_reversals r
      join transactions t on t.id = r.transaction_id
     where true${corte}
     group by 1, 2
     order by 3 desc`);

  const motivos = await db.execute<{ kind: string; motivo: string; veces: number }>(sql`
    select r.kind,
           -- UNA REVERSA SIN NOTA NO ES UN OLVIDO NECESARIAMENTE (la de la pasarela la abre Atlas solo),
           -- asi que se nombra como lo que es en vez de dejar una fila vacia.
           coalesce(nullif(btrim(r.note), ''), '(sin nota escrita)') as motivo,
           count(*)::int as veces
      from sale_reversals r
      join transactions t on t.id = r.transaction_id
     where true${corte}
     group by 1, 2
     order by 3 desc
     limit 20`);

  const productosDevueltos = await db.execute<{ producto: string; unidades: number; veces: number }>(sql`
    select n.name as producto, sum(r.returned_quantity)::int as unidades, count(*)::int as veces
      from sale_reversals r
      join transaction_items ti on ti.id = r.transaction_item_id
      join nutraceuticals n on n.id = ti.nutraceutical_id
      join transactions t on t.id = r.transaction_id
     where r.kind = 'devolucion' and coalesce(n.is_test, false) = false${corte}
     group by 1
     order by 2 desc
     limit 10`);

  // LOS CUATRO CASOS DEL LINK, y ninguno es una venta deshecha. Ver `lo-deshecho.ts`: la distincion que
  // importa es a mano (cambio de opinion) contra reemplazado por otro cobro (la venta si ocurrio).
  const [links] = await db.execute<{
    a_mano: number;
    reemplazados: number;
    no_completados: number;
    sin_usar: number;
  }>(sql`
    select
      count(*) filter (where t.status = 'failed' and t.cancelled_at is not null
                         and t.cancelled_by_sale_id is null)::int as a_mano,
      count(*) filter (where t.status = 'failed' and t.cancelled_at is not null
                         and t.cancelled_by_sale_id is not null)::int as reemplazados,
      count(*) filter (where t.status = 'failed' and t.cancelled_at is null)::int as no_completados,
      count(*) filter (where t.status = 'pending')::int as sin_usar
      from transactions t
     where true${corte}`);

  return {
    ventasPagadas: Number(pagadas?.n ?? 0),
    porClase: porClase.map((r) => ({
      clase: r.kind as ClaseDeshecha,
      estado: r.state,
      veces: Number(r.veces),
      monto: Number(r.monto),
    })),
    motivos: motivos.map((m) => ({
      clase: m.kind as ClaseDeshecha,
      motivo: m.motivo,
      veces: Number(m.veces),
    })),
    productosDevueltos: productosDevueltos.map((p) => ({
      producto: p.producto,
      unidades: Number(p.unidades),
      veces: Number(p.veces),
    })),
    links: {
      aMano: Number(links?.a_mano ?? 0),
      reemplazadosPorOtroCobro: Number(links?.reemplazados ?? 0),
      noCompletados: Number(links?.no_completados ?? 0),
      sinUsar: Number(links?.sin_usar ?? 0),
    },
    desdeElArranque: arranque,
  };
}
