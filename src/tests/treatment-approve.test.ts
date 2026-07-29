import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

// Integracion contra el Supabase local (T2 A3): el WRITER de aprobacion (writeApproveProtocol).
// Verifica el sello del set efectivo con LAS DOS VERSIONES en el audit, la inmutabilidad (no se
// re-aprueba) y la guarda de protocol_suggested nulo (no se aprueba lo que nunca se computo). Corre
// como owner (DATABASE_URL): la RLS no aplica, el trigger si. La autorizacion (rol + asignacion
// explicita) vive en el service/action y la policy; aqui se prueba la mecanica del sello.
// El chequeo de asignacion del service se cubre por lectura del codigo (getProfessionalProfileIdByUser
// === evaluation.professionalId); un test end-to-end del service necesita infra de sesion (diferido).

vi.mock("server-only", () => ({}));

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

let withSuggested: string;
let withoutSuggested: string;
let profileId: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let writeApproveProtocol: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TreatmentStateError: any;

const SUGGESTED = { protocolEngineVersion: "anibise-protocolo-1.0.0", pesoCalculo: 76.6 };
const APPROVED = { protocolEngineVersionApproved: "anibise-protocolo-1.0.0", calorico: { kcalObj: 2456 } };

beforeAll(async () => {
  const mod = await import("@/modules/treatment/data/treatment-writer");
  writeApproveProtocol = mod.writeApproveProtocol;
  TreatmentStateError = mod.TreatmentStateError;

  const [d] = await sql<{ id: string }[]>`SELECT id FROM diagnoses LIMIT 1`;
  const [p] = await sql<{ id: string }[]>`SELECT id FROM profiles LIMIT 1`;
  profileId = p.id;
  const [a] = await sql<{ id: string }[]>`
    INSERT INTO treatments (diagnosis_id, created_by, protocol_suggested)
    VALUES (${d.id}, ${p.id}, ${JSON.stringify(SUGGESTED)}::jsonb) RETURNING id`;
  withSuggested = a.id;
  const [b] = await sql<{ id: string }[]>`
    INSERT INTO treatments (diagnosis_id, created_by) VALUES (${d.id}, ${p.id}) RETURNING id`;
  withoutSuggested = b.id;
});

afterAll(async () => {
  // Los tratamientos quedan approved (inmutables); se limpian por el bypass documentado (replica).
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM treatments WHERE id IN (${withSuggested}, ${withoutSuggested})`;
  });
  await sql.end();
});

describe("writeApproveProtocol (sello de la prescripcion efectiva)", () => {
  it("sella protocol_approved + kcal/proteina + status approved, y audita las DOS versiones", async () => {
    await writeApproveProtocol({
      treatmentId: withSuggested,
      protocolApproved: APPROVED,
      kcalObjetivo: 2456,
      proteinaGramos: 61,
      approvedAt: new Date("2026-07-29T12:00:00Z"),
      versionApproved: "anibise-protocolo-1.1.0", // simula que el motor subio entre diagnostico y aprobacion
      versionSuggested: "anibise-protocolo-1.0.0",
      actorId: profileId,
      actorEmail: "pro@cnv",
      ip: null,
    });

    const [row] = await sql<{ status: string; kcal: number; prot: number; approved_by: string }[]>`
      SELECT status, kcal_objetivo AS kcal, proteina_g AS prot, approved_by FROM treatments WHERE id = ${withSuggested}`;
    expect(row.status).toBe("approved");
    expect(row.kcal).toBe(2456);
    expect(row.prot).toBe(61);
    expect(row.approved_by).toBe(profileId);

    const [audit] = await sql<{ payload: Record<string, unknown> }[]>`
      SELECT payload FROM clinical_audit_log
      WHERE event = 'protocol.approved' AND entity_id = ${withSuggested} ORDER BY created_at DESC LIMIT 1`;
    expect(audit.payload.version_approved).toBe("anibise-protocolo-1.1.0");
    expect(audit.payload.version_suggested).toBe("anibise-protocolo-1.0.0");
    expect(audit.payload.version_mismatch).toBe(true);
  });

  it("no re-aprueba un protocolo ya aprobado (inmutabilidad)", async () => {
    await expect(
      writeApproveProtocol({
        treatmentId: withSuggested,
        protocolApproved: APPROVED,
        kcalObjetivo: 2456,
        proteinaGramos: 61,
        approvedAt: new Date("2026-07-29T13:00:00Z"),
        versionApproved: "anibise-protocolo-1.0.0",
        versionSuggested: "anibise-protocolo-1.0.0",
        actorId: profileId,
        actorEmail: "pro@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(TreatmentStateError);
  });

  it("no aprueba un tratamiento con protocol_suggested nulo", async () => {
    await expect(
      writeApproveProtocol({
        treatmentId: withoutSuggested,
        protocolApproved: APPROVED,
        kcalObjetivo: 2000,
        proteinaGramos: 60,
        approvedAt: new Date("2026-07-29T12:00:00Z"),
        versionApproved: "anibise-protocolo-1.0.0",
        versionSuggested: "anibise-protocolo-1.0.0",
        actorId: profileId,
        actorEmail: "pro@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(TreatmentStateError);
  });
});
