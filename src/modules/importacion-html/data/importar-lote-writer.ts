import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  bisMeasurements,
  bisRawValues,
  evaluationBisIntake,
  diagnoses,
  evaluations,
  htmlImportBatches,
  patientContacts,
  patientExternalConsents,
  patientProfessionalRelationships,
  patientProfiles,
  patients,
  surveyAnswers,
  surveyResponses,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import { CONSENT_HTML_DOCUMENT_HASH } from "@/modules/consent/consent-hash";
import { CONSENT_HTML_VERSION } from "@/modules/consent/text/consent-html-cnv-v3.0";

import {
  instanteDeLaConsulta,
  partirNombre,
  respuestasDeLaConsulta,
  tipoDeDocumento,
  tipoDeLaConsulta,
  valoresBisDeLaConsulta,
  type ConsultaDelHtml,
} from "../services/mapeo-de-la-consulta";
import { sexoDeAtlas } from "../services/formas-del-html";
import { normalizarDocumento } from "../services/normalizar";

// ═══ LA IMPORTACION (sesion 4, 2026-09-22) ═══
//
// LA PRIMERA PIEZA QUE ESCRIBE DATOS CLINICOS. Todo en UNA transaccion por lote: o entra el lote entero o no
// entra nada. Drizzle como owner (la RLS no aplica al owner), que es lo mismo que hace el intake del paciente.
//
// LO QUE ESCRIBE, por consulta del HTML: la evaluacion CON SU FECHA ORIGINAL (`created_at` es la fecha de la
// consulta en toda la app: historia, SOAP y trayectoria), sus respuestas de encuesta, su medicion (ningun
// numero se recalcula) y su consentimiento de origen HTML. NO escribe diagnostico, tratamiento, reporte ni
// condiciones de la toma: el diagnostico lo genera el profesional desde Atlas, y el gate le pedira las
// condiciones.
//
// LO QUE NO IMPORTA: el informe que el HTML le envio al paciente (decision de Santiago, 2026-09-22). Lo
// escribio el motor viejo, con recomendaciones que Atlas ya no admite.
//
// LA CUENTA DEL PROFESIONAL LA ELIGE EL ADMIN, no el archivo: muchos nombres se escribieron en pruebas.

export type ConsultaParaImportar = {
  fecha: string; // AAAA-MM-DD
  consulta: ConsultaDelHtml;
  /** Respaldos de circunferencias del paciente; solo para su consulta mas reciente. */
  respaldos?: { excel?: Record<string, unknown>; aMano?: Record<string, unknown> };
};

export type PacienteParaImportar = {
  documento: string;
  nombre: string;
  consultas: ConsultaParaImportar[];
};

export type ImportarLoteInput = {
  organizationId: string;
  professionalId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
  archivo: { nombre: string; hash: string };
  declaracion: { version: string; aceptadaEn: string };
  surveyVersionId: string;
  /** La version vigente de las condiciones: sella la fila que lleva la fuerza prensil y el peso meta. */
  bisConditionVersionId: string;
  /** Las preguntas de la version vigente: clave -> id. Solo se importan las que Atlas tiene. */
  preguntasPorClave: Record<string, string>;
  pacientes: PacienteParaImportar[];
};

export type ImportarLoteResultado = {
  batchId: string;
  pacientesCreados: number;
  pacientesExistentes: number;
  consultasImportadas: number;
  /** Consultas que ya estaban importadas (el mismo documento y la misma fecha): no se duplican. */
  consultasOmitidas: { documento: string; fecha: string }[];
};

