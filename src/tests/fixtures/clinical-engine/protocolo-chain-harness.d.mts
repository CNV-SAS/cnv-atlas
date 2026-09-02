// Tipos del HARNESS de GOLDEN 1. La firma sigue a la CADENA VIVA de Gildardo (la del plan nutricional):
// `gebAuto` ENTRA porque en su cadena entra igual, desde `motorTratNutri`.
export declare function chainVerbatim(
  gebAuto: number,
  pesoN: number,
  formulaEditPN: {
    geb?: number;
    pal?: number;
    kcal_obj?: number;
    prot_gkg?: number;
    fat_pct?: number;
  },
  _mtn: { fa: number; kcalObjetivo: number; protKg: number; fatPct: number },
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
