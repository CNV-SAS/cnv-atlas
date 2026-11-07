import "server-only";

import { sql } from "drizzle-orm";

import { BANDA_IAE_ANIOS } from "@/clinical-engine/presentacion-eb-bis";
import { db } from "@/db";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN DOCUMENTO QUE SE CONTRADICE NO SALE  ·  2026-11-03
//
// ═══ EL CASO, EN UN INFORME REAL (Santiago) ═══
//
// Arriba: *"Edad biológica estimada: 24,7 años · −1,3 años: acorde con sus pares."*
// Tres líneas más abajo: *"Envejecimiento · A trabajar. Envejecimiento acelerado: intervenir sobre
// función y masa."* Y la historia clínica de la misma consulta: *"su envejecimiento biológico está
// acelerado (1 años por encima de lo esperado)"*, con la ruta R4 activada por "IAE acelerado".
//
// ═══ LA CAUSA, Y ES UN PORTE A MEDIAS NUESTRO ═══
//
// Su §2 del 2026-10-26 es literal: *"La EB-BIS v5 (IFC, PABU e ICEC con intercepto fijo de 41,438 años)
// se retira del motor de ATLAS y se sustituye por la EB-BIS v7."*
//
// `analizarDesdeBiody` SE MIGRO: su EB/IAE sale de `ebBisV7`, y es la cifra que el informe pinta arriba y
// que la HC lleva en su fila. `analizarDFI` NO SE MIGRO: sigue haciendo
// `ix.computeEBBIS(IFC, PABU, le8.total)` y `ix.computeIAE(...)`, o sea la v5, y ESE IAE es el que
// alimenta el dominio 3 del DFI, el riesgo integrado y las rutas.
//
// Asi que en la misma consulta conviven DOS edades biologicas: la que se le dice al paciente y la que
// decide lo que se le prescribe.
//
// ═══ CUANTO (medido en produccion el 2026-11-03, sobre los 389 informes vigentes con sello 2.x) ═══
//
//   · 17 dicen "acorde con sus pares" arriba y activan la ruta de desaceleracion del envejecimiento.
//   · 43 dicen ACELERADO arriba y NO activan esa ruta, que es el peor de los dos: al paciente se le
//     nombra el problema y el documento no prescribe nada para el.
//   · 326 (84 %) coinciden.
//   · NINGUNO de los 60 se ha enviado todavia. Esa es la ventana que este freno aprovecha.
//
// ═══ POR QUE UN FRENO Y NO EL ARREGLO ═══
//
// Arreglar `analizarDFI` cambia el dominio 3, el riesgo integrado y las RUTAS ACTIVAS de toda la cohorte:
// es un bump del motor con sus goldens y un recalculo nuevo. Que criterio debe regir (si el DFI pasa a
// leer el IAE de la v7, o si su dominio 3 tiene su propia escala) es una decision de Gildardo, y esta en
// el documento de dudas.
//
// MIENTRAS TANTO ESTO NO DECIDE NADA CLINICO: solo impide que un documento que se contradice a si mismo
// llegue al paciente, y le dice al profesional por que. Es el mismo patron que el freno del cambio
// desfavorable (`freno-de-trayectoria`), que tambien vive en el servicio de ENTREGA y no en la pantalla:
// una pantalla se puede saltar, un servicio no.
//
// Y FRENA LAS MISMAS DOS HOJAS, por la misma razon: las que le cuentan al paciente COMO VA. El plan y las
// rutas dicen QUE HACER y se le siguen pudiendo entregar; bloquearlos dejaria al profesional sin nada que
// darle al paciente que tiene delante.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Las hojas que le cuentan al paciente como va. Solo estas se frenan (igual que el otro freno). */
const HOJAS_QUE_CUENTAN_EL_CAMBIO = new Set(["reporte", "hc"]);

