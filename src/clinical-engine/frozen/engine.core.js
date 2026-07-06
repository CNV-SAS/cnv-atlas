/* ═══════════════════════════════════════════════════════════════════════════
   ATLAS · MOTOR CLÍNICO ANI-BIS-E — NÚCLEO CONGELADO (FROZEN CORE)
   Extraído VERBATIM de ATLAS_v7.html (prototipo final de Gildardo), líneas 3210–4137.
   NO EDITAR A MANO. Toda la ciencia (fórmulas, cortes, fenotipos) vive aquí.
   Cualquier cambio debe venir de Gildardo y romper el golden test si desalinea.
   ═══════════════════════════════════════════════════════════════════════════ */
const calcIFC = (C, Rinf) => Rinf === 0 ? 0 : C / Rinf * 1000;
const calcIRC = (Re, Ri, C) => Ri * C === 0 ? 0 : (Re / (Ri * C)) * 10;
// PABU · constante k recalibrada por sexo (cohorte 6.063): H=0,78 · M=0,46 · sin sexo=0,9 (histórico)
const calcPABU = (Re, Ri, Rinf, C, sexo) => {
  const k = (sexo === 'M' || sexo === 'Masculino') ? 0.78 : (sexo === 'F' || sexo === 'Femenino') ? 0.46 : 0.9;
  return Rinf * C === 0 ? 0 : (Re + Ri) * k / (Rinf * C);
};

// ─── CLASIFICADORES BIS ───────────────────────────────────────────────────────
// Puntos de corte EXACTOS del Excel MAPA_RyF_BIS
// IFC por sexo (cohorte 6.063, P25/P75): H Bajo<4,12 Normal 4,12–6,68 Alto>6,68 · M Bajo<2,08 Normal 2,08–3,28 Alto>3,28
// (sin sexo → corte histórico 3,5/6,0). IFC alto = mejor función celular.
const cIFC = (v, sexo) => {
  const m = sexo === 'M' || sexo === 'Masculino', f = sexo === 'F' || sexo === 'Femenino';
  const lo = m ? 4.12 : f ? 2.08 : 3.5;
  const hi = m ? 6.68 : f ? 3.28 : 6.0;
  return v > hi  ? { l: 'Función óptima',     c: '#1a7a4a', risk: 'bajo',     k: 3 }
    : v >= lo    ? { l: 'Alerta funcional',   c: '#e6a817', risk: 'moderado', k: 2 }
    : { l: 'Disfunción celular', c: '#c0392b', risk: 'alto',     k: 1 };
};
// IRC por sexo (cohorte 6.063, P25/P75): H Bajo<1,68 Normal 1,68–2,11 Alto>2,11 · M Bajo<2,27 Normal 2,27–2,85 Alto>2,85
// (sin sexo → corte histórico 2,0/3,4). IRC alto = mayor riesgo.
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
// IAE crudo (EB-BIS − edad cronológica), en años. Cortes ±5 años, coherentes con la referencia
// "−5 a +5 años" usada en los informes. <−5 desacelerado · −5..+5 concordante · >+5 acelerado.
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

// ─── CLASIFICADORES COMPOSICIÓN — Biody Manager ───────────────────────────────
// FMI / FFMI — puntos de corte del Excel Mapa E_BIS
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
// SMM/Peso — EWGSOP2/AWGS
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
// MMEM/Peso — índice apendicularesco (AWGS2019: H<7.0, M<5.7 kg/m²) aquí como ratio
const cMMEM = (v, s) => s === "M" ? v < 5.7 ? {
  l: "Bajo",
  c: "#ef4444"
} : {
  l: "Normal",
  c: "#10b981"
} : v < 7.0 ? {
  l: "Bajo",
  c: "#ef4444"
} : {
  l: "Normal",
  c: "#10b981"
};
// ASMI (Appendicular Skeletal Muscle Mass Index) — EWGSOP2/AWGS2019
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
// ── Diagnóstico de Sarcopenia — EWGSOP2 (fuerza prensil + ASMI + ángulo de fase) ──
// Fuerza prensil (Kgf) = criterio PRIMARIO de fuerza muscular (dinamometría). Bajo: H<27 · M<16.
// ASMI = criterio de CANTIDAD (masa) muscular. Bajo: H<7,0 · M<5,5.
// AF (ángulo de fase) = marcador de CALIDAD celular/muscular. Bajo: H<6,5 · M<6,0.
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
// FFW hidratación
const cFFW = v => v < -2 ? {
  l: "Deshidratación",
  c: "#ef4444"
} : v <= 2 ? {
  l: "Óptima",
  c: "#10b981"
} : {
  l: "Sobrehidratación",
  c: "#f59e0b"
};
// E/I SG equilibrio
const cEISG = v => v < 0.5 ? {
  l: "Bajo",
  c: "#60a5fa"
} : v <= 1 ? {
  l: "Normal",
  c: "#10b981"
} : {
  l: "Elevado",
  c: "#ef4444"
};

