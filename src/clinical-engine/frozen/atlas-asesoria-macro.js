/**
 * atlas-asesoria-macro.js - CIENCIA CONGELADA (regla dura 16). NO editar, NO convertir, NO reformatear.
 *
 * EL PANEL DE REFERENCIA POR DIAGNOSTICO, junto al campo de proteina y al de grasa del nutricionista.
 * Porte VERBATIM de su entrega del 2026-09-03, extraido por script y no transcrito.
 *
 * QUE ES, Y POR QUE NO ES UNA PRESCRIPCION. Su entrega del 3 retira la proteina por patologia de los
 * cuatro modulos congelados y la deja en 0,8 editable. Esto es la OTRA MITAD de esa decision, y sin ella
 * el porte queda cojo. Textual suyo: "si portaron la retirada sin portar el panel, lo que quedo en Atlas
 * es media instruccion, y es la mitad peor".
 *
 * SU MOTIVO, que es lo que lo hace coherente con la Regla 0: "el motor no puede distinguir un dato
 * escrito a proposito de un campo mal borrado, y la cadena por patologia convertia esa ambiguedad en
 * gramos prescritos. La solucion no fue ponerle un piso al campo: fue quitarle al motor la pretension de
 * saber". La cifra la decide el profesional; lo que el motor sabia ahora se le MUESTRA a quien decide,
 * en el momento de decidir.
 *
 * NO ESCRIBE NINGUN VALOR. Devuelve el rango de cada condicion con SU MECANISMO y su fuente, la
 * interseccion cuando existe, y la marca de conflicto cuando dos condiciones piden rangos que no se
 * solapan. Ahi NO ESCOGE: su propia nota dice "ATLAS no escoge por usted: la cifra es suya".
 *
 * Y asesoriaFuera NO ES UNA VALIDACION. Solo dice que la cifra escrita quedo fuera del rango sugerido.
 * No bloquea, no corrige y no pone techo ni piso, que es lo que su §5 del 2026-08-27 prohibe para TODA
 * la prescripcion. Se renderiza como CONSTANCIA, nunca con la paleta clinica: un color ahi diria que la
 * decision del profesional esta mal, y no lo esta.
 */

