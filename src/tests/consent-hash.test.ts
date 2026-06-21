import { describe, expect, it } from "vitest";

import {
  computeConsentHash,
  CONSENT_DOCUMENT_HASH,
  CONSENT_VERSION,
  normalizeConsentText,
} from "@/modules/consent/consent-hash";
import { CONSENT_TEXT_V1_2 } from "@/modules/consent/text/consent-v1.2";
import {
  consentSchema,
  grantedConsentTypes,
  NECESSARY_CONSENT_TYPES,
  OPTIONAL_CONSENT_TYPES,
} from "@/modules/consent/validations";

// Hash de referencia capturado al vendorizar el texto v1.2 desde CONSENT_ATLAS.md.
// Si este valor cambia, el texto legal cambio: hay que subir la version, no editar
// el texto a mano (protege la trazabilidad del consentimiento).
const EXPECTED_HASH_V1_2 =
  "790c89d388ef532c0b84e778e4713bc2cbb7a1b7084c307198af781129704ff0";

describe("consent document_hash (regla C1)", () => {
  it("ancla el hash del texto canonico v1.2", () => {
    expect(CONSENT_VERSION).toBe("1.2");
    expect(CONSENT_DOCUMENT_HASH).toBe(EXPECTED_HASH_V1_2);
    expect(computeConsentHash(CONSENT_TEXT_V1_2)).toBe(EXPECTED_HASH_V1_2);
  });

  it("el texto incluye las 13 secciones y los placeholders intactos", () => {
    for (let n = 1; n <= 13; n++) {
      expect(CONSENT_TEXT_V1_2).toContain(`## ${n}.`);
    }
    expect(CONSENT_TEXT_V1_2).toContain("{{professional_full_name}}");
    expect(CONSENT_TEXT_V1_2).toContain("{{professional_profession}}");
    expect(CONSENT_TEXT_V1_2).toContain("{{professional_license}}");
    // Los bloques internos quedan fuera del texto de cara al paciente.
    expect(CONSENT_TEXT_V1_2).not.toContain("Registro técnico");
    expect(CONSENT_TEXT_V1_2).not.toContain("Historial de versiones");
  });

  it("normaliza a LF y sin espacios al final de linea (idempotente)", () => {
    const messy = "a  \r\nb\t\r  \nc   ";
    expect(normalizeConsentText(messy)).toBe("a\nb\n\nc");
    // El texto vendorizado ya esta normalizado: normalizar de nuevo no lo cambia.
    expect(normalizeConsentText(CONSENT_TEXT_V1_2)).toBe(CONSENT_TEXT_V1_2);
  });

  it("CRLF y LF producen el mismo hash (la normalizacion lo garantiza)", () => {
    const asCrlf = CONSENT_TEXT_V1_2.replace(/\n/g, "\r\n");
    expect(computeConsentHash(asCrlf)).toBe(EXPECTED_HASH_V1_2);
  });
});

describe("consentSchema (6 casillas + mayoria de edad)", () => {
  const necessary = {
    servicio: true,
    datos_sensibles: true,
    internacional_ia: true,
    mayoria_de_edad: true,
  };

  it("acepta las 3 necesarias + mayoria de edad, opcionales en false por default", () => {
    const parsed = consentSchema.parse(necessary);
    expect(grantedConsentTypes(parsed)).toEqual([
      "servicio",
      "datos_sensibles",
      "internacional_ia",
    ]);
  });

  it("registra las opcionales marcadas de forma independiente", () => {
    const parsed = consentSchema.parse({ ...necessary, investigacion: true });
    expect(grantedConsentTypes(parsed)).toContain("investigacion");
    expect(grantedConsentTypes(parsed)).not.toContain("comunicaciones_comerciales");
  });

  it("rechaza si falta una autorizacion necesaria", () => {
    const r = consentSchema.safeParse({ ...necessary, datos_sensibles: false });
    expect(r.success).toBe(false);
  });

  it("rechaza si no declara mayoria de edad", () => {
    const r = consentSchema.safeParse({ ...necessary, mayoria_de_edad: false });
    expect(r.success).toBe(false);
  });

  it("las necesarias y opcionales cubren los 6 tipos sin solaparse", () => {
    expect([...NECESSARY_CONSENT_TYPES, ...OPTIONAL_CONSENT_TYPES].sort()).toEqual(
      [
        "comunicaciones_comerciales",
        "comunicaciones_continuidad",
        "datos_sensibles",
        "internacional_ia",
        "investigacion",
        "servicio",
      ],
    );
  });
});
