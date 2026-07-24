/**
 * atlas-motores-tratamiento.js
 * Motores deterministas de tratamiento por rol. Reemplazan el modelo calorico por Mifflin x FA prescrita.
 *
 * Dependencias externas: Leen campos de enc (d5_39,d5_36,d7_57,peso,talla,edad,sexo) y bis (FFMI,FMI,IEHH,AEC,ACT). Sin React ni DOM.
 * Extraido de ATLAS_v7.html (estado actual, 2026-07-23).
 */

function motorTratNutri(enc, bis, edit){
  edit = edit || {}; var e = enc||{}, b = bis||{};
  var sexoM = (b.sexo==='M'||b.sexo==='Masculino'||e.sexo==='M'||e.sexo==='Masculino');
  var edad = Number(e.edad||b.edad)||30;
  var talla = Number(b.talla||e.talla||e.tallaCm||b.tallaCm)||170;
  var pesoAct = Number(b.peso||e.peso)||70;
  var imc = talla>0 ? pesoAct/Math.pow(talla/100,2) : 0;
  var PI = sexoM ? (talla-100-((talla-150)/4)) : (talla-100-((talla-150)/2.5));
  var pesoAjust = imc>=25 ? PI+0.25*(pesoAct-PI) : pesoAct;
  var pesoMeta = Number(edit.peso_meta)>0 ? Number(edit.peso_meta) : ((imc>=25||imc<18.5) ? Math.max(1,Math.round(PI)) : pesoAct);
  // A1 GEB Mifflin-St Jeor (medicion, peso actual)
  var geb = Math.round(sexoM ? (10*pesoAct+6.25*talla-5*edad+5) : (10*pesoAct+6.25*talla-5*edad-161));
  // A2 FA de la actividad PRESCRITA
  var FA_MAP = {sedentario:1.2, ligera:1.375, moderada:1.55, alta:1.725, muy_alta:1.9};
  var faNivel = edit.fa_nivel || (function(){ try { return motorTratEjercicio(enc,bis).faRec; } catch(_x){ return "ligera"; } })();
  var fa = FA_MAP[faNivel] || 1.375;
  var get = Math.round(geb*fa);
  // condiciones (encuesta + composicion objetiva IV-V)
  var dx = (Array.isArray(e.d5_39)?e.d5_39:[]).map(function(x){return String(x).toLowerCase();});
  var fam = (Array.isArray(e.d5_38)?e.d5_38:[]).map(function(x){return String(x).toLowerCase();});
  var hasHTA = dx.some(function(d){return /hipert|hta/.test(d);}) || e.d5_36==="Sí";
  var hasDM = dx.some(function(d){return /diabet/.test(d);});
  var hasDislip = dx.some(function(d){return /dislip|colesterol|triglic/.test(d);});
  var hasERC = dx.some(function(d){return /renal|erc/.test(d);});
  var hasCancer = dx.some(function(d){return /c[áa]ncer/.test(d);});
  var FMI=Number(b.FMI||e.FMI)||0, FFMI=Number(b.FFMI||e.FFMI)||0, ASMI=Number(b.ASMI||e.ASMI)||0;
  var obesidad = imc>=30 || (sexoM?FMI>6:FMI>9);
  var sarcopenia = (FFMI>0&&(sexoM?FFMI<17:FFMI<15)) || (ASMI>0&&(sexoM?ASMI<7:ASMI<5.5));
  var desnutricion = imc>0 && imc<18.5;
  var tca = (Array.isArray(e.d2_21)?e.d2_21:[]).some(function(m){return /v[óo]mito|laxante|ayuno|excesivo/i.test(String(m));}) || !!edit.tcaFlag;
  var protKg=1.0, deficit=0, tipoEnergia="Normocalórica", attrs=[], notas=[], refs=[];
  // PARTE C/D protocolos con precedencia
  if(hasCancer || desnutricion){
    tipoEnergia="Hipercalórica"; protKg=1.25;
    attrs.push(desnutricion?"Densidad energética y proteica alta, fraccionada":"Hiperproteica, densidad energética alta");
    notas.push("Prioriza recuperar el estado nutricional; el control de peso se pospone.");
    if(desnutricion) notas.push("Vigilar realimentación (fosfato, potasio, magnesio); iniciar 10-15 kcal/kg si hay riesgo (ASPEN).");
    refs.push(hasCancer?"ESPEN 2021 (cáncer); ESMO":"GLIM (ESPEN/ASPEN/FELANPE); ESPEN hospital; ASPEN");
  } else if(obesidad){
    deficit = 500; tipoEnergia="Hipocalórica"; protKg = sarcopenia?1.4:1.3;
    attrs.push("Densidad energética baja","Fibra alta","Controlada en carbohidratos concentrados","Azúcares añadidos bajos");
    if(sarcopenia){ attrs.push("Hiperproteica (preserva masa magra)"); notas.push("Obesidad con baja masa magra: déficit moderado + proteína alta + fuerza."); }
    refs.push("AND AWM 2014; AHA/ACC/TOS 2013; NICE CG189");
  } else if(sarcopenia){
    tipoEnergia="Normocalórica"; protKg=1.4;
    attrs.push("Hiperproteica (leucina)","25-40 g de proteína por comida en 3-4 tomas");
    notas.push("Acompañar SIEMPRE de entrenamiento de fuerza.");
    refs.push("EWGSOP2 2019; PROT-AGE 2013; ESPEN 2014");
  }
  // ERC manda sobre proteína alta
  if(hasERC){ protKg=0.7; attrs.push("Nefroprotectora","Proteína controlada 0,6-0,8 g/kg"); notas.push("ERC: proteína baja bajo guía de nefrología (precede a la proteína alta)."); refs.push("KDIGO 2024; KDOQI 2020; ESPEN renal 2021"); }
  // sodio (mas restrictivo se conserva)
  var sodioMax=null;
  if(hasHTA){ sodioMax=1500; attrs.push("Hiposódica (<1.500 mg Na)","Patrón DASH"); refs.push("OMS; DASH/NHLBI; AHA/ACC 2025; ESC/ESH"); }
  if(hasERC){ sodioMax = sodioMax? Math.min(sodioMax,2000):2000; }
  if(hasDM){ attrs.push("Controlada en CHO concentrados","Bajo índice glucémico"); refs.push("ADA; ALAD 2019; EASD"); }
  var grasaSatMax=null;
  if(hasDislip){ grasaSatMax=7; attrs.push("Baja en grasas saturadas (<7%)","Cardioprotectora (MUFA/PUFA, fibra soluble)"); refs.push("AHA; ESC/EAS; NLA"); }
  // Hidratación / desequilibrio hídrico (ANI BIS-E, PARTE C [OTROS]): sed y AEC/IEHH altos.
  var _iehh=Number(b.iehh||b.IEHH||e.iehh)||0, _aec=Number(b.AEC||e.AEC)||0, _act=Number(b.ACT||e.ACT)||0;
  var _aecPct=(_aec&&_act)?(_aec/_act*100):0;
  var _sed=/frecuente|siempre/i.test(String(e.d7_57||""));
  var hidrAlt=_iehh>1 || _aecPct>44 || _sed;
  if(hidrAlt){ attrs.push("Control de sodio e hidratación guiada"); notas.push("Alteración hídrica o sed reportada: reforzar hidratación guiada y control de sodio."); if(!sodioMax) sodioMax=2000; refs.push("ANI BIS-E; OMS (sodio)"); }
  // deficit editable
  if(edit.deficit!==undefined && String(edit.deficit)!=="" && !isNaN(Number(edit.deficit))) deficit=Number(edit.deficit);
  // SALVAGUARDA TCA: pausa el objetivo hipocalorico
  var pausadoTCA=false;
  if(tca && deficit>0){ deficit=0; tipoEnergia="Normocalórica (sin restricción por seguridad)"; pausadoTCA=true; notas.unshift("Riesgo de conducta alimentaria: se PAUSA el objetivo hipocalórico; remitir a valoración especializada."); }
  // objetivo calorico
  var kcalObjetivo;
  if(hasCancer||desnutricion){ kcalObjetivo = Math.round(27.5*pesoAct); }
  else { kcalObjetivo = get - deficit; }
  if(deficit>0){ var piso = sexoM?1500:1200; kcalObjetivo = Math.max(piso, kcalObjetivo); }
  kcalObjetivo = Math.round(kcalObjetivo);
  if(Number(edit.kcal_obj)>0) kcalObjetivo = Number(edit.kcal_obj);
  if(!pausadoTCA && !hasCancer && !desnutricion){ tipoEnergia = kcalObjetivo>get ? "Hipercalórica" : (kcalObjetivo<get ? "Hipocalórica" : "Normocalórica"); }
  var fatPct = hasDislip?25:30;
  var protG = Math.round(protKg*pesoMeta);
  var fatG = Math.round(kcalObjetivo*fatPct/100/9);
  var choG = Math.round(Math.max(0,(kcalObjetivo-protG*4-fatG*9))/4);
  var actividad = { aerob:"150-300 min/sem moderada (o 75-150 vigorosa)", fuerza:"2 o más días/sem, grandes grupos musculares", remision:"Remitir a deportología para modalidad, intensidad y progresión." };
  if(sarcopenia||obesidad||hasCancer) actividad.fuerza="Fuerza progresiva 2-3 días/sem (imprescindible en este perfil)";
  refs.push("Actividad: OMS 2020; ACSM; PAG Americans 2018");
  var etiqueta = "Dieta "+tipoEnergia+" de "+kcalObjetivo+" kcal/día";
  var chips = ["Proteína "+String(protKg).replace(".",",")+" g/kg"].concat(attrs);
  var alertaFam = fam.filter(function(f){return /diabet|hipert|cardiov|c[áa]ncer|obesidad/.test(f);});
  var _refs=[]; refs.forEach(function(r){ if(_refs.indexOf(r)<0) _refs.push(r); });
  return { geb:geb, fa:fa, faNivel:faNivel, get:get, kcalObjetivo:kcalObjetivo, deficit:deficit, tipoEnergia:tipoEnergia, etiqueta:etiqueta, protKg:protKg, protG:protG, fatPct:fatPct, fatG:fatG, choG:choG, sodioMax:sodioMax, grasaSatMax:grasaSatMax, chips:chips, attrs:attrs, notas:notas, refs:_refs, actividad:actividad, pausadoTCA:pausadoTCA, alertaFam:alertaFam, pesoAct:pesoAct, pesoMeta:pesoMeta, pesoAjust:pesoAjust, imc:imc };
}