// ─── DIAGNÓSTICOS EFR — exactamente del Excel "Desenlaces EFR" ───────────────
// Key: IFC_IRC_FFMI_FMI  (A=Alto, N=Normal, B=Bajo)
const DX = {
  "B_A_B_A": {
    dx: "Obesidad sarcopénica clínica → síndrome metabólico, DM2, insuficiencia funcional",
    mec: "Inflamación crónica (TNFα, IL‑6), RI, lipotoxicidad, myosteatosis, pérdida síntesis proteica",
    bio: "PCR↑, HOMA‑IR↑, CK variable, ferritina↑, albúmina↓, IFC↓",
    rsk: "Alta mortalidad cardiometabólica; caídas; incapacidad funcional"
  },
  "B_A_N_A": {
    dx: "Obesidad sarcopénica avanzada → progresión a DM2 y ECV",
    mec: "Estrés oxidativo mitocondrial, disfunción mitocondrial muscular, RI",
    bio: "PCR↑, TG↑, glucosa ayunas↑, ángulo de fase↓",
    rsk: "Insuficiencia funcional progresiva; mayor riesgo eventos CV"
  },
  "B_A_A_A": {
    dx: "Fuerte-adiposo con disfunción → cardiometabolismo adverso pese a masa magra",
    mec: "Myosteatosis + adipocito inflamatorio; adipokinas proinflamatorias; anabolismo bloqueado",
    bio: "PCR↑, adiponectina↓, RI, marcadores daño muscular",
    rsk: "Enfermedad coronaria, disfunción metabólica oculta"
  },
  "B_A_B_N": {
    dx: "Déficit funcional inflamatorio → fragilidad con inflamación",
    mec: "Catabolismo proteico por citoquinas; pérdida síntesis proteica; alteración permeabilidad membrana",
    bio: "Albúmina↓, PCR↑, creatinina relativa↑, IFC↓",
    rsk: "Fragilidad, pobre recuperación ante estrés/infección"
  },
  "B_A_N_N": {
    dx: "Adiposo inflamatorio con reserva moderada → riesgo progresión DM2",
    mec: "Inflamación sistémica reduce señalización insulina y mTOR",
    bio: "PCR↑, HOMA‑IR↑, ángulo de fase↓",
    rsk: "Pérdida funcional gradual, mayor riesgo lesión"
  },
  "B_A_A_N": {
    dx: "Reserva magra con inflamación → rendimiento aparente pero riesgo metabólico",
    mec: "Inflamación limita anabolismo; mitocondrias disfuncionales",
    bio: "PCR↑, CK variable, marcadores oxidativos↑",
    rsk: "Riesgo lesión y pérdida calidad muscular"
  },
  "B_A_B_B": {
    dx: "Desnutrición inflamatoria → fallo funcional agudo",
    mec: "Catabolismo extremo, baja síntesis proteica, hipometabolismo celular",
    bio: "Albúmina muy baja, PCR↑, electrolitos alterados",
    rsk: "Hospitalización, infección, falla orgánica"
  },
  "B_A_N_B": {
    dx: "Fragilidad con inflamación y baja grasa → riesgo infección y pobre cicatrización",
    mec: "Déficit energético + inflamación; inmunosupresión funcional",
    bio: "Linfopenia relativa, albúmina↓, PCR↑",
    rsk: "Infecciones, mala recuperación"
  },
  "B_A_A_B": {
    dx: "Músculo presente pero disfuncional por inflamación → rendimiento engañoso",
    mec: "Myosteatosis y disfunción mitocondrial; anabolismo bloqueado",
    bio: "Ángulo de fase↓, PCR↑, CK anómalo",
    rsk: "Caídas de rendimiento súbitas; lesión por sobreuso"
  },
  "B_N_B_A": {
    dx: "Obesidad con disfunción celular moderada → riesgo DM2 y esteatohepatitis",
    mec: "Lipotoxicidad, estrés ER, inflamación moderada",
    bio: "ALT/AST↑, HOMA‑IR↑, PCR moderada",
    rsk: "Esteatosis hepática, progresión metabólica"
  },
  "B_N_N_A": {
    dx: "Adiposo subclínico con IFC bajo → RI emergente",
    mec: "Disfunción mitocondrial y señalización anabólica reducida",
    bio: "HOMA‑IR↑, PCR leve, ángulo de fase↓",
    rsk: "Progresión a síndrome metabólico si no se corrige"
  },
  "B_N_A_A": {
    dx: "Fuerte-adiposo con IFC bajo → myosteatosis y riesgo CV",
    mec: "Adipocinas proinflamatorias + pérdida calidad muscular",
    bio: "PCR↑, adiponectina↓, TG↑",
    rsk: "Enfermedad coronaria, disminución de fuerza"
  },
  "B_N_B_N": {
    dx: "Déficit funcional moderado → fragilidad metabólica",
    mec: "Baja síntesis proteica, menor capacidad de respuesta anabólica",
    bio: "Albúmina↓, IFC↓",
    rsk: "Vulnerabilidad ante estrés"
  },
  "B_N_N_N": {
    dx: "Disfunción celular con reserva moderada → riesgo de deterioro si persiste",
    mec: "Alteración en señalización anabólica; inflamación baja",
    bio: "PCR normal‑alto, ángulo de fase↓",
    rsk: "Pérdida funcional gradual"
  },
  "B_N_A_N": {
    dx: "Reserva magra con IFC bajo → riesgo catabolismo si aumenta carga",
    mec: "Inflamación inducida por adiposidad; anabolismo limitado",
    bio: "PCR↑, HOMA‑IR↑",
    rsk: "Pérdida de masa funcional con el tiempo"
  },
  "B_N_B_B": {
    dx: "Desnutrición funcional → alto riesgo de complicaciones",
    mec: "Deficiencia energética y proteica; inmunidad comprometida",
    bio: "Albúmina muy baja, linfopenia",
    rsk: "Infecciones, pobre cicatrización"
  },
  "B_N_N_B": {
    dx: "Fragilidad con baja grasa → riesgo pérdida funcional",
    mec: "Déficit energético relativo",
    bio: "Albúmina↓, IFC↓",
    rsk: "Caídas de rendimiento"
  },
  "B_N_A_B": {
    dx: "Músculo presente pero IFC bajo → riesgo pérdida funcional",
    mec: "Myosteatosis incipiente",
    bio: "Ángulo de fase↓, PCR↑",
    rsk: "Vulnerabilidad funcional"
  },
  "B_B_B_A": {
    dx: "Obesidad con IFC bajo pero IRC bajo → riesgo oculto de progresión",
    mec: "Inflamación no detectada por IRC pero IFC indica daño celular",
    bio: "IFC↓, PCR puede ser normal",
    rsk: "Progresión silenciosa a DM2"
  },
  "B_B_A_N": {
    dx: "Adiposo con IFC bajo y IRC bajo → riesgo subclínico",
    mec: "Disfunción celular temprana sin inflamación sistémica",
    bio: "IFC↓, HOMA‑IR variable",
    rsk: "Deterioro gradual"
  },
  "B_B_A_A": {
    dx: "Masa magra alta pero IFC bajo → myosteatosis silenciosa",
    mec: "Calidad muscular pobre pese a cantidad",
    bio: "Ángulo de fase↓, marcadores oxidativos↑",
    rsk: "Riesgo lesión y disfunción metabólica"
  },
  "B_B_N_B": {
    dx: "Baja función y baja IRC → ventana de recuperación",
    mec: "Déficit reversible con nutrición y entrenamiento",
    bio: "IFC↓, PCR normal",
    rsk: "Recuperación posible si se actúa"
  },
  "B_B_N_N": {
    dx: "IFC bajo con IRC bajo → riesgo moderado",
    mec: "Disfunción celular temprana",
    bio: "IFC↓",
    rsk: "Prevención eficaz"
  },
  "B_B_N_A": {
    dx: "IFC bajo con grasa alta → riesgo metabólico oculto",
    mec: "Lipotoxicidad local",
    bio: "HOMA‑IR↑",
    rsk: "Progresión si no se corrige"
  },
  "B_B_B_B": {
    dx: "Desnutrición severa sin inflamación → riesgo fallo por inanición",
    mec: "Deficiencias proteicas y energéticas",
    bio: "Albúmina muy baja, electrolitos alterados",
    rsk: "Falla orgánica si no se corrige"
  },
  "B_B_B_N": {
    dx: "Déficit proteico con baja inflamación → recuperación posible",
    mec: "Déficit proteico",
    bio: "Albúmina↓",
    rsk: "Rehabilitación nutricional necesaria"
  },
  "B_B_B_A_alt": {
    dx: "Músculo relativo pero IFC bajo → riesgo sarcopenia oculta",
    mec: "Calidad celular pobre",
    bio: "Ángulo de fase↓",
    rsk: "Pérdida funcional progresiva"
  },
  "N_A_A_A": {
    dx: "Fuerte-adiposo con inflamación → alto riesgo cardiometabólico",
    mec: "Inflamación crónica, estrés oxidativo, RI",
    bio: "PCR↑, HOMA‑IR↑, TG↑",
    rsk: "DM2, ECV, esteatohepatitis"
  },
  "N_A_A_N": {
    dx: "Adiposo inflamatorio con reserva → progresión a DM2",
    mec: "Adipocinas proinflamatorias",
    bio: "HOMA‑IR↑, PCR↑",
    rsk: "Riesgo CV aumentado"
  },
  "N_A_A_B": {
    dx: "Alta función pero inflamación y baja reserva → descompensación rápida",
    mec: "Inflamación limita respuesta al estrés",
    bio: "PCR↑, IFC normal",
    rsk: "Riesgo fallo funcional ante estrés"
  },
  "N_A_N_A": {
    dx: "Composición saludable comprometida por inflamación → DM2 emergente",
    mec: "Inflamación sistémica",
    bio: "HOMA‑IR↑, PCR↑",
    rsk: "Progresión metabólica"
  },
  "N_A_N_N": {
    dx: "Función normal con inflamación → riesgo de deterioro",
    mec: "Inflamación crónica",
    bio: "PCR↑",
    rsk: "Vigilancia y reducción de IRC"
  },
  "N_A_N_B": {
    dx: "Función normal con inflamación y baja grasa → riesgo catabolismo",
    mec: "Inflamación favorece catabolismo",
    bio: "PCR↑, albúmina↓",
    rsk: "Pérdida de masa si persiste"
  },
  "N_A_B_A": {
    dx: "Magro con inflamación y grasa → obesidad sarcopénica emergente",
    mec: "Lipotoxicidad + inflamación",
    bio: "HOMA‑IR↑, PCR↑",
    rsk: "Pérdida funcional acelerada"
  },
  "N_A_B_N": {
    dx: "Función normal pero inflamación y baja reserva → riesgo deterioro",
    mec: "Inflamación",
    bio: "PCR↑",
    rsk: "Intervención temprana"
  },
  "N_A_B_B": {
    dx: "Magro inflamado sin grasa → posible enfermedad inflamatoria sistémica",
    mec: "Inflamación no metabólica",
    bio: "PCR↑",
    rsk: "Pérdida funcional"
  },
  "N_N_A_A": {
    dx: "Fuerte-adiposo subclínico → riesgo metabólico moderado",
    mec: "Adiposidad visceral, inflamación moderada",
    bio: "HOMA‑IR↑, TG↑",
    rsk: "DM2, ECV si no se corrige"
  },
  "N_N_A_N": {
    dx: "Adiposo subclínico con reserva → prevención eficaz",
    mec: "Lipotoxicidad moderada",
    bio: "HOMA‑IR variable",
    rsk: "Intervención nutricional"
  },
  "N_N_A_B": {
    dx: "Adiposo con función normal y baja grasa → riesgo menor",
    mec: "Menor riesgo si visceral bajo",
    bio: "Biomarcadores normales",
    rsk: "Mantenimiento"
  },
  "N_N_N_A": {
    dx: "Composición saludable con grasa alta → riesgo de progresión",
    mec: "Depende de distribución grasa",
    bio: "HOMA‑IR variable",
    rsk: "Vigilancia"
  },
  "N_N_N_N": {
    dx: "Composición corporal saludable → bajo riesgo",
    mec: "Homeostasis metabólica",
    bio: "Biomarcadores normales",
    rsk: "Mantenimiento preventivo"
  },
  "N_N_N_B": {
    dx: "Funcional magro → buen pronóstico",
    mec: "Buena calidad muscular",
    bio: "IFC normal",
    rsk: "Mantener ingesta"
  },
  "N_N_B_A": {
    dx: "Atlético magro con grasa alta → riesgo según visceralidad",
    mec: "Si visceral bajo, riesgo menor",
    bio: "Medir cintura",
    rsk: "Ajustes dietéticos"
  },
  "N_B_A_A": {
    dx: "Adiposo sin inflamación → riesgo metabólico menor pero presente",
    mec: "Menor inflamación sistémica",
    bio: "PCR normal",
    rsk: "Reducir grasa visceral"
  },
  "N_B_A_N": {
    dx: "Adiposo con baja IRC → buena ventana de intervención",
    mec: "Intervención dietética",
    bio: "Biomarcadores controlables",
    rsk: "Buena respuesta"
  },
  "N_B_A_B": {
    dx: "Adiposo con baja IRC y baja grasa → bajo riesgo",
    mec: "Buen pronóstico",
    bio: "—",
    rsk: "Mantener"
  },
  "N_B_N_N": {
    dx: "Salud metabólica estable → bajo riesgo",
    mec: "Homeostasis",
    bio: "—",
    rsk: "Mantener"
  },
  "N_B_N_B": {
    dx: "Magro con baja IRC → excelente pronóstico",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  },
  "A_A_A_A": {
    dx: "Atleta adiposo con inflamación → riesgo CV a largo plazo",
    mec: "Inflamación crónica pese a alta función",
    bio: "PCR↑, HOMA‑IR↑",
    rsk: "Riesgo de ECV, DM2"
  },
  "A_A_A_N": {
    dx: "Fuerte-adiposo con alta función e IRC alto → riesgo metabólico",
    mec: "Adiposidad visceral + inflamación",
    bio: "HOMA‑IR↑",
    rsk: "Vigilancia y reducción grasa"
  },
  "A_A_A_B": {
    dx: "Alta función con inflamación y baja grasa → estrés sistémico",
    mec: "Inflamación no por grasa; investigar causas",
    bio: "PCR↑",
    rsk: "Riesgo de catabolismo"
  },
  "A_A_N_A": {
    dx: "Alta función con grasa alta e IRC alto → riesgo metabólico",
    mec: "Adiposidad visceral",
    bio: "HOMA‑IR↑",
    rsk: "Intervención necesaria"
  },
  "A_A_N_N": {
    dx: "Función óptima con IRC alto → riesgo inflamación crónica",
    mec: "Inflamación limita longevidad celular",
    bio: "PCR↑",
    rsk: "Reducir IRC"
  },
  "A_A_N_B": {
    dx: "Alta función, IRC alto, baja grasa → estrés por sobreentreno o inflamación no metabólica",
    mec: "Cortisol elevado, inflamación",
    bio: "Cortisol↑, PCR↑",
    rsk: "Ajustar carga"
  },
  "A_A_B_A": {
    dx: "Magro con alta función pero IRC alto → riesgo catabolismo por estrés",
    mec: "Eje HPA activado, inflamación",
    bio: "Cortisol↑, PCR↑",
    rsk: "Reducir estrés"
  },
  "A_A_B_N": {
    dx: "Alta función con IRC alto → vigilancia",
    mec: "—",
    bio: "PCR↑",
    rsk: "Ajustes recuperación"
  },
  "A_A_B_B": {
    dx: "Atleta óptimo con IRC alto → investigar fuente inflamatoria",
    mec: "Posible infección crónica o autoinmunidad",
    bio: "PCR↑, autoanticuerpos",
    rsk: "Tratar causa"
  },
  "A_N_A_A": {
    dx: "Atleta con grasa y IRC normal → riesgo moderado",
    mec: "Si visceral alto, riesgo",
    bio: "HOMA‑IR variable",
    rsk: "Reducir grasa"
  },
  "A_N_A_N": {
    dx: "Fuerte-adiposo con IFC alto → buen pronóstico funcional",
    mec: "Masa magra protege",
    bio: "—",
    rsk: "Reducir grasa visceral"
  },
  "A_N_A_B": {
    dx: "Alta función con grasa alta y baja IRC → mejor pronóstico",
    mec: "—",
    bio: "—",
    rsk: "Intervención electiva"
  },
  "A_N_N_A": {
    dx: "Alta función con grasa alta → vigilar visceralidad",
    mec: "—",
    bio: "—",
    rsk: "Reducir grasa si visceral"
  },
  "A_N_N_N": {
    dx: "Función óptima y composición normal → excelente pronóstico",
    mec: "Homeostasis",
    bio: "—",
    rsk: "Mantener"
  },
  "A_N_N_B": {
    dx: "Atlético magro con IFC alto → rendimiento y salud óptimos",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  },
  "A_N_B_A": {
    dx: "Atlético magro con grasa alta → riesgo según visceralidad",
    mec: "—",
    bio: "—",
    rsk: "Evaluar cintura"
  },
  "A_N_B_N": {
    dx: "Atlético magro con IFC alto → ideal para resistencia",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  },
  "A_N_B_B": {
    dx: "Atlético magro óptimo → máximo rendimiento y baja morbilidad",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  },
  "A_B_A_A": {
    dx: "Atleta con grasa pero baja IRC → mejor pronóstico que con IRC alto",
    mec: "—",
    bio: "—",
    rsk: "Reducir grasa por rendimiento"
  },
  "A_B_A_N": {
    dx: "Fuerte-adiposo con baja inflamación → riesgo menor",
    mec: "—",
    bio: "—",
    rsk: "Intervención electiva"
  },
  "A_B_A_B": {
    dx: "Atleta con grasa y baja IRC → buen pronóstico",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  },
  "A_B_N_A": {
    dx: "Alta función y baja IRC con grasa alta → riesgo controlable",
    mec: "—",
    bio: "—",
    rsk: "Reducir grasa si visceral"
  },
  "A_B_N_N": {
    dx: "Composición y función óptimas, baja inflamación → estado celular ideal",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  },
  "A_B_N_B": {
    dx: "Atlético magro con IFC alto y baja IRC → estado celular óptimo",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  },
  "A_B_B_A": {
    dx: "Atlético magro con grasa alta y baja IRC → riesgo bajo-moderado",
    mec: "—",
    bio: "—",
    rsk: "Evaluar distribución grasa"
  },
  "A_B_B_N": {
    dx: "Atlético magro con IFC alto y baja IRC → excelente resiliencia",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  },
  "A_B_B_B": {
    dx: "Atlético magro óptimo → mínimo riesgo",
    mec: "—",
    bio: "—",
    rsk: "Mantener"
  }
};

