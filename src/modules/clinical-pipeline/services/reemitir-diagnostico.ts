import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { appError, err, ok, type Result } from "@/core/errors";
import { db, type DbTransaction } from "@/db";
import { diagnoses, professionalProfiles, reports } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import type { Profession } from "@/modules/auth/admin-validations";
import { ENGINE_VERSION } from "@/clinical-engine";

import { buildEmissionVersions } from "../emission-versions";
import { getDiagnosisEmissionVersions } from "@/modules/diagnoses/data/results-reader";
import { readActiveModel, readPipelineInputs } from "../data/pipeline-reader";
import { simularConCienciaDeHoy } from "../data/simular-con-ciencia-de-hoy";
import { vigenciaEmision } from "../emision-vigencia";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// REEMITIR EL DIAGNOSTICO, SIN TOCAR EL TRATAMIENTO  ·  recalibracion_ciencia
//
// ═══ DE DONDE SALE, Y QUE DESCARTO ═══
//
// Su §6 (EB-BIS v7, 2026-10-26): *"Recalcular con la v7 todas las evaluaciones guardadas... Los informes
// ya entregados a pacientes no se modifican; los nuevos informes se emiten con la v7."*
//
// EL CAMINO OBVIO ERA EL FLUJO DE CORRECCION, y se descarto con una razon medida (Santiago, 2026-10-29).
// `correctEvaluation` crea una evaluacion NUEVA y le corre el pipeline entero, asi que el tratamiento
// nace otra vez con la sugerencia del MODELO: correrlo sobre las 351 evaluaciones limpias habria
// reemplazado la prescripcion de 351 pacientes reales por la del motor. Su propio guard ya lo decia
// ("regenerar una version IDENTICA rehace la cascada, PIERDE EL TRATAMIENTO e invalida la aprobacion"), y
// ese freno era exactamente el que habia que respetar.
//
// ═══ POR QUE NO HACE FALTA NI MIGRACION NI COLUMNA DE SUPERSEDED ═══
//
// Porque el mecanismo YA ES el de la casa: para una evaluacion, el diagnostico y el reporte VIGENTES son
// la ULTIMA fila, y los dos lectores ya ordenan por `created_at desc` y toman una
// (`reports-repository.getReportDispatch`, `results-reader`). `reports` ya tiene varias filas por
// evaluacion en produccion (434 filas sobre 429 evaluaciones) y el comentario del repositorio lo declara:
// *"si una correccion supero a un reporte enviado, se muestra el vigente"*.
//
// Asi que reemitir es INSERTAR, no marcar. Y eso trae tres propiedades que una columna no daria:
//   · Lo sellado no se toca NUNCA (regla 7). El diagnostico v5 sigue entero, con su version y su firma.
//   · El informe ENVIADO tampoco: es una fila anterior, con su `sent_at` y su `storage_path` intactos.
//   · Y no hay marca que acordarse de apagar: lo vigente se DERIVA de cual es la ultima fila.
//
// ═══ EL TRATAMIENTO NO SE TOCA, Y SU MARCA TAMBIEN ES DERIVADA ═══
//
// `treatments.diagnosis_id` apunta al diagnostico VIEJO, y ahi se queda. De eso sale, sin columna nueva,
// la respuesta a la pregunta (a) de Santiago: un tratamiento cuyo `diagnosis_id` no es el diagnostico
// vigente de su evaluacion es un tratamiento apoyado en una cifra que ya no es la vigente. Se deriva, se
// puede mostrar, y se apaga solo si algun dia ese tratamiento se rehace.
//
// QUE DEL TRATAMIENTO DEPENDIA DE LA EB-BIS (medido, no supuesto): los cuatro motores de tratamiento
// (`atlas-geb`, `atlas-tratamiento`, `atlas-tratamiento-nutri`, `atlas-asesoria-macro`) NO leen el IAE,
// asi que las kcal, la proteina, la grasa, la distribucion, el menu y la lista de intercambio son
// independientes. Lo que si depende va en el payload del audit, para que quede dicho caso por caso.
//
// ═══ SE REUSA LA MISMA SIMULACION QUE EL PROFESIONAL YA VE ═══
//
// `simularConCienciaDeHoy` es la que alimenta el aviso de reemision en pantalla. Reemitir con OTRA ruta
// de calculo dejaria que el preview y lo que se persiste discrepen, que es el defecto que el candado de
// los dos canales del plan existe para impedir. Una sola fuente, dos usos.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type ReemitirInput = {
  evaluationId: string;
  /** Por que se reemite. Hoy solo la recalibracion cientifica; el enum ya lo preve. */
  motivo: "recalibracion_ciencia";
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type ReemitirResult = {
  diagnosisIdAnterior: string;
  diagnosisIdNuevo: string;
  reportIdNuevo: string;
  versionAnterior: string;
  versionNueva: string;
  /** El informe enviado que NO se toco, si habia uno. */
  informeEnviadoIntacto: boolean;
  /** El tratamiento que queda apoyado en el diagnostico anterior, si habia uno. */
  tratamientoApoyadoEnElAnterior: boolean;
};

