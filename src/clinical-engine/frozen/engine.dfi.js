/* ═══════════════════════════════════════════════════════════════════════════
   ATLAS · MOTOR CLÍNICO ANI-BIS-E — DFI + LE8 (FROZEN CORE 3)
   Extraído VERBATIM de ATLAS_v7.html (prototipo final de Gildardo):
     · calcLE8              L6467–6520   (ICEC / Life's Essential 8)
     · helpers _dfi*        L11297–11302
     · computeDFI           L11304–11381 (árbol de 5 dominios + rutas)
     · computeDFIFromData   L9456–9504   (adaptador encuesta+BIS → DFI)
   NO EDITAR A MANO. Depende del núcleo congelado (engine.core.js).

   NOTA (bug latente preservado, decisión de Gildardo): en computeDFIFromData
   'sexoM' se usa en el cálculo de 'pabu' una línea antes de declararse (TDZ).
   No truena mientras 'bis' traiga PABU precalculado (flujo normal). Se preserva
   verbatim; corregir en el fuente si se desea.
   ═══════════════════════════════════════════════════════════════════════════ */
const { calcIFC, calcIRC, calcPABU, cIFC, cIRC, cFMI, cFFMI, cIEHH, cIAE } = require('./engine.core.js');

// ── calcLE8 (ICEC) ──
const calcLE8 = enc => {
  const scores = [];
  const dx = Array.isArray(enc.d5_39) ? enc.d5_39 : [];
  const dias = parseInt(enc.d3_23) || 0;
  const mins = {
    "Menos de 15": 10,
    "15–30 min": 22,
    "30–45 min": 37,
    "45–60 min": 52,
    "Más de 60 min": 75
  }[enc.d3_24] || 0;
  const metMin = dias * mins;
  const agua = Number(enc.d1_16) || 0;
  const tabaco = enc.d3_30 || "";
  const alcohol = enc.d3_31 || "";
  const suenho = enc.d3_26 || "";
  scores.push({
    dom: "Actividad física",
    v: metMin >= 150 ? 100 : metMin >= 75 ? 60 : metMin > 0 ? 30 : 0
  });
  scores.push({
    dom: "Alimentación",
    v: (Number(enc.d1_9) || 0) >= 3 && (Number(enc.d1_10) || 0) >= 2 ? 100 : (Number(enc.d1_9) || 0) >= 2 ? 60 : 30
  });
  scores.push({
    dom: "Tabaco",
    v: tabaco === "Nunca he fumado" ? 100 : tabaco.includes("Dejé hace 5") ? 80 : tabaco.includes("Dejé") ? 50 : tabaco.includes("ocasional") ? 20 : 0
  });
  scores.push({
    dom: "Sueño",
    v: suenho === "7–8 horas" ? 100 : suenho === "6–7 horas" ? 75 : suenho === "5–6 horas" ? 40 : 10
  });
  scores.push({
    dom: "Glucosa",
    v: dx.includes("Diabetes tipo 2") ? 20 : dx.includes("Prediabetes") ? 50 : 100
  });
  scores.push({
    dom: "Colesterol",
    v: dx.includes("Dislipidemia (colesterol alto)") ? 30 : 100
  });
  scores.push({
    dom: "Presión arterial",
    v: dx.includes("HTA") || enc.d5_36 === "Sí" ? 30 : 100
  });
  scores.push({
    dom: "Hidratación",
    v: agua >= 8 ? 100 : agua >= 6 ? 75 : agua >= 4 ? 50 : 20
  });
  const total = Math.round(scores.reduce((s, x) => s + x.v, 0) / scores.length);
  return {
    scores,
    total
  };
};

// ── helpers DFI ──
const _dfiCap3 = n => Math.max(0, Math.min(3, n));
const _DFI_PMAP = { muy_delgado:"bajo_grasa", delgado:"bajo_grasa", normal:"normal", sobrepeso:"exceso", obesidad:"exceso" };
const _DFI_RISK = ["vomito","laxantes","diureticos","ayuno","ayuno_prolongado","ejercicio_excesivo"];
function _dfiFmt(v){ return v==null||isNaN(v) ? "-" : (Math.round(v*100)/100).toString().replace(".",","); }
function _dfiSigned(v){ const n=Math.round((v||0)*10)/10; return (n>=0?"+":"")+n.toString().replace(".",","); }
function _dfiIsLimiting(v){ return v && !["no","nunca","buena","alta","siempre_disponible",""].includes(v); }

