import { describe, expect, it } from "vitest";

import { ENGINE_VERSION } from "@/clinical-engine";
import { buildEmissionVersions } from "@/modules/clinical-pipeline/emission-versions";
import { vigenciaEmision } from "@/modules/clinical-pipeline/emision-vigencia";

// CANDADO DE LA DETECCION DE CIENCIA DESFASADA.
//
// Lo que tiene que hacer bien no es "detectar": es NO detectar de mas. Un aviso que se dispara cuando
// no toca se aprende a ignorar, y entonces falla el dia que acierta (Gildardo lo dijo con nuestras
// propias palabras al retirar las tablas de alergenos). Por eso la mitad de este candado prueba los
// casos que NO deben marcarse.

const AL_DIA = { engineVersion: ENGINE_VERSION, emissionVersions: buildEmissionVersions() };

describe("vigencia de emisión", () => {
  it("un diagnóstico emitido con lo vigente NO se marca", () => {
    const v = vigenciaEmision(AL_DIA);
    expect(v.alDia).toBe(true);
    expect(v.desfasadas).toEqual([]);
  });

  it("un motor anterior se marca, y dice con cuál se emitió y cuál rige", () => {
    // El caso REAL: 23 de 40 diagnosticos quedaron en anibise-1.0.0 tras el bump del 19-ago.
    const v = vigenciaEmision({ ...AL_DIA, engineVersion: "anibise-1.0.0" });
    expect(v.alDia).toBe(false);
    expect(v.desfasadas).toEqual([
      { clave: "engine", selladoCon: "anibise-1.0.0", vigenteHoy: ENGINE_VERSION },
    ]);
  });

  it("una clave de emisión distinta se marca (el caso del LE8: cambia la calibración)", () => {
    const v = vigenciaEmision({
      ...AL_DIA,
      emissionVersions: { ...buildEmissionVersions(), calibration: "ebbis-v5-provisional-VIEJA" },
    });
    expect(v.alDia).toBe(false);
    expect(v.desfasadas.map((d) => d.clave)).toEqual(["calibration"]);
  });

  it("una clave AUSENTE no se marca: 'no aplicaba' no es 'se movió'", () => {
    // Regla de Gildardo, no nuestra: los diagnosticos anteriores a structural_mccb no la llevan y NO
    // se rellenan hacia atras. Marcarlos seria pedir reemitir lo que el dijo que no hay que reemitir.
    const sin = { ...buildEmissionVersions() } as Record<string, unknown>;
    delete sin.structural_mccb;
    expect(vigenciaEmision({ ...AL_DIA, emissionVersions: sin }).alDia).toBe(true);
  });

  it("emission_versions en null tampoco marca por sí solo", () => {
    // Los diagnosticos previos a la columna (demo) tienen null. Si el motor coincide, no hay nada que
    // decirle al profesional: no sabemos que se movio, y afirmar que se movio seria inventarlo.
    expect(vigenciaEmision({ engineVersion: ENGINE_VERSION, emissionVersions: null }).alDia).toBe(true);
  });

  it("engineVersion en null no marca: ausente no es distinto", () => {
    expect(vigenciaEmision({ engineVersion: null, emissionVersions: buildEmissionVersions() }).alDia).toBe(
      true,
    );
  });

  it("acumula VARIAS dimensiones cuando se mueven juntas", () => {
    // Es el caso que anuncia Gildardo para el LE8: mapeo y recalibracion caen en el MISMO acto, asi
    // que lo esperable es ver motor Y calibracion desfasados a la vez, no uno solo.
    const v = vigenciaEmision({
      engineVersion: "anibise-1.0.0",
      emissionVersions: { ...buildEmissionVersions(), calibration: "vieja", classification: "vieja" },
    });
    expect(v.desfasadas.map((d) => d.clave).sort()).toEqual([
      "calibration",
      "classification",
      "engine",
    ]);
  });

  it("CONTROL NEGATIVO: si la comparación fuera trivial, esto pasaría igual", () => {
    // Sin esto, una implementacion que devolviera siempre `alDia: true` pasaria los tests de "no
    // marca" y solo fallaria en los de "marca". Aqui se fuerza la direccion contraria: TODO distinto.
    const v = vigenciaEmision({
      engineVersion: "otro-motor",
      emissionVersions: { classification: "x", calibration: "y", structural_mccb: "z" },
    });
    expect(v.alDia).toBe(false);
    expect(v.desfasadas).toHaveLength(4);
  });
});
