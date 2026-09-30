import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { fechaDeArranque } from "@/modules/payments/data/fecha-de-arranque";
import { SQL_SIN_PROFESIONAL_DE_PRUEBA } from "@/modules/professionals/de-prueba";
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

/**
 * El dia en que la venta empezo a decir de que consulta sale.
 *
 * YA NO RECORTA LO QUE SE MUESTRA (Santiago, 2026-09-30): la pantalla decia "todavia no hay ventas desde el
 * 29" y no mostraba nada, mientras las demas cifras del tablero si muestran lo que hay. Esconder los datos
 * para no mentir es otra forma de no informar.
 *
 * Asi que se mide TODO y se DICE cuanto es anterior al vinculo: una venta de antes del 29 no podia decir su
 * consulta, y contarla como "compra sin consulta" a secas haria creer que la gente compra fuera de plan
 * cuando lo que pasa es que el sistema no lo preguntaba. La cifra se muestra, y su asterisco tambien.
 */
export const DESDE_QUE_HAY_VINCULO = "2026-09-29";

/**
 * UNA SOLA FILA POR PRODUCTO, CON EL EMBUDO ENTERO (Santiago, 2026-09-30).
 *
 * Antes eran DOS tablas y Santiago se perdio leyendolas: arriba "MULTI-CELL BASE, prescrito en 24" y abajo
 * "MULTI-CELL BASE, 60 consultas". Son hechos distintos de consultas distintas, pero en dos bloques separados
 * se leen como dos cifras del mismo hecho, y entonces una parece contradecir a la otra.
 *
 * OJO CON LA RELACION, PORQUE NO ES LA OBVIA: `prescritoEn` NO sale de `recomendadoEn`. El profesional puede
 * prescribir algo que el modelo no propuso (es su criterio clinico, y cuenta igual), y hay consultas con
 * prescripcion que ni siquiera tienen informe. Las dos columnas se CRUZAN, no se contienen, y por eso la
 * pantalla lo dice en vez de dejar que el lector lo suponga.
 */
export type ConversionDeProducto = {
  producto: string;
  /** En cuantas consultas el MODELO lo propuso (sale del informe sellado). */
  recomendadoEn: number;
  /** De esas, en cuantas el profesional NO lo prescribio. */
  recomendadoSinPrescribir: number;
  /** En cuantas consultas se prescribio, lo hubiera recomendado el modelo o no. */
  prescritoEn: number;
  /** En cuantas de esas se compro (aunque fuera en otra venta posterior). */
  compradoEn: number;
  /** Cuantas veces se compro SIN estar prescrito en la consulta a la que se ato la venta. */
  compradoFueraDelPlan: number;
};

export type InsightsDeLaCompra = {
  desde: string;
  /** Ventas pagadas con su consulta atada. */
  ventasConConsulta: number;
  /**
   * Ventas SIN consulta que SI podian decirla (posteriores al vinculo). Son las unicas comparables con las
   * atadas: el denominador de "cuantas traen su consulta" son estas mas las atadas, NO todas las ventas.
   *
   * MEZCLARLAS CON LAS ANTERIORES fue el defecto que Santiago vio: "0 de 18", donde las 18 incluian ventas de
   * antes de que el sistema preguntara. Numerador y denominador median ventanas distintas, y el propio texto
   * de la pantalla decia que esas 18 no podian decirlo.
   */
  ventasSinConsultaComparables: number;
  /** Ventas pagadas SIN consulta, con su motivo agrupado. */
  ventasSinConsulta: number;
  /**
   * De las que no traen consulta, cuantas son ANTERIORES al dia en que se empezo a preguntar. No es lo mismo
   * que una compra sin consulta deliberada: esas no podian decirlo, y sin separarlas la cifra haria creer que
   * la gente compra fuera de plan cuando el sistema no lo preguntaba.
   */
  ventasSinConsultaAnteriores: number;
  motivosDeVentaSuelta: { motivo: string; veces: number }[];
  /** Lineas compradas que SI estaban prescritas en su consulta, y las que no. */
  lineasDentroDelPlan: number;
  lineasFueraDelPlan: number;
  /** Dias entre la consulta y la compra: la mediana dice mas que el promedio con pocos datos. */
  diasHastaLaCompra: { mediana: number | null; maximo: number | null };
  porProducto: ConversionDeProducto[];
  /** Desde cuando cuenta la operacion real, o null si todavia no se fijo el arranque. */
  desdeElArranque: string | null;
  /**
   * Cuantas compras pagadas quedaron FUERA por ser anteriores al arranque.
   *
   * EXISTE PARA QUE EL DIA DEL ARRANQUE NO PAREZCA UN DEFECTO. Ese dia la pantalla se vacia de golpe, y
   * despues de dos dias mirando un "0 de 18" que SI era un defecto, un cero sin explicacion se va a leer
   * como otro. Un cero que dice "y hay 47 compras anteriores que dejaron de contar" se lee como lo que es.
   */
  ventasAnterioresAlArranque: number;
};

