import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { resolveRecommendation } from "@/modules/treatment/nutraceuticals-recommendation";

// ═══ QUE SE PRESCRIBE, QUE SE COMPRA, Y QUE SE COMPRA FUERA DEL PLAN (2026-09-29) ═══
//
// LO PIDIO SANTIAGO, y su razon es la del negocio: "CNV no vende por vender y la data es nuestro core".
//
// ── LAS TRES CIFRAS SON TRES HECHOS DISTINTOS, y mezclarlos es el error facil ──
//
//   1. LO QUE EL MODELO RECOMENDO. Vive en el snapshot del informe (`reports.snapshot.nutraceuticos`), como
//      una cadena con los nombres que emite el motor. Sellado: es lo que el modelo dijo ESE dia.
//   2. LO QUE EL PROFESIONAL PRESCRIBIO. Vive en `treatment_nutraceuticals`, por id. NO es lo mismo que (1):
//      el profesional puede prescribir algo que el modelo no recomendo, y eso es su criterio clinico, no un
//      error. Cuenta igual.
//   3. LO QUE EL PACIENTE COMPRO. Las lineas de las ventas atadas a ese tratamiento.
//
// Y LO INTERESANTE ESTA EN LAS DIFERENCIAS: prescrito y no comprado (la prescripcion que no se siguio),
// comprado y no prescrito (la compra fuera del plan), y recomendado pero no prescrito (donde el criterio del
// profesional se aparta del modelo).
//
// ── LO QUE ESTO NO MIDE, Y HAY QUE DECIRLO EN LA PANTALLA ──
//
// COMPRAR NO ES TOMAR. Ninguna de estas cifras dice si el paciente lo consumio: eso necesita el registro de
// consumo, que sigue sin construir. Asi que esto responde "¿el modelo vende?" y NO "¿el modelo funciona?".
// Presentarlo como lo segundo seria el peor uso posible de estos numeros.
//
// Y SOLO MIDE DESDE EL 2026-09-29: antes de ese dia una venta de /pagos nacia sin consulta, asi que no hay
// forma de saber de que plan salio. Atarlas hacia atras seria inventar.

/** El dia en que la venta empezo a decir de que consulta sale. Antes no hay nada que medir. */
export const DESDE_QUE_HAY_VINCULO = "2026-09-29";

export type ConversionDeProducto = {
  producto: string;
  /** En cuantos tratamientos se prescribio. */
  prescritoEn: number;
  /** En cuantos de esos se compro (aunque fuera en otra venta posterior). */
  compradoEn: number;
  /** Cuantas veces se compro SIN estar prescrito en la consulta a la que se ato la venta. */
  compradoFueraDelPlan: number;
};

export type InsightsDeLaCompra = {
  desde: string;
  /** Ventas pagadas con consulta atada, desde `desde`. */
  ventasConConsulta: number;
  /** Ventas pagadas SIN consulta, con su motivo agrupado. */
  ventasSinConsulta: number;
  motivosDeVentaSuelta: { motivo: string; veces: number }[];
  /** Lineas compradas que SI estaban prescritas en su consulta, y las que no. */
  lineasDentroDelPlan: number;
  lineasFueraDelPlan: number;
  /** Dias entre la consulta y la compra: la mediana dice mas que el promedio con pocos datos. */
  diasHastaLaCompra: { mediana: number | null; maximo: number | null };
  porProducto: ConversionDeProducto[];
  /** Tratamientos donde el profesional NO prescribio algo que el modelo recomendaba. */
  recomendadoSinPrescribir: { producto: string; veces: number }[];
};

