import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ MARCAR UN PACIENTE DE PRUEBA, CONTRA LA BASE (0180, 2026-09-25) ═══
//
// TRES COSAS, Y LA TERCERA ES LA QUE CONTESTA LA PREGUNTA (c) DE SANTIAGO:
//
//   1 · que el profesional PROPONGA no saque al paciente de las cifras (solo admin, al confirmar);
//   2 · que la base exija el MOTIVO, y no a medias (media propuesta obliga a adivinar a quien confirma);
//   3 · y QUE MARCAR NO DESHAGA NADA DE LO QUE YA PASO: sus ventas, sus movimientos de inventario y su
//       factura siguen ahi. Es por eso que marcar es seguro y borrar no lo seria: marcar no toca la
//       contabilidad, solo deja de contarlo hacia adelante.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let patientId = "";
let actorId = "";
let previo: { is_test: boolean } | null = null;

describe.skipIf(!HAS_DB)("la marca de paciente de prueba (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [pac] = await db.execute<{ id: string; is_test: boolean }>(dsql`
      select id, is_test from patients where deleted_at is null order by created_at limit 1`);
    patientId = pac.id;
    previo = { is_test: pac.is_test };
    const [prof] = await db.execute<{ id: string }>(dsql`select id from profiles order by created_at limit 1`);
    actorId = prof.id;
    // Se parte de limpio.
    await db.execute(dsql`
      update patients set is_test = false, test_proposed_at = null, test_proposed_by = null,
                          test_proposed_reason = null, test_marked_at = null, test_marked_by = null
       where id = ${patientId}::uuid`);
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB || !previo) return;
    const { db } = await import("@/db");
    await db.execute(dsql`
      update patients set is_test = ${previo.is_test}, test_proposed_at = null, test_proposed_by = null,
                          test_proposed_reason = null, test_marked_at = null, test_marked_by = null
       where id = ${patientId}::uuid`);
  }, 30_000);

  it("la propuesta NO saca al paciente de las cifras: eso lo hace admin al confirmar", async () => {
    const { db } = await import("@/db");
    const { proponerPacienteDePrueba } = await import("@/modules/patients/data/de-prueba-writer");
    await proponerPacienteDePrueba({
      patientId,
      motivo: "Es mi propia cuenta, la usé para probar el flujo",
      actorId,
      actorEmail: "profesional@cnv",
      ip: null,
    });
    const [p] = await db.execute<{ is_test: boolean; propuesto: string | null }>(dsql`
      select is_test, test_proposed_at::text as propuesto from patients where id = ${patientId}::uuid`);
    // ES LA ASIMETRIA ENTERA: si esto fuera true, un profesional podria esconder de las cifras a un paciente
    // real (uno que no le cuadra, uno que no quiere que se vea en su conteo) sin que nadie lo revise.
    expect(p.is_test).toBe(false);
    expect(p.propuesto).not.toBeNull();
  }, 30_000);

  it("un motivo demasiado corto se rechaza con palabras, no con un error de restricción", async () => {
    const { proponerPacienteDePrueba, MarcaDePruebaError } = await import(
      "@/modules/patients/data/de-prueba-writer"
    );
    await expect(
      proponerPacienteDePrueba({ patientId, motivo: "ok", actorId, actorEmail: "x@cnv", ip: null }),
    ).rejects.toThrow(MarcaDePruebaError);
  }, 30_000);

  it("la BASE tampoco admite media propuesta", async () => {
    const { db } = await import("@/db");
    // Fecha sin motivo obligaria a quien confirma a adivinar. Es el caso que aparece si alguien agrega la
    // columna al formulario y olvida el campo.
    await expect(
      db.execute(dsql`
        update patients set test_proposed_at = now(), test_proposed_by = ${actorId}::uuid,
                            test_proposed_reason = null
         where id = ${patientId}::uuid`),
    ).rejects.toThrow();
  }, 30_000);

  it("al confirmar queda el rastro de QUIEN lo marcó, no solo el booleano", async () => {
    const { db } = await import("@/db");
    const { resolverPropuestaDePrueba } = await import("@/modules/patients/data/de-prueba-writer");
    await resolverPropuestaDePrueba({
      patientId,
      confirmar: true,
      actorId,
      actorEmail: "admin@cnv",
      ip: null,
    });
    const [p] = await db.execute<{ is_test: boolean; marcado: string | null; por: string | null }>(dsql`
      select is_test, test_marked_at::text as marcado, test_marked_by::text as por
        from patients where id = ${patientId}::uuid`);
    expect(p.is_test).toBe(true);
    // Sin estas dos, un paciente marcado no se distingue de uno que nació de prueba (los importados, las
    // semillas), y entonces no se puede revisar la decisión.
    expect(p.marcado).not.toBeNull();
    expect(p.por).toBe(actorId);
  }, 30_000);

  it("MARCAR NO DESHACE NADA: sus ventas y su factura siguen ahí", async () => {
    // Es la respuesta a la pregunta (c) y la razón por la que marcar es seguro y borrar no lo sería. Borrar al
    // paciente dejaría una factura sin paciente (`patient_id` es ON DELETE set null), o sea una cifra de
    // ingreso que ya no se puede explicar; y los movimientos de inventario son append-only e inmutables, así
    // que tampoco se desharían.
    const { db } = await import("@/db");
    const [antes] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from transactions where patient_id = ${patientId}::uuid`);
    const { desmarcarPacienteDePrueba } = await import("@/modules/patients/data/de-prueba-writer");
    await desmarcarPacienteDePrueba({ patientId, actorId, actorEmail: "admin@cnv", ip: null });
    const [despues] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from transactions where patient_id = ${patientId}::uuid`);
    expect(Number(despues.n)).toBe(Number(antes.n));
  }, 30_000);

  it("desmarcar deja la fila sin estado imposible", async () => {
    const { db } = await import("@/db");
    const [p] = await db.execute<{ is_test: boolean; marcado: string | null; propuesto: string | null }>(dsql`
      select is_test, test_marked_at::text as marcado, test_proposed_at::text as propuesto
        from patients where id = ${patientId}::uuid`);
    // Un `test_marked_at` con `is_test = false` seria un estado imposible: diria que alguien lo marco y que
    // no esta marcado.
    expect(p.is_test).toBe(false);
    expect(p.marcado).toBeNull();
    expect(p.propuesto).toBeNull();
  }, 30_000);

  it("los tres actos quedaron en el audit log", async () => {
    const { db } = await import("@/db");
    const filas = await db.execute<{ event: string }>(dsql`
      select event from clinical_audit_log
       where entity_id = ${patientId} and event like 'paciente.%de_prueba%'
       order by created_at asc`);
    const eventos = filas.map((f) => f.event);
    expect(eventos).toContain("paciente.propuesto_de_prueba");
    expect(eventos).toContain("paciente.marcado_de_prueba");
    expect(eventos).toContain("paciente.desmarcado_de_prueba");
  }, 30_000);
});
