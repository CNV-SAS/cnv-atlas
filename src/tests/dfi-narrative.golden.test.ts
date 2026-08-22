import { describe, expect, it, vi } from "vitest";

import { runEngine } from "@/clinical-engine";
import {
  dfiCategoriesFromOutput,
  dfiNarrative,
  dfiNarrativeFromOutput,
  type DfiNarrativeInput,
} from "@/clinical-engine/dfi-narrative";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { buildEngineInput } from "@/modules/clinical-pipeline/services/build-engine-input";

// GOLDEN DIFERENCIAL de la narrativa del DFI (parrafo + metas), pieza 1a.1.
//
// El modulo `dfi-narrative` reconstruye parrafo/metas que el frozen `engine.dfi` dejo sin portar. Este golden
// prueba la PARIDAD contra la PROPIA FUNCION de Gildardo ejecutandose (computeDFI), no contra una lectura del
// codigo ni un texto leido de una captura: se corre el reference y se asserta byte-identico.
//
// REFERENCIA VIGENTE (cuidado a): NO se usa el atlas-dfi.js de la carpeta gildardo-2026-07 (es del 07-23,
// ciencia vieja, y ademas su extracto NO define _DFI_RISK, con lo que la rama de veto ni siquiera corre). Se
// usa `fixtures/reference/dfi-vigente.js`, extraido VERBATIM del ATLAS_v8.html vigente (2026-08-19, L12863-13010).
// computeDFI lee idx.*.l directo (sin clasificadores externos), asi que el extracto es self-contained y redacta
// sobre ciencia vigente.
//
// APPLES-TO-APPLES: el idx que se le pasa al reference se arma con las categorias del vocabulario INTERNO del
// frozen (parseadas de sus cadenas de dominio via dfiCategoriesFromOutput), NO con o.classifications (otro
// vocabulario). Asi el reference recomputa las MISMAS severidades que el frozen y la comparacion de narrativa
// es valida. El test lo verifica explicitamente (assert (1)).

vi.mock("server-only", () => ({}));

import { computeDFI as refComputeDFI } from "./fixtures/reference/dfi-vigente.js";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

const NOW = new Date("2026-06-22T00:00:00Z");
const MODEL = { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" };

function bisRawFromFixture(): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [k, v] of Object.entries(biodyJson as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) raw[normalizeHeader(k)] = v;
  }
  return raw;
}

type RefIdx = Record<string, unknown>;
type RefDfi = {
  domains: { id: string; sev: number; veto?: boolean }[];
  riesgo: { l: string };
  veto: boolean;
  parrafo: string;
  metas: { nutricion: string; medicina: string; ejercicio: string; psicologia: string };
};

const o = runEngine(
  buildEngineInput(
    { sex: "M", birthDate: "1971-11-05", surveyAnswers: [], expectedFieldKeys: ["d2_19"], bisRaw: bisRawFromFixture() },
    MODEL,
    NOW,
  ),
);

// idx para el reference, con las categorias del vocabulario del frozen (mismo origen que el adaptador de la app).
function refIdx(): RefIdx {
  const cat = dfiCategoriesFromOutput(o);
  return {
    ifc: o.indicators.ifc,
    irc: o.indicators.irc,
    iehh: o.indicators.iehh,
    iscm: o.indicators.iscm,
    iae: o.indicators.iae,
    ebBis: o.indicators.eb,
    icaBis: o.indicators.icaBis,
    ifcCl: { l: cat.ifcL },
    ircCl: { l: cat.ircL },
    iehhCl: { l: cat.iehhL ?? "-" },
    iscmCl: { l: cat.iscmL ?? "-" },
    iaeCl: { l: cat.aeL ?? "-" },
    structL: cat.fen,
  };
}

function inputFromRef(ref: RefDfi, idx: RefIdx): DfiNarrativeInput {
  const sevOf = (id: string) => ref.domains.find((d) => d.id === id)?.sev ?? 0;
  const dom4 = ref.domains.find((d) => d.id === "d4");
  const label = (x: unknown) => (x as { l?: string })?.l ?? null;
  return {
    domSev: { d1: sevOf("d1"), d2: sevOf("d2"), d3: sevOf("d3"), d4: sevOf("d4"), d5: sevOf("d5") },
    dom4Veto: Boolean(dom4?.veto),
    veto: ref.veto,
    nivelLabel: ref.riesgo.l,
    ifcL: label(idx.ifcCl) ?? "",
    ircL: label(idx.ircCl) ?? "",
    iehhL: label(idx.iehhCl),
    iscmL: label(idx.iscmCl),
    fen: (idx.structL as string) ?? "",
    aeL: label(idx.iaeCl),
    iae: (idx.iae as number | null) ?? null,
  };
}

describe("DFI narrativa: golden diferencial contra la funcion vigente de Gildardo", () => {
  it("A · fixture real: reference y frozen coinciden en severidades, y la narrativa es byte-identica", () => {
    const idx = refIdx();
    const ref = refComputeDFI({
      idx,
      dv: { fmi: o.indicators.FMI, ffmi: o.indicators.FFMI },
      pt: { edad: 54 },
      icec: { total: o.dfi.le8Total, cl: { l: "-" } },
      perc: {},
      soc: {},
      epi: {},
    }) as RefDfi;

    // (1) apples-to-apples: el reference (redactando sobre las categorias del frozen) produce las MISMAS
    // severidades que el frozen. Si divergen, la comparacion de narrativa no seria valida (otra ciencia).
    expect(ref.domains.map((d) => `${d.id}:${d.sev}`)).toEqual(o.dfi.domains.map((d) => `${d.id}:${d.sev}`));

    // (2) el porte reproduce byte-a-byte el parrafo y las cuatro metas del reference.
    const mine = dfiNarrativeFromOutput(o);
    expect(mine.parrafo).toBe(ref.parrafo);
    expect(mine.metas).toEqual(ref.metas);
  });

  it("B · rama de veto conductual: la rama SE EJECUTA (ref.veto true) y la narrativa coincide", () => {
    // Fuerza el veto por conducta: metodos compensatorios (tokens de _DFI_RISK) + perdida de control. Enciende
    // dom4.veto -> _acts R3 pr 0 (critica) y la rama especial de _metaDe (nutricion sin restriccion). Se arma
    // idx desde el fixture y se le agrega la percepcion de riesgo, sin depender de una captura de este escenario.
    const idx = refIdx();
    const ref = refComputeDFI({
      idx,
      dv: { fmi: o.indicators.FMI, ffmi: o.indicators.FFMI },
      pt: { edad: 54 },
      icec: { total: null, cl: { l: "-" } },
      perc: { bodyImage: "muy_delgado", methods: ["vomito", "laxantes"], lossControl: "frecuente", satisfaction: "muy_insatisfecho" },
      soc: {},
      epi: {},
    }) as RefDfi;

    // cuidado (b): la rama de veto realmente se enciende. Si no, el caso no cubriria lo que queremos.
    expect(ref.veto).toBe(true);
    expect(ref.metas.nutricion).toContain("sin restricción ni control del peso");

    const mine = dfiNarrative(inputFromRef(ref, idx));
    expect(mine.parrafo).toBe(ref.parrafo);
    expect(mine.metas).toEqual(ref.metas);
  });
});