export async function importarLote(input: ImportarLoteInput): Promise<ImportarLoteResultado> {
  return db.transaction(async (tx) => {
    const [lote] = await tx
      .insert(htmlImportBatches)
      .values({
        professionalId: input.professionalId,
        importedBy: input.actorId,
        sourceFileName: input.archivo.nombre,
        sourceFileHash: input.archivo.hash,
        declarationVersion: input.declaracion.version,
        declaredAt: new Date(input.declaracion.aceptadaEn),
      })
      .returning({ id: htmlImportBatches.id });

    // Los pacientes de la organizacion, para cruzar por documento NORMALIZADO (en el HTML se tecleo a mano).
    const existentes = await tx
      .select({ id: patients.id, documento: patients.documentNumber })
      .from(patients)
      .where(and(eq(patients.organizationId, input.organizationId), isNull(patients.deletedAt)));
    const porDocumento = new Map(existentes.map((p) => [normalizarDocumento(p.documento), p.id]));

    const creados: string[] = [];
    const omitidas: { documento: string; fecha: string }[] = [];
    let consultasImportadas = 0;
    let pacientesExistentes = 0;

    for (const p of input.pacientes) {
      const clave = normalizarDocumento(p.documento);
      let patientId = porDocumento.get(clave) ?? null;
      const eraNuevo = patientId == null;

      if (patientId == null) {
        const primera = p.consultas[0]?.consulta ?? {};
        const { firstName, lastName } = partirNombre(p.nombre);
        const [creado] = await tx
          .insert(patients)
          .values({
            organizationId: input.organizationId,
            documentType: tipoDeDocumento(primera.tipoDoc),
            documentNumber: p.documento,
          })
          .returning({ id: patients.id });
        patientId = creado.id;
        creados.push(patientId);
        porDocumento.set(clave, patientId);
        // El orden lo impone la RLS (misma restriccion que el intake): paciente, relacion, perfil y contacto.
        await tx
          .insert(patientProfessionalRelationships)
          .values({ patientId, professionalId: input.professionalId })
          .onConflictDoNothing();
        await tx.insert(patientProfiles).values({
          patientId,
          firstName,
          lastName,
          birthDate: typeof primera.fechaNac === "string" && primera.fechaNac ? primera.fechaNac : null,
          // EL HTML GUARDA LA PALABRA, ATLAS LA LETRA (barrido del 2026-09-23). Antes este guard solo
          // aceptaba "M"/"F" y el HTML nunca las manda, asi que TODO paciente importado quedaba con el sexo
          // nulo: ninguno podia diagnosticarse, y en dos lectores que caen a masculino cuando falta, una
          // paciente se clasificaba y se trataba como hombre sin que nada lo dijera.
          sex: sexoDeAtlas(primera.sexo),
          country: typeof primera.pais === "string" ? primera.pais : null,
          city: typeof primera.ciudad === "string" ? primera.ciudad : null,
          // LOS SOCIODEMOGRAFICOS VAN TAMBIEN AQUI (barrido del 2026-09-23). Se escribian solo en la
          // evaluacion, que es "el valor DE ESTE ENCUENTRO"; el perfil es "el ultimo valor conocido" y es
          // lo que lee su ficha y lo que precarga su proximo seguimiento. Con la mitad del cable, el
          // paciente importado se veia sin escolaridad ni ocupacion aunque el dato SI habia entrado.
          educationLevel: texto(primera.educacion),
          occupation: texto(primera.ocupacion),
          maritalStatus: texto(primera.estadoCivil),
          socioeconomicStratum: texto(primera.estrato),
        });
        await tx.insert(patientContacts).values({
          patientId,
          email: typeof primera.email === "string" && primera.email ? primera.email : null,
          phone: typeof primera.telefono === "string" && primera.telefono ? primera.telefono : null,
        });
        await recordAudit(tx, {
          event: "importacion_html.paciente_creado",
          actorId: input.actorId,
          actorEmail: input.actorEmail,
          entityType: "patient",
          entityId: patientId,
          payload: { lote: lote.id, documento: p.documento },
          ip: input.ip,
        });
      } else {
        pacientesExistentes++;
        await tx
          .insert(patientProfessionalRelationships)
          .values({ patientId, professionalId: input.professionalId })
          .onConflictDoNothing();
      }

      // Lo que el paciente YA tiene en Atlas: si tiene evaluaciones, ninguna importada puede ser su inicial;
      // y una consulta de la misma fecha ya importada no se duplica (el mismo documento puede venir en dos
      // archivos, uno por navegador).
      const suyas = await tx
        .select({ createdAt: evaluations.createdAt, importBatchId: evaluations.importBatchId })
        .from(evaluations)
        .where(eq(evaluations.patientId, patientId));
      const yaTeniaEvaluaciones = suyas.length > 0;
      const fechasImportadas = new Set(
        suyas.filter((e) => e.importBatchId != null).map((e) => e.createdAt.toISOString().slice(0, 10)),
      );

      let indice = 0;
      for (const c of p.consultas) {
        if (fechasImportadas.has(c.fecha.slice(0, 10))) {
          omitidas.push({ documento: p.documento, fecha: c.fecha });
          continue;
        }
        const cuando = instanteDeLaConsulta(c.fecha);
        const motivo = Array.isArray(c.consulta.motivo) ? (c.consulta.motivo as unknown[]).map(String) : [];
        const [evaluacion] = await tx
          .insert(evaluations)
          .values({
            patientId,
            professionalId: input.professionalId,
            organizationId: input.organizationId,
            type: tipoDeLaConsulta(indice, yaTeniaEvaluaciones),
            status: "in_progress",
            createdAt: cuando,
            updatedAt: cuando,
            reasonForVisit: motivo.length ? JSON.stringify(motivo) : null,
            educationLevel: texto(c.consulta.educacion),
            occupation: texto(c.consulta.ocupacion),
            maritalStatus: texto(c.consulta.estadoCivil),
            socioeconomicStratum: texto(c.consulta.estrato),
            // La etnia NO se importa: en Atlas solo viaja con la autorizacion de investigacion vigente, y el
            // consentimiento del HTML no la tiene.
            importBatchId: lote.id,
          })
          .returning({ id: evaluations.id });
        indice++;
        consultasImportadas++;

        const respuestas = respuestasDeLaConsulta(c.consulta, Object.keys(input.preguntasPorClave));
        if (respuestas.length) {
          const [respuesta] = await tx
            .insert(surveyResponses)
            .values({ evaluationId: evaluacion.id, surveyVersionId: input.surveyVersionId, importBatchId: lote.id })
            .returning({ id: surveyResponses.id });
          await tx.insert(surveyAnswers).values(
            respuestas.map((r) => ({
              responseId: respuesta.id,
              questionId: input.preguntasPorClave[r.clave],
              answerValue: r.valor,
            })),
          );
        }

        const valores = valoresBisDeLaConsulta(c.consulta, c.respaldos ?? {});
        if (valores.length) {
          const [medicion] = await tx
            .insert(bisMeasurements)
            .values({ evaluationId: evaluacion.id, measurementDate: cuando, importBatchId: lote.id })
            .returning({ id: bisMeasurements.id });
          await tx.insert(bisRawValues).values(
            valores.map((v) => ({ measurementId: medicion.id, variableName: v.variableName, value: String(v.value) })),
          );
        }

        // ═══ LA FUERZA PRENSIL Y EL PESO META (2026-09-24) ═══
        //
        // El HTML los guarda por consulta y se perdian. La prensil ENTRA AL MOTOR (criterio primario del
        // fenotipo) y una consulta de hace meses NO SE PUEDE VOLVER A MEDIR: perderla es perderla. El peso
        // meta gobierna toda la cadena calorica; ese si se puede volver a fijar, pero no hay razon para
        // hacerselo teclear de nuevo si el archivo lo trae.
        //
        // VIVEN EN LA FILA DE CONDICIONES, y por eso hizo falta la 0170: la puerta del diagnostico solo
        // miraba si esa fila EXISTE, asi que crearla aqui habria hecho creer que las condiciones ya se
        // registraron. Se crea SIN `conditionsRegisteredAt`, que es lo que ahora mira la puerta: las medidas
        // entran y las condiciones se siguen pidiendo, que es exactamente lo que queriamos.
        const prensil = Number(c.consulta.fuerzaPrensil) || 0;
        const pesoMeta = Number(c.consulta.pesoMeta) || 0;
        if (prensil > 0 || pesoMeta > 0) {
          await tx.insert(evaluationBisIntake).values({
            evaluationId: evaluacion.id,
            bisConditionVersionId: input.bisConditionVersionId,
            conditionAnswers: {},
            contraindicated: false,
            gripStrengthKg: prensil > 0 ? String(prensil) : null,
            weightGoalKg: pesoMeta > 0 ? String(pesoMeta) : null,
            // La procedencia viaja SIEMPRE con el valor (CHECK de la 0095): se fijo en la entrada, no al
            // armar el tratamiento.
            weightGoalSetIn: pesoMeta > 0 ? "entrada" : null,
          });
        }

        // EL CONSENTIMIENTO, FIRMADO O NO (respuesta legal: la consulta sin firma se importa igual, con esa
        // marca). Nunca en `patient_consents`: esa es la del gate de la regla dura 15.
        const firma = typeof c.consulta.firmaNombre === "string" ? c.consulta.firmaNombre.trim() : "";
        const firmado = c.consulta.consentimientoAceptado === true && firma !== "";
        await tx
          .insert(patientExternalConsents)
          .values({
            patientId,
            batchId: lote.id,
            origin: "html",
            textVersion: CONSENT_HTML_VERSION,
            documentHash: CONSENT_HTML_DOCUMENT_HASH,
            typedName: firmado ? firma : null,
            recordedDate: texto(c.consulta.fechaConsentimiento) ?? c.fecha,
            sourceConsultationDate: c.fecha.slice(0, 10),
            signatureMethod: firmado ? "nombre_tecleado_sin_codigo" : "sin_prueba_de_firma",
          })
          .onConflictDoNothing();

        await recordAudit(tx, {
          event: "importacion_html.consulta_importada",
          actorId: input.actorId,
          actorEmail: input.actorEmail,
          entityType: "evaluation",
          entityId: evaluacion.id,
          payload: {
            lote: lote.id,
            documento: p.documento,
            fecha_consulta: c.fecha,
            paciente_creado: eraNuevo,
            con_firma: firmado,
            con_medicion: valores.length > 0,
          },
          ip: input.ip,
        });
      }
    }

    await tx
      .update(htmlImportBatches)
      .set({
        patientCount: creados.length + pacientesExistentes,
        consultationCount: consultasImportadas,
        createdPatientIds: creados,
      })
      .where(eq(htmlImportBatches.id, lote.id));

    return {
      batchId: lote.id,
      pacientesCreados: creados.length,
      pacientesExistentes,
      consultasImportadas,
      consultasOmitidas: omitidas,
    };
  });
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** El lote ya se deshizo, o alguien ya trabajo sobre una de sus consultas. */
export class LoteNoReversibleError extends Error {}

/**
 * DESHACER UN LOTE (2026-09-22). Retira lo que el lote escribio: sus consultas (con sus respuestas y su
 * medicion, por cascada), sus consentimientos de origen HTML y los pacientes que EL creo. A un paciente que ya
 * existia se le quitan las consultas importadas, no la ficha.
 *
 * NO SE DESHACE si alguna consulta del lote ya tiene diagnostico: eso ya es trabajo clinico de Atlas, y
 * borrarlo seria destruir una historia. La fila del lote se conserva, marcada, como constancia.
 */
export async function revertirLote(input: {
  batchId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<{ consultasRetiradas: number; pacientesBorrados: number }> {
  return db.transaction(async (tx) => {
    const [lote] = await tx
      .select({ id: htmlImportBatches.id, revertedAt: htmlImportBatches.revertedAt, creados: htmlImportBatches.createdPatientIds })
      .from(htmlImportBatches)
      .where(eq(htmlImportBatches.id, input.batchId));
    if (!lote) throw new LoteNoReversibleError("Ese lote no existe.");
    if (lote.revertedAt) throw new LoteNoReversibleError("Ese lote ya se deshizo.");

    const suyas = await tx
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(eq(evaluations.importBatchId, input.batchId));
    const ids = suyas.map((e) => e.id);

    if (ids.length) {
      const conDiagnostico = await tx
        .select({ id: diagnoses.id })
        .from(diagnoses)
        .where(inArray(diagnoses.evaluationId, ids));
      if (conDiagnostico.length > 0) {
        throw new LoteNoReversibleError(
          "No se puede deshacer: alguna consulta de este lote ya tiene diagnóstico generado en Atlas.",
        );
      }
      await tx.delete(evaluations).where(inArray(evaluations.id, ids));
    }
    await tx.delete(patientExternalConsents).where(eq(patientExternalConsents.batchId, input.batchId));

    // Los pacientes que creo el lote, y solo si no les quedo ninguna evaluacion (si alguien les creo una
    // despues, la ficha se queda).
    let pacientesBorrados = 0;
    for (const patientId of lote.creados ?? []) {
      const quedan = await tx.select({ id: evaluations.id }).from(evaluations).where(eq(evaluations.patientId, patientId));
      if (quedan.length === 0) {
        await tx.delete(patients).where(eq(patients.id, patientId));
        pacientesBorrados++;
      }
    }

    await tx
      .update(htmlImportBatches)
      .set({ revertedAt: new Date(), revertedBy: input.actorId })
      .where(eq(htmlImportBatches.id, input.batchId));

    await recordAudit(tx, {
      event: "importacion_html.lote_deshecho",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "html_import_batch",
      entityId: input.batchId,
      payload: { consultas_retiradas: ids.length, pacientes_borrados: pacientesBorrados },
      ip: input.ip,
    });

    return { consultasRetiradas: ids.length, pacientesBorrados };
  });
}
