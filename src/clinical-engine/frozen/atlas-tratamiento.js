/**
 * atlas-tratamiento.js - CIENCIA CONGELADA (regla dura 16). NO editar, NO convertir, NO reformatear.
 *
 * Motores de tratamiento por profesion del modelo ANI-BIS-E. Autoria clinica de Gildardo; Atlas no
 * los edita ni reinterpreta. Se portan VERBATIM (byte a byte) desde el archivo VIGENTE
 * docs/entregas/gildardo-2026-07-30/ATLAS_v7.html (autoridad actual, regla D-014; NO desde julio).
 * La unica linea no presente en la fuente es el module.exports final (mecanismo de archivo derivado).
 *
 * Orden de port (D-008): psicologia -> ejercicio -> medico. Los dos primeros alimentan la cadena
 * calorica (ejercicio da el factor de actividad faRec; psicologia da tcaFlag para la salvaguarda de
 * TCA, requisito duro de la cadena, D-002). El medico es independiente.
 *
 * --- motorTratPsico (portado 2026-08-03, fuente ATLAS_v7.html L14235-14254) ---
 * Que hace: tamizaje psicologico (SCOFF desde la encuesta d2_21; PHQ-9/GAD-7 quedan para aplicar en
 *   consulta, el sistema NO los computa), tcaFlag (bandera de conducta alimentaria de riesgo),
 *   enfoque, temas, remision y la salvaguarda que pausa el deficit calorico. Lee solo la encuesta
 *   (ignora bis). El test DIFF verifica que el cuerpo coincide byte a byte con L14235-14254.
 * PROFESIONAL-FACING: toda su salida es para el profesional (tamizaje, abordaje, remision, nota de
 *   la salvaguarda). NINGUN texto va al paciente. Si algun cableado futuro lo enrutara al reporte del
 *   paciente, requeriria la misma disciplina de comunicacion clinica que las bandas de EB-BIS (D-010).
 * PRECONDICION (verificada 2026-08-03): el registro previo de "protocolo de riesgo PHQ-9/SCOFF/GAD-7"
 *   SE CAE: el motor define la conducta de lo que detecta (SCOFF+ -> remitir); PHQ-9/GAD-7 no se
 *   computan ni se capturan, asi que el sistema nunca detecta riesgo suicida sin actuar. Queda una
 *   confirmacion menor no bloqueante (que dejar PHQ-9/GAD-7 a la consulta es intencional).
 */
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

module.exports = { motorTratPsico };