// ─── LABELS FyR BIS — del Excel "EFR Salidas" exactos ────────────────────────
// Columnas: [IFC Alto, IFC Normal, IFC Bajo] × Filas: [IRC Bajo, IRC Normal, IRC Alto]
const FYR_LABELS = {
  "3_1": {
    l: "Estado celular óptimo",
    c: "#059669"
  },
  "3_2": {
    l: "Estado fisiológico estable",
    c: "#10b981"
  },
  "3_3": {
    l: "Disfunción sin riesgo",
    c: "#22d3ee"
  },
  "2_1": {
    l: "Buen desempeño, señales tempranas",
    c: "#65a30d"
  },
  "2_2": {
    l: "Desempeño normal, riesgo moderado",
    c: "#f59e0b"
  },
  "2_3": {
    l: "Disfunción + riesgo creciente",
    c: "#ea580c"
  },
  "1_1": {
    l: "Alto desempeño, riesgo oculto",
    c: "#d97706"
  },
  "1_2": {
    l: "Función estable, riesgo elevado",
    c: "#dc2626"
  },
  "1_3": {
    l: "Estado crítico",
    c: "#7f1d1d"
  }
};

// Labels FFMI×FMI — del Excel "EFR Salidas" col 1
const STRUCT_LABELS = {
  "A_B": "Fenotipo atlético magro",
  "A_N": "Composición corporal saludable",
  "A_A": "Sobrepeso adiposo con masa conservada",
  "N_B": "Delgado funcional",
  "N_N": "Composición corporal saludable",
  "N_A": "Fenotipo fuerte–adiposo",
  "B_B": "Caquexia / Desnutrición proteico-energética",
  "B_N": "Obesidad sarcopénica oculta",
  "B_A": "Obesidad sarcopénica (SMM/Peso↓ + FMI↑)"
};

