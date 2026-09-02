import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { computeProtocoloEfectivo, type ProtocoloSnapshot } from "@/clinical-engine/protocolo";

// EL SNAPSHOT DE LA FORMA VIEJA, POR EL CAMINO REAL (reader + WRITER), contra la base de verdad.
//
// POR QUE CONTRA BD Y NO EN PURO: la tolerancia de lectura ya la cubre `proteina-la-prescribe-el-motor`
// con sus tres fuentes. Lo que ESO no puede ver es lo que nos costo un 500 el 2026-08-28: al cambiar la
// forma de un jsonb, el que revienta no es solo el lector, es el WRITER, que vuelve a leer la columna
// CRUDA para recomputar la firma antes de guardar. Aquel caso paso tsc, lint y 890 tests, y guardar daba
// 500. Asi que aqui se SIEMBRA la forma anterior al 2026-09-03 (sin `mtn`) y se corre el guardado y el
// sellado de verdad, no una simulacion.
//
// LOS 60 TRATAMIENTOS QUE HAY EN LA BASE SON DE ESTA FORMA, y no se pueden rellenar: `protocol_suggested`
// es write-once incluso en borrador (trigger 0026). Por eso la forma vieja no es un caso historico, es el
// caso de hoy.

vi.mock("server-only", () => ({}));

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

// Sellado con la forma ANTERIOR: trae `protMin` y NO trae `mtn`. Es lo que hay en la base hoy.
const VIEJO = {
  protocolEngineVersion: "anibise-protocolo-2026-08-19",
  pesoCalculo: 80,
  protMin: 0.8,
  estrategia: { tipo: "", deficit: 0, label: "", color: "", ref: "", perfil: "" },
  caloricoInputs: { ffm: 60, talla: 175, edad: 40, sexoM: true },
  calorico: { protGKg: 0.8, protG: 64, kcalObj: 2000 },
} as unknown as ProtocoloSnapshot;

let viejoId: string;
let profileId: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let writeApproveProtocol: any;

beforeAll(async () => {
  const mod = await import("@/modules/treatment/data/treatment-writer");
  writeApproveProtocol = mod.writeApproveProtocol;

  const [d] = await sql<{ id: string }[]>`SELECT id FROM diagnoses LIMIT 1`;
  const [p] = await sql<{ id: string }[]>`SELECT id FROM profiles LIMIT 1`;
  profileId = p.id;
  const [t] = await sql<{ id: string }[]>`
    INSERT INTO treatments (diagnosis_id, created_by, protocol_suggested)
    VALUES (${d.id}, ${p.id}, ${sql.json(VIEJO as never)}) RETURNING id`;
  viejoId = t.id;
});

afterAll(async () => {
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM treatments WHERE id = ${viejoId}`;
  });
  await sql.end();
});

describe("un snapshot de la forma VIEJA se lee y se SELLA con la proteína del motor", () => {
  const SIN_AJUSTES = {
    geb: null, pal: null, kcalObj: null, protGkg: null, fatPct: null, deficit: null, pesoMeta: null,
  };

  it("la fila sembrada NO trae `mtn`: es de verdad la forma anterior", () => {
    // CONTROL de la siembra. Sin esto, el test podria estar probando la forma nueva y pasaria verde
    // afirmando una tolerancia que nunca se ejercito.
    expect("mtn" in (VIEJO as unknown as Record<string, unknown>)).toBe(false);
    expect(VIEJO.protMin).toBe(0.8);
  });

  it("se lee sin reventar, y con el motor a mano prescribe SU cifra, no el mínimo", async () => {
    const leido = await sql<{ ps: ProtocoloSnapshot }[]>`
      SELECT protocol_suggested AS ps FROM treatments WHERE id = ${viejoId}`;
    const snap = leido[0].ps;
    // El jsonb vuelve CRUDO de la base, que es la forma en que llega al writer. Si la tolerancia fuera
    // solo del lector tipado, esto es lo que la saltaria.
    expect((snap as unknown as Record<string, unknown>).mtn).toBeUndefined();

    const ef = computeProtocoloEfectivo(snap, SIN_AJUSTES, { protKgVigente: 1.3 });
    expect(ef.protFuente).toBe("motor");
    expect(ef.calorico.protGKg).toBe(1.3);
    expect(ef.calorico.protG).toBe(104); // round(1.3 * 80)
  });

  it("y sin motor a mano cae al mínimo poblacional, DECLARÁNDOLO (no en silencio)", async () => {
    const leido = await sql<{ ps: ProtocoloSnapshot }[]>`
      SELECT protocol_suggested AS ps FROM treatments WHERE id = ${viejoId}`;
    const ef = computeProtocoloEfectivo(leido[0].ps, SIN_AJUSTES);
    expect(ef.protFuente).toBe("protMin");
    expect(ef.calorico.protGKg).toBe(0.8);
  });

  it("EL WRITER corre sobre la forma vieja y sella la proteína del motor", async () => {
    // ESTE es el caso que el 500 nos enseño a escribir: no basta con que el lector tolere, tiene que
    // GUARDAR. Se sella lo que la cadena efectiva resolvio, que es lo que el profesional tenia delante.
    const leido = await sql<{ ps: ProtocoloSnapshot }[]>`
      SELECT protocol_suggested AS ps FROM treatments WHERE id = ${viejoId}`;
    const ef = computeProtocoloEfectivo(leido[0].ps, SIN_AJUSTES, { protKgVigente: 1.3 });

    await writeApproveProtocol({
      treatmentId: viejoId,
      protocolApproved: { calorico: ef.calorico, protFuente: ef.protFuente },
      kcalObjetivo: Math.round(ef.calorico.kcalObj),
      proteinaGramos: Math.round(ef.calorico.protG),
      approvedAt: new Date("2026-09-03T12:00:00Z"),
      versionApproved: "anibise-protocolo-2026-09-03",
      versionSuggested: leido[0].ps.protocolEngineVersion,
      actorId: profileId,
      actorEmail: "pro@cnv",
      ip: null,
    });

    const [row] = await sql<{ status: string; prot: number; pa: Record<string, unknown> }[]>`
      SELECT status, proteina_g AS prot, protocol_approved AS pa FROM treatments WHERE id = ${viejoId}`;
    expect(row.status).toBe("approved");
    // 104 g, no 64: lo sellado es la prescripcion del motor, no el minimo poblacional.
    expect(row.prot).toBe(104);
    expect(row.pa.protFuente).toBe("motor");
  });
});
