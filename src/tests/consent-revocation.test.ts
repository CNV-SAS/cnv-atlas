import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

// `server-only` es un guard del bundler de Next; en vitest no existe como paquete resoluble.
vi.mock("server-only", () => ({}));

import { canCreateEvaluation } from "@/modules/evaluations/policies/can-create-evaluation";

// CANDADO DE LA REVOCACION (2026-08-28). Es un ACTO LEGAL: el documento que el paciente firma promete
// que puede revocar "en cualquier momento ante el profesional de salud o escribiendo a
// protecciondatos@cnvsystem.com" (CONSENT_ATLAS numeral 10). Hasta hoy solo se podia con un UPDATE a mano,
// sin actor, sin motivo y sin traza.
//
// Va contra BD REAL y no con mocks a proposito: lo que se prueba son propiedades de la ESCRITURA (que el
// audit quede en la misma transaccion, que sea idempotente, que el gate lo vea) y un mock las daria todas
// por buenas sin tocar la base.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const PATIENT_ID = "c0000000-0000-0000-0000-00000000c001";

// EL WRITER SE IMPORTA DINAMICAMENTE, dentro de beforeAll: `@/db` lee DATABASE_URL AL CARGARSE, y los
// imports estaticos de ESM corren ANTES del cuerpo del modulo (donde se llama a loadEnvFile). Con import
// estatico, Drizzle se inicializa sin cadena y falla con ECONNREFUSED contra localhost:5432. Mismo patron
// que `correct-evaluation.test.ts` y `golden-path.seed.test.ts`.
let revokeConsents: typeof import("@/modules/consent/data/consent-revocation-writer").revokeConsents;

// Motivos UNICOS por caso: son el ancla de las aserciones sobre el log append-only (ver `limpiar`).
const MOTIVO_1 = "El paciente pidió salir del uso para investigación.";
const MOTIVO_2 = "Segundo intento sobre lo mismo.";

let actorId: string;

beforeAll(async () => {
  revokeConsents = (await import("@/modules/consent/data/consent-revocation-writer")).revokeConsents;

  [{ id: actorId }] = await sql`
    select p.id from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where r.name = 'admin' limit 1`;

  await limpiar();
  await sql`
    insert into public.patients (id, organization_id, document_type, document_number, status)
    values (${PATIENT_ID}, ${ORG_ID}, 'CC', 'REVOKE-TEST-001', 'active')`;
  // Las dos NECESARIAS del gate (regla dura 15) mas una opcional, para probar que se revoca POR FINALIDAD.
  for (const t of ["servicio", "datos_sensibles", "investigacion"]) {
    await sql`
      insert into public.patient_consents (patient_id, consent_type, consent_version, document_hash)
      values (${PATIENT_ID}, ${t}::consent_type_enum, '1.0', 'hash-de-prueba')`;
  }
});

afterAll(async () => {
  await limpiar();
  await sql.end();
});

async function limpiar() {
  // EL AUDIT NO SE LIMPIA: `clinical_audit_log` es append-only por trigger y rechaza el DELETE. No es un
  // estorbo del test, es la garantia funcionando; el test se adapta a ella y no al reves. Por eso las
  // aserciones sobre el log se anclan al MOTIVO de cada acto (unico por caso) y no a un conteo por
  // paciente, que crecería en cada corrida y dejaría el test verde solo la primera vez.
  await sql`delete from public.evaluations where id = ${EVAL_ID}`;
  await sql`delete from public.patient_consents where patient_id = ${PATIENT_ID}`;
  await sql`delete from public.patients where id = ${PATIENT_ID}`;
}

async function vigentes(): Promise<string[]> {
  const rows = await sql<{ consent_type: string }[]>`
    select consent_type from public.patient_consents
    where patient_id = ${PATIENT_ID} and revoked_at is null`;
  return rows.map((r) => r.consent_type);
}

