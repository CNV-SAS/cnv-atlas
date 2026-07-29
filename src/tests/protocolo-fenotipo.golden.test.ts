import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseBiodyRow } from "@/clinical-engine/edge/biody-import";
import { classifyFenotipo, type FenotipoInput } from "@/clinical-engine/protocolo-fenotipo";

import { classifyVerbatim } from "./fixtures/clinical-engine/fenotipo-harness.mjs";

// GOLDEN A3.4: la transcripcion TS del clasificador (protocolo-fenotipo.ts) contra el harness Via C
// (los BYTES verbatim de ATLAS.html, protegidos por frozen-fenotipo-diff.test.ts). Regla de
// discrepancia: si TS != harness, gana el harness (es la ciencia de Gildardo) y se corrige la
// transcripcion.
//
// Cubre a proposito: (1) LOS BORDES de los 9 umbrales (8 bandas FMI/FFMI por sexo + MCA_ok), cada
// uno justo por debajo / EXACTO / justo por encima, con incremento 0.01 (no epsilon de punto
// flotante) para que un `<` transcrito como `<=` salte solo. (2) Los 12 fenotipos, comparando el
// objeto Fenotipo COMPLETO (id+nombre+riesgo+color) TS==harness, con lo que la tabla verbatim
// queda verificada campo por campo. (3) obesidadSarcopenica en sus ramas, incluida la de
// dxSarcopenia con prensil > 0 (aunque en Atlas la prensil siempre entra en fallback, ver la
// brecha declarada en protocolo-fenotipo.ts).

function runHarness(i: FenotipoInput) {
  const bis = {
    FMI: i.FMI, FFMI: i.FFMI, MCA: i.MCA, MCA_ref: i.MCA_ref,
    smmW: i.smmW, ASMI: i.ASMI, AF: i.AF, fuerzaPrensil: i.fuerzaPrensil,
  };
  const r = classifyVerbatim(bis, {}, i.sexoM);
  return {
    nivelFMI: r.nivelFMI, nivelFFMI: r.nivelFFMI, MCA_ok: r.MCA_ok, fenotipo: r.fenotipo,
    sarcopenia: r.sarcopenia, asmiLow: r.asmiLow, obesidadSarcopenica: r.obesidadSarcopenica,
  };
}
function runTs(i: FenotipoInput) {
  const r = classifyFenotipo(i);
  return {
    nivelFMI: r.nivelFMI, nivelFFMI: r.nivelFFMI, MCA_ok: r.MCA_ok, fenotipo: r.fenotipo,
    sarcopenia: r.sarcopenia, asmiLow: r.asmiLow, obesidadSarcopenica: r.obesidadSarcopenica,
  };
}

// Base con MCA_ok=true (MCA>=MCA_ref) para aislar las bandas de FMI/FFMI.
const base = (sexoM: boolean): FenotipoInput => ({
  FMI: 5, FFMI: 18, MCA: 40, MCA_ref: 38, smmW: 40, ASMI: 8, AF: 7, sexoM,
});

const D = 0.01; // incremento distinguible (no epsilon binario)

type Caso = { label: string; in: FenotipoInput };

// 8 umbrales de banda (FMI 3.5/6.0 H, 5.0/9.0 M; FFMI 17.92/21.59 H, 15.64/19.34 M), 3 casos c/u.
function bordesBanda(field: "FMI" | "FFMI", sexoM: boolean, thr: number): Caso[] {
  const s = sexoM ? "H" : "M";
  return [
    { label: `${field} ${s} ${thr} -${D}`, in: { ...base(sexoM), [field]: thr - D } },
    { label: `${field} ${s} ${thr} exacto`, in: { ...base(sexoM), [field]: thr } },
    { label: `${field} ${s} ${thr} +${D}`, in: { ...base(sexoM), [field]: thr + D } },
  ];
}

const BORDES: Caso[] = [
  ...bordesBanda("FMI", true, 3.5), ...bordesBanda("FMI", true, 6.0),
  ...bordesBanda("FMI", false, 5.0), ...bordesBanda("FMI", false, 9.0),
  ...bordesBanda("FFMI", true, 17.92), ...bordesBanda("FFMI", true, 21.59),
  ...bordesBanda("FFMI", false, 15.64), ...bordesBanda("FFMI", false, 19.34),
];

