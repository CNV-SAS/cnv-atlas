/* ═══════════════════════════════════════════════════════════════════════════
   ATLAS · MOTOR CLÍNICO ANI-BIS-E — DFI + LE8 (FROZEN CORE 3)
   Extraído VERBATIM del prototipo de Gildardo:
     · calcLE8              (ICEC / Life's Essential 8)   ← SINCRONIZADO con la entrega
       VIGENTE (gildardo-2026-07-30, L6509–6590): trae el interruptor LE8_MAPEO_CORREGIDO
       (en OFF) y el mapeo del ICEC dormido. Comportamiento IDÉNTICO al anterior (con el
       switch en off corre la rama vieja). ANCLADO por DIFF-dfi contra esa región.
     · helpers _dfi*, computeDFI, computeDFIFromData (árbol de 5 dominios + rutas).
   NO EDITAR A MANO. Depende del núcleo congelado (engine.core.js).

   ESTADO DE SINCRONÍA: calcLE8 (2026-08-01) y _ffmiLow (2026-08-05) al día con el vigente. Re-port
   2026-08-19: PABU al DOMINIO 1 (punto 1 del delta del 18) portado QUIRURGICAMENTE contra el archivo
   del 18 (Santiago, opcion B): computeDFI gana la línea de PABU en los items del Dominio 1 y las
   anotaciones de "corte" por sexo (sexoRef) en IFC/IRC; computeDFIFromData provee pabu/pabuCl/sexoRef
   (deps ya en scope: pabu, esMasc; cPABU importado del core). El resto de computeDFI en el 18 (parrafo
   redactado + metas por profesion, spec ATLAS_DFI_y_Metas v1.0) NO se porto: es feature de Tratamiento,
   se trae cuando se construya esa etapa (ver INVENTARIO_TRATAMIENTO). calcLE8 diffeado contra el 18:
   IDENTICO (ICEC apagado y habitos moderados ya alineados, dos de los diez puntos verificados).
   engine.core.js quedo re-sincronizado con el 18 el 2026-08-19 (cPABU direccional, Q27 resuelto).

   ⚠️ EL INTERRUPTOR LE8_MAPEO_CORREGIDO NO SE TOCA A MANO. Parece un flag de config
   (por el nombre), pero es ciencia: activarlo (false→true) es C1, va por el MECANISMO
   de modificaciones autorizadas y tiene su entrada en CAMBIOS_AUTORIZADOS.md. Un flip
   a mano ROMPE DIFF-dfi (la constante está dentro de la región comparada; verificado
   ejecutando). Y flipearlo SOLO no hace nada: calcPatron no está portado (la rama de
   Alimentación cae al catch → 30) y d7_agua no está en la encuesta (Hidratación → 20),
   así que ambos dominios quedan en los mismos defaults. C1 real = portar calcPatron
   (C9) + capturar d7_agua en la encuesta + el flip. Mueve la EB-BIS 1–8 años (Q26).

   NOTA (bug latente preservado, decisión de Gildardo): en computeDFIFromData
   'sexoM' se usa en el cálculo de 'pabu' una línea antes de declararse (TDZ).
   No truena mientras 'bis' traiga PABU precalculado (flujo normal). Se preserva
   verbatim; corregir en el fuente si se desea.
   ═══════════════════════════════════════════════════════════════════════════ */
const { calcIFC, calcIRC, calcPABU, cPABU, cIFC, cIRC, cFMI, cFFMI, cIEHH, cIAE } = require('./engine.core.js');

// ─── MAPEO DEL LE8 A LOS CAMPOS QUE LA ENCUESTA SÍ CAPTURA ──────────────────
// Los campos d1_9, d1_10 y d1_16 que lee calcLE8 NO existen en la encuesta: solo
// viven en el objeto DEMO, y por eso el defecto pasó inadvertido (al probar con el
// caso demo, el LE8 parecía funcionar). En un paciente real las tres lecturas dan 0
// y los dominios Alimentación e Hidratación quedan clavados en 30 y 20, para todos.
//
// Mapeo correcto, confirmado por la dirección científica el 2026-07-28:
//   Alimentación → calcPatron(enc).score   · 0-100, calculado sobre d1_1_i … d1_15_i
//   Hidratación  → enc.d7_agua             · vasos de 200 ml, la misma unidad que
//                                            esperaba d1_16
//
// ⚠️ DESACTIVADO A PROPÓSITO — NO PONER EN true SIN RESOLVER LO SIGUIENTE.
// Activarlo baja la EB-BIS de TODOS los pacientes entre 1 y 8 años (más cuanto más
// sano está el paciente), porque el ICEC deja de estar artificialmente deprimido.
// Antes hay que establecer de dónde salieron la media 58,578 y la desviación 13,332
// del ICEC en la ecuación EB-BIS v5:
//   · si se calcularon sobre un ICEC correcto → activar esto CORRIGE un sesgo real
//     y las edades biológicas emitidas hasta hoy estaban infladas;
//   · si se calcularon sobre el ICEC ya roto  → μ y σ incorporan el sesgo y hay que
//     recalibrarlas ANTES, o todos quedarán con edad biológica demasiado joven.
const LE8_MAPEO_CORREGIDO = false;

