/**
 * atlas-tratamiento.js - CIENCIA CONGELADA (regla dura 16). NO editar, NO convertir, NO reformatear.
 *
 * Motores de tratamiento por profesion del modelo ANI-BIS-E. Autoria clinica de Gildardo; Atlas no
 * los edita ni reinterpreta. Portados VERBATIM (byte a byte) del archivo VIGENTE
 * docs/entregas/gildardo-2026-07-30/ATLAS_v7.html, rango CONTIGUO L14176-14254 (autoridad actual,
 * regla D-014; NO desde julio). Lo unico no presente en la fuente es el module.exports final.
 * El helper de display _tratLista (L14169-14174, usa React) queda FUERA: es UI, no motor.
 *
 * Los tres, en orden de fuente:
 *   · motorTratMedico     (L14176-14208): metas, monitoreo, remision, interacciones farmaco-nutriente.
 *                          INDEPENDIENTE (nadie consume su salida).
 *   · motorTratEjercicio  (L14209-14234): tamizaje ACSM (clearance), FITT, enfasis, y faRec (factor de
 *                          actividad recomendado). ALIMENTA la cadena calorica: el nutricional usa faRec
 *                          como default (D-002/P-02).
 *   · motorTratPsico      (L14235-14254): tamizaje (SCOFF de la encuesta; PHQ-9/GAD-7 a consulta, NO
 *                          computados, P-05), tcaFlag, enfoque, temas, remision, y la salvaguarda que
 *                          pausa el deficit calorico. ALIMENTA la cadena: su tcaFlag activa la
 *                          salvaguarda de TCA (requisito duro de la cadena, D-002).
 *
 * Orden de port (D-008): psico -> ejercicio -> medico (los dos primeros alimentan la cadena).
 * PROFESIONAL-FACING: toda la salida de los tres es para el profesional (tamizaje, metas, abordaje,
 * remision, notas). NINGUN texto va al paciente; si un cableado futuro lo enrutara al reporte del
 * paciente, requeriria la disciplina de comunicacion clinica de las bandas EB-BIS (D-010).
 * El test DIFF verifica que el cuerpo coincide byte a byte con L14176-14254 del vigente.
 */
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

module.exports = { motorTratMedico, motorTratEjercicio, motorTratPsico };
