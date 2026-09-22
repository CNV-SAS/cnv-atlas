import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

// ═══ EL CONSENTIMIENTO DE ORIGEN HTML CONTRA LA BASE REAL (0159) ═══
// Lo que tsc no ve: los CHECK, la unicidad por consulta y que el registro no se pueda modificar.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const HASH = "6a4648033dd72d9c6a5a64025ceaa2bb16c30cf548a487672159465e9a53dbfa";
const creados: { lote?: string; paciente?: string } = {};

describe.skipIf(!HAS_DB)("consentimiento de origen HTML (BD real)", () => {
  afterAll(async () => {
    const { db } = await import("@/db");
    if (creados.paciente) await db.execute(dsql`delete from patients where id = ${creados.paciente}`);
    if (creados.lote) await db.execute(dsql`delete from html_import_batches where id = ${creados.lote}`);
  });

  it("se guarda, uno por consulta, y no se modifica", async () => {
    const { db } = await import("@/db");
    const [pp] = await db.execute<{ id: string; profile_id: string; organization_id: string }>(
      dsql`select pp.id, pp.profile_id, p.organization_id from professional_profiles pp
             join profiles p on p.id = pp.profile_id limit 1`,
    );
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    creados.paciente = randomUUID();
    await db.execute(dsql`
      insert into patients (id, organization_id, document_type, document_number, is_test)
      values (${creados.paciente}, ${org.id}, 'CC', ${`HTML-CONS-${Date.now()}`}, true)`);
    creados.lote = randomUUID();
    await db.execute(dsql`
      insert into html_import_batches (id, professional_id, imported_by, source_file_name, source_file_hash,
                                       declaration_version, declared_at)
      values (${creados.lote}, ${pp.id}, ${pp.profile_id}, 'export.json', ${HASH}, '1.0', now())`);

    const insertar = (fecha: string) =>
      db.execute(dsql`
        insert into patient_external_consents (patient_id, batch_id, origin, text_version, document_hash,
                                               typed_name, recorded_date, source_consultation_date, signature_method)
        values (${creados.paciente}, ${creados.lote}, 'html', 'Encuesta CNV v3.0', ${HASH},
                'Paciente de prueba', '02 de agosto de 2026', ${fecha}, 'nombre_tecleado_sin_codigo')
        returning id`);

    const [fila] = await insertar("2026-08-02");
    expect(fila).toBeTruthy();
    // Una segunda consulta del mismo paciente, si.
    await expect(insertar("2026-09-02")).resolves.toBeTruthy();
    // La misma consulta dos veces, no.
    await expect(insertar("2026-08-02")).rejects.toThrow();
    // Y no se modifica. Drizzle envuelve el error ("Failed query"): el mensaje del trigger va en la causa.
    const error = await db
      .execute(dsql`update patient_external_consents set typed_name = 'otro' where patient_id = ${creados.paciente}`)
      .then(() => null, (e: unknown) => e as { message: string; cause?: { message?: string } });
    expect(error, "la actualizacion paso").not.toBeNull();
    expect(error?.cause?.message ?? error?.message).toContain("no se modifica");
  });
});
