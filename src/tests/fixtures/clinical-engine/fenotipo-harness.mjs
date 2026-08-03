// HARNESS Via C (T2 A3.4): ORACULO del golden del clasificador de fenotipo. Corre los BYTES
// VERBATIM de Gildardo (dxSarcopenia ATLAS_v7.html:3417-3435 + clasificador MCCB 11060-11105),
// NO nuestra transcripcion. RE-ANCLADO al VIGENTE 2026-08-02 (antes anclaba a la entrega de julio):
// Gildardo unifico la frontera de desnutricion (FMI H 3.5->3.0, FFMI H 17.92->17, M 15.64->15). El envoltorio solo declara params (bis/enc/
// sexoM) y devuelve las variables; NINGUNA operacion aritmetica ni umbral propio. DIFF verifica
// byte a byte. Generado por script; no editar a mano.
export function classifyVerbatim(bis, enc, sexoM) {
  // >>> SLICE VERBATIM ATLAS.html:3414-3432 (dxSarcopenia EWGSOP2, NO editar) >>>
const dxSarcopenia = (fuerza, asmi, af, sexoM) => {
  const fz = parseFloat(fuerza) || 0, am = parseFloat(asmi) || 0, an = parseFloat(af) || 0;
  const fzLow = fz > 0 && fz < (sexoM ? 27 : 16);
  const amLow = am > 0 && am < (sexoM ? 7.0 : 5.5);
  const anLow = an > 0 && an < (sexoM ? 6.5 : 6.0);
  if (fz <= 0) return { l: "Ingrese fuerza prensil", c: "#94a3b8", k: 0,
    detalle: "Falta la dinamometría (criterio primario de fuerza EWGSOP2)." };
  if (!fzLow && !amLow) return { l: "Sin sarcopenia", c: "#16a34a", k: 0,
    detalle: "Fuerza y masa muscular normales" + (anLow ? "; AF bajo → vigilar calidad celular." : ".") };
  if (fzLow && !amLow) return { l: "Sarcopenia probable", c: "#f59e0b", k: 1,
    detalle: "Fuerza baja con masa conservada (EWGSOP2: probable). Confirmar con masa/DXA." };
  if (!fzLow && amLow) return { l: "Baja masa muscular — vigilar", c: "#f59e0b", k: 1,
    detalle: "ASMI bajo con fuerza normal; no cumple sarcopenia (la fuerza es criterio primario)." };
  return anLow
    ? { l: "Sarcopenia severa", c: "#7b0000", k: 3,
        detalle: "Fuerza + masa bajas y AF bajo (calidad celular comprometida)." }
    : { l: "Sarcopenia confirmada", c: "#dc2626", k: 2,
        detalle: "Fuerza baja + masa muscular baja (EWGSOP2: confirmada)." };
};
  // <<< FIN SLICE <<<
  // >>> SLICE VERBATIM ATLAS.html:10864-10916 (clasificador MCCB, NO editar) >>>
  const FMI  = Number(bis?.FMI)||0;
  const FFMI = Number(bis?.FFMI)||0;
  const MCA  = Number(bis?.MCA)||0;
  const MCA_ref = Number(bis?.MCA_ref)||0;
  const MCA_ok  = MCA >= MCA_ref;

  const nivelFMI = (() => {
    if (sexoM) {
      if (FMI <= 0) return 'normal';
      if (FMI < 3.0) return 'bajo';   // cFMI: H<3
      if (FMI <= 6.0) return 'normal';
      if (!MCA_ok) return 'alto_clinico';
      return 'alto_preclinico';
    } else {
      if (FMI <= 0) return 'normal';
      if (FMI < 5.0) return 'bajo';
      if (FMI <= 9.0) return 'normal';
      if (!MCA_ok) return 'alto_clinico';
      return 'alto_preclinico';
    }
  })();

  const nivelFFMI = (() => {
    // Frontera de 'bajo' unificada con cFFMI (H<17 · M<15). La frontera superior
    // (21,59 / 19,34) es la del mapa de fenotipos MCCB y se conserva: cFFMI usa 25/23
    // para 'sospecha de anabolizantes', que es otro concepto.
    if (sexoM) return FFMI < 17 ? 'bajo' : FFMI <= 21.59 ? 'normal' : 'alto';
    return FFMI < 15 ? 'bajo' : FFMI <= 19.34 ? 'normal' : 'alto';
  })();

  const FENOTIPOS_MCCB = {
    'alto_clinico_bajo':     { id:'F1',  nombre:'Obesidad sarcopénica clínica',     riesgo:'crítico',  color:'#7b0000' },
    'alto_clinico_normal':   { id:'F2',  nombre:'Obesidad clínica clásica',          riesgo:'alto',     color:'#dc2626' },
    'alto_clinico_alto':     { id:'F3',  nombre:'Obesidad con hipermusculatura',     riesgo:'alto',     color:'#b91c1c' },
    'alto_preclinico_bajo':  { id:'F4',  nombre:'Obesidad precl. sarcopénica',       riesgo:'alto',     color:'#ef4444' },
    'alto_preclinico_normal':{ id:'F5',  nombre:'Obesidad preclínica clásica',       riesgo:'moderado', color:'#f97316' },
    'alto_preclinico_alto':  { id:'F6',  nombre:'Obesidad precl. hipermusculada',    riesgo:'moderado', color:'#f59e0b' },
    'normal_bajo':           { id:'F7',  nombre:'Normopeso sarcopénico',             riesgo:'moderado', color:'#ea580c' },
    'normal_normal':         { id:'F8',  nombre:'Normopeso',                         riesgo:'bajo',     color:'#22c55e' },
    'bajo_bajo':             { id:'F9',  nombre:'Bajo peso sarcopénico',             riesgo:'alto',     color:'#7c3aed' },
    'bajo_normal':           { id:'F10', nombre:'Bajo peso',                         riesgo:'moderado', color:'#a78bfa' },
    'bajo_alto':             { id:'F11', nombre:'Constitución delgada musculosa',    riesgo:'bajo',     color:'#16a34a' },
    'normal_alto':           { id:'F12', nombre:'Físicamente activo buenos hábitos', riesgo:'bajo',     color:'#15803d' },
  };
  const keyMCCB = nivelFMI+'_'+nivelFFMI;
  const fenotipo = FENOTIPOS_MCCB[keyMCCB] || { id:'F?', nombre:'No clasificado', riesgo:'bajo', color:'#64748b' };

  const smmW = Number(bis?.smmW)||0;
  // Sarcopenia EWGSOP2: fuerza prensil (primario) + ASMI (masa) + AF (calidad). Si k≥2 → confirmada/severa.
  const _fzP = Number(bis?.fuerzaPrensil || enc?.fuerzaPrensil) || 0;
  const sarcoDx = (typeof dxSarcopenia !== 'undefined')
    ? dxSarcopenia(_fzP, Number(bis?.ASMI)||0, Number(bis?.AF || enc?.AF)||0, sexoM)
    : { l:'—', c:'#94a3b8', k:0, detalle:'' };
  const sarcopenia = (sexoM ? smmW < 27 : smmW < 24) || sarcoDx.k >= 2;
  const asmiLow = Number(bis?.ASMI||0) > 0 && Number(bis?.ASMI||0) < (sexoM ? 7.0 : 5.5);
  const obesidadSarcopenica = (fenotipo.id==='F1'||fenotipo.id==='F4') || ((sarcopenia||asmiLow) && (nivelFMI==='alto_clinico'||nivelFMI==='alto_preclinico'));
  // <<< FIN SLICE <<<
  return { nivelFMI, nivelFFMI, MCA_ok, keyMCCB, fenotipo, sarcopenia, asmiLow, obesidadSarcopenica };
}
