import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

import {
  adjustmentSignature,
  intercambioSignature,
  menuSemanalSignature,
  objetivoSignature,
  restriccionesSignature,
  tiemposActivosSignature,
  tiemposSignature,
} from "@/modules/treatment/data/protocol-signature";

// UN SOLO GUARDADO PARA TODO EL PROTOCOLO, contra base real (Santiago, 2026-09-09).
//
// POR QUE ESTE TEST VA CONTRA BASE Y NO CON MOCKS: lo que hay que probar es el TODO-O-NADA, y eso es una
// propiedad de la transaccion, no del codigo. Con mocks se probaria que se llama a las funciones en orden,
// que es justo lo que no importa.
//
// LO QUE SE VERIFICA, y sale de las tres preguntas que Santiago hizo antes de aprobar esto:
//   (a) SI EL GUARDADO FALLA -> no queda nada guardado. Encadenar los siete writers habria dejado cuatro
//       secciones escritas y tres no, y el profesional sin saber cuales: peor que los siete botones.
//   (b) EL CANDADO DE CONCURRENCIA -> las SIETE firmas se validan ANTES de escribir ninguna, y el rechazo
//       nombra cual cambio. Es mas estricto que antes (hoy se pueden guardar seis bloques aunque el
//       septimo este desfasado) y eso es correcto: si otro toco el tratamiento, no quieres guardar la
//       mitad de tu version sobre la suya.
//   (c) SOLO SE ESCRIBE Y SE AUDITA LO QUE CAMBIO. Un evento por seccion ENVIADA diria que se cambiaron
//       las restricciones cada vez que alguien mueve el PAL, y el log se lee para contestar quien cambio
//       que.

vi.mock("server-only", () => ({}));

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

let treatmentId: string;
let evaluationId: string;
let profileId: string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let guardarProtocolo: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StaleProtocoloError: any;

/** Las siete firmas de un protocolo recien creado: todo vacio menos lo que se sembro. */
function firmasDe(t: string, extra: Partial<Record<string, unknown>> = {}) {
  return {
    ajustes: adjustmentSignature({
      treatmentId: t,
      adjGeb: null,
      adjPal: null,
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
      adjDeficit: null,
      pesoMetaFijado: null,
      ...extra,
    }),
    objetivo: objetivoSignature({ treatmentId: t, objetivo: (extra.objetivo as string) ?? null }),
    restricciones: restriccionesSignature({
      treatmentId: t,
      restricciones: (extra.restricciones as string[]) ?? [],
    }),
    intercambio: intercambioSignature({ treatmentId: t, intercambio: null }),
    tiemposActivos: tiemposActivosSignature({
      treatmentId: t,
      activos: (extra.activos as Record<string, boolean>) ?? null,
    }),
    tiempos: tiemposSignature({ treatmentId: t, tiempos: null }),
    menuSemanal: menuSemanalSignature({ treatmentId: t, menu: null }),
  };
}

const AJUSTES_VACIOS = {
  adjGeb: null,
  adjPal: null,
  adjKcalObj: null,
  adjProtGkg: null,
  adjFatPct: null,
  adjDeficit: null,
  pesoMetaFijado: null,
};

const EDITABLE_VACIO = {
  ajustes: AJUSTES_VACIOS,
  objetivo: null,
  restricciones: [],
  intercambio: null,
  tiemposActivos: null,
  tiempos: null,
  menuSemanal: null,
};

const ACTOR = () => ({ actorId: profileId, actorEmail: "pro@cnv", ip: null });

beforeAll(async () => {
  const mod = await import("@/modules/treatment/data/protocolo-writer");
  guardarProtocolo = mod.guardarProtocolo;
  StaleProtocoloError = mod.StaleProtocoloError;

  const [d] = await sql<{ id: string; evaluation_id: string }[]>`
    SELECT id, evaluation_id FROM diagnoses LIMIT 1`;
  const [p] = await sql<{ id: string }[]>`SELECT id FROM profiles LIMIT 1`;
  profileId = p.id;
  evaluationId = d.evaluation_id;
  const [t] = await sql<{ id: string }[]>`
    INSERT INTO treatments (diagnosis_id, created_by) VALUES (${d.id}, ${p.id}) RETURNING id`;
  treatmentId = t.id;
  // El peso meta vive en la evaluacion: se limpia para partir de un estado conocido.
  await sql`UPDATE evaluations SET weight_goal_kg = NULL, weight_goal_set_in = NULL WHERE id = ${evaluationId}`;
});

afterAll(async () => {
  await sql`DELETE FROM treatments WHERE id = ${treatmentId}`;
  await sql.end();
});

