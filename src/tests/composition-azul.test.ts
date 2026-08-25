import { describe, expect, it } from "vitest";

import { wangRowDx } from "@/modules/diagnoses/data/composition-display";

// CANDADO DE LA SEGUNDA COPIA (2026-08-24). La capa de display tenia la MISMA suposicion que `colorSev`:
// que el azul es benigno. Con ella, "Desnutrición" y "Bajo peso" salian con severidad 0 en la tabla de
// Wang del Diagnostico, y sobre todo quedaban FUERA de la historia clinica, que filtra por alteracion.
//
// El caso que justifica todo el trabajo del filtro: un paciente DESNUTRIDO habria recibido una historia
// clinica que dice "Sin índices alterados". Por eso el candado empieza por el.

const ctx = { imc: 17, cintura: 80, af: 8.5, ir: 0.7 };
const dxDe = (key: string, v: number, sexoM = true) =>
  wangRowDx(key, v, sexoM, ctx, null, (x) => String(x))?.dx ?? null;

describe("el azul de la capa de display", () => {
  it("DESNUTRICION no es óptimo, y por tanto NO se cae del documento clínico", () => {
    const d = dxDe("FFMI", 14);
    expect(d?.label).toBe("Desnutrición");
    expect(d?.sev, "sev 0 la habria dejado fuera de la historia clínica filtrada").toBeGreaterThanOrEqual(1);
  });

  it("BAJO PESO tampoco", () => {
    const d = dxDe("imc", 17);
    expect(d?.label).toBe("Bajo peso");
    expect(d?.sev).toBeGreaterThanOrEqual(1);
  });

  it("los demás azules de alteración entran: AEC bajo, exceso intracelular, sobrehidratación, AF alto", () => {
    for (const [key, v, etiqueta] of [
      ["ECW_pct", 30, "AEC bajo"],
      ["ICW_pct", 70, "Exceso intracelular"],
      ["hidSG", 80, "Sobrehidratación"],
      ["AF", 8.5, "Alto"],
    ] as [string, number, string][]) {
      const d = dxDe(key, v);
      expect(d?.label, key).toBe(etiqueta);
      expect(d?.sev, `${etiqueta} debe contar como alteración`).toBeGreaterThanOrEqual(1);
    }
  });

  it("los azules BENIGNOS siguen en óptimo: 'Óptimo' y 'Bajo (atleta)'", () => {
    // Es la razon por la que el arreglo no podia ser "todo azul es alteración": habria convertido el mejor
    // nivel de SMM/W en una alerta, y habria marcado a un deportista por tener poca grasa.
    const smm = dxDe("smmW", 40);
    expect(smm?.label).toBe("Óptimo");
    expect(smm?.sev).toBe(0);
    const grasa = dxDe("FM_pct", 5);
    expect(grasa?.label).toBe("Bajo (atleta)");
    expect(grasa?.sev).toBe(0);
  });

  it("los tonos NO azules no se movieron", () => {
    const inflam = dxDe("IR", 0.95);
    expect(inflam?.sev).toBe(3); // rojo
    const normal = dxDe("imc", 22);
    expect(normal?.sev).toBe(0); // verde
  });
});

// ── Mapa AFxIR (Perfil de Salud Celular) ──────────────────────────────────────────────────────────────
// Cuarto caso de la misma familia: las NUEVE interpretaciones se pintaban con el mismo teal y caian en 0,
// asi que "Disfuncion celular severa" salia con el color de optimo. El teal es "informativo", pero la
// etiqueta EMITE UN VEREDICTO: si dice disfuncion severa, el color no puede decir optimo.

import { pscAFxIR } from "@/modules/diagnoses/data/composition-display";

// af/ir que producen cada combinacion (hombre: AF bajo <6.5, normal <=7, alto >7; IR con corte 0.78).
const psc = (ir: number, af: number) => pscAFxIR(af, ir, true).dx;

describe("mapa AFxIR", () => {
  it("la disfunción celular SEVERA no es óptimo", () => {
    const d = psc(0.9, 6); // IR elevado + AF bajo
    expect(d?.label).toContain("Disfunción celular severa");
    expect(d?.sev).toBe(3);
  });

  it("las tres interpretaciones BENIGNAS quedan en óptimo explícito", () => {
    // Como los benignos del azul (SMM/W y el atleta): un default del lado seguro obliga a nombrar las
    // excepciones, o marca por alterado lo que esta bien.
    expect(psc(0.78, 6.8)?.label).toBe("Perfil de Salud Celular adecuado");
    expect(psc(0.78, 6.8)?.sev).toBe(0);
    expect(psc(0.78, 8)?.sev).toBe(0); // Buena Masa Celular Activa
    expect(psc(0.7, 8)?.sev).toBe(0); // Perfil de salud celular ideal
  });

  it("un déficit de masa celular cuenta como alteración", () => {
    const d = psc(0.78, 6);
    expect(d?.label).toBe("Déficit de masa celular activa");
    expect(d?.sev).toBeGreaterThanOrEqual(1);
  });

  it("'Hidratación óptima · Masa celular límite' NO se lee como benigna por la palabra óptima", () => {
    // Por esto el desempate aqui es por CLAVE y no por etiqueta: la alteracion es la otra mitad del texto.
    const d = psc(0.7, 6.8);
    expect(d?.label).toContain("óptima");
    expect(d?.sev).toBe(1);
  });

  it("sin AF o sin IR no hay interpretación (no se inventa una)", () => {
    expect(pscAFxIR(null, 0.78, true).dx).toBeNull();
    expect(pscAFxIR(6.8, null, true).dx).toBeNull();
  });
});
