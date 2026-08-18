import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BIODY_COLUMNS } from "@/clinical-engine";
import {
  allCompositionRows,
  buildComposition,
  clasificarAecMca,
} from "@/modules/diagnoses/data/composition-map";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// Candado del mapeo de circunferencias. Un bug real (2026-07-24) hacia que `cintura` leyera la
// columna de UMBRAL de referencia ("Patient risk monitoring Waist Size ... referencia cm" = 102 cm,
// el corte OMS masculino) en vez de la MEDIDA ("Waist Size cm" = 98). Como el badge de riesgo CV se
// calcula sobre ese valor, cada hombre se comparaba contra su propio umbral (102 vs 102) -> "Riesgo
// CV elevado" SIEMPRE: falso positivo clinico sistematico. Este test lo ancla contra el export real.

// Crudos como los persiste el import: variable_name = normalizeHeader(header del export).
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

describe("buildComposition: mapeo de cintura/cadera (candado del falso positivo CV)", () => {
  const comp = buildComposition(raw, "2026-07-11T15:52:00+00:00");

  it("cintura lee la circunferencia MEDIDA (Waist Size cm = 98), no el umbral", () => {
    expect(comp.cintura).toBe(98);
    // Guarda explicita: NUNCA el umbral de referencia (102). Si alguien vuelve a apuntar el mapeo a
    // "Patient risk monitoring Waist Size ... referencia cm", este assert falla.
    expect(comp.cintura).not.toBe(102);
  });

  it("cadera lee la circunferencia MEDIDA (Hips Size cm = 105)", () => {
    expect(comp.cadera).toBe(105);
  });

  it("la fila Cintura de la tabla tambien usa la MEDIDA, no el umbral", () => {
    // Cintura CRUDA (cm) vive en la disposicion de Evaluacion (medido). En Diagnostico es "Circunferencia
    // de cintura" con clasificacion, misma clave/valor.
    const nivelV = comp.eval.find((l) => l.title.includes("Cuerpo entero"));
    const filaCintura = nivelV?.rows.find((r) => r.key === "cintura");
    expect(filaCintura?.value).toBe(98);
    expect(filaCintura?.value).not.toBe(102);
  });

  it("el umbral de referencia (102) SI esta en los crudos: el bug era de lectura, no de datos", () => {
    // Ambas columnas se persisten; el bug era elegir la de referencia. Documenta que 102 existe.
    expect(raw[normalizeHeader("Patient risk monitoring Waist Size  measurementDetails.REFERENCEESTIMEEEXPORT cm")]).toBe(102);
  });

  // Estos asserts NO prueban que Atlas calcule los ratios (no los calcula, los LEE del export).
  // Prueban que los ratios LEIDOS son coherentes con la cintura MEDIDA (98), no con el umbral (102):
  // 102/105=0.971 y 102/180=0.567 fallarian. Ancla anti-mismapeo, no de calculo (misma disciplina
  // que las brechas declaradas de GOLDEN 1).
  it("ICC/ICT leidos son coherentes con la cintura MEDIDA (98), no el umbral (102)", () => {
    expect(comp.icc).toBeCloseTo(98 / 105, 2); // 0.933
    expect(comp.ict).toBeCloseTo(98 / 180, 2); // 0.544
  });

  it("BIODY_COLUMNS ya no mapea cintura (candado de la trampa latente removida)", () => {
    // Su importarComposicion la mapea al umbral de referencia (verificado en ATLAS_v7.html:5617);
    // Atlas la deja fuera a proposito. Si alguien la re-agrega, este candado cae.
    expect(BIODY_COLUMNS.cintura).toBeUndefined();
  });

  // C12: AEC/MCA = ECW/MCA (ATLAS_v7.html:5696), fila de Nivel III con referencia = corte 0.45.
  it("AEC/MCA: ratio ECW/MCA desde los valores MEDIDOS (VALEURCALCULEE), no umbrales", () => {
    const ecw = raw[normalizeHeader(BIODY_COLUMNS.ECW.header)];
    const mca = raw[normalizeHeader(BIODY_COLUMNS.MCA.header)];
    expect(ecw).toBeGreaterThan(0);
    expect(mca).toBeGreaterThan(0);
    expect(comp.aecMca).toBeCloseTo(ecw / mca, 3);
    // AEC/MCA es una fila CLASIFICADA (radio con corte 0.45): vive en la disposicion de Diagnostico.
    const nivelIII = comp.diag.find((l) => l.title.includes("Celular"));
    const fila = nivelIII?.rows.find((r) => r.key === "aec_mca");
    expect(fila?.value).toBe(comp.aecMca);
    expect(fila?.reference).toBe(0.45); // corte, no referencia del dispositivo
    expect(fila?.referenceLabel).toBe("<0.45");
  });

  it("clasificarAecMca: cortes verbatim 0.45/0.55 (12734)", () => {
    expect(clasificarAecMca(0.4)?.label).toBe("Óptimo");
    expect(clasificarAecMca(0.5)?.label).toBe("Alerta"); // CA-2: valor 0.50 -> Alerta, Δ +0.05 (contra 0.45)
    expect(clasificarAecMca(0.6)?.label).toBe("Riesgo");
    expect(clasificarAecMca(0.45)?.label).toBe("Alerta"); // 0.45 no es < 0.45
    expect(clasificarAecMca(null)).toBeNull();
  });
});

