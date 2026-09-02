// HARNESS Via C: ORACULO de GOLDEN 1. Corre los BYTES VERBATIM de la CADENA DEL PLAN NUTRICIONAL de
// Gildardo, extraidos por script del HTML vigente (html actualizado 2 septiembre). El envoltorio solo declara los
// parametros con los nombres del slice y devuelve las variables; NO tiene NINGUNA operacion aritmetica
// propia (ni un round, ni un *, ni un +). Generado por script; no editar a mano.
//
// RE-ANCLADO EL 2026-09-02, y el motivo importa mas que el cambio: el slice anterior venia de
// `ATLAS.html:14124`, que es el bloque de la FORMULA SINTETICA DEL MEDICO. Ese bloque esta DESACTIVADO en
// su archivo (`false && hasBis`, marcado "OLD MEDICO IIFE REMOVED") y su cadena del plan nutricional
// nunca calculo el GEB: lo LEE del motor (`var gebAuto = _mtn.geb`) desde al menos el 19 de agosto.
// El oraculo llevaba semanas comparando contra un bloque muerto, y por eso no vio que nuestra cadena
// calculaba el gasto con una formula que la suya ya no usaba.
//
// `gebAuto` ENTRA COMO PARAMETRO porque en su cadena entra igual: viene de `motorTratNutri`, que tiene su
// propio candado de transcripcion verbatim. Aqui se compara la parte que es de esta cadena: el reparto.
export function chainVerbatim(gebAuto, pesoN, formulaEditPN, _mtn) {
  // >>> SLICE VERBATIM de la cadena del plan nutricional (NO editar) >>>
      var gebN = formulaEditPN.geb!==undefined ? Number(formulaEditPN.geb) : gebAuto;
      var palN = formulaEditPN.pal!==undefined ? Number(formulaEditPN.pal) : _mtn.fa;
      var getN = Math.round(gebN*palN);
      var kcalObj = formulaEditPN.kcal_obj!==undefined ? Number(formulaEditPN.kcal_obj) : _mtn.kcalObjetivo;
      var protGKg = formulaEditPN.prot_gkg!==undefined ? Number(formulaEditPN.prot_gkg) : _mtn.protKg;
      var fatPct  = formulaEditPN.fat_pct!==undefined ? Number(formulaEditPN.fat_pct) : _mtn.fatPct;
      var protG   = Math.round(protGKg*pesoN);
      var protKcal= Math.round(protG*4);
      var fatKcal = Math.round(kcalObj*fatPct/100);
      var fatG    = Math.round(fatKcal/9);
      var choKcal = Math.max(0, kcalObj-protKcal-fatKcal);
      var choG    = Math.round(choKcal/4);
      var choPct  = kcalObj>0 ? Math.round(choKcal/kcalObj*100) : 0;
  // <<< FIN SLICE VERBATIM <<<
  return { gebAuto, gebN, palN, getN, kcalObj, protGKg, fatPct, protG, protKcal, fatKcal, fatG, choKcal, choG, choPct };
}