// ── computeDFI (árbol de 5 dominios) ──
function computeDFI({ idx, dv={}, bc={}, pt={}, icec={}, perc={}, hab={}, soc={}, epi={} }){
  if(!idx) return null;
  const famHx = (epi.famHx||[]).filter(f=>f && String(f).toLowerCase()!=="ninguna");
  // ---- Dominio 1 · Celular-Eléctrico (IFC × IRC, matiz IEHH) ----
  const ifcL = idx.ifcCl?.l, ircL = idx.ircCl?.l;
  const D1 = { "Alto|Bajo":0,"Alto|Normal":1,"Normal|Bajo":1,"Alto|Alto":2,"Normal|Normal":2,"Bajo|Bajo":2,"Normal|Alto":2,"Bajo|Normal":3,"Bajo|Alto":3 };
  let s1 = D1[`${ifcL}|${ircL}`]; if(s1==null) s1=1;
  const iehhAlt = idx.iehhCl && (idx.iehhCl.l==="Moderado"||idx.iehhCl.l==="Alto");
  if(iehhAlt) s1=_dfiCap3(s1+1);
  const dom1 = { id:"d1", nombre:"Celular-Eléctrico", icon:"🔬", sev:s1,
    clasif: idx.frL || `IFC ${ifcL} · IRC ${ircL}`,
    lectura: s1>=3?"Función celular comprometida con microambiente hostil.":s1===2?"Estado celular en presión: vigilar función y riesgo.":s1===1?"Función conservada con señal de riesgo a observar.":"Homeostasis celular: membranas íntegras y microambiente equilibrado.",
    items:[`IFC ${_dfiFmt(idx.ifc)} (${ifcL})`,`IRC ${_dfiFmt(idx.irc)} (${ircL})`,`IEHH ${_dfiFmt(idx.iehh)} (${idx.iehhCl?.l||"-"})`] };
  // ---- Dominio 2 · Metabólico-Estructural (ISCM-BIS × fenotipo) ----
  const iscmMap = { Bajo:0, Leve:1, Moderado:2, Alto:3 };
  let s2 = iscmMap[idx.iscmCl?.l] ?? 1;
  const fen = idx.structL || "";
  if(/Sarcop|Déficit|Deficit/i.test(fen)) s2=_dfiCap3(s2+1);
  const dom2 = { id:"d2", nombre:"Metabólico-Estructural", icon:"❤️", sev:s2,
    clasif:`ISCM ${idx.iscmCl?.l||"-"} · ${fen||"fenotipo N/C"}`,
    lectura: s2>=3?"Susceptibilidad cardiometabólica alta; fenotipo de riesgo.":s2===2?"Vulnerabilidad metabólica o fenotipo a corregir.":s2===1?"Susceptibilidad leve: prevención eficaz.":"Perfil metabólico-estructural favorable.",
    items:[`ISCM-BIS ${_dfiFmt(idx.iscm)} (${idx.iscmCl?.l||"-"})`,`Fenotipo: ${fen||"N/C"}`,`FMI ${_dfiFmt(dv.fmi)} · FFMI ${_dfiFmt(dv.ffmi)}`] };
  // ---- Dominio 3 · Envejecimiento (EB-BIS · IAE) ----
  const iae = idx.iae ?? 0;
  let s3;
  if(idx.iaeCl?.l==="Enlentecido") s3=0;
  else if(idx.iaeCl?.l==="Concordante") s3 = iae>3?1:0;
  else s3 = iae>10?3:2;
  const dom3 = { id:"d3", nombre:"Envejecimiento", icon:"⏳", sev:s3,
    clasif:`IAE ${_dfiSigned(iae)} años · ${idx.iaeCl?.l||"-"}`,
    lectura: s3>=3?"Envejecimiento biológico marcadamente acelerado.":s3===2?"Envejecimiento acelerado: intervenir sobre función y masa.":s3===1?"Ritmo en el límite superior de lo esperado.":"Ritmo de envejecimiento esperado o enlentecido.",
    items:[`EB-BIS ${_dfiFmt(idx.ebBis)} años`,`Edad cronológica ${pt.edad ?? "-"} años`,`IAE ${_dfiSigned(iae)} años`] };
  // ---- Dominio 4 · Conductual-Perceptual ----
  let s4=0, veto=false; const f4=[];
  const methods = perc.methods||[];
  const tca = methods.some(m=>_DFI_RISK.includes(m));
  if(tca){ s4=3; veto=true; f4.push("Conducta de riesgo (posible TCA)"); }
  const distor = perc.bodyImage && _DFI_PMAP[perc.bodyImage] && idx.fmiCat && _DFI_PMAP[perc.bodyImage]!==idx.fmiCat;
  if(distor){ s4=Math.max(s4,2); f4.push("Distorsión de imagen corporal"); if(s4>=2) veto=veto||tca; }
  if(["frecuente","siempre","alto"].includes(perc.lossControl)){ s4=Math.max(s4,2); f4.push("Pérdida de control alimentario"); }
  if(["muy_insatisfecho","insatisfecho"].includes(perc.satisfaction)){ s4=Math.max(s4,1); f4.push("Insatisfacción corporal"); }
  const dom4 = { id:"d4", nombre:"Conductual-Perceptual", icon:"🪞", sev:s4, veto,
    clasif: s4>=3?"Conducta de riesgo":s4===2?"Distorsión / desajuste":s4===1?"Señal leve":"Sin distorsión",
    lectura: s4>=3?"Prioridad psicológica; excluye intervención nutricional restrictiva.":s4===2?"Distorsión o desajuste conductual: abordaje psicológico.":s4===1?"Señal conductual a vigilar.":"Relación con el cuerpo y la comida sin alertas.",
    items: f4.length?f4:["Percepción congruente con el fenotipo real"] };
  // ---- Dominio 5 · Epigenético-Contextual (ICEC/LE8 · contexto) ----
  const icecTotal = icec.total ?? null;
  let s5;
  if(icecTotal==null) s5=1;
  else if(icecTotal>=80) s5=0;
  else if(icecTotal>=50) s5 = famHx.length>=3?2:1;
  else s5=3;
  const barrera = _dfiIsLimiting(soc.insec) || _dfiIsLimiting(soc.access);
  if(barrera) s5=_dfiCap3(s5+1);
  const dom5 = { id:"d5", nombre:"Epigenético-Contextual", icon:"🧬", sev:s5,
    clasif:`ICEC ${icecTotal==null?"-":Math.round(icecTotal)} · ${icec.cl?.l||"-"}`,
    lectura: s5>=3?"Carga epigenética alta o barreras estructurales del contexto.":s5===2?"Carga contextual amplificada por antecedentes o entorno.":s5===1?"Carga contextual moderada y modificable.":"Estilo de vida y contexto protectores.",
    items:[`ICEC/LE8 ${icecTotal==null?"-":Math.round(icecTotal)} (${icec.cl?.l||"-"})`,`Antecedentes familiares: ${famHx.length||0}`, barrera?"Barreras del contexto presentes":"Sin barreras estructurales mayores"] };
  const domains=[dom1,dom2,dom3,dom4,dom5];
  // ---- Síntesis · Riesgo integrado (ponderado) ----
  const W=[0.30,0.25,0.15,0.15,0.15];
  const score01 = domains.reduce((a,d,i)=>a+W[i]*(d.sev/3),0);
  let nivel = score01<0.20?0:score01<0.45?1:score01<0.70?2:3;
  const anySev3 = domains.some(d=>d.sev===3);
  if(anySev3) nivel=Math.max(nivel,2);
  if(veto && (dom1.sev>=2||dom2.sev>=2)) nivel=3;
  if(dom1.sev===3 && dom2.sev===3) nivel=3;
  if(dom4.sev===3) nivel=Math.max(nivel,2);
  const NIV=[{l:"BAJO",c:"#10b981",d:"Mantenimiento y optimización"},{l:"MEDIO",c:"#f59e0b",d:"Intervención dirigida y educativa"},{l:"ALTO",c:"#ea580c",d:"Intervención activa priorizada"},{l:"CRÍTICO",c:"#ef4444",d:"Intervención inmediata y seguimiento intensivo"}];
  const rutas=[];
  if(dom1.sev>=2) rutas.push("R1 · Restauración Celular");
  if(dom2.sev>=2) rutas.push("R2 · Reducción Cardiometabólica");
  if(dom4.veto||dom4.sev===3) rutas.push("R3 · Conductual (prioritaria)");
  if(dom3.sev>=2) rutas.push("R4 · Desaceleración Envejecimiento");
  if(dom5.sev>=2) rutas.push("R5 · Contextual");
  if(!rutas.length) rutas.push("R6 · Mantenimiento");
  return { domains, riesgo:{...NIV[nivel], score:Math.round(score01*100)}, veto, rutas };
}

