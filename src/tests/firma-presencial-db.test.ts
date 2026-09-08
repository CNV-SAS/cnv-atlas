import { afterEach, describe, expect, it, vi } from "vitest";

import { and, eq, inArray, sql } from "drizzle-orm";

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

// ── EL HUECO DEL ENLACE PUBLICO (verificado por Santiago, cerrado el 2026-09-08) ────────────────────
//
// Desde el enlace de consultorio, que es PUBLICO y esta pensado para imprimirse y pegarse en la sala, se
// podia teclear la cedula de un paciente de otro profesional de la organizacion. La resolucion por
// documento devolvia 'seguimiento' y el writer insertaba la relacion paciente-profesional, que es la que
// lee `is_patient_professional`, que es la que gobierna TODAS las policies de datos de paciente.
//
// O sea: no era atribucion equivocada, era acceso permanente a la historia clinica completa de un
// paciente ajeno. Y el gate de la regla 15 no lo paraba, porque el paciente ya tenia sus autorizaciones.
describe.skipIf(!HAS_DB)("la regla de propiedad tiene UNA sola definición (BD real)", () => {
  it("is_patient_of contesta bien, y is_patient_professional delega en ella", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");

    const [rel] = await db
      .select({
        patientId: schema.patientProfessionalRelationships.patientId,
        professionalId: schema.patientProfessionalRelationships.professionalId,
      })
      .from(schema.patientProfessionalRelationships)
      .limit(1);
    expect(rel, "el seed deja al menos una relación paciente-profesional").toBeDefined();

    const suyo = await db.execute(
      sql`select public.is_patient_of(${rel.patientId}::uuid, ${rel.professionalId}::uuid) as r`,
    );
    expect(suyo[0]?.r).toBe(true);

    // CONTROL: con otro profesional tiene que decir que no. Sin esto, un `select true` constante pasaría.
    const ajeno = await db.execute(
      sql`select public.is_patient_of(${rel.patientId}::uuid, gen_random_uuid()) as r`,
    );
    expect(ajeno[0]?.r).toBe(false);

    // Y el helper de siempre la LLAMA: es lo que garantiza que no haya dos definiciones que puedan
    // divergir. Se lee del catálogo, no del archivo .sql, porque lo que importa es lo que la base tiene.
    const def = await db.execute(
      sql`select prosrc from pg_proc where proname = 'is_patient_professional'`,
    );
    const cuerpo = String(def[0]?.prosrc ?? "");
    expect(cuerpo, "el helper tiene que delegar, no reimplementar la regla").toContain(
      "is_patient_of",
    );
    expect(cuerpo, "si vuelve a hacer el join él mismo, hay dos definiciones otra vez").not.toContain(
      "patient_professional_relationships",
    );
  });

  it("y solo el service_role puede ejecutarla", async () => {
    const { db } = await import("@/db");
    const r = await db.execute(sql`
      select
        has_function_privilege('service_role', 'public.is_patient_of(uuid,uuid)', 'EXECUTE') as service,
        has_function_privilege('anon', 'public.is_patient_of(uuid,uuid)', 'EXECUTE') as anon,
        has_function_privilege('authenticated', 'public.is_patient_of(uuid,uuid)', 'EXECUTE') as auth`);
    const fila = r[0] as Record<string, boolean>;
    expect(fila.service, "el intake público la necesita").toBe(true);
    // Postgres concede EXECUTE a PUBLIC por defecto: si alguien recrea la función sin el revoke de la
    // 0107, esto vuelve a ponerse en true y truena.
    expect(fila.anon, "una función que contesta de quién es un paciente no va abierta a anon").toBe(false);
    expect(fila.auth).toBe(false);
  });
});