export async function insightsDeLaCompra(): Promise<InsightsDeLaCompra> {
  const desde = DESDE_QUE_HAY_VINCULO;

  // ═══ EL ARRANQUE RECORTA LOS TRES EJES A LA VEZ (0198) ═══
  //
  // Esta pantalla ya tiene una ventana propia (el dia en que la venta empezo a decir su consulta), y ahora
  // tiene otra encima. LA REGLA ES QUE EL CORTE SE APLIQUE A TODO LO QUE SE COMPARA: ventas, consultas y
  // recomendaciones. Recortar solo las ventas dejaria el numerador en la operacion real y el denominador
  // arrastrando 87 prescripciones de prueba, y la conversion saldria hundida por un motivo que no existe.
  // Es el mismo defecto del "0 de 18" que Santiago vio, con otra ropa.
  //
  // Y EL PROFESIONAL DE DEMOSTRACION SALE POR LOS DOS EJES TAMBIEN (0199), por la misma razon: si sus
  // ventas salieran y sus consultas no, sus prescripciones quedarian en el denominador sin ninguna compra
  // que pudiera cumplirlas, y la conversion de todos los productos bajaria por una cuenta de demostracion.
  //
  // La consulta se atribuye por SU PACIENTE y no por quien la creo: `treatments.created_by` es un perfil y
  // puede ser el de un administrador que corrigio algo, mientras que la asignacion del paciente es la que
  // dice de quien es la operacion.
  const arranque = await fechaDeArranque();
  const sinDemoEnLaVenta = sql` and ${sql.raw(SQL_SIN_PROFESIONAL_DE_PRUEBA)}`;
  // Se escribe desde `tr` y no desde un alias de diagnostico porque las dos consultas que lo usan tienen
  // el tratamiento y solo una tiene el diagnostico a mano.
  const sinDemoEnLaConsulta = sql` and not exists (
    select 1 from diagnoses dx
      join evaluations ev on ev.id = dx.evaluation_id
      join professional_profiles pp on pp.id = ev.professional_id
     where dx.id = tr.diagnosis_id and pp.is_test)`;
  const corteVenta = arranque
    ? sql` and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${arranque}::date${sinDemoEnLaVenta}`
    : sinDemoEnLaVenta;
  const corteConsulta = arranque
    ? sql` and (tr.created_at at time zone 'America/Bogota')::date >= ${arranque}::date${sinDemoEnLaConsulta}`
    : sinDemoEnLaConsulta;

  // LO QUE EL CORTE DEJO FUERA, para poder DECIRLO. Sin esta cifra, el dia del arranque la pantalla se
  // queda muda con un cero, y un cero mudo es indistinguible de una pantalla rota.
  const [fuera] = arranque
    ? await db.execute<{ n: number }>(sql`
        select count(*)::int as n
          from transactions t
         where t.status = 'paid'
           and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date < ${arranque}::date
           ${sinDemoEnLaVenta}`)
    : [{ n: 0 }];

  // ── 1. CUANTAS VENTAS TRAEN SU CONSULTA, Y LOS MOTIVOS DE LAS QUE NO ──
  const [conteo] = await db.execute<{ con: number; sin: number }>(sql`
    select count(*) filter (where t.treatment_id is not null)::int as con,
           count(*) filter (where t.treatment_id is null)::int as sin
      from transactions t
     where t.status = 'paid'${corteVenta}`);

  // LAS QUE SI PODIAN DECIRLO Y NO LO DIJERON: son las comparables. Las anteriores se cuentan aparte.
  const [comparables] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
      from transactions t
     where t.status = 'paid' and t.treatment_id is null
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${desde}::date${corteVenta}`);

  const [anteriores] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
      from transactions t
     where t.status = 'paid' and t.treatment_id is null
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date < ${desde}::date${corteVenta}`);

  const motivos = await db.execute<{ motivo: string; veces: number }>(sql`
    select coalesce(nullif(btrim(t.sin_tratamiento_motivo), ''), '(sin motivo escrito)') as motivo,
           count(*)::int as veces
      from transactions t
     where t.status = 'paid' and t.treatment_id is null
       -- SOLO LAS POSTERIORES AL VINCULO: las de antes no tienen motivo porque nadie se lo pidio, y sacarlas
       -- como "(sin motivo escrito)" haria creer que alguien omitio algo. No omitio nada: no existia el campo.
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date >= ${desde}::date${corteVenta}
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
     where t.status = 'paid' and t.treatment_id is not null${corteVenta}`);

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
     where t.status = 'paid' and t.treatment_id is not null${corteVenta}`);

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
       where true${corteConsulta}
    ),
    compras as (
      select ti.nutraceutical_id, t.treatment_id
        from transaction_items ti
        join transactions t on t.id = ti.transaction_id
       where t.status = 'paid' and t.treatment_id is not null${corteVenta}
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

  // ── 5. LO QUE EL MODELO RECOMENDO, Y EN CUANTAS DE ESAS NO SE PRESCRIBIO ──
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
     where r.snapshot->>'nutraceuticos' is not null${corteConsulta}`);

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

  // SE CUENTAN CONSULTAS, NO FILAS: un tratamiento con dos informes recomendando lo mismo es UNA consulta
  // donde el modelo lo propuso. Sin el par (tratamiento, producto) la cifra contaria el informe repetido y
  // diria mas recomendaciones de las que hubo, que es justo lo que el rotulo promete no hacer.
  const recomendadoEn = new Map<string, number>();
  const sinPrescribir = new Map<string, number>();
  const yaContado = new Set<string>();
  for (const rec of recomendaciones) {
    const resueltos = resolveRecommendation(rec.nutra, itemsDelCatalogo);
    const prescritos = prescritosDe.get(rec.treatment_id) ?? new Set<string>();
    for (const r of resueltos) {
      // Un recomendado que NO existe en el catalogo no cuenta como "no prescrito": no se pudo prescribir. Es
      // otro hallazgo (falta el producto) y ya tiene su aviso en la pantalla de Tratamiento.
      if (r.status !== "en_catalogo") continue;
      const par = `${rec.treatment_id}|${r.product.id}`;
      if (yaContado.has(par)) continue;
      yaContado.add(par);
      recomendadoEn.set(r.product.name, (recomendadoEn.get(r.product.name) ?? 0) + 1);
      if (prescritos.has(r.product.id)) continue;
      sinPrescribir.set(r.product.name, (sinPrescribir.get(r.product.name) ?? 0) + 1);
    }
  }

  // ── LA UNION, Y POR QUE NO BASTA RECORRER UNA SOLA LISTA ──
  //
  // El SQL de arriba solo devuelve productos con prescripcion o compra; el mapa de recomendaciones puede
  // traer uno que el modelo propone siempre y que nadie prescribio nunca. Ese es precisamente el hallazgo
  // mas interesante del eje del modelo, asi que la tabla es la UNION de los dos, no uno de ellos.
  const filas = new Map<string, ConversionDeProducto>();
  for (const p of porProducto) {
    filas.set(p.producto, {
      producto: p.producto,
      recomendadoEn: 0,
      recomendadoSinPrescribir: 0,
      prescritoEn: Number(p.prescrito_en),
      compradoEn: Number(p.comprado_en),
      compradoFueraDelPlan: Number(p.fuera),
    });
  }
  for (const [producto, veces] of recomendadoEn) {
    const fila = filas.get(producto) ?? {
      producto,
      recomendadoEn: 0,
      recomendadoSinPrescribir: 0,
      prescritoEn: 0,
      compradoEn: 0,
      compradoFueraDelPlan: 0,
    };
    fila.recomendadoEn = veces;
    fila.recomendadoSinPrescribir = sinPrescribir.get(producto) ?? 0;
    filas.set(producto, fila);
  }

  return {
    desde,
    desdeElArranque: arranque,
    ventasAnterioresAlArranque: Number(fuera?.n ?? 0),
    ventasConConsulta: Number(conteo?.con ?? 0),
    ventasSinConsulta: Number(conteo?.sin ?? 0),
    ventasSinConsultaComparables: Number(comparables?.n ?? 0),
    ventasSinConsultaAnteriores: Number(anteriores?.n ?? 0),
    motivosDeVentaSuelta: motivos.map((m) => ({ motivo: m.motivo, veces: Number(m.veces) })),
    lineasDentroDelPlan: Number(lineas?.dentro ?? 0),
    lineasFueraDelPlan: Number(lineas?.fuera ?? 0),
    diasHastaLaCompra: {
      mediana: dias?.mediana == null ? null : Number(dias.mediana),
      maximo: dias?.maximo == null ? null : Number(dias.maximo),
    },
    // El orden sigue el embudo: primero lo que mas propone el modelo, y a igualdad lo mas prescrito.
    porProducto: [...filas.values()].sort(
      (a, b) =>
        b.recomendadoEn - a.recomendadoEn ||
        b.prescritoEn - a.prescritoEn ||
        a.producto.localeCompare(b.producto),
    ),
  };
}

