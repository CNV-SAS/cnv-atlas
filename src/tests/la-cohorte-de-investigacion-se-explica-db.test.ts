import { beforeAll, describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA COHORTE DE INVESTIGACION SE EXPLICA SOLA  ·  LAS CUATRO DE GILDARDO DEL 2026-10-25
//
// ── POR QUE CONTRA LA BASE ──────────────────────────────────────────────────────────────────────
//
// Las cuatro cosas que no cerraban en /obbia eran todas del mismo tipo: una cifra cierta al lado de otra
// cifra cierta, sin nada que explicara la diferencia. Lo que arregla eso no es un texto, es que las
// cifras CUADREN entre si, y eso solo se puede comprobar corriendo las consultas sobre datos.
//
// LOS INVARIANTES QUE SE FIJAN AQUI:
//
//   · El desglose explica TODAS las excluidas. Si manana aparece una cuarta razon que el `case` no
//     contempla, la suma deja de dar y esta prueba falla. Sin esto, una razon nueva se iria al cajon de
//     "firmo y no marco la casilla", que es el unico `else`, y le atribuiria a alguien una decision que
//     no tomo.
//   · Las familias del motor explican todos los diagnosticos de la cohorte.
//   · La pantalla y la banda de trayectoria leen la version del motor con LA MISMA funcion, que es lo
//     que Gildardo pidio al ver `1.0.0` y `anibise-1.4.0` contados como dos versiones distintas.
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

describe.skipIf(!HAS_DB)("la cohorte de investigacion (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let cohorte: any;
  let mayorDelMotor: (v: string | null | undefined) => string | null;

  beforeAll(async () => {
    if (!HAS_DB) return;
    const lector = await import("@/modules/obbia/data/cohorte-reader");
    ({ mayorDelMotor } = await import("@/modules/followups/services/eb-trajectory"));
    cohorte = await lector.leerCohorteDeInvestigacion();
  });

  it("las cifras del panel son coherentes entre si, y CADA vigente cae en un solo cubo", () => {
    // LOS TRES CUBOS SUMAN EL TOTAL: dentro, fuera por consentimiento, fuera por calidad de dato (0230).
    // Es el invariante que impide que una exclusion nueva se esconda dentro de otra: antes
    // `sinAutorizacion` era una RESTA, asi que al empezar a excluir por huella repetida habria absorbido
    // esas 13 y el rotulo "sin autorizacion" habria dicho que no autorizaron quienes si lo hicieron.
    expect(
      cohorte.conAutorizacion + cohorte.sinAutorizacion + cohorte.fueraPorHuellaRepetida.consultas,
    ).toBe(cohorte.vigentes);
    expect(cohorte.conAutorizacion).toBeLessThanOrEqual(cohorte.vigentes);
    expect(cohorte.conDiagnostico).toBeLessThanOrEqual(cohorte.conAutorizacion);
  });

  it("el desglose explica TODAS las excluidas, no casi todas", () => {
    const suma = cohorte.sinAutorizacionPorRazon.reduce((n: number, r: any) => n + r.consultas, 0);
    expect(
      suma,
      "si una razon nueva no entra en el case, cae en el else y le atribuye a alguien una decision que no tomo",
    ).toBe(cohorte.sinAutorizacion);
    for (const r of cohorte.sinAutorizacionPorRazon) {
      expect(r.pacientes, "nunca mas pacientes que consultas").toBeLessThanOrEqual(r.consultas);
      expect(r.pacientes).toBeGreaterThan(0);
    }
  });

  it("las importadas autorizadas son un subconjunto de las importadas", () => {
    // La cifra que sorprendio a Gildardo (8 de muchas): el total tiene que estar al lado, y tiene que ser
    // mayor o igual. Si alguna vez saliera al contrario, una de las dos consultas estaria mal escrita.
    expect(cohorte.importadas).toBeLessThanOrEqual(cohorte.importadasVigentes);
    expect(cohorte.importadas).toBeLessThanOrEqual(cohorte.conAutorizacion);
  });

  it("las familias del motor explican todos los diagnosticos de la cohorte", () => {
    const conVersion = cohorte.porVersionDelMotor
      .filter((v: any) => mayorDelMotor(v.version) !== null)
      .reduce((n: number, v: any) => n + v.evaluaciones, 0);
    const porFamilia = cohorte.porFamiliaDelMotor.reduce((n: number, f: any) => n + f.evaluaciones, 0);
    expect(porFamilia).toBe(conVersion);
  });

  it("la familia se calcula con LA MISMA funcion que la banda de trayectoria", () => {
    // ES LA PETICION LITERAL: "si es la misma familia, la pantalla y la banda tienen que leer las dos
    // formas igual". Dos criterios de comparabilidad es como se llega a que la banda compare dos
    // mediciones y el panel diga que no son comparables.
    for (const f of cohorte.porFamiliaDelMotor) {
      for (const grafia of f.grafias) {
        expect(mayorDelMotor(grafia), `la grafia ${grafia} tiene que caer en la familia ${f.mayor}`).toBe(
          f.mayor,
        );
      }
    }
    // Y la alarma solo salta con DOS familias, no con dos grafias.
    expect(cohorte.mezclaFamilias).toBe(cohorte.porFamiliaDelMotor.length > 1);
  });

  it("la exclusion por huella repetida es un subconjunto de los que SI autorizaron", () => {
    // Si alguna vez saliera mayor que las vigentes con huella repetida, estaria contando a alguien que
    // tampoco autorizo, y entonces esa consulta estaria en dos cubos a la vez.
    expect(cohorte.fueraPorHuellaRepetida.consultas).toBeLessThanOrEqual(cohorte.vigentes);
    if (cohorte.fueraPorHuellaRepetida.consultas > 0) {
      expect(cohorte.fueraPorHuellaRepetida.grupos).toBeGreaterThan(0);
      expect(cohorte.fueraPorHuellaRepetida.pacientes).toBeGreaterThan(0);
    }
  });

  it("los meses suman la cohorte autorizada", () => {
    const suma = cohorte.porMes.reduce((n: number, m: any) => n + m.evaluaciones, 0);
    expect(suma).toBe(cohorte.conAutorizacion);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS CONSOLIDADOS DE SU CNVResearch  ·  el cotejo del 2026-11-03
//
// Su modulo estratifica la cohorte por pais, ciudad, sexo y profesional, cada eje con las mismas cinco
// columnas. Era lo mas grande que /obbia no tenia. Los invariantes de abajo son los que hacen que una
// tabla de caracterizacion sirva: que SUME el total (si no, hay filas que se pierden sin que nadie lo
// note) y que ninguna columna derivada supere a la que la contiene.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe.skipIf(!HAS_DB)("los consolidados de la cohorte (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let cohorte: any;

  beforeAll(async () => {
    if (!HAS_DB) return;
    const lector = await import("@/modules/obbia/data/cohorte-reader");
    cohorte = await lector.leerCohorteDeInvestigacion();
  });

  it("los cuatro ejes están, y cada uno suma el total de la cohorte", () => {
    expect(cohorte.estratos.map((e: any) => e.eje)).toEqual([
      "pais",
      "ciudad",
      "sexo",
      "profesional",
    ]);
    for (const eje of cohorte.estratos) {
      if (eje.filas.length === 0) continue; // cohorte vacía en local: no hay nada que sumar
      const suma = eje.filas.reduce((n: number, f: any) => n + f.consultas, 0);
      expect(
        suma,
        `el eje ${eje.eje} no suma la cohorte: hay consultas que no caen en ninguna fila`,
      ).toBe(cohorte.conAutorizacion);
    }
  });

  it("y ninguna columna derivada supera a la que la contiene", () => {
    for (const eje of cohorte.estratos) {
      for (const f of eje.filas) {
        expect(f.pacientes, `${eje.eje}/${f.grupo}: más pacientes que consultas`).toBeLessThanOrEqual(
          f.consultas,
        );
        expect(f.conBis, `${eje.eje}/${f.grupo}: más con BIS que consultas`).toBeLessThanOrEqual(
          f.consultas,
        );
        // El espectro es un SUBCONJUNTO de las que tienen medición: son crudos de esa misma toma.
        expect(
          f.conEspectro,
          `${eje.eje}/${f.grupo}: más con espectro que con BIS`,
        ).toBeLessThanOrEqual(f.conBis);
      }
    }
  });

  it("las cifras de la cohorte son subconjuntos de la cohorte autorizada", () => {
    const c = cohorte.cifrasDeLaCohorte;
    expect(c.conEspectro).toBeLessThanOrEqual(cohorte.conAutorizacion);
    expect(c.conEncuestaCompleta).toBeLessThanOrEqual(cohorte.conAutorizacion);
    expect(c.conPlanNutricional).toBeLessThanOrEqual(cohorte.conAutorizacion);
    // SIN EDAD SE DEVUELVE null, NO CERO: un cero aquí sería un recién nacido, y "sin fecha de
    // nacimiento" no es una edad de cero. Es la regla que cerró "una fecha ilegible que se vuelve cero".
    if (c.edadMedia != null) {
      expect(c.edadMinima).not.toBeNull();
      expect(c.edadMinima).toBeLessThanOrEqual(c.edadMedia);
      expect(c.edadMaxima).toBeGreaterThanOrEqual(c.edadMedia);
    }
  });
});
