/* ═══════════════════════════════════════════════════════════════════════════
   ATLAS · MOTOR CLINICO ANI-BIS-E · NUCLEO CONGELADO (FROZEN CORE)
   Extraido VERBATIM de docs/entregas/Gildardo responses/ATLAS_v8.html (el "del 18",
   2026-08-18), region calcIFC..getDX. SWAP de Gildardo del 2026-08-19 (re-port del
   motor). NO EDITAR A MANO. Toda la ciencia (formulas, cortes, fenotipos) vive aqui.
   Cualquier cambio debe venir de Gildardo y romper el golden test si desalinea.

   Sincronizado con la entrega del 18. Cuatro cambios respecto de la base v7 anterior
   (todos con procedencia; ver PLAN_REPORT_MOTOR_2026-08-18 y DECISIONES_ANIBISE):
     · cPABU: de 8 situaciones (con ROJO) a 3 direccional (sin rojo). Q27 RESUELTO:
       "portenlo tal cual, y no lo graduen" (Gildardo 2026-08-17). Marcador DIRECCIONAL
       (hacia donde se desvia de phi=1,618), no de magnitud; el "cuanto" lo da el ICA-BIS.
     · cMMEM: unificado en EWGSOP2 (H<7,0 · M<5,5; antes M<5,7 y las ramas
       intercambiadas). DORMANT: nada lo consume; el clasificador de sarcopenia vivo es
       cASMI. NO cablear (duplicaria la señal de sarcopenia con otro corte).
     · cFMI: banda "Alto SS" femenina (9-12) del 2026-07-28. Porte FUERA de los diez
       puntos (anterior a la base del 05-ago); solo rotulo, k=3 sin cambio.
     · cISCM/cIEHH/cIAE: comentarios "sin distincion por sexo" (2026-07-28), sin cambio
       de codigo.
   (engine.dfi.js y los demas chunks tienen su propio encabezado y estado de sync.)
   ═══════════════════════════════════════════════════════════════════════════ */
// ─── v17 · EL SEXO SE NORMALIZA UNA SOLA VEZ, Y LA TABLA DEL ICA-BIS ──────────────────────────
// Las dos piezas son de su ATLAS_v17.html, verbatim. `sexoBIS` existe porque sus clasificadores
// reconocian una sola forma del dato ('M' pero no 'Masculino'), y la tabla es su Tabla 7.3 (n = 5.891).
const sexoBIS = s => (s === 'M' || s === 'Masculino') ? 'M' : (s === 'F' || s === 'Femenino') ? 'F' : null;
const ICA_BIS_REF = {
  F: { p10: -0.43, p25: -0.20, p75: 0.45, p90: 0.86 },
  M: { p10: -0.50, p25: -0.27, p75: 0.36, p90: 0.83 },
};
const calcIFC = (C, Rinf) => Rinf === 0 ? 0 : C / Rinf * 1000;
const calcIRC = (Re, Ri, C) => Ri * C === 0 ? 0 : (Re / (Ri * C)) * 10;
// PABU · constante k por sexo (cohorte 6.063): H=0,78 · M=0,46.
//
// ═══ v17: SIN SEXO YA NO SE CALCULA ═══
//
// Aqui habia un tercer caso, `k = 0,9` para el paciente sin sexo registrado. Su v17 lo retira con
// nombre y todo (*"la k = 0,9 queda retirada"*), y devuelve 0, que en su motor significa SIN DATO: una
// PABU calculada con una k que no es de nadie es una cifra inventada sobre una persona.
//
// EN LA NUBE SON DOS PACIENTES de 665 (medido el 2026-11-11). Para ellos la PABU, el ICA-BIS y el IFC
// pasan a decir "sin sexo: no se clasifica", que es la verdad, y se arregla registrando el sexo.
const calcPABU = (Re, Ri, Rinf, C, sexo) => {
  const s = sexoBIS(sexo);
  if (!s) return 0;
  const k = s === 'M' ? 0.78 : 0.46;
  return Rinf * C === 0 ? 0 : (Re + Ri) * k / (Rinf * C);
}

