import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// El cliente de la base y los escritores llevan import "server-only", que no existe fuera de Next.
vi.mock("server-only", () => ({}));

// ═══ UN MENOR QUE FIRMO SIN REPRESENTANTE NO PUEDE QUEDAR DETENIDO (Santiago, 2026-10-15) ═══
//
// ── EL CASO, Y ES REAL ──────────────────────────────────────────────────────────────────────────
//
// Seis pacientes consintieron por el QR cuando ese camino no tenia rama de menor, asi que su
// consentimiento quedo guardado SIN representante. El "segundo muro" (DELTA2 B3) frenaba la CONFIRMACION
// DE IDENTIDAD de sus evaluaciones, que se quedaban en `draft`. Textual de Santiago: *"hoy reviso dichos
// pacientes y siguen bloqueados, entonces la profesional no ha podido hacer nada con ellos."* En la base
// local habia 3 pacientes y 2 evaluaciones paradas.
//
// ── POR QUE ESTE CANDADO VA CONTRA BASE REAL Y NO ES ESTATICO ───────────────────────────────────
//
// Porque lo que fallaba no era una funcion: era la SUMA de dos muros en dos capas (el de la rama contra la
// fecha, dentro de la transaccion de confirmar, y el del gate). Los dos se leen bien por separado. El
// unico sitio donde se ve si el paciente avanza es corriendo el camino entero contra Postgres, con sus
// triggers y su RLS.
//
// Y ES LA CLASE DE DEFECTO QUE VUELVE: cualquiera que lea `checkConsentBranchConsistency` manaña va a
// querer volver a bloquear ahi, porque leido solo parece lo correcto. Esto es lo que lo frena.

