import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

// Integracion contra el Supabase local: el WRITER de la emision (`writeEmisionPrescripcion`).
//
// SUCEDE A `treatment-approve.test.ts`, que probaba `writeApproveProtocol`. Aquel writer sellaba Y
// CERRABA (ponia `status='approved'` y desde ahi el trigger congelaba la prescripcion). Este solo escribe
// la copia de lo que salio, y lo que hay que probar cambia con el:
//
//   · Que la copia se GUARDE con su via, su autor y su cadena efectiva.
//   · Que NO toque el estado del tratamiento, que es la mitad que Santiago pidio quitar.
//   · Que se pueda emitir VARIAS veces, porque cada salida es un hecho distinto (se imprime, se corrige,
//     se vuelve a imprimir). Un gate de "ya emitida" seria el candado con otro nombre.
//   · Que no se emita lo que nunca se computo.
//   · Y que el audit quede INLINE en la transaccion (regla dura 8).
//
// Corre como owner (DATABASE_URL): la RLS no aplica, el trigger si. La autorizacion (rol + asignacion
// explicita + profesion) vive en el service y la policy; aqui se prueba la mecanica del registro.

vi.mock("server-only", () => ({}));

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

let conSugerido: string;
let sinSugerido: string;
let profileId: string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let writeEmisionPrescripcion: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TreatmentStateError: any;

const SUGERIDO = { protocolEngineVersion: "anibise-protocolo-1.0.0", pesoCalculo: 76.6 };
const PRESCRIPCION = {
  protocolEngineVersionApproved: "anibise-protocolo-1.0.0",
  calorico: { kcalObj: 2456 },
  ajustes: { geb: null, pal: 1.4, kcalObj: null, protGkg: null, fatPct: null, deficit: null, pesoMeta: 70 },
};

beforeAll(async () => {
  writeEmisionPrescripcion = (await import("@/modules/treatment/data/emisiones-writer"))
    .writeEmisionPrescripcion;
  TreatmentStateError = (await import("@/modules/treatment/data/treatment-writer")).TreatmentStateError;

  const [d] = await sql<{ id: string }[]>`SELECT id FROM diagnoses LIMIT 1`;
  const [p] = await sql<{ id: string }[]>`SELECT id FROM profiles LIMIT 1`;
  profileId = p.id;
  const [a] = await sql<{ id: string }[]>`
    INSERT INTO treatments (diagnosis_id, created_by, protocol_suggested)
    VALUES (${d.id}, ${p.id}, ${JSON.stringify(SUGERIDO)}::jsonb) RETURNING id`;
  conSugerido = a.id;
  const [b] = await sql<{ id: string }[]>`
    INSERT INTO treatments (diagnosis_id, created_by) VALUES (${d.id}, ${p.id}) RETURNING id`;
  sinSugerido = b.id;
});

afterAll(async () => {
  // Las emisiones son append-only por trigger y el tratamiento con emisiones no se borra: se limpia por
  // la via de bypass documentada (session_replication_role = replica). Solo en pruebas/dev.
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM prescription_emissions WHERE treatment_id IN (${conSugerido}, ${sinSugerido})`;
    await tx`DELETE FROM treatments WHERE id IN (${conSugerido}, ${sinSugerido})`;
  });
  await sql.end();
});

describe("writeEmisionPrescripcion (la copia de lo que salio)", () => {
  it("guarda la prescripcion, la cadena efectiva, la via y el autor, y audita inline", async () => {
    const { emisionId } = await writeEmisionPrescripcion({
      treatmentId: conSugerido,
      prescripcion: PRESCRIPCION,
      kcalObjetivo: 2456,
      proteinaGramos: 61,
      via: "impresa",
      actorId: profileId,
      actorEmail: "pro@cnv",
      ip: null,
    });

    const [row] = await sql<
      {
        via: string;
        kcal: number;
        prot: number;
        emitted_by: string;
        evaluation_id: string;
        prescripcion: Record<string, unknown>;
      }[]
    >`SELECT via, kcal_objetivo AS kcal, proteina_g AS prot, emitted_by, evaluation_id, prescripcion
      FROM prescription_emissions WHERE id = ${emisionId}`;
    expect(row.via).toBe("impresa");
    expect(row.kcal).toBe(2456);
    expect(row.prot).toBe(61);
    expect(row.emitted_by).toBe(profileId);
    // LA EVALUACION SE RESUELVE DENTRO DE LA TRANSACCION, no se recibe: un id de fuera podria colgar la
    // emision de una consulta ajena. Aqui se comprueba que sale del propio tratamiento.
    const [t] = await sql<{ evaluation_id: string }[]>`
      SELECT d.evaluation_id FROM treatments t JOIN diagnoses d ON d.id = t.diagnosis_id
      WHERE t.id = ${conSugerido}`;
    expect(row.evaluation_id).toBe(t.evaluation_id);
    // LA COPIA ES UNA COPIA: los ajustes viajan dentro, que es lo que hace reproducible el documento.
    expect((row.prescripcion as { ajustes?: { pesoMeta?: number } }).ajustes?.pesoMeta).toBe(70);

    const [audit] = await sql<{ payload: Record<string, unknown> }[]>`
      SELECT payload FROM clinical_audit_log
      WHERE event = 'prescription.emitted' AND entity_id = ${conSugerido}
      ORDER BY created_at DESC LIMIT 1`;
    expect(audit.payload.via).toBe("impresa");
    expect(audit.payload.kcal_objetivo).toBe(2456);
  });

  it("NO toca el estado del tratamiento: emitir no cierra nada", async () => {
    // EL CORAZON DE LA SEPARACION, comprobado contra la base y no leyendo el codigo. Si algun dia vuelve
    // el `status = 'approved'`, vuelve el bloqueo y con el la reapertura con motivo.
    const [row] = await sql<{ status: string }[]>`
      SELECT status FROM treatments WHERE id = ${conSugerido}`;
    expect(row.status).toBe("draft");
    // Y se puede seguir editando despues de haber entregado, que es la peticion.
    await sql`UPDATE treatments SET adj_pal = 1.6 WHERE id = ${conSugerido}`;
  });

  it("se puede emitir VARIAS veces: cada salida es un hecho distinto", async () => {
    await writeEmisionPrescripcion({
      treatmentId: conSugerido,
      prescripcion: PRESCRIPCION,
      kcalObjetivo: 2500,
      proteinaGramos: 62,
      via: "correo",
      actorId: profileId,
      actorEmail: "pro@cnv",
      ip: null,
    });
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM prescription_emissions WHERE treatment_id = ${conSugerido}`;
    expect(n, "un gate de 'ya emitida' seria el candado con otro nombre").toBe(2);
  });

  it("no emite una prescripcion que nunca se computo", async () => {
    // El gate vive DENTRO de la transaccion, no en la pantalla: un boton oculto no es un candado.
    await expect(
      writeEmisionPrescripcion({
        treatmentId: sinSugerido,
        prescripcion: PRESCRIPCION,
        kcalObjetivo: 2000,
        proteinaGramos: 60,
        via: "impresa",
        actorId: profileId,
        actorEmail: "pro@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(TreatmentStateError);
  });

  it("y si el writer falla, no queda ni la emision ni el audit (la transaccion revierte)", async () => {
    // CONTROL del audit inline (regla dura 8): si el audit fuera por el bus, el rechazo de arriba habria
    // dejado igualmente su rastro. Aqui se comprueba que no quedo nada del intento fallido.
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM clinical_audit_log
      WHERE event = 'prescription.emitted' AND entity_id = ${sinSugerido}`;
    expect(n).toBe(0);
  });
});