function motorTratMedico(enc, bis){
  var e=enc||{}, b=bis||{};
  var dx=(Array.isArray(e.d5_39)?e.d5_39:[]).map(function(x){return String(x).toLowerCase();});
  var meds=(Array.isArray(e.d5_40)?e.d5_40:[]).map(function(x){return String(x).toLowerCase();});
  var hasHTA=dx.some(function(d){return /hipert|hta/.test(d);})||e.d5_36==="Sí";
  var hasDM=dx.some(function(d){return /diabet/.test(d);});
  var hasDislip=dx.some(function(d){return /dislip|colesterol|triglic/.test(d);});
  var hasERC=dx.some(function(d){return /renal|erc/.test(d);});
  var talla=Number(b.talla||e.talla||e.tallaCm||b.tallaCm)||170, peso=Number(b.peso||e.peso)||0;
  var imc=(talla>0&&peso>0)?peso/Math.pow(talla/100,2):0;
  var obesidad=imc>=30;
  var FFMI=Number(b.FFMI||e.FFMI)||0, ASMI=Number(b.ASMI||e.ASMI)||0, sexoM=(b.sexo==="M"||b.sexo==="Masculino"||e.sexo==="M"||e.sexo==="Masculino");
  var sarco=(FFMI>0&&(sexoM?FFMI<17:FFMI<15))||(ASMI>0&&(sexoM?ASMI<7:ASMI<5.5))||(imc>0&&imc<18.5);
  var metas=[], monitoreo=[], remision=[], medNotas=[], refs=[];
  if(hasHTA){ metas.push("Presión arterial <130/80 mmHg (idealmente SBP <120)"); if(hasDM||hasERC) metas.push("Preferir IECA o ARA II"); monitoreo.push("PA en consulta y ambulatoria; electrolitos y función renal"); refs.push("2025 AHA/ACC; ESC 2024"); }
  if(hasDM){ metas.push("HbA1c <7% (individualizada); PA <130/80"); monitoreo.push("HbA1c cada 3-6 meses; perfil lipídico; microalbuminuria anual"); refs.push("ADA; ALAD 2019"); }
  if(hasDislip){ metas.push("LDL según riesgo: <100 (moderado), <70 (alto), <55 mg/dL (muy alto)"); monitoreo.push("Perfil lipídico 6-12 semanas tras iniciar o ajustar"); refs.push("ESC/EAS; ACC/AHA; NLA"); }
  if(hasERC){ metas.push("Nefroprotección; IECA o ARA II"); monitoreo.push("TFG estimada y albuminuria; potasio y fósforo (KDIGO)"); remision.push("Nefrología si TFG <30 o progresión"); refs.push("KDIGO 2024"); }
  if(obesidad){ remision.push("Valorar farmacoterapia o cirugía bariátrica según IMC y comorbilidad"); refs.push("AHA/ACC/TOS"); }
  if(sarco){ remision.push("Estudio médico de causa y laboratorios pertinentes (sarcopenia/desnutrición)"); }
  meds.forEach(function(m){
    if(/tiazid|furosemid|diur/.test(m)) medNotas.push("Diuréticos: vigilar potasio y sodio.");
    if(/espironolact|ahorrador|ieca|enalapril|losart|valsart|\bara\b/.test(m)) medNotas.push("IECA/ARA II/ahorradores de potasio: evitar exceso de potasio.");
    if(/warfarina/.test(m)) medNotas.push("Warfarina: aporte constante de vitamina K (no suprimir hoja verde).");
    if(/metformina/.test(m)) medNotas.push("Metformina: vigilar vitamina B12.");
    if(/corticoid|prednison/.test(m)) medNotas.push("Corticoides: controlar sodio y glucosa; calcio y vitamina D.");
    if(/levotiroxina/.test(m)) medNotas.push("Levotiroxina: separar de calcio, hierro y soya.");
    if(/estatina|atorvast|rosuvast|simvast/.test(m)) medNotas.push("Estatinas: evitar jugo de toronja.");
    if(/litio/.test(m)) medNotas.push("Litio: ingesta de sodio estable.");
  });
  var _u=[]; refs.forEach(function(r){ if(_u.indexOf(r)<0)_u.push(r); });
  return { metas:metas, monitoreo:monitoreo, remision:remision, medNotas:medNotas, refs:_u };
}

