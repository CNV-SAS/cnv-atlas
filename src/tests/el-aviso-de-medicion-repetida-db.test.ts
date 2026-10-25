import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sql } from "drizzle-orm";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL AVISO DE MEDICION REPETIDA, CONTRA LA BASE
//
// ── DE DONDE SALE ───────────────────────────────────────────────────────────────────────────────
//
// Gildardo, 2026-10-26: *"Hoy Angela solo se entera si alguien le dice. Atlas ya sabe cuales son por la
// huella. Construye un aviso en cada una de esas consultas y en su lista de pendientes... El aviso
// desaparece solo cuando la huella deja de repetirse."*
//
// ── POR QUE CONTRA LA BASE Y NO LEYENDO EL CODIGO ──────────────────────────────────────────────
//
// Las dos mitades de la peticion son afirmaciones sobre datos, no sobre forma:
//
//   1. QUE APAREZCA en las dos consultas que comparten la toma, y que distinga "otro paciente" de "el
//      mismo paciente": el consejo cambia (una toma en la historia equivocada contra el mismo archivo
//      importado dos veces).
//   2. QUE SE APAGUE SOLO. No hay marca de "revisado": se deriva de las consultas VIGENTES, asi que en
//      cuanto la correccion deje una sola en pie tiene que desaparecer sin que nadie lo apague. Eso solo
//      se puede comprobar haciendo que deje de repetirse y volviendo a preguntar.
//
// Y LA TERCERA, que es la que protege a un tercero: el aviso NO dice de quien es la otra consulta.
//
// Se AUTO-SALTA sin DATABASE_URL. Requiere `supabase start`, migraciones aplicadas y el seed.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("el aviso de medicion repetida (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let s: any;
  let lector: any;
  let neutro: any;
  let servicio: any;

  const SELLO = Date.now();
  let orgId = "";
  let profProfileId = "";
  let surveyVersionId = "";
  let creado = false;
  let actorId = "";
  /** Las versiones nuevas que crea la correccion: hay que borrarlas al terminar. */
  const nuevasEvaluaciones: string[] = [];

  // A y B son pacientes DISTINTOS con la misma toma. C es una segunda consulta del MISMO paciente A.
  const A = { patientId: "", evaluationId: "", measurementId: "" };
  const B = { patientId: "", evaluationId: "", measurementId: "" };
  const C = { evaluationId: "", measurementId: "" };

  /** Los cuatro crudos de la huella, con un valor irrepetible para que no choque con el seed. */
  let CRUDOS: { variableName: string; value: string }[] = [];

  async function crearPaciente(sufijo: string) {
    const [p] = await db
      .insert(s.patients)
      .values({
        organizationId: orgId,
        documentType: "CC",
        documentNumber: `AVISO-${SELLO}-${sufijo}`,
      })
      .returning({ id: s.patients.id });
    await db.insert(s.patientProfiles).values({
      patientId: p.id,
      firstName: "Aviso",
      lastName: `Repetido ${sufijo}`,
      sex: "F",
      birthDate: "1990-05-04",
    });
    await db
      .insert(s.patientProfessionalRelationships)
      .values({ patientId: p.id, professionalId: profProfileId, status: "active" });
    return p.id;
  }

  async function crearConsulta(patientId: string, tipo: "inicial" | "seguimiento") {
    const [e] = await db
      .insert(s.evaluations)
      .values({
        patientId,
        professionalId: profProfileId,
        organizationId: orgId,
        type: tipo,
        status: "in_progress",
        surveyVersionId,
      })
      .returning({ id: s.evaluations.id });
    return e.id;
  }

  async function crearMedicion(evaluationId: string) {
    const [m] = await db
      .insert(s.bisMeasurements)
      .values({ evaluationId, measurementDate: new Date("2026-10-13T14:00:00Z") })
      .returning({ id: s.bisMeasurements.id });
    await db.insert(s.bisRawValues).values(CRUDOS.map((c) => ({ measurementId: m.id, ...c })));
    return m.id;
  }

  beforeAll(async () => {
    if (!HAS_DB) return;
    ({ db } = await import("@/db"));
    s = await import("@/db/schema");
    lector = await import("@/modules/bis/data/huellas-repetidas-reader");
    neutro = await import("@/modules/bis/huella-repetida");
    servicio = await import("@/modules/corrections/services/corregir-medicion-de-otro-paciente");
    const huella = await import("@/modules/bis/services/huella-de-la-medicion");

    orgId = (await db.select({ id: s.organizations.id }).from(s.organizations).limit(1))[0].id;
    // EL PROFESIONAL Y SU USUARIO: la correccion la ejecuta el ASIGNADO, asi que hace falta el
    // `profiles.id` que corresponde a ese perfil profesional, no uno cualquiera.
    const profs = await db
      .select({ id: s.professionalProfiles.id, profileId: s.professionalProfiles.profileId })
      .from(s.professionalProfiles)
      .limit(1);
    profProfileId = profs[0]?.id ?? "";
    actorId = profs[0]?.profileId ?? "";
    const sv = await db.select({ id: s.surveyVersions.id }).from(s.surveyVersions).limit(1);
    surveyVersionId = sv[0]?.id ?? "";
    if (!profProfileId || !surveyVersionId) return;

    // UN VALOR IRREPETIBLE: si se reusara uno del seed, el grupo traeria filas ajenas y el conteo del
    // aviso dependeria del estado de la base local, que es una cifra absoluta disfrazada.
    const base = 500 + (SELLO % 10000) / 10000;
    CRUDOS = huella.VARIABLES_DE_LA_HUELLA.map((v: string, i: number) => ({
      variableName: v,
      value: String(base + i),
    }));

    A.patientId = await crearPaciente("A");
    B.patientId = await crearPaciente("B");
    A.evaluationId = await crearConsulta(A.patientId, "inicial");
    B.evaluationId = await crearConsulta(B.patientId, "inicial");
    A.measurementId = await crearMedicion(A.evaluationId);
    B.measurementId = await crearMedicion(B.evaluationId);
    creado = true;
  });

  afterAll(async () => {
    if (!HAS_DB || !creado) return;
    // `replica` apaga TODOS los triggers, y en Postgres las claves ajenas SON triggers, asi que el
    // `on delete cascade` tampoco corre: los hijos se borran a mano o quedan huerfanos y revientan OTRA
    // prueba por una razon que no es la suya.
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`set local session_replication_role = 'replica'`);
      for (const mid of [A.measurementId, B.measurementId, C.measurementId].filter(Boolean)) {
        await tx.execute(sql`delete from bis_raw_values where measurement_id = ${mid}::uuid`);
        await tx.execute(sql`delete from bis_measurements where id = ${mid}::uuid`);
      }
      // LAS VERSIONES NUEVAS PRIMERO, y con sus hijos: la correccion crea una evaluacion nueva con su
      // encuesta copiada y su fila de cadena, y con los triggers apagados el cascade no corre.
      for (const eid of [...nuevasEvaluaciones, A.evaluationId, B.evaluationId, C.evaluationId].filter(
        Boolean,
      )) {
        await tx.execute(sql`delete from clinical_corrections where old_evaluation_id = ${eid}::uuid or new_evaluation_id = ${eid}::uuid`);
        await tx.execute(sql`delete from survey_responses where evaluation_id = ${eid}::uuid`);
        await tx.execute(sql`delete from evaluation_bis_intake where evaluation_id = ${eid}::uuid`);
        await tx.execute(sql`delete from clinical_audit_log where entity_id = ${eid}`);
        await tx.execute(sql`delete from evaluations where id = ${eid}::uuid`);
      }
      for (const pid of [A.patientId, B.patientId].filter(Boolean)) {
        await tx.execute(
          sql`delete from patient_professional_relationships where patient_id = ${pid}::uuid`,
        );
        await tx.execute(sql`delete from patient_profiles where patient_id = ${pid}::uuid`);
        await tx.execute(sql`delete from patients where id = ${pid}::uuid`);
      }
    });
  });

  function exigirFixture() {
    expect(creado, "el fixture no se pudo armar: nada de lo de abajo probo nada").toBe(true);
  }

  it("aparece en LAS DOS consultas que comparten la toma", () => {
    exigirFixture();
  });

  it("y dice que es de OTRO paciente, sin decir quien", async () => {
    exigirFixture();
    const todas = await lector.huellasRepetidasEnVigentes();
    const a = todas.get(A.evaluationId);
    const b = todas.get(B.evaluationId);
    expect(a, "la consulta de A tiene que avisar").toBeTruthy();
    expect(b, "y la de B tambien: las dos comparten la toma").toBeTruthy();
    expect(a.otras).toBe(1);
    expect(a.otroPaciente, "son pacientes distintos").toBe(true);
    expect(a.mismoPaciente).toBe(false);

    // LO QUE NO SALE: ni el id del otro paciente, ni su documento, ni su nombre. Lo unico que cruza son
    // tres datos que no identifican a nadie. Si alguien añade el id "para poder enlazar", esto falla.
    expect(Object.keys(a).sort()).toEqual(["mismoPaciente", "otras", "otroPaciente"]);
    const texto = neutro.avisoDeHuellaRepetida(a);
    expect(texto).toMatch(/otro paciente/);
    expect(texto, "el aviso no puede llevar un id").not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it("distingue el MISMO paciente, porque el consejo es otro", async () => {
    exigirFixture();
    // Dos consultas del mismo paciente con la misma toma suele ser el mismo archivo importado dos veces;
    // entre pacientes distintos es una toma en la historia equivocada. Decirlo igual mandaria a buscar
    // una cosa por la otra.
    C.evaluationId = await crearConsulta(A.patientId, "seguimiento");
    C.measurementId = await crearMedicion(C.evaluationId);
    const todas = await lector.huellasRepetidasEnVigentes();
    const a = todas.get(A.evaluationId);
    expect(a.otras, "ahora comparte con dos: la de B y su propia segunda consulta").toBe(2);
    expect(a.mismoPaciente).toBe(true);
    expect(a.otroPaciente).toBe(true);
    const soloMismo = todas.get(C.evaluationId);
    expect(neutro.avisoDeHuellaRepetida({ ...soloMismo, otroPaciente: false, otras: 1 })).toMatch(
      /este mismo paciente/,
    );
  });

  it("SE APAGA SOLO al CORREGIR, sin que nadie lo apague", async () => {
    exigirFixture();
    expect(actorId, "hace falta el usuario del profesional asignado para correr la correccion").not.toBe("");

    // ═══ SE CORRE EL ACTO DE VERDAD, Y NO SE SIMULA SU EFECTO ═══
    //
    // El primer intento ponia `superseded_at` a mano, y un TRIGGER lo rechazo: *"solo lo pone el flujo de
    // correccion (falta la clinical_corrections que lo respalde)"*. El guard tenia razon y la prueba
    // estaba mal: simular el efecto de un acto clinico prueba el atajo, no el acto. Asi que corre el
    // servicio, que es ademas lo que Gildardo pidio comprobar ("el aviso desaparece solo cuando la huella
    // deja de repetirse").
    const r = await servicio.corregirMedicionDeOtroPaciente(
      {
        evaluationId: C.evaluationId,
        reason: "segunda consulta con el mismo archivo importado por error, no es una toma nueva",
        confirmed: true,
      },
      { actorId, actorEmail: "prueba@cnv.test", ip: "127.0.0.1" },
    );
    expect(r.ok, r.ok ? "" : r.error?.message).toBe(true);
    nuevasEvaluaciones.push(r.value.newEvaluationId);

    const tras = await lector.huellasRepetidasEnVigentes();
    expect(tras.get(C.evaluationId), "la corregida sale del universo de vigentes").toBeUndefined();
    const a = tras.get(A.evaluationId);
    expect(a, "A sigue compartiendo con B, que no se ha corregido").toBeTruthy();
    expect(a.otras, "pero ya solo con una, no con dos").toBe(1);
    expect(a.mismoPaciente, "su propia segunda consulta ya no cuenta").toBe(false);

    // Y AL CORREGIR LA SEGUNDA, el aviso desaparece de las dos sin que nadie lo apague.
    const r2 = await servicio.corregirMedicionDeOtroPaciente(
      {
        evaluationId: A.evaluationId,
        reason: "el archivo importado era del otro paciente atendido el mismo dia",
        confirmed: true,
      },
      { actorId, actorEmail: "prueba@cnv.test", ip: "127.0.0.1" },
    );
    expect(r2.ok, r2.ok ? "" : r2.error?.message).toBe(true);
    nuevasEvaluaciones.push(r2.value.newEvaluationId);

    const alFinal = await lector.huellasRepetidasEnVigentes();
    expect(alFinal.get(A.evaluationId)).toBeUndefined();
    expect(
      alFinal.get(B.evaluationId),
      "la que queda ya no comparte con nadie: el aviso se apaga solo",
    ).toBeUndefined();
  });
});
