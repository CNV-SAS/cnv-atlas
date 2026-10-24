import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BAND_TEXT,
  ebBand,
  mayorDelMotor,
  MIN_COMPARABLE_WEEKS,
  pickComparablePrior,
  type PriorEvaluation,
  resolveTrajectory,
  sonComparables,
} from "@/modules/followups/services/eb-trajectory";

// LA VERSION DEL MOTOR VIGENTE EN LAS FIXTURES. Antes del 2026-10-24 la banda no la miraba, y la resta se
// habria hecho entre dos escalas distintas el dia que la EB-BIS cambie de formula (la v7 la cambia).
const MOTOR = "1.0.0";

// P0 Parte 2: el cambio de EB-BIS en tres bandas. Nucleo puro. La redaccion es de Gildardo; aqui se
// prueba el MECANISMO (bandas, corte, y la seleccion de la previa comparable por intervalo).

describe("ebBand (corte ±2 años; EB mas baja = mejoro)", () => {
  it("delta <= -2 -> mejoro; >= +2 -> empeoro; en medio -> sin_cambio", () => {
    expect(ebBand(-2)).toBe("mejoro");
    expect(ebBand(-3.5)).toBe("mejoro");
    expect(ebBand(2)).toBe("empeoro");
    expect(ebBand(4)).toBe("empeoro");
    expect(ebBand(0)).toBe("sin_cambio");
    expect(ebBand(-1.9)).toBe("sin_cambio"); // el caso que la query le lleva a Gildardo
    expect(ebBand(1.9)).toBe("sin_cambio");
  });
});

describe("pickComparablePrior (3b: gate sobre el INTERVALO, no la posicion)", () => {
  const current = "2026-08-01T00:00:00Z";
  const p4w: PriorEvaluation = { evaluationId: "e4", date: "2026-07-04T00:00:00Z", eb: 40, engineVersion: MOTOR }; // ~4 sem
  const p20w: PriorEvaluation = { evaluationId: "e20", date: "2026-03-14T00:00:00Z", eb: 45, engineVersion: MOTOR }; // ~20 sem

  it("salta la inmediata anterior si esta a <12 semanas y usa una mas vieja que si califica", () => {
    const t = pickComparablePrior(current, 42, [p4w, p20w], MOTOR); // recientes primero
    expect(t?.comparedToEvaluationId).toBe("e20");
    expect(t?.intervalWeeks).toBe(20);
    expect(t?.ebDelta).toBe(-3); // 42 - 45
    expect(t?.band).toBe("mejoro");
    expect(t?.cutYears).toBe(2);
    expect(t?.provisional).toBe(true);
  });

  it("si NINGUNA previa cumple las 12 semanas -> null (el paciente ve la lectura funcional)", () => {
    expect(pickComparablePrior(current, 42, [p4w], MOTOR)).toBeNull();
  });

  it("usa la inmediata anterior si ya cumple el intervalo", () => {
    const t = pickComparablePrior(current, 42, [p20w], MOTOR);
    expect(t?.comparedToEvaluationId).toBe("e20");
  });

  it("EB actual null o previa sin EB -> se ignora (no se inventa banda)", () => {
    expect(pickComparablePrior(current, null, [p20w], MOTOR)).toBeNull();
    expect(pickComparablePrior(current, 42, [{ ...p20w, eb: null }], MOTOR)).toBeNull();
  });

  it("el corte de comparabilidad es 12 semanas", () => {
    expect(MIN_COMPARABLE_WEEKS).toBe(12);
  });
});

