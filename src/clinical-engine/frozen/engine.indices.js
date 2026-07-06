/* ═══════════════════════════════════════════════════════════════════════════
   ATLAS · MOTOR CLÍNICO ANI-BIS-E — ÍNDICES SECUNDARIOS + RUTAS (FROZEN CORE 2)
   Fórmulas extraídas VERBATIM de ATLAS_v7.html (prototipo final de Gildardo):
     · ISCM / IEHH / EB-BIS / IAE  → bloque de cálculo L5695–L5721
     · Condiciones de las 6 rutas   → RUTAS R1–R6, L9238–L9410
   NO EDITAR A MANO. Cambios solo de Gildardo; el golden test suena si desalinea.
   ═══════════════════════════════════════════════════════════════════════════ */

// z-score con media/desv explícitas — verbatim (_zBis del prototipo).
const _zBis = (v, mu, sd) => { const n = parseFloat(v); return (!isNaN(n) && sd > 0) ? (n - mu) / sd : 0; };

// ── ISCM-BIS · Susceptibilidad Cardiometabólica (100% del Excel) ──────────────
// bis debe traer: ifc, MCA_dif (o MCA & MCA_ref), ECW_sg, ICW_sg, FMI, FFW
function computeISCM(bis) {
  const ifcZ  = _zBis(bis.ifc,                                                                       4.1430, 3.0534);
  const mcaZ  = _zBis(bis.MCA_dif != null ? bis.MCA_dif : (bis.MCA && bis.MCA_ref ? bis.MCA - bis.MCA_ref : 0), 0.3261, 1.3467);
  const eisgZ = _zBis(bis.ECW_sg && bis.ICW_sg ? parseFloat(bis.ECW_sg) / parseFloat(bis.ICW_sg) : 0, -0.0682, 0.9665);
  const fmiZ  = _zBis(bis.FMI,                                                                        7.8875, 3.0139);
  const ffwZ  = _zBis(bis.FFW,                                                                       35.5520, 8.4521);
  return parseFloat(((-ifcZ) + (-mcaZ) + eisgZ + fmiZ + (-ffwZ)).toFixed(3));
}

// ── IEHH · Espectro de Hidratación Humana (100% del Excel) ────────────────────
// bis debe traer: Re, Rinf, C, FFW
function computeIEHH(bis) {
  const reRinfZ = _zBis(bis.Re && bis.Rinf ? parseFloat(bis.Re) / parseFloat(bis.Rinf) : 0, 1.55,   0.15);
  const ffwZ    = _zBis(bis.FFW,                                                             35.5520, 8.4521);
  const cZ2     = _zBis(bis.C,                                                                1.8294, 0.7719);
  return parseFloat((0.25 * reRinfZ + 0.25 * ffwZ + 0.50 * cZ2).toFixed(3));
}

// ── EB-BIS v5 · Edad Biológica Celular (REQUIERE ICEC/LE8 de la encuesta) ──────
// Sin ICEC → null (comportamiento deliberado: no se inventa una edad biológica).
function computeEBBIS(ifc, pabu, icec) {
  if (icec == null) return null;
  return parseFloat((41.438
    + ( 1.082) * _zBis(ifc,   4.0146,  2.2669)   // IFC (función celular)
    + ( 2.837) * _zBis(pabu,  1.8303,  0.7741)   // PABU (equilibrio áureo)
    + (-7.982) * _zBis(icec, 58.578,  13.332)    // Contextual (ICEC/LE8)
  ).toFixed(1));
}

// ── IAE · Aceleración del Envejecimiento = EB-BIS − edad cronológica ──────────
function computeIAE(eb, edad) {
  if (eb == null) return null;
  return parseFloat((eb - (parseFloat(edad) || 0)).toFixed(1));
}

// ── CONDICIONES DE LAS 6 RUTAS DE ATENCIÓN — predicados puros, verbatim ────────
// d = objeto con índices/antropometría; R3/R5 leen campos de ENCUESTA (d2_*, d5_*, d3_*);
// R6 recibe además `dominios`. Devuelven boolean.
const RUTA_COND = {
  // R1 · Restauración Celular
  R1: d => Number(d.ifc||d.IFC) < 4.5 && Number(d.ifc||d.IFC) > 0 && Number(d.irc||d.IRC) >= 3.5 && Number(d.iae||d.IAE) > 5,
  // R2 · Reducción Riesgo Cardiometabólico
  R2: d => Number(d.FMI||d.fmi) > ((d.sexo==='M'||d.sexo==='Masculino') ? 6 : 9) || Number(d.iscm||d.ISCM) > 1.0 || d.obesidadSarcopenica === true || Number(d.ICC||d.icc) >= ((d.sexo==='M'||d.sexo==='Masculino') ? 0.90 : 0.85) || Number(d.ICT||d.ict) >= 0.50 || ((d.sexo==='M'||d.sexo==='Masculino') ? Number(d.IR||d.ir) >= 0.78 : Number(d.IR||d.ir) >= 0.82),
  // R3 · Manejo TCA (ENCUESTA: d2_21 conductas, d2_20 satisfacción corporal)
  R3: d => {
    const tca = Array.isArray(d.d2_21) ? d.d2_21 : [];
    return ["Laxantes","Vómito","Ejercicio excesivo"].some(t => tca.includes(t)) || d.d2_20 === "Muy insatisfecho/a";
  },
  // R4 · Desaceleración del Envejecimiento
  R4: d => Number(d.iae||d.IAE) > 5 || (Number(d.FFMI||d.ffmi) > 0 && Number(d.FFMI||d.ffmi) < ((d.sexo==='M'||d.sexo==='Masculino') ? 17 : 15)) || d.nivelFFMI === 'bajo' || d.obesidadSarcopenica === true,
  // R5 · Contextual / Epigenética (ENCUESTA: ≥3 factores)
  R5: d => {
    const dx = Array.isArray(d.d5_39) ? d.d5_39 : [];
    const af = Array.isArray(d.d5_38) ? d.d5_38 : [];
    const ct = Array.isArray(d.d5_42) ? d.d5_42 : [];
    const n = [dx.includes("Diabetes tipo 2"), dx.includes("HTA") || d.d5_36 === "Sí",
      dx.includes("Dislipidemia (colesterol alto)"), af.filter(x => x !== "Ninguna").length >= 2,
      d.d3_30 && !d.d3_30.includes("Nunca") && !d.d3_30.includes("5 años o más"),
      Number(d.d3_29) >= 7, ct.filter(x => x !== "Ninguna").length > 0].filter(Boolean).length;
    return n >= 3;
  },
  // R6 · Mantenimiento y Optimización (requiere `dominios`)
  R6: (d, dominios) => (!dominios || dominios.every(x => x.nivel === "óptimo" || x.nivel === "normal")) && d.nivelFMI !== 'alto_clinico' && d.nivelFFMI !== 'bajo' && !d.obesidadSarcopenica,
};

/** Evalúa las 6 condiciones y devuelve los ids activos (['R1','R2',...]).
    OJO: en el prototipo la selección AUTORITATIVA se hace vía DFI (mezcla encuesta+BIS).
    Esta función evalúa los predicados tal cual; úsala para lógica de reglas, no como
    reemplazo del DFI hasta que la fase 2b congele el DFI con fixtures de encuesta. */
function rutasPorCondicion(d, dominios) {
  return Object.keys(RUTA_COND).filter(id => RUTA_COND[id](d, dominios));
}

module.exports = { _zBis, computeISCM, computeIEHH, computeEBBIS, computeIAE, RUTA_COND, rutasPorCondicion };