// ─── HELPER CLAVES ────────────────────────────────────────────────────────────
const kl = k => ({
  3: "A",
  2: "N",
  1: "B"
})[k] || "N";
// ── MOTOR DE REGLAS EFR (Diana) — compone SIEMPRE las tarjetas desde los 4 niveles ──
// Letras: IFC/FFMI → A=Alto(óptimo) · N=Normal · B=Bajo(adverso)
//          IRC/FMI  → A=Alto(adverso) · N=Normal · B=Bajo(óptimo)
const efrCompose = (i, r, f, m) => {
  const ifcAdv = i === "B", ircAdv = r === "A", ffmiAdv = f === "B", fmiAdv = m === "A";
  const adverse = ifcAdv || ircAdv || ffmiAdv || fmiAdv;
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  // 1) Enfermedades / complicaciones probables
  const dxP = [];
  if (ffmiAdv && fmiAdv) dxP.push("obesidad sarcopénica");
  if (fmiAdv) dxP.push("síndrome metabólico, resistencia a la insulina, DM2, hígado graso metabólico, dislipidemia");
  if (ffmiAdv && !fmiAdv) dxP.push("sarcopenia, desnutrición proteico-energética, fragilidad");
  if (ircAdv) dxP.push("inflamación sistémica de bajo grado con expansión extracelular/edema");
  if (ifcAdv) dxP.push("disfunción celular con riesgo nutricional");
  const dx = adverse ? cap(dxP.join("; ")) + "." : "No se identifican patologías asociadas: perfil de bajo riesgo, prioridad de mantenimiento.";
  // 2) Mecanismos bioquímicos / disfunción celular
  const mecP = [];
  if (ifcAdv) mecP.push("alteración de membrana y bomba Na⁺-K⁺-ATPasa (pérdida de integridad celular)");
  if (ircAdv) mecP.push("expansión del compartimento extracelular e inflamación de bajo grado");
  if (ffmiAdv) mecP.push("depleción de la reserva proteica y muscular");
  if (fmiAdv) mecP.push("lipotoxicidad y desregulación de adipoquinas");
  const mec = mecP.length ? cap(mecP.join("; ")) + "." : "Homeostasis celular y metabólica conservada.";
  // 3) Biomarcadores clave (puente bioeléctrico → bioquímico)
  const bioP = [];
  if (ifcAdv) bioP.push("albúmina/prealbúmina bajas, ángulo de fase reducido");
  if (ircAdv) bioP.push("PCR elevada, signos de sobrehidratación");
  if (fmiAdv) bioP.push("HOMA-IR elevado, glucemia y perfil lipídico alterados");
  if (ffmiAdv) bioP.push("creatinina/índice muscular bajos");
  const bio = bioP.length ? cap(bioP.join("; ")) + "." : "Biomarcadores dentro del rango esperado.";
  // 4) Riesgos clínicos
  let rsk;
  if (!adverse) rsk = "Mantenimiento y vigilancia periódica; bajo riesgo de progresión.";
  else {
    let s = "Progresión hacia anillos/radios externos de la diana con deterioro funcional";
    if (fmiAdv) s += " y complicaciones cardiometabólicas";
    if (ifcAdv && ffmiAdv) s += "; en la periferia, mayor mortalidad";
    rsk = s + ".";
  }
  // 5) Nutracéuticos VITACELLEBIS
  const ns = [], add = x => { if (ns.indexOf(x) < 0) ns.push(x); };
  if (ifcAdv) { add("OMEGA COMPLEX"); add("MITO-Q10 PLUS"); }
  if (ircAdv) { add("CURCUMIN BIOACTIV"); add("GUTIMMUNE PRO"); }
  if (ffmiAdv) { add("SARCO-PROTECT"); add("D3-K2 OSTEO"); }
  if (fmiAdv) { add("BERBERINA METABO"); add("HEPA DETOX"); add("D3-K2 OSTEO"); }
  add("MULTICELL BASE");
  return { dx: dx, mec: mec, bio: bio, rsk: rsk, n: ns.join(", ") };
};
// 6) Abordaje por profesión del rol logueado
const efrProf = (role, i, r, f, m) => {
  const ifcAdv = i === "B", ircAdv = r === "A", ffmiAdv = f === "B", fmiAdv = m === "A";
  const adverse = ifcAdv || ircAdv || ffmiAdv || fmiAdv;
  const R = (role || "").toLowerCase(), p = [];
  if (R.indexOf("med") >= 0) {
    if (fmiAdv) p.push("tamizaje cardiometabólico (HOMA-IR, perfil lipídico, función hepática)");
    if (ircAdv) p.push("evaluar inflamación (PCR) y estado de hidratación");
    if (ifcAdv) p.push("descartar causas de desnutrición/disfunción celular");
    if (ffmiAdv) p.push("valorar sarcopenia y comorbilidad");
    return p.length ? "Médico: " + p.join("; ") + "." : "Médico: control clínico de mantenimiento, sin banderas rojas.";
  }
  if (R.indexOf("psic") >= 0)
    return adverse ? "Psicólogo: intervención conductual en adherencia, hábitos y motivación al cambio."
                   : "Psicólogo: refuerzo de hábitos saludables y prevención de recaídas.";
  if (R.indexOf("entr") >= 0 || R.indexOf("deport") >= 0 || R.indexOf("ejerc") >= 0) {
    if (ffmiAdv) p.push("priorizar fuerza/hipertrofia para recuperar masa magra");
    if (fmiAdv) p.push("añadir trabajo aeróbico para reducir adiposidad");
    if (ifcAdv || ircAdv) p.push("progresión gradual, vigilar recuperación");
    return p.length ? "Deportólogo/Entrenador: " + p.join("; ") + "." : "Deportólogo/Entrenador: entrenamiento mixto de mantenimiento.";
  }
  if (fmiAdv) p.push("déficit calórico moderado con proteína ≥1,2 g/kg/día y patrón mediterráneo");
  if (ffmiAdv) p.push("aumentar aporte proteico y energético para recuperar masa magra");
  if (ifcAdv) p.push("optimizar densidad nutricional y micronutrientes");
  if (ircAdv) p.push("patrón antiinflamatorio, control de sodio e hidratación");
  return p.length ? "Nutricionista: " + p.join("; ") + "." : "Nutricionista: dieta de mantenimiento equilibrada, sin restricciones.";
};
const getDX = (ifcK, ircK, ffmiK, fmiK) => {
  const key = `${kl(ifcK)}_${kl(ircK)}_${kl(ffmiK)}_${kl(fmiK)}`;
  const base = DX[key] ? { ...DX[key] } : efrCompose(kl(ifcK), kl(ircK), kl(ffmiK), kl(fmiK));
  if (!base.n) {
    const i=kl(ifcK), r=kl(ircK), f=kl(ffmiK), m=kl(fmiK);
    // ── IFC BAJO (B) ─────────────────────────────────────────────
    if (i==="B" && r==="A" && f==="B" && m==="A")
      base.n = "OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, BERBERINA METABO, SARCO-PROTECT, HEPA-DETOX";
    else if (i==="B" && r==="A" && f==="N" && m==="A")
      base.n = "OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, BERBERINA METABO, HEPA-DETOX";
    else if (i==="B" && r==="A" && f==="A" && m==="A")
      base.n = "BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, HEPA-DETOX";
    else if (i==="B" && r==="A" && f==="B" && m==="N")
      base.n = "OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, SARCO-PROTECT, MULTI-CELL BASE";
    else if (i==="B" && r==="A" && f==="N" && m==="N")
      base.n = "OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, MULTI-CELL BASE";
    else if (i==="B" && r==="A" && f==="A" && m==="N")
      base.n = "OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE";
    else if (i==="B" && r==="A" && f==="B" && m==="B")
      base.n = "OMEGA COMPLEX, MITO-Q10 PLUS, SARCO-PROTECT, CURCUMIN BIOACTIV, MULTI-CELL BASE, D3-K2 OSTEO";
    else if (i==="B" && r==="A" && f==="N" && m==="B")
      base.n = "OMEGA COMPLEX, MITO-Q10 PLUS, CURCUMIN BIOACTIV, MULTI-CELL BASE, ADAPTO-STRESS";
    else if (i==="B" && r==="A" && f==="A" && m==="B")
      base.n = "OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE";
    // ── IFC BAJO + IRC NORMAL ────────────────────────────────────
    else if (i==="B" && r==="N" && f==="B" && m==="A")
      base.n = "BERBERINA METABO, OMEGA COMPLEX, MITO-Q10 PLUS, SARCO-PROTECT, HEPA-DETOX";
    else if (i==="B" && r==="N" && f==="N" && m==="A")
      base.n = "BERBERINA METABO, OMEGA COMPLEX, MITO-Q10 PLUS, HEPA-DETOX";
    else if (i==="B" && r==="N" && f==="A" && m==="A")
      base.n = "BERBERINA METABO, OMEGA COMPLEX, MITO-Q10 PLUS, HEPA-DETOX";
    else if (i==="B" && r==="N" && f==="B" && m==="N")
      base.n = "MITO-Q10 PLUS, SARCO-PROTECT, MULTI-CELL BASE, D3-K2 OSTEO, OMEGA COMPLEX";
    else if (i==="B" && r==="N" && f==="N" && m==="N")
      base.n = "MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE";
    else if (i==="B" && r==="N" && f==="A" && m==="N")
      base.n = "MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE";
    else if (i==="B" && r==="N" && f==="B" && m==="B")
      base.n = "SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE, OMEGA COMPLEX";
    else if (i==="B" && r==="N" && f==="N" && m==="B")
      base.n = "MITO-Q10 PLUS, MULTI-CELL BASE, OMEGA COMPLEX, ADAPTO-STRESS";
    else if (i==="B" && r==="N" && f==="A" && m==="B")
      base.n = "MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE";
    // ── IFC BAJO + IRC BAJO ──────────────────────────────────────
    else if (i==="B" && r==="B" && f==="B" && m==="A")
      base.n = "BERBERINA METABO, MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE";
    else if (i==="B" && r==="B" && f==="N" && m==="A")
      base.n = "BERBERINA METABO, MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE";
    else if (i==="B" && r==="B" && f==="A" && m==="A")
      base.n = "BERBERINA METABO, MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE";
    else if (i==="B" && r==="B" && f==="B" && m==="N")
      base.n = "SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE";
    else if (i==="B" && r==="B" && f==="N" && m==="N")
      base.n = "MITO-Q10 PLUS, MULTI-CELL BASE, OMEGA COMPLEX";
    else if (i==="B" && r==="B" && f==="A" && m==="N")
      base.n = "MITO-Q10 PLUS, MULTI-CELL BASE, OMEGA COMPLEX";
    else if (i==="B" && r==="B" && f==="B" && m==="B")
      base.n = "SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE, OMEGA COMPLEX, GUT-IMMUNE PRO";
    else if (i==="B" && r==="B" && f==="N" && m==="B")
      base.n = "MITO-Q10 PLUS, SARCO-PROTECT, MULTI-CELL BASE, D3-K2 OSTEO";
    else if (i==="B" && r==="B" && f==="A" && m==="B")
      base.n = "MITO-Q10 PLUS, MULTI-CELL BASE, OMEGA COMPLEX";
    // ── IFC NORMAL (N) ───────────────────────────────────────────
    else if (i==="N" && r==="A" && m==="A")
      base.n = "BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV, HEPA-DETOX";
    else if (i==="N" && r==="A" && f==="B")
      base.n = "OMEGA COMPLEX, CURCUMIN BIOACTIV, SARCO-PROTECT, MITO-Q10 PLUS";
    else if (i==="N" && r==="A")
      base.n = "OMEGA COMPLEX, CURCUMIN BIOACTIV, MITO-Q10 PLUS, MULTI-CELL BASE";
    else if (i==="N" && r==="N" && f==="B")
      base.n = "SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE";
    else if (i==="N" && r==="N" && m==="A")
      base.n = "BERBERINA METABO, OMEGA COMPLEX, MULTI-CELL BASE";
    else if (i==="N" && r==="N")
      base.n = "OMEGA COMPLEX, MULTI-CELL BASE, MITO-Q10 PLUS";
    else if (i==="N" && r==="B" && f==="B")
      base.n = "SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE, MITO-Q10 PLUS";
    else if (i==="N" && r==="B")
      base.n = "MULTI-CELL BASE, OMEGA COMPLEX, MITO-Q10 PLUS";
    // ── IFC ALTO (A) ─────────────────────────────────────────────
    else if (i==="A" && r==="A" && m==="A")
      base.n = "BERBERINA METABO, OMEGA COMPLEX, CURCUMIN BIOACTIV";
    else if (i==="A" && r==="A" && f==="B")
      base.n = "OMEGA COMPLEX, CURCUMIN BIOACTIV, SARCO-PROTECT, D3-K2 OSTEO";
    else if (i==="A" && r==="A")
      base.n = "OMEGA COMPLEX, CURCUMIN BIOACTIV, MULTI-CELL BASE";
    else if (i==="A" && r==="N" && f==="B")
      base.n = "SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE";
    else if (i==="A" && r==="N" && m==="A")
      base.n = "BERBERINA METABO, MULTI-CELL BASE, OMEGA COMPLEX";
    else if (i==="A" && r==="N")
      base.n = "MULTI-CELL BASE, OMEGA COMPLEX";
    else if (i==="A" && r==="B" && f==="B")
      base.n = "SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE";
    else if (i==="A" && r==="B")
      base.n = "MULTI-CELL BASE, OMEGA COMPLEX";
    // ── FALLBACK FINAL ───────────────────────────────────────────
    else
      base.n = "MULTI-CELL BASE, OMEGA COMPLEX, MITO-Q10 PLUS";
  }
  return base;
};

module.exports = { calcIFC, calcIRC, calcPABU, cIFC, cIRC, cPABU, cFMI, cFFMI, cISCM, cIEHH, cIAE, cAF, cIR, kl, DX, efrCompose, getDX, FYR_LABELS, STRUCT_LABELS };
