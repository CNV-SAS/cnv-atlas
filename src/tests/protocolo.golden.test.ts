import { describe, expect, it, vi } from "vitest";

import { computeProtocolo, runEngine } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import {
  buildEngineInput,
  type SurveyFieldAnswer,
} from "@/modules/clinical-pipeline/services/build-engine-input";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import { PROTOCOL_FLAG_TEXTS } from "./fixtures/clinical-engine/frozen-survey-texts";

// GOLDEN del ORQUESTADOR (T2 A3). Los tres motores ya estan verificados aparte; lo que este golden
// prueba es el MAPEO (la familia del bug de cintura): que cada campo del BIS / la encuesta / el
// snapshot llega al motor que lo espera con el valor correcto. Dos frentes:
//   (1) FLAGS por TEXTO: usa los textos EXACTOS de frozen-survey-texts.ts (no plausibles a mano),
//       positivo y negativo por flag. Si el fixture dijera "Insuficiencia renal" y la semilla dice
//       otra cosa, el candado survey-engine-coupling truena; aqui probamos que el frozen enciende el
//       flag con esa cadena exacta.
//   (2) RUTEO de campos BIS: el caso base usa valores DISTINTOS entre si (peso 89 / talla 180 / FFM
//       68.365) y esperados DERIVADOS A MANO, de modo que un swap (p. ej. peso<->talla, FMI<->FFMI)
//       cambia el resultado y el test truena.

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-06-22T00:00:00Z");
const MODEL = { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" };

// bisRaw como lo guarda B8 (header normalizado -> valor) desde la fila anonimizada del Biody.
function bisRawFromFixture(): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [k, v] of Object.entries(biodyJson as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) raw[normalizeHeader(k)] = v;
  }
  return raw;
}
const FIX = bisRawFromFixture();

function mkInput(surveyAnswers: SurveyFieldAnswer[]) {
  return buildEngineInput(
    { sex: "Male", birthDate: "1971-11-05", surveyAnswers, bisRaw: FIX }, // edad 54 al 2026-06-22
    MODEL,
    NOW,
  );
}
// output solo depende del BIS (indicadores/frSector), no de la encuesta; se computa una vez.
const OUTPUT = runEngine(mkInput([]));
const run = (surveyAnswers: SurveyFieldAnswer[]) => {
  const s = computeProtocolo(mkInput(surveyAnswers), OUTPUT);
  if (!s) throw new Error("computeProtocolo devolvio null con inputs validos");
  return s;
};

const d5_39 = (arr: string[]): SurveyFieldAnswer[] => [
  { fieldKey: "d5_39", type: "opcion_multiple", value: JSON.stringify(arr) },
];
const d5_36 = (v: string): SurveyFieldAnswer[] => [{ fieldKey: "d5_36", type: "opcion", value: v }];
const N = (arr: { nombre: string }[]) => arr.map((x) => x.nombre);

// Textos EXACTOS del contrato encuesta<->ciencia (no escritos a mano aqui).
const TXT_IRC = PROTOCOL_FLAG_TEXTS.find((m) => m.flag === "tieneIRC")!.optionText; // "Insuficiencia renal"
const TXT_CANCER = PROTOCOL_FLAG_TEXTS.find((m) => m.flag === "tieneCancer")!.optionText; // "Cáncer (activo)"
const TXT_CANCER_REM = PROTOCOL_FLAG_TEXTS.find(
  (m) => m.flag === "tieneCancer" && m.optionText.includes("remisión"),
)!.optionText; // "Cáncer (en remisión)"
const TXT_DM = PROTOCOL_FLAG_TEXTS.find((m) => m.flag === "tieneDM")!.optionText; // "Diabetes tipo 2"
const TXT_HTA = PROTOCOL_FLAG_TEXTS.find((m) => m.flag === "tieneHTA")!.optionText; // "Sí"