function motorTratEjercicio(enc, bis){
  var e=enc||{}, b=bis||{};
  var edad=Number(e.edad||b.edad)||30;
  var dx=(Array.isArray(e.d5_39)?e.d5_39:[]).map(function(x){return String(x).toLowerCase();});
  var hasHTA=dx.some(function(d){return /hipert|hta/.test(d);})||e.d5_36==="Sí";
  var hasDM=dx.some(function(d){return /diabet/.test(d);});
  var hasCV=dx.some(function(d){return /card|corona|infarto|angina/.test(d);});
  var hasCancer=dx.some(function(d){return /c[áa]ncer/.test(d);});
  var talla=Number(b.talla||e.talla||e.tallaCm||b.tallaCm)||170, peso=Number(b.peso||e.peso)||0;
  var imc=(talla>0&&peso>0)?peso/Math.pow(talla/100,2):0;
  var FMI=Number(b.FMI||e.FMI)||0, FFMI=Number(b.FFMI||e.FFMI)||0, ASMI=Number(b.ASMI||e.ASMI)||0;
  var sexoM=(b.sexo==="M"||b.sexo==="Masculino"||e.sexo==="M"||e.sexo==="Masculino");
  var obesidad=imc>=30||(sexoM?FMI>6:FMI>9);
  var sarcopenia=(FFMI>0&&(sexoM?FFMI<17:FFMI<15))||(ASMI>0&&(sexoM?ASMI<7:ASMI<5.5));
  var clearance=(hasCV||hasDM||hasHTA||edad>=45)?"Tamizaje ACSM: requiere valoración médica antes de actividad vigorosa (síntomas, enfermedad conocida o edad).":"Tamizaje ACSM: sin banderas mayores; puede iniciar de forma progresiva.";
  var fitt={frecuencia:"5 días/semana", intensidad:"moderada, progresar a vigorosa", tiempo:"30-60 min por sesión", tipo:"aeróbico + fuerza", volumen:"150-300 min/sem aeróbico (o 75-150 vigorosa) + fuerza 2 o más días", progresion:"aumentar ~10% semanal según tolerancia"};
  var enfasis=[], faRec="ligera", refs=["ACSM (2025); OMS 2020; PAG Americans 2018"];
  if(hasHTA){ enfasis.push("Énfasis aeróbico (reduce PA 5-8 mmHg), trabajo concurrente"); }
  if(hasDM){ enfasis.push("Aeróbico + resistencia; no dejar más de 2 días sin actividad; considerar glucosa"); refs.push("ADA"); }
  if(obesidad){ enfasis.push("Aeróbico progresivo + resistencia (preserva masa magra); meta de pérdida 5-10%"); faRec="moderada"; }
  if(sarcopenia){ enfasis.push("Prioridad resistencia progresiva, 2-3 días/semana"); refs.push("EWGSOP2"); }
  if(hasCancer){ enfasis.push("Aeróbico + resistencia adaptados al estado clínico"); }
  if(edad>=65){ enfasis.push("Multicomponente + equilibrio, 3 o más días/semana"); }
  var _u=[]; refs.forEach(function(r){ if(_u.indexOf(r)<0)_u.push(r); });
  return { clearance:clearance, fitt:fitt, enfasis:enfasis, faRec:faRec, refs:_u };
}

