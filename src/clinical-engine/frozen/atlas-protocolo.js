/**
 * atlas-protocolo.js - CIENCIA CONGELADA (regla dura 16). NO editar, NO convertir, NO reformatear.
 *
 * REFERENCIA INTACTA, NO ES EL ARCHIVO QUE CORRE. Se conserva byte-identico al de Gildardo (su
 * DIFF-vs-fuente lo prueba). El que CORRE es atlas-protocolo.authorized.js (generado = este original
 * + el manifiesto authorized-modifications.js). Las modificaciones autorizadas por Gildardo NO se
 * hacen aqui: se agregan al manifiesto, y el original nunca se toca (asi sigue comparable con el suyo).
 *
 * Fuente: docs/entregas/gildardo-2026-07/ATLAS.html, funcion `motorProtocolo`, lineas
 *   13532-13603. Copiado VERBATIM (byte a byte) el 2026-07-28. La unica linea no presente en
 *   la fuente es el `module.exports` final (mecanismo de archivo derivado, regla 16: copia
 *   verbatim + un export aditivo). El test DIFF A verifica que el cuerpo coincide byte a byte
 *   con ese rango de la fuente.
 *
 * Que hace: fenotipo -> estrategia calorica, protMin/protMax, peso de calculo, restricciones,
 *   examenes y suplementacion. Autoria clinica de Gildardo; Atlas no la edita ni reinterpreta.
 *
 * AVISO (dos modelos caloricos sin conciliar): existe un segundo modelo calorico de Gildardo en
 *   docs/entregas/gildardo-2026-07/atlas-motores-tratamiento.js (`motorTratNutri`): Mifflin sobre
 *   peso medido, proteina por protKg x pesoMeta, estrategia por condicion clinica. Ese modulo NO
 *   produce la pantalla del Nivel IV; este inline si. Cual es el vigente esta ABIERTO en
 *   GILDARDO_QUERIES.md Q14. (Los otros tres motores del modulo tambien divergen del inline, pero
 *   parecen complementarios, no rivales; ver Q16.)
 *
 * PAL (factor de actividad): en este modelo el PAL es ENTRADA (lo elige el profesional; en la
 *   cadena TS entra como adj_pal / formulaEditPN.pal). Existe una via alternativa (el motor de
 *   ejercicio del modulo devuelve faRec, un PAL calculado); si Q14/Q16 resolvieran a favor del
 *   modulo, el PAL pasaria de elegido a calculado: cambia de donde viene el valor, no la forma
 *   de la cadena.
 *
 * La cadena aritmetica del plan (GEB/GET/objetivo/macros, ATLAS.html:14124-14137) NO vive aqui:
 *   es TS nuestro en clinical-engine/protocolo-calorico.ts (su fuente es inline, no un artefacto
 *   independiente; regla 5 no exige frozen/). Su paridad se prueba por golden, no por congelamiento.
 *
 * RE-PORT 2026-08-19 (punto 6 del delta del 18, verbatim): el OBJETIVO CALORICO ya no lo deriva el
 *   sistema. Se retiraron los cinco deficits por fenotipo (-300/500/600/300/mantenimiento): el deficit
 *   queda en 0 para todos y la orientacion del fenotipo pasa a texto sin cifra en el campo `perfil`. El
 *   label lo dice ("el objetivo calorico lo define el profesional"). La cadena calorica queda entonces en
 *   mantenimiento (kcalObj = GET) hasta que el nutricionista ajuste. Sin hueco de "cero sin explicacion":
 *   el panel de tratamiento ya usaba el GET MEDIDO como precarga editable (treatment-reader), no el deficit
 *   del motor. Unica mod autorizada: CA-1 (retira telomeros del listado), intacta (su oldSlice no se toco).
 */