describe("GOLDEN orquestador: mapeo BIS -> motores (caso base, valores distintos, derivados a mano)", () => {
  const o = run([]); // sin flags: fenotipo/estrategia salen solo del BIS del fixture (male 89/180)

  it("clasifica F5 (alto_preclinico_normal) desde FMI/FFMI/MCA del snapshot, sin swap", () => {
    // FMI 6.369 (>6.0) + MCA 42.89>=41.967 -> alto_preclinico; FFMI 21.1 (<=21.59) -> normal -> F5.
    expect(o.fenotipo.id).toBe("F5");
    expect(o.obesidadSarcopenica).toBe(false);
  });

  it("motorProtocolo: +300 (F5), protMin 0.8, pesoCalculo ajustado (obesidad) = 76.625", () => {
    expect(o.estrategia.deficit).toBe(300);
    expect([o.protMin, o.protMax]).toEqual([0.8, 1.2]);
    // PI(M,180)=180-100-(30/4)=72.5; pesoCalculo=72.5+0.25*(89-72.5)=76.625 (imc 27.469>25).
    expect(o.pesoCalculo).toBeCloseTo(76.625, 3);
    expect(o.pesoCalculoLabel).toContain("obesidad");
  });

  it("cadena calorica Cunningham (FFM 68.365>0): gebAuto 2004 -> GET 2756 -> kcalObj 2456", () => {
    expect(o.calorico.formula).toBe("Cunningham");
    expect(o.calorico.gebAuto).toBe(2004); // round(500+22*68.365)=round(2004.03)
    expect(o.calorico.geb).toBe(2004);
    expect(o.calorico.pal).toBe(1.375);
    expect(o.calorico.get).toBe(2756); // round(2004*1.375)=round(2755.5)
    expect(o.calorico.kcalObj).toBe(2456); // max(1000, round(2756-300))
    expect(o.calorico.protG).toBe(61); // round(0.8*76.625)=round(61.3)
    expect(o.calorico.fatG).toBe(82); // round(round(2456*0.3)/9)=round(737/9)
    expect(o.calorico.choG).toBe(369); // round((2456-244-737)/4)=round(1475/4)
    expect(o.calorico.choPct).toBe(60); // round(1475/2456*100)
  });

  it("sella la version del protocolo y marca los defaults con la afirmacion de propagacion", () => {
    expect(o.protocolEngineVersion).toBe("anibise-protocolo-1.0.0");
    expect(o.calorico.defaults).toEqual(["pal", "fatPct"]);
    expect(o._nota).toContain("provisional");
    expect(o._nota).toContain("protocol_approved");
  });

  it("sin encuesta, ningun flag clinico se enciende", () => {
    expect(o.flags).toEqual({ tieneIRC: false, tieneCancer: false, tieneDM: false, tieneHTA: false });
  });
});

describe("GOLDEN orquestador: flags clinicos desde el TEXTO exacto de encuesta (positivo + negativo)", () => {
  it("IRC ON con 'Insuficiencia renal': tieneIRC, protMin 0.6/0.8, peso actual, restr renales", () => {
    const o = run(d5_39([TXT_IRC]));
    expect(o.flags.tieneIRC).toBe(true);
    expect([o.protMin, o.protMax]).toEqual([0.6, 0.8]);
    expect(o.pesoCalculo).toBe(89); // IRC -> peso actual (no ajustado)
    expect(N(o.restricciones)).toEqual(expect.arrayContaining(["Proteína", "Fósforo", "Potasio"]));
  });
  it("IRC OFF con otro diagnostico: tieneIRC=false, protMin vuelve a 0.8", () => {
    const o = run(d5_39([TXT_DM]));
    expect(o.flags.tieneIRC).toBe(false);
    expect(o.protMin).toBe(0.8);
  });

  it("cancer ON con 'Cáncer (activo)': tieneCancer, estrategia -300, protMin 1.5", () => {
    const o = run(d5_39([TXT_CANCER]));
    expect(o.flags.tieneCancer).toBe(true);
    expect(o.estrategia.deficit).toBe(-300);
    expect(o.protMin).toBe(1.5);
  });
  it("cancer EN REMISION dispara el MISMO +300 que activo (consecuencia del substring, a consulta)", () => {
    const o = run(d5_39([TXT_CANCER_REM]));
    expect(o.flags.tieneCancer).toBe(true);
    expect(o.estrategia.deficit).toBe(-300);
  });
  it("cancer OFF con 'Insuficiencia renal': tieneCancer=false", () => {
    expect(run(d5_39([TXT_IRC])).flags.tieneCancer).toBe(false);
  });

  it("DM ON con 'Diabetes tipo 2': tieneDM, restriccion CHO simples", () => {
    const o = run(d5_39([TXT_DM]));
    expect(o.flags.tieneDM).toBe(true);
    expect(N(o.restricciones)).toContain("CHO simples");
  });
  it("DM OFF con lista vacia: tieneDM=false", () => {
    expect(run(d5_39([])).flags.tieneDM).toBe(false);
  });

  it("HTA ON con d5_36='Sí': tieneHTA, restriccion Sodio", () => {
    const o = run(d5_36(TXT_HTA));
    expect(o.flags.tieneHTA).toBe(true);
    expect(N(o.restricciones)).toContain("Sodio");
  });
  it("HTA OFF con d5_36='No': tieneHTA=false, sin restriccion Sodio", () => {
    const o = run(d5_36("No"));
    expect(o.flags.tieneHTA).toBe(false);
    expect(N(o.restricciones)).not.toContain("Sodio");
  });
});