// Diagnóstico LE8 simplificado
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
  const agua = LE8_MAPEO_CORREGIDO
    ? (Number(enc.d7_agua) || 0)          // vasos de 200 ml que la encuesta sí captura
    : (Number(enc.d1_16)   || 0);         // campo histórico inexistente → siempre 0
  const tabaco = enc.d3_30 || "";
  const alcohol = enc.d3_31 || "";
  const suenho = enc.d3_26 || "";
  scores.push({
    dom: "Actividad física",
    v: metMin >= 150 ? 100 : metMin >= 75 ? 60 : metMin > 0 ? 30 : 0
  });
  scores.push({
    dom: "Alimentación",
    v: LE8_MAPEO_CORREGIDO
      ? (function(){ try { var _p = calcPatron(enc); return (_p && _p.score != null) ? _p.score : 30; }
                     catch (e) { return 30; } })()
      : ((Number(enc.d1_9) || 0) >= 3 && (Number(enc.d1_10) || 0) >= 2 ? 100 : (Number(enc.d1_9) || 0) >= 2 ? 60 : 30)
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
    items:[
      `IFC ${_dfiFmt(idx.ifc)} (${ifcL}${idx.sexoRef?.ifc ? " — corte " + idx.sexoRef.ifc : ""})`,
      `IRC ${_dfiFmt(idx.irc)} (${ircL}${idx.sexoRef?.irc ? " — corte " + idx.sexoRef.irc : ""})`,
      // La PABU faltaba en el dominio pese a estar declarada en la estructura del
      // diagnóstico. Se cita con su dirección respecto de φ y la k del sexo.
      `PABU ${_dfiFmt(idx.pabu)} ${idx.sexoRef?.pabu ? idx.sexoRef.pabu + " " : ""}→ ${idx.pabuCl?.l || "-"}${idx.icaBis != null ? " · desviación de φ " + (idx.icaBis >= 0 ? "+" : "") + _dfiFmt(idx.icaBis) : ""}`,
      `IEHH ${_dfiFmt(idx.iehh)} (${idx.iehhCl?.l||"-"})`
    ] };
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
  // RE-SYNC 2026-08-05 (desfase corregido): delega en el clasificador cFFMI (verbatim del vigente v8,
  // L10882/L13306) en vez del literal viejo 17.92/15.64. Beneficio: si Gildardo mueve el corte de cFFMI,
  // _ffmiLow se mueve con el AUTOMATICAMENTE (unificado con la frontera de desnutricion). Nuestro cFFMI
  // ya usa H<17 / M<15. Alimenta _obSarc -> structL -> Dominio 2 del DFI (no toca structural sellado,
  // MCCB ni R4, que ya usan el corte correcto). Anclado por DIFF contra el v8 (frozen-dfi-ffmilow-diff).
  const _ffmiLow = FFMI > 0 && cFFMI(FFMI, esMasc ? 'M' : 'F').k === 1;
  const _asmiLow = _asmi > 0 && _asmi < (esMasc ? 7.0 : 5.5);
  const _smmwLow = _smmw > 0 && _smmw < (esMasc ? 27 : 22); // mujer 24 -> 22 (Gildardo §1 2026-08-19: barrido del umbral; 2o sitio, ver DECISIONES P-24)
  const _obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow);
  const _idx = {
    ifc, irc, iehh, iscm, iae, ebBis, icaBis, pabu,
    // Referencias del sexo del paciente, para que el DFI las pueda citar en vez de
    // dejar sólo la etiqueta Alto/Normal/Bajo, que no dice contra qué se comparó.
    sexoRef: {
      ifc:  esMasc ? "H: <4,12 bajo · 4,12–6,68 normal · >6,68 alto" : "M: <2,08 bajo · 2,08–3,28 normal · >3,28 alto",
      irc:  esMasc ? "H: <1,7 bajo · 1,7–2,1 normal · >2,1 alto" : "M: <2,3 bajo · 2,3–2,8 normal · >2,8 alto",
      pabu: esMasc ? "k=0,78 (H)" : "k=0,46 (M)"
    },
    pabuCl: { l: cPABU(pabu).l },
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