describe("resolveTrajectory (distingue POR QUÉ no hay banda: punto 3)", () => {
  const current = "2026-08-01T00:00:00Z";
  const p4w: PriorEvaluation = { evaluationId: "e4", date: "2026-07-04T00:00:00Z", eb: 40, engineVersion: MOTOR };
  const p20w: PriorEvaluation = { evaluationId: "e20", date: "2026-03-14T00:00:00Z", eb: 45, engineVersion: MOTOR };

  it("hay previa comparable -> band", () => {
    const r = resolveTrajectory(current, 42, [p20w], MOTOR);
    expect(r.kind).toBe("band");
  });

  it("previa existe pero a <12 semanas -> interval_too_short (con las semanas)", () => {
    const r = resolveTrajectory(current, 42, [p4w], MOTOR);
    expect(r.kind).toBe("interval_too_short");
    if (r.kind === "interval_too_short") expect(r.nearestWeeks).toBe(4);
  });

  it("no hay previa con EB -> no_prior", () => {
    expect(resolveTrajectory(current, 42, [], MOTOR).kind).toBe("no_prior");
    expect(resolveTrajectory(current, 42, [{ ...p20w, eb: null }], MOTOR).kind).toBe("no_prior");
  });

  it("EB actual null -> no_prior (degradado, nada con qué comparar)", () => {
    expect(resolveTrajectory(current, null, [p20w], MOTOR).kind).toBe("no_prior");
  });
});


describe("dos versiones MAYORES del motor no se comparan (Santiago, 2026-10-24)", () => {
  // EL CRITERIO NO ES NUESTRO: docs/VERSIONES.md dice "Mayor = la ciencia cambia y lo emitido antes no es
  // comparable". La banda es una resta entre dos snapshots sellados, asi que la comparabilidad la define la
  // version MAYOR de cada uno, literalmente.
  const current = "2026-08-01T00:00:00Z";
  const previa = (engineVersion: string | null): PriorEvaluation => ({
    evaluationId: "e20",
    date: "2026-03-14T00:00:00Z",
    eb: 45,
    engineVersion,
  });

  it("mismo mayor, menor distinto -> SI se compara (1.0.0 contra 1.4.0)", () => {
    const r = resolveTrajectory(current, 42, [previa("1.4.0")], "1.0.0");
    expect(r.kind, "cambia lo que el motor PUEDE devolver, no la ciencia").toBe("band");
  });

  it("mayor distinto -> NO se compara, y lo dice con su motivo propio", () => {
    const r = resolveTrajectory(current, 42, [previa("1.0.0")], "2.0.0");
    expect(r.kind).toBe("otra_version_del_motor");
    if (r.kind === "otra_version_del_motor") expect(r.versionPrevia).toBe("1.0.0");
  });

  it("el motivo NO puede ser 'no hay previa': la previa existe y el profesional la ve en pantalla", () => {
    const r = resolveTrajectory(current, 42, [previa("1.0.0")], "2.0.0");
    expect(r.kind).not.toBe("no_prior");
  });

  it("tolera las dos grafias que hay en produccion (anibise-1.4.0 y 1.0.0)", () => {
    // Medido el 2026-10-24: 400 reportes en `1.0.0` y 6 en `anibise-1.4.0`. Unificarlas es otro pendiente;
    // hasta que ocurra, una banda no puede depender de cual se uso.
    expect(mayorDelMotor("anibise-1.4.0")).toBe("1");
    expect(mayorDelMotor("1.0.0")).toBe("1");
    expect(mayorDelMotor("2.0.0")).toBe("2");
    expect(sonComparables("anibise-1.4.0", "1.0.0")).toBe(true);
    expect(sonComparables("anibise-1.4.0", "2.0.0")).toBe(false);
    const r = resolveTrajectory(current, 42, [previa("anibise-1.4.0")], "1.0.0");
    expect(r.kind).toBe("band");
  });

  it("si la version no se puede leer, NO se compara", () => {
    expect(mayorDelMotor(null)).toBeNull();
    expect(mayorDelMotor("")).toBeNull();
    expect(mayorDelMotor("sin numeros")).toBeNull();
    expect(sonComparables(null, "1.0.0"), "restar a ciegas es peor que callar").toBe(false);
    expect(resolveTrajectory(current, 42, [previa(null)], "1.0.0").kind).toBe("otra_version_del_motor");
    expect(resolveTrajectory(current, 42, [previa("1.0.0")], null).kind).toBe("otra_version_del_motor");
  });

  it("la version se filtra ANTES del intervalo, no despues", () => {
    // Si se filtrara despues, "la anterior es de hace 4 semanas" podria referirse a una previa que ademas
    // era incomparable, y el aviso mandaria al profesional a esperar doce semanas por una banda que no iba
    // a salir nunca.
    const p4wOtroMotor: PriorEvaluation = {
      evaluationId: "e4",
      date: "2026-07-04T00:00:00Z",
      eb: 40,
      engineVersion: "2.0.0",
    };
    const r = resolveTrajectory(current, 42, [p4wOtroMotor], "1.0.0");
    expect(r.kind).toBe("otra_version_del_motor");
  });

  it("la banda sellada lleva LAS DOS versiones de la resta", () => {
    // Por la misma razon que `cutYears`: un reporte viejo tiene que poder decir contra que se comparo sin
    // volver a buscar los dos snapshots.
    const t = pickComparablePrior(current, 42, [previa("1.4.0")], "1.0.0");
    expect(t?.engineVersion).toBe("1.0.0");
    expect(t?.comparedToEngineVersion).toBe("1.4.0");
  });
});

