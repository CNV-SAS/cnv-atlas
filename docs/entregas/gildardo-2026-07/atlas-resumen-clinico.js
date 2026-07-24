/**
 * atlas-resumen-clinico.js
 * Parrafos de resumen clinico por profesion (nutricion, medicina, ejercicio, psicologia).
 *
 * Dependencias externas: _resFMIcat/_resFFMIcat usan clasificadores cFMI/cFFMI del core.
 * Extraido de ATLAS_v7.html (estado actual, 2026-07-23).
 */

import { cFMI, cFFMI } from './atlas-core-indices.js';


function _resSuj(enc){ return (String(enc.sexo||"").toLowerCase().charAt(0)==="f") ? "La paciente" : "El paciente"; }

function _resLista(a){ if(a.length<=1) return a[0]||""; return a.slice(0,-1).join(", ")+" y "+a[a.length-1]; }

function _resArr(v){ if(!Array.isArray(v)) return []; var q=["ninguno","ninguna","no","—",""]; return v.filter(function(x){ return x && q.indexOf(String(x).toLowerCase())<0; }); }

function _resLower(a){ return a.map(function(x){ return String(x).toLowerCase(); }); }

function _resNum(v){ var n=Number(v); return (v!=null && v!=="" && !isNaN(n)) ? n : null; }

function _resDietaCoarse(enc){
  var probs=0, any=false;
  (typeof FREQ_GROUPS!=="undefined"?FREQ_GROUPS:[]).forEach(function(g){
    var v=_resNum(enc["d1_"+g.n+"_i"]); if(v===null) return; any=true;
    if(g.cat==="protector"&&v<=1) probs++; else if(g.cat==="riesgo"&&v>=3) probs++;
  });
  if(!any) return "";
  return probs===0 ? "una alimentación adecuada" : probs<=2 ? "una alimentación con aspectos por mejorar" : "una alimentación deficiente";
}

function _resSexoM(enc, bis){ var v=String((enc&&enc.sexo)||(bis&&bis.sexo)||""); return (v.charAt(0).toUpperCase()==="M") ? "M" : "F"; }

function _resFMIcat(enc, bis){ var FMI=Number((bis&&(bis.FMI||bis.fmi))||(enc&&(enc.FMI||enc.fmi)))||0; if(FMI<=0 || typeof cFMI==="undefined") return null; return cFMI(FMI, _resSexoM(enc,bis)).k; }

function _resFFMIcat(enc, bis){ var FFMI=Number((bis&&(bis.FFMI||bis.ffmi))||(enc&&(enc.FFMI||enc.ffmi)))||0; if(FFMI<=0 || typeof cFFMI==="undefined") return null; return cFFMI(FFMI, _resSexoM(enc,bis)).k; }

