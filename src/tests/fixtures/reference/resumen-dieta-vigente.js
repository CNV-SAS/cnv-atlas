// EXTRACTO VERBATIM de "Nuevos cambios html/4 noviembre/ATLAS_v16.html", L14162-14204.
// Fuente VIGENTE del parrafo de dieta de Gildardo (_resumenNutriParrafo). Solo para el golden diferencial
// de resumen-dieta: NO es codigo de la app.
//
// ═══ RE-ANCLADO AL v16 EL 2026-11-07, Y ESTO ES LO QUE SE MOVIO ═══
//
// Apuntaba al v8 (2026-08-19), donde el parrafo clasificaba con dos reglas propias: protector con
// frecuencia <= 1 era deficit y riesgo con frecuencia >= 3 era exceso. Su v16 §4.3 lo pasa a
// `d1Clasificar`, que es la MISMA clasificacion que ve el profesional en la vista D1, y de ahi salen
// cuatro diferencias visibles en el texto:
//
//   · las carnes procesadas entran en exceso desde 2 (no desde 3);
//   · las carnes rojas tienen su propia escala (exceso >= 3, "a moderar" 2);
//   · aparece "consumo a moderar", una tercera categoria que el parrafo no tenia;
//   · y cada grupo va con su FRECUENCIA en palabras, no solo con su nombre.
//
// UN GOLDEN NO SE TOCA PARA QUE PASE: se reancla cuando la fuente cambia, con su razon escrita. Es la
// misma disciplina con la que se reanclaron `frozen-patron-diff` (al v16, el 2026-11-06) y el golden del
// DFI (CA-3). Lo que este golden sigue aislando es la LOGICA DE REDACCION del parrafo: los dos lados usan
// el MISMO clasificador del frozen, asi que una diferencia aqui solo puede venir de como se arma la frase.
//
// EXTRACTO VERBATIM, ASI QUE SE DESACTIVA EL LINTER (igual que en `dfi-vigente.js` y
// `resumen-profesion-vigente.js`): su codigo deja `defic`, `riesgo` y `listar` declarados y sin usar desde el
// v16, y quitarlos aqui rompe la comparacion linea a linea de `frozen-deriva-vigente`. Un extracto que
// se "limpia" deja de ser un extracto.
/* eslint-disable */
import { d1Clasificar, d1Lista } from "@/clinical-engine/frozen/engine.d1-clasificacion.js";
function _resumenNutriParrafo(enc){
  enc = enc || {};
  var toNum = function(v){ var n=Number(v); return (v!=null && v!=="" && !isNaN(n)) ? n : null; };
  var listar = function(a){ if(a.length<=1) return a[0]||""; return a.slice(0,-1).join(", ")+" y "+a[a.length-1]; };
  var suj = (String(enc.sexo||"").toLowerCase().charAt(0)==="f") ? "La paciente" : "El paciente";
  var defic=[], riesgo=[];
  // v16: misma clasificación por grupo que el Diagnóstico (d1Clasificar).
  var _d1c=d1Clasificar(enc,false), dietParts=[];
  if(_d1c.deficit.length) dietParts.push("bajo consumo de "+d1Lista(_d1c.deficit));
  if(_d1c.exceso.length) dietParts.push("consumo elevado de "+d1Lista(_d1c.exceso));
  if(_d1c.moderar.length) dietParts.push("consumo a moderar de "+d1Lista(_d1c.moderar));
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
