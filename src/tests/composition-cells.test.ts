import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildComposition } from "@/modules/diagnoses/data/composition-map";
import {
  computeRefPob,
  type RefPobEntry,
  wangRowDx,
} from "@/modules/diagnoses/data/composition-display";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO de las 3 celdas DERIVABLES de la tabla de Wang (Referencia · Δ · Diagnostico).
//
// Contexto (leccion dato-a-mano-junto-al-que-lo-contiene-diverge): la Referencia se escribia a mano
// por fila mientras el CLASIFICADOR de esa fila ya sabia su rango. Con 40 filas era cuestion de tiempo
// que varias clasificaran bien y dejaran Referencia (o Δ) en guion. Se reporto "completo" TRES veces y
// seguian celdas vacias. El fix: fuente unica por fila (wangRowDx expone {dx, referenceLabel, cut}).
//
// Este candado prueba que TODA fila con clasificador cubre las 3 celdas: si alguien vuelve a dejar una
// derivable sin fuente, aqui cae (no en el smoke humano). Dos angulos:
//   A. estatico: cada clasificador expone rango + diagnostico + Δ para un valor en rango.
//   B. pipeline real: sobre la composicion del fixture, ninguna fila con datos queda sin las 3 celdas.
// ══════════════════════════════════════════════════════════════════════════════════════════════

const fmt = (v: number | null, dec = 2): string =>
  v == null ? "-" : Number.isInteger(v) ? String(v) : v.toFixed(dec);

// Δ derivable = hay un corte numerico (valor − cut) O un texto de Δ (NHLBI) O la fila es un perfil sin
// Δ numerico pero con texto en Valor (Mapa AFxIR).
const deltaDerivable = (w: { cut: number | null; deltaText?: string; valueText?: string }): boolean =>
  w.cut != null || w.deltaText != null || w.valueText != null;

describe("A. cada clasificador de la tabla de Wang expone Referencia + Diagnostico + Δ (fuente unica)", () => {
  const ctx = { imc: 27, cintura: 100, af: 6.8, ir: 0.7 };
  // Un valor EN RANGO por fila + effRef para las filas valor-vs-referencia (MCA/ECW/TBW/FFW...). Las demas
  // ignoran effRef. Si se agrega una fila con clasificador a wangRowDx, se agrega aca (o el candado no la ve).
  const CASOS: Array<{ key: string; value: number | null; effRef: number | null }> = [
    { key: "imc", value: 27, effRef: null },
    { key: "cintura", value: 100, effRef: null },
    { key: "icc", value: 0.95, effRef: null },
    { key: "ict", value: 0.55, effRef: null },
    { key: "nhlbi", value: null, effRef: null },
    { key: "FFMI", value: 19, effRef: null },
    { key: "asmi", value: 8, effRef: null },
    { key: "smmW", value: 30, effRef: null },
    { key: "MCA", value: 20, effRef: 19 },
    { key: "solEC", value: 5, effRef: 5 },
    { key: "masaSeca", value: 10, effRef: 10 },
    { key: "aec_mca", value: 0.4, effRef: null },
    { key: "ECW", value: 18, effRef: 18 },
    { key: "ICW", value: 26, effRef: 26 },
    { key: "ECW_sg", value: 17, effRef: 17 },
    { key: "ICW_sg", value: 27, effRef: 27 },
    { key: "TBW", value: 45, effRef: 45 },
    { key: "FFW", value: 42, effRef: 42 },
    { key: "ECW_pct", value: 38, effRef: null },
    { key: "ECW_sg_pct", value: 38, effRef: null },
    { key: "ICW_pct", value: 62, effRef: null },
    { key: "ICW_sg_pct", value: 62, effRef: null },
    { key: "ei", value: 0.38, effRef: null },
    { key: "ei_sg", value: 0.38, effRef: null },
    { key: "AF", value: 6.8, effRef: null },
    { key: "IR", value: 0.7, effRef: null },
    { key: "psc", value: null, effRef: null },
    { key: "hidSG", value: 74, effRef: null },
    { key: "act_mlg", value: 72, effRef: null },
    { key: "FM_pct", value: 15, effRef: null },
    { key: "CMO", value: 3, effRef: 3 },
    { key: "protTotal", value: 10, effRef: 10 },
    { key: "protActiva", value: 8, effRef: 8 },
  ];

  for (const c of CASOS) {
    it(`${c.key}: referencia + diagnostico + Δ presentes`, () => {
      const w = wangRowDx(c.key, c.value, true, ctx, c.effRef, fmt);
      expect(w, `wangRowDx no reconoce la fila ${c.key}`).not.toBeNull();
      if (!w) return;
      // Celda 1: Referencia. Siempre un texto; y para todo lo que no sea el perfil AFxIR (sin referencia
      // numerica), distinta de "—".
      expect(w.referenceLabel.length).toBeGreaterThan(0);
      if (c.key !== "psc") expect(w.referenceLabel).not.toBe("—");
      // Celda 2: Diagnostico. Con la entrada disponible (valor en rango o ctx para nhlbi/psc) debe clasificar.
      expect(w.dx, `${c.key} sin diagnostico con valor en rango`).not.toBeNull();
      // Celda 3: Δ derivable.
      expect(deltaDerivable(w), `${c.key} sin Δ derivable`).toBe(true);
    });
  }
});