const motorProtocolo = (bis, enc, motor) => {
  const sexoM = bis?.sexo==='M'||bis?.sexo==='Masculino'||enc?.sexo==='M'||enc?.sexo==='Masculino';
  const diagnosticos = Array.isArray(enc?.d5_39) ? enc.d5_39 : [];
  const fenotipo = motor?.fenotipo?.id || 'F11';
  const sector = motor?.sectorFR || 'S4';
  const irc = Number(bis?.irc||enc?.irc)||0;
  const iscm = Number(bis?.iscm||enc?.iscm)||0;
  const iehh = Number(bis?.iehh||enc?.iehh)||0;
  const iae = Number(bis?.iae||enc?.iae)||0;
  const FMI = Number(bis?.FMI||enc?.FMI)||0;
  const FFMI = Number(bis?.FFMI||enc?.FFMI)||0;
  const peso = Number(bis?.peso||enc?.peso)||0;
  const talla = Number(bis?.talla||enc?.talla)||0;
  const FFM = Number(bis?.FFM||enc?.FFM)||0;
  const imc = Number(bis?.imc||enc?.imc)||0;
  const tieneIRC = diagnosticos.some(d => d.toLowerCase().includes('renal'));
  const tieneCancer = diagnosticos.some(d => d.toLowerCase().includes('cáncer')||d.toLowerCase().includes('cancer'));
  const tieneDM = diagnosticos.some(d => d.toLowerCase().includes('diabet'));
  const tieneHTA = diagnosticos.some(d => d.toLowerCase().includes('hipert')||d.toLowerCase().includes('hta')) || enc?.d5_36==='Sí';
  const tieneObesidadSarcopenica = motor?.obesidadSarcopenica || false;
  const PI = sexoM ? talla-100-((talla-150)/4) : talla-100-((talla-150)/2.5);
  const pesoCalculo = tieneIRC||tieneCancer ? peso : imc<25 ? peso : PI+0.25*(peso-PI);
  const pesoCalculoLabel = tieneIRC||tieneCancer ? 'Peso actual (IRC/Cáncer — sin restricción)' : imc<25 ? 'Peso actual (IMC normal)' : 'Peso ajustado (obesidad)';
  // El objetivo calórico NO lo deriva el sistema: lo decide el nutricionista
  // (Dirección Científica, 13-ago-2026). Antes cada fenotipo imponía un déficit
  // sugerido -300, 500, 600, 300 o mantenimiento, y con él una etiqueta con
  // cifra. Se retiran los cinco: el déficit queda en 0 y la orientación del
  // fenotipo se conserva como texto, sin número, en el campo perfil.
  const estrategia = (() => {
    const _base = { tipo:'Mantenimiento', deficit:0, label:'Mantenimiento · el objetivo calórico lo define el profesional', color:'#0f766e' };
    if (tieneCancer || ['F7','F10'].includes(fenotipo)) return { ..._base, perfil:'Perfil de cáncer o desnutrición: priorizar densidad energética y proteica', ref:'ESPEN 2023 — cáncer/desnutrición' };
    if (fenotipo==='F1'||tieneObesidadSarcopenica) return { ..._base, perfil:'Perfil de obesidad sarcopénica: preservar masa magra, evitar restricción agresiva', ref:'ESPEN 2023 — obesidad sarcopénica: no restricción agresiva' };
    if (['F2','F3'].includes(fenotipo)) return { ..._base, perfil:'Perfil de obesidad clínica', ref:'ESPEN 2023 — obesidad clínica' };
    if (['F4','F5'].includes(fenotipo)) return { ..._base, perfil:'Perfil de obesidad preclínica', ref:'ESPEN 2023 — obesidad preclínica' };
    if (fenotipo==='F11') return { ..._base, perfil:'Composición corporal adecuada', ref:'Sin restricción — composición adecuada' };
    return { ..._base, perfil:'', ref:'Sin restricción' };
  })();
  const protMin = (() => { if (tieneIRC) return 0.6; if (tieneCancer) return 1.5; if (fenotipo==='F1'||tieneObesidadSarcopenica) return 1.2; if (['F7','F10'].includes(fenotipo)) return 1.5; return 0.8; })();
  const protMax = (() => { if (tieneIRC) return 0.8; if (tieneCancer) return 2.0; if (fenotipo==='F1'||tieneObesidadSarcopenica) return 1.5; if (['F7','F10'].includes(fenotipo)) return 2.0; return 1.2; })();
  const protRef = tieneIRC ? 'KDIGO 2024' : tieneCancer ? 'ESPEN Oncología 2023' : tieneObesidadSarcopenica ? 'ESPEN Sarcopenia 2023' : 'ESPEN 2023';
  const restricciones = [
    tieneIRC ? { nombre:'Proteína', valor:'0.6–0.8 g/kg', ref:'KDIGO 2024' } : null,
    tieneIRC ? { nombre:'Fósforo', valor:'< 800 mg/día', ref:'KDIGO 2024' } : null,
    tieneIRC ? { nombre:'Potasio', valor:'< 2000 mg/día', ref:'KDIGO 2024' } : null,
    tieneHTA ? { nombre:'Sodio', valor:'< 2300 mg/día', ref:'DASH — JNC 2023' } : null,
    tieneDM ? { nombre:'CHO simples', valor:'< 10% GET', ref:'ADA 2024' } : null,
    ['F1','F2','F3','F4','F5'].includes(fenotipo) ? { nombre:'AGS', valor:'< 7% GET', ref:'AHA 2023' } : null,
    ['F1','F2','F3','F4','F5'].includes(fenotipo) ? { nombre:'Ultraprocesados', valor:'Eliminar', ref:'NOVA + ESPEN 2023' } : null,
  ].filter(Boolean);
  const examenes = [
    tieneIRC ? { nombre:'Creatinina sérica', razon:'Monitoreo función renal', protocolo:'KDIGO 2024', prioridad:'alta' } : null,
    tieneIRC ? { nombre:'TFG estimada', razon:'Estadificación ERC', protocolo:'KDIGO 2024', prioridad:'alta' } : null,
    tieneIRC ? { nombre:'BUN', razon:'Carga nitrogenada', protocolo:'KDIGO 2024', prioridad:'alta' } : null,
    tieneIRC ? { nombre:'Fósforo sérico', razon:'Ajuste dietario', protocolo:'KDIGO 2024', prioridad:'alta' } : null,
    tieneIRC ? { nombre:'Potasio sérico', razon:'Ajuste dietario', protocolo:'KDIGO 2024', prioridad:'alta' } : null,
    { nombre:'Albumina sérica', razon:'Estado nutricional GLIM', protocolo:'GLIM 2023', prioridad:'alta' },
    { nombre:'PCR ultrasensible', razon:'Inflamación sector '+sector, protocolo:'ESPEN 2023', prioridad:'alta' },
    { nombre:'Perfil lipídico', razon:'Riesgo cardiometabólico ISCM', protocolo:'AHA 2023', prioridad:'alta' },
    { nombre:'Glicemia en ayunas', razon:'Riesgo DM2 fenotipo '+fenotipo, protocolo:'ADA 2024', prioridad:'alta' },
    { nombre:'Insulina + HOMA-IR', razon:'Resistencia insulínica', protocolo:'ADA 2024', prioridad:'media' },
    { nombre:'HbA1c', razon:'Control glucémico', protocolo:'ADA 2024', prioridad: tieneDM?'alta':'media' },
    { nombre:'Vitamina D 25-OH', razon:'Déficit frecuente en obesidad', protocolo:'Endocrine Society 2023', prioridad:'media' },
    { nombre:'Zinc sérico', razon:'MCA reducida — déficit frecuente', protocolo:'ESPEN 2023', prioridad:'media' },
    tieneObesidadSarcopenica ? { nombre:'Prealbúmina', razon:'Marcador nutricional agudo', protocolo:'ASPEN 2023', prioridad:'alta' } : null,
    ['F7','F10'].includes(fenotipo) ? { nombre:'Fósforo, potasio, magnesio, tiamina', razon:'Síndrome de realimentación', protocolo:'ASPEN 2023', prioridad:'crítica' } : null,
    iae > 5 ? { nombre:'Telómeros/estrés oxidativo', razon:'IAE acelerado +'+iae.toFixed(1)+' años', protocolo:'ANI BIS-E 2026', prioridad:'media' } : null,
  ].filter(Boolean);
  const suplementacion = [
    (iehh > 1 || sector==='S9' || sector==='S8') ? { nombre:'Omega-3', dosis:'3g/día', razon:'IEHH severo + sector '+sector, vitacellebis:'OMEGA-3 BIS' } : null,
    imc > 30 ? { nombre:'Vitamina D3', dosis:'2000 UI/día', razon:'Déficit frecuente en obesidad', vitacellebis:'VITAD-BIS' } : null,
    Number(bis?.MCA_dif||0) < -1 ? { nombre:'Zinc', dosis:'15mg/día', razon:'Déficit MCA', vitacellebis:'ZINC-BIS' } : null,
    tieneObesidadSarcopenica ? { nombre:'Leucina/BCAA', dosis:'3g/día', razon:'Obesidad sarcopénica ESPEN', vitacellebis:'AMINOBIS' } : null,
    iae > 5 ? { nombre:'Coenzima Q10', dosis:'100mg/día', razon:'Envejecimiento acelerado IAE +'+iae.toFixed(1), vitacellebis:'COQBIS' } : null,
  ].filter(Boolean);
  const resumenClinico = `Paciente con fenotipo ${fenotipo} (${motor?.fenotipo?.nombre||'—'}), sector ANI BIS-E ${sector} (${motor?.nombreFR||'—'})${tieneIRC?', con insuficiencia renal preexistente':''}${tieneObesidadSarcopenica?', obesidad sarcopénica confirmada':''}${tieneCancer?', diagnóstico oncológico activo':''}. Protocolo sugerido: ${estrategia.label}${tieneIRC?', con restricción proteica según KDIGO 2024':''}.`;
  const alertaSindRealim = ['F7','F10'].includes(fenotipo) && (Number(bis?.GEB||0) < 1200) && (Number(bis?.imc||enc?.imc||0) < 18.5);
  return { pesoCalculo, pesoCalculoLabel, PI, estrategia, protMin, protMax, protRef, restricciones, examenes, suplementacion, resumenClinico, alertaSindRealim, tieneIRC, tieneCancer, tieneDM, tieneHTA, tieneObesidadSarcopenica };
};

module.exports = { motorProtocolo };
