// EXTRACTO VERBATIM de docs/entregas/Gildardo responses/ATLAS_v8.html (2026-08-19), lineas 12863-13010.
// Fuente VIGENTE del computeDFI de Gildardo (helpers + _DFI_RISK + computeDFI con parrafo/metas). Solo para el
// golden diferencial de dfi-narrative: NO es codigo de la app. computeDFI lee idx.*.l directo (sin clasificadores
// externos), asi que el slice es self-contained. Generado por sed 2026-08-22; si Gildardo cambia la narrativa,
// re-extraer de la entrega vigente. eslint-disable
/* eslint-disable */
const _dfiCap3 = n => Math.max(0, Math.min(3, n));
const _DFI_PMAP = { muy_delgado:"bajo_grasa", delgado:"bajo_grasa", normal:"normal", sobrepeso:"exceso", obesidad:"exceso" };
const _DFI_RISK = ["vomito","laxantes","diureticos","ayuno","ayuno_prolongado","ejercicio_excesivo"];
function _dfiFmt(v){ return v==null||isNaN(v) ? "-" : (Math.round(v*100)/100).toString().replace(".",","); }
function _dfiSigned(v){ const n=Math.round((v||0)*10)/10; return (n>=0?"+":"")+n.toString().replace(".",","); }
function _dfiIsLimiting(v){ return v && !["no","nunca","buena","alta","siempre_disponible",""].includes(v); }

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
  // -- (A) DFI redactado como parrafo + (B) metas por profesional --
  // Spec: ATLAS_DFI_y_Metas_Terapeuticas_por_Profesional v1.0. El parrafo es la
  // transcripcion de los 5 dominios (no redaccion libre); la meta se deriva de las rutas.
  var _seg1 = "El paciente " + (ifcL==="Alto"?"conserva una función celular óptima":ifcL==="Normal"?"presenta una función celular en rango normal":"muestra disfunción celular")
    + " " + (ircL==="Bajo"?"con riesgo celular bajo":ircL==="Normal"?"con riesgo celular en rango normal":"con riesgo celular elevado, compatible con inflamación de bajo grado")
    + (iehhAlt?" y signos de alteración del espectro de hidratación (expansión extracelular)":"");
  var _iscmW = ({Bajo:"baja",Leve:"leve",Moderado:"intermedia",Alto:"elevada"})[idx.iscmCl && idx.iscmCl.l] || "intermedia";
  var _seg2 = "en el dominio metabólico-estructural presenta susceptibilidad cardiometabólica " + _iscmW + (fen?(" con un fenotipo estructural de " + String(fen).replace(/^Fenotipo\s+/i,"").toLowerCase()):"");
  var _aeL = idx.iaeCl && idx.iaeCl.l;
  var _seg3 = _aeL==="Enlentecido" ? "su ritmo de envejecimiento es más lento que su edad cronológica"
    : (s3>=2 ? ("su envejecimiento biológico está acelerado (" + Math.round(Math.abs(iae)) + " años por encima de lo esperado)") : "su ritmo de envejecimiento es acorde con su edad cronológica");
  var _seg4 = "en lo conductual-perceptual " + (s4>=3?"hay distorsión marcada de la imagen corporal y conductas alimentarias de riesgo":s4===2?"hay preocupación moderada por la imagen corporal":s4===1?"hay preocupación leve por la imagen corporal":"no hay distorsión de la imagen corporal");
  var _seg5 = "y la carga contextual y de estilo de vida es " + (s5<=0?"baja (entorno favorable)":s5===1?"moderada":"alta (determinantes desfavorables)");
  var _acts = [];
  if(dom1.sev>=2) _acts.push({k:"R1", pr: dom1.sev===3?1:2, nom:"Ruta 1 (Restauración Celular)"});
  if(dom2.sev>=2) _acts.push({k:"R2", pr: dom2.sev===3?1:2, nom:"Ruta 2 (Reducción Cardiometabólica)"});
  if(dom4.veto||dom4.sev===3) _acts.push({k:"R3", pr: veto?0:1, nom:"Ruta 3 (Conductual)"});
  if(dom3.sev>=2) _acts.push({k:"R4", pr: dom3.sev===3?1:2, nom:"Ruta 4 (Desaceleración del Envejecimiento)"});
  if(dom5.sev>=2) _acts.push({k:"R5", pr: 2, nom:"Ruta 5 (Contextual)"});
  if(!_acts.length) _acts.push({k:"R6", pr: 3, nom:"Ruta 6 (Mantenimiento)"});
  _acts.sort(function(a,b){return a.pr-b.pr;});
  var _prW = function(p){ return p===0?"crítica":p===1?"prioritaria":p===2?"complementaria":"de mantenimiento"; };
  var _rutasTxt = _acts.map(function(a){return a.nom+", "+_prW(a.pr);}).join("; ");
  var _nivelW = String(NIV[nivel].l||"").toLowerCase();
  var _parrafo = _seg1 + "; " + _seg2 + "; " + _seg3 + "; " + _seg4 + "; " + _seg5 + ". El perfil configura un riesgo integrado " + _nivelW + ", que activa las siguientes rutas de atención: " + _rutasTxt + ".";
  var _OBJ = {
    R1:{nutricion:"aportar densidad nutricional y proteína suficiente por sexo para superar la disfunción celular y reducir el riesgo celular, corrigiendo déficits", medicina:"descartar y tratar la causa subyacente del deterioro celular y corregir los déficits de micronutrientes", ejercicio:"instaurar entrenamiento de fuerza progresivo para mejorar la función celular y preservar la masa magra", psicologia:"asegurar la adherencia al plan y manejar el estrés que sostiene el deterioro"},
    R2:{nutricion:"instaurar un patrón antiinflamatorio con un timing adecuado para reducir la susceptibilidad cardiometabólica", medicina:"evaluar y tratar los factores de riesgo cardiometabólico", ejercicio:"combinar fuerza y trabajo aeróbico o interválico tolerado para mejorar el perfil cardiometabólico", psicologia:"consolidar hábitos y manejar el estrés asociado al riesgo"},
    R3:{nutricion:"acompañar la normalización de la alimentación sin restricción ni control del peso, reforzando una relación funcional con la comida", medicina:"valorar la evaluación psiquiátrica y descartar complicaciones", ejercicio:"suspender el ejercicio excesivo o compensatorio", psicologia:"iniciar terapia cognitivo-conductual para la imagen corporal y las conductas alimentarias de riesgo, con derivación a evaluación psiquiátrica si hay conductas compensatorias"},
    R4:{nutricion:"asegurar proteína alta por sexo y un patrón antiinflamatorio para desacelerar el envejecimiento biológico", medicina:"descartar y tratar comorbilidades y valorar la derivación a geriatría", ejercicio:"priorizar el entrenamiento de fuerza para prevenir o revertir la sarcopenia", psicologia:"sostener hábitos, sueño y manejo del estrés"},
    R5:{nutricion:"educar y resolver las barreras de acceso para mejorar la carga contextual", medicina:"controlar la presión arterial y tamizar los factores del estilo de vida", ejercicio:"prescribir actividad física accesible y sostenible", psicologia:"trabajar el sueño, el estrés y los determinantes sociales"},
    R6:{nutricion:"sostener el estado óptimo alcanzado y mantener la trayectoria del PABU cercana a phi (1,618)", medicina:"sostener el estado óptimo alcanzado y vigilar la trayectoria clínica", ejercicio:"sostener el estado óptimo alcanzado en su ámbito", psicologia:"sostener los hábitos y el bienestar alcanzados"}
  };
  var _ROLN = {nutricion:"nutrición", medicina:"medicina", ejercicio:"ejercicio", psicologia:"psicología"};
  var _metaDe = function(rol){
    var ph = _acts.map(function(a){ return _OBJ[a.k] && _OBJ[a.k][rol]; }).filter(Boolean);
    if(veto){
      if(rol==="nutricion"){
        ph = [_OBJ.R3.nutricion];
        if(dom1.sev>=2) ph.push("aportando la densidad nutricional y la proteína necesarias para superar la disfunción celular");
        if(dom3.sev>=2) ph.push("y asegurando proteína alta para desacelerar el envejecimiento");
      } else {
        var r3 = _OBJ.R3[rol]; if(r3){ ph = [r3].concat(ph.filter(function(x){return x!==r3;})); }
      }
    }
    if(!ph.length) ph = [_OBJ.R6[rol]];
    var txt = "Meta de " + _ROLN[rol] + ": " + ph.join("; ") + ".";
    if(rol==="nutricion"||rol==="ejercicio"){
      var med = [];
      if(dom1.sev>=2 && ifcL==="Bajo") med.push("mejora del IFC de al menos 0,5 unidades y salida del rango de disfunción");
      if(dom3.sev>=2) med.push("reducción del IAE de al menos 2 años");
      if(med.length) txt += " Meta a 24 semanas: " + med.join(" y ") + ".";
    }
    if(veto && rol==="nutricion") txt += " Dado que coexiste una alteración conductual, la intervención se realiza sin restricción ni control del peso.";
    return txt;
  };
  var _metas = { nutricion:_metaDe("nutricion"), medicina:_metaDe("medicina"), ejercicio:_metaDe("ejercicio"), psicologia:_metaDe("psicologia") };
  return { domains, riesgo:{...NIV[nivel], score:Math.round(score01*100)}, veto, rutas, parrafo:_parrafo, metas:_metas };
}

export { computeDFI };
