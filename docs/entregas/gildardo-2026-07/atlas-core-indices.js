/**
 * atlas-core-indices.js
 * Clasificadores por indice (composicion / ANI BIS-E) + calcPABU.
 * Base del core: no depende de nada. Lo consumen atlas-dfi.js y atlas-resumen-clinico.js.
 * Extraido de ATLAS_v7.html (estado actual, 2026-07-23).
 */

const calcPABU = (Re, Ri, Rinf, C, sexo) => {
  const k = (sexo === 'M' || sexo === 'Masculino') ? 0.78 : (sexo === 'F' || sexo === 'Femenino') ? 0.46 : 0.9;
  return Rinf * C === 0 ? 0 : (Re + Ri) * k / (Rinf * C);
};

const cIFC = (v, sexo) => {
  const m = sexo === 'M' || sexo === 'Masculino', f = sexo === 'F' || sexo === 'Femenino';
  const lo = m ? 4.12 : f ? 2.08 : 3.5;
  const hi = m ? 6.68 : f ? 3.28 : 6.0;
  return v > hi  ? { l: 'Función óptima',     c: '#1a7a4a', risk: 'bajo',     k: 3 }
    : v >= lo    ? { l: 'Alerta funcional',   c: '#e6a817', risk: 'moderado', k: 2 }
    : { l: 'Disfunción celular', c: '#c0392b', risk: 'alto',     k: 1 };
};

const cIRC = (v, sexo) => {
  const m = sexo === 'M' || sexo === 'Masculino', f = sexo === 'F' || sexo === 'Femenino';
  const lo = m ? 1.68 : f ? 2.27 : 2.0;
  const hi = m ? 2.11 : f ? 2.85 : 3.4;
  return v < lo  ? { l: 'Bajo riesgo',         c: '#1a7a4a', risk: 'bajo',     k: 1 }
    : v <= hi    ? { l: 'Riesgo moderado',     c: '#e6a817', risk: 'moderado', k: 2 }
    : { l: 'Alto riesgo celular', c: '#c0392b', risk: 'alto',     k: 3 };
};

const cPABU = (v, ifc) => {
  if (!v) return { l: 'Sin dato', c: '#94a3b8' };
  const raw = v - 1.618;
  if (raw < 0) {
    if (ifc > 6)   return { l: 'Reserva bioeléctrica superior', c: '#0d5c36' };
    if (ifc >= 3.5) return { l: 'Zona ambigua — evaluar EFRC',  c: '#e6a817' };
    return                 { l: 'Colapso por defecto',           c: '#c0392b' };
  }
  const d = Math.abs(raw);
  if (d <= 0.15) return { l: 'Zona φ — Homeostasis óptima', c: '#1a7a4a' };
  if (d <= 0.50) return { l: 'Desviación leve',              c: '#4caf50' };
  if (d <= 1.50) return { l: 'Desviación moderada',          c: '#e6a817' };
  if (d <= 3.00) return { l: 'Desviación severa',            c: '#e74c3c' };
  return                { l: 'Zona crítica',                  c: '#7b0000' };
};

const cAF = (v, sexo) => {
  const m = sexo === 'M' || sexo === 'Masculino';
  if (!v || v <= 0) return { l: 'Sin dato', c: '#94a3b8' };
  if (m) {
    if (v < 6.5) return { l: 'Bajo',   c: '#dc2626' };
    if (v <= 7.0) return { l: 'Normal', c: '#f59e0b' };
    return              { l: 'Alto',   c: '#16a34a' };
  } else {
    if (v < 6.0) return { l: 'Bajo',   c: '#dc2626' };
    if (v <= 6.5) return { l: 'Normal', c: '#f59e0b' };
    return              { l: 'Alto',   c: '#16a34a' };
  }
};

const cIR = (v, sexo) => {
  if (!v || v <= 0) return { l: 'Sin dato', c: '#94a3b8' };
  const m = sexo === 'M' || sexo === 'Masculino';
  const corte = m ? 0.78 : 0.82;
  return v < corte
    ? { l: 'Óptimo',                c: '#16a34a' }
    : { l: 'Inflamación bajo grado', c: '#dc2626' };
};

const cISCM = v => v <= -1 ? {
  l: "ISCM-1 Bajo riesgo",
  c: "#10b981"
} : v <= 1 ? {
  l: "ISCM-2 Susceptibilidad leve",
  c: "#f59e0b"
} : v <= 2.5 ? {
  l: "ISCM-3 Susceptibilidad moderada",
  c: "#ea580c"
} : {
  l: "ISCM-4 Alta susceptibilidad",
  c: "#ef4444"
};

const cIEHH = v => v <= 0 ? {
  l: "Óptimo",
  c: "#10b981"
} : v <= 1 ? {
  l: "Leve",
  c: "#f59e0b"
} : v <= 2 ? {
  l: "Moderado",
  c: "#ea580c"
} : {
  l: "Severo",
  c: "#ef4444"
};

const cIAE = v => v < -5 ? {
  l: "Desacelerado",
  c: "#10b981"
} : v <= 5 ? {
  l: "Concordante",
  c: "#f59e0b"
} : {
  l: "Acelerado",
  c: "#ef4444"
};

const cFMI = (v, s) => s === "M" ? v < 3 ? {
  l: "Bajo",
  c: "#60a5fa",
  k: 1
} : v <= 6 ? {
  l: "Normal",
  c: "#10b981",
  k: 2
} : v <= 9 ? {
  l: "Alto SS",
  c: "#f59e0b",
  k: 3
} : {
  l: "Alto CS",
  c: "#ef4444",
  k: 3
} : v < 5 ? {
  l: "Bajo",
  c: "#60a5fa",
  k: 1
} : v <= 9 ? {
  l: "Normal",
  c: "#10b981",
  k: 2
} : {
  l: "Alto CS",
  c: "#ef4444",
  k: 3
};

const cFFMI = (v, s) => s === "M" || s === "Masculino" ?
  v < 17 ? { l: "Bajo — riesgo desnutrición",       c: "#ef4444", k: 1 } :
  v <= 25 ? { l: "Normal",                            c: "#10b981", k: 2 } :
            { l: "Alto — sospecha anabolizantes",     c: "#3b82f6", k: 3 }:
  v < 15 ? { l: "Bajo — riesgo desnutrición",        c: "#ef4444", k: 1 } :
  v <= 23 ? { l: "Normal",                            c: "#10b981", k: 2 } :
            { l: "Alto — sospecha anabolizantes",     c: "#3b82f6", k: 3 };

const cSMM = (v, s) => s === "M" ? v < 27 ? {
  l: "Sarcopenia",
  c: "#ef4444"
} : v <= 33 ? {
  l: "Normal",
  c: "#10b981"
} : {
  l: "Óptimo",
  c: "#3b82f6"
} : v < 22 ? {
  l: "Sarcopenia",
  c: "#ef4444"
} : v <= 28 ? {
  l: "Normal",
  c: "#10b981"
} : {
  l: "Óptimo",
  c: "#3b82f6"
};

const cASMI = (v, s) => s === "M" ? v < 7.0 ? {
  l: "Riesgo de Sarcopenia",
  c: "#ef4444"
} : {
  l: "Normal",
  c: "#10b981"
} : v < 5.5 ? {
  l: "Riesgo de Sarcopenia",
  c: "#ef4444"
} : {
  l: "Normal",
  c: "#10b981"
};

export { calcPABU, cIFC, cIRC, cPABU, cAF, cIR, cISCM, cIEHH, cIAE, cFMI, cFFMI, cSMM, cASMI };
