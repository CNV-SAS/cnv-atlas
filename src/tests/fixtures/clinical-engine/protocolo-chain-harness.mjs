// HARNESS Via C (T2 A3): ORACULO de GOLDEN 1. Corre los BYTES VERBATIM de Gildardo
// (ATLAS.html:14124-14137), NO nuestra transcripcion. El envoltorio solo declara los parametros
// con los nombres del slice y devuelve las variables; NO tiene NINGUNA operacion aritmetica
// propia (ni un round, ni un *, ni un +). DIFF B verifica que el slice coincide byte a byte con
// la fuente. Generado por script; no editar a mano.
export function chainVerbatim(ffmN, sexoM_pn, pesoN, tallaP, edadN, formulaEditPN, protocAprobado, pr) {
  // >>> SLICE VERBATIM ATLAS.html:14124-14137 (NO editar) >>>
      var gebAuto = ffmN>0 ? Math.round(500+22*ffmN) : sexoM_pn ? Math.round(10*pesoN+6.25*tallaP-5*edadN+5) : Math.round(10*pesoN+6.25*tallaP-5*edadN-161);
      var gebN = formulaEditPN.geb!==undefined ? Number(formulaEditPN.geb) : gebAuto;
      var palN = formulaEditPN.pal!==undefined ? Number(formulaEditPN.pal) : 1.375;
      var getN = Math.round(gebN*palN);
      var kcalObj = protocAprobado&&protocAprobado.kcal_obj!==undefined ? Number(protocAprobado.kcal_obj) : Math.max(1000, Math.round(getN - pr.estrategia.deficit));
      var protGKg = protocAprobado&&protocAprobado.prot_gkg!==undefined ? Number(protocAprobado.prot_gkg) : pr.protMin;
      var fatPct  = protocAprobado&&protocAprobado.fat_pct!==undefined  ? Number(protocAprobado.fat_pct)  : 30;
      var protG   = Math.round(protGKg*pesoN);
      var protKcal= Math.round(protG*4);
      var fatKcal = Math.round(kcalObj*fatPct/100);
      var fatG    = Math.round(fatKcal/9);
      var choKcal = Math.max(0, kcalObj-protKcal-fatKcal);
      var choG    = Math.round(choKcal/4);
      var choPct  = kcalObj>0 ? Math.round(choKcal/kcalObj*100) : 0;
  // <<< FIN SLICE VERBATIM <<<
  return { gebAuto, gebN, palN, getN, kcalObj, protGKg, fatPct, protG, protKcal, fatKcal, choKcal, choG, choPct };
}