// 9no umbral: MCA_ok = MCA >= MCA_ref. FMI en zona alta (7 > 6.0 H) para que MCA_ok parta
// alto_clinico vs alto_preclinico.
const REF = 38;
const BORDES_MCA: Caso[] = [
  { label: `MCA_ok H ${REF} -${D} (alto_clinico)`, in: { ...base(true), FMI: 7, MCA: REF - D, MCA_ref: REF } },
  { label: `MCA_ok H ${REF} exacto (alto_preclinico)`, in: { ...base(true), FMI: 7, MCA: REF, MCA_ref: REF } },
  { label: `MCA_ok H ${REF} +${D}`, in: { ...base(true), FMI: 7, MCA: REF + D, MCA_ref: REF } },
];

// 12 fenotipos: una entrada por cada clave nivelFMI_nivelFFMI. Zona alta con MCA_ok controlado.
const altoClinico = { FMI: 8, MCA: 37, MCA_ref: 38 }; // >6.0 y MCA_ok=false
const altoPrecl = { FMI: 8, MCA: 40, MCA_ref: 38 }; // >6.0 y MCA_ok=true
const ffmiBajo = 16, ffmiNormal = 20, ffmiAlto = 23;
const FENOTIPOS: { id: string; in: FenotipoInput }[] = [
  { id: "F1", in: { ...base(true), ...altoClinico, FFMI: ffmiBajo } },
  { id: "F2", in: { ...base(true), ...altoClinico, FFMI: ffmiNormal } },
  { id: "F3", in: { ...base(true), ...altoClinico, FFMI: ffmiAlto } },
  { id: "F4", in: { ...base(true), ...altoPrecl, FFMI: ffmiBajo } },
  { id: "F5", in: { ...base(true), ...altoPrecl, FFMI: ffmiNormal } },
  { id: "F6", in: { ...base(true), ...altoPrecl, FFMI: ffmiAlto } },
  { id: "F7", in: { ...base(true), FMI: 5, FFMI: ffmiBajo } },
  { id: "F8", in: { ...base(true), FMI: 5, FFMI: ffmiNormal } },
  { id: "F9", in: { ...base(true), FMI: 2, FFMI: ffmiBajo } },
  { id: "F10", in: { ...base(true), FMI: 2, FFMI: ffmiNormal } },
  { id: "F11", in: { ...base(true), FMI: 2, FFMI: ffmiAlto } },
  { id: "F12", in: { ...base(true), FMI: 5, FFMI: ffmiAlto } },
];

describe("GOLDEN A3.4: bandas (bordes) TS == harness Via C", () => {
  for (const c of [...BORDES, ...BORDES_MCA]) {
    it(`${c.label}: TS coincide con el harness`, () => {
      expect(runTs(c.in)).toEqual(runHarness(c.in));
    });
  }

  // Anclas de direccion del borde (< vs <=), por si TS y harness derivaran juntos (no pueden: el
  // harness es verbatim, pero documenta la intencion).
  it("el borde exacto respeta < vs <= (3.5->normal, 17.92->normal, MCA==ref->alto_preclinico)", () => {
    expect(classifyFenotipo({ ...base(true), FMI: 3.5 }).nivelFMI).toBe("normal"); // FMI<3.5 es false -> normal
    expect(classifyFenotipo({ ...base(true), FFMI: 17.92 }).nivelFFMI).toBe("normal"); // FFMI<17.92 es false -> normal
    expect(classifyFenotipo({ ...base(true), FMI: 7, MCA: 38, MCA_ref: 38 }).nivelFMI).toBe("alto_preclinico"); // MCA==ref -> MCA_ok
  });
});

describe("GOLDEN A3.4: los 12 fenotipos (objeto Fenotipo completo) TS == harness", () => {
  for (const f of FENOTIPOS) {
    it(`${f.id}: id, nombre, riesgo y color coinciden con el verbatim`, () => {
      const ts = runTs(f.in);
      expect(ts.fenotipo.id).toBe(f.id); // ancla la clave -> id esperado
      expect(ts).toEqual(runHarness(f.in)); // objeto completo == harness verbatim
    });
  }
});

