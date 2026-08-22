// EXTRACTO VERBATIM de docs/entregas/Gildardo responses/ATLAS_v8.html (2026-08-19): interSplit (reparto por mayor
// resto, L16900-16908) + TIEMPOS_DEF (L16624). Solo para el golden diferencial de tiempos (CP2): NO es codigo
// de la app. interSplit es puro (sin deps); TIEMPOS_DEF son los 6 tiempos con su fraccion del objetivo.

const TIEMPOS_DEF=[{id:"desayuno",n:"Desayuno",p:0.25},{id:"mediasOnces",n:"Medias onces",p:0.10},{id:"almuerzo",n:"Almuerzo",p:0.30},{id:"algo",n:"Algo",p:0.10},{id:"cena",n:"Cena",p:0.20},{id:"merienda",n:"Merienda",p:0.05}];

      function interSplit(total, props){
        var sp=props.reduce(function(a,b){return a+b;},0)||1;
        var raw=props.map(function(p){return total*p/sp;});
        var fl=raw.map(function(x){return Math.floor(x);});
        var rem=total-fl.reduce(function(a,b){return a+b;},0);
        var ord=raw.map(function(x,ix){return {ix:ix,fr:x-Math.floor(x)};}).sort(function(a,b){return b.fr-a.fr;});
        for(var i=0;i<rem && ord.length;i++){ fl[ord[i%ord.length].ix]++; }
        return fl;
      }

export { interSplit, TIEMPOS_DEF };
