import { afterEach, describe, expect, it, vi } from "vitest";

import { and, eq, inArray } from "drizzle-orm";

// CAMINO ENTERO DE LA FIRMA PRESENCIAL, CONTRA LA BASE REAL (2026-09-08).
//
// POR QUE EXISTE, y el motivo es una leccion cara: la modalidad 1 fallo DOS VECES en el smoke, cada vez
// un paso mas adelante. Primero el envio del codigo ("Link invalido"), y arreglado eso, la firma
// ("No pudimos completar la firma en este momento"). Las dos veces tsc, lint y 2200 tests estaban en
// verde: ninguno de ellos ESCRIBE en la base.
//
// EL SEGUNDO DEFECTO era `declared_by`. La columna referencia `profiles(id)` (la persona) y se le estaba
// pasando `professional_profiles.id` (su ficha profesional). Dos uuid, los dos existentes, los dos con
// nombre de "profesional": tsc no puede verlo, y en pantalla salia el mensaje generico de fallo porque la
// causa real solo aparecia en el log del servidor.
//
// LO QUE ESTE CANDADO HACE, y por eso vive en la suite de BD: ejecuta la escritura de verdad. Si una
// columna nueva no encaja con su FK, con su CHECK o con su tipo, aqui truena; no en el navegador de
// Santiago.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el bloque contra BD se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const DOCUMENTO = `PRESENCIAL-${Date.now()}`;
let creado: string | null = null;

afterEach(async () => {
  if (!HAS_DB || !creado) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  // Orden inverso al de creacion. El paciente de prueba se borra entero: no deja rastro en un entorno
  // que tambien usa el smoke.
  await db.delete(schema.evaluations).where(eq(schema.evaluations.patientId, creado));
  await db.delete(schema.patientConsents).where(eq(schema.patientConsents.patientId, creado));
  await db.delete(schema.patientContacts).where(eq(schema.patientContacts.patientId, creado));
  await db.delete(schema.patientProfiles).where(eq(schema.patientProfiles.patientId, creado));
  await db
    .delete(schema.patientProfessionalRelationships)
    .where(eq(schema.patientProfessionalRelationships.patientId, creado));
  await db.delete(schema.patients).where(eq(schema.patients.id, creado));
  creado = null;
});

// El dueño del acto: un profesional real del seed, con SUS DOS ids, que es justo lo que se confundio.
async function profesionalDemo() {
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  // La organizacion vive en `profiles`, no en la ficha profesional: hay que unirlas, y esa union es
  // justamente la que hace visible que son DOS tablas con dos ids distintos.
  const [p] = await db
    .select({
      professionalProfileId: schema.professionalProfiles.id,
      profileId: schema.professionalProfiles.profileId,
      organizationId: schema.profiles.organizationId,
    })
    .from(schema.professionalProfiles)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.professionalProfiles.profileId))
    .limit(1);
  return p;
}

function identidad() {
  return {
    documentType: "CC" as const,
    documentNumber: DOCUMENTO,
    firstName: "Prueba",
    lastName: "Presencial",
    birthDate: "1990-05-05",
    sex: "F",
    country: "Colombia",
    city: "Medellín",
    email: "prueba.presencial@ejemplo.com",
    phone: null,
  };
}

function consentimientos(version: string, hash: string) {
  return (["servicio", "datos_sensibles", "aceptacion_medio_electronico"] as const).map((type) => ({
    type,
    consentVersion: version,
    documentHash: hash,
  }));
}