export async function reemitirDiagnostico(
  input: ReemitirInput,
): Promise<Result<ReemitirResult>> {
  // ── 1. ¿HAY ALGO QUE REEMITIR? ───────────────────────────────────────────────────────────────────
  //
  // Es el analogo del guard de la correccion, pero en el eje correcto: alli se exige que cambie un
  // INSUMO, y aqui un insumo no cambia nunca (eso es una recalibracion: los mismos datos, otra ciencia).
  // Lo que se exige es DESFASE DE VERSION. Sin el, reemitir crearia una fila identica y cada corrida
  // duplicaria el historial sin cambiar una cifra.
  // La vigencia se COMPUTA AL LEER (nunca se sella): es la distancia entre con que se emitio y que rige
  // hoy. Se mide sobre el MISMO sellado que mira la pantalla, para que el guard y el aviso no puedan
  // discrepar sobre si este documento esta al dia.
  const sellado = await getDiagnosisEmissionVersions(input.evaluationId);
  if (sellado.engineVersion == null) {
    return err(appError("not_found", "Esa evaluación no tiene un diagnóstico que reemitir."));
  }
  const vigencia = vigenciaEmision({
    engineVersion: sellado.engineVersion,
    emissionVersions: sellado.emissionVersions,
  });
  if (vigencia.alDia) {
    return err(
      appError(
        "validation",
        "Ese diagnóstico ya está al día con la ciencia vigente: no hay nada que reemitir.",
      ),
    );
  }

  // ── 2. EL RESULTADO CON LA CIENCIA DE HOY ────────────────────────────────────────────────────────
  //
  // La MISMA funcion que alimenta el aviso en pantalla. Si devuelve null no se reemite: faltan insumos, y
  // sellar un diagnostico a medias es peor que dejar el anterior marcado como desfasado.
  const output = await simularConCienciaDeHoy(input.evaluationId);
  if (!output) {
    return err(
      appError(
        "validation",
        "No se pudo recalcular esta evaluación con la ciencia de hoy (faltan insumos). El diagnóstico anterior queda como está, marcado como desfasado.",
      ),
    );
  }

  const [inputs, model] = await Promise.all([
    readPipelineInputs(input.evaluationId),
    readActiveModel(),
  ]);
  if (!inputs || !model) {
    return err(appError("internal", "No se pudieron leer los insumos de la evaluación."));
  }

  // ── 3. UNA TRANSACCION: diagnostico nuevo + snapshot nuevo + audit INLINE ────────────────────────
  return await db.transaction(async (tx: DbTransaction) => {
    // El diagnostico VIGENTE de hoy, que pasa a ser el anterior. Se lee DENTRO de la transaccion: entre
    // el guard y la escritura alguien pudo haber generado otro.
    const [anterior] = await tx
      .select({
        id: diagnoses.id,
        engineVersion: diagnoses.engineVersion,
        createdAt: diagnoses.createdAt,
      })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .orderBy(desc(diagnoses.createdAt))
      .limit(1);
    if (!anterior) {
      return err(appError("not_found", "Esa evaluación no tiene un diagnóstico que reemitir."));
    }

    const [perfilDelActor] = await tx
      .select({ profession: professionalProfiles.profession })
      .from(professionalProfiles)
      .where(eq(professionalProfiles.profileId, input.actorId))
      .limit(1);

    const [nuevo] = await tx
      .insert(diagnoses)
      .values({
        evaluationId: input.evaluationId,
        efrStateNumber: output.efrPhenotype.stateNumber,
        diagnosisName: output.efrPhenotype.diagnostico,
        // LA CONSTELACION COMPLETA, igual que al nacer (regla 7): un diagnostico reemitido es un registro
        // clinico como cualquier otro y tiene que poder reconstruirse solo.
        engineVersion: output.versions.engine,
        modelVersionId: model.id,
        rulesVersion: output.versions.rules,
        surveyVersionId: inputs.surveyVersionId,
        emissionVersions: buildEmissionVersions(),
        // LA FIRMA ES DE QUIEN REEMITE, no se hereda del diagnostico anterior: el acto es de hoy y lo
        // ejecuta quien corre la recalibracion. Heredar la firma del profesional que atendio en agosto
        // le atribuiria un acto que no hizo.
        confirmedBy: input.actorId,
        confirmedAt: sql`now()`,
        confirmedProfession: (perfilDelActor?.profession ?? null) as Profession | null,
      })
      .returning({ id: diagnoses.id });

    // EL SNAPSHOT VIAJA EN UNA FILA NUEVA DE `reports`, que es donde la pantalla lee el resultado. Sin
    // esto, el diagnostico nuevo existiria y la pantalla seguiria mostrando las cifras de la v5: una
    // pieza escrita y no renderizada, que es el defecto que este proyecto ya repitio tres veces.
    const [reporteNuevo] = await tx
      .insert(reports)
      .values({
        evaluationId: input.evaluationId,
        patientId: inputs.patientId,
        type: "paciente",
        // NACE EN BORRADOR, y eso responde la pregunta (b) de Santiago: su §6 dice que los informes
        // nuevos se emiten con la v7, y este es uno nuevo. El ENVIADO es una fila anterior y se queda
        // como esta, con su `sent_at` y su PDF en Storage: no se reenvia (decision de Santiago).
        status: "draft",
        snapshot: {
          ...output,
          // Se conserva lo que el pipeline congela junto al EngineOutput, leido del sellado anterior: el
          // contenido de las rutas y los caveats de validez son el acto clinico de ESE dia y no se
          // recalculan aqui. Lo que cambia es la ciencia, no lo que se prescribio.
          surveyVersionId: inputs.surveyVersionId,
        },
      })
      .returning({ id: reports.id });

    // ── 4. EL RASTRO (pregunta (c) de Santiago), INLINE y nunca por el bus (regla dura 8) ──────────
    await recordAudit(tx, {
      event: "diagnosis.reemitted",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "diagnosis",
      entityId: nuevo.id,
      payload: {
        evaluation_id: input.evaluationId,
        motivo: input.motivo,
        diagnosis_anterior: anterior.id,
        engine_version_anterior: anterior.engineVersion,
        engine_version_nueva: output.versions.engine,
        // QUE NO SE TOCO, dicho explicitamente y no por omision: dentro de un año, "el tratamiento no
        // aparece en el payload" no distingue entre "no se toco" y "nadie lo registro".
        tratamiento_no_modificado: true,
        informe_enviado_no_modificado: true,
        // Y lo que del tratamiento SI dependia de la cifra vieja, caso por caso: es la respuesta a (a), y
        // va en el rastro para que un tratamiento apoyado en una EB-BIS v5 sea buscable.
        depende_de_la_eb_bis: [
          "rutas R1 y R4 (iae > 5)",
          "dominio 3 del DFI (envejecimiento) y, por el, el riesgo integrado",
          "nutraceutico Coenzima Q10 sugerido (iae > 5), sellado en protocol_suggested",
          "metas de nutricion y ejercicio que citan la reduccion del IAE",
        ],
        no_depende_de_la_eb_bis: [
          "kcal, proteina, grasa, distribucion, menu y lista de intercambio (los cuatro motores de tratamiento no leen el IAE)",
        ],
      },
      ip: input.ip,
    });

    return ok({
      diagnosisIdAnterior: anterior.id,
      diagnosisIdNuevo: nuevo.id,
      reportIdNuevo: reporteNuevo.id,
      versionAnterior: anterior.engineVersion,
      versionNueva: output.versions.engine,
      informeEnviadoIntacto: true,
      tratamientoApoyadoEnElAnterior: true,
    });
  });
}

/** Re-exportado para que el llamador pueda rotular sin importar el motor entero. */
export const VERSION_DEL_MOTOR_HOY = ENGINE_VERSION;
