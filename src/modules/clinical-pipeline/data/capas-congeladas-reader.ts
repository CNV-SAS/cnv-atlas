import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { MAYOR_DESDE_EL_QUE_HAY_CAPAS } from "../mayor-con-capas";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE INFORMES REEMITIDOS QUEDARON SIN SUS CAPAS CONGELADAS  ·  LECTURA (regla dura 1)
//
// ═══ DE DONDE SALE: UN DEFECTO NUESTRO, EN PRODUCCION, SOBRE 424 CONSULTAS (2026-11-07) ═══
//
// El `snapshot` de la reemision se escribia como `{ ...output, surveyVersionId }`, sin las tres capas que
// el pipeline congela al lado del EngineOutput: `rutasContent`, `efrContent` y `validityCaveats`. Los
// lectores las toman con `?? []` / `?? null`, asi que nada fallo y todo quedo vacio en cinco superficies
// (las tarjetas de ruta de Tratamiento, la hoja de rutas imprimible, las rutas y remisiones del informe
// del paciente, las remisiones EXIGIDAS de la HC, y la evidencia del estado EFR).
//
// ═══ POR QUE ESTO EXISTE EN VEZ DE REEMITIR OTRA VEZ ═══
//
// Reemitir otra vez crearia un diagnostico y un informe MAS por consulta (la marca de pantalla diria
// "reemitido 2 veces") para arreglar un defecto nuestro, y ademas no se puede: con la version ya al dia,
// el guard de la reemision responde "no hay nada que reemitir". Lo que falta no es una emision nueva: es
// la mitad de una escritura que no termino, el mismo dia, en filas que nacieron en BORRADOR y que nadie
// envio.
//
// ═══ SOLO LAS QUE ESCRIBIO LA REEMISION, Y ESO ES UN FILTRO, NO UN DETALLE ═══
//
// Los snapshots de eras anteriores TAMPOCO traen estas capas, y esos no se tocan: son documentos emitidos
// cuando esas capas no existian, y reescribir el pasado es justo lo que la regla 7 prohibe. El filtro
// distingue "nacio sin ellas porque no existian" de "nacio sin ellas porque nuestro codigo no las
// escribio hoy".
//
// ═══ Y EL FILTRO DECIA `motor like '3.%'`, QUE ERA CORRECTO EL 7 DE NOVIEMBRE Y DEJO DE SERLO ═══
//
// El 3.x era el motor del dia. Con el recalculo del 16 de noviembre toda la cohorte pasa a 4.0.0, asi que
// ese `like` dejaba FUERA justo las filas que la reemision acababa de escribir: **el mismo defecto, en la
// misma operacion, se habria vuelto invisible**. Es la version de la fecha escrita a mano, que envejece
// sin fallar.
//
// Se compara por el MAYOR y con un umbral que dice de donde sale: las tres capas existen desde el mayor
// 3, asi que todo informe sellado con 3 o mas tiene que traerlas, y ninguno anterior. El mayor se extrae
// con una expresion y no con `split_part`, porque en produccion conviven dos grafias (`1.0.0` y
// `anibise-1.4.0`) y partir por el punto sobre la segunda da "anibise-1", que ni siquiera es un numero.
//
// Verificado en la nube el 2026-11-16, despues del recalculo: 552 informes vigentes, los 552 con las tres
// capas (481 en 4.x, 70 en 1.x, 1 en 2.x). Cero incompletos.
//
// NO LLEVA UN SOLO DATO DE PACIENTE: id de la evaluacion, id del informe, que le falta y con que version
// esta sellado.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type CapaQueFalta = "rutasContent" | "efrContent" | "validityCaveats";

export type InformeSinCapas = {
  evaluationId: string;
  reportId: string;
  /** La version del motor del snapshot. Siempre de mayor >= 3: ver el filtro. */
  motorSellado: string;
  /** Las capas ausentes, en el orden en que se congelan. Nunca vacio. */
  falta: CapaQueFalta[];
};

type Fila = {
  evaluation_id: string;
  report_id: string;
  motor: string | null;
  tiene_rutas: boolean;
  tiene_efr: boolean;
  tiene_caveats: boolean;
};

/**
 * Los informes VIGENTES (la ultima fila de tipo paciente de cada consulta) que les falta alguna capa.
 *
 * LO VIGENTE ES LA ULTIMA FILA, el mecanismo de la casa, y aqui se resuelve en SQL con un `distinct on`
 * ordenado: una version anterior de la misma consulta no se repara, porque no es lo que la pantalla lee.
 *
 * `jsonb_exists` y no el operador `?`: el `?` de jsonb se confunde a la vista con un marcador de
 * parametro, y esta consulta va a ser leida por alguien que busque un defecto.
 */
export async function informesSinCapasCongeladas(): Promise<InformeSinCapas[]> {
  const filas = await db.execute<Fila>(sql`
    with vigentes as (
      select distinct on (r.evaluation_id)
             r.evaluation_id,
             r.id as report_id,
             r.snapshot->'versions'->>'engine' as motor,
             jsonb_exists(r.snapshot, 'rutasContent') as tiene_rutas,
             jsonb_exists(r.snapshot, 'efrContent') as tiene_efr,
             jsonb_exists(r.snapshot, 'validityCaveats') as tiene_caveats
        from reports r
       where r.type = 'paciente'
       order by r.evaluation_id, r.created_at desc
    )
    select * from vigentes
     where coalesce((substring(motor from '([0-9]+)\.'))::int, 0) >= ${MAYOR_DESDE_EL_QUE_HAY_CAPAS}
       and not (tiene_rutas and tiene_efr and tiene_caveats)`);

  return filas.map((f) => ({
    evaluationId: f.evaluation_id,
    reportId: f.report_id,
    motorSellado: f.motor ?? "(sin versión)",
    falta: [
      ...(f.tiene_rutas ? [] : (["rutasContent"] as const)),
      ...(f.tiene_efr ? [] : (["efrContent"] as const)),
      ...(f.tiene_caveats ? [] : (["validityCaveats"] as const)),
    ],
  }));
}