describe.skipIf(!HAS_DB)("firma presencial: la escritura completa (BD real)", () => {
  it("crea paciente, consentimientos y evaluación, y sella el canal y la declaración", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { signIntakeEvaluation } = await import("@/modules/evaluations/data/intake-writer");
    const { CONSENT_DOCUMENT_HASH, CONSENT_VERSION } = await import(
      "@/modules/consent/consent-hash"
    );
    const { DECLARACION_PRESENCIAL_VERSION } = await import(
      "@/modules/consent/text/declaracion-presencial"
    );

    const pro = await profesionalDemo();
    expect(pro, "el seed deja al menos un profesional").toBeDefined();

    const r = await signIntakeEvaluation({
      organizationId: pro.organizationId,
      professionalId: pro.professionalProfileId,
      mode: "inicial",
      patientId: null,
      identity: identidad(),
      consents: consentimientos(CONSENT_VERSION, CONSENT_DOCUMENT_HASH),
      linkId: null,
      ipAddress: null,
      signature: { channel: "email", maskedDestination: "***o.com", sentAt: Date.now(), validatedAt: Date.now() },
      presencial: {
        canal: "presencial_otp",
        // LA PERSONA, no su ficha profesional: `declared_by` referencia `profiles(id)`. Pasar aqui el
        // `professional_profiles.id` es el defecto que rompio el smoke, y compila igual de verde.
        declaradoPorProfileId: pro.profileId,
        declaracionVersion: DECLARACION_PRESENCIAL_VERSION,
      },
    });
    creado = r.patientId;

    expect(r.evaluationId).toBeTruthy();
    expect(r.resumeToken).toBeTruthy();

    // La evaluacion queda esperando la encuesta, atribuida al profesional, y sin enlace consumido.
    const [ev] = await db
      .select({ status: schema.evaluations.status, type: schema.evaluations.type })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, r.evaluationId));
    expect(ev.status).toBe("awaiting_survey");
    expect(ev.type).toBe("inicial");

    // Y LAS TRES AUTORIZACIONES llevan el sello presencial. Es lo que la 0105 exige coherente: canal
    // presencial y declaracion van juntos o no van.
    const consents = await db
      .select({
        tipo: schema.patientConsents.consentType,
        canal: schema.patientConsents.signatureChannel,
        declaradoPorProfileId: schema.patientConsents.declaredBy,
        version: schema.patientConsents.declarationVersion,
      })
      .from(schema.patientConsents)
      .where(eq(schema.patientConsents.patientId, r.patientId));
    expect(consents).toHaveLength(3);
    for (const c of consents) {
      expect(c.canal, `${c.tipo} sin canal presencial`).toBe("presencial_otp");
      expect(c.declaradoPorProfileId, `${c.tipo} sin quien declara`).toBe(pro.profileId);
      expect(c.version).toBe(DECLARACION_PRESENCIAL_VERSION);
    }
  });

  it("el id EQUIVOCADO del profesional revienta, y no deja NADA escrito", async () => {
    // EL CONTROL, y es el que hace util a la prueba de arriba: sin el, un verde solo dice que este
    // camino funciona hoy, no que la distincion entre los dos ids importe.
    //
    // Y la segunda mitad es lo que Santiago preguntó: si la firma falla, ¿queda un paciente sin
    // consentimiento? No. Todo va en UNA transaccion, asi que el fallo se lleva por delante tambien al
    // paciente que se acababa de crear.
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { signIntakeEvaluation } = await import("@/modules/evaluations/data/intake-writer");
    const { CONSENT_DOCUMENT_HASH, CONSENT_VERSION } = await import(
      "@/modules/consent/consent-hash"
    );

    const pro = await profesionalDemo();
    const documento = `${DOCUMENTO}-MAL`;
    let fallo = false;
    try {
      await signIntakeEvaluation({
        organizationId: pro.organizationId,
        professionalId: pro.professionalProfileId,
        mode: "inicial",
        patientId: null,
        identity: { ...identidad(), documentNumber: documento },
        consents: consentimientos(CONSENT_VERSION, CONSENT_DOCUMENT_HASH),
        linkId: null,
        ipAddress: null,
        presencial: {
          canal: "presencial_otp",
          // La ficha profesional en vez de la persona: no existe en `profiles`, la FK lo rechaza.
          declaradoPorProfileId: pro.professionalProfileId,
          declaracionVersion: "1.0",
        },
      });
    } catch {
      fallo = true;
    }
    expect(fallo, "un declared_by que no es un profile debe ser rechazado por la FK").toBe(true);

    const restos = await db
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(
        and(
          eq(schema.patients.documentNumber, documento),
          inArray(schema.patients.organizationId, [pro.organizationId]),
        ),
      );
    expect(restos, "la transacción tiene que llevarse el paciente por delante").toHaveLength(0);
  });
});

// EL PASO DE ANTES, que la accion da y ninguna prueba tocaba: la firma presencial no recibe token, asi
// que resuelve el enlace BASE del consultorio en servidor. Si ese enlace no resolviera a una vista usable
// (consumido, vencido, inexistente), la accion se pararia en "No se pudo preparar la evaluación" y
// estariamos otra vez descubriendo el siguiente paso en el navegador de Santiago.
describe.skipIf(!HAS_DB)("el enlace base del consultorio resuelve (BD real)", () => {
  it("existe, es de tipo inicial y sigue usable", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { resolveSurveyLinkByToken } = await import(
      "@/modules/evaluations/data/survey-links-reader"
    );

    const pro = await profesionalDemo();
    const [base] = await db
      .select({ token: schema.surveyLinks.token })
      .from(schema.surveyLinks)
      .where(
        and(
          eq(schema.surveyLinks.professionalId, pro.professionalProfileId),
          eq(schema.surveyLinks.type, "inicial"),
        ),
      )
      .limit(1);
    expect(base, "el seed deja el link base del profesional").toBeDefined();

    const vista = await resolveSurveyLinkByToken(base.token);
    // null aqui = la accion presencial responde "No se pudo preparar la evaluación".
    expect(vista, "el enlace base tiene que seguir usable: los iniciales no se consumen").not.toBeNull();
    expect(vista!.type).toBe("inicial");
    expect(vista!.patientId, "el base no está atado a un paciente").toBeNull();
    expect(vista!.professionalId).toBe(pro.professionalProfileId);
    expect(vista!.organizationId).toBe(pro.organizationId);
  });
});