describe("B. pipeline real: ninguna fila con clasificador y datos queda sin las 3 celdas", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/clinical-engine/biody-juan-esteban-anon.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const raw: Record<string, number> = {};
  for (const [k, v] of Object.entries(fixture)) {
    if (typeof v === "number") raw[normalizeHeader(k)] = v;
  }
  const sexoM = true;
  const comp = buildComposition(raw, null);
  const rows = comp.levels.flatMap((l) => l.rows);

  // Misma resolucion de referencia efectiva que composition-section (equipo, o REF_POB si el equipo no la trajo).
  const refMap: Record<string, number | null> = {};
  for (const r of rows) if (r.refKey) refMap[r.refKey] = r.reference;
  const refPob: Record<string, RefPobEntry> = computeRefPob(
    comp.peso,
    comp.talla,
    sexoM,
    (k) => refMap[k] ?? null,
  );
  const valueOf = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
  const ctx = { imc: comp.imc, cintura: comp.cintura, af: valueOf("AF"), ir: valueOf("IR") };

  it("toda fila-clasificador con la entrada disponible expone referencia, diagnostico y Δ", () => {
    const holes: string[] = [];
    for (const r of rows) {
      const refPobEntry = r.reference == null && r.refKey ? refPob[r.refKey] : undefined;
      const effRef = r.reference ?? refPobEntry?.value ?? null;
      const w = wangRowDx(r.key, r.value, sexoM, ctx, effRef, fmt);
      if (!w) continue; // fila cruda de masa (sin clasificador): referencia del equipo, sin diagnostico. OK.
      // Celda 1: referencia SIEMPRE (es el rango normativo, no depende del dato).
      if (!(w.referenceLabel.length > 0)) holes.push(`${r.key}: sin referencia`);
      // ¿Estan disponibles las entradas que necesita el diagnostico de esta fila?
      const inputOk =
        r.key === "nhlbi"
          ? ctx.imc != null
          : r.key === "psc"
            ? ctx.af != null && ctx.ir != null
            : r.value != null &&
              // las filas valor-vs-referencia necesitan ademas la referencia efectiva
              (["MCA", "solEC", "masaSeca", "CMO", "protTotal", "protActiva", "ECW", "ICW", "ECW_sg", "ICW_sg", "TBW", "FFW"].includes(r.key)
                ? effRef != null
                : true);
      if (!inputOk) continue; // el dato genuinamente no vino: ausencia, no hueco (no se inventa diagnostico).
      // Celda 2: diagnostico.
      if (w.dx == null) holes.push(`${r.key}: valor+referencia pero sin diagnostico`);
      // Celda 3: Δ.
      if (!deltaDerivable(w)) holes.push(`${r.key}: valor+referencia pero sin Δ`);
    }
    expect(holes, `celdas derivables vacias: ${holes.join(" · ")}`).toEqual([]);
  });
});
