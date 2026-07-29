// Cadena aritmetica del protocolo calorico (T2 A3). TRANSCRIPCION de ATLAS.html:14124-14137,
// no ciencia congelada: su fuente es inline dentro del render (no un artefacto independiente),
// asi que NO va a frozen/ (regla 5 exige clinical-engine, no frozen/). Cada linea lleva su
// linea de origen. El orden de redondeo es IDENTICO al de la fuente (cada Math.round en su
// paso, en su orden). Su paridad con los bytes de Gildardo la prueba GOLDEN 1 contra el harness
// Via C (que corre el slice verbatim); si GOLDEN 1 falla, es hallazgo, va a GILDARDO_QUERIES y
// se para, no se reconcilia.
//
// peso_efectivo = adj_peso_meta ?? pesoCalculo lo resuelve el CALLER y entra como `pesoN` a
// PRECISION COMPLETA (no se redondea; el 73.6 de la pantalla es solo render). pesoN entra a
// TODA la cadena donde el HTML usa pesoN: la rama Mifflin del GEB y protG.

export type ProtocoloCaloricoInput = {
  ffm: number; // b_.FFM (ATLAS.html:14123 ffmN). Si >0, GEB por Cunningham; si no, Mifflin.
  pesoN: number; // peso_efectivo = adj_peso_meta ?? pesoCalculo, resuelto por el caller (:14122)
  talla: number; // :14120 tallaP
  edad: number; // :14119 edadN
  sexoM: boolean; // :14118 sexoM_pn
  deficit: number; // pr.estrategia.deficit (del motorProtocolo congelado)
  protMin: number; // pr.protMin (del motorProtocolo congelado)
  // Overrides del profesional (formulaEditPN / protocAprobado). undefined = usar el sugerido.
  geb?: number; // formulaEditPN.geb
  pal?: number; // formulaEditPN.pal
  kcalObj?: number; // protocAprobado.kcal_obj
  protGkg?: number; // protocAprobado.prot_gkg
  fatPct?: number; // protocAprobado.fat_pct
};

export type ProtocoloCaloricoOutput = {
  formula: "Cunningham" | "Mifflin";
  gebAuto: number;
  geb: number;
  get: number;
  kcalObj: number;
  protGKg: number;
  protG: number;
  protKcal: number;
  fatPct: number;
  fatG: number;
  fatKcal: number;
  choKcal: number;
  choG: number;
  choPct: number;
};

export function computeProtocoloCalorico(i: ProtocoloCaloricoInput): ProtocoloCaloricoOutput {
  const { ffm, pesoN, talla, edad, sexoM, deficit, protMin } = i;

  // :14124 gebAuto = ffm>0 ? Cunningham : Mifflin (rama gobernada por disponibilidad de FFM)
  const gebAuto =
    ffm > 0
      ? Math.round(500 + 22 * ffm)
      : sexoM
        ? Math.round(10 * pesoN + 6.25 * talla - 5 * edad + 5)
        : Math.round(10 * pesoN + 6.25 * talla - 5 * edad - 161);
  // :14125 gebN = override ?? gebAuto
  const gebN = i.geb !== undefined ? Number(i.geb) : gebAuto;
  // :14126 palN = override ?? 1.375 (PAL es ENTRADA, ver encabezado de frozen/atlas-protocolo.js)
  const palN = i.pal !== undefined ? Number(i.pal) : 1.375;
  // :14127 getN = round(gebN * palN)
  const getN = Math.round(gebN * palN);
  // :14128 kcalObj = override ?? max(1000, round(getN - deficit))
  const kcalObj =
    i.kcalObj !== undefined ? Number(i.kcalObj) : Math.max(1000, Math.round(getN - deficit));
  // :14129 protGKg = override ?? protMin
  const protGKg = i.protGkg !== undefined ? Number(i.protGkg) : protMin;
  // :14130 fatPct = override ?? 30
  const fatPct = i.fatPct !== undefined ? Number(i.fatPct) : 30;
  // :14131 protG = round(protGKg * pesoN)  (pesoN a precision completa)
  const protG = Math.round(protGKg * pesoN);
  // :14132 protKcal = round(protG * 4)
  const protKcal = Math.round(protG * 4);
  // :14133 fatKcal = round(kcalObj * fatPct / 100)
  const fatKcal = Math.round((kcalObj * fatPct) / 100);
  // :14134 fatG = round(fatKcal / 9)
  const fatG = Math.round(fatKcal / 9);
  // :14135 choKcal = max(0, kcalObj - protKcal - fatKcal)  (resta de redondeados, sin round)
  const choKcal = Math.max(0, kcalObj - protKcal - fatKcal);
  // :14136 choG = round(choKcal / 4)
  const choG = Math.round(choKcal / 4);
  // :14137 choPct = kcalObj>0 ? round(choKcal / kcalObj * 100) : 0
  const choPct = kcalObj > 0 ? Math.round((choKcal / kcalObj) * 100) : 0;

  return {
    formula: ffm > 0 ? "Cunningham" : "Mifflin",
    gebAuto,
    geb: gebN,
    get: getN,
    kcalObj,
    protGKg,
    protG,
    protKcal,
    fatPct,
    fatG,
    fatKcal,
    choKcal,
    choG,
    choPct,
  };
}
