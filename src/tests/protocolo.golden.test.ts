import { describe, expect, it, vi } from "vitest";

import { computeProtocolo, computeProtocoloEfectivo, runEngine } from "@/clinical-engine";
import { PROTOCOL_ENGINE_VERSION } from "@/clinical-engine/version";
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
    { sex: "M", birthDate: "1971-11-05", surveyAnswers, expectedFieldKeys: ["d2_19"], bisRaw: FIX, gripStrengthKg: null }, // edad 54 al 2026-06-22
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

  it("motorProtocolo: deficit 0 + perfil preclínica (punto 6), protMin 0.8, pesoCalculo ajustado (obesidad) = 76.625", () => {
    // Punto 6 (archivo del 18, 2026-08-19): el sistema ya no deriva el objetivo; deficit 0, orientacion en perfil.
    expect(o.estrategia.deficit).toBe(0);
    expect(o.estrategia.perfil).toContain("preclínica");
    expect([o.protMin, o.protMax]).toEqual([0.8, 1.2]);
    // PI(M,180)=180-100-(30/4)=72.5; pesoCalculo=72.5+0.25*(89-72.5)=76.625 (imc 27.469>25).
    expect(o.pesoCalculo).toBeCloseTo(76.625, 3);
    expect(o.pesoCalculoLabel).toContain("obesidad");
  });

  it("cadena calorica Harris-Benedict: gebAuto 1656 -> GET 2277 -> kcalObj 2277 (deficit 0, punto 6)", () => {
    // LAS CIFRAS SE MOVIERON CON LA FORMULA (2026-09-02, su §9.6), la estructura no. Antes era
    // `500 + 22 x FFM` rotulado "Cunningham", que el acaba de declarar que NO es Cunningham y que ademas
    // no salia de su cadena del nutricionista sino del bloque del medico, que en su archivo esta
    // desactivado. Ahora es Harris-Benedict sobre el peso efectivo, que es la formula del PROPIO EQUIPO.
    //
    // Punto 6: con deficit 0, el objetivo SUGERIDO queda en mantenimiento (kcalObj = GET). El profesional
    // fija el deficit real via computeProtocoloEfectivo (pesoMeta/pal). Los macros recalculan sobre GET.
    expect(o.calorico.formula).toBe("Harris-Benedict");
    // round(66.473 + 13.7516*76.625 + 5.0033*180 - 6.755*54)
    expect(o.calorico.gebAuto).toBe(
      Math.round(66.473 + 13.7516 * 76.625 + 5.0033 * 180 - 6.755 * 54),
    );
    expect(o.calorico.geb).toBe(o.calorico.gebAuto);
    expect(o.calorico.pal).toBe(1.375);
    expect(o.calorico.get).toBe(Math.round(o.calorico.gebAuto * 1.375));
    expect(o.calorico.kcalObj).toBe(o.calorico.get); // max(1000, round(GET - 0))
    expect(o.calorico.protG).toBe(61); // round(0.8*76.625)=round(61.3); no depende del GEB
    // Y LA COHERENCIA DEL REPARTO, que es lo que de verdad hay que proteger cuando las cifras se mueven:
    // los tres macros tienen que sumar el objetivo.
    const suma = o.calorico.protG * 4 + o.calorico.fatG * 9 + o.calorico.choG * 4;
    expect(Math.abs(suma - o.calorico.kcalObj)).toBeLessThan(12);
    expect(o.calorico.fatPct).toBe(30);
  });

  // Tratamiento sub-tarea 2, cuidado (b): la vista previa EN VIVO del panel llama computeProtocoloEfectivo,
  // la MISMA funcion que el servidor sella al aprobar. Este test blinda que NO haya deriva: con cero ajustes
  // del profesional, la cadena efectiva reproduce EXACTO la cadena sellada por el modelo (si alguien
  // reimplementara el recompute en el cliente, o cambiara una, este test se cae). defaults es metadato del
  // snapshot (no lo produce computeProtocoloCalorico), se excluye de la comparacion.
  it("preview sin overrides == cadena sellada del modelo (misma funcion, sin deriva); y los ajustes cascadean", () => {
    const sinAjustes = computeProtocoloEfectivo(o, {
      geb: null,
      pal: null,
      kcalObj: null,
      protGkg: null,
      fatPct: null,
      deficit: null,
      pesoMeta: null,
    });
    // defaults es metadato del snapshot (no lo produce computeProtocoloCalorico); se excluye para comparar
    // solo la cadena numerica.
    const cadenaSellada: Record<string, unknown> = { ...o.calorico };
    delete cadenaSellada.defaults;
    expect(sinAjustes.calorico).toEqual(cadenaSellada);

    // Un ajuste real cascadea: subir el PAL sube el GET (y con el, el objetivo en mantenimiento).
    const conPal = computeProtocoloEfectivo(o, {
      geb: null,
      pal: 1.6,
      kcalObj: null,
      protGkg: null,
      fatPct: null,
      deficit: null,
      pesoMeta: null,
    });
    expect(conPal.calorico.get).toBeGreaterThan(o.calorico.get);
    // Fijar el objetivo a mano lo respeta (no lo re-deriva del GET).
    const conObj = computeProtocoloEfectivo(o, {
      geb: null,
      pal: null,
      kcalObj: 1800,
      protGkg: null,
      fatPct: null,
      deficit: null,
      pesoMeta: null,
    });
    expect(conObj.calorico.kcalObj).toBe(1800);
  });

  // Tratamiento sub-tarea 3, cuidado (a): el reparto de macros en kcal CUADRA con el objetivo, exacto, por
  // construccion (choKcal = kcalObj - protKcal - fatKcal). La pantalla afirma "= objetivo"; este test lo
  // blinda para que esa afirmacion no mienta. Y el borde: si proteina+grasa exceden el objetivo, choKcal se
  // clampea a 0 (sin margen para carbohidratos) y la suma pasa el objetivo (la pantalla lo avisa en rojo).
  it("macros: protKcal + fatKcal + choKcal == objetivo (exacto); y el borde de excedente deja choKcal en 0", () => {
    // Caso normal (macros del modelo): la suma es exacta.
    expect(o.calorico.protKcal + o.calorico.fatKcal + o.calorico.choKcal).toBe(o.calorico.kcalObj);

    // Borde: proteina 4 g/kg + grasa 90% exceden el objetivo -> carbohidratos sin margen (0), suma > objetivo.
    const excede = computeProtocoloEfectivo(o, {
      geb: null,
      pal: null,
      kcalObj: null,
      protGkg: 4,
      fatPct: 90,
      deficit: null,
      pesoMeta: null,
    }).calorico;
    expect(excede.choKcal).toBe(0);
    expect(excede.choG).toBe(0);
    expect(excede.protKcal + excede.fatKcal).toBeGreaterThan(excede.kcalObj);
  });

  it("sella la version del protocolo y marca los defaults con la afirmacion de propagacion", () => {
    // Se compara contra la CONSTANTE, no contra una copia de la cadena de hoy. Lo que este golden
    // afirma es que el protocolo SELLA su version, no cual es: decidir cuando sube es trabajo de
    // `protocol-version-lock.test.ts`, que hashea los artefactos y obliga a tomar la decision. Con la
    // cadena escrita a mano, cada bump legitimo ponia este test en rojo por la razon equivocada.
    expect(o.protocolEngineVersion).toBe(PROTOCOL_ENGINE_VERSION);
    expect(o.calorico.defaults).toEqual(["pal", "fatPct"]);
    expect(o._nota).toContain("provisional");
    expect(o._nota).toContain("protocol_approved");
  });

  it("sella los inputs de la cadena calorica (para recomputar el efectivo al aprobar)", () => {
    expect(o.caloricoInputs).toEqual({ ffm: 68.365, talla: 180, edad: 54, sexoM: true });
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

  it("cancer ON con 'Cáncer (activo)': tieneCancer, deficit 0 + perfil cáncer/desnutrición (punto 6), protMin 1.5", () => {
    const o = run(d5_39([TXT_CANCER]));
    expect(o.flags.tieneCancer).toBe(true);
    expect(o.estrategia.deficit).toBe(0);
    expect(o.estrategia.perfil).toContain("cáncer o desnutrición");
    expect(o.protMin).toBe(1.5);
  });
  it("cancer EN REMISION dispara el MISMO perfil que activo (consecuencia del substring, a consulta)", () => {
    const o = run(d5_39([TXT_CANCER_REM]));
    expect(o.flags.tieneCancer).toBe(true);
    expect(o.estrategia.deficit).toBe(0);
    expect(o.estrategia.perfil).toContain("cáncer o desnutrición");
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

describe("GOLDEN orquestador: set EFECTIVO al aprobar (computeProtocoloEfectivo)", () => {
  const sug = run([]); // sugerido base (F5, sin flags)
  const nada = { geb: null, pal: null, kcalObj: null, protGkg: null, fatPct: null, deficit: null, pesoMeta: null };

  it("sin ajustes: el efectivo reproduce el sugerido (mismos inputs y defaults)", () => {
    const ef = computeProtocoloEfectivo(sug, nada);
    expect(ef.pesoEfectivo).toBeCloseTo(76.625, 3);
    // Harris-Benedict sobre el peso efectivo (2026-09-02). Se escribe la formula y no la cifra: una cifra
    // pegada no dice si el que la cambio entendio que cambiaba.
    expect(ef.calorico.gebAuto).toBe(Math.round(66.473 + 13.7516 * 76.625 + 5.0033 * 180 - 6.755 * 54));
    expect(ef.calorico.get).toBe(Math.round(ef.calorico.gebAuto * 1.375));
    expect(ef.calorico.kcalObj).toBe(ef.calorico.get); // deficit 0 (punto 6): sugerido = mantenimiento
    expect(ef.calorico.protG).toBe(61);
  });

  it("con peso meta y PAL ajustados: RE-CORRE la cadena completa (no sustituye)", () => {
    const ef = computeProtocoloEfectivo(sug, { ...nada, pal: 1.55, pesoMeta: 80 });
    expect(ef.pesoEfectivo).toBe(80);
    // Y AHORA EL GEB SI SE MUEVE CON EL PESO META, que antes no: Harris-Benedict lo usa y el
    // `500 + 22 x FFM` no. Es la consecuencia clinica del cambio de formula y por eso va con caso propio:
    // fijar el peso meta ahora mueve el gasto, no solo los gramos de proteina.
    expect(ef.calorico.gebAuto).toBe(Math.round(66.473 + 13.7516 * 80 + 5.0033 * 180 - 6.755 * 54));
    expect(ef.calorico.gebAuto).not.toBe(Math.round(66.473 + 13.7516 * 76.625 + 5.0033 * 180 - 6.755 * 54));
    expect(ef.calorico.get).toBe(Math.round(ef.calorico.gebAuto * 1.55));
    expect(ef.calorico.kcalObj).toBe(ef.calorico.get); // deficit 0 (punto 6)
    expect(ef.calorico.protG).toBe(64); // round(0.8*80), protMin sin cambiar
  });
});