// ═══ EL MENSAJE SE ACTUALIZO EL 2026-11-06, Y LO QUE CAMBIA ES QUE YA NO ES VERDAD LO QUE DECIA ═══
//
// Decia "hasta que la Direccion Cientifica defina cual rige". Gildardo YA respondio, con su v15: el DFI
// pasa a leer el IAE de la v7. Lo que falta es NUESTRO recalculo. Un freno que le echa la espera a quien
// ya contesto manda a la profesional a esperar a la persona equivocada, y encima no le dice que puede
// hacer hoy con el paciente que tiene delante.
//
// Y DICE LAS DOS COSAS QUE FALTABAN: que esto se destraba solo (no hay que pedir nada) y que la hoja del
// plan si se puede entregar. Esa hoja es la que dice QUE HACER, y no depende de esta cifra.
export const MENSAJE_CONTRADICCION =
  "Este documento se contradice: la edad biológica estimada de esta consulta y la lectura de " +
  "envejecimiento del diagnóstico funcional no dicen lo mismo, porque salen de dos versiones distintas " +
  "del motor. Se habilita cuando terminemos el ajuste del cálculo, que ya está en marcha: no tienes que " +
  "pedir nada. Mientras tanto sí puedes entregarle la hoja del plan, que no depende de esta cifra.";

/**
 * LO QUE EL DFI DICE DEL ENVEJECIMIENTO, por las TRES vias que lo dicen: la severidad del dominio 3, su
 * texto, y la ruta de desaceleracion. Mirar solo una dejaria fuera la mitad de los casos medidos.
 *
 * SE EXPORTA, Y ESA ES LA RAZON DE QUE SEA UNA FUNCION (2026-11-06). Este criterio lo necesitan DOS
 * lectores: el freno, que lo aplica sobre el snapshot SELLADO, y la simulacion del recalculo, que lo
 * aplica sobre el RECOMPUTADO para poder decir cuantas consultas se destraban. Escrito dos veces, el dia
 * que uno cambie la simulacion mediria otra cosa que el freno, y nadie lo notaria: es la misma razon por
 * la que el LE8 tiene una sola puerta.
 */
export function lecturaDelDfi(
  sevD3: number | null,
  lecturaD3: string | null,
  rutas: unknown,
): "acelerado" | "no acelerado" {
  const rs = Array.isArray(rutas) ? rutas.map(String) : [];
  return (sevD3 ?? 0) >= 2 || /acelerad/i.test(lecturaD3 ?? "") || rs.some((x) => x.startsWith("R4"))
    ? "acelerado"
    : "no acelerado";
}

/**
 * LO QUE LA EB-BIS DICE, en la banda de su tabla 3.
 *
 * EL CORTE SALE DEL MOTOR (`BANDA_IAE_ANIOS`) y no se escribe aqui: es el mismo que decide el texto que el
 * informe pinta arriba, asi que las dos no pueden divergir.
 */
export function lecturaDeLaEbBis(iae: number): "acelerado" | "acorde o desacelerado" {
  return iae >= BANDA_IAE_ANIOS ? "acelerado" : "acorde o desacelerado";
}

/** Las dos lecturas de una consulta, para poder decir en pantalla en qué se contradicen. */
export type LasDosLecturas = {
  /** El IAE de la EB-BIS v7, el que el informe pinta arriba. */
  iae: number;
  /** Lo que ese IAE dice, en la banda de su tabla 3. */
  segunLaEbBis: "acelerado" | "acorde o desacelerado";
  /** Lo que dicen el dominio 3 del DFI y las rutas, que salen del IAE de la v5. */
  segunElDfi: "acelerado" | "no acelerado";
};

type FilaDelSnapshot = {
  iae: number | null;
  sev_d3: number | null;
  lectura_d3: string | null;
  rutas: unknown;
  /** La version del motor del informe MAS RECIENTE, para decidir en TypeScript y no en el `where`. */
  motor: string | null;
};

/**
 * Las dos lecturas de envejecimiento de una consulta, o `null` si no se pueden comparar (sin IAE v7, sin
 * DFI, o sellada con un motor anterior a la v7, donde las dos salian de la misma fuente y no habia
 * contradiccion posible).
 *
 * SE LEE DEL SNAPSHOT SELLADO, no se recalcula: lo que hay que comparar es lo que el documento DICE, que
 * es lo que el paciente va a leer. Recalcularlo compararia otra cosa.
 */