// EL ENV SE CARGA AQUI, como el resto de la suite de BD: vitest no lo pone en `process.env` por su
// cuenta, asi que sin esto el archivo se SALTA en silencio, que es la peor forma de tener un candado.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("un menor sin representante avanza, y queda MARCADO", () => {
  let db: typeof import("@/db").db;
  let orgId: string;
  let profId: string;
  let actorId: string;
  const pacientes: string[] = [];
  const evaluaciones: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    // EL QUE MENOS EVALUACIONES TIENE, por la misma razon que el resto de la suite: el profesional Demo
    // arrastra miles de filas y cualquier escritura suya dispara triggers sobre todas.
    // LA ORGANIZACION VIVE EN `profiles`, no en `professional_profiles`: son dos tablas y el id del
    // profesional no es el de la persona (la confusion que ya rompio un smoke entero).
    const [prof] = await db.execute<{ id: string; organization_id: string; profile_id: string }>(dsql`
      select pp.id, p.organization_id, pp.profile_id
        from professional_profiles pp
        join profiles p on p.id = pp.profile_id
        left join evaluations e on e.professional_id = pp.id
       group by pp.id, p.organization_id, pp.profile_id
       order by count(e.id)
       limit 1`);
    profId = prof.id;
    orgId = prof.organization_id;
    actorId = prof.profile_id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    // EL `set local` DENTRO DE LA TRANSACCION: `session_replication_role` es de SESION y el pool reparte
    // cada `execute` suelto por la conexion que este libre, asi que el permiso se daria en una y el delete
    // correria en otra con los triggers vivos.
    await db.transaction(async (tx) => {
      await tx.execute(dsql`set local session_replication_role = replica`);
      for (const id of evaluaciones) {
        await tx.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
        await tx.execute(dsql`delete from evaluations where id = ${id}`);
      }
      for (const id of pacientes) {
        await tx.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
        await tx.execute(dsql`delete from patient_consents where patient_id = ${id}`);
        await tx.execute(dsql`delete from patients where id = ${id}`);
      }
    });
  });

  /** Un menor con las necesarias vigentes y SIN representante, como los seis. */
  async function menorSinRepresentante(): Promise<{ patientId: string; evaluationId: string }> {
    const doc = `MEN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const [p] = await db.execute<{ id: string }>(dsql`
      insert into patients (organization_id, document_type, document_number, is_test)
      values (${orgId}, 'TI', ${doc}, true)
      returning id`);
    pacientes.push(p.id);
    await db.execute(dsql`
      insert into patient_professional_relationships (patient_id, professional_id)
      values (${p.id}, ${profId}) on conflict do nothing`);
    // 12 años el dia de la firma.
    await db.execute(dsql`
      insert into patient_profiles (patient_id, first_name, last_name, birth_date)
      values (${p.id}, 'Prueba', 'Menor', (current_date - interval '12 years')::date)`);
    for (const tipo of ["servicio", "datos_sensibles"]) {
      // EL CANAL Y LA DECLARACION VIAJAN JUNTOS O NO VIAJAN (CHECK `patient_consents_declaracion_coherente`):
      // un canal presencial sin la declaracion del profesional seria afirmar media cosa. Los seis casos
      // reales son `presencial_qr` con su declaracion, asi que el fixture reproduce eso y no un atajo.
      await db.execute(dsql`
        insert into patient_consents
          (patient_id, consent_type, consent_version, document_hash,
           signature_channel, declared_by, declaration_version)
        values (${p.id}, ${tipo}::consent_type_enum, '1.0', 'hash-de-prueba',
                'presencial_qr', ${actorId}, '1.0')`);
    }
    const [e] = await db.execute<{ id: string }>(dsql`
      insert into evaluations (organization_id, patient_id, professional_id, type, status)
      values (${orgId}, ${p.id}, ${profId}, 'inicial', 'draft')
      returning id`);
    evaluaciones.push(e.id);
    return { patientId: p.id, evaluationId: e.id };
  }

  it("CONFIRMAR IDENTIDAD pasa: su evaluacion avanza a in_progress", async () => {
    const { confirmEvaluationIdentity } = await import("@/modules/evaluations/data/evaluations-writer");
    const { patientId, evaluationId } = await menorSinRepresentante();

    // ESTO ES LO QUE ESTABA ROTO. Antes lanzaba `ConsentBranchMismatchError` y la evaluacion se quedaba
    // en `draft` para siempre, sin camino para desatascarla.
    const r = await confirmEvaluationIdentity({
      evaluationId,
      patientId,
      actorId,
      actorEmail: "prueba@local",
      ip: null,
    });
    expect(r.confirmed, "el muro volvio a frenar: la profesional se queda sin poder atender").toBe(true);

    const [ev] = await db.execute<{ status: string }>(dsql`
      select status from evaluations where id = ${evaluationId}`);
    expect(ev.status).toBe("in_progress");
  });

  it("y el hecho NO se perdio: el lector lo marca como pendiente de regularizar", async () => {
    // La otra mitad, y es la que hace que desbloquear no sea esconder: si esto se cayera, el menor sin
    // representante avanzaria y nadie sabria nunca que su consentimiento quedo corto.
    const { hechosDelConsentimiento, motivoDeRegularizacion } = await import(
      "@/modules/consent/regularizacion"
    );
    const { patientId } = await menorSinRepresentante();

    const filas = await db.execute<{ consent_type: string; signed_at: string }>(dsql`
      select consent_type, signed_at::text as signed_at
        from patient_consents where patient_id = ${patientId} and revoked_at is null`);
    const [perfil] = await db.execute<{ birth_date: string }>(dsql`
      select birth_date::text as birth_date from patient_profiles where patient_id = ${patientId}`);

    const motivo = motivoDeRegularizacion(
      hechosDelConsentimiento({ fechaDeNacimiento: perfil.birth_date, consents: filas }),
    );
    expect(motivo?.clave).toBe("menor_sin_representante");
    // Y marca sin frenar, que es la decision del 2026-10-15.
    expect(motivo?.frenaEvaluaciones).toBe(false);
  });

  it("el gate tampoco lo frena, con las necesarias vigentes", async () => {
    const { canCreateEvaluation } = await import("@/modules/evaluations/policies/can-create-evaluation");
    const { hechosDelConsentimiento, motivoDeRegularizacion } = await import(
      "@/modules/consent/regularizacion"
    );
    const { patientId } = await menorSinRepresentante();

    const filas = await db.execute<{ consent_type: string; signed_at: string }>(dsql`
      select consent_type, signed_at::text as signed_at
        from patient_consents where patient_id = ${patientId} and revoked_at is null`);
    const [perfil] = await db.execute<{ birth_date: string }>(dsql`
      select birth_date::text as birth_date from patient_profiles where patient_id = ${patientId}`);

    const g = canCreateEvaluation(
      filas.map((f) => f.consent_type as never),
      motivoDeRegularizacion(
        hechosDelConsentimiento({ fechaDeNacimiento: perfil.birth_date, consents: filas }),
      ),
    );
    expect(g.ok, "el gate volvio a frenar al menor sin representante").toBe(true);
  });
});
