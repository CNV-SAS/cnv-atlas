import { appError, err, ok, type Result } from "@/core/errors";
import { CONSENT_DOCUMENT_HASH, CONSENT_VERSION } from "@/modules/consent/consent-hash";
import {
  assentApplies,
  computeAgeYears,
  consentSchema,
  grantedConsentTypes,
} from "@/modules/consent/validations";
import {
  findDuplicateCandidates,
  findPatientByDocument,
} from "@/modules/patients/data/patients-intake";
import { resolveIdentity } from "@/modules/patients/services/identity-resolution";

import {
  ConsentGateError,
  type IntakeConsent,
  writeIntakeEvaluation,
} from "../data/intake-writer";
import { intakeAnswersSchema, intakeIdentitySchema } from "../validations";
import type { SurveyIntakeResult, SurveyLinkView } from "../types";

// Orquesta el envio de la encuesta publica (recoleccion pura + identidad + gate).
// No toca BD directamente: valida la entrada, resuelve identidad (lecturas service
// role) y delega la escritura atomica al intake-writer. Retorna Result; no hace
// throw para errores esperables (ARCHITECTURE).

export type SubmitSurveyIntakeInput = {
  link: SurveyLinkView; // link ya resuelto por la pagina publica
  surveyVersionId: string; // version activa de la encuesta
  consent: unknown; // casillas crudas del consentimiento
  identity: unknown; // identidad cruda declarada por el paciente
  answers: unknown; // respuestas crudas
  ipAddress: string | null;
};

export async function submitSurveyIntake(
  input: SubmitSurveyIntakeInput,
): Promise<Result<SurveyIntakeResult>> {
  // 1. Validar consentimiento (3 necesarias + mayoria de edad) e identidad/respuestas.
  const consent = consentSchema.safeParse(input.consent);
  if (!consent.success) {
    return err(
      appError("validation", "Debes aceptar las autorizaciones necesarias y declarar que eres mayor de edad."),
    );
  }
  const identity = intakeIdentitySchema.safeParse(input.identity);
  if (!identity.success) {
    return err(appError("validation", "Revisa los datos de identificacion."));
  }
  const answers = intakeAnswersSchema.safeParse(input.answers);
  if (!answers.success) {
    return err(appError("validation", "Hay respuestas invalidas en la encuesta."));
  }

  // 2. Resolver identidad por documento (Atlas no decide solo inicial vs seguimiento).
  const resolution = await resolveIdentity(
    { findPatientByDocument, findDuplicateCandidates },
    {
      organizationId: input.link.organizationId,
      documentType: identity.data.documentType,
      documentNumber: identity.data.documentNumber,
      firstName: identity.data.firstName,
      lastName: identity.data.lastName,
      birthDate: identity.data.birthDate,
    },
  );

  // 3. Consentimientos otorgados, sellados con la version y el hash canonicos vigentes.
  const consents: IntakeConsent[] = grantedConsentTypes(consent.data).map((type) => ({
    type,
    consentVersion: CONSENT_VERSION,
    documentHash: CONSENT_DOCUMENT_HASH,
  }));

  // Rama menor (DELTA2 B4): se agrega el registro del representante legal (con sus
  // datos, que la validacion garantizo presentes) y, si el menor tiene 14-17, el
  // asentimiento. Mismos version y hash vigentes.
  if (consent.data.ageBranch === "menor") {
    consents.push({
      type: "representante_legal",
      consentVersion: CONSENT_VERSION,
      documentHash: CONSENT_DOCUMENT_HASH,
      legalRepresentative: {
        name: consent.data.legalRepresentativeName!,
        document: consent.data.legalRepresentativeDocument!,
        relationship: consent.data.legalRepresentativeRelationship!,
        email: consent.data.legalRepresentativeEmail!,
      },
    });
    const age = consent.data.minorBirthDate
      ? computeAgeYears(consent.data.minorBirthDate, new Date())
      : null;
    if (assentApplies(age)) {
      consents.push({
        type: "asentimiento_menor",
        consentVersion: CONSENT_VERSION,
        documentHash: CONSENT_DOCUMENT_HASH,
      });
    }
  }

  // El link de seguimiento es de un solo uso: se consume. El inicial es reusable.
  const linkId = input.link.type === "seguimiento" ? input.link.id : null;

  // 4. Escritura atomica (incluye el gate de la regla 15 antes de la evaluacion).
  try {
    const written = await writeIntakeEvaluation({
      organizationId: input.link.organizationId,
      professionalId: input.link.professionalId,
      mode: resolution.mode,
      patientId: resolution.matchedPatientId,
      identity: identity.data,
      consents,
      surveyVersionId: input.surveyVersionId,
      answers: answers.data,
      linkId,
      ipAddress: input.ipAddress,
    });
    return ok({
      evaluationId: written.evaluationId,
      patientId: written.patientId,
      mode: resolution.mode,
      duplicateCandidates: resolution.duplicateCandidates,
    });
  } catch (e) {
    if (e instanceof ConsentGateError) {
      return err(
        appError("forbidden", "No es posible crear la evaluacion sin las autorizaciones necesarias vigentes."),
      );
    }
    throw e;
  }
}