function motorTratPsico(enc, bis){
  var e=enc||{};
  var metodos=(Array.isArray(e.d2_21)?e.d2_21:[]).map(function(x){return String(x).toLowerCase();});
  var scoff=metodos.some(function(m){return /v[óo]mito|laxante|ayuno|excesivo/.test(m);});
  var control=/frecuente|siempre/i.test(String(e.d2_22||""));
  var insat=/muy insatisf|insatisf/i.test(String(e.d2_20||""));
  var estres=Number(e.d3_29)||0;
  var tcaFlag=scoff || (control && insat);
  var tamizaje=[
    {inst:"SCOFF (conducta alimentaria)", res: scoff?"POSITIVO — conductas de riesgo reportadas en la encuesta":"Sin banderas en la encuesta; confirmar en consulta"},
    {inst:"PHQ-9 (depresión)", res:"Aplicar en consulta (corte >=10 = probable depresión)"},
    {inst:"GAD-7 (ansiedad)", res:"Aplicar en consulta (corte >=10 = probable ansiedad)"}
  ];
  var enfoque=["Modelo Transteórico: ubicar la etapa de cambio","Entrevista Motivacional para la motivación intrínseca","TCC y metas SMART"];
  var temas=["Manejo del estrés (nivel "+(estres||"-")+"/10)","Sueño","Alimentación emocional","Adherencia"];
  var remision=[]; if(tcaFlag) remision.push("Remitir a psicología clínica o psiquiatría (sospecha de TCA)"); if(estres>=8) remision.push("Valorar apoyo por estrés elevado");
  var salvaguarda=tcaFlag?"Salvaguarda activa: el módulo nutricional PAUSA la restricción calórica automática (prescribir dieta hipocalórica en TCA es dañino).":null;
  var refs=["Prochaska y DiClemente; Miller y Rollnick; TCC; PHQ-9; GAD-7; SCOFF"];
  return { tamizaje:tamizaje, enfoque:enfoque, temas:temas, tcaFlag:tcaFlag, remision:remision, salvaguarda:salvaguarda, estres:estres, refs:refs };
}

export { motorTratNutri, motorTratMedico, motorTratEjercicio, motorTratPsico };