// ── LA PENDIENTE DUPLICADA (misma tanda, 2026-09-08) ────────────────────────────────────────────────
//
// La base bloquea pacientes duplicados (patients_org_document_unique) pero NO evaluaciones pendientes
// duplicadas. El escenario es corriente: al paciente se le mando el enlace por correo, empieza la
// encuesta en casa, y despues entra otra vez (por el QR del consultorio, o el profesional se la abre en
// consulta). Quedaban DOS juegos de respuestas del mismo paciente, y quien diagnostique elige uno sin
// saber que existe el otro.
describe.skipIf(!HAS_DB)("una segunda encuesta pendiente no se crea: se retoma (BD real)", () => {
  it("el seguimiento sin firma devuelve la MISMA evaluación, no una nueva", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { signIntakeEvaluation, startFollowupWithoutSignature } = await import(
      "@/modules/evaluations/data/intake-writer"
    );
    const { CONSENT_DOCUMENT_HASH, CONSENT_VERSION } = await import(
      "@/modules/consent/consent-hash"
    );

    const pro = await profesionalDemo();
    // Un paciente nuevo con su primera evaluación, que queda en 'awaiting_survey'.
    const primera = await signIntakeEvaluation({
      organizationId: pro.organizationId,
      professionalId: pro.professionalProfileId,
      mode: "inicial",
      patientId: null,
      identity: { ...identidad(), documentNumber: `${DOCUMENTO}-PEND` },
      consents: consentimientos(CONSENT_VERSION, CONSENT_DOCUMENT_HASH),
      linkId: null,
      ipAddress: null,
    });
    creado = primera.patientId;

    // Y ahora se le intenta abrir otra en consulta, que es justo lo que pasaba.
    const segunda = await startFollowupWithoutSignature({
      organizationId: pro.organizationId,
      professionalId: pro.professionalProfileId,
      patientId: primera.patientId,
      linkId: null,
      ipAddress: null,
    });

    expect(segunda.evaluationId, "tiene que ser la misma, no una nueva").toBe(primera.evaluationId);
    expect(segunda.resumeToken, "y el mismo enlace, para que continúe donde iba").toBe(
      primera.resumeToken,
    );

    const todas = await db
      .select({ id: schema.evaluations.id })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.patientId, primera.patientId));
    expect(todas, "el paciente no puede acabar con dos juegos de respuestas").toHaveLength(1);
  });

  it("pero si la pendiente ya no está pendiente, SÍ se crea una nueva", async () => {
    // EL CONTROL. Sin el, "devuelve la misma" pasaría verde también con un writer que nunca cree nada, y
    // el seguimiento normal (paciente que vuelve a los tres meses) es el caso mayoritario.
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { signIntakeEvaluation, startFollowupWithoutSignature } = await import(
      "@/modules/evaluations/data/intake-writer"
    );
    const { CONSENT_DOCUMENT_HASH, CONSENT_VERSION } = await import(
      "@/modules/consent/consent-hash"
    );

    const pro = await profesionalDemo();
    const primera = await signIntakeEvaluation({
      organizationId: pro.organizationId,
      professionalId: pro.professionalProfileId,
      mode: "inicial",
      patientId: null,
      identity: { ...identidad(), documentNumber: `${DOCUMENTO}-CTRL` },
      consents: consentimientos(CONSENT_VERSION, CONSENT_DOCUMENT_HASH),
      linkId: null,
      ipAddress: null,
    });
    creado = primera.patientId;

    // La primera se completa (deja de estar pendiente).
    await db
      .update(schema.evaluations)
      .set({ status: "draft" })
      .where(eq(schema.evaluations.id, primera.evaluationId));

    const segunda = await startFollowupWithoutSignature({
      organizationId: pro.organizationId,
      professionalId: pro.professionalProfileId,
      patientId: primera.patientId,
      linkId: null,
      ipAddress: null,
    });
    expect(segunda.evaluationId).not.toBe(primera.evaluationId);
  });
});

