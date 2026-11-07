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
// ═══ QUE SE REPARA ═══
//
// La reemision del 7 de noviembre escribio 422 informes sin las tres capas que el pipeline congela junto
// al EngineOutput (`rutasContent`, `efrContent`, `validityCaveats`). Los lectores las toman con `?? []` /
// `?? null`, asi que nada fallo y cinco superficies quedaron vacias: las tarjetas de ruta de Tratamiento,
// la hoja de rutas imprimible, las rutas y remisiones del informe del paciente, las remisiones EXIGIDAS de
// la historia clinica y la evidencia del estado EFR. Mas la reserva de validez de la medicion.
//
// ═══ SE CORRIGE POR VERSION NUEVA, Y LA PRIMERA VERSION DE ESTO ESTABA MAL ═══
//
// Nacio como un `update` que añadia las tres claves con `||` de jsonb. La base lo rechazo en produccion:
// `prevent_report_snapshot_mutation` (0003, extendido en la 0010, 0033 y 0034) lanza
// *"reports.snapshot es inmutable: no se permite modificarlo"*, y tambien prohibe el DELETE. El trigger
// hizo exactamente su trabajo.
//
// Y TENIA RAZON LA BASE, NO YO. El argumento que escribi (que el parche solo añade, que son filas de hoy,
// que nadie las envio) describe por que el riesgo era bajo, no por que la regla no aplicaba. La regla de
// esta casa es que lo sellado se SUCEDE, no se reescribe, y existe para que nadie tenga que confiar en un
// argumento caso por caso. Asi que esto INSERTA una fila nueva de `reports` que sucede a la de la
// reemision, que es el mismo mecanismo de la reemision misma y el de la correccion.
//
// ═══ NINGUNA CIFRA SE MUEVE, Y AHORA ES VERIFICABLE EN LA PROPIA FILA ═══
//
// El snapshot nuevo es el ANTERIOR COPIADO ENTERO mas las claves que faltaban (`{ ...viejo, ...capas }`),
// no un snapshot recalculado. El motor no vuelve a correr: el diagnostico es el mismo, su version es la
// misma, y las cifras son byte a byte las que ese documento ya tenia. Lo unico que aparece es el contenido
// clinico que debio congelarse con el.
//
// NO SE CREA UN DIAGNOSTICO NUEVO. Reemitir es un acto clinico con su firma y su rastro; esto es terminar
// una escritura. La marca de pantalla ("Reemitido el ... ") cuenta filas de `diagnoses`, asi que seguira
// diciendo una reemision y no dos, que es la verdad.
//
// ═══ LAS TRES CAPAS SE RESUELVEN DESDE ESA FILA, NO CON LO DE HOY ═══
//
// Las rutas, de los ids que ESE snapshot ya tiene sellados. El estado EFR, con las bandas de SU
// diagnostico y su `model_version_id`, no el del modelo activo. Los caveats, de su propia fuente sellada
// (las condiciones de la toma BIS). Si el registry no tiene el estado EFR, no se escribe nada: un snapshot
// a medias es justo lo que causo esto.
//
// ═══ Y VIAJAN TAMBIEN LAS TRES COSAS QUE UNA FILA NUEVA PIERDE SI NADIE LAS COPIA ═══
//
// La banda sellada de trayectoria y su acuse (si no, el informe nuevo seria la via para saltarse el freno
// del cambio desfavorable: ya estaba escrito en `emitirVersionNueva` y en la reemision), y la nota del
// profesional de esa fila. Lo que NO viaja: `storage_path` y `sent_at`, que son del documento que SALIO.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type CompletarCapasInput = {
  reportId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type CompletarCapasResult = {
  evaluationId: string;
  /** El informe nuevo que sucede al de la reemision. */
  reportIdNuevo: string;
  /** Las capas que se escribieron. */
  escritas: string[];
};