function _resumenNutriParrafo(enc){
  enc = enc || {};
  var toNum = function(v){ var n=Number(v); return (v!=null && v!=="" && !isNaN(n)) ? n : null; };
  var listar = function(a){ if(a.length<=1) return a[0]||""; return a.slice(0,-1).join(", ")+" y "+a[a.length-1]; };
  var suj = (String(enc.sexo||"").toLowerCase().charAt(0)==="f") ? "La paciente" : "El paciente";
  var defic=[], riesgo=[];
  (typeof FREQ_GROUPS!=="undefined"?FREQ_GROUPS:[]).forEach(function(g){
    var val=toNum(enc["d1_"+g.n+"_i"]); if(val===null) return;
    if(g.cat==="protector" && val<=1) defic.push(g.label.toLowerCase());
    else if(g.cat==="riesgo" && val>=3) riesgo.push(g.label.toLowerCase());
  });
  var dietParts=[];
  if(defic.length) dietParts.push("bajo consumo de "+listar(defic));
  if(riesgo.length) dietParts.push("consumo elevado de "+listar(riesgo));
  var prep=String(enc.d8_59||""), prepMap={"Yo mismo/a":"sus alimentos los prepara la propia persona","Un familiar":"sus alimentos los prepara un familiar","Restaurante o fonda":"se alimenta principalmente de restaurante o fonda","Cafetería / comedor":"se alimenta principalmente de cafetería o comedor"};
  var cf=String(enc.d8_60||""), cfMap={"Nunca":"no come fuera de casa","1–2 veces/semana":"come fuera de casa 1 a 2 veces por semana","3–4 veces/semana":"come fuera de casa 3 a 4 veces por semana","Todos los días":"come fuera de casa todos los días"};
  var des=toNum(enc.d1f_des_i), desMap=["desayuna todos los días","desayuna solo a veces (3 a 4 días)","rara vez o nunca desayuna"];
  var cena=toNum(enc.d1f_noche_i), cenaMap=["cena antes de las 7 pm","cena entre las 7 y las 8 pm","cena entre las 8 y las 9 pm","cena después de las 9 pm"];
  var sal=toNum(enc.d1f_sal_i);
  var ins=String(enc.d8_62||""), acc=String(enc.d8_61||"");
  var agua=toNum(enc.d7_agua), gas=toNum(enc.d7_55), ener=toNum(enc.d7_56);
  var otros=[];
  if(prepMap[prep]) otros.push(prepMap[prep]);
  if(cfMap[cf]) otros.push(cfMap[cf]);
  if(des!==null && desMap[des]) otros.push(desMap[des]);
  if(cena!==null && cenaMap[cena]) otros.push(cenaMap[cena]);
  if(sal!==null && sal>=2) otros.push("añade sal extra a la comida ya servida");
  if(ins==="No, nunca") otros.push("no presenta inseguridad alimentaria");
  else if(ins==="A veces") otros.push("presenta inseguridad alimentaria ocasional");
  else if(ins==="Frecuentemente") otros.push("presenta inseguridad alimentaria frecuente");
  if(acc==="Sí, siempre") otros.push("con acceso fácil a alimentos frescos y saludables");
  else if(acc==="A veces es difícil") otros.push("con acceso a veces difícil a alimentos frescos");
  else if(acc==="Generalmente es difícil") otros.push("con acceso generalmente difícil a alimentos frescos");
  if(agua!==null){
    var liq = agua>=6 ? "mantiene un buen consumo de líquidos ("+agua+" vasos de agua al día)" : "tiene un consumo insuficiente de líquidos ("+agua+" vaso"+(agua===1?"":"s")+" de agua al día)";
    if((gas&&gas>0)||(ener&&ener>0)) liq += " y consume bebidas azucaradas o energéticas";
    otros.push(liq);
  }
  var cl=[];
  if(dietParts.length) cl.push("evidencia "+dietParts.join(", y "));
  else if(otros.length) cl.push("no muestra grupos de alimentos claramente deficitarios ni en exceso");
  cl = cl.concat(otros);
  if(!cl.length) return "";
  return suj+" "+cl.join("; ")+".";
}

function _resumenMedicoParrafo(enc, bis){
  enc=enc||{}; bis=bis||{};
  var pres=[];
  var af=_resArr(enc.d5_38); if(af.length) pres.push("antecedentes familiares de "+_resLista(_resLower(af)));
  var dx=_resArr(enc.d5_39);
  if(String(enc.d5_36||"")==="Sí" && !dx.some(function(x){return /hiperten|hta/i.test(x);})) dx.push("hipertensión arterial");
  if(dx.length) pres.push("diagnósticos de "+_resLista(_resLower(dx)));
  var qx=String(enc.d6_qx||""); if(qx && qx.toLowerCase().indexOf("ninguna")<0) pres.push("antecedente quirúrgico de "+qx.toLowerCase());
  var alg=_resArr(enc.d6_43); if(alg.length) pres.push("alergia a "+_resLista(_resLower(alg)));
  var intol=_resArr(enc.d6_44); if(intol.length) pres.push("intolerancia a "+_resLista(_resLower(intol)));
  var cl=[];
  if(pres.length) cl.push("presenta "+_resLista(pres));
  var med=_resArr(enc.d5_40); if(med.length) cl.push("toma "+_resLista(_resLower(med)));
  var naf=_resNum(enc.d3_23);
  if(naf!==null) cl.push(naf<=0 ? "no realiza actividad física" : "realiza actividad física "+naf+(naf===1?" día":" días")+" por semana");
  var tab=String(enc.d3_30||"").toLowerCase(); if(tab.indexOf("fumo")>=0||tab.indexOf("vapeo")>=0) cl.push("consume tabaco o nicotina");
  var alc=String(enc.d3_31||"").toLowerCase(); if(alc.indexOf("semana")>=0||alc.indexOf("todos")>=0) cl.push("consume alcohol con frecuencia");
  var est=_resNum(enc.d3_29); if(est!==null && est>=7) cl.push("refiere estrés elevado ("+est+"/10)");
  var sue=String(enc.d3_26||""); if(sue==="Menos de 5h"||sue==="5–6 horas") cl.push("duerme de forma insuficiente ("+sue.toLowerCase()+")");
  var dieta=_resDietaCoarse(enc); if(dieta) cl.push("mantiene "+dieta);
  if(!cl.length) return "";
  return _resSuj(enc)+" "+cl.join("; ")+".";
}