// ── MODALIDAD 2 · LA SESION DEL QR (2026-09-09) ────────────────────────────────────────────────────
//
// EL CANDADO QUE FALTABA LA VEZ ANTERIOR: una migracion aplicada NO garantiza que el codigo escriba en
// las columnas nuevas. `values()` con claves que el schema de Drizzle no declara compila verde y no
// escribe nada. Aqui se comprueba contra la base REAL que el nombre y el TIPO de cada columna coinciden,
// que es lo que ni tsc ni lint pueden ver.
describe.skipIf(!HAS_DB)("la sesión del QR: schema y garantías (BD real)", () => {
  it("cada columna declarada en Drizzle existe en la base, con su tipo", async () => {
    const { db } = await import("@/db");
    const cols = await db.execute(sql`
      select column_name, data_type
      from information_schema.columns
      where table_name = 'presencial_consent_sessions'`);
    const tipos = new Map(cols.map((c) => [String(c.column_name), String(c.data_type)]));

    // Las que el dictamen exige, una por una, con el tipo que hace que signifiquen algo.
    expect(tipos.get("sin_correo_declarado"), "el gate del correo").toBe("boolean");
    expect(tipos.get("opened_at"), "cuándo abrió").toContain("timestamp");
    expect(tipos.get("confirmed_at"), "cuándo confirmó").toContain("timestamp");
    expect(tipos.get("patient_ip"), "el dispositivo del paciente").toBe("inet");
    expect(tipos.get("patient_user_agent")).toBe("text");
    expect(tipos.get("declarado_nombres"), "lo que el paciente escribió, tal cual").toBe("text");
    expect(tipos.get("declarado_document_number")).toBe("text");
  });

  it("la base rechaza tiempos incoherentes: confirmar sin haber abierto", async () => {
    // Es lo que hace que la DISTANCIA entre marcas signifique algo. Sin el CHECK, un confirmed_at suelto
    // se podria presentar como prueba de un acto que nunca se abrió.
    const { db } = await import("@/db");
    let rechazado = false;
    let motivo = "";
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          insert into presencial_consent_sessions
            (token, organization_id, professional_id, created_by, declaracion_version,
             document_type, document_number, expires_at, confirmed_at)
          select 'tok-test-incoherente', pr.organization_id, pp.id, pp.profile_id, '1.0',
                 'CC', 'X', now() + interval '15 min', now()
          from professional_profiles pp join profiles pr on pr.id = pp.profile_id limit 1`);
      });
      motivo = "el insert paso: el CHECK no lo paro";
    } catch (e) {
      // El mensaje puede venir en `message` o en `cause` segun por donde pase el error del driver, asi
      // que se miran los dos: afirmar sobre uno solo hace que el candado dependa del envoltorio y no de
      // la regla. La primera version miraba solo `String(e)` y salio roja con el CHECK funcionando.
      const err = e as { message?: string; cause?: unknown };
      motivo = [err.message, String(err.cause ?? ""), String(e)].join(" | ");
      rechazado = motivo.includes("tiempos_coherentes");
    }
    expect(rechazado, motivo).toBe(true);
  });

  it("y solo el profesional dueño ve sus sesiones (la regla se escribe una vez)", async () => {
    const { db } = await import("@/db");
    const def = await db.execute(
      sql`select prosrc from pg_proc where proname = 'es_mi_ficha_profesional'`,
    );
    expect(String(def[0]?.prosrc ?? ""), "falta el helper de propiedad de la ficha").toContain(
      "professional_profiles",
    );
    const pol = await db.execute(sql`
      select policyname, qual::text, with_check::text
      from pg_policies where tablename = 'presencial_consent_sessions'`);
    expect(pol.length, "las tres policies: select, insert y update").toBe(3);
    for (const p of pol) {
      const regla = `${p.qual ?? ""}${p.with_check ?? ""}`;
      expect(regla, `${p.policyname} no usa el helper`).toContain("es_mi_ficha_profesional");
    }
  });
});
