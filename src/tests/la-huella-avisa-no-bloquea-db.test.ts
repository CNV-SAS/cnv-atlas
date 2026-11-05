import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { randomUUID } from "node:crypto";

import { VARIABLES_DE_LA_HUELLA } from "@/modules/bis/services/huella-de-la-medicion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL FRENO DE LA HUELLA AVISA, NO BLOQUEA  ·  2026-11-05
//
// ═══ EL CASO (Santiago) ═══
//
// *"No pude terminar el smoke porque mi archivo de pruebas coincide con un paciente del 13-jul, y el freno
// dice «No se importa». Y me va a pasar igual en el smoke comercial, que se hace con pacientes que cuentan
// como reales hasta que se marcan al final."*
//
// Un freno sin salida no es un guard: detiene a una persona. Y este detenia a quien tiene que PROBAR el
// sistema, que es el peor momento para detenerlo.
//
// ═══ LOS TRES DESENLACES QUE SE FIJAN AQUI ═══
//
//   1. Choque SOLO con un paciente DE PRUEBA -> entra sin preguntar nada, y el resultado trae el choque
//      para que la pantalla avise. Un paciente de prueba no tiene historia clinica que proteger.
//   2. Choque con un paciente REAL y SIN motivo -> no entra, y lo que se devuelve es una PETICION DE
//      CONFIRMACION, no un rechazo final.
//   3. Choque con un paciente REAL y CON motivo -> entra, y queda el rastro `bis.huella_repetida_confirmada`
//      con el motivo, inline en la misma transaccion del import.
//
// Y EL MOTIVO TIENE LARGO MINIMO: una confirmacion sin motivo es un boton de "da igual", y el registro
// quedaria con el acto y sin la razon, que es la mitad que sirve para revisarlo.
//
// ═══ POR QUE CONTRA LA BASE ═══
//
// Lo que decide el desenlace es una columna de otro paciente (`cuenta_como_de_prueba`) leida por un join
// dentro de la transaccion del import. Eso no se puede probar con dobles sin probar el doble.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local no hay base contra la que correr
}

let db: typeof import("@/db").db;
let esquema: typeof import("@/db/schema");
let escribir: typeof import("@/modules/bis/data/bis-writer").writeBisMeasurement;
let MedicionDuplicadaError: typeof import("@/modules/bis/data/bis-writer").MedicionDuplicadaError;
let MotivoDeLaHuellaFaltaError: typeof import("@/modules/bis/data/bis-writer").MotivoDeLaHuellaFaltaError;

// Los ids que crea la prueba, para borrarlos al final.
const creados: { pacientes: string[]; evaluaciones: string[] } = { pacientes: [], evaluaciones: [] };

beforeAll(async () => {
  ({ db } = await import("@/db"));
  esquema = await import("@/db/schema");
  ({ writeBisMeasurement: escribir, MedicionDuplicadaError, MotivoDeLaHuellaFaltaError } = await import(
    "@/modules/bis/data/bis-writer"
  ));
});

afterAll(async () => {
  if (!db) return;
  const { eq, inArray } = await import("drizzle-orm");
  if (creados.evaluaciones.length > 0) {
    await db.delete(esquema.evaluations).where(inArray(esquema.evaluations.id, creados.evaluaciones));
  }
  for (const id of creados.pacientes) {
    await db.delete(esquema.patients).where(eq(esquema.patients.id, id));
  }
});

/**
 * Los crudos de una medicion, con la Re que decide la huella.
 *
 * LOS NOMBRES SON LOS NORMALIZADOS que guarda `bis_raw_values`, y se toman de `VARIABLES_DE_LA_HUELLA`
 * en vez de escribirlos: escritos a mano, un nombre distinto dejaria la huella en null y el candado
 * pasaria verde porque no hay nada que comparar, que es la peor forma de pasar.
 */
function valores(re: number) {
  const [reN, riN, rinfN, cN] = VARIABLES_DE_LA_HUELLA;
  return [
    { variableName: reN, value: re },
    { variableName: riN, value: 500.1 },
    { variableName: rinfN, value: 400.2 },
    { variableName: cN, value: 1.234 },
  ];
}

async function sembrarPacienteConConsulta(dePrueba: boolean) {
  const [profesional] = await db
    .select({ id: esquema.professionalProfiles.id })
    .from(esquema.professionalProfiles)
    .limit(1);
  const [organizacion] = await db
    .select({ id: esquema.organizations.id })
    .from(esquema.organizations)
    .limit(1);
  const [paciente] = await db
    .insert(esquema.patients)
    .values({
      documentType: "CC",
      documentNumber: `HUELLA-${randomUUID().slice(0, 8)}`,
      // ═══ SE MARCA `isTest`, NO `cuentaComoDePrueba` ═══
      //
      // `cuenta_como_de_prueba` es DERIVADA: un trigger la recalcula en cada INSERT y UPDATE desde `is_test`
      // y desde los profesionales activos del paciente (0202). Escribirla a mano se pierde en el acto, sin
      // error, y el candado pasaria a probar lo contrario de lo que dice probar.
      isTest: dePrueba,
      organizationId: organizacion.id,
    })
    .returning({ id: esquema.patients.id });
  creados.pacientes.push(paciente.id);
  const [evaluacion] = await db
    .insert(esquema.evaluations)
    .values({
      patientId: paciente.id,
      professionalId: profesional?.id ?? null,
      organizationId: organizacion.id,
      type: "inicial",
      status: "in_progress",
    })
    .returning({ id: esquema.evaluations.id });
  creados.evaluaciones.push(evaluacion.id);
  return { patientId: paciente.id, evaluationId: evaluacion.id };
}