function _resumenEjercicioParrafo(enc, bis){
  enc=enc||{}; bis=bis||{};
  var cl=[];
  var naf=_resNum(enc.d3_23);
  if(naf===null) { /* sin dato */ }
  else if(naf<=0) cl.push("no realiza actividad física actualmente");
  else {
    var base="realiza actividad física "+naf+(naf===1?" día":" días")+" por semana";
    var dur=String(enc.d3_24||""); if(dur) base+=", con sesiones de "+dur.toLowerCase();
    cl.push(base);
    var tipos=_resArr(enc.d3_25); if(tipos.length) cl.push("de tipo "+_resLista(_resLower(tipos)));
  }
  var ffk=_resFFMIcat(enc,bis); if(ffk===1) cl.push("con masa magra baja, a vigilar en la prescripción");
  var agua=_resNum(enc.d7_agua);
  if(agua!==null) cl.push(agua>=6 ? "buen consumo de líquidos ("+agua+" vasos de agua al día)" : "consumo insuficiente de líquidos ("+agua+" vaso"+(agua===1?"":"s")+" de agua al día)");
  var est=_resNum(enc.d3_29); if(est!==null && est>=7) cl.push("estrés elevado ("+est+"/10) que puede afectar la recuperación");
  var dieta=_resDietaCoarse(enc); if(dieta) cl.push("y mantiene "+dieta);
  if(!cl.length) return "";
  return _resSuj(enc)+" "+cl.join("; ")+".";
}

function _resumenPsicoParrafo(enc, bis){
  enc=enc||{}; bis=bis||{};
  var cl=[];
  var perc=String(enc.d2_19||"");
  var percMap={"Muy delgado/a":"bajo","Delgado/a":"bajo","Normal":"normal","Sobrepeso":"exceso","Obesidad":"exceso"};
  var objK=_resFMIcat(enc,bis);
  var objTxt={1:"grasa corporal baja",2:"grasa corporal normal",3:"grasa corporal en exceso"};
  if(perc && percMap[perc]!==undefined && objK!==null){
    var pc=percMap[perc], oc=(objK===1?"bajo":objK===2?"normal":"exceso");
    if(pc!==oc) cl.push("presenta una discordancia entre su percepción corporal (se percibe con "+perc.toLowerCase()+") y la composición corporal objetiva ("+objTxt[objK]+")");
    else cl.push("presenta una percepción corporal congruente con su composición corporal objetiva ("+objTxt[objK]+")");
  } else if(objK!==null){ cl.push("presenta "+objTxt[objK]+" en la composición corporal objetiva"); }
  var sat=String(enc.d2_20||""); if(sat==="Muy insatisfecho/a"||sat==="Insatisfecho/a") cl.push("con insatisfacción respecto a su peso");
  var ctrl=String(enc.d2_22||""); if(ctrl==="A veces"||ctrl==="Frecuentemente"||ctrl==="Siempre") cl.push("con episodios de pérdida de control al comer");
  var met=_resArr(enc.d2_21).filter(function(x){ return ["ayunos","saltar comidas","laxantes","vómito","ejercicio excesivo"].indexOf(String(x).toLowerCase())>=0; });
  if(met.length) cl.push("con conductas de riesgo ("+_resLista(_resLower(met))+")");
  var est=_resNum(enc.d3_29); if(est!==null) cl.push("con un nivel de estrés "+(est<=3?"bajo":est<=6?"moderado":"alto")+" ("+est+"/10)");
  var sq=String(enc.d3_27||""); if(sq==="Muy mala"||sq==="Mala") cl.push("y mala calidad del sueño");
  if(!cl.length) return "";
  return _resSuj(enc)+" "+cl.join("; ")+".";
}

export { _resumenNutriParrafo, _resumenMedicoParrafo, _resumenEjercicioParrafo, _resumenPsicoParrafo };