// motorTratNutri: motor DETERMINISTA del objetivo nutricional (spec CC_tratamiento_nutricional_completo).
// GEB Mifflin (peso actual) x FA de la actividad PRESCRITA; protocolos por condicion con precedencia;
// salvaguarda de TCA; chips, prescripcion de actividad y referencias. La IA solo redacta la justificacion.
// ═══════════════════════════════════════════════════════════════════════════
// ASESORIA DE MACRONUTRIENTES — Direccion Cientifica, 3-sep-2026
//
// El motor NO prescribe proteina ni grasa: propone 0,8 g/kg y 30% y el
// nutricionista decide. Pero decidir sin la referencia delante es decidir a
// ciegas, asi que el conocimiento clinico que se retiro de los otros modulos
// vuelve AQUI, donde se toma la decision, y en forma de consejo.
//
// Tres reglas que esta funcion respeta:
//   1. NUNCA cambia el valor. Solo devuelve texto para mostrar.
//   2. Cuando dos condiciones piden rangos incompatibles, LO DICE en vez de
//      escoger. Puede senalar cual suele preceder; no la aplica.
//   3. Cada rango va con su porque (el mecanismo) y su fuente.
//
// `macro`: "prot" (g/kg de peso de calculo) o "grasa" (% del objetivo calorico).
function asesoriaMacro(enc, bis, macro){
  var e = enc||{}, b = bis||{};
  var dx = (Array.isArray(e.d5_39)?e.d5_39:[]).map(function(x){return String(x).toLowerCase();});
  var has = function(re){ return dx.some(function(d){ return re.test(d); }); };
  var sexoM = (b.sexo==='M'||b.sexo==='Masculino'||e.sexo==='M'||e.sexo==='Masculino');
  var edad  = Number(e.edad||b.edad)||0;
  var FFMI  = Number(b.FFMI||e.FFMI)||0;
  var FMI   = Number(b.FMI ||e.FMI )||0;
  var ASMI  = Number(b.ASMI||e.ASMI)||0;

  var dialisis = has(/di[áa]lisis|hemodi[áa]lisis/);
  var erc      = has(/renal|erc|nefr/) || dialisis;
  var cancer   = has(/c[áa]ncer|oncol|tumor/);
  var hepato   = has(/h[íi]gado|hep[áa]tic|cirrosis|esteatosis/);
  var diabetes = has(/diabet/);
  var dislip   = has(/dislip|colesterol/);
  var trigli   = has(/triglic/);
  var desnut   = FFMI>0 && (sexoM?FFMI<17:FFMI<15);
  var sarco    = ASMI>0 && (sexoM?ASMI<7 :ASMI<5.5);
  var obeso    = FMI >0 && (sexoM?FMI >6 :FMI >9);

  var it = [];
  function add(cond, min, max, porque, fuente){
    it.push({cond:cond, min:min, max:max, porque:porque, fuente:fuente});
  }

  if (macro === "prot") {
    if (dialisis)
      add("ERC en diálisis", 1.0, 1.2,
          "La sesión de diálisis arrastra aminoácidos: aquí la restricción proteica deja de proteger y empieza a costar masa magra.",
          "KDOQI 2020");
    else if (erc)
      add("ERC sin diálisis", 0.6, 0.8,
          "La urea que el riñón ya no filtra sale de la proteína. Bajar el aporte reduce la carga nitrogenada y la hiperfiltración glomerular.",
          "KDIGO 2024");
    if (desnut)
      add("FFMI bajo — desnutrición", 1.2, 1.5,
          "Sin sustrato no se reconstruye masa magra. Por debajo de 1,0 g/kg el balance nitrogenado se vuelve negativo y el paciente sigue perdiendo músculo aunque coma calorías.",
          "ESPEN 2015 · GLIM 2019");
    if (sarco)
      add("ASMI bajo — sarcopenia", 1.2, 1.5,
          "El músculo envejecido responde peor al estímulo anabólico: hace falta más proteína por comida (≥3 g de leucina) para disparar la síntesis.",
          "EWGSOP2 2019 · PROT-AGE 2013");
    if (cancer)
      add("Cáncer", 1.2, 1.5,
          "La inflamación tumoral bloquea el anabolismo y acelera el catabolismo muscular; el requerimiento sube aunque el peso no baje.",
          "ESPEN Oncología 2021");
    if (hepato)
      add("Hepatopatía", 1.2, 1.5,
          "La cirrosis cursa con sarcopenia en más de la mitad de los casos. Restringir proteína solo se justifica en encefalopatía activa, y aun así de forma transitoria.",
          "EASL 2019 · ESPEN Hígado 2019");
    if (obeso)
      add("Exceso de grasa en déficit calórico", 1.2, 1.5,
          "En restricción energética parte de la pérdida sale del músculo. Subir la proteína desvía esa pérdida hacia la grasa.",
          "AND AWM 2014 · ESPEN Obesidad 2022");
    if (edad >= 65 && !desnut && !sarco)
      add("65 años o más", 1.0, 1.2,
          "Resistencia anabólica propia de la edad: el mismo aporte rinde menos que en un adulto joven.",
          "PROT-AGE 2013 · ESPEN Geriatría 2019");
    if (!it.length)
      add("Sin condiciones que lo modifiquen", 0.8, 0.8,
          "Requerimiento basal del adulto sano. Cubre el recambio proteico sin excedente que el riñón tenga que eliminar.",
          "OMS/FAO/UNU 2007");
  } else {
    if (trigli)
      add("Hipertrigliceridemia", 20, 25,
          "Con triglicéridos muy altos el riesgo inmediato es la pancreatitis; bajar la grasa total es la palanca más rápida.",
          "Endocrine Society 2012 · ESC/EAS 2019");
    if (dislip)
      add("Dislipidemia", 25, 30,
          "Lo que mueve el LDL no es la grasa total sino la saturada: manténgala por debajo del 7% y reparta el resto en MUFA y PUFA.",
          "AHA 2021 · ESC/EAS 2019");
    if (hepato)
      add("Hígado graso", 25, 30,
          "El hígado esteatósico maneja mal el exceso de grasa saturada; el patrón mediterráneo reduce la grasa hepática incluso sin bajar de peso.",
          "EASL-EASD-EASO 2016");
    if (diabetes)
      add("Diabetes", 25, 35,
          "El total importa menos que el tipo: sustituir saturada por monoinsaturada mejora el perfil lipídico sin tocar la glucemia.",
          "ADA 2024 · EASD");
    if (desnut || cancer)
      add(desnut ? "FFMI bajo — desnutrición" : "Cáncer", 30, 35,
          "La grasa concentra 9 kcal/g: en quien tiene que subir de peso con poco apetito es la forma de meter energía en menos volumen.",
          "ESPEN 2015 · ASPEN");
    if (!it.length)
      add("Sin condiciones que lo modifiquen", 25, 35,
          "Rango aceptable de distribución de macronutrientes para el adulto sano. El 30% es el punto medio que usa el motor.",
          "IOM/NASEM AMDR · OMS 2023");
  }

  // Interseccion: si existe, cualquier cifra dentro cumple con TODAS las
  // condiciones a la vez. Si no existe, hay conflicto y hay que decidir.
  var lo = Math.max.apply(null, it.map(function(x){return x.min;}));
  var hi = Math.min.apply(null, it.map(function(x){return x.max;}));
  var conflicto = it.length > 1 && lo > hi;

  var nota = "";
  if (conflicto) {
    nota = (macro === "prot" && erc)
      ? "En la práctica suele mandar la indicación renal, y la masa magra se sostiene con energía suficiente y entrenamiento de fuerza. La cifra la decide usted."
      : "Estas condiciones piden rangos que no se solapan. ATLAS no escoge por usted: la cifra es suya.";
  }

  return {
    macro: macro,
    unidad: macro === "prot" ? "g/kg" : "%",
    items: it,
    conflicto: conflicto,
    rango: conflicto ? null : [lo, hi],
    nota: nota
  };
}

// Devuelve null si la cifra escrita respeta lo sugerido, o el texto de la
// desviacion si no. Lo usan el panel del nutricionista y la historia clinica.
function asesoriaFuera(valor, ases){
  var v = Number(valor);
  if (!ases || !isFinite(v)) return null;
  if (ases.conflicto) {
    var dentroDeAlguno = ases.items.some(function(i){ return v >= i.min && v <= i.max; });
    if (dentroDeAlguno) return null;
    return "fuera de todos los rangos sugeridos (" + ases.items.map(function(i){
      return i.cond + " " + i.min + "–" + i.max; }).join(" · ") + ")";
  }
  if (v >= ases.rango[0] && v <= ases.rango[1]) return null;
  return "fuera del rango sugerido " + ases.rango[0] + "–" + ases.rango[1] + " " + ases.unidad +
         " (" + ases.items.map(function(i){ return i.cond; }).join(" · ") + ")";
}

module.exports = { asesoriaMacro, asesoriaFuera };
