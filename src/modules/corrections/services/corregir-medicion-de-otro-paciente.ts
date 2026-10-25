import "server-only";

import * as Sentry from "@sentry/nextjs";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  bisMeasurements,
  clinicalCorrections,
  evaluationBisIntake,
  evaluations,
  professionalProfiles,
  surveyAnswers,
  surveyResponses,
} from "@/db/schema";
import { appError, err, ok, type Result } from "@/core/errors";
import { CONSENT_VERSION } from "@/modules/consent/versions";
import { recordAudit } from "@/modules/audit/log";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL CASO 6: LA MEDICION ERA DE OTRA PERSONA  (Santiago, 2026-10-24)
//
// `docs/PLAN_FLUJO_CORRECCION.md` lo aparto el primer dia: *"no es 'reimportar mi medicion', es 'esta
// medicion es de OTRA persona' (contaminacion cruzada de PHI). Es un problema de integridad mas serio
// (¿se borra la medicion mal asignada? ¿a donde va?) ... Se separa; no se resuelve con el mismo
// versionado."* El barrido del 24 de octubre lo saco de lo hipotetico: 10 grupos reales, 4 repartidos
// entre pacientes DISTINTOS.
//
// ═══ POR QUE ES UN SERVICIO APARTE Y NO UNA VARIANTE DE `correctEvaluation` ═══
//
// Porque hace lo CONTRARIO en el unico paso que define a la otra. `correctEvaluation` COPIA la medicion y
// verifica en tiempo de ejecucion que la copia sea identica al origen (su condicion 1): la toma fisica
// ocurrio una vez y viaja con todas las versiones. Aqui la toma fisica NO OCURRIO en este paciente, asi
// que arrastrarla seria propagar el error a la version nueva.
//
// Meterlo como una bandera de `correctEvaluation` habria dejado su cuerpo con dos caminos opuestos para
// la medicion, la encuesta, el motor y el pipeline. Un `if` de esos es donde se cuela el dia que alguien
// toque el camino bueno y no vea el otro.
//
// ═══ LO QUE PASA CON CADA PIEZA, Y POR QUE ═══
//
//   LA MEDICION                 se queda en la version vieja, MARCADA como no-de-este-paciente (0226).
//                               No se borra: nada se borra en una historia clinica. Y la marca es lo que
//                               deja al dueno de verdad importar su propio archivo pese al freno de la
//                               0225, que compara la huella de los crudos.
//   EL DIAGNOSTICO SELLADO      se queda en la version vieja, que el trigger marca REEMPLAZADA. Ahi sigue
//                               legible, con su banda y su firma, como el registro de lo que se emitio.
//                               Quien firmo, firmo: eso es un hecho que ocurrio.
//   LA VERSION NUEVA            nace SIN medicion y por tanto SIN diagnostico. Su pendiente dice "Montar
//                               BIS" por la regla que ya existe (`accionDeEvaluacion`), sin un caso nuevo.
//   LA ENCUESTA                 viaja tal cual: son las respuestas DEL PACIENTE, y no es lo que estaba mal.
//   LA FUERZA PRENSIL           viaja: la midio el profesional en ESTE paciente, con su dinamometro. Es el
//   Y EL PESO META              dato que mas facil se perderia aqui, y se perderia en silencio.
//   LAS CONDICIONES DE LA TOMA  viajan, pero vuelven a quedar PENDIENTES (`conditions_registered_at` a
//                               null). El contenido se conserva porque describe al paciente (el
//                               marcapasos es suyo, y bajar esa compuerta seria peligroso), pero la mitad
//                               que describe el MOMENTO de la toma ("fue al bano antes", la semana del
//                               ciclo) es la de una toma que no era esta. Asi que se conservan y se piden
//                               de nuevo: no se pierde nada y nadie hereda un sello que no le consta.
//
// ═══ QUIEN LO DECIDE ═══
//
// EL PROFESIONAL ASIGNADO, con motivo, y admin NO (lectura de Santiago, y es la misma regla que
// `correctEvaluation` y `approveProtocol`: es un acto clinico). Admin puede ver y puede reasignar; decir
// de quien es una medicion es leer la consulta, y eso lo hizo una persona que estaba ahi.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

type Actor = { actorId: string; actorEmail: string; ip: string | null };

export type MedicionDeOtroPacienteInput = {
  /** La evaluacion VIGENTE cuya medicion no es de este paciente. */
  evaluationId: string;
  /** Motivo obligatorio: dentro de un ano alguien va a preguntar por que esta historia cambio. */
  reason: string;
  /** Confirmacion explicita: el acto reemplaza una version sellada y no se deshace. */
  confirmed: boolean;
};

export type MedicionDeOtroPacienteResult = {
  oldEvaluationId: string;
  /** La version nueva, sin medicion: a donde hay que ir a montar la buena. */
  newEvaluationId: string;
  /** La medicion que quedo marcada, para poder nombrarla en el aviso y en la auditoria. */
  measurementId: string;
};

