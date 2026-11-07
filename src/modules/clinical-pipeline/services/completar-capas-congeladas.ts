import "server-only";

import { eq, sql } from "drizzle-orm";

import { resolveRutasContent } from "@/clinical-engine/rutas-content";
import { appError, err, ok, type Result } from "@/core/errors";
import { db, type DbTransaction } from "@/db";
import { diagnoses, reports } from "@/db/schema";
import { getSealedValidityCaveats } from "@/modules/bis-intake/data/bis-conditions-reader";
import { recordAudit } from "@/modules/audit/log";

import { readEfrContent } from "../data/pipeline-reader";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COMPLETAR LAS CAPAS CONGELADAS QUE LA REEMISION NO ESCRIBIO  ·  2026-11-07
//
// ═══ QUE ES ESTO, DICHO SIN ADORNO ═══
//
// La reparacion de un defecto nuestro. La reemision del 7 de noviembre escribio 424 informes sin las tres
// capas que el pipeline congela junto al EngineOutput (`rutasContent`, `efrContent`, `validityCaveats`), y
// cinco superficies quedaron vacias sin que nada fallara. Esto escribe lo que faltaba.
//
// ═══ POR QUE ES UN UPDATE, QUE ES LO QUE ESTE PROYECTO NO HACE ═══
//
// `reports` se trata como inmutable y esta bien que sea asi. Tres cosas hacen de esto la excepcion, y las
// tres son verificables en la propia fila, no un argumento:
//
//   1. NO SE CAMBIA NI UNA CIFRA. El parche solo AÑADE las claves ausentes (`||` de jsonb sobre claves que
//      no existen). Si alguna estuviera presente, no se toca: se calcula solo lo que falta.
//   2. SON FILAS DE HOY, EN BORRADOR, QUE NADIE ENVIO. Nacieron hace minutos de nuestra escritura a
//      medias; no hay un documento en manos de un paciente que esto contradiga.
//   3. SOLO LAS 3.x. Un snapshot de otra era tampoco trae estas capas, y esos NO se tocan: nacieron
//      cuando las capas no existian, y reescribir el pasado es lo que la regla 7 prohibe.
//
// LA ALTERNATIVA ERA PEOR. Reemitir otra vez añade un diagnostico y un informe mas por consulta (la
// pantalla diria "reemitido 2 veces") para tapar un error nuestro, y encima no se puede: con la version ya
// al dia, el guard responde "no hay nada que reemitir".
//
// Y LO QUE NO SE HIZO, que era la salida facil: que el lector RESUELVA las rutas cuando faltan. Eso deja
// dos fuentes para el mismo dato y rompe la garantia de congelarlo (el dia que Gildardo cambie el
// contenido de una ruta, los diagnosticos viejos empezarian a mostrar el nuevo). Una capa congelada se
// escribe una vez; si falta, se escribe, no se adivina al leer.
//
// ═══ SE CALCULA CON LAS MISMAS TRES FUNCIONES, Y DESDE EL PROPIO SNAPSHOT ═══
//
// `resolveRutasContent` sobre las rutas QUE ESA FILA YA TIENE sellada, y `readEfrContent` con las bandas
// de SU estado y el `model_version_id` de SU diagnostico, no el del modelo activo de hoy. Asi la capa que
// se escribe es la que le correspondia a ese documento, no la de hoy.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type CompletarCapasInput = {
  reportId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type CompletarCapasResult = {
  evaluationId: string;
  /** Las capas que se escribieron. */
  escritas: string[];
};

type FilaDelInforme = {
  evaluation_id: string;
  motor: string | null;
  rutas: unknown;
  bands: unknown;
  tiene_rutas: boolean;
  tiene_efr: boolean;
  tiene_caveats: boolean;
  es_vigente: boolean;
};

