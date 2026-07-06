import { computeAgeYears, isMinorAge } from "@/modules/consent/validations";

// Segundo muro (DELTA2 B3): al confirmar identidad, la rama de consentimiento usada
// debe ser consistente con la edad real del paciente segun su fecha de nacimiento.
//
// Rama usada:
//   - menor: existe un consentimiento 'representante_legal' vigente.
//   - mayor: no existe ese consentimiento.
//
// Es funcion pura (recibe 'now') para poder probarla sin depender del reloj ni de BD.

export type ConsentBranchCheck = { ok: true } | { ok: false; message: string };

export function checkConsentBranchConsistency(input: {
  birthDate: string | null;
  usedMinorBranch: boolean;
  now: Date;
}): ConsentBranchCheck {
  const age = input.birthDate ? computeAgeYears(input.birthDate, input.now) : null;

  if (input.usedMinorBranch) {
    // Se otorgo por representante legal: la fecha debe existir e indicar minoria.
    if (age === null) {
      return {
        ok: false,
        message:
          "Falta la fecha de nacimiento del menor para confirmar la consistencia del consentimiento otorgado por el representante legal.",
      };
    }
    if (!isMinorAge(age)) {
      return {
        ok: false,
        message:
          "El documento indica mayoria de edad, pero el consentimiento se otorgo por un representante legal. Repite el consentimiento como mayor de edad antes de confirmar.",
      };
    }
    return { ok: true };
  }

  // Rama mayor (sin representante). Si la fecha indica minoria, hay discrepancia. Si no
  // hay fecha, no se puede afirmar minoria: no se bloquea (adultos pueden omitirla).
  if (age !== null && isMinorAge(age)) {
    return {
      ok: false,
      message:
        "El documento indica que el paciente es menor de edad, pero el consentimiento se otorgo como mayor de edad. Repite el consentimiento con el representante legal antes de confirmar.",
    };
  }
  return { ok: true };
}
