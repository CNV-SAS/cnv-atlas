import { describe, expect, it } from "vitest";

import { parseBiodyRow } from "@/clinical-engine/edge/biody-import";
import { classifyFenotipo } from "@/clinical-engine/protocolo-fenotipo";
import { motorProtocolo } from "@/clinical-engine/frozen/atlas-protocolo.authorized.js";
import fixture from "./fixtures/clinical-engine/biody-demo-realimentacion-f10.json";

// CANDADO DEL FIXTURE DEMO de realimentacion. El aviso de seguridad (sindrome de realimentacion) solo
// se puede SMOKEAR si existe un caso que lo dispare, y la condicion del motor es fina:
// fenotipo F7 o F10, GEB < 1200 y IMC < 18.5. Un retoque del fixture (o un cambio de umbral) podria
// apagar el caso EN SILENCIO y dejar el smoke probando una pantalla sin aviso, que se lee como "no hay
// riesgo" en vez de "el caso ya no dispara". Este test es barato y lo impide.
//
// QUE ES REAL Y QUE NO: la fila BIS se parsea con el parser REAL (parseBiodyRow, mismos headers y
// mismos rangos de cordura del import) y el fenotipo sale del clasificador REAL sobre esos valores.
// Solo los indicadores que NO entran en la condicion del aviso (irc/iscm/iehh/iae, sector) se pasan en
// cero: no la tocan. La verdad END-TO-END (pipeline + BD + panel) la da el seed
// (demo-realimentacion.seed.test.ts), que corre el pipeline real; esto es el candado barato.

const row = fixture as Record<string, unknown>;

describe("fixture demo de realimentacion (F10, dispara el aviso de seguridad)", () => {
  const imp = parseBiodyRow(row);
  const fen = classifyFenotipo({
    FMI: imp.FMI,
    FFMI: imp.FFMI,
    MCA: Number(imp.raw.MCA),
    MCA_ref: Number(imp.raw.MCA_ref),
    smmW: Number(imp.raw.smmW),
    ASMI: imp.ASMI,
    AF: Number(imp.raw.AF),
    sexoM: false, // el perfil demo es mujer; el pipeline lo toma del paciente (patient_profiles.sex = 'F')
  });

  it("la fila pasa el import real y clasifica F10 (bajo peso)", () => {
    expect(fen.fenotipo.id).toBe("F10");
    expect(fen.nivelFMI).toBe("bajo");
    expect(fen.nivelFFMI).toBe("normal");
  });

  it("cumple las otras dos condiciones del aviso: GEB < 1200 e IMC < 18.5", () => {
    expect(Number(imp.raw.GEB)).toBeLessThan(1200);
    expect(Number(imp.raw.imc)).toBeLessThan(18.5);
  });

  it("el motor congelado levanta alertaSindRealim con esta fila", () => {
    const pr = motorProtocolo(
      {
        sexo: "F",
        irc: 0,
        iscm: 0,
        iehh: 0,
        iae: 0,
        FMI: imp.FMI,
        FFMI: imp.FFMI,
        peso: imp.peso,
        talla: imp.talla,
        FFM: imp.FFM,
        imc: Number(imp.raw.imc),
        GEB: Number(imp.raw.GEB),
      },
      {},
      {
        fenotipo: { id: fen.fenotipo.id, nombre: fen.fenotipo.nombre },
        sectorFR: "",
        nombreFR: "",
        obesidadSarcopenica: fen.obesidadSarcopenica,
      },
    );
    expect(pr.alertaSindRealim).toBe(true);
  });
});
