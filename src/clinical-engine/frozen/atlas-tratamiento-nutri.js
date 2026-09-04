/**
 * atlas-tratamiento-nutri.js - CIENCIA CONGELADA (regla dura 16). NO editar, NO convertir, NO reformatear.
 *
 * motorTratNutri del modelo ANI-BIS-E. Autoria clinica de Gildardo; Atlas no lo edita ni reinterpreta.
 * Portado VERBATIM (byte a byte, copiado por script y no transcrito a mano) del rango CONTIGUO
 * L15630-15744 de docs/entregas/Gildardo responses/html actualizado 28 agosto/ATLAS_v8.html.
 *
 * POR QUE EN SU PROPIO ARCHIVO Y NO EN atlas-tratamiento.js. Los otros tres motores por profesion
 * (medico, ejercicio, psico) estan portados verbatim del archivo del 2026-07-30. Este viene del archivo
 * del 2026-08-26, que es donde viven las tres correcciones que Gildardo nos desbloqueo el 26. Meterlos
 * en el mismo archivo romperia el contrato de "verbatim del rango X del archivo Y", que es lo que hace
 * verificable un porte fiel. Son fuentes distintas y por eso son archivos distintos.
 *
 * Y ese desfase de fechas NO es un descuido nuestro: el mismo lo anoto en su Parte 1 al dejar cancer en
 * 1,25, diciendo que ese es "el punto donde el motor que gobierna es el menos actualizado".
 *
 * LAS TRES CORRECCIONES QUE TRAE ESTE ARCHIVO Y QUE EL PORTE PRESERVA (Parte 1, 2026-08-26), cada una
 * con su candado en motor-trat-nutri.test.ts:
 *   1. deficit = 0 por defecto. El gasto calculado sobre el peso meta YA ES la ingesta que lleva a ese
 *      peso; restarle 500 encima aplicaba un segundo descuento sobre el primero (hasta 926 kcal por
 *      debajo del mantenimiento real en su propio caso).
 *   2. El GEB se calcula sobre el PESO META, no sobre el peso actual.
 *   3. La proteina se SEPARA: desnutricion conserva 1,5 g/kg (el rango de F7/F10 de su archivo) y
 *      cancer se queda en 1,25. Antes compartian rama. La nota de realimentacion (fosfato, potasio,
 *      magnesio; 10-15 kcal/kg si hay riesgo) viaja SOLO con desnutricion, que es lo que protege al
 *      paciente mas fragil de los dos.
 *
 * RESPONDIDA Y PORTADA (respuesta del 2026-08-27, punto 2; codigo en su ATLAS_v8.html del 29): el piso
 * de 1.500/1.200 estaba guardado tras `if(deficit>0)`, asi que con el deficit en cero NO SE ACTIVABA
 * NUNCA. Textual: "Al pasar el deficit a cero no mire de que colgaba el piso, y lo deje sin activarse
 * nunca". Reprodujo nuestro caso (mujer de 60 anos, 150 cm, 60 kg, sedentaria: 1.172 kcal con un piso
 * de 1.200) y la paradoja de que poner deficit 300 SUBIA el objetivo. La condicion pasa a ser la rama de
 * la formula. La salvedad de cancer/desnutricion, que quedan FUERA del piso, tambien es suya y es
 * deliberada: 27,5 kcal x peso actual, con inicio a 10-15 kcal/kg si hay riesgo de realimentacion.
 *
 * Lo unico que no esta en la fuente es el module.exports final.
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
  // ── PESO META · sale del FMI y del FFMI, no del IMC ──────────────────────
  // Decision de la direccion cientifica del 1-sep-2026. El IMC no distingue grasa
  // de musculo, y el peso meta es la palanca de toda la cadena calorica: con el IMC
  // como criterio, un paciente con obesidad sarcopenica e IMC normal recibia una
  // estrategia "hipocalorica" con un objetivo de mantenimiento —porque su peso meta
  // salia igual a su peso actual—, y un deportista con IMC alto por musculo recibia
  // un recorte sobre kilos que no son grasa. La estrategia ya miraba FMI y FFMI; el
  // peso meta no. Ahora los dos leen lo mismo.
  //
  //     peso = MG + MLG  →  peso = (FMI + FFMI) x talla^2
  //
  // La META lleva CADA indice a su rango normal y deja el resto como esta:
  //   · FMI  (cFMI:  3-6 H · 5-9 M)  → al limite si se pasa o si no llega
  //   · FFMI (cFFMI: 17-25 H · 15-23 M) → al minimo si esta por debajo; si no, se
  //     conserva el medido. No se "promete" musculo en quien ya lo tiene: solo se
  //     recupera el que falta, que es lo que el propio motor prescribe con proteina
  //     alta y fuerza en sarcopenia y desnutricion. Conservar un FFMI deficitario
  //     haria que la meta heredara la desnutricion y saliera POR DEBAJO del peso
  //     actual en un paciente que tiene que subir.
  // Cuando los dos indices ya estan en rango, meta y peso actual coinciden por la
  // propia identidad peso = (FMI + FFMI) x talla^2.
  var FMI_m  = Number(b.FMI  || e.FMI)  || 0;
  var FFMI_m = Number(b.FFMI || e.FFMI) || 0;
  var _pesoMetaComp = null;
  if (FMI_m > 0 && FFMI_m > 0 && talla > 0) {
    var _fmiLo = sexoM ? 3 : 5, _fmiHi = sexoM ? 6 : 9, _ffmiLo = sexoM ? 17 : 15;
    var _fmiMeta  = FMI_m > _fmiHi ? _fmiHi : (FMI_m < _fmiLo ? _fmiLo : FMI_m);
    var _ffmiMeta = FFMI_m < _ffmiLo ? _ffmiLo : FFMI_m;
    _pesoMetaComp = Math.round((_fmiMeta + _ffmiMeta) * Math.pow(talla/100, 2) * 10) / 10;
  }
  // ── PRECEDENCIA · un solo dato, tres sitios donde puede quedar fijado ────
  // 1. Lo que el profesional ajusta AQUI, en el tratamiento.
  // 2. Lo que el nutricionista escribio en mod ANTROPOMETRIA. No es otro peso meta:
  //    es el mismo, escrito antes. Si lo puso a mano, manda sobre el calculo.
  // 3. El calculado por FMI/FFMI.
  // 4. Sin composicion corporal, el criterio por IMC.
  var _pesoMetaAnt = Number(b.pesoMeta || e.pesoMeta) || 0;
  var pesoMeta = Number(edit.peso_meta)>0 ? Number(edit.peso_meta)
               : (_pesoMetaAnt > 0 ? _pesoMetaAnt
               : (_pesoMetaComp != null ? _pesoMetaComp
               : ((imc>=25||imc<18.5) ? Math.max(1,Math.round(PI)) : pesoAct)));
  // A1 GEB Mifflin-St Jeor (medicion, peso actual)
  // Mifflin sobre el PESO DE REFERENCIA (peso meta), no sobre el peso actual.
  // Decision de la direccion cientifica del 26-ago-2026: el gasto calculado
  // sobre el peso meta ES la ingesta que lleva a ese peso, asi que el descuento
  // ya esta dentro del numero. Antes se calculaba sobre `pesoAct` y ademas se
  // restaba un deficit: dos descuentos sobre el mismo paciente (ver el deficit
  // mas abajo, ahora en 0). El peso meta queda como la unica palanca, y es la
  // que el profesional mueve.
  var geb = Math.round(sexoM ? (10*pesoMeta+6.25*talla-5*edad+5) : (10*pesoMeta+6.25*talla-5*edad-161));
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
  // DESNUTRICION y SARCOPENIA separadas el 3-sep-2026 por la Direccion Cientifica.
  // Antes la desnutricion colgaba del IMC (<18,5), que no mide composicion: un
  // paciente con masa magra depletada y peso normal no entraba, y uno delgado
  // con masa magra conservada si. Y las dos condiciones venian unidas por un OR
  // en `sarcopenia`, mezclando dos definiciones internacionales distintas.
  //
  // Ahora cada una usa su propio indice y su propio corte internacional:
  //   DESNUTRICION -> FFMI (masa libre de grasa). ESPEN 2015 / GLIM 2019:
  //                   < 17 kg/m2 en hombres, < 15 kg/m2 en mujeres.
  //   SARCOPENIA   -> ASMI (masa apendicular). EWGSOP2 2019:
  //                   < 7,0 kg/m2 en hombres, < 5,5 kg/m2 en mujeres.
  // Son los MISMOS cortes que ya usaban cFFMI y cASMI, asi que la cadena de
  // tratamiento y la diana EFR dejan de contradecirse.
  //
  // CONSECUENCIA: ambas exigen bioimpedancia. Sin BIS, FFMI y ASMI valen 0 y
  // ninguna rama se activa. Es deliberado: antes bastaban peso y talla para
  // emitir una prescripcion hipercalorica sin haber medido nada.
  var desnutricion = FFMI>0 && (sexoM?FFMI<17:FFMI<15);
  var sarcopenia   = ASMI>0 && (sexoM?ASMI<7:ASMI<5.5);
  var tca = (Array.isArray(e.d2_21)?e.d2_21:[]).some(function(m){return /v[óo]mito|laxante|ayuno|excesivo/i.test(String(m));}) || !!edit.tcaFlag;
  // PROTEINA: decision del profesional (Direccion Cientifica, 3-sep-2026).
  // El motor ya NO propone gramos por kilo segun la rama. Sale siempre 0,8 g/kg
  // -el requerimiento basal- y el profesional la mueve a su criterio en el campo
  // editable. Antes cada rama imponia su cifra (1,5 desnutricion / 1,25 cancer /
  // 1,3-1,4 obesidad / 1,4 sarcopenia / 0,7 ERC) y ademas emitia un atributo que
  // la describia, de modo que un paciente con dos condiciones recibia dos frases
  // contradictorias sobre la misma cifra.
  var protKg=0.8, deficit=0, tipoEnergia="Normocalórica", attrs=[], notas=[], refs=[];
  // PARTE C/D protocolos con precedencia
  if(hasCancer || desnutricion){
    // Rama separada el 26-ago-2026 para cancer y desnutricion. Lo que las
    // distinguia era la proteina (1,25 contra 1,5); desde el 3-sep-2026 la
    // proteina no la propone el motor, asi que solo se diferencian en el
    // atributo y en las notas. Si coinciden las dos, manda la desnutricion.
    attrs.push(desnutricion?"Densidad energética alta, fraccionada":"Densidad energética alta");
    notas.push("Prioriza recuperar el estado nutricional; el control de peso se pospone.");
    if(desnutricion) notas.push("Vigilar realimentación (fosfato, potasio, magnesio); iniciar 10-15 kcal/kg si hay riesgo (ASPEN).");
    refs.push(hasCancer?"ESPEN 2021 (cáncer); ESMO":"GLIM (ESPEN/ASPEN/FELANPE); ESPEN hospital; ASPEN");
  } else if(obesidad){
    // Deficit en 0 desde el 26-ago-2026. El gasto ya se calcula sobre el peso
    // meta (arriba), que de por si es un objetivo con el descuento dentro;
    // restar ademas 500 aplicaba un segundo descuento y podia llevar al piso
    // por dos vias sumadas. El piso de 1.500/1.200 se conserva como red: si se
    // activa, es senal de que el peso meta quedo demasiado bajo.
    deficit = 0;
    attrs.push("Densidad energética baja","Fibra alta","Controlada en carbohidratos concentrados","Azúcares añadidos bajos");
    if(sarcopenia){ notas.push("Obesidad con baja masa magra: acompanar de entrenamiento de fuerza."); }
    refs.push("AND AWM 2014; AHA/ACC/TOS 2013; NICE CG189");
  } else if(sarcopenia){
    notas.push("Acompañar SIEMPRE de entrenamiento de fuerza.");
    refs.push("EWGSOP2 2019; PROT-AGE 2013; ESPEN 2014");
  }
  // ERC: se conserva la NOTA porque advierte de un dano, no propone un objetivo.
  // La cifra (antes 0,7) y el atributo "Proteína controlada 0,6-0,8" salen, como
  // el resto de las recomendaciones proteicas.
  if(hasERC){ attrs.push("Nefroprotectora"); notas.push("ERC: la proteína se ajusta bajo guía de nefrología."); refs.push("KDIGO 2024; KDOQI 2020; ESPEN renal 2021"); }
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
  // SALVAGUARDA TCA (Trastorno de la Conducta Alimentaria — NO confundir con el
  // ICA-BIS, que es la carga alostática: son cosas distintas).
  //
  // Corregido el 9-ago-2026 por la Dirección Científica: la salvaguarda AVISA,
  // no bloquea. Antes ponía el déficit en cero y forzaba dieta normocalórica;
  // eso arrebataba al profesional una decisión que es suya. El déficit sigue
  // partiendo del peso meta acordado con el paciente, igual que en cualquier
  // otro caso, y lo que hace el sistema es levantar la alerta y marcar remisión.
  var alertaTCA=false;
  if(tca){ alertaTCA=true; notas.unshift("Riesgo de conducta alimentaria detectado: revisar el peso meta con el paciente antes de sostener un déficit, y remitir a valoración especializada."); }
  var pausadoTCA=false;   // se conserva en false: ya no se pausa nada
  // objetivo calorico
  // UNA SOLA VIA PARA TODOS (Direccion Cientifica, 3-sep-2026).
  // Se retira la formula por patologia (27,5 kcal x peso actual en cancer y
  // desnutricion): el objetivo sale SIEMPRE del gasto calculado sobre el PESO
  // META menos la restriccion que ponga el nutricionista. Ese es justamente el
  // motivo por el que existe el peso meta, y por el que no se usa el gasto que
  // trae Biodymanager, que va sobre el peso actual.
  var kcalObjetivo = get - deficit;
  // El piso ya NO cuelga del deficit. Corregido el 27-ago-2026: al pasar el
  // deficit a 0 (Parte 1, punto 1.2) esta red dejo de activarse NUNCA, y el
  // objetivo quedaba sin nada debajo. Caso real: mujer de 60 anos, 150 cm,
  // 60 kg, sedentaria -> GET sobre peso meta 1.172 kcal, por debajo de su
  // propio piso de 1.200. Y al reves: ponerle un deficit de 300 le SUBIA el
  // objetivo a 1.200, porque solo entonces aparecia el piso.
  //
  // Se aplica solo a la via calculada (get - deficit). La rama de cancer y
  // desnutricion mantiene su propia formula (27,5 kcal x peso actual) y queda
  // FUERA del piso a proposito: un paciente con riesgo de realimentacion debe
  // iniciar a 10-15 kcal/kg segun su propia nota, y un piso de 1.200-1.500 lo
  // empujaria por encima de lo que ese protocolo permite.
  var piso = sexoM?1500:1200; kcalObjetivo = Math.max(piso, kcalObjetivo);
  kcalObjetivo = Math.round(kcalObjetivo);
  if(Number(edit.kcal_obj)>0) kcalObjetivo = Number(edit.kcal_obj);
  // La etiqueta DESCRIBE el resultado (objetivo contra gasto); no la fija ninguna
  // patologia. Con restriccion 0, objetivo y gasto coinciden y sale Normocalorica.
  tipoEnergia = kcalObjetivo>get ? "Hipercalórica" : (kcalObjetivo<get ? "Hipocalórica" : "Normocalórica");
  // Grasa 30% de base para todos; el nutricionista la mueve en su campo editable.
  // Antes la dislipidemia la bajaba a 25% por su cuenta.
  var fatPct = 30;
  var protG = Math.round(protKg*pesoMeta);
  var fatG = Math.round(kcalObjetivo*fatPct/100/9);
  var choG = Math.round(Math.max(0,(kcalObjetivo-protG*4-fatG*9))/4);
  var actividad = { aerob:"150-300 min/sem moderada (o 75-150 vigorosa)", fuerza:"2 o más días/sem, grandes grupos musculares", remision:"Remitir a deportología para modalidad, intensidad y progresión." };
  refs.push("Actividad: OMS 2020; ACSM; PAG Americans 2018");
  var etiqueta = "Dieta "+tipoEnergia+" de "+kcalObjetivo+" kcal/día";
  var chips = ["Proteína "+String(protKg).replace(".",",")+" g/kg"].concat(attrs);
  var alertaFam = fam.filter(function(f){return /diabet|hipert|cardiov|c[áa]ncer|obesidad/.test(f);});
  var _refs=[]; refs.forEach(function(r){ if(_refs.indexOf(r)<0) _refs.push(r); });
  return { alertaTCA:alertaTCA, geb:geb, fa:fa, faNivel:faNivel, get:get, kcalObjetivo:kcalObjetivo, deficit:deficit, tipoEnergia:tipoEnergia, etiqueta:etiqueta, protKg:protKg, protG:protG, fatPct:fatPct, fatG:fatG, choG:choG, sodioMax:sodioMax, grasaSatMax:grasaSatMax, chips:chips, attrs:attrs, notas:notas, refs:_refs, actividad:actividad, pausadoTCA:pausadoTCA, alertaFam:alertaFam, pesoAct:pesoAct, pesoMeta:pesoMeta, pesoAjust:pesoAjust, imc:imc };
}

module.exports = { motorTratNutri };