// Candado de las dos disposiciones (reorg 2026-08-17). Ancla que las filas estan presentes, que cadera/FFW
// tienen su tratamiento especial, y que el bioelectrico crudo se REPARTE en su nivel (con icono) SOLO en
// Evaluacion, no en Diagnostico. Si un bump quita una fila o cruza las tablas, este test cae.
describe("buildComposition: disposiciones eval/diag y reparto del bioelectrico (reorg 2026-08-17)", () => {
  const comp = buildComposition(raw, null);
  const allRows = allCompositionRows(comp);
  const byKey = (k: string) => allRows.find((r) => r.key === k);
  const evalKeys = new Set(comp.eval.flatMap((l) => l.rows).map((r) => r.key));
  const diagKeys = new Set(comp.diag.flatMap((l) => l.rows).map((r) => r.key));

  it("Cadera es una fila del Nivel V (Evaluacion) con la circunferencia MEDIDA", () => {
    const nivelV = comp.eval.find((l) => l.title.includes("Cuerpo entero"));
    const cadera = nivelV?.rows.find((r) => r.key === "cadera");
    expect(cadera).toBeDefined();
    expect(cadera?.value).toBe(comp.cadera);
  });

  it("FFW: la referencia se computa FFW - FFW_dif (no hay columna _ref)", () => {
    const ffw = byKey("FFW");
    expect(ffw).toBeDefined();
    const ffwVal = raw[normalizeHeader(BIODY_COLUMNS.FFW.header)];
    const ffwDif = raw[normalizeHeader(BIODY_COLUMNS.FFW_dif.header)];
    if (ffwVal != null && ffwDif != null) {
      expect(ffw?.reference).toBeCloseTo(ffwVal - ffwDif, 5);
    }
  });

  it("el bioelectrico crudo se reparte en su nivel (impedancias en III, Cole-Cole en II) con icono, SOLO en Evaluacion", () => {
    const nivelIII = comp.eval.find((l) => l.title.includes("Celular"));
    const nivelII = comp.eval.find((l) => l.title.includes("Molecular"));
    const iiiKeys = (nivelIII?.rows ?? []).map((r) => r.key);
    const iiKeys = (nivelII?.rows ?? []).map((r) => r.key);
    // Impedancias -> Nivel III; Cole-Cole -> Nivel II (como los reparte Gildardo en el frozen).
    for (const k of ["R50", "Xc", "Z5", "Z50", "Z200"]) expect(iiiKeys).toContain(k);
    for (const k of ["Re", "Ri", "Rinf", "C", "Fo"]) expect(iiKeys).toContain(k);
    // Todos marcados como bioelectricos (llevan el icono de rayo).
    for (const k of ["R50", "Xc", "Z5", "Z50", "Z200", "Re", "Ri", "Rinf", "C", "Fo"]) {
      expect(byKey(k)?.bioelectric, `${k} debe llevar el icono bioelectrico`).toBe(true);
    }
    // NO existe un nivel "Bioeléctrico" aparte; y NINGUN crudo bioelectrico aparece en Diagnostico.
    expect(comp.eval.some((l) => l.title.startsWith("Bioeléctrico"))).toBe(false);
    for (const k of ["R50", "Xc", "Z5", "Z50", "Z200", "Re", "Ri", "Rinf", "C", "Fo"]) {
      expect(diagKeys.has(k), `${k} no debe estar en Diagnostico`).toBe(false);
    }
  });

  it("los indicadores CLASIFICADOS viven en Diagnostico, no en Evaluacion; los crudos al reves", () => {
    // Clasificados (indices): solo Diagnostico.
    for (const k of ["imc", "nhlbi", "icc", "ict", "FFMI", "FMI", "asmi", "smmW", "aec_mca", "ei", "ei_sg", "AF", "IR", "psc", "act_mlg"]) {
      expect(diagKeys.has(k), `${k} debe estar en Diagnostico`).toBe(true);
      expect(evalKeys.has(k), `${k} NO debe estar en Evaluacion`).toBe(false);
    }
    // Masas crudas del equipo y GEB/GET: solo Evaluacion.
    for (const k of ["peso", "talla", "GEB", "GET", "FM", "FFM", "SMM", "MMEM", "minNoOseo"]) {
      expect(evalKeys.has(k), `${k} debe estar en Evaluacion`).toBe(true);
      expect(diagKeys.has(k), `${k} NO debe estar en Diagnostico`).toBe(false);
    }
    // ASMI y E/I son valores COMPUTADOS (MMEM/talla^2, ECW/ICW): no salen "-" si el crudo esta.
    expect(typeof byKey("asmi")?.value).toBe("number");
    expect(typeof byKey("ei")?.value).toBe("number");
  });

  it("Grasa corporal total % (FM_pct) queda en Nivel IV de Diagnostico (Gildardo: no se duplica a Nivel II)", () => {
    const nivelIV = comp.diag.find((l) => l.title.includes("Tejidos"));
    expect((nivelIV?.rows ?? []).some((r) => r.key === "FM_pct")).toBe(true);
    const nivelII = comp.diag.find((l) => l.title.includes("Molecular"));
    expect((nivelII?.rows ?? []).some((r) => r.key === "FM_pct")).toBe(false);
  });

  it("AF e IR van DESPUES de los dos E/I en Nivel III de Diagnostico (orden del smoke l)", () => {
    const nivelIII = comp.diag.find((l) => l.title.includes("Celular"));
    const order = (nivelIII?.rows ?? []).map((r) => r.key);
    expect(order.indexOf("AF")).toBeGreaterThan(order.indexOf("ei_sg"));
    expect(order.indexOf("IR")).toBeGreaterThan(order.indexOf("ei_sg"));
    expect(order.indexOf("psc")).toBeGreaterThan(order.indexOf("IR")); // el mapa AFxIR, al final
  });

  it("nombres unificados: proteinas, CMO y MCA identicos en las dos tablas", () => {
    // Gildardo: mismo nombre para la misma fila en las dos tablas (no una version por tabla).
    for (const k of ["protTotal", "protActiva", "CMO", "MCA"]) {
      const inEval = comp.eval.flatMap((l) => l.rows).find((r) => r.key === k);
      const inDiag = comp.diag.flatMap((l) => l.rows).find((r) => r.key === k);
      expect(inEval?.label, `${k} presente en Evaluacion`).toBeDefined();
      expect(inEval?.label).toBe(inDiag?.label);
    }
    expect(byKey("CMO")?.label).toBe("CMO - Contenido mineral óseo");
    expect(byKey("protTotal")?.label).toBe("Proteína total");
    expect(byKey("protActiva")?.label).toBe("Proteína metabólica activa");
  });

  it("candado de unificacion: distingue nombre base divergente (mal) de sufijo explicativo (bien)", () => {
    // Gildardo: la misma fila lleva el mismo nombre BASE en las dos tablas. Diagnostico PUEDE añadir un
    // sufijo de lectura clinica ("- matriz colagena"); eso NO es divergencia. Lo prohibido es un nombre
    // base distinto. Regla: el rotulo mas corto es prefijo del mas largo (identico, o + " - <sufijo>").
    // Excepcion DELIBERADA (dos marcos, crudo vs clasificado, autorizada Gildardo): cintura y grasa % (FM_pct).
    const DOS_MARCOS = new Set(["cintura", "FM_pct"]);
    const evalByKey = new Map(comp.eval.flatMap((l) => l.rows).map((r) => [r.key, r.label] as const));
    const diagByKey = new Map(comp.diag.flatMap((l) => l.rows).map((r) => [r.key, r.label] as const));
    const bad: string[] = [];
    for (const [k, a] of evalByKey) {
      const b = diagByKey.get(k);
      if (b == null || DOS_MARCOS.has(k)) continue;
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      if (long !== short && !long.startsWith(short + " - ")) bad.push(`${k}: "${a}" vs "${b}"`);
    }
    expect(bad, `nombres base divergentes entre tablas: ${bad.join(" · ")}`).toEqual([]);
  });

  it("Diagnostico conserva el sufijo de lectura clinica que Evaluacion recorta (solEC/masaSeca)", () => {
    const evalLabel = (k: string) => comp.eval.flatMap((l) => l.rows).find((r) => r.key === k)?.label;
    const diagLabel = (k: string) => comp.diag.flatMap((l) => l.rows).find((r) => r.key === k)?.label;
    expect(evalLabel("solEC")).toBe("Sólidos extracelulares");
    expect(diagLabel("solEC")).toBe("Sólidos extracelulares - matriz colágena");
    expect(evalLabel("masaSeca")).toBe("Masa seca sin grasa");
    expect(diagLabel("masaSeca")).toBe("Masa seca sin grasa - ganancia real magra");
  });
});

