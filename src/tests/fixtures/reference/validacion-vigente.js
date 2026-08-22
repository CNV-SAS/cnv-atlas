// EXTRACTO VERBATIM de docs/entregas/Gildardo responses/ATLAS_v8.html (2026-08-19), L16881-16889 (interNeed,
// INTER_NUTS, interTot, interCob, interICN) + _driCa/_driFe. Solo para el golden diferencial de la validacion
// (CP3): NO es codigo de la app. INTER_TABLA_A se importa del modulo de intercambio (misma tabla, cuyo candado
// de transcripcion ya la verifica byte a byte contra el v8). Los nutrientes se leen tal cual del v8.
import { INTER_TABLA_A } from "@/clinical-engine/intercambio";

// computeValidacionRef: envuelve las lineas del componente. interCounts = porciones por sub (alimento).
function computeValidacionRef(interCounts, kcalObj, protG, choG, fatG, sexoM_pn, edadN) {
  var _driCa = edadN>70 ? 1200 : (edadN>=51 ? (sexoM_pn?1000:1200) : 1000);
  var _driFe = sexoM_pn ? 8 : (edadN<=50 ? 18 : 8);
  var interNeed = { kcal:kcalObj||0, prot:protG||0, cho:choG||0, gras:fatG||0, fib:Math.round(14*(kcalObj||0)/1000), ca:_driCa, p:700, fe:_driFe, mg:(sexoM_pn?420:320), zn:(sexoM_pn?11:8), k:(sexoM_pn?3400:2600), na:2300, va:(sexoM_pn?900:700), fol:400, b12:2.4, vc:(sexoM_pn?90:75) };
  var INTER_NUTS = [ {k:"kcal",l:"Energía",u:"kcal",d:0},{k:"prot",l:"Proteína",u:"g",d:0},{k:"cho",l:"Carbohidrato",u:"g",d:0},{k:"gras",l:"Grasa",u:"g",d:0},{k:"fib",l:"Fibra",u:"g",d:1},{k:"ca",l:"Calcio",u:"mg",d:0},{k:"p",l:"Fósforo",u:"mg",d:0},{k:"fe",l:"Hierro",u:"mg",d:1},{k:"mg",l:"Magnesio",u:"mg",d:0},{k:"zn",l:"Zinc",u:"mg",d:1},{k:"k",l:"Potasio",u:"mg",d:0},{k:"na",l:"Sodio",u:"mg",d:0,lim:true},{k:"va",l:"Vitamina A",u:"µg",d:0},{k:"fol",l:"Folato",u:"µg",d:0},{k:"b12",l:"Vit B12",u:"µg",d:1},{k:"vc",l:"Vitamina C",u:"mg",d:0} ];
  var interTot = INTER_TABLA_A.reduce(function(a,r){ var n=Number(interCounts[r.sub])||0; a.kcal+=n*r.kcal; a.prot+=n*r.prot; a.cho+=n*r.cho; a.gras+=n*r.gras; a.fib+=n*(r.fib||0); a.ca+=n*(r.ca||0); a.p+=n*(r.p||0); a.fe+=n*(r.fe||0); a.mg+=n*(r.mg||0); a.zn+=n*(r.zn||0); a.k+=n*(r.k||0); a.na+=n*(r.na||0); a.va+=n*(r.va||0); a.fol+=n*(r.fol||0); a.b12+=n*(r.b12||0); a.vc+=n*(r.vc||0); return a; }, {kcal:0,prot:0,cho:0,gras:0,fib:0,ca:0,p:0,fe:0,mg:0,zn:0,k:0,na:0,va:0,fol:0,b12:0,vc:0});
  function interCob(k){ var need=interNeed[k]; return need>0 ? interTot[k]/need*100 : 0; }
  function interICN(k){ var need=interNeed[k], ekcal=interNeed.kcal; if(!need||!ekcal||!interTot.kcal) return null; var eR=interTot.kcal/ekcal; if(eR<=0) return null; return (interTot[k]/need)/eR; }
  return INTER_NUTS.map(function(nu){ return { k:nu.k, obtenido:interTot[nu.k], requerido:interNeed[nu.k], cob:interCob(nu.k), icn:interICN(nu.k) }; });
}

export { computeValidacionRef };
