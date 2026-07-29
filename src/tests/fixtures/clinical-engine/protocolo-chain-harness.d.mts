// Tipos para el harness Via C (JS sin tipos; el .mjs es verbatim, ver DIFF B). Solo para tsc.
export function chainVerbatim(
  ffmN: number,
  sexoM_pn: boolean,
  pesoN: number,
  tallaP: number,
  edadN: number,
  formulaEditPN: { geb?: number; pal?: number },
  protocAprobado: { kcal_obj?: number; prot_gkg?: number; fat_pct?: number } | null,
  pr: { estrategia: { deficit: number }; protMin: number },
): {
  gebAuto: number;
  gebN: number;
  palN: number;
  getN: number;
  kcalObj: number;
  protGKg: number;
  fatPct: number;
  protG: number;
  protKcal: number;
  fatKcal: number;
  fatG: number;
  choKcal: number;
  choG: number;
  choPct: number;
};
