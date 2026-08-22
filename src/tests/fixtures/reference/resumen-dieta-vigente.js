// EXTRACTO VERBATIM de docs/entregas/Gildardo responses/ATLAS_v8.html (2026-08-19), L13013-13057.
// Fuente VIGENTE del parrafo de dieta de Gildardo (_resumenNutriParrafo). Solo para el golden diferencial
// de resumen-dieta: NO es codigo de la app. FREQ_GROUPS se importa del frozen (mismo dato vigente que el v8,
// DIFF-anchored), asi ambos lados usan la misma tabla y el golden aisla la LOGICA de redaccion.
import { FREQ_GROUPS } from "@/clinical-engine/frozen/engine.patron.js";

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

export { _resumenNutriParrafo as resumenDietaRef };
