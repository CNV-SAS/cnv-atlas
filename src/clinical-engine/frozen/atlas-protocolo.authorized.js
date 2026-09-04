/**
 * GENERADO - NO EDITAR A MANO. Este es el archivo que CORRE (los imports apuntan aqui).
 * Se produce con `node scripts/gen-authorized.cjs` = original intacto + el manifiesto
 * authorized-modifications.js. Para cambiarlo se edita el MANIFIESTO, no este archivo.
 * El original (atlas-protocolo.js) queda intacto como referencia byte-identica a Gildardo.
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