export async function completarCapasCongeladas(
  input: CompletarCapasInput,
): Promise<Result<CompletarCapasResult>> {
  // ── 1. LA FILA, CON TODO LO QUE DECIDE SI SE PUEDE TOCAR ─────────────────────────────────────────
  const [fila] = await db.execute<FilaDelInforme>(sql`
    select r.evaluation_id,
           r.snapshot->'versions'->>'engine' as motor,
           r.snapshot->'dfi'->'rutas' as rutas,
           r.snapshot->'efrPhenotype'->'bands' as bands,
           jsonb_exists(r.snapshot, 'rutasContent') as tiene_rutas,
           jsonb_exists(r.snapshot, 'efrContent') as tiene_efr,
           jsonb_exists(r.snapshot, 'validityCaveats') as tiene_caveats,
           r.created_at = (
             select max(r2.created_at) from reports r2
              where r2.evaluation_id = r.evaluation_id and r2.type = 'paciente'
           ) as es_vigente
      from reports r
     where r.id = ${input.reportId} and r.type = 'paciente'`);

  if (!fila) return err(appError("not_found", "Ese informe no existe."));
  // EL VIGENTE Y NADA MAS: una version anterior no es lo que la pantalla lee, y repararla seria tocar
  // historia por nada.
  if (!fila.es_vigente) {
    return err(appError("validation", "Ese informe ya fue sucedido por otro: no es el vigente."));
  }
  if (!(fila.motor ?? "").startsWith("3.")) {
    return err(
      appError(
        "validation",
        "Ese informe se emitió con una versión anterior del motor, cuando estas capas no existían: no se reescribe.",
      ),
    );
  }
  if (fila.tiene_rutas && fila.tiene_efr && fila.tiene_caveats) {
    return err(appError("validation", "Ese informe ya tiene las tres capas: no hay nada que completar."));
  }

  // ── 2. EL DIAGNOSTICO VIGENTE, por su `model_version_id` ─────────────────────────────────────────
  const [dx] = await db
    .select({ id: diagnoses.id, modelVersionId: diagnoses.modelVersionId })
    .from(diagnoses)
    .where(eq(diagnoses.evaluationId, fila.evaluation_id))
    .orderBy(sql`${diagnoses.createdAt} desc`)
    .limit(1);
  if (!dx) return err(appError("not_found", "Esa evaluación no tiene diagnóstico."));

  // ── 3. LAS CAPAS QUE FALTAN, UNA POR UNA ────────────────────────────────────────────────────────
  const parche: Record<string, unknown> = {};

  if (!fila.tiene_rutas) {
    // DE LAS RUTAS QUE ESA FILA YA TIENE SELLADAS: el contenido tiene que corresponder a esos ids.
    const ids = Array.isArray(fila.rutas) ? fila.rutas.map(String) : [];
    parche.rutasContent = resolveRutasContent(ids);
  }

  if (!fila.tiene_efr) {
    const bands = fila.bands as { ifc: number; irc: number; ffmi: number; fmi: number } | null;
    if (!bands) {
      return err(
        appError("validation", "Ese snapshot no trae las bandas del estado EFR: no se puede resolver."),
      );
    }
    const efrContent = await readEfrContent(dx.modelVersionId, bands);
    if (!efrContent) {
      // NO SE ESCRIBE NADA A MEDIAS, igual que en el pipeline: un snapshot incompleto es lo que causo esto.
      return err(
        appError("internal", "El registry no tiene el contenido del estado EFR de ese diagnóstico."),
      );
    }
    parche.efrContent = efrContent;
  }

  if (!fila.tiene_caveats) {
    // DE SU PROPIA FUENTE SELLADA (las condiciones de la toma BIS), no del intake vivo.
    parche.validityCaveats = await getSealedValidityCaveats(fila.evaluation_id);
  }

  // ── 4. UNA TRANSACCION: el parche + el rastro INLINE (regla dura 8) ─────────────────────────────
  return await db.transaction(async (tx: DbTransaction) => {
    await tx
      .update(reports)
      // `||` AÑADE Y NO REEMPLAZA: solo viajan las claves ausentes, asi que ninguna cifra sellada puede
      // moverse ni por error de calculo ni por un parche mal armado.
      .set({ snapshot: sql`${reports.snapshot} || ${JSON.stringify(parche)}::jsonb` })
      .where(eq(reports.id, input.reportId));

    await recordAudit(tx, {
      event: "report.frozen_layers_completed",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "report",
      entityId: input.reportId,
      payload: {
        evaluation_id: fila.evaluation_id,
        diagnosis_vigente: dx.id,
        motor_sellado: fila.motor,
        capas_escritas: Object.keys(parche),
        // QUE NO SE TOCO, dicho y no deducido: el parche solo añade claves ausentes.
        cifras_modificadas: "ninguna: el parche solo añade las claves ausentes",
        motivo:
          "la reemision del 2026-11-07 escribio el snapshot sin las capas congeladas (defecto corregido en reemitir-diagnostico)",
      },
      ip: input.ip,
    });

    return ok({ evaluationId: fila.evaluation_id, escritas: Object.keys(parche) });
  });
}