describe("guardarProtocolo: una transaccion, siete secciones", () => {
  it("guarda VARIAS secciones a la vez y devuelve cuales", async () => {
    const r = await guardarProtocolo({
      treatmentId,
      editable: {
        ...EDITABLE_VACIO,
        ajustes: { ...AJUSTES_VACIOS, adjPal: 1.55, adjKcalObj: 2100 },
        objetivo: "Bajar 4 kg en tres meses.",
        restricciones: ["sin gluten", "sin lactosa"],
      },
      firmas: firmasDe(treatmentId),
      ...ACTOR(),
    });
    expect(new Set(r.guardadas)).toEqual(new Set(["ajustes", "objetivo", "restricciones"]));

    const [row] = await sql<{ pal: string; kcal: number; obj: string; restr: string[] }[]>`
      SELECT adj_pal AS pal, adj_kcal_obj AS kcal, objetivo_texto AS obj, restricciones AS restr
      FROM treatments WHERE id = ${treatmentId}`;
    expect(Number(row.pal)).toBe(1.55);
    expect(row.kcal).toBe(2100);
    expect(row.obj).toBe("Bajar 4 kg en tres meses.");
    expect(row.restr).toEqual(["sin gluten", "sin lactosa"]);
  });

  it("audita UNA VEZ POR SECCION QUE CAMBIO, no por seccion enviada", async () => {
    // (c). Se enviaron las siete y solo cambiaron tres: si el audit llevara una por envio, el log diria
    // que se cambio el menu semanal de un tratamiento que no tiene menu.
    const eventos = await sql<{ event: string }[]>`
      SELECT event FROM clinical_audit_log WHERE entity_id = ${treatmentId} ORDER BY created_at`;
    const nombres = eventos.map((e) => e.event);
    expect(nombres).toContain("treatment.adjustments_updated");
    expect(nombres).toContain("treatment.objetivo_updated");
    expect(nombres).toContain("treatment.restricciones_updated");
    expect(nombres, "se audito una seccion que no cambio").not.toContain(
      "treatment.menu_semanal_updated",
    );
    expect(nombres).not.toContain("treatment.tiempos_updated");
  });

  it("un guardado SIN cambios no escribe ni audita nada", async () => {
    const antes = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM clinical_audit_log WHERE entity_id = ${treatmentId}`;
    const r = await guardarProtocolo({
      treatmentId,
      editable: {
        ...EDITABLE_VACIO,
        ajustes: { ...AJUSTES_VACIOS, adjPal: 1.55, adjKcalObj: 2100 },
        objetivo: "Bajar 4 kg en tres meses.",
        restricciones: ["sin gluten", "sin lactosa"],
      },
      firmas: firmasDe(treatmentId, {
        adjPal: 1.55,
        adjKcalObj: 2100,
        objetivo: "Bajar 4 kg en tres meses.",
        restricciones: ["sin gluten", "sin lactosa"],
      }),
      ...ACTOR(),
    });
    expect(r.guardadas).toEqual([]);
    const despues = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM clinical_audit_log WHERE entity_id = ${treatmentId}`;
    expect(despues[0].n).toBe(antes[0].n);
  });
});

describe("el candado de concurrencia: las SIETE firmas, antes de escribir ninguna", () => {
  it("si UNA seccion esta desfasada, NO se guarda NINGUNA", async () => {
    // (a) y (b) en el mismo caso, que es como ocurren: el profesional manda el conjunto, otro habia
    // tocado una seccion, y lo que se comprueba es que no quedo la mitad escrita.
    const firmas = firmasDe(treatmentId, {
      adjPal: 1.55,
      adjKcalObj: 2100,
      objetivo: "Bajar 4 kg en tres meses.",
      restricciones: ["sin gluten", "sin lactosa"],
    });

    await expect(
      guardarProtocolo({
        treatmentId,
        editable: {
          ...EDITABLE_VACIO,
          // Estas DOS si se habrian escrito si el writer validara y escribiera seccion por seccion.
          ajustes: { ...AJUSTES_VACIOS, adjPal: 1.7, adjKcalObj: 2200 },
          objetivo: "Objetivo nuevo que no debe quedar.",
          restricciones: ["sin gluten", "sin lactosa"],
          // Y esta es la desfasada: la firma dice "nunca se guardo" y en la base tampoco hay nada, asi
          // que se fuerza el desfase mandando una firma que no corresponde.
          tiemposActivos: { desayuno: true, almuerzo: true },
        },
        firmas: { ...firmas, tiemposActivos: "firma-de-otra-sesion" },
        ...ACTOR(),
      }),
    ).rejects.toBeInstanceOf(StaleProtocoloError);

    // LO QUE IMPORTA: nada de lo demas quedo escrito.
    const [row] = await sql<{ pal: string; kcal: number; obj: string }[]>`
      SELECT adj_pal AS pal, adj_kcal_obj AS kcal, objetivo_texto AS obj FROM treatments
      WHERE id = ${treatmentId}`;
    expect(Number(row.pal), "se guardo una seccion pese al rechazo del conjunto").toBe(1.55);
    expect(row.kcal).toBe(2100);
    expect(row.obj).toBe("Bajar 4 kg en tres meses.");
  });

  it("y el rechazo NOMBRA la seccion, en el idioma de la pantalla", async () => {
    // "Recarga" sin decir QUE cambio obliga a comparar la pantalla entera contra lo que uno recuerda.
    const firmas = firmasDe(treatmentId, {
      adjPal: 1.55,
      adjKcalObj: 2100,
      objetivo: "Bajar 4 kg en tres meses.",
      restricciones: ["sin gluten", "sin lactosa"],
    });
    await expect(
      guardarProtocolo({
        treatmentId,
        editable: { ...EDITABLE_VACIO, restricciones: ["otra cosa"] },
        firmas: { ...firmas, restricciones: "firma-de-otra-sesion" },
        ...ACTOR(),
      }),
    ).rejects.toThrow(/las restricciones/);
  });

  it("recoge TODAS las desfasadas, no solo la primera", async () => {
    // Un aviso que nombra una sola obliga a reintentar para descubrir la siguiente, que es la forma de
    // convertir un rechazo en tres.
    const firmas = firmasDe(treatmentId);
    try {
      await guardarProtocolo({
        treatmentId,
        editable: EDITABLE_VACIO,
        firmas: { ...firmas, restricciones: "x", menuSemanal: "y" },
        ...ACTOR(),
      });
      throw new Error("deberia haber rechazado");
    } catch (e) {
      expect(e).toBeInstanceOf(StaleProtocoloError);
      expect((e as { secciones: string[] }).secciones.length).toBeGreaterThanOrEqual(2);
    }
  });
});