// Candado de la construccion de los % sin grasa (smoke Santiago h/k, causa D). El equipo NO siempre trae
// ECW_sg_pct/ICW_sg_pct; se DERIVAN sobre la FFW (no sobre ACT), el denominador que fija la identidad
// confirmada por Gildardo (RESPUESTA 2026-08-15 §0) AEC_sg + AIC_sg = FFW, con la que los dos suman 100.
describe("buildComposition: % sin grasa derivados sobre FFW cuando el equipo no los trae (causa D)", () => {
  const h = (k: keyof typeof BIODY_COLUMNS) => normalizeHeader(BIODY_COLUMNS[k].header);
  // Copia del crudo SIN las columnas de % sin grasa: fuerza la derivacion.
  const rawSinPct: Record<string, number> = { ...raw };
  delete rawSinPct[h("ECW_sg_pct")];
  delete rawSinPct[h("ICW_sg_pct")];
  const comp = buildComposition(rawSinPct, null);
  const byKey = (k: string) => allCompositionRows(comp).find((r) => r.key === k);

  it("ECW_sg_pct = ECW_sg / FFW * 100 (no queda en '-')", () => {
    const ecwSg = raw[h("ECW_sg")];
    const ffw = raw[h("FFW")];
    expect(ecwSg).toBeGreaterThan(0);
    expect(ffw).toBeGreaterThan(0);
    expect(byKey("ECW_sg_pct")?.value).toBeCloseTo((ecwSg / ffw) * 100, 1);
  });

  it("los dos % sin grasa derivados suman ~100 (identidad AEC_sg + AIC_sg = FFW)", () => {
    const ecwSgPct = byKey("ECW_sg_pct")?.value ?? 0;
    const icwSgPct = byKey("ICW_sg_pct")?.value ?? 0;
    expect(ecwSgPct + icwSgPct).toBeCloseTo(100, 0);
  });

  it("si el equipo SI trae el %, ese manda (no se deriva encima)", () => {
    const conPct = buildComposition(raw, null);
    const dev = raw[h("ECW_sg_pct")];
    const fila = allCompositionRows(conPct).find((r) => r.key === "ECW_sg_pct");
    expect(fila?.value).toBe(dev);
  });
});