// ─── CLASIFICADORES BIS ───────────────────────────────────────────────────────
// Puntos de corte EXACTOS del Excel MAPA_RyF_BIS
// IFC por sexo (cohorte 6.063, P25/P75): H Bajo<4,12 Normal 4,12–6,68 Alto>6,68 · M Bajo<2,08 Normal 2,08–3,28 Alto>3,28
// (sin sexo → corte histórico 3,5/6,0). IFC alto = mejor función celular.
// ═══ v17: LOS CORTES SON LOS DE SU TABLA 6.1, Y SIN SEXO NO SE CLASIFICA ═══
//
// Antes: H 4,12 / 6,68 y M 2,08 / 3,28 (los percentiles del Excel MAPA_RyF_BIS), con caida al corte
// global 3,5 / 6,0 sin sexo. Su v17 fija los valores de REFERENCIA DEL SISTEMA (Tabla 6.1 del libro):
// H < 4,1 / 4,1-6,7 / > 6,7 y M < 2,1 / 2,1-3,3 / > 3,3, y retira el corte global.
//
// LAS VENTANAS DONDE ALGUIEN CAMBIA DE CATEGORIA son de 0,02 de ancho: mujeres en [2,08 · 2,10) pasan
// de Normal a Bajo y en (3,28 · 3,30] de Alto a Normal; hombres en [4,10 · 4,12) pasan de Bajo a
// NORMAL (mejoran) y en (6,68 · 6,70] de Alto a Normal. Medido en la nube: 4 de 441 consultas (0,9 %).
const cIFC = (v, sexo) => {
  const s = sexoBIS(sexo);
  if (!s) return { l: 'Sin sexo: no se clasifica', c: '#94a3b8', risk: null, k: 0 };
  const lo = s === 'M' ? 4.1 : 2.1;
  const hi = s === 'M' ? 6.7 : 3.3;
  return v > hi  ? { l: 'Función óptima',     c: '#1a7a4a', risk: 'bajo',     k: 3 }
    : v >= lo    ? { l: 'Alerta funcional',   c: '#e6a817', risk: 'moderado', k: 2 }
    : { l: 'Disfunción celular', c: '#c0392b', risk: 'alto',     k: 1 };
}
// IRC por sexo (Articulo_IRC_vs_IR, Tabla 3, cohorte 6.063, P25/P75): H Bajo<1,7 Normal 1,7–2,1 Alto>2,1
// · M Bajo<2,3 Normal 2,3–2,8 Alto>2,8. IRC alto = mayor riesgo.
//
// PORTE del ATLAS_v8 del 2026-08-29 (respuesta a la ronda del 28, punto 6). Dos cambios, y el segundo NO
// es cosmetico:
//   1. Los cortes pasan a los del articulo: 1,68/2,11 -> 1,7/2,1 y 2,27/2,85 -> 2,3/2,8.
//   2. SIN SEXO YA NO HAY CORTE PROPIO. Antes caia al 2,0/3,4 "historico", que segun su respuesta "no sale
//      de ninguna parte"; ahora cae al corte MASCULINO, que es el mas exigente, porque usar el femenino
//      subestimaria el riesgo de un hombre. Es el cambio con consecuencia clinica: un paciente sin sexo
//      registrado y con IRC 2,5 pasaba de "moderado" a ALTO.
//
// Y EL VALOR NO SE MULTIPLICA POR DIEZ AL MOSTRARLO: el x10 ya esta dentro de `calcIRC`. De ahi salia el
// 16,222 que le reportamos, de una tabla que multiplicaba lo ya multiplicado y lo comparaba contra una
// referencia sin multiplicar.
const cIRC = (v, sexo) => {
  const f = sexo === 'F' || sexo === 'Femenino';
  const lo = f ? 2.3 : 1.7;
  const hi = f ? 2.8 : 2.1;
  return v < lo  ? { l: 'Bajo riesgo',         c: '#1a7a4a', risk: 'bajo',     k: 1 }
    : v <= hi    ? { l: 'Riesgo moderado',     c: '#e6a817', risk: 'moderado', k: 2 }
    : { l: 'Alto riesgo celular', c: '#c0392b', risk: 'alto',     k: 3 };
};
// PABU · marcador DIRECCIONAL de desviación de φ=1,618 (cohorte 6.063).
// La PABU dice HACIA DÓNDE se desvía la célula, no cuánto:
//   · Por ENCIMA de φ → déficit estructural.
//   · Por DEBAJO de φ → exceso de adiposidad.
//   · Dentro de la zona φ → homeostasis (la mediana de quien no tiene deterioro es 1,61).
// La MAGNITUD del deterioro no se gradúa aquí: la establecen los indicadores
// estructurales (FMI, FFMI, ASMI, MCA), que es donde está definida. Duplicar esa
// graduación en la PABU añadiría bandas sin aportar información nueva.
// ═══ v17: LA ZONA FIJA DE ±0,15 SE REEMPLAZA POR LOS PERCENTILES DEL SEXO (su Tabla 7.3) ═══
//
// Antes esta funcion no recibia el sexo y usaba una zona φ de ±0,15 igual para todos, con dos
// etiquetas de direccion. Su v17 la lee contra la distribucion de referencia del sexo: rango habitual
// (P25 a P75), alejamiento LEVE (P75 a P90 o P10 a P25) y MARCADO (> P90 o < P10), cada uno con su
// direccion. Y ahora devuelve dos campos mas: `dir` (deficit / exceso) y `g` (0, 1 o 2), que son los
// que su §3 usa para las alertas criticas sin duplicar cortes.
//
// TODAS SUS LLAMADAS RECIBEN EL SEXO. Sin el, "sin sexo: no se clasifica", como el IFC.
const cPABU = (v, sexo) => {
  if (!v) return { l: 'Sin dato', c: '#94a3b8' };
  const s = sexoBIS(sexo);
  if (!s) return { l: 'Sin sexo: no se clasifica', c: '#94a3b8' };
  const r = ICA_BIS_REF[s], ica = v - 1.618;
  if (ica > r.p90)  return { l: 'Alejamiento marcado por déficit',   c: '#c0392b', dir: 'deficit', g: 2 };
  if (ica > r.p75)  return { l: 'Alejamiento leve por déficit',      c: '#e6a817', dir: 'deficit', g: 1 };
  if (ica >= r.p25) return { l: 'Rango habitual',                    c: '#1a7a4a', dir: null,      g: 0 };
  if (ica >= r.p10) return { l: 'Desplazamiento leve por exceso',    c: '#e6a817', dir: 'exceso',  g: 1 };
  return               { l: 'Desplazamiento marcado por exceso', c: '#c0392b', dir: 'exceso',  g: 2 };
}
const cAF = (v, sexo) => {
  const m = sexo === 'M' || sexo === 'Masculino';
  if (!v || v <= 0) return { l: 'Sin dato', c: '#94a3b8' };
  if (m) {
    if (v < 6.5) return { l: 'Bajo',   c: '#dc2626' };
    if (v <= 7.0) return { l: 'Normal', c: '#16a34a' };
    return              { l: 'Alto',   c: '#16a34a' };
  } else {
    if (v < 6.0) return { l: 'Bajo',   c: '#dc2626' };
    if (v <= 6.5) return { l: 'Normal', c: '#16a34a' };
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
// ═══ LA v17 REVIRTIO ESTA DECISION, Y LA DISTINCION ES FINA (2026-11-11) ═══
//
// Aqui decia: *"SIN DISTINCION POR SEXO - DELIBERADO. Confirmado por la direccion cientifica el
// 2026-07-28. No anadir umbrales por sexo... este indicador usa el mismo rango en hombres y mujeres"*.
//
// Su v17 §5 y §6 lo cambia, y conviene leerlo con cuidado porque las dos mitades no dicen lo mismo:
//
//   · LOS CORTES de este clasificador SIGUEN siendo iguales en los dos sexos, y su documento explica
//     por que: *"los cortes son los mismos en hombres y mujeres porque el indice ya esta expresado en
//     puntuaciones z por sexo"*;
//   · pero EL VALOR que entra aqui ya NO es el mismo para los dos: el IEHH y el ISCM-BIS se calculan
//     con las medias y desviaciones POR SEXO de su tabla de siete componentes (su §5).
//
// O sea que el sexo SI entra, un paso antes. Dejar el comentario viejo haria creer que no entra en
// ninguna parte, que es justo lo contrario de lo que su v17 hace.
//
// EL CALCULO POR SEXO TODAVIA NO ESTA PORTADO: es el paso 5 del porte (`engine.indices.js`, nueve
// lineas medidas). Hasta entonces este clasificador lee un valor calculado con z GLOBALES, y por eso
// este aviso esta aqui y no una nota que diga que ya se hizo.
// ═══ LOS CUATRO NIVELES DEL ISCM-BIS Y LOS CUATRO GRADOS DEL IEHH SE RETIRAN (v17 §5 y §6) ═══
//
// AQUI HABIA DOS CLASIFICADORES Y LOS DOS SE REEMPLAZAN POR SU BLOQUE DE LA v17, verbatim:
//
//   · `cISCM` graduaba en cuatro niveles ("ISCM-1 Bajo riesgo" a "ISCM-4 Alta susceptibilidad"). Su
//     §6 los RETIRA: *"el libro retiró los cuatro niveles de susceptibilidad hasta validar el ISCM-BIS
//     frente a biomarcadores cardiometabólicos"*. Ahora `cISCM(valor, sexo)` devuelve solo la UBICACION
//     del valor entre los percentiles de su sexo, como dato. No gradua, no colorea un veredicto.
//
//   · `cIEHH` graduaba desde 0 ("Óptimo" ≤ 0, "Leve", "Moderado", "Severo"), o sea que trataba el cero
//     como el mejor valor posible y solo miraba hacia arriba. Su §5 lo cambia a TRES ZONAS simetricas
//     (< −1 déficit · −1 a +1 óptimo · > +1 capacitancia alta), porque el indice ya es una z: el valor
//     bueno es el CENTRO, y alejarse por abajo es tan informativo como por arriba. Es lo que hace que el
//     dominio 1 sume en las dos direcciones.
//
// Y LOS CORTES SIGUEN SIENDO IGUALES EN LOS DOS SEXOS, que es la distincion fina que ya estaba escrita
// aqui: *"los cortes son los mismos en hombres y mujeres porque el índice ya está expresado en
// puntuaciones z por sexo"*. Lo que cambio es el VALOR que entra, y eso se calcula en
// `engine.indices.js` con `calcIEHH_ISCM` y las referencias de su tabla de siete componentes.
const ISCM_REF = {
  F: { p10: -3.72, p25: -2.09, p50: -0.35, p75: 1.80, p90: 4.32 },
  M: { p10: -4.02, p25: -2.12, p50: 0.03,  p75: 2.02, p90: 4.19 },
};
const cISCM = (v, sexo) => {
  if (v == null || isNaN(v)) return { l: "Sin dato", c: "#94a3b8", banda: null };
  const s = sexoBIS(sexo);
  if (!s) return { l: "Sin sexo: sin percentil", c: "#94a3b8", banda: null };
  const r = ISCM_REF[s];
  const banda = v < r.p10 ? "< P10" : v < r.p25 ? "P10 a P25" : v <= r.p75 ? "P25 a P75" : v <= r.p90 ? "P75 a P90" : "> P90";
  return { l: banda + " de su sexo", c: "#475569", banda };
};
// Percentiles de referencia del ISCM-BIS del sexo, para mostrarlos como referencia.
const iscmRefTxt = sexo => { const s = sexoBIS(sexo); return s === "M" ? "P25 a P75: −2,12 a 2,02 (H)" : s === "F" ? "P25 a P75: −2,09 a 1,80 (M)" : "Sin sexo"; };
// v17 · IEHH en tres zonas (libro, Tabla 8.2). Los cortes son los mismos en hombres y
// mujeres porque el índice ya está expresado en puntuaciones z por sexo.
//   < −1 déficit · −1 a +1 óptimo (rango de referencia) · > +1 capacitancia relativa alta
const cIEHH = v => v < -1 ? {
  l: "Déficit",
  c: "#ea580c",
  zona: -1
} : v <= 1 ? {
  l: "Óptimo",
  c: "#10b981",
  zona: 0
} : {
  l: "Capacitancia alta",
  c: "#f59e0b",
  zona: 1
};
// ═══ LA v17 REVIRTIO ESTA DECISION, Y LA DISTINCION ES FINA (2026-11-11) ═══
//
// Aqui decia: *"SIN DISTINCION POR SEXO - DELIBERADO. Confirmado por la direccion cientifica el
// 2026-07-28. No anadir umbrales por sexo... este indicador usa el mismo rango en hombres y mujeres"*.
//
// Su v17 §5 y §6 lo cambia, y conviene leerlo con cuidado porque las dos mitades no dicen lo mismo:
//
//   · LOS CORTES de este clasificador SIGUEN siendo iguales en los dos sexos, y su documento explica
//     por que: *"los cortes son los mismos en hombres y mujeres porque el indice ya esta expresado en
//     puntuaciones z por sexo"*;
//   · pero EL VALOR que entra aqui ya NO es el mismo para los dos: el IEHH y el ISCM-BIS se calculan
//     con las medias y desviaciones POR SEXO de su tabla de siete componentes (su §5).
//
// O sea que el sexo SI entra, un paso antes. Dejar el comentario viejo haria creer que no entra en
// ninguna parte, que es justo lo contrario de lo que su v17 hace.
//
// EL CALCULO POR SEXO TODAVIA NO ESTA PORTADO: es el paso 5 del porte (`engine.indices.js`, nueve
// lineas medidas). Hasta entonces este clasificador lee un valor calculado con z GLOBALES, y por eso
// este aviso esta aqui y no una nota que diga que ya se hizo.
// IAE crudo (EB-BIS − edad cronológica), en años. Cortes ±5 años, coherentes con la referencia
// "−5 a +5 años" usada en los informes. <−5 desacelerado · −5..+5 concordante · >+5 acelerado.
// SIN DISTINCION POR SEXO — DELIBERADO. Confirmado por la direccion cientifica
// el 2026-07-28. No anadir umbrales por sexo por analogia con IFC, IRC, FMI o
// FFMI: este indicador usa el mismo rango en hombres y mujeres.
const cIAE = v => v <= -5 ? {
  l: "Desacelerado",
  t: "Envejecimiento desacelerado estimado",
  c: "#10b981"
} : v < 5 ? {
  l: "Concordante",
  t: "Acorde con sus pares",
  c: "#f59e0b"
} : {
  l: "Acelerado",
  t: "Envejecimiento acelerado estimado",
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
} : v <= 12 ? {
  // Banda «Alto SS» añadida el 2026-07-28 por indicación de la dirección
  // científica: faltaba en mujeres, que pasaban de Normal directo a Alto CS.
  // Fronteras 9–12, espejo de la masculina (6–9) desplazada por sexo, y
  // coherentes con _fmiElev, que marca elevado a partir de 9 en mujeres.
  l: "Alto SS",
  c: "#f59e0b",
  k: 3
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
// v17 · MCCB (libro, Tabla 10.2: percentiles 25 y 75 de la base consolidada, por sexo).
// Gobiernan el sector de la Diana, el fenotipo MCCB y el dominio Metabólico-Estructural.
// cFFMI y cFMI quedan solo para sus banderas clínicas (sospecha de anabolizantes), no para fenotipar.
const MCCB_CORTES = {
  F: { fmi: [5.0, 8.1], ffmi: [15.5, 17.1] },
  M: { fmi: [3.7, 6.4], ffmi: [18.8, 21.0] },
};
const _mccbK = (v, lo, hi) => v < lo ? 1 : v <= hi ? 2 : 3;
const _mccbCl = (v, sexo, eje) => {
  const s = sexoBIS(sexo);
  if (!s || !(Number(v) > 0)) return { l: "Sin dato", k: 0 };
  const [lo, hi] = MCCB_CORTES[s][eje];
  const k = _mccbK(Number(v), lo, hi);
  return { l: ["Bajo", "Normal", "Alto"][k - 1], k };
};
const cFFMI_MCCB = (v, sexo) => _mccbCl(v, sexo, "ffmi");
const cFMI_MCCB  = (v, sexo) => _mccbCl(v, sexo, "fmi");
// Sectores de la Diana (libro, Tabla 11.2) y gravedad base del dominio 2 (decisión del 7-nov-2026).
const MCCB_SECTORES = [
  { id: "S1", fn: 3, fm: 1, fen: "Atlético magro",            g: 0 },
  { id: "S2", fn: 3, fm: 2, fen: "Atlético",                  g: 0 },
  { id: "S3", fn: 2, fm: 1, fen: "Magro funcional",           g: 0 },
  { id: "S4", fn: 2, fm: 2, fen: "Composición saludable",     g: 0 },
  { id: "S5", fn: 3, fm: 3, fen: "Obesidad muscular",         g: 1 },
  { id: "S6", fn: 2, fm: 3, fen: "Obesidad con masa normal",  g: 1 },
  { id: "S7", fn: 1, fm: 1, fen: "Desnutrición bilateral",    g: 3 },
  { id: "S8", fn: 1, fm: 2, fen: "Normal-sarcopénica",        g: 2 },
  { id: "S9", fn: 1, fm: 3, fen: "Obesidad sarcopénica",      g: 3 },
];
const sectorMCCB = (ffmi, fmi, sexo) => {
  const a = cFFMI_MCCB(ffmi, sexo).k, b = cFMI_MCCB(fmi, sexo).k;
  return (a && b) ? MCCB_SECTORES.find(x => x.fn === a && x.fm === b) : null;
};
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
// MMEM/Peso — índice apendicular. Umbrales: masculino < 7,0 · femenino < 5,5 kg/m².
// UNIFICADO EN EWGSOP2 el 2026-08-18 por la dirección científica. Antes el
// umbral femenino era 5,7 (AWGS2019) mientras `cASMI`, la fila ASMI de la
// tabla, `REF_POB.asmi` y el diagnóstico de sarcopenia por fuerza prensil
// (27/16 Kgf) usaban EWGSOP2. Es el MISMO índice: una misma mujer con ASMI
// 5,6 quedaba «Normal» en una fila y «Bajo» en la otra.
// OJO con la notación: aquí `s === "M"` significa MASCULINO, no mujer. El comentario
// anterior usaba "H/M" para hombre/mujer y las dos ramas quedaron intercambiadas: el
// hombre se evaluaba contra 5,7 y la mujer contra 7,0, de modo que ambos sexos se
// clasificaban mal. Corregido el 2026-07-28 por indicación de la dirección científica.
const cMMEM = (v, s) => s === "M" ? v < 7.0 ? {
  l: "Bajo",
  c: "#ef4444"
} : {
  l: "Normal",
  c: "#10b981"
} : v < 5.5 ? {
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
    l: "Función normal con riesgo",
    c: "#22d3ee"
  },
  "2_1": {
    l: "Función con bajo riesgo",
    c: "#65a30d"
  },
  "2_2": {
    l: "Función sin riesgo",
    c: "#f59e0b"
  },
  "2_3": {
    l: "Función con riesgo",
    c: "#ea580c"
  },
  "1_1": {
    l: "Disfunción con bajo riesgo",
    c: "#d97706"
  },
  "1_2": {
    l: "Disfunción sin riesgo",
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
  if (fmiAdv) p.push("déficit calórico moderado con patrón mediterráneo");
  if (ffmiAdv) p.push("aumentar el aporte energético para recuperar masa magra");
  if (ifcAdv) p.push("optimizar densidad nutricional y micronutrientes");
  if (ircAdv) p.push("patrón antiinflamatorio, control de sodio e hidratación");
  return p.length ? "Nutricionista: " + p.join("; ") + "." : "Nutricionista: dieta de mantenimiento equilibrada, sin restricciones.";
};
const getDX = (ifcK, ircK, ffmiK, fmiK) => {
  const key = `${kl(ifcK)}_${kl(ircK)}_${kl(ffmiK)}_${kl(fmiK)}`;
  const _comp = efrCompose(kl(ifcK), kl(ircK), kl(ffmiK), kl(fmiK));
  const _dxE = DX[key] || {};
  // Caida campo por campo: la raya "—" es ausencia de texto, no texto. Unifica el
  // comportamiento con el visor de los 81 estados (4-sep-2026). No se toca `n`.
  const _fb = (a, b) => { const s = (a == null ? "" : String(a)).trim(); return (s === "" || s === "\u2014" || s === "-") ? b : a; };
  const base = { ..._dxE, dx: _fb(_dxE.dx, _comp.dx), mec: _fb(_dxE.mec, _comp.mec), bio: _fb(_dxE.bio, _comp.bio), rsk: _fb(_dxE.rsk, _comp.rsk) };
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