type FilaDelInforme = {
  evaluation_id: string;
  patient_id: string;
  motor: string | null;
  rutas: unknown;
  bands: unknown;
  snapshot: Record<string, unknown>;
  professional_notes: string | null;
  trajectory: unknown;
  trajectory_communicated_at: string | null;
  trajectory_communicated_by: string | null;
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
           r.patient_id,
           r.snapshot->'versions'->>'engine' as motor,
           r.snapshot->'dfi'->'rutas' as rutas,
           r.snapshot->'efrPhenotype'->'bands' as bands,
           r.snapshot,
           r.professional_notes,
           r.trajectory,
           r.trajectory_communicated_at,
           r.trajectory_communicated_by,
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
  // EL VIGENTE Y NADA MAS: una version anterior no es lo que la pantalla lee, y sucederla no arreglaria
  // nada (la fila de arriba seguiria sin capas).
  if (!fila.es_vigente) {
    return err(appError("validation", "Ese informe ya fue sucedido por otro: no es el vigente."));
  }
  if (!(fila.motor ?? "").startsWith("3.")) {
    return err(
      appError(
        "validation",
        "Ese informe se emitió con una versión anterior del motor, cuando estas capas no existían: no se completa.",
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
  const capas: Record<string, unknown> = {};

  if (!fila.tiene_rutas) {
    // DE LAS RUTAS QUE ESA FILA YA TIENE SELLADAS: el contenido tiene que corresponder a esos ids.
    const ids = Array.isArray(fila.rutas) ? fila.rutas.map(String) : [];
    capas.rutasContent = resolveRutasContent(ids);
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
      return err(
        appError("internal", "El registry no tiene el contenido del estado EFR de ese diagnóstico."),
      );
    }
    capas.efrContent = efrContent;
  }

  if (!fila.tiene_caveats) {
    // DE SU PROPIA FUENTE SELLADA (las condiciones de la toma BIS), no del intake vivo.
    capas.validityCaveats = await getSealedValidityCaveats(fila.evaluation_id);
  }

  // ── 4. UNA TRANSACCION: la fila nueva + el rastro INLINE (regla dura 8) ─────────────────────────
  //
  // CON `try/catch`, Y NO POR COSTUMBRE: la primera version de esto tumbo la pantalla con un 500 porque
  // el trigger lanzo y nadie lo atrapo. Una action devuelve `Result` (regla de CLAUDE.md); y aqui ademas
  // la tanda tiene que poder decir CUAL fila fallo y seguir siendo repetible.
  try {
    return await db.transaction(async (tx: DbTransaction) => {
      const [nuevo] = await tx
        .insert(reports)
        .values({
          evaluationId: fila.evaluation_id,
          patientId: fila.patient_id,
          type: "paciente",
          // EN BORRADOR, como la reemision: no es un documento que salga, es el mismo documento completo.
          status: "draft",
          // EL ANTERIOR, ENTERO, MAS LAS CLAVES QUE FALTABAN. El motor no vuelve a correr.
          snapshot: { ...fila.snapshot, ...capas },
          professionalNotes: fila.professional_notes,
          trajectory: (fila.trajectory ?? null) as object | null,
          trajectoryCommunicatedAt: fila.trajectory_communicated_at
            ? new Date(fila.trajectory_communicated_at)
            : null,
          trajectoryCommunicatedBy: fila.trajectory_communicated_by,
        })
        .returning({ id: reports.id });

      await recordAudit(tx, {
        event: "report.frozen_layers_completed",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "report",
        entityId: nuevo.id,
        payload: {
          evaluation_id: fila.evaluation_id,
          informe_anterior: input.reportId,
          diagnosis_vigente: dx.id,
          motor_sellado: fila.motor,
          capas_escritas: Object.keys(capas),
          // QUE NO SE MOVIO, dicho y no deducido: dentro de un año, la ausencia no lo distingue.
          cifras_modificadas:
            "ninguna: el snapshot anterior se copia entero y solo se añaden las claves ausentes",
          diagnostico_nuevo: false,
          motivo:
            "la reemision del 2026-11-07 escribio el snapshot sin las capas congeladas (defecto corregido en reemitir-diagnostico)",
        },
        ip: input.ip,
      });

      return ok({
        evaluationId: fila.evaluation_id,
        reportIdNuevo: nuevo.id,
        escritas: Object.keys(capas),
      });
    });
  } catch (e) {
    // EL MENSAJE DE LA BASE SE CONSERVA, RECORTADO: si un trigger vuelve a negarse, la tanda tiene que
    // decir por que y no "algo fallo". Drizzle envuelve el error de Postgres, asi que el motivo real vive
    // en la causa.
    const causa = (e as { cause?: { message?: string } }).cause?.message;
    return err(
      appError(
        "internal",
        `La base no aceptó la fila nueva: ${(causa ?? (e as Error).message).slice(0, 160)}`,
      ),
    );
  }
}