describe("revokeConsents (BD real)", () => {
  it("revoca POR FINALIDAD: solo la pedida, no las demas", async () => {
    const r = await revokeConsents({
      patientId: PATIENT_ID,
      types: ["investigacion"],
      motivo: MOTIVO_1,
      canal: "profesional",
      actorId,
      actorEmail: "admin@prueba.local",
      ip: null,
    });

    expect(r.revocados).toEqual(["investigacion"]);
    // Las necesarias siguen intactas: revocar una opcional NO puede tocar la atencion.
    expect((await vigentes()).sort()).toEqual(["datos_sensibles", "servicio"]);
  });

  it("deja la traza INLINE, con actor y motivo (regla dura 8)", async () => {
    const [fila] = await sql<{ actor_id: string; payload: Record<string, unknown> }[]>`
      select actor_id, payload from public.clinical_audit_log
      where entity_id = ${PATIENT_ID} and event = 'consent.revoked'
        and payload->>'motivo' = ${MOTIVO_1}`;

    expect(fila).toBeDefined();
    expect(fila.actor_id).toBe(actorId);
    // El MOTIVO no tiene columna propia: vive aqui, que ademas es inmutable.
    expect(fila.payload.motivo).toBe(MOTIVO_1);
    expect(fila.payload.canal).toBe("profesional");
    expect(fila.payload.types).toEqual(["investigacion"]);
  });

  it("ES IDEMPOTENTE: revocar de nuevo no reescribe la marca ni audita otra vez", async () => {
    const [{ revoked_at: primera }] = await sql<{ revoked_at: string }[]>`
      select revoked_at from public.patient_consents
      where patient_id = ${PATIENT_ID} and consent_type = 'investigacion'`;

    const r = await revokeConsents({
      patientId: PATIENT_ID,
      types: ["investigacion"],
      motivo: MOTIVO_2,
      canal: "profesional",
      actorId,
      actorEmail: "admin@prueba.local",
      ip: null,
    });

    // Nada que revocar: la fecha que vale ante un reclamo es la de la PRIMERA revocacion.
    expect(r.revocados).toEqual([]);
    const [{ revoked_at: sigue }] = await sql<{ revoked_at: string }[]>`
      select revoked_at from public.patient_consents
      where patient_id = ${PATIENT_ID} and consent_type = 'investigacion'`;
    expect(sigue).toEqual(primera);

    // NO se audito el segundo acto: no hay ninguna fila con el motivo del segundo intento.
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.clinical_audit_log
      where entity_id = ${PATIENT_ID} and event = 'consent.revoked'
        and payload->>'motivo' = ${MOTIVO_2}`;
    expect(n).toBe(0);
  });

  it("revocar una NECESARIA bloquea evaluaciones nuevas, por el gate real", async () => {
    expect(canCreateEvaluation((await vigentes()) as never).ok).toBe(true);

    await revokeConsents({
      patientId: PATIENT_ID,
      types: ["datos_sensibles"],
      motivo: "El paciente revoca el tratamiento de datos sensibles de salud.",
      canal: "proteccion_datos",
      actorId,
      actorEmail: "admin@prueba.local",
      ip: null,
    });

    // No se consulta una copia del criterio: se le pregunta al MISMO gate que corre en el intake.
    const gate = canCreateEvaluation((await vigentes()) as never);
    expect(gate.ok).toBe(false);
    expect(gate.ok === false && gate.missing).toEqual(["datos_sensibles"]);
  });

  it("NO borra la historia: las filas revocadas siguen ahi, con su fecha de firma", async () => {
    const rows = await sql<{ consent_type: string; signed_at: string; revoked_at: string }[]>`
      select consent_type, signed_at, revoked_at from public.patient_consents
      where patient_id = ${PATIENT_ID}`;

    // Las tres autorizaciones siguen existiendo; lo que cambia es que dos tienen revoked_at.
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.signed_at != null)).toBe(true);
    expect(rows.filter((r) => r.revoked_at != null)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO DE MEDIA SESION (DATA_GOVERNANCE (c)), cerrado el 2026-08-28.
//
// Lo que este candado protege es una SECUENCIA, no una funcion: el gate de la regla 15 corre al CREAR la
// evaluacion, asi que "hay gate" era verdad y aun asi la captura seguia despues de una revocacion. Un test
// sobre el gate solo habria pasado verde. Por eso se reproduce el camino entero.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

const EVAL_ID = "c0000000-0000-0000-0000-00000000c002";
const RESUME_TOKEN = "token-de-prueba-revocacion-media-sesion";

let closeAwaitingIfConsentRevoked: typeof import("@/modules/evaluations/data/intake-writer").closeAwaitingIfConsentRevoked;
let getResumeTokenStatus: typeof import("@/modules/evaluations/data/intake-writer").getResumeTokenStatus;

describe("revocacion A MEDIA SESION (BD real)", () => {
  beforeAll(async () => {
    const w = await import("@/modules/evaluations/data/intake-writer");
    closeAwaitingIfConsentRevoked = w.closeAwaitingIfConsentRevoked;
    getResumeTokenStatus = w.getResumeTokenStatus;

    // Paciente NUEVO con sus dos necesarias vigentes, y un shell firmado sin responder.
    await sql`delete from public.evaluations where id = ${EVAL_ID}`;
    await sql`delete from public.patient_consents where patient_id = ${PATIENT_ID}`;
    await sql`delete from public.patients where id = ${PATIENT_ID}`;
    await sql`
      insert into public.patients (id, organization_id, document_type, document_number, status)
      values (${PATIENT_ID}, ${ORG_ID}, 'CC', 'REVOKE-TEST-001', 'active')`;
    for (const t of ["servicio", "datos_sensibles"]) {
      await sql`
        insert into public.patient_consents (patient_id, consent_type, consent_version, document_hash)
        values (${PATIENT_ID}, ${t}::consent_type_enum, '1.0', 'hash-de-prueba')`;
    }
    const [prof] = await sql<{ id: string }[]>`select id from public.professional_profiles limit 1`;
    await sql`
      insert into public.evaluations (id, patient_id, professional_id, organization_id, type, status, resume_token, consent_version)
      values (${EVAL_ID}, ${PATIENT_ID}, ${prof.id}, ${ORG_ID}, 'inicial', 'awaiting_survey', ${RESUME_TOKEN}, '1.0')`;
  });

  it("CON las autorizaciones vigentes, el guard no estorba: la encuesta sigue abierta", async () => {
    const r = await closeAwaitingIfConsentRevoked(RESUME_TOKEN, null);
    expect(r.bloqueada).toBe(false);
    const [ev] = await sql<{ status: string }[]>`
      select status from public.evaluations where id = ${EVAL_ID}`;
    expect(ev.status).toBe("awaiting_survey");
  });

  it("TRAS REVOCAR, la captura se detiene Y la evaluacion se CIERRA (no queda colgada esperando)", async () => {
    await revokeConsents({
      patientId: PATIENT_ID,
      types: ["servicio"],
      motivo: "El paciente retira su autorización a media encuesta.",
      canal: "profesional",
      actorId,
      actorEmail: "admin@prueba.local",
      ip: null,
    });

    const r = await closeAwaitingIfConsentRevoked(RESUME_TOKEN, null);
    expect(r.bloqueada).toBe(true);
    const [ev] = await sql<{ status: string }[]>`
      select status from public.evaluations where id = ${EVAL_ID}`;
    expect(ev.status).toBe("abandoned");
  });

  it("deja traza SIN ACTOR: el acto es del paciente, y atribuirselo a un profesional seria falso", async () => {
    const [fila] = await sql<{ actor_id: string | null }[]>`
      select actor_id from public.clinical_audit_log
      where entity_id = ${EVAL_ID} and event = 'evaluation.closed_consent_revoked'`;
    expect(fila).toBeDefined();
    expect(fila.actor_id).toBeNull();
  });

  it("el paciente ve que RETIRO SU AUTORIZACION, no que su profesional cerro la evaluacion", async () => {
    // Las dos situaciones dejan la evaluacion en 'abandoned'; lo que las distingue es el consentimiento,
    // que se DERIVA en vez de sellarse, para que no haya dos fuentes que puedan discrepar.
    const st = await getResumeTokenStatus(RESUME_TOKEN);
    expect(st).toEqual({ status: "abandoned", consentRevocado: true });
  });

  it("ES IDEMPOTENTE: volver al enlace cerrado no vuelve a cerrar ni a auditar", async () => {
    // SE MIDE EL DELTA, no el total: el audit es append-only (no se puede limpiar) y el id de la
    // evaluacion es fijo, asi que un total crecería en cada corrida y el test solo sería verde la primera.
    const antes = await cierresAuditados();
    const r = await closeAwaitingIfConsentRevoked(RESUME_TOKEN, null);
    expect(r.bloqueada).toBe(false); // ya no esta en 'awaiting_survey': no es asunto de este guard
    expect(await cierresAuditados()).toBe(antes);
  });

  async function cierresAuditados(): Promise<number> {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.clinical_audit_log
      where entity_id = ${EVAL_ID} and event = 'evaluation.closed_consent_revoked'`;
    return n;
  }
});
