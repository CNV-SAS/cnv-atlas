import { describe, expect, it } from "vitest";

import {
  clasifNHLBI,
  computeRefPob,
  dEI,
  dFMpct,
  dSolEC,
  pscAFxIR,
} from "@/modules/diagnoses/data/composition-display";

// Candado de la capa de DISPLAY portada verbatim del HTML de Gildardo (ATLAS_v8, funciones d* y REF_POB).
// Ancla los cortes y las etiquetas contra el caso real del smoke, y las marcas "en validacion": tras §5
// (2026-08-17) SIN marca hidratacion 73,2%, MCA 52,4% y el reparto de Wang (proteina 19,4%, CMO 5,6%,
// mineral no oseo 1,2%); SIGUEN marcadas agua EC 42% y proteina activa 70% (y lo que hereda del 70%).

describe("clasificadores de display (verbatim del HTML)", () => {
  it("dEI: >0.40 -> Sobrecarga extracelular/inflamacion (el caso del smoke, 0.634)", () => {
    expect(dEI(0.634)?.label).toBe("Sobrecarga extracelular/inflamación");
    expect(dEI(0.634)?.sev).toBe(3); // rojo
    expect(dEI(0.38)?.label).toBe("Equilibrio hídrico óptimo");
  });

  it("dSolEC: Δ <= -0.5 -> Deficit matriz (el caso del smoke, -1.82)", () => {
    expect(dSolEC(-1.82)?.label).toBe("Déficit matriz — considerar colágeno");
    expect(dSolEC(0)?.label).toBe("Matriz extracelular adecuada");
  });

  it("dFMpct: hombre 22.4% -> Sobrepeso adiposo (>22)", () => {
    expect(dFMpct(22.4, true)?.label).toBe("Sobrepeso adiposo");
    expect(dFMpct(22.4, true)?.sev).toBe(1); // ambar
    expect(dFMpct(20, true)?.label).toBe("Normal");
  });

  it("clasifNHLBI: hombre IMC 25.66, cintura 84 -> Sobrepeso · riesgo aumentado", () => {
    expect(clasifNHLBI(25.66, 84, true)?.label).toBe("Sobrepeso · riesgo aumentado");
    // cintura alta (>102) cambia a riesgo alto
    expect(clasifNHLBI(25.66, 110, true)?.label).toBe("Sobrepeso · riesgo alto");
  });

  it("pscAFxIR: AF 6.7 · IR 0.759 (hombre) -> IR Normal · AF Normal / Perfil de Salud Celular adecuado", () => {
    const r = pscAFxIR(6.7, 0.759, true);
    expect(r.valueText).toBe("IR Normal · AF Normal");
    expect(r.dx?.label).toBe("Perfil de Salud Celular adecuado");
  });
});

describe("computeRefPob: marca 'en validacion' (care Santiago 2026-08-15)", () => {
  // Solo se computan las que el equipo NO trae (existing devuelve null para todas).
  const ref = computeRefPob(80, 177, true, () => null);

  it("las validadas NO llevan marca: hidratacion 73,2%, MCA 52,4% (§9) y el reparto de Wang confirmado (§5 2026-08-17)", () => {
    expect(ref["TBW_ref"]?.enValidacion).toBe(false);
    expect(ref["MCA_ref"]?.enValidacion).toBe(false);
    expect(ref["hidSG_ref"]?.enValidacion).toBe(false);
    expect(ref["FFM_ref"]?.enValidacion).toBe(false); // grasaPct, ya en el archivo
    // Confirmadas el 2026-08-17 §5 (reparto de Wang, cierran en 99,4%): quitada la marca.
    expect(ref["protTotal_ref"]?.enValidacion).toBe(false); // proteina total 19,4%
    expect(ref["CMO_ref"]?.enValidacion).toBe(false); // CMO 5,6%
    expect(ref["minNoOseo_ref"]?.enValidacion).toBe(false); // mineral no oseo 1,2%
  });

  it("las que SIGUEN sin validar llevan marca: agua EC 42% y proteina activa 70% (y lo que hereda del 70%)", () => {
    expect(ref["ECW_ref"]?.enValidacion).toBe(true); // aguaEC 42, sin validar (va a la ronda con los 5.073 registros)
    expect(ref["protActiva_ref"]?.enValidacion).toBe(true); // proteina activa 70%, sin validar
    expect(ref["solEC_ref"]?.enValidacion).toBe(true); // depende de la proteina activa 70% -> hereda la marca
  });

  it("el equipo manda: si la referencia real existe, REF_POB no la pisa", () => {
    const r2 = computeRefPob(80, 177, true, (k) => (k === "TBW_ref" ? 48.55 : null));
    expect(r2["TBW_ref"]).toBeUndefined(); // no se computa: el equipo la trajo
  });
});
