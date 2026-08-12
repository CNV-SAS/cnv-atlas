import { describe, expect, it } from "vitest";

import {
  computeConsentHash,
  CONSENT_DOCUMENT_HASH,
  CONSENT_VERSION,
  normalizeConsentText,
} from "@/modules/consent/consent-hash";
import { CONSENT_TEXT_V1_0 } from "@/modules/consent/text/consent-v1.0";
import { CONSENT_TEXT_V1_2 } from "@/modules/consent/text/consent-v1.2";
import { CONSENT_TEXT_V1_5 } from "@/modules/consent/text/consent-v1.5";
import { CONSENT_TEXT_V1_7 } from "@/modules/consent/text/consent-v1.7";
import {
  consentSchema,
  grantedConsentTypes,
  NECESSARY_CONSENT_TYPES,
  OPTIONAL_CONSENT_TYPES,
} from "@/modules/consent/validations";

// Hashes de referencia capturados al vendorizar cada texto desde CONSENT_ATLAS.md.
// Si un valor cambia, el texto legal cambio: hay que subir la version, no editar el
// texto a mano (protege la trazabilidad del consentimiento).
// Hash VIGENTE (v1.0, bump de lanzamiento). Anclado para que cualquier cambio del texto legal rompa la prueba.
const EXPECTED_HASH_V1_0 =
  "dfdcaccb699313edce6ce60e693c14ae02a00debb96b75e27c1945ec0937f3ae";
// v1.7, v1.5 y v1.2 se conservan por retencion (DATA_GOVERNANCE): pacientes que firmaron esas versiones
// mantienen su texto. Sus hashes quedan anclados para que los archivos retenidos tampoco se editen
// en silencio. (v1.7 dejo de ser el vigente al renumerar a v1.0 para produccion.)
const EXPECTED_HASH_V1_7 =
  "23d7094f586e0af55943ee1f0a2d60471f0c111fc288f3f631a50f0abd4b43ad";
const EXPECTED_HASH_V1_5 =
  "d5189c7f2a9d1822833f3fe6ba2931308a5ffc488f326a6f59dc6c00c6b96286";
const EXPECTED_HASH_V1_2 =
  "790c89d388ef532c0b84e778e4713bc2cbb7a1b7084c307198af781129704ff0";