// ── computeDFIFromData (adaptador) ──
const computeDFIFromData = (enc, bis) => {
  const d = { ...(enc || {}), ...(bis || {}) };
  const _norm = s => (s == null ? "" : String(s)).trim().toLowerCase();
  const _pick = (m, v, fb) => (m[_norm(v)] !== undefined ? m[_norm(v)] : (fb !== undefined ? fb : ""));
  const num = (...ks) => { for (const k of ks) { const n = Number(d[k]); if (d[k] != null && d[k] !== "" && !isNaN(n)) return n; } return 0; };
  const Re = num("Re"), Ri = num("Ri"), Rinf = num("Rinf"), C = num("C");
  // Índices: usar el valor ya calculado; si falta, derivar de Cole-Cole (como el panel DFI).
  const ifc = num("IFC", "ifc") || calcIFC(C, Rinf),
        irc = num("IRC", "irc") || calcIRC(Re, Ri, C),
        pabu = num("PABU", "pabu") || calcPABU(Re, Ri, Rinf, C, sexoM);
  const iehh = num("IEHH", "iehh"), iscm = num("ISCM", "iscm"), iae = num("IAE", "iae"),
        ebBis = num("EB_BIS", "eb", "ebBis"), FMI = num("FMI", "fmi"), FFMI = num("FFMI", "ffmi");
  const icaBis = num("ICA_BIS", "icaBis") || (pabu ? pabu - 1.618 : null);
  const sexoM = (d.sexo === "Masculino" || d.sexo === "M") ? "M" : "F";
  const esMasc = sexoM === "M";
  const ifcK = cIFC(ifc, sexoM).k, ircK = cIRC(irc, sexoM).k, _fmiK = cFMI(FMI, sexoM).k;
  const edad = Number(d.edad) || null;
  const _asmi = num("ASMI"), _smmw = num("SMM_W", "smmW");
  const _fmiElev = esMasc ? FMI > 6.0 : FMI > 9.0;
  const _ffmiLow = esMasc ? (FFMI > 0 && FFMI < 17.92) : (FFMI > 0 && FFMI < 15.64);
  const _asmiLow = _asmi > 0 && _asmi < (esMasc ? 7.0 : 5.5);
  const _smmwLow = _smmw > 0 && _smmw < (esMasc ? 27 : 24);
  const _obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow);
  const _idx = {
    ifc, irc, iehh, iscm, iae, ebBis, icaBis,
    ifcCl: { l: ifcK === 3 ? "Alto" : ifcK === 2 ? "Normal" : "Bajo" },
    ircCl: { l: ircK === 1 ? "Bajo" : ircK === 2 ? "Normal" : "Alto" },
    iehhCl: { l: (() => { const x = cIEHH(iehh).l; return x === "Severo" ? "Alto" : x; })() },
    iscmCl: { l: (iscm <= -1 ? "Bajo" : iscm <= 1 ? "Leve" : iscm <= 2.5 ? "Moderado" : "Alto") },
    iaeCl: { l: (() => { const x = cIAE(iae || 0).l; return x === "Desacelerado" ? "Enlentecido" : x; })() },
    fmiCat: (_fmiK <= 1 ? "bajo_grasa" : _fmiK === 2 ? "normal" : "exceso"),
    structL: _obSarc ? "Obesidad sarcopénica" : ("Fenotipo " + cFMI(FMI, sexoM).l + "/" + cFFMI(FFMI, sexoM).l)
  };
  const _perc = {
    bodyImage: _pick({ "muy delgado/a": "muy_delgado", "delgado/a": "delgado", "normal": "normal", "sobrepeso": "sobrepeso", "obesidad": "obesidad" }, d.d2_19),
    methods: (Array.isArray(d.d2_21) ? d.d2_21 : []).map(m => _pick({ "vómito": "vomito", "vomito": "vomito", "laxantes": "laxantes", "ayunos": "ayuno", "ejercicio excesivo": "ejercicio_excesivo" }, m, null)).filter(Boolean),
    lossControl: _pick({ "frecuentemente": "frecuente", "siempre": "siempre" }, d.d2_22, _norm(d.d2_22)),
    satisfaction: _pick({ "muy insatisfecho/a": "muy_insatisfecho", "insatisfecho/a": "insatisfecho" }, d.d2_20, _norm(d.d2_20))
  };
  const _soc = {
    access: _pick({ "sí, siempre": "siempre_disponible", "si, siempre": "siempre_disponible", "a veces es difícil": "a_veces", "generalmente es difícil": "dificil" }, d.d8_61),
    insec: _pick({ "no, nunca": "no", "a veces": "a_veces", "frecuentemente": "frecuente" }, d.d8_62)
  };
  const _epi = { famHx: (Array.isArray(d.d5_38) ? d.d5_38 : []).filter(f => f && _norm(f) !== "ninguna") };
  let _t = null; try { _t = (calcLE8(d) || {}).total; if (_t == null) _t = null; } catch (e) { _t = null; }
  const _icec = { total: _t, cl: _t == null ? { l: "-" } : _t >= 80 ? { l: "Ideal" } : _t >= 50 ? { l: "Intermedio" } : { l: "Bajo" } };
  const _hasBis = !!(ifc || irc || iscm || iehh);
  return _hasBis ? computeDFI({ idx: _idx, dv: { fmi: FMI, ffmi: FFMI }, pt: { edad }, icec: _icec, perc: _perc, soc: _soc, epi: _epi }) : null;
};

module.exports = { calcLE8, computeDFI, computeDFIFromData };