describe("GOLDEN A3.4: obesidadSarcopenica en sus ramas TS == harness", () => {
  const casos: Caso[] = [
    // F1/F4 -> true por fenotipo (independiente de sarcopenia/asmiLow).
    { label: "F1 -> obSarco por fenotipo", in: { ...base(true), ...altoClinico, FFMI: ffmiBajo } },
    { label: "F4 -> obSarco por fenotipo", in: { ...base(true), ...altoPrecl, FFMI: ffmiBajo } },
    // No F1/F4, zona alta + sarcopenia por smmW bajo (H<27).
    { label: "F5 + smmW bajo -> obSarco", in: { ...base(true), ...altoPrecl, FFMI: ffmiNormal, smmW: 25 } },
    // No F1/F4, zona alta + asmiLow (ASMI<7 H).
    { label: "F5 + asmiLow -> obSarco", in: { ...base(true), ...altoPrecl, FFMI: ffmiNormal, ASMI: 6.5 } },
    // No F1/F4, sarcopenia pero nivelFMI normal (no zona alta) -> false.
    { label: "F8 + smmW bajo pero FMI normal -> NO obSarco", in: { ...base(true), FMI: 5, FFMI: ffmiNormal, smmW: 25 } },
    // dxSarcopenia con prensil > 0 (ejercita la funcion aunque Atlas nunca la alimenta):
    { label: "prensil bajo + ASMI bajo + AF bajo -> sarcoDx k=3", in: { ...base(true), ...altoPrecl, FFMI: ffmiNormal, smmW: 30, ASMI: 6, AF: 6, fuerzaPrensil: 20 } },
    { label: "prensil bajo + ASMI bajo + AF ok -> sarcoDx k=2", in: { ...base(true), ...altoPrecl, FFMI: ffmiNormal, smmW: 30, ASMI: 6, AF: 7, fuerzaPrensil: 20 } },
    { label: "prensil bajo + ASMI ok -> sarcoDx k=1 (no sarcopenia por k)", in: { ...base(true), FMI: 5, FFMI: ffmiNormal, smmW: 40, ASMI: 8, AF: 7, fuerzaPrensil: 20 } },
  ];
  for (const c of casos) {
    it(`${c.label}`, () => {
      expect(runTs(c.in)).toEqual(runHarness(c.in));
    });
  }
});

// AJUSTE 1c — TEST GRATIS: la derivacion (FMI/ASMI = X/talla^2) coincide con el valor REPORTADO por
// el equipo en el export. Existen DOS fuentes para el mismo dato y elegimos derivar (fidelidad a
// ATLAS.html:5660/5734, ver biody-import.ts). Si algun dia divergen (talla, columna o mapeo
// equivocado), este test cae: es la misma familia del bug de `cintura` (leia el umbral 102 en vez
// de la medida 98). Tolerancia 0.05: atrapa drift grueso, no el redondeo del ultimo decimal.
describe("Derivaciones FMI/ASMI == reportado por el equipo (guardia anti-mismapeo)", () => {
  const raw = JSON.parse(
    readFileSync("src/tests/fixtures/clinical-engine/biody-juan-esteban-anon.json", "utf8"),
  ) as Record<string, unknown>;
  const imp = parseBiodyRow(raw);

  it("FMI derivado coincide con la columna FMI reportada", () => {
    const fmiRep = raw["Indice de masa grasa (FMI) measurementDetails.VALEURCALCULEEEXPORT kg/m²"] as number;
    expect(imp.FMI).toBeCloseTo(fmiRep, 1);
  });

  it("ASMI derivado coincide con la columna ASMI reportada", () => {
    const asmiRep = raw[
      "Indice de masa muscular esquelética des membres (ASMI) measurementDetails.VALEURCALCULEEEXPORT kg/m²"
    ] as number;
    expect(imp.ASMI).toBeCloseTo(asmiRep, 1);
  });
});