let actorId = "";

// EL ACTOR TIENE QUE EXISTIR: `clinical_audit_log.actor_id` es una FK a `profiles`. Un uuid inventado hace
// fallar el INSERT del rastro, no el del import, y el error apunta al sitio equivocado.
beforeAll(async () => {
  const [p] = await db.select({ id: esquema.profiles.id }).from(esquema.profiles).limit(1);
  actorId = p.id;
});

const comun = {
  deviceId: null,
  deviceCalibrationDate: null,
  measurementDate: new Date("2026-11-05T12:00:00Z"),
  derivedValues: [],
  derivedFormulaVersion: "test",
  actorEmail: "candado@cnvsystem.com",
  ip: null,
};

describe("el choque de huella segun con quien choca", () => {
  it("con un paciente DE PRUEBA entra sin pedir nada, y el choque viaja para poder avisar", async () => {
    const re = 90000 + Math.random() * 9000;
    const prueba = await sembrarPacienteConConsulta(true);
    const [, otra] = await Promise.all([null, sembrarPacienteConConsulta(false)]);

    // La toma original cuelga del paciente DE PRUEBA.
    await escribir({ ...comun, actorId, evaluationId: prueba.evaluationId, values: valores(re) });
    // Y ahora la misma toma se importa en la consulta de otro paciente: NO frena.
    const r = await escribir({ ...comun, actorId, evaluationId: otra.evaluationId, values: valores(re) });

    expect(r.measurementId).toBeTruthy();
    expect(r.choqueAceptado, "el choque tiene que viajar: un exito mudo esconde lo que el sistema sabe").not.toBeNull();
    expect(r.choqueAceptado?.esDePrueba).toBe(true);
  });

  it("con un paciente REAL y sin motivo, pide confirmacion (no es un rechazo final)", async () => {
    const re = 80000 + Math.random() * 9000;
    const real = await sembrarPacienteConConsulta(false);
    const otra = await sembrarPacienteConConsulta(false);

    await escribir({ ...comun, actorId, evaluationId: real.evaluationId, values: valores(re) });
    await expect(
      escribir({ ...comun, actorId, evaluationId: otra.evaluationId, values: valores(re) }),
    ).rejects.toThrow(MedicionDuplicadaError);
  });

  it("y el motivo demasiado corto no vale: una confirmacion sin razon es un boton de da igual", async () => {
    const re = 70000 + Math.random() * 9000;
    const real = await sembrarPacienteConConsulta(false);
    const otra = await sembrarPacienteConConsulta(false);

    await escribir({ ...comun, actorId, evaluationId: real.evaluationId, values: valores(re) });
    await expect(
      escribir({
        ...comun,
        actorId,
        evaluationId: otra.evaluationId,
        values: valores(re),
        motivoDeLaHuella: "ok",
      }),
    ).rejects.toThrow(MotivoDeLaHuellaFaltaError);
  });

  it("con motivo entra, y queda el rastro con su razon", async () => {
    const { and, eq } = await import("drizzle-orm");
    const re = 60000 + Math.random() * 9000;
    const real = await sembrarPacienteConConsulta(false);
    const otra = await sembrarPacienteConConsulta(false);
    const motivo = "La toma es de este paciente; la otra consulta quedo con el archivo equivocado.";

    await escribir({ ...comun, actorId, evaluationId: real.evaluationId, values: valores(re) });
    const r = await escribir({
      ...comun,
      actorId,
      evaluationId: otra.evaluationId,
      values: valores(re),
      motivoDeLaHuella: motivo,
    });

    expect(r.measurementId).toBeTruthy();
    expect(r.choqueAceptado?.esDelMismoPaciente).toBe(false);

    // EL RASTRO, Y ES LA MITAD QUE HACE ACEPTABLE QUE EL FRENO SE ABRA.
    const rastro = await db
      .select({ payload: esquema.clinicalAuditLog.payload })
      .from(esquema.clinicalAuditLog)
      .where(
        and(
          eq(esquema.clinicalAuditLog.event, "bis.huella_repetida_confirmada"),
          eq(esquema.clinicalAuditLog.entityId, r.measurementId),
        ),
      );
    expect(rastro.length, "el acto no quedo en el rastro clinico").toBe(1);
    const p = rastro[0].payload as Record<string, unknown>;
    expect(p.motivo).toBe(motivo);
    expect(p.confirmacion_requerida).toBe(true);
    expect(p.otra_evaluacion_id).toBe(real.evaluationId);
  });
});