export async function insightsDeLaCompra(): Promise<InsightsDeLaCompra> {
  const desde = DESDE_QUE_HAY_VINCULO;

  // ── 1. CUANTAS VENTAS TRAEN SU CONSULTA, Y LOS MOTIVOS DE LAS QUE NO ──
  const [conteo] = await db.execute<{ con: number; sin: number }>(sql`
    select count(*) filter (where t.treatment_id is not null)::int as con,
           count(*) filter (where t.treatment_id is null)::int as sin
      from transactions t
     where t.status = 'paid'
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${desde}::date`);

  const motivos = await db.execute<{ motivo: string; veces: number }>(sql`
    select coalesce(nullif(btrim(t.sin_tratamiento_motivo), ''), '(sin motivo escrito)') as motivo,
           count(*)::int as veces
      from transactions t
     where t.status = 'paid' and t.treatment_id is null
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${desde}::date
     group by 1 order by 2 desc limit 20`);

  // ── 2. LAS LINEAS: DENTRO O FUERA DE LO PRESCRITO EN ESA CONSULTA ──
  //
  // La comparacion es por ID y contra el tratamiento AL QUE SE ATO LA VENTA, no contra "algo que le
  // prescribieron alguna vez": la pregunta es si esa compra sigue ESE plan.
  const [lineas] = await db.execute<{ dentro: number; fuera: number }>(sql`
    select count(*) filter (where tn.id is not null)::int as dentro,
           count(*) filter (where tn.id is null)::int as fuera
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      left join treatment_nutraceuticals tn
             on tn.treatment_id = t.treatment_id and tn.nutraceutical_id = ti.nutraceutical_id
     where t.status = 'paid' and t.treatment_id is not null
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${desde}::date`);

  // ── 3. CUANTO TARDA EN COMPRAR DESDE LA CONSULTA ──
  //
  // LA MEDIANA Y EL MAXIMO, no el promedio: con pocas filas un solo caso de ocho meses mueve el promedio y
  // hace creer que nadie compra, cuando la mayoria compro el mismo dia.
  const [dias] = await db.execute<{ mediana: number | null; maximo: number | null }>(sql`
    select percentile_cont(0.5) within group (
             order by (coalesce(t.operated_at, t.created_at)::date - coalesce(tr.approved_at, tr.created_at)::date)
           )::int as mediana,
           max(coalesce(t.operated_at, t.created_at)::date - coalesce(tr.approved_at, tr.created_at)::date)::int as maximo
      from transactions t
      join treatments tr on tr.id = t.treatment_id
     where t.status = 'paid' and t.treatment_id is not null
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${desde}::date`);

  // ── 4. POR PRODUCTO: PRESCRITO, COMPRADO, Y COMPRADO FUERA DEL PLAN ──
  const porProducto = await db.execute<{
    producto: string;
    prescrito_en: number;
    comprado_en: number;
    fuera: number;
  }>(sql`
    with prescritos as (
      select tn.nutraceutical_id, tn.treatment_id
        from treatment_nutraceuticals tn
        join treatments tr on tr.id = tn.treatment_id
       where (coalesce(tr.approved_at, tr.created_at) at time zone 'America/Bogota')::date >= ${desde}::date
    ),
    compras as (
      select ti.nutraceutical_id, t.treatment_id
        from transaction_items ti
        join transactions t on t.id = ti.transaction_id
       where t.status = 'paid' and t.treatment_id is not null
         and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${desde}::date
    )
    select n.name as producto,
           count(distinct p.treatment_id)::int as prescrito_en,
           count(distinct c.treatment_id) filter (
             where exists (select 1 from prescritos p2
                            where p2.treatment_id = c.treatment_id
                              and p2.nutraceutical_id = c.nutraceutical_id)
           )::int as comprado_en,
           count(*) filter (
             where c.treatment_id is not null
               and not exists (select 1 from prescritos p3
                                where p3.treatment_id = c.treatment_id
                                  and p3.nutraceutical_id = c.nutraceutical_id)
           )::int as fuera
      from nutraceuticals n
      left join prescritos p on p.nutraceutical_id = n.id
      left join compras c on c.nutraceutical_id = n.id
     where coalesce(n.is_test, false) = false
     group by n.name
    having count(distinct p.treatment_id) > 0 or count(c.treatment_id) > 0
     order by 2 desc, 1`);

  // ── 5. LO QUE EL MODELO RECOMENDO Y NO SE PRESCRIBIO ──
  //
  // ESTE EJE VA POR NOMBRE Y NO POR ID, y no es un atajo: el modelo emite NOMBRES en el snapshot del informe,
  // con hasta dos grafias para el mismo producto (Q31). Se resuelve con el MISMO modulo puro que ya usa la
  // pantalla de Tratamiento, con su mapa de alias explicito y su candado: escribir aqui otra resolucion seria
  // el segundo constructor del mismo insumo, y se separarian.
  const recomendaciones = await db.execute<{ treatment_id: string; nutra: string }>(sql`
    select tr.id as treatment_id, r.snapshot->>'nutraceuticos' as nutra
      from reports r
      join evaluations e on e.id = r.evaluation_id
      join diagnoses d on d.evaluation_id = e.id
      join treatments tr on tr.diagnosis_id = d.id
     where r.snapshot->>'nutraceuticos' is not null
       and (coalesce(tr.approved_at, tr.created_at) at time zone 'America/Bogota')::date >= ${desde}::date`);

  const catalogo = await db.execute<{ id: string; name: string }>(sql`
    select id, name from nutraceuticals where coalesce(is_test, false) = false`);
  const prescritosPorTratamiento = await db.execute<{ treatment_id: string; nutraceutical_id: string }>(sql`
    select tn.treatment_id, tn.nutraceutical_id from treatment_nutraceuticals tn`);

  const prescritosDe = new Map<string, Set<string>>();
  for (const p of prescritosPorTratamiento) {
    const s = prescritosDe.get(p.treatment_id) ?? new Set<string>();
    s.add(p.nutraceutical_id);
    prescritosDe.set(p.treatment_id, s);
  }
  const itemsDelCatalogo = catalogo.map((c) => ({
    id: c.id,
    name: c.name,
    indication: null,
    commercialAvailability: "en_consultorio",
  }));

  const sinPrescribir = new Map<string, number>();
  for (const rec of recomendaciones) {
    const resueltos = resolveRecommendation(rec.nutra, itemsDelCatalogo);
    const prescritos = prescritosDe.get(rec.treatment_id) ?? new Set<string>();
    for (const r of resueltos) {
      // Un recomendado que NO existe en el catalogo no cuenta como "no prescrito": no se pudo prescribir. Es
      // otro hallazgo (falta el producto) y ya tiene su aviso en la pantalla de Tratamiento.
      if (r.status !== "en_catalogo") continue;
      if (prescritos.has(r.product.id)) continue;
      sinPrescribir.set(r.product.name, (sinPrescribir.get(r.product.name) ?? 0) + 1);
    }
  }

  return {
    desde,
    ventasConConsulta: Number(conteo?.con ?? 0),
    ventasSinConsulta: Number(conteo?.sin ?? 0),
    motivosDeVentaSuelta: motivos.map((m) => ({ motivo: m.motivo, veces: Number(m.veces) })),
    lineasDentroDelPlan: Number(lineas?.dentro ?? 0),
    lineasFueraDelPlan: Number(lineas?.fuera ?? 0),
    diasHastaLaCompra: {
      mediana: dias?.mediana == null ? null : Number(dias.mediana),
      maximo: dias?.maximo == null ? null : Number(dias.maximo),
    },
    porProducto: porProducto.map((p) => ({
      producto: p.producto,
      prescritoEn: Number(p.prescrito_en),
      compradoEn: Number(p.comprado_en),
      compradoFueraDelPlan: Number(p.fuera),
    })),
    recomendadoSinPrescribir: [...sinPrescribir.entries()]
      .map(([producto, veces]) => ({ producto, veces }))
      .sort((a, b) => b.veces - a.veces),
  };
}