describe("consent document_hash (regla C1)", () => {
  it("ancla el hash del texto canonico vigente v1.0", () => {
    expect(CONSENT_VERSION).toBe("1.0");
    expect(CONSENT_DOCUMENT_HASH).toBe(EXPECTED_HASH_V1_0);
    expect(computeConsentHash(CONSENT_TEXT_V1_0)).toBe(EXPECTED_HASH_V1_0);
  });

  it("conserva anclados los hashes de los textos retenidos v1.7, v1.5 y v1.2 (distintos al vigente)", () => {
    expect(computeConsentHash(CONSENT_TEXT_V1_7)).toBe(EXPECTED_HASH_V1_7);
    expect(computeConsentHash(CONSENT_TEXT_V1_5)).toBe(EXPECTED_HASH_V1_5);
    expect(computeConsentHash(CONSENT_TEXT_V1_2)).toBe(EXPECTED_HASH_V1_2);
    for (const h of [EXPECTED_HASH_V1_7, EXPECTED_HASH_V1_5, EXPECTED_HASH_V1_2]) {
      expect(EXPECTED_HASH_V1_0).not.toBe(h);
    }
  });

  it("el texto vigente v1.0 incluye las 13 secciones, los marcadores y la etnia; sin em-dash", () => {
    for (let n = 1; n <= 13; n++) {
      expect(CONSENT_TEXT_V1_0).toContain(`## ${n}.`);
    }
    // Marcadores explicitos de v1.0 (reemplazan el anclaje por substring).
    expect(CONSENT_TEXT_V1_0).toContain("{{bloque_profesional}}");
    expect(CONSENT_TEXT_V1_0).toContain("{{firma_nombre}}");
    expect(CONSENT_TEXT_V1_0).toContain("{{fecha}}");
    expect(CONSENT_TEXT_V1_0).toContain("<!--RAMA_MAYOR-->");
    expect(CONSENT_TEXT_V1_0).toContain("<!--RAMA_MENOR-->");
    // La etnia se declara en el numeral 3 y se FUNDE en la casilla de investigacion (no es casilla propia).
    expect(CONSENT_TEXT_V1_0).toContain("Pertenencia étnica");
    expect(CONSENT_TEXT_V1_0).not.toContain("{{casilla_etnia}}");
    expect(CONSENT_TEXT_V1_0).toContain("uso de mi pertenencia étnica");
    // v1.0: 3 casillas necesarias (internacional_ia absorbido en servicio), continuidad/publicidad rotuladas.
    expect(CONSENT_TEXT_V1_0).not.toContain("{{casilla_internacional_ia}}");
    expect(CONSENT_TEXT_V1_0).toContain("**Continuidad asistencial.**");
    expect(CONSENT_TEXT_V1_0).toContain("**Publicidad.**");
    // El bloque del representante legal (numeral 11) sigue.
    expect(CONSENT_TEXT_V1_0).toContain("representante legal");
    // Regla de estilo: NINGUN em-dash en el texto de cara al paciente.
    expect(CONSENT_TEXT_V1_0).not.toMatch(/[—–]/);
  });

  it("v1.7 consolida v1.6 (numeral 4) y agrega la casilla del medio electronico (numeral 12)", () => {
    // Las dos finalidades necesarias de v1.6 (que nunca se vendorizaron) ahora estan en el texto efectivo.
    expect(CONSENT_TEXT_V1_7).toContain("Verificar, sobre datos seudonimizados");
    expect(CONSENT_TEXT_V1_7).toContain("acceder de forma minimizada y registrada a su historia clínica identificada");
    // La casilla de aceptacion del medio electronico (firma electronica).
    expect(CONSENT_TEXT_V1_7).toContain("se otorga por medios electrónicos");
    // El numeral 13 anuncia la copia.
    expect(CONSENT_TEXT_V1_7).toContain("enviará una copia de este consentimiento");
  });

  it("normaliza a LF y sin espacios al final de linea (idempotente)", () => {
    const messy = "a  \r\nb\t\r  \nc   ";
    expect(normalizeConsentText(messy)).toBe("a\nb\n\nc");
    // El texto vendorizado ya esta normalizado: normalizar de nuevo no lo cambia.
    expect(normalizeConsentText(CONSENT_TEXT_V1_0)).toBe(CONSENT_TEXT_V1_0);
  });

  it("CRLF y LF producen el mismo hash (la normalizacion lo garantiza)", () => {
    const asCrlf = CONSENT_TEXT_V1_0.replace(/\n/g, "\r\n");
    expect(computeConsentHash(asCrlf)).toBe(EXPECTED_HASH_V1_0);
  });
});

describe("consentSchema rama mayor (v1.0: 3 casillas necesarias + mayoria de edad)", () => {
  const necessary = {
    servicio: true,
    datos_sensibles: true,
    aceptacion_medio_electronico: true,
    mayoria_de_edad: true,
  };

  it("acepta las necesarias + mayoria de edad; grantedConsentTypes son servicio + datos_sensibles", () => {
    const parsed = consentSchema.parse(necessary);
    // v1.0: internacional_ia dejo de ser casilla (absorbido en servicio). aceptacion_medio_electronico se
    // sella aparte (no esta en CONSENT_TYPES). Asi grantedConsentTypes son solo las dos casillas de datos.
    expect(grantedConsentTypes(parsed)).toEqual(["servicio", "datos_sensibles"]);
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

  it("rechaza si no acepta el medio electronico (firma electronica, v1.7)", () => {
    const r = consentSchema.safeParse({ ...necessary, aceptacion_medio_electronico: false });
    expect(r.success).toBe(false);
  });

  it("las necesarias (2) y opcionales (3) cubren los 5 tipos-casilla sin solaparse (v1.0)", () => {
    expect([...NECESSARY_CONSENT_TYPES, ...OPTIONAL_CONSENT_TYPES].sort()).toEqual(
      [
        "comunicaciones_comerciales",
        "comunicaciones_continuidad",
        "datos_sensibles",
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
    aceptacion_medio_electronico: true,
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
    // Las casillas otorgadas son servicio + datos_sensibles; los tipos derivados
    // (representante_legal, asentimiento_menor) los arma el escritor (B4).
    expect(grantedConsentTypes(parsed)).toEqual(["servicio", "datos_sensibles"]);
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
