import { describe, expect, it } from "vitest";

import {
  computeConsentHash,
  CONSENT_DOCUMENT_HASH,
  CONSENT_VERSION,
  normalizeConsentText,
} from "@/modules/consent/consent-hash";
import { CONSENT_TEXT_V1_2 } from "@/modules/consent/text/consent-v1.2";
import { CONSENT_TEXT_V1_5 } from "@/modules/consent/text/consent-v1.5";
import {
  consentSchema,
  grantedConsentTypes,
  NECESSARY_CONSENT_TYPES,
  OPTIONAL_CONSENT_TYPES,
} from "@/modules/consent/validations";

// Hashes de referencia capturados al vendorizar cada texto desde CONSENT_ATLAS.md.
// Si un valor cambia, el texto legal cambio: hay que subir la version, no editar el
// texto a mano (protege la trazabilidad del consentimiento).
const EXPECTED_HASH_V1_5 =
  "d5189c7f2a9d1822833f3fe6ba2931308a5ffc488f326a6f59dc6c00c6b96286";
// v1.2 se conserva por retencion (DATA_GOVERNANCE); su hash queda anclado para que el
// archivo retenido tampoco se pueda editar en silencio.
const EXPECTED_HASH_V1_2 =
  "790c89d388ef532c0b84e778e4713bc2cbb7a1b7084c307198af781129704ff0";

describe("consent document_hash (regla C1)", () => {
  it("ancla el hash del texto canonico vigente v1.5", () => {
    expect(CONSENT_VERSION).toBe("1.5");
    expect(CONSENT_DOCUMENT_HASH).toBe(EXPECTED_HASH_V1_5);
    expect(computeConsentHash(CONSENT_TEXT_V1_5)).toBe(EXPECTED_HASH_V1_5);
  });

  it("conserva anclado el hash del texto retenido v1.2 (distinto al de v1.5)", () => {
    expect(computeConsentHash(CONSENT_TEXT_V1_2)).toBe(EXPECTED_HASH_V1_2);
    expect(EXPECTED_HASH_V1_5).not.toBe(EXPECTED_HASH_V1_2);
  });

  it("el texto vigente incluye las 13 secciones y los placeholders intactos", () => {
    for (let n = 1; n <= 13; n++) {
      expect(CONSENT_TEXT_V1_5).toContain(`## ${n}.`);
    }
    expect(CONSENT_TEXT_V1_5).toContain("{{professional_full_name}}");
    expect(CONSENT_TEXT_V1_5).toContain("{{professional_profession}}");
    expect(CONSENT_TEXT_V1_5).toContain("{{professional_license}}");
    // El bloque del representante legal (numeral 11) es parte del texto vigente.
    expect(CONSENT_TEXT_V1_5).toContain("representante legal");
    // Los bloques internos quedan fuera del texto de cara al paciente.
    expect(CONSENT_TEXT_V1_5).not.toContain("Registro técnico");
    expect(CONSENT_TEXT_V1_5).not.toContain("Historial de versiones");
  });

  it("normaliza a LF y sin espacios al final de linea (idempotente)", () => {
    const messy = "a  \r\nb\t\r  \nc   ";
    expect(normalizeConsentText(messy)).toBe("a\nb\n\nc");
    // El texto vendorizado ya esta normalizado: normalizar de nuevo no lo cambia.
    expect(normalizeConsentText(CONSENT_TEXT_V1_5)).toBe(CONSENT_TEXT_V1_5);
  });

  it("CRLF y LF producen el mismo hash (la normalizacion lo garantiza)", () => {
    const asCrlf = CONSENT_TEXT_V1_5.replace(/\n/g, "\r\n");
    expect(computeConsentHash(asCrlf)).toBe(EXPECTED_HASH_V1_5);
  });
});

describe("consentSchema rama mayor (6 casillas + mayoria de edad)", () => {
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

describe("consentSchema rama menor (representante legal + asentimiento)", () => {
  // 2010-01-01 => 16 años en 2026: cae en el rango de asentimiento (14-17).
  const minorTeen = {
    servicio: true,
    datos_sensibles: true,
    internacional_ia: true,
    ageBranch: "menor",
    legalRepresentativeName: "Maria Perez",
    legalRepresentativeDocument: "CC 123456",
    legalRepresentativeRelationship: "madre",
    legalRepresentativeEmail: "madre@example.com",
    minorBirthDate: "2010-01-01",
    asentimiento_menor: true,
  };

  it("acepta menor 14-17 con datos del representante y asentimiento", () => {
    const parsed = consentSchema.parse(minorTeen);
    // Las casillas otorgadas siguen siendo las 3 necesarias; los tipos derivados
    // (representante_legal, asentimiento_menor) los arma el escritor (B4).
    expect(grantedConsentTypes(parsed)).toEqual([
      "servicio",
      "datos_sensibles",
      "internacional_ia",
    ]);
  });

  it("rechaza menor 14-17 sin asentimiento", () => {
    const r = consentSchema.safeParse({ ...minorTeen, asentimiento_menor: false });
    expect(r.success).toBe(false);
  });

  it("acepta menor de 14 años sin asentimiento (no aplica)", () => {
    // 2020-01-01 => 6 años: el asentimiento no aplica.
    const r = consentSchema.safeParse({
      ...minorTeen,
      minorBirthDate: "2020-01-01",
      asentimiento_menor: false,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza rama menor sin datos del representante", () => {
    const r = consentSchema.safeParse({
      servicio: true,
      datos_sensibles: true,
      internacional_ia: true,
      ageBranch: "menor",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza rama menor con fecha que indica mayoria de edad", () => {
    const r = consentSchema.safeParse({ ...minorTeen, minorBirthDate: "2000-01-01" });
    expect(r.success).toBe(false);
  });
});
