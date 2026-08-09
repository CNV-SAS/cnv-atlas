/**
 * derivar-composicion.js - CIENCIA CONGELADA (regla dura 16). NO editar, NO convertir, NO reformatear.
 *
 * Derivaciones de composicion del modelo ANI-BIS-E (identidades que reconstruyen la composicion que un
 * export corto del Biody no trae, a partir de lo que si trae). Autoria clinica de Gildardo; Atlas no las
 * edita ni reinterpreta. Portadas VERBATIM (byte a byte) del archivo VIGENTE
 * docs/entregas/gildardo-2026-08-04/ATLAS_v8.html, rango CONTIGUO L153-235 ("Seccion 4 - derivaciones" +
 * "Seccion 4.8 - control de calidad"). Lo unico no presente en la fuente es el module.exports final.
 *
 * RESPALDO (verificado 2026-08-09, ver docs/PLAN_EA1.md): las CINCO identidades de agua/masa (4.1-4.3:
 * FFW, ECW_sg/AEC_sg, ICW_sg/AIC_sg, MPM/protActiva, MCA) son las que Gildardo confirmo explicitamente
 * (R2=1.000000 sobre 5.073 registros). Las demas (4.5-4.7: IR, smmW, ei, ei_sg, aec_mca, ECM, ECM_BCM,
 * ACT_MLG, hidSG) son razones/compuestos definicionales del MISMO bloque, cubiertos por la afirmacion de
 * cabecera del v8 ("constantes y formulas verificadas contra 5.073 registros"), pero SIN el reporte R2
 * individual. Se portan igual (es su codigo, su bloque verificado) y el golden las ancla contra los
 * valores MEDIDOS por el equipo (fixture ZM3), asi que quedan verificadas empiricamente aqui tambien.
 * NOTA: el v8 salta de 4.3 a 4.5 (no hay 4.4): seccion removida/renumerada por Gildardo, no un hueco nuestro.
 */

// Sección 4 — derivaciones. Operan sobre el objeto ya normalizado por
// importarComposicion, NO sobre encabezados crudos. Solo rellenan lo ausente:
// un valor que venga en el Excel jamás se sobrescribe (regla de precedencia).
var ESPECTRO_FORMULAS_V = '1.0';

function derivarFaltantes(d) {
  var origen = {};
  var num = function (v) { var x = parseFloat(v); return isFinite(x) ? x : null; };
  // Rellena solo si el destino está ausente y el cálculo da un número.
  var poner = function (campo, valor, formula) {
    if (d[campo] != null && isFinite(parseFloat(d[campo]))) return;   // medido: intocable
    if (valor == null || !isFinite(valor)) return;
    d[campo] = parseFloat(valor.toFixed(4));
    origen[campo] = { origen:'derivado', formula:formula, version:ESPECTRO_FORMULAS_V };
  };

  var FM  = num(d.FM),  ACT = num(d.TBW), AEC = num(d.ECW), AIC = num(d.ICW);
  var FFM = num(d.FFM), CMO = num(d.CMO), peso = num(d.peso);
  var MSSG = num(d.masaSeca), SES = num(d.solEC), MNO = num(d.minNoOseo);
  var SMM = num(d.SMM), Z200 = num(d.Z200), Z5 = num(d.Z5);

  // 4.1 constante de hidratación del tejido graso: 0,15 × FM (75 % EC / 25 % IC)
  if (FM !== null) {
    if (ACT !== null) poner('FFW',    ACT - 0.15   * FM, 'FFW = ACT − 0,15 × FM');
    if (AEC !== null) poner('ECW_sg', AEC - 0.1125 * FM, 'AEC_sg = AEC − 0,1125 × FM');
    if (AIC !== null) poner('ICW_sg', AIC - 0.0375 * FM, 'AIC_sg = AIC − 0,0375 × FM');
  }

  // 4.2 masa proteica metabólica
  if (MSSG !== null && SES !== null && MNO !== null)
    poner('protActiva', MSSG - SES - MNO, 'MPM = MSSG − SES − MNO');

  // 4.3 masa celular activa — AIC es el agua intracelular TOTAL, no la libre de grasa
  var MPM = num(d.protActiva);
  if (AIC !== null && MPM !== null)
    poner('MCA', 1.0162 * AIC + MPM, 'MCA = 1,0162 × AIC + MPM');

  // 4.5 radio de impedancia
  if (Z200 !== null && Z5 !== null && Z5 !== 0)
    poner('IR', Z200 / Z5, 'IR = Z200 / Z5');

  // 4.6 razones e índices
  var MCA = num(d.MCA);
  if (SMM !== null && peso !== null && peso !== 0) poner('smmW', SMM / peso * 100, 'SMM/W = SMM / peso × 100');
  if (AEC !== null && AIC !== null && AIC !== 0)   poner('ei',   AEC / AIC, 'AEC/AIC');
  var AECsg = num(d.ECW_sg), AICsg = num(d.ICW_sg);
  if (AECsg !== null && AICsg !== null && AICsg !== 0) poner('ei_sg', AECsg / AICsg, 'AEC/AIC sin grasa');
  if (AEC !== null && MCA !== null && MCA !== 0)   poner('aec_mca', AEC / MCA, 'AEC/MCA');
  if (FFM !== null && MCA !== null) {
    poner('ECM', FFM - MCA, 'ECM = FFM − MCA');
    if (MCA !== 0) poner('ECM_BCM', (FFM - MCA) / MCA, 'ECM/MCA = (FFM − MCA) / MCA');
  }

  // 4.7 los dos indicadores de hidratación, que no son el mismo
  if (ACT !== null && FFM !== null && FFM !== 0)
    poner('ACT_MLG', ACT / FFM * 100, 'Hidratación de la masa sin grasa = ACT / FFM × 100');
  var FFW = num(d.FFW);
  if (FFW !== null && FFM !== null && FM !== null) {
    var denHid = FFM - 0.15 * FM;
    if (denHid !== 0) poner('hidSG', FFW / denHid * 100, 'Hidratación sin grasa = FFW / (FFM − 0,15 × FM) × 100');
  }

  return origen;
}

// Sección 4.8 — identidades de control de calidad del import. Marcan la medición
// para revisión si fallan por más de 0,05 kg. Nunca bloquean.
function controlCalidadImport(d) {
  var n = function (v) { var x = parseFloat(v); return isFinite(x) ? x : null; };
  var fallos = [];
  var chk = function (nombre, izq, der) {
    if (izq === null || der === null) return;
    var dif = Math.abs(izq - der);
    if (dif > 0.05) fallos.push(nombre + ': desvío ' + dif.toFixed(3) + ' kg');
  };
  var MSSG = n(d.masaSeca), MPM = n(d.protActiva), SES = n(d.solEC), MNO = n(d.minNoOseo);
  var FFM = n(d.FFM), ACT = n(d.TBW), CMO = n(d.CMO), magra = n(d.masaMagra);
  if (MPM !== null && SES !== null && MNO !== null) chk('MSSG = MPM + SES + MNO', MSSG, MPM + SES + MNO);
  if (ACT !== null && MSSG !== null)                chk('FFM = ACT + MSSG', FFM, ACT + MSSG);
  if (FFM !== null && CMO !== null && magra !== null) chk('Masa magra = FFM − CMO', magra, FFM - CMO);
  if (fallos.length) console.warn('[ATLAS espectroscopía] control de calidad del import:', fallos);
  return fallos;
}
module.exports = { derivarFaltantes, controlCalidadImport, ESPECTRO_FORMULAS_V };