describe("textos VERBATIM de Gildardo (Q25 / RESPUESTA_GILDARDO 7.1)", () => {
  it("son los tres exactos, con su puntuación (una coma movida = edición no autorizada)", () => {
    expect(BAND_TEXT.mejoro).toBe(
      "Los indicadores de tu evaluación muestran una evolución favorable respecto de tu medición anterior. Continúa con el plan acordado con tu profesional.",
    );
    expect(BAND_TEXT.sin_cambio).toBe(
      "Tus indicadores se mantienen en un rango similar al de tu medición anterior, sin cambios significativos con la información disponible.",
    );
    expect(BAND_TEXT.empeoro).toBe(
      "Tus indicadores muestran una evolución menos favorable que en tu medición anterior. Tu profesional revisará contigo el plan en la próxima consulta.",
    );
  });

  it("ninguno revela el constructo (no dice 'edad bioeléctrica') ni una cifra", () => {
    for (const t of Object.values(BAND_TEXT)) {
      expect(t).not.toMatch(/bioeléctrica|edad biológica/i);
      expect(t).not.toMatch(/\d/); // sin cifras
    }
  });
});

describe("el cableado de la version, que es donde se rompe en silencio", () => {
  // La funcion pura puede estar perfecta y la banda seguir comparando escalas distintas si el lector no
  // trae la version o el writer no la pasa. tsc obliga a pasar ALGO (el parametro no tiene defecto a
  // proposito); lo que no puede obligar es a pasar la version DE VERDAD en vez de null.
  const leer = (f: string) => readFileSync(f, "utf8");

  it("el lector del sellado saca la version del MISMO snapshot que la cifra", () => {
    const src = leer("src/modules/clinical-pipeline/data/pipeline-trajectory.ts");
    expect(src).toMatch(/'\{versions,engine\}'/);
    expect(src).toMatch(/resolveTrajectory\(currentDate, args\.currentEb, priors, args\.currentEngineVersion\)/);
  });

  it("el writer pasa la version del motor que acaba de calcular la EB", () => {
    const src = leer("src/modules/clinical-pipeline/data/pipeline-writer.ts");
    expect(src).toMatch(/currentEngineVersion: output\.versions\.engine/);
  });

  it("el aviso al profesional tambien la mira, y tiene su propio texto", () => {
    const lector = leer("src/modules/followups/data/trajectory-notice-reader.ts");
    expect(lector).toMatch(/versionOf\(/);
    expect(lector).toMatch(/otra_version_del_motor/);
    const pantalla = leer("src/modules/followups/components/trajectory-notice.tsx");
    expect(pantalla).toMatch(/otra_version_del_motor/);
    expect(
      pantalla,
      "el aviso tiene que decir que hacer: esa consulta se recalcula, no se espera",
    ).toMatch(/recalcularse con el modelo vigente/);
  });
});