export async function corregirMedicionDeOtroPaciente(
  input: MedicionDeOtroPacienteInput,
  actor: Actor,
): Promise<Result<MedicionDeOtroPacienteResult>> {
  // --- Puertas que no escriben: fallan barato y con una frase, antes de abrir la transaccion ---
  if (!input.confirmed) {
    return err(appError("validation", "Esta corrección requiere confirmación explícita."));
  }
  if (!input.reason.trim()) {
    return err(appError("validation", "Escribe el motivo para continuar."));
  }

  const [ev] = await db
    .select({
      id: evaluations.id,
      patientId: evaluations.patientId,
      professionalId: evaluations.professionalId,
      organizationId: evaluations.organizationId,
      type: evaluations.type,
      supersededAt: evaluations.supersededAt,
      // Los datos de la CONSULTA viajan con la correccion, por lo mismo que en `correctEvaluation`: son
      // del ENCUENTRO, no del perfil, y perderlos borraria la caracterizacion con la que estratifica el
      // observatorio. Releerlos del perfil fabricaria un historico falso.
      declaredFirstName: evaluations.declaredFirstName,
      declaredLastName: evaluations.declaredLastName,
      reasonForVisit: evaluations.reasonForVisit,
      educationLevel: evaluations.educationLevel,
      occupation: evaluations.occupation,
      maritalStatus: evaluations.maritalStatus,
      socioeconomicStratum: evaluations.socioeconomicStratum,
      ethnicity: evaluations.ethnicity,
      ancestry: evaluations.ancestry,
      weightGoalKg: evaluations.weightGoalKg,
      weightGoalSetIn: evaluations.weightGoalSetIn,
    })
    .from(evaluations)
    .where(eq(evaluations.id, input.evaluationId))
    .limit(1);
  if (!ev) return err(appError("not_found", "Evaluación no encontrada."));
  if (ev.supersededAt) {
    return err(
      appError("conflict", "Esta evaluación ya fue corregida; trabaja sobre la versión vigente."),
    );
  }

  // Puerta de asignacion (defensa en profundidad de la regla dura 3: la autorizacion vive en la policy).
  // Admin NO: es un acto clinico. Se resuelve por el owner, igual que `correctEvaluation`.
  const [prof] = await db
    .select({ id: professionalProfiles.id })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.profileId, actor.actorId))
    .limit(1);
  if (!prof || prof.id !== ev.professionalId) {
    return err(appError("forbidden", "No estás asignado a este paciente."));
  }

  // LA MEDICION QUE SE VA A DESLIGAR. Sin ninguna no hay nada que hacer aqui, y decirlo asi evita que el
  // profesional use este camino para "empezar de cero" una consulta que simplemente no tiene BIS.
  const [medicion] = await db
    .select({ id: bisMeasurements.id, marcada: bisMeasurements.noEsDelPacienteAt })
    .from(bisMeasurements)
    .where(eq(bisMeasurements.evaluationId, input.evaluationId))
    .orderBy(desc(bisMeasurements.measurementDate))
    .limit(1);
  if (!medicion) {
    return err(
      appError(
        "validation",
        "Esta consulta no tiene ninguna medición del equipo, así que no hay nada que desligar.",
      ),
    );
  }
  if (medicion.marcada) {
    return err(
      appError("conflict", "Esa medición ya está marcada como de otro paciente."),
    );
  }

  // La respuesta de encuesta vigente, que viaja TAL CUAL (no es lo que estaba mal).
  const [response] = await db
    .select({ id: surveyResponses.id, surveyVersionId: surveyResponses.surveyVersionId })
    .from(surveyResponses)
    .where(eq(surveyResponses.evaluationId, input.evaluationId))
    .orderBy(desc(surveyResponses.createdAt))
    .limit(1);
  const respuestas = response
    ? await db
        .select({
          questionId: surveyAnswers.questionId,
          answerValue: surveyAnswers.answerValue,
        })
        .from(surveyAnswers)
        .where(eq(surveyAnswers.responseId, response.id))
    : [];

  try {
    const result = await db.transaction(async (tx) => {
      // (i) la version nueva, con la misma pertenencia y los datos del encuentro
      const [newEval] = await tx
        .insert(evaluations)
        .values({
          patientId: ev.patientId,
          professionalId: ev.professionalId,
          organizationId: ev.organizationId,
          type: ev.type,
          // `in_progress` Y SIN MEDICION: es lo que hace que su pendiente diga "Montar BIS" por la regla
          // que ya existe en `accionDeEvaluacion`, sin inventarle un estado nuevo a la secuencia.
          status: "in_progress",
          consentVersion: CONSENT_VERSION,
          declaredFirstName: ev.declaredFirstName,
          declaredLastName: ev.declaredLastName,
          reasonForVisit: ev.reasonForVisit,
          educationLevel: ev.educationLevel,
          occupation: ev.occupation,
          maritalStatus: ev.maritalStatus,
          socioeconomicStratum: ev.socioeconomicStratum,
          ethnicity: ev.ethnicity,
          ancestry: ev.ancestry,
          weightGoalKg: ev.weightGoalKg,
          weightGoalSetIn: ev.weightGoalSetIn,
        })
        .returning({ id: evaluations.id });

      // (ii) la encuesta, tal cual
      if (response && respuestas.length > 0) {
        const [newResp] = await tx
          .insert(surveyResponses)
          .values({ evaluationId: newEval.id, surveyVersionId: response.surveyVersionId })
          .returning({ id: surveyResponses.id });
        await tx.insert(surveyAnswers).values(
          respuestas.map((r) => ({
            responseId: newResp.id,
            questionId: r.questionId,
            answerValue: r.answerValue,
          })),
        );
      }

      // (iii) la fuerza prensil y el peso meta viajan; las condiciones vuelven a quedar pendientes
      const [oldIntake] = await tx
        .select({
          versionId: evaluationBisIntake.bisConditionVersionId,
          answers: evaluationBisIntake.conditionAnswers,
          contraindicated: evaluationBisIntake.contraindicated,
          gripStrengthKg: evaluationBisIntake.gripStrengthKg,
          weightGoalKg: evaluationBisIntake.weightGoalKg,
          weightGoalSetIn: evaluationBisIntake.weightGoalSetIn,
        })
        .from(evaluationBisIntake)
        .where(eq(evaluationBisIntake.evaluationId, input.evaluationId))
        .limit(1);
      if (oldIntake) {
        await tx.insert(evaluationBisIntake).values({
          evaluationId: newEval.id,
          bisConditionVersionId: oldIntake.versionId,
          // EL CONTENIDO SE CONSERVA Y EL SELLO NO. `contraindicated` sobre todo: el marcapasos es del
          // paciente, no de la toma, y bajar esa compuerta al corregir seria dejar pasar una medicion que
          // no se debe hacer. Lo que se pierde es la CONSTANCIA de que alguien las registro para esta
          // toma, que es justo lo que ya no es cierto.
          conditionAnswers: oldIntake.answers,
          contraindicated: oldIntake.contraindicated,
          gripStrengthKg: oldIntake.gripStrengthKg,
          weightGoalKg: oldIntake.weightGoalKg,
          weightGoalSetIn: oldIntake.weightGoalSetIn,
          conditionsRegisteredAt: null,
        });
      }

      // (iv) LA MARCA, y aqui esta la pieza que deja al dueno de verdad cargar su archivo. El `isNull`
      // en el WHERE no es decorativo: si dos personas pulsaran a la vez, la segunda escritura no pisa la
      // primera, y el trigger de la 0226 la rechazaria de todos modos.
      const marcadas = await tx
        .update(bisMeasurements)
        .set({
          noEsDelPacienteAt: new Date(),
          noEsDelPacientePor: actor.actorId,
          noEsDelPacienteMotivo: input.reason.trim(),
        })
        .where(
          and(eq(bisMeasurements.id, medicion.id), isNull(bisMeasurements.noEsDelPacienteAt)),
        )
        .returning({ id: bisMeasurements.id });
      if (marcadas.length !== 1) {
        // Falla en voz alta y revierte: una correccion que no marco la medicion deja al freno armado
        // contra el dueno de verdad, que es el defecto entero que esto viene a evitar.
        throw new Error("Corrección abortada: la medición no quedó marcada como de otro paciente.");
      }

      // (v) la correccion: encadena vieja -> nueva. El trigger `apply` marca la vieja reemplazada DENTRO
      // de esta misma transaccion; el servicio nunca escribe `superseded_at` a mano.
      await tx.insert(clinicalCorrections).values({
        oldEvaluationId: input.evaluationId,
        newEvaluationId: newEval.id,
        correctedBy: actor.actorId,
        reason: input.reason.trim(),
        triggerType: "medicion_de_otro_paciente",
      });

      // (vi) auditoria inline, en la transaccion (regla dura 8). EVENTO PROPIO y no `evaluation.corrected`:
      // esto es un incidente de datos de salud (un dato de una persona en la historia de otra) y tiene que
      // poder contarse, buscarse y reportarse por separado.
      await recordAudit(tx, {
        event: "evaluation.medicion_de_otro_paciente",
        actorId: actor.actorId,
        actorEmail: actor.actorEmail,
        entityType: "evaluation",
        entityId: newEval.id,
        payload: {
          old_evaluation_id: input.evaluationId,
          new_evaluation_id: newEval.id,
          measurement_id: medicion.id,
          patient_id: ev.patientId,
          reason: input.reason.trim(),
          trigger_type: "medicion_de_otro_paciente",
        },
        ip: actor.ip,
      });

      return { newEvaluationId: newEval.id };
    });

    return ok({
      oldEvaluationId: input.evaluationId,
      newEvaluationId: result.newEvaluationId,
      measurementId: medicion.id,
    });
  } catch (e) {
    // Todo o nada: si algo fallo no hay version nueva, no hay correccion, la medicion sigue sin marcar y
    // la version vieja sigue vigente con su diagnostico. Se mapea a Result, no se lanza (un freno que
    // lanza desde una accion es un 500 con la pantalla caida).
    const message = e instanceof Error ? e.message : String(e);
    Sentry.captureException(e, {
      tags: { area: "medicion-de-otro-paciente", evaluationId: input.evaluationId },
    });
    return err(appError("internal", `La corrección no se pudo completar: ${message}`));
  }
}