export async function lasDosLecturasDeEnvejecimiento(
  evaluationId: string,
): Promise<LasDosLecturas | null> {
  // ═══ EL FILTRO DE VERSION SALIO DEL `where` EL 2026-11-06, Y ERA UN FRENO QUE NO SE SOLTABA ═══
  //
  // Estaba asi: `where ... and engine like '2.%' order by created_at desc limit 1`. En SQL el filtro va
  // ANTES del orden y del limite, asi que la consulta no traia "el ultimo informe de esta consulta":
  // traia **el ultimo informe 2.x**. Una reemision con el motor 3.0.0 (que es justo lo que el recalculo
  // produce, porque un snapshot sellado no se reescribe nunca: regla 7) dejaba el informe viejo ahi, y la
  // consulta seguia frenada para siempre con el documento nuevo ya emitido.
  //
  // O sea que el freno frenaba por el PASADO. Nadie lo habria visto desde la pantalla: el profesional
  // reemite, el documento nuevo no se contradice, y el aviso sigue saliendo sin explicacion.
  //
  // Ahora se trae el ultimo informe, SIN CONDICION DE VERSION, y la version se mira despues en TypeScript:
  // si el mas reciente no es 2.x, no hay dos lecturas que comparar y el freno no aplica. Lo vigila
  // `el-freno-se-suelta-al-reemitir.test.ts`.
  const [fila] = await db.execute<FilaDelSnapshot>(sql`
    select (r.snapshot->'indicators'->>'iae')::numeric as iae,
           (select (d->>'sev')::int from jsonb_array_elements(r.snapshot->'dfi'->'domains') d
             where d->>'id' = 'd3') as sev_d3,
           (select d->>'lectura' from jsonb_array_elements(r.snapshot->'dfi'->'domains') d
             where d->>'id' = 'd3') as lectura_d3,
           r.snapshot->'dfi'->'rutas' as rutas,
           r.snapshot->'versions'->>'engine' as motor
      from reports r
     where r.evaluation_id = ${evaluationId}
       and r.type = 'paciente'
     order by r.created_at desc
     limit 1`);
  if (!fila) return null;
  // SOLO LAS SELLADAS CON LA v7 (mayor 2): antes de ella las dos lecturas salian del MISMO calculo y no
  // podian discrepar; desde la 3.0.0 hay una sola lectura, la de la v7, y tampoco pueden. Frenar
  // cualquiera de las dos seria frenar por un defecto que ese documento no tiene.
  if (!(fila.motor ?? "").startsWith("2.")) return null;
  if (fila.iae == null) return null;

  const iae = Number(fila.iae);
  if (!Number.isFinite(iae)) return null;
  // Sin dominio 3 no hay segunda lectura que comparar.
  if (fila.sev_d3 == null && fila.lectura_d3 == null) return null;

  return {
    iae,
    segunLaEbBis: lecturaDeLaEbBis(iae),
    segunElDfi: lecturaDelDfi(fila.sev_d3, fila.lectura_d3, fila.rutas),
  };
}

/** ¿Las dos lecturas se contradicen? */
export function seContradicen(l: LasDosLecturas | null): boolean {
  if (!l) return false;
  return (l.segunLaEbBis === "acelerado") !== (l.segunElDfi === "acelerado");
}

/**
 * El motivo por el que NO se puede entregar, o null si se puede. Se consulta en el servicio de entrega,
 * no en la pantalla: una pantalla se puede saltar, un servicio no.
 */
export async function frenoDeLaContradiccion(
  evaluationId: string,
  documento: string,
): Promise<string | null> {
  if (!HOJAS_QUE_CUENTAN_EL_CAMBIO.has(documento)) return null;
  const lecturas = await lasDosLecturasDeEnvejecimiento(evaluationId);
  return seContradicen(lecturas) ? MENSAJE_CONTRADICCION : null;
}
